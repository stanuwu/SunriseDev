---
title: "Activities and destinations"
date: 2026-09-28
description: "The activity and destination tables, how the client loads a level and picks a spawn point, and how a mission is authored."
weight: 40
---
An activity is one playable thing: a mission, a patrol zone, the Tower, a raid. A destination is the
place it happens. The game describes both in package tables. It describes the level itself in a
separate scenario tag, split into bubbles.

Field and function names are descriptive, not Bungie's, unless a section says a name was shipped.

- The words activity, scenario, bubble, state, region, object and slot are defined in
  [The world model](/docs/mission-scripting/world-model/).
- Slot types and the Auth and Sense bodies: [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/).
- The tables' container, the investment root blob: [Items, characters and inventory](/docs/destiny-2/investment-data/).
- Package storage and named tags: [Packages](/docs/destiny-2/packages/).

## The catalog

Four catalogs describe what exists. Each one lives under the investment root blob. The first three
also have a display half with the strings, with the same rows in the same order.

| catalog | rows | row form |
|---|---:|---|
| activities | 1170 | 16-byte index rows to variable-length records |
| activity types | 54 | inline rows; 16 bytes in the logic half, 128 in the display half |
| destinations | 48 | inline rows of 56 bytes |
| places | 27 | inline u32 definition hashes |

A row index is the id the rest of the game uses. The objects and messages carry the index, not the
hash.

### The activity record

The logic half of an activity record holds these fields:

```c
struct ActivityRecord {                 /* variable length, at least 320 bytes */
    uint32_t definitionHash;            /* +0x000 */
    uint8_t  unmapped0[4];
    uint64_t requirementGroupCount;     /* +0x008 */
    int64_t  requirementGroups;         /* +0x010  relative; u32 group hashes */
    uint8_t  unmapped1[80];
    int64_t  internalName;              /* +0x068  relative; for example "raid_gluttony_0" */
    uint8_t  unmapped2[8];
    uint64_t flagWriteCount;            /* +0x078 */
    int64_t  flagWrites;                /* +0x080  relative; {i16 slot, u8 value} rows */
    uint8_t  unmapped3[24];
    uint8_t  releaseRows[16];           /* +0x0A0  release-band gates; reader unknown */
    int32_t  requiredLevel;             /* +0x0B0 */
    int32_t  requiredPower;             /* +0x0B4 */
    int32_t  secondTierLevel;           /* +0x0B8 */
    int32_t  secondTierPower;           /* +0x0BC */
    uint8_t  unmapped4[8];
    uint64_t onwardLinkCount;           /* +0x0C8 */
    int64_t  onwardLinks;               /* +0x0D0  relative; 32-byte rows */
    uint8_t  unmapped5[2];
    uint8_t  activityType;              /* +0x0DA  row of the activity type table */
    uint8_t  unmapped6[5];
    uint8_t  destination;               /* +0x0E0  row of the destination table */
};
```

Notes:

- The destination link is one byte at `+0x0E0`. A search for a 16-bit field misses it.
- Power follows the item power curve: `requiredPower = max(requiredLevel * 10, 750)`. It holds on all
  700 rows that set a requirement. So an activity's power compares directly with a character's.
- Type 7 is `Raid` and type 46 is `Dungeon`, read from both the activity rows and the type table.
- There is no fireteam size field. The size is a display string on the activity type row.
- Entering an activity writes unlock flags. Every value in the write list is 2, which is "true".

For example, Leviathan is activity 565, internal name `raid_gluttony_0`, type 7, destination 11.
Its variants need power 750.

### The activity type and its kind byte

The display-half type row is 128 bytes. Its signed byte at `+120` is a kind. The client maps it to
an action mode:

| kind | action mode |
|---:|---:|
| 1 | 2 |
| 3 | 1 |
| anything else | 0 |

Kind 1 covers one type, `Social`: the Tower and a few social spaces.

