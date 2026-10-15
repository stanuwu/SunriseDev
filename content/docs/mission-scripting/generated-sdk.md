---
title: "The generated SDK modules"
date: 2026-10-15
description: "The mission and activity modules Sunrise writes, and how their keys are made."
weight: 50
---
Sunrise reads the installed game data and writes plain Lua modules from it. Your script loads them
with `require`. They hold every identity a script needs, so a script never types a raw id.

Sunrise writes these files. Never edit them. A change is lost on the next generation.

## Where they are

```
<game>/bin/x64/Sunrise/
    scripts/                  your scripts, loaded as require("<folder>.<file>")
    sdk/
        catalog.bin           the native catalog; not Lua
        scenarios/            native world shards; not Lua
        lua/
            manifest.json     build identity and row counts
            missions.lua      name -> mission module
            activities.lua    name -> activity module
            missions/         one module per scenario
            activities/       one module per activity
            sunrise/
                activity_sdk.lua   shared enums and editor type hints
                mission_api.json   every call, field and event the runtime serves
                behaviors.lua      compiled behavior tables
```

`require` searches `sdk/lua` first, then the `sdk` and `scripts` folders of loaded mods, then
`scripts`. A script or a mod can never hide a generated module by using the same name. The mod order
is on the [Mods](/docs/sunrise/mods/) page.

## `missions.lua`

A table from a readable name to a module name.

```lua
local missions = require("missions")
local mission = require(missions.MISSION_DEADZONE)   -- "missions.mission_deadzone_80b9ad31"
```

- The key is the scenario name in upper case.
- The value ends in the scenario tag, so it changes if the data changes. Always go through this
  table. Never type the long module name.

## `activities.lua` and `activities/*.lua`

The same idea for activities.

```lua
local activities = require("activities")
local activity = require(activities.ADVENTURE_GINGER)
```

One activity module is a small table:

| field | type | meaning |
|---|---|---|
| `name` | string | internal name; your script folder is named after it |
| `display_name` | string | name shown to the player |
| `id` | string | stable id, `act/<index as 4 hex digits>/<hash as 8 hex digits>` |
| `index` | integer | activity row |
| `definition_hash` | integer | activity hash |
| `activity_root_tag` | integer | package tag of the activity root |
| `scenario_tag` | integer | scenario the activity runs |
| `matchmaking_config_tag` | integer | `0xFFFFFFFF` when absent |
| `mission` | table | the mission module, already loaded |

## A mission module

This is the module you use most. Load it once at the top of your script.

```lua
local missions = require("missions")
local mission = require(missions.MISSION_DEADZONE)
local Slot, Squad, Directive = mission.Slot, mission.Squad, mission.Directive
```

The module has three plain fields: `name` (the scenario name), `id` and `tag` (the scenario tag).
The rest are tables of two kinds. Row tables hold full records. Constant tables hold one identity
per name. You pass constants to the API.

### Row tables

| table | one row |
|---|---|
| `mission.states` | `{id, ordinal, slice_set_index, region_index, hash, value}` |
| `mission.slots` | `{id, name, index, type, component_class, sense_schema, auth_schema, unresourced, auth_type, auth_min_bits, auth_max_bits, auth_dynamic, auth_writable, auth_component_offset}` |
| `mission.squads` | `{id, slot, spawner_config, spawn_rule_config, members, anchors}` |
| `mission.scenes` | `{id, slot, config_tag, resource_tag, event_keys}` |
| `mission.tasks` | `{id, task_slot, objective_slot, objective_bit, config_tag}` |
| `mission.trigger_volumes` | a list of `{names, registry_key, slot_type, slot_index, position, minimum, maximum, shape_tag, shape_index, active}` |

Notes:

- `states`, `slots`, `squads`, `scenes` and `tasks` are keyed by the same keys as the constant
  tables: `mission.states.STATE_...`, `mission.slots.PT_...`. `trigger_volumes` is a plain list.
- `states` rows are what `initial_state` and `select_state` take. Pass the whole row.
- A squad `members` entry is `{actor_class, behavior_config, default_faction}`. All three are nil
  when the actor class is not known exactly.
- A squad `anchors` entry is `{x, y, z, point}`, the authored spawn points.
- `slot` in a squad or scene row is a catalog row number, not a slot index.
- `unresourced = true` marks a type-43 scene slot that was authored with no scene resource. The
  field is absent on every other slot.
- `event_keys` lists the event keys of the scene's authored event graph, in graph order. It is
  absent when the graph could not be read.
- `minimum` and `maximum` of a trigger volume are the corners of its box, as the package stores
  them. The in-game Triggers page shows the same numbers as "world bounds". Use them to get a rough
  idea of where a trigger is, then confirm it in game.

### Constant tables

