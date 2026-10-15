---
title: "Actors and AI"
date: 2026-10-15
description: "How client actors get commands and walk, action kinds, the authored squad spawner, and the class definitions objects are built from."
weight: 90
---

The client carries the full AI stack. The client that holds authority over a bubble can run the
actors in it: their commands, path finding and behavior. The Activity Host sends encounter state.
Whether retail also runs a separate physics or AI host is unknown.

Action and object type names are the game's own. Function and field names are descriptive labels. The 98 actor command selectors have no engine names and are known only by
number.

For slot types, Auth and Sense, see
[The Activity Host protocol](/docs/destiny-2/activity-host-protocol/).

## How an actor walks

A locally created actor stands still until something gives it a movement goal. The path finding
stack is complete and local, but it is never asked for a path without that goal.

The chain, all inside the client:

| step | what it does |
|---|---|
| `Actor_DispatchCommand` | reads a command's selector and routes it to one consumer |
| `Actor_ResolveCommandConsumer` | maps a consumer index to a sub-object and a handler |
| `AiAction_MoveHandler` | the path client's handler |
| `ActorPathClient_SetMovementGoal` | writes the movement goal |
| `ActorPathClient_Tick` | per-frame path client update |
| `ActorPathClient_EvaluateGoalAndSubmitPath` | checks the gates and submits a query |
| `PathQuery_Submit` | marks the query pending |
| `PathFinding_SystemTick` | runs pending queries |
| `PathQuery_FetchResult` | copies 896 bytes of waypoints out |

### Command records

Commands are authored in packages. An actor group loads a blob of command records and turns each
one into a 128-byte runtime command.

```c
struct ActorCommand {          /* 128 bytes */
    uint8_t body[96];          /* +0x00  holds the payload; exact layout unknown */
    int8_t  selector;          /* +0x60  0 to 97 */
    uint8_t pad[25];
    uint8_t route;             /* +0x7A  how to resolve the payload's references */
    uint8_t rest[5];
};
```

The builder copies source record byte `+10` to the selector and byte `+11` to the route. It then
copies the payload from source `+16`. The payload length comes from the selector's metadata row.
The selector is never a literal in code. It always comes from data.

The route byte picks one of three payload resolvers: 2 uses a context lookup, 3 a global or
reference lookup, and any other value the consumer's default decoder.

An actor group holds its live command list:

```c
struct ActorGroupOrders {
    /* fields before +0x060 not shown */
    uint8_t      params[176];     /* +0x060  parameter block */
    uint32_t     count;           /* +0x110  six-bit count */
    uint8_t      pad[12];
    ActorCommand commands[32];    /* +0x120 */
};
```

The list is part of the group's replicated component state. Only the entity's owner can update it.
A peer that does not own the actor cannot rewrite its orders.

Selector 30, the move command, is the only one re-issued when its parameter block changes while
the command itself stays the same.

### The command router

A command goes to one of eleven consumers. Consumers 0 to 9 are sub-objects of the actor's AI
record. Consumer 10 is a per-actor row outside it.

| index | role |
|---:|---|
| 0 | actor rows and structured targets |
| 1 | a three-field state record |
| 2 | actor-linked ids and actions |
| 3 | the path client |
| 4 | flags, ids and target state |
| 5 | a selected row and a direction |
| 6 | target lanes and actor-linked vectors |
| 7 | the actor input record (faction, input state) |
| 8 | three state blocks |
| 9 | actor-owned records, spawn entries |
| 10 | a per-actor row outside the AI record |

The roles summarize what each handler writes. The dispatcher maps the 98 selectors
onto 18 consumer indexes. Indexes 11 to 17 have no consumer, so 38 selectors do nothing on this
path. Selector 0 returns at once. Selector 88 skips the resolver and calls consumer 0 directly.

There are three dispatch paths:

| path | when |
|---|---|
| main | a command is added to or changed in the persistent list |
| removal | a command leaves the persistent list |
| event ring | one-shot commands queued on the actor and drained each actor frame |

The main and event-ring paths carry the same 98-case switch but different handlers. A selector
with a main effect can have no event-ring effect.

```c
void Actor_Frame(Actor *a)
{
    ActorGroup_DiffPersistentList(a, on_added_or_changed, on_removed);
    for (ActorCommand *c : a->event_ring)
        Actor_DispatchEventRingCommand(a, c);
    a->event_ring.clear();
}
```

### The command kinds that reach the path client

Only three selectors reach consumer 3:

| selector | effect |
|---:|---|
| 30 | builds the movement goal |
| 31 | writes a 64-bit id on the path client |
| 74 | writes a position input and sets a flag |

So an actor that never gets selector 30 never has a movement goal.

### Path request gates