Only one type row has kind 0. It is the type of activity 0, orbit. The client uses that to ask "is
this an orbit activity".

### Destinations and places

```c
struct DestinationRow {                 /* 56 bytes, display half */
    uint32_t definitionHash;            /* +0x00 */
    uint32_t nameBank;                  /* +0x04  string ref: name */
    uint32_t nameHash;                  /* +0x08 */
    uint32_t subtitleBank;              /* +0x0C  string ref: subtitle */
    uint32_t subtitleHash;              /* +0x10 */
    uint8_t  unmapped[20];              /* +0x14 */
    uint64_t bubbleCount;               /* +0x28 */
    int64_t  bubbles;                   /* +0x30  relative; 24-byte elements */
};
```

In the logic half the same row has the place index at `+0x04`, a u32 into the place table. The place
table is 27 bare definition hashes. No display half is known for it.

The destination row lists bubbles, but this list is not what the world loads. The world loads the
bubbles named by the activity's scenario tag. For the Tower the two lists share only 4 of 8 hashes,
in a different order.

### The start-destination table

At sign-in the client picks where to go first from an 8-row table. Each row holds an activity index
and an optional unlock expression. The client takes the first row with no expression or a passing
one.

The last row has no expression and holds activity 0, orbit. So the pick always ends, and it ends on
orbit unless an earlier row passes. The Tower row passes when two per-character flags are both
true. A row before it passes when only the first is true, so the two flags move together.

### Gates on an activity

Several gates exist. None of them blocks a launch in this build.

| gate | where | what it does |
|---|---|---|
| onward links | activity `+0x0C8` | the launch check; all 457 shipped rows have an empty expression |
| requirement groups | 29 rows, named by hash from activity `+0x008` | pick the "why is this locked" message |
| release rows | activity `+0x0A0` | lead with a release-band flag; reader unknown |
| type strings | activity type row | display text only |

The requirement-group selector returns a message index, not a verdict. `-1` means nothing failed.
All callers are UI components.