| table | key | value | pass it to |
|---|---|---|---|
| `mission.Slot` | slot key | slot id string | `context:slot(...)` |
| `mission.Squad` | squad key | squad id string | `context:squad(...)`, `context:cohort{...}` |
| `mission.Scene` | scene key | scene id string | `context:scene(...)` |
| `mission.SceneInput` | scene key, then trigger name or `KEY_<hash>` | event key | `key =` in `send_event` |
| `mission.SceneOutput` | scene key, then trigger name or `KEY_<hash>` | event key | compare with `event.key` in `on_event_scene_output` |
| `mission.Task` | task key | task id string | reference only |
| `mission.State` | state key | the state's public value | reference only |
| `mission.Auth` | auth type, then slot key | slot id string | `context:slot(...)` |
| `mission.TaskGroup` | objective slot key, then `GROUP_<n>` | `{slot_row, group_index}` | `task_group =` |
| `mission.ActorAbility` | actor slot key, `GROUP_<hash>`, `KEY_<hash>` | `{slot_row, group_hash, request_hash}` | `ability =` |
| `mission.DialogueCue` | dialogue slot key, then `CUE_<n>` | cue number | `cue =` |
| `mission.DialogueCueVariants` | dialogue slot key, then cue number | list of line texts | search only |
| `mission.DialogueDefinition` | dialogue slot key, then cue number | dialogue hash | reference only |
| `mission.Directive` | directive key | `{id, slot_row, sensor, name_hash, element, title, description, progress, counter}`; `sensor` is the sensor's `mission.Slot` value | `directive =` |
| `mission.PerformanceState` | performance slot key, then `STATE_<hash>` | `{slot_row, name_hash, ordinal}` | `state =` in `play_performance` |
| `mission.TriggerVolume` | volume name in upper case | a row of `trigger_volumes` | reference only |
| `mission.ActorCommand` | command name | selector number | `command =` in `actor_command` |
| `mission.ActorCommandDefinition` | command name | `{selector, payload}` | reference only |
| `mission.ActorMessage` | message name | message schema row | reference only |
| `mission.Faction` | `NONE`, `REMOVED`, `HOSTILE_TO_ALL` | faction number | `value =` in `actor_command` |
| `mission.SimulationEvent` | event name | event type number | reference only |
| `mission.SimulationEventDefinition` | event name | `{event_type, primary_schema, secondary_schema}` | reference only |
| `mission.RuntimeFieldType` | codec family, then type name | type code | reference only |

A scene's event keys are the hashed names of its authored triggers. A scene waits on some of them
and reports others:

| table | holds | a script |
|---|---|---|
| `mission.SceneInput` | triggers the scene waits on and never fires itself | sends them |
| `mission.SceneOutput` | triggers the scene fires and never waits on | waits for them |

A key whose trigger name is known takes that name in upper case:
`mission.SceneInput.SC_ZAVALA.ZAVALA_START`. Any other key is `KEY_<hash>`. A scene with no inputs,
or no outputs, has no entry in that table. Triggers the scene both fires and waits on are internal
and appear in neither. The start trigger is fired by the client, so it is not an input.

```lua
local Input = mission.SceneInput
context:scene(mission.Scene.SC_ZAVALA):send_event{key = Input.SC_ZAVALA.ZAVALA_START}
```

A reported output raises `on_event_scene_output`. See
[Lua API reference](/docs/mission-scripting/lua-api/).

A `mission.Directive` entry has `progress`, the progress label text, only when one is authored. It
has `counter = true` only when the HUD shows counter values for it. Only such an entry accepts
`progress` in `set_directive`.

### How keys are made

- A key is the authored name in upper case. Each run of other characters becomes one `_`. A key
  that would start with a digit gets a leading `_`.
- A slot with no authored name is named after its slot index in hex: `SLOT_01DD`. Some take their
  auth type name in place of `SLOT`.
- A slot name used by more than one slot gets the object tag on every copy: `O_CIV_0_80B4A6CB`.
- A slot key still not unique also gets the slot index as 4 hex digits:
  `FA_ENGAGED_80BE1BA8_0011`.
- A squad and its slot share one key. `mission.Squad.SQ_X` pairs with `mission.Slot.SQ_X`.
- A scene and its slot share one key too.
- A directive key comes from its title. A directive with a progress label and no description takes
  its key from the label instead. A repeated key gets the name hash:
  `RENDEZVOUS_WITH_HAWTHORNE_1DD5B5F6`.
- A state key is its id in upper case: `STATE_<scenario>_<bubble>_<ordinal>_<entry>`.
- A repeated `mission.TriggerVolume` name gets `_1`, `_2` and so on.

Every copy of a repeated slot name gets a suffix, so a slot key never depends on row order. In the
other tables the first row keeps the plain key and later rows get the suffix. Keys are the same
each time Sunrise generates from the same install.

### Guard against a missing key