The path client checks five gates in order. Any one stops the actor without a query.

```c
void ActorPathClient_EvaluateGoalAndSubmitPath(PathClient *pc, ActorInput *in)
{
    if (in->flags & 0x200)                    /* 1: input record says blocked */
        return on_blocked();
    int kind = MovementGoal_GetKind(&pc->goal);
    if (kind == 0)                            /* 2: no goal */
        return on_no_goal();
    if (kind == 6 && !resolve(pc->goal.target_id))
        return on_no_goal();                  /* 3: goal target gone */

    switch (MovementGoal_ResolveToDestination(&pc->goal)) {   /* 4: destination */
    case 0: move_direct(pc); return;          /* no path needed */
    case 1: break;                            /* needs a path */
    case 2: turn_in_place(pc); return;
    default: clear_goal(pc); return;
    }
    if (!MovementProfile_Accepts(pc))         /* 5: movement profile */
        return clear_goal(pc);

    PathQuery_Submit(pc);
}
```

Gate 2 holds a new actor. The goal starts empty, and the move handler is its only known writer.

Gate 1's bit is clear when the input record is created. A refresh sets it when a check fails. One
term of that check is a parenting test. No authority or ownership test is on this path. The name
"movement profile" for gate 5's table is assumed.

### The AI time budget

The actor executor updates one actor per tick. Each actor gets a time slice for the frame. When the
slice is zero, the path client, mover, policy and sensors all skip that frame. Running totals are
checked against three caps. Crossing one sets a throttle bit.

This is an update-rate throttle, not a data gate. It can make one actor move on some frames and not
others.

### Path finding is local

The path finding system is in-process. It holds a pool of 9,648-byte queries. Each tick it takes up
to six pending queries and runs three jobs for each:

```text
ai: single path finding job0
ai: single path finding job1
ai: single path finding job2
```

It waits for them in the same call. A query's status is -1 when idle and 10 when done. No network
call is on this path.

A sibling pipeline picks firing points (`ai: fp select job`, `ai: fp path finding job`). Whether a
firing point becomes a movement goal is unverified.

### Nav data

Nav data is package content, loaded per region. A map component registers each nav region's
polygons and reference frames when it loads, and unregisters them when it unloads. Unregistering
also resets the region's dynamic firing points, jump hints, avoidance volumes and nav links.

The waypoint HUD uses a different system with its own node graph.

## The 98 actor command selectors

The client has a 98-row table of command metadata, one 32-byte row per selector.

```c
struct ActorCommandMeta {       /* 32 bytes */
    uint8_t  in_policy_table;   /* +0x00  gives the selector an ordinal */
    uint8_t  bank;              /* +0x01  one of two result/state banks */
    uint8_t  exclusion_group;   /* +0x02  0 = no conflicts */
    uint8_t  chain_previous;    /* +0x03  keep and chain the previous record */
    int32_t  ordinal;           /* +0x04  -1 when +0x00 is clear */
    uint64_t opaque;            /* +0x08  no known reader */
    uint64_t payload_bytes;     /* +0x10  exact copy length */
    uint64_t payload_class;     /* +0x18  reflected payload class */
};
```

71 selectors get an ordinal and 27 do not. The main selectors:

| selector | payload bytes | consumer | main effect | event-ring effect |
|---:|---:|---:|---|---|
| 0 | 16 | -- | none | none |
| 3 | 40 | 0 | none | submits a target |
| 4 | 16 | 7 | input state | yes |
| 8 | 24 | 9 | builds an actor record | yes |
| 20 | 40 | 4 | none | cleanup |
| 30 | 1 | 3 | sets the movement goal | none |
| 31 | 1 | 3 | writes a 64-bit id | none |
| 39 | 1 | 1 | writes a state record | none |
| 45 | 4 | 7 | sets the actor faction | none |
| 69 | 32 | 0 | submits structured targets | none |
| 74 | 12 | 3 | writes a position input | none |
| 75 | 1 | 9 | builds an actor record | yes |
| 83 to 85 | 36 | 8 | update state blocks | none |
| 88 | 8 | 0 (direct) | submits structured targets | none |
| 91 | 84 | -- | none | none |
| 97 | 16 | 6 | updates actor-linked vectors | none |

Only 30, 31, 45 and 74 have a meaning confirmed by their use. 48 selectors have no main effect.
24 have an event-ring effect.

Selector 45 shows why the two paths matter. It sets the faction on the main path. The event ring
drops it, because that consumer only handles selectors 4, 14 and 15. So a faction command sent as a
one-shot event does nothing.

## Object behaviors