The expression format is on [Items, characters and inventory](/docs/destiny-2/investment-data/#unlock-flags-and-the-evaluator).

## From activity to level data

### The activity root

Each activity has a root tag of class `0x80808AAE`, exactly `0x48` bytes. Two fields matter:

| field | target |
|---:|---|
| `+0x40` | the scenario tag, class `0x80809994` |
| `+0x44` | a `0x30`-byte tag, class `0x80809BA3`; meaning unknown |

The client also finds tags by name. It builds names from the activity's internal name and a fixed
suffix list, then looks the name up as a named tag.

| suffix | use |
|---|---|
| none | the activity root |
| `:scenario_client` | the scenario the client loads |
| `:scenario_fah`, `:scenario_gah`, `:globals_host`, `:globals_client` | other scenario and globals tags |
| `:spaceflight_in`, `_filler`, `_out` | travel sequences |
| `:same_dest_in`, `_filler`, `_out` | travel inside one destination |
| `:no_ship_in`, `_filler`, `_out` | travel without the ship |

For example, `city_tower_social_d2:scenario_client` is the Tower's scenario tag.

### Bubbles in the scenario

The scenario tag holds the bubble list the world uses:

```c
struct ScenarioBubbleTable {            /* inside the scenario tag */
    uint8_t  header[80];
    uint64_t bubbleCount;               /* +0x50  0 to 64 */
    int64_t  bubbles;                   /* +0x58  relative; 24-byte elements */
};

struct ScenarioBubble {                 /* 24 bytes, class 0x8080924D */
    uint32_t bubbleHash;                /* +0x00 */
    uint8_t  pad[4];
    uint64_t stateCount;                /* +0x08  0 means the bubble has no state 0 */
    int64_t  states;                    /* +0x10  relative; 76-byte records */
};

struct SliceSetState {                  /* 76 bytes, class 0x8080924F */
    uint8_t  enabled;                   /* +0x00 */
    uint8_t  pad0[3];
    uint32_t stateNameHash;             /* +0x04 */
    uint8_t  unmapped[20];
    uint32_t mapBubbleIndex;            /* +0x1C  the bubble's number on its map */
    uint8_t  flags[32];                 /* +0x20  ORed into the world object */
    uint32_t ownerBubbleHash;           /* +0x40 */
    uint32_t sliceSetTag;               /* +0x44 */
    uint8_t  pad1[3];
    uint8_t  skipFlags;                 /* +0x4B  0 applies the flag block */
};
```

A bubble's states each take one slice set. A bubble owns a run of 8 slice-set indices, so its first
state's index is `bubble * 8`. Sunrise has the same rule in
`src/middleware/content/packages/tables/region_reader.h`:

```c
constexpr uint32_t region_index(uint32_t bubbleIndex) {
    return bubbleIndex * kSliceSetIndexFactor;      /* kSliceSetIndexFactor == 8 */
}
```

When the activity starts, the server sends one state byte per bubble. Only two values are legal:

| byte | effect |
|---:|---|
| 0 | registers the bubble's first state and adds the bubble |
| -1 | skips the bubble |

State 0 is refused when the bubble has no states. So the rule per bubble is
`state = (stateCount > 0) ? 0 : -1`. That is also the client's own default. For the Tower the eight
values are `0 0 0 0 -1 -1 0 0`.

### Map bubbles and containers

A bubble also has a number on its map, separate from its ordinal in the scenario. Two activities on
one map can give the same bubble different ordinals. The slice-set state record carries the map
number at `+0x1C`.

A map root tag lists one record per bubble. Each record names a list of containers. A container
carries a 32-byte bit mask, one bit per map bubble, and a list of member tags:

```c
struct Container {                      /* header, class 0x80808A54 */
    uint64_t size;                      /* +0x00 */
    uint8_t  bubbleMask[32];            /* +0x08  one bit per map bubble index */
    uint64_t memberCount;               /* +0x28 */
    int64_t  members;                   /* +0x30  relative; bare tag handles */
};
```

The mask decides in which bubbles the container's members load. The client code that tests the mask
is unknown, so this rule is not verified in code. It comes from the data: two tag classes agree on
the numbering in every map measured.

## Spawn selection

### Spawn points and spawn sets

Player spawn points live in package tags of class `0x80809162`. The install holds 386 such tags and
8892 points.

```c
struct SpawnPoint {                     /* 48 bytes */
    float    rotation[4];               /* +0x00 */
    float    position[4];               /* +0x10 */
    uint32_t setNameHash;               /* +0x20  FNV-1 of the lowercase set name */
    uint8_t  reserved[12];              /* +0x24  zero in every point */
};
```

Points group into named spawn sets. Two names matter:

| name | hash |
|---|---|
| `default` | `0x2EA8FB98` |
| `none` | `0x2CA33BDB` |

A spawn set is wrapped by a component, and the component is a member of a container. So the
container's bubble mask decides which bubbles offer the set. When a component loads, it registers
its set with the spawn-point manager. The manager keeps a flat list. It never asks which bubble a set
belongs to: the list is whatever loaded.

A set also attaches only when the package that holds it is one the destination loads. The mask and
the package are two separate tests.

### Picking a point

The spawn filter is one hash. The server's move message and the activity start message carry it.
The client replaces an empty or `none` hash with `default`.

```c
void set_spawn_filter(SpawnPointMgr *mgr, uint32_t hash)
{
    if (hash == 0x811C9DC5 || hash == HASH_NONE)
        hash = HASH_DEFAULT;
    mgr->filter = hash;
}

const SpawnPoint *pick_spawn_point(const SpawnPointMgr *mgr)
{
    static const int categories[] = { 0, 3, 4, 5 };
    for (int c = 0; c < 4; c++) {
        for (const SpawnPoint *p = first_point(mgr, categories[c]); p; p = next_point(mgr, p)) {
            switch (categories[c]) {
            case 0: if (has_type67_reference(p)) return p; break;
            case 3: if (p->setNameHash == mgr->filter) return p; break;
            case 4: if (p->setNameHash == mgr->filter ||
                        (mgr->filter == HASH_DEFAULT && p->setNameHash == 0x811C9DC5))
                        return p;
                    break;
            case 5: return p;                   /* accepts anything */
            }
        }
    }
    return NULL;
}
```

This is why a wrong set fails silently. If no point matches, category 5 hands back the first point
that loaded, and the player lands in the wrong place. There is no error.

Maps differ in whether they declare a set named `default`:

| content | declare `default` |
|---|---|
| campaign missions | 64 of 65 |
| adventures | all |
| social spaces | all |
| raids | 1 of 11 |
| Crucible maps | 1 of 30 |

So a raid needs an explicit set. For free-roam destinations the client picks the arrival bubble and
set itself. For raids and dungeons it sends the unset hash, and the server's start message decides.

### Example: the Leviathan entrance

The Leviathan entrance uses bubble 2 and spawn set `0x8029E4B4`.

- Bubble ordinal 2 is map bubble 13.
- The activity package holds a copy of set `0x8029E4B4` whose container carries bit 13.
- The loaded slice set is 16, whose package name is `raid_gluttony_berth`.

A set that is valid package data but not bound to bubble 2 places the player elsewhere. The client
then requests the gardens slice set, not the entrance.

Sunrise applies the same two tests in
`src/state/activity/destination/activity_destination_spawn_binding.cpp`. It uses the bubble mask,
through the map-index table, to pick a bubble that offers the set (bounds checks removed here):

```c
const std::size_t mapIndex = layout.bubbleMapIndices[bubble];
return (row.bubbleMask[mapIndex / 8] >> (mapIndex % 8) & 1U) != 0;
```

It also drops a set whose package the destination does not load, and sends the unset hash instead.
A set named by an explicit override skips this package test.

## How a campaign mission is authored

A campaign mission is a chain of small objects, one per objective step. Each step object's slot table
names the directive it shows, the dialogue cue it plays, the music it selects, the volume that ends
it, and the volumes its line waits in. Reading those tables gives the step order and the
presentation.

The rule that connects one step to the next is not in the packages. The client ships every part a
mission needs, each named, and no wiring between them. The host supplies the order.

### The object and its slot table

Every scenario object is a package tag of class `0x80809462`.

```c
struct ScenarioObject {                 /* header */
    uint8_t  unmapped0[8];
    uint32_t mapNameHash;               /* +0x08  FNV-1 of the map name; 0x29930BA4 is "edz" */
    uint32_t registryKey;               /* +0x0C  the key every slot reference uses */
    uint8_t  unmapped1[16];
    uint64_t slotCount;                 /* +0x20  field width not verified */
    int64_t  slotHeader;                /* +0x28  relative, from +0x28, to a 16-byte header */
};

struct SlotRow {                        /* 8 bytes, at slotHeader + 16 */
    uint32_t slotType;
    uint32_t nameHash;
};
```

A row's position is the slot index. For an ordinary slot the name hash is FNV-1 of the slot's
development name:

```c
fnv1("_directive_trigger") == 0x2162521A;
fnv1("_nav_point")         == 0x3769A1A0;
```

So a guessed name is checked by hashing it. A name that hashes right is exact.

### Proxy slots

Three slot types have no descriptor. Their name-hash word holds a reference instead.

| type | engine name | the word holds |
|---:|---|---|
| 69 | `directive_proxy` | a directive hash in the scenario's directive table |
| 54 | `dialog_event_proxy` | a cue hash in the scenario's dialogue table |
| 12 | `music_section_proxy` | a music section hash |

No client code that reads proxy slots is known. So proxy slots are authoring data, and the host
acts on them.

### Volumes

A step object usually carries several trigger volumes (type 60). They have three roles:

- **Trigger volume.** The step's player-trigger slot (type 31) names it. It reports when the player
  enters.
- **Filter volume.** The step's dialogue line waits in it. The host sends the cue with this volume as
  its filter, and the client plays the line when the player walks in.
- **Waypoint volume.** The host sends it with the directive. The client hides the step's marker while
  the player is inside.

### The dialogue table

The dialogue slot (type 53) names a table of class `0x80808D54`.

- The cue array has rows of `{u32 cue hash, float}`. A row's position is the cue index that a
  dialogue body plays.
- Each line is a 72-byte record, in cue order:

```c
struct DialogueLine {                   /* 72 bytes, class 0x80808D23 */
    uint8_t  unmapped0[8];
    uint32_t cueHash;                   /* +0x08 */
    uint8_t  unmapped1[8];
    float    pauseBefore;               /* +0x14  not verified */
    uint8_t  unmapped2[8];
    uint32_t stringContainer;           /* +0x20  localized string container */
    uint32_t stringHash;                /* +0x24 */
    float    duration;                  /* +0x28  matches the spoken length; not verified */
    uint8_t  unmapped3[20];
    uint32_t speakerHash;               /* +0x40 */
    uint8_t  unmapped4[4];
};
```

The directive slot (type 68) names a directive table the same way. Both tables hold string
references, so the mission's text is package data.

### Walking a step chain

The start and end rules below are not verified. They are inferred from the behavior of one mission.

```c
/* Steps are read in the order of their directives' text. */
void run_step_chain(Host *host, const Step *steps, int count)
{
    for (int i = 0; i < count; i++) {
        const Step *s = &steps[i];

        /* On start: objective text, marker and waypoint, then the line in its filter volume. */
        send_directive(host, s->directive, s->navPoint, s->waypointVolume);
        if (s->hasCue)
            send_dialogue_cue(host, s->cue, s->filterVolume);
        if (s->trigger)
            arm_trigger(host, s->trigger);

        /* A step ends when its trigger fires, or when its fight is won. A fight is skippable
           unless a barrier holds the player, so a later trigger also ends it. */
        wait_until(host, trigger_fired(s->trigger) ||
                         fight_won(s) ||
                         any_later_trigger_fired(steps, i + 1, count));
    }
    clear_directives(host);             /* removes the last marker */
}
```

Two rules for the host:

- A marker needs its object registered on the client. Arming the step's trigger registers it.
- A trigger fires once. To reuse it, the host arms it again with a newer generation.

Not authored in the step objects: the order of steps that share a directive, cues no step names,
fights and spawns, and the choice between two filter volumes on one object.

### Example: A Deadly Trial

The campaign mission A Deadly Trial is scenario `0x80B2E043`, `adventure_ginger`. It has ten step
objects. Three of them:

| step | object | directive | cue | trigger |
|---|---|---|---|---|
| town | `0x80B2ECF3` | `0xEC217779` | 0 | slot 7, the town exit |
| roadblock | `0x80B2E6DB` | `0x6FB8A85A` | -- | none; ends when the Walker tank is destroyed |
| revive | `0x80B2EC6C` | `0x708B9351` | 7, 8 | none; ends on a Ghost scan |

Some cues are named by no step object. Two of them play from a device's own scene.

### Example: the Leviathan berth

The Leviathan berth, the raid's first area, shows the same pattern at a larger scale. Its bubble has
two states:

| state | hash | what it holds |
|---|---|---|
| ordinal 0 | `0xD1B16771` | the playable world |
| ordinal 1 | `0xE95965DF` | the opening cinematic; no squads, no devices |

Every observable in the berth maps to a named slot: squads, doors, levers, the directive, dialogue
and music. The order of the lever puzzle is not on the client. Only 27 slot-to-slot references exist
in all of Leviathan, and 26 of them point at a trigger volume. The extraction behind that count
models only references to trigger volumes, so it cannot show other edges. The behavior programs and
slot types also carry no mission state.

The extra cutscene state is a pattern across the install. All 90 extra state rows carry the same
marker flags, and 88 of them hold a cinematic slot. The flags' reader is unknown, so the marker's
meaning is not verified.

## The Director's activity graphs

The Director (the map screen) is built from activity graphs. The catalog holds 26 graphs.

```c
struct ActivityGraph {                  /* 152 bytes fixed, class 0x80805E79 */
    uint32_t blobLength;                /* +0x00 */
    uint8_t  pad0[4];
    uint32_t artKey;                    /* +0x08  shared by graphs of one destination */
    uint8_t  name[8];                   /* +0x0C  string ref */
    uint8_t  subtitle[8];               /* +0x14  string ref */
    uint8_t  pad1[4];
    uint8_t  displayProgressions[16];   /* +0x20 */
    uint8_t  displayObjectives[16];     /* +0x30 */
    uint8_t  linkedGraphs[16];          /* +0x40  64-byte rows: the tiles */
    uint8_t  nodes[16];                 /* +0x50  80-byte rows: activity nodes */
    uint8_t  connections[16];           /* +0x60 */
    uint8_t  artElements[16];           /* +0x70 */
    uint8_t  pad2[16];
    uint32_t floatBlock;                /* +0x90  tag of a float block */
    uint8_t  pad3[4];
};
```

The member names `display_progressions`, `display_objectives`, `linked_graphs`, `nodes`,
`connections` and `art_elements` are Bungie's. They are recovered from FNV-1 hashes.

- A `nodes` row holds the activities a destination's own map page offers.
- A `linked_graphs` row is one tile on a page. Only the top-level solar-system page has a full list,
  15 tiles.

### How a tile picks its target

A tile row holds a list of candidate targets. Each candidate names a graph or a node, and carries an
unlock expression. The tile takes the first candidate that passes.

```c
struct TileCandidate {                  /* 24 bytes */
    uint8_t  graphIndex;                /* +0x00  0xFF means no graph */
    uint8_t  pad;
    uint16_t nodeIndex;                 /* +0x02  0xFFFF means no node */
    uint8_t  pad2[4];
    uint8_t  unlockExpression[16];      /* +0x08 */
};

const TileCandidate *pick_tile_target(const EvalState *s, const TileRow *row)
{
    for (uint64_t i = 0; i < row->candidateCount; i++) {
        const TileCandidate *c = &row->candidates[i];
        if (c->graphIndex == 0xFF && c->nodeIndex == 0xFFFF)
            continue;
        if (unlock_eval(s, (const ExprRecord *)c->unlockExpression))
            return c;                   /* a graph opens a map page; a node points at one activity */
    }
    return NULL;
}
```

Most tiles have one ungated candidate: the destination's map page. Two tiles carry two:

- The Moon's first candidate points at its intro mission while a campaign flag is false. The second
  is the map page, taken once the flag is true.
- Io has the same two-candidate shape. Its first candidate points at the intro mission and passes
  only while two flags are set. With those flags false it takes the map page.

The tile row also has its own display expression, which decides whether the tile is drawn at all.
Seven patrol tiles share one account flag in that expression. The flag's name is unknown.

### A scenario's selection graph

A scenario can also group the activities it can launch into a selection graph. One example, the
Infinite Forest graph `0xE6013100`, has 11 nodes. Each node offers one or more activity hashes. The
`infinite_abyss` node offers two variants: Haunted Forest (activity 78) and Firewalled Haunted
Forest (activity 79).

- The nodes in this data have no edges. It is a grouping, not a flow.
- Each node carries a short sequence of native state values. What those values mean is unknown.

## Open questions

- the meaning of the activity root's `+0x44` tag
- the client code that tests a container's bubble mask
- what pulls in an activity package that no scenario names
- what the release rows at activity `+0x0A0` gate
- a client reader of proxy slots
- the meaning of the extra cutscene state's marker flags
- the meaning of a selection graph's native state values