Lua returns `nil` for a key that does not exist. A `nil` in a list ends `ipairs` early, and the
mistake stays hidden. Check every key when the module loads.

```lua
local function one(value, name)
    assert(value ~= nil, "missing mission constant: " .. name)
    return value
end

local DOOR = one(mission.Slot.D_FRONT_DOOR, "front door")
```

`lib/mission_lib.lua` has this helper as `lib.one`, and `lib.list` for lists. See
[The shared script libraries](/docs/mission-scripting/libraries/).

## `sunrise/activity_sdk.lua`

Shared tables every mission module loads. Load it yourself with `require("sunrise.activity_sdk")`.

| table | meaning |
|---|---|
| `EventKind` | the event kind numbers; `event.kind` holds one |
| `SlotType` | a few named slot types: `SQUAD = 1`, `SEQUENCE = 5`, `CINEMATIC = 6`, `DEVICE = 23`, `TRIGGER = 31`, `TASK = 38`, `SCENE = 43`, `TRIGGER_VOLUME = 60` |
| `AuthType` | per auth type name: `{name, slot_type, schema, struct_bytes, min_bits, max_bits, component_offset, dynamic, writable}` |
| `CombatantLanePrimarySchema` | atom lane schema ids |
| `CombatantLaneSecondarySchema` | atom secondary lane schema ids |
| `AuthoredBehaviorFilterClass` | behavior condition class ids |
| `ObjectFilterPredicateSchema` | object filter predicate schema ids |
| `ActorSequenceCatalog` | the extracted actor sequence tables |

The file also holds `---@class` comments for the LuaLS editor plugin. They are written from the
same table the runtime reads, so a hint and the runtime cannot disagree.

| class | what it describes |
|---|---|
| `SunriseContext` | the first callback argument |
| `SunriseStateView` | the second callback argument |
| `SunriseSlotHandle`, `SunriseSquadHandle`, `SunriseSceneHandle` | the handles `context:slot`, `context:squad` and `context:scene` return |
| `Sunrise<Name>Event` | one class per event view; `SunriseEvent` holds the fields every event has |
| `SunriseProgram` | the table a mission script returns |
| `SunriseAtom` | one atom of `run_atoms` |

A slot method's hint ends with the slot type it accepts, for example `Slot type 23 (exact).`.
`SunriseSlot`, `SunriseSquad`, `SunriseScene` and `SunriseState` are the generated rows of a
mission module, not handles.

## `sunrise/mission_api.json`

A machine-readable list of the whole mission Lua API. The runtime dispatches from the same table,
so a member that is not in this file does not exist. Tools such as an editor plugin can read it.

The top level holds these keys:

| key | holds |
|---|---|
| `schema` | `sunrise-mission-lua-api-v1` |
| `value_kinds` | every word a `kind` can take |
| `receivers` | one entry per handle type |
| `members` | one entry per field or method, receiver by receiver |
| `events` | one entry per event kind, in `EventKind` order |
| `program` | the keys of the table a mission script returns |
| `enums` | the closed collections under `context.sdk` |

Lists keep the runtime's order. Keys inside an object are sorted.

### Receivers

| key | meaning |
|---|---|
| `name` | the receiver name other entries refer to, for example `slot` |
| `lua_class` | its class in `activity_sdk.lua` |
| `source` | how a script gets one |
| `complete` | false when the receiver also serves members this file does not list |
| `member_count` | how many entries of `members` belong to it |
| `entries` | the collection whose entry names it also serves, when it has one |
| `dynamic_keys` | other keys it serves, in words |

`sdk` and `activity_message` are not complete. Their row collections and live views are on
[The live SDK views](/docs/mission-scripting/live-sdk-views/).

### Members

| key | meaning |
|---|---|
| `receiver` | the receiver it belongs to |
| `name` | the key a script reads |
| `kind` | `field`, `request`, `query`, `lookup`, `update` or `maker` |
| `type` | a field's value |
| `call` | `named` (one table of arguments) or `positional` |
| `colon` | true for `handle:name(...)`, false for `handle.name(...)` |
| `arguments` | the arguments, in order |
| `returns` | the return values, in order; empty when it returns nothing |
| `refuses_unknown_keys` | true on every named call: an undeclared key is an error |
| `gate` | on a slot method, the slot it accepts |
| `effect` | the name an `effect_result` event reports for this request |
| `note` | one line of extra meaning |

A `request` queues an effect and returns a RequestKey. A `query` reads without changing anything. A
`lookup` returns a handle. An `update` changes callback state and commits with the callback. A
`maker` builds a new value.

`gate` has `slot_type` and `checks`. `checks` names what must also match the slot type:
`component_class`, `sense_schema`, `auth_schema`, `exact_join` and `dialogue_cues`. A gate with
`exact_join` is an exact check.