Placed objects carry behavior programs that run on the client. How they start, their node types
and their object filters are on [Behaviors](/docs/destiny-2/behaviors/#object-behaviors).

## Action kinds

An action request is 80 bytes. Its byte 0 is the action kind. The behavior node
`player_custom_interaction` sends kind 70. The engine has 120 action kinds, 0 to 119, covering the
whole player and AI action surface. A few:

| kind | action |
|---:|---|
| 0 | `loki_play_animation` |
| 1 | `death` |
| 23 | `grenade` |
| 51 | `ai_sequence` |
| 70 | `player_custom_interaction` |
| 95 | `weapon_fire` |
| 97 | `jump` |
| 106 | `player_locomotion` |
| 108 | `physics_driven_ai_locomotion` |

Only kind 70 is verified in the PC code. Several kinds share one implementation. These action kinds
are not the actor command selectors. No mapping between the two is known.

## Temperaments

An actor's behavior variant comes from a set of up to six temperament ids. The client merges it
from the actor, its squad, gameplay switches, the package definition, the active behavior context and
the `combatant_sensor` Auth body. Each id is looked up in a table owned by the actor's behavior
definition. The matching row picks native behavior states, and a change rebuilds the active state.

Two writers change the set at run time: a client atom in the `combatant_sensor` program, and a
packaged action that adds or removes one id. All 121 installed packaged actions remove; none adds.
The installed ids are 0 to 12 and 14. No id has a known name, so none can be called neutral or
hostile. No damage, hit, health or faction code writes the set.

## The authored squad spawner

Enemy squads are placed by a native spawner component, class `0x80809A3B`. It is the type-1
activity slot, `squad_sensor`. The Activity Host drives it through that slot's Auth body. The
client that holds bubble authority does the rest: it picks members, finds spawn points and creates
the actors.

The word "squad" is also used for a replicated simulation entity kind. No link between the two is
known.

### What the package supplies

- The spawner definition: member slots and candidate actors, six candidate lanes per member.
- A reference at definition `+0x98` and `+0xA0` to a spawn rule.
- The spawn rule: a point set whose points match placed objects by identity.

The reference format:

```c
struct ObjectSlotRef {      /* 8 bytes */
    uint32_t object_key;
    uint8_t  slot_type;     /* 0xFF = unset */
    uint8_t  pad;
    uint16_t slot_index;    /* 0xFFFF = unset */
};
```

The static chain from the squad slot to a position:

```text
type-1 squad slot
  -> spawner definition +0x98 / +0xA0
     -> type-66 slot holding the spawn rule
        -> point identity
           -> placed object identity and transform
```

Some spawners carry their own single point instead of a rule reference. Tower vendors use that
form.

### The Auth body

The type-1 Auth body is 196 bytes. The known fields:

```c
struct SquadAuth {              /* 196 bytes; widths inferred from the offsets */
    uint64_t objective_ref;     /* +0x00 */
    uint64_t collection_ref;    /* +0x08  used when +0x00 is unset */
    uint8_t  pad0[0x24];
    uint32_t slot_count;        /* +0x2C  must match the definition */
    uint32_t count_per_slot[8]; /* +0x30  requested members */
    uint32_t explicit_count;    /* +0x50 */
    int32_t  explicit_index[8]; /* +0x54  per-member candidate index */
    int32_t  lane;              /* +0x74  candidate lane */
    uint8_t  pad1[4];
    int32_t  generation;        /* +0x7C  spawn generation */
    uint8_t  pad2[0x10];
    ObjectSlotRef dest_squad;   /* +0x90 */
    ObjectSlotRef rule_ref[2];  /* +0x98  overrides the package rule */
    int32_t  objective_rev;     /* +0xA8 */
    int32_t  awareness_rev;     /* +0xAC */
    int32_t  unknown_b0;        /* +0xB0  purpose unverified */
    int32_t  objective_group;   /* +0xB4  -1 = no objective */
    int32_t  dest_rev;          /* +0xB8 */
    uint8_t  active;            /* +0xBC */
    uint8_t  mode;              /* +0xBD  0 and 2 can spawn at once */
    uint8_t  pad3[2];
    uint32_t name_hash;         /* +0xC0 */
};
```

Rules the client applies:

- The rule reference at `+0x98` wins. The package reference is used only when it holds the unset
  sentinel. A bad reference that is not the sentinel silently disables the package rule.
- A changed `generation` tears the squad down first. The compare is `!=`, not `>`.
- With `active` zero, that teardown destroys the members. With `active` set, it releases them.
- Member counts are not gated by the generation. Resending the same generation with new counts
  changes the population without a teardown.

### Placing members

```c
void Squad_Reconcile(Squad *s, SquadAuth *a)
{
    for (int i = 0; i < a->slot_count; i++) {
        int deficit = a->count_per_slot[i] - s->existing[i]
                    - s->reserved[i] - s->in_flight[i];
        if (deficit > 0 && (a->mode == 0 || a->mode == 2))
            AuthoredSpawner_BuildRequests(s, i, deficit);
    }
}
```

The requests go to one global table, capped at 80 requests. When it is full, new requests are
dropped with no error. A per-frame drain resolves each point and asks the point object to place the
actor.

The spawn rule picks points by a policy byte:

| value | choice |
|---:|---|
| 0 | walk from index 0 |
| 1 | shuffle with an LCG |
| 2 | start after the last used point, wrapping |
| 3, other | two further methods; not read |

Rule names fit the values: patrol rules use 2, reinforcement rules use 1.

### What the squad reports

The squad's Sense body goes back to the host. It carries a generation echo, the alive member
count, members ever created per slot, and objective costs.

The alive count is recomputed on each report by checking each member's handle. There is no death
event in this build. The host sees a death only as a fall in the alive count, with no member
identity and no cause.

A bound actor's `combatant_sensor` Sense also reports its primary and secondary damage-pool
fractions, as seven-bit values from 0 to 1. A fraction below one shows the actor took damage. It
carries no attacker or cause, and a small hit can leave the quantized value unchanged. The object
sensor slot reports a per-object spawn and death on its own Sense; see
[The Activity Host protocol](/docs/destiny-2/activity-host-protocol/).

## Class definitions

Every placed object, actor and player is built from a class definition, a package tag of class
`0x80809C0F`. The install holds 46,235. A class definition lists its component configs and carries
a hash map of the component definition hashes it holds. Looking up a component on an object asks
each node of the object's class chain whether its map holds the hash. The first match wins.

`classDef + 8` is the FNV-1 hash of the class's internal name, such as `fallen_vandal`. Most class
definitions have none and read `0x811C9DC5`.

### Object types

The byte at `classDef + 150` is an object type. The 29 type names are the engine's own:

| type | name | type | name |
|---:|---|---:|---|
| 0 | `inherited` | 15 | `vehicle` |
| 1 | `static_mesh` | 16 | `turret` |
| 2 | `prop_simple_DEPRECATED` | 17 | `emitter` |
| 3 | `prop_expensive_DEPRECATED` | 18 | `projectile` |
| 4 | `prop_cosmetic_static` | 19 | `item` |
| 5 | `prop_cosmetic_movable` | 20 | `item_ammo` |
| 6 | `prop_cosmetic_movable_garbage` | 21 | `item_loot` |
| 7 | `prop_networked_static` | 22 | `gear` |
| 8 | `prop_networked_movable` | 23 | `hop_on` |
| 9 | `prop_cinematic` | 24 | `hop_on_gear_biped` |
| 10 | `speedtree` | 25 | `hop_on_gear_weapon` |
| 11 | `interactive` | 26 | `hop_on_gear_ship` |
| 12 | `biped` | 27 | `hop_on_gear_sparrow` |
| 13 | `creature` | 28 | `system` |
| 14 | `weapon` | | |

### The player classes

Only three player class definitions exist: `player_guardian`, `player_hunter` and `player_warlock`.
There is no `player_titan`. The character's class byte reaches a class definition through two
`investment_globals` tables:

| class byte | class | class definition |
|---:|---|---|
| 0 | `titan` | `player_guardian` |
| 1 | `hunter` | `player_hunter` |
| 2 | `warlock` | `player_warlock` |

So `player_guardian` is the Titan's class, not a shared base. All three carry the ability container
and 61 or 62 components, far more than any other class. The class byte is server data, in the
character record.

### Combatant display names

An enemy's display name, such as "Vandal" or "Taken Knight", is not in the investment tables. It
comes from the class definition: the combatant component's config references a record of class
`0x8080815F`, whose `+0x08` is a localized string hash. 354 such records exist and 128 distinct names
resolve, covering the ordinary roster and bosses such as "Nightmare of Crota, Son of Oryx". A
record's hash resolves without a string bank, so a hash that two containers use stays ambiguous. The
record has no known race or faction field.

## Open questions

- Names for the 98 command selectors.
- Most of the actor group's class-message slots. 20 of 24 are unknown.
- The native binding behind a spawn point and its lifetime.
- How the retail host sets a guard's "neutral until attacked" state, and what each temperament id
  means.

## Related pages

- [Behaviors](/docs/destiny-2/behaviors/) -- the programs placed objects run.
- [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/) -- slot types, Auth and
  Sense.
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/) -- where the placed
  objects live.
- [World geometry and collision](/docs/destiny-2/world-geometry-and-collision/) -- entity physics,
  hitboxes and damage parts.
- [Enemies and NPCs](/docs/sunrise-studio/enemies/) -- viewing and editing enemies in Sunrise Studio.
