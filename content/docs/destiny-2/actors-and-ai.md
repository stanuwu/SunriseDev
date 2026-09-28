---
title: "Actors and AI"
date: 2026-09-28
description: "How client actors get commands and walk, the object-behavior VM, and the authored squad spawner."
weight: 90
---

The client carries the full AI stack. The client that holds authority over a bubble can run the
actors in it: their commands, path finding and behavior. The Activity Host sends encounter state.
Whether retail also used a separate physics or AI host is unknown.

Behavior node, object filter and action names are the game's own. They come from the class names
in a console build of the same era. Function and field names are descriptive labels. The 98 actor
command selectors have no engine names and are known only by number.

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
    uint8_t body[96];          /* +0x00  holds the payload; exact layout not read */
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
checked against three caps; crossing one sets a throttle bit.

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
firing point becomes a movement goal is not verified.

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
    uint64_t opaque;            /* +0x08  no reader found */
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

## The object-behavior VM

Objects in activities and destinations carry authored behavior programs. A program runs on the
client, with no server or wire trigger. The object's own per-frame update starts it once the object
exists.

Behavior is object-scoped. There is no behavior field on an activity itself; it is always on a
placed object inside the activity or destination. The shipped programs cover strike, raid and
public-event mechanics, abilities and status effects. They are the client half: animation, effects,
local status, conditions and local spawns. The encounter sequence is host policy.

### How a program starts

Components do not post a "run behavior" message. The engine calls a fixed method slot on the
component class. Each class has a table of 16-byte records:

```c
struct ClassMessageRecord {  /* 16 bytes */
    void    *handler;        /* +0x00 */
    uint32_t msg_id;         /* +0x08  hash; not compared on dispatch */
    uint16_t argc;           /* +0x0C */
    uint16_t flags;          /* +0x0E */
};
```

A bound method is `{class, slot index, target}`. Dispatch reads `table[slot]`. The message id is
never compared, so one table can hold the same id twice.

Two ids are known: `0x67774671` is construct and `0x3088896A` is destruct.

```c
void Object_Update(Object *o)
{
    /* bound methods set from the authored definition at construct */
    for (BoundMethod *m : o->update_methods) {
        ClassMessageRecord *r = &class_table(m->cls)[m->slot];
        r->handler(resolve(m->target));
    }
}

/* One submitter: a timeline behavior */
void TimelineBehavior_Update(Component *c)
{
    float t = now() - c->start_time;               /* stamped at construct */
    for (Threshold *th : c->def->thresholds)
        if (crossed(th, t))
            BehaviorRoot_Execute(th->root, c);
}
```

Which slot submits depends on the component subtype. Of 30 subtypes in the shipped programs, 13
submit, 16 are passive config holders, and 1 is not verified. A program on a passive subtype never
runs through that path.

A program also runs when a state variable changes. A state-variable commit runs every program row
whose value range contains the new value.

### What stops a program running

| stage | what refuses |
|---|---|
| spawn | the object was never spawned |
| construct | a component fails and the whole object is dropped |
| submit | the component subtype has no submitting slot |
| condition | the condition's input channel has no producer |
| interaction | the interaction eligibility check refuses |

### Inputs are object-local channels

A condition reads a named `float4` channel on an object, found by name hash. The packages ship the
designer's source text beside each node, for example:

```text
light_mote_value > 9
dark_mote_value + 1
```

Each identifier hashes (FNV-1, 32-bit) to the variable id the program uses.

Global gameplay switches do not feed these channels. The known server route is the
`combatant_sensor` slot's Auth body. It carries up to 16 `{channel hash, float}` rows, and the
client writes them into the actor's channels.

### Behavior node types

A program is a tree of nodes. The engine registers 27 node types.