`play_sequence` appears twice on `slot`, once per slot type. The runtime picks the type-2 form on
an exact combatant and the type-5 form otherwise.

### Values

Arguments, field types, return values, list elements and table fields share one shape.

| key | meaning |
|---|---|
| `kind` | a word from `value_kinds` |
| `name` | the key or the parameter name; absent on a return value |
| `optional` | an argument may be left out; a field or return value may be nil |
| `ref` | what the kind refers to; see below |
| `default` | the value an omitted argument takes |
| `default_text` | the same, in words, when it is not a plain value |
| `minimum`, `maximum` | the allowed value range |
| `min_count`, `max_count` | the allowed length of a list, or of a table's array part |
| `min_length`, `max_length` | the allowed byte length of a string |
| `slot_gate` | the slot a slot handle argument must be |
| `scope` | what the value must belong to |
| `handle_accepted` | a selector also takes a handle |
| `element` | the value of each list entry, or of a table's array part |
| `fields` | the named fields of a table or a mission row |
| `note` | one line of extra meaning |

The value kinds:

| kind | a script passes or reads | `ref` |
|---|---|---|
| `boolean`, `integer`, `number`, `string` | the Lua value | `integer` may name a generated table, such as `mission.SceneInput` |
| `decimal_string` | a 64-bit value as decimal digits | |
| `name` | a timer or variable name | |
| `scalar` | a variable value: boolean, integer, finite number or short string | |
| `selector` | an id string or a row number | the generated table, such as `mission.Slot` |
| `handle` | a handle | the receiver name, such as `slot` or `request_key` |
| `enum` | an entry of a `context.sdk` collection | the collection, such as `device_channels` |
| `mission_row` | a row of a generated mission table | the table, such as `mission.Directive` |
| `list` | a dense list | |
| `table` | a table with named fields | |
| `atom` | one atom table of `run_atoms` | `atom_kinds` |
| `function` | a function | |

`scope` is one of:

| scope | the value must |
|---|---|
| `receiver` | belong to the receiver: this slot, actor, squad or scene |
| `same_registry` | share the receiver slot's registry |
| `same_object` | share the receiver slot's object and registry |
| `argument` | belong to the slot passed in another argument |

A note says when the runtime does not check a scope.

### Events

| key | meaning |
|---|---|
| `kind` | the `EventKind` number |
| `name` | the `EventKind` name, such as `SQUAD_STATE` |
| `callback` | the program key, such as `on_event_squad_state` |
| `lua_class` | its class in `activity_sdk.lua` |
| `groups` | the field groups the view serves |
| `fields` | every field and method of the view, each a member with `group` in place of `receiver` |
| `note` | one line of extra meaning, when there is one |

A field that is `optional` reads nil when the report did not carry it.

### Program and enums

`program.entries` lists `initial_state`, `on_start` and `on_load` as values. `program.refused`
lists keys the runtime refuses, such as `on_event`. `start_parameters` names the arguments of
`on_start` and `on_load`. `event_parameters` names those of an event callback.

Each entry of `enums` has `name`, `lua_class`, `entries` and `note`. An entry of `entries` has
`name` and a value. Most name the value `value`; `bounded_lanes` names it `capacity`.
`device_transitions` adds `channel` and `bounded_lanes` adds `kind`. Each `atom_kinds` entry adds
the atom's `fields`, a `note`, and `closed`, which is true when a field outside that list is
refused. `lifetime_states` has no named entries; it has `minimum`, `maximum` and `default`
instead.

## `sunrise/behaviors.lua`

Compiled behavior tables: `Program`, `Channel`, `Input`, `ChannelWrite`, `Owner`,
`ActivityBinding`, and the small enums `InputSelector`, `InputRole` and `SubmissionKind`.

- It is about 25 MB of source. A script has a 64 MiB memory limit. Do not require it from a mission
  script unless you need it.
- No mission script uses it.

## `manifest.json`

The build identity of the generated set.

| key | meaning |
|---|---|
| `sdk_build_id` | `sha256:<64 hex>`; the same value as `context.sdk_build_id` |
| `sdk_payload_sha256`, `logical_ir_sha256`, `content_key` | digests of the data the set was built from |
| `format_version` | generator format number |
| `schema` | schema name, `sunrise-activity-sdk-v11` |
| `counts` | row counts per table, useful to see how much data exists |

Sunrise checks `manifest.json` and `sunrise/mission_api.json` against the catalog. If either does
not match, it generates the set again.

## The editor setup

An editor with the Lua language server (LuaLS) can use the generated hints. Open the `scripts`
folder and add the SDK folder as a library, for example in `.luarc.json`:

```json
{
    "runtime.version": "Lua 5.4",
    "workspace.library": ["<game>/bin/x64/Sunrise/sdk/lua"]
}
```

Replace `<game>` with the full path of your game install. The mission modules are large, so the
editor may be slow to index them the first time.