| node | what it does |
|---|---|
| `add_hop_on` | creates one object per target from a spawn entry |
| `channel_link` | links two objects and attaches them at named nodes |
| `counter` | writes a clamped integer; runs programs whose range covers the new value |
| `defer` | runs its children with the same context |
| `exit_seat` | queues a seat-exit record on linked objects |
| `external` | runs another object's element list |
| `filter` | splits targets into pass and fail sets by its conditions |
| `global` | builds a target list from all players and/or all actors |
| `incident` | posts an incident |
| `investment_unlock_flag` | branches on an account unlock flag |
| `kill` | destroys the target |
| `navpoint` | posts a navpoint record |
| `player_custom_interaction` | submits action kind 70 per target |
| `player_custom_interaction_extended` | the same, with a candidate list |
| `redirect` | rebinds the context, then runs children |
| `relative_teleportation` | moves an object by a relative transform |
| `remove_hop_on` | attaches a pooled record; name not confirmed by its code |
| `resource` | queues a resource change |
| `search` | spatial query; feeds found objects to children |
| `select` | scores and sorts targets; top n run one branch, the rest another |
| `spawn` | spawns one object per target |
| `spawn_projectile` | spawns, aimed at a second object |
| `spawn_random` | spawns at a random, checked position |
| `storage_channel` | writes an expression result into a named channel |
| `target` | adds, removes, clears or iterates a target roster |
| `timer` | creates a keyed pooled record; name assumed |
| `town_presence` | writes one byte into a per-player structure |

Each registry row carries a flag. With the flag set, the dispatcher first drops targets whose
object slot is not allocated, caps the list at 32, and passes the result. Eight types manage their
own targets and take the raw list: `external`, `filter`, `global`, `incident`, `redirect`,
`relative_teleportation`, `search` and `select`.

```c
void BehaviorNode_Dispatch(NodeType *t, void *payload, Context *ctx)
{
    if (!t->prefilter)
        return t->invoke(payload, ctx);

    Context c = *ctx;
    c.count = 0;
    for (uint32_t id : ctx->ids)
        if (SObject_SlotAllocated(id) && c.count < 32)
            c.ids[c.count++] = id;
    t->invoke(payload, &c);
}
```

### Action kinds

`player_custom_interaction` builds an 80-byte action request with byte 0 set to 70. Byte 0 is the
action kind. The engine has 120 action kinds, 0 to 119, covering the whole player and AI action
surface. A few:

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

The names come from the console build's registry. On PC, only kind 70 is checked against the
code. Several kinds share one implementation. These action kinds are not the actor command
selectors. No mapping between the two is known.

### Object filters

The `filter` node holds a list of conditions. There are 21 condition types: 19 leaf filters and two
that nest.

| filter | filter | filter |
|---|---|---|
| `activity_flag` | `dead` | `object_label` |
| `actor` | `distance` | `object_type` |
| `airborne` | `faction` | `player` |
| `channel` | `faction_relationship` | `resource` |
| `has_parent` | `hop_on` | `same_object` |
| `damage_owner` | `line_of_sight` | `scoreboard_stat` |
| `team_side` | `composite` | `external` |

`channel` is verified from its code. The other leaf names are assumed from registration order,
with six supported by what their code does.

`composite` holds a nested list, which is how AND and OR trees nest. `external` evaluates another
object's list.

```c
struct PredicateList {
    uint8_t  mode;         /* +0x00  0 = AND, 1 = OR */
    uint8_t  pad[7];
    uint64_t count;        /* +0x08 */
    int64_t  elems_rel;    /* +0x10  self-relative, 16-byte elements */
};

bool ObjectFilter_EvaluateList(PredicateList *l, Context *ctx)
{
    if (l->count == 0)
        return true;       /* an empty list is true */
    for (uint64_t i = 0; i < l->count; i++) {
        bool r = evaluate(element(l, i), ctx);
        if (l->mode == 0 && !r) return false;
        if (l->mode == 1 &&  r) return true;
    }
    return l->mode == 0;
}
```

`channel` compares two expressions with one of six operators: equal within 0.001, not equal, `<=`,
`>=`, `<`, `>`.

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
    int32_t  unknown_b0;        /* +0xB0  purpose not verified */
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

## Open questions

- Names for the 98 command selectors.
- Most of the actor group's class-message slots; 20 of 24 are not read.
- The submitting slot of one behavior subtype whose handlers do not decompile.
- The native binding behind a spawn point and its lifetime.
- How the retail host set a guard's "neutral until attacked" state.

## Related pages

- [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/) -- slot types, Auth and
  Sense.
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/) -- where the placed
  objects live.
