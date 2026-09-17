---
title: "The generated SDK modules"
date: 2026-09-17
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
                behaviors.lua      compiled behavior tables
```

`require` searches `sdk/lua` first, then `scripts`. A script can never hide a generated module by
using the same name.

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
| `id` | string | stable id, `act/<index>/<hash>` |
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

It has two kinds of tables. Row tables hold full records. Constant tables hold one identity per
name. You pass constants to the API.

### Row tables

| table | one row |
|---|---|
| `mission.states` | `{id, ordinal, slice_set_index, region_index, hash, value}` |
| `mission.slots` | `{id, name, index, type, component_class, sense_schema, auth_schema, auth_type, auth_min_bits, auth_max_bits, auth_dynamic, auth_writable, auth_component_offset}` |
| `mission.squads` | `{id, slot, spawner_config, spawn_rule_config, members, anchors}` |
| `mission.scenes` | `{id, slot, config_tag, resource_tag}` |
| `mission.tasks` | `{id, task_slot, objective_slot, objective_bit, config_tag}` |
| `mission.trigger_volumes` | a list of `{names, registry_key, slot_type, slot_index, position, minimum, maximum, shape_tag, shape_index, active}` |

Notes:

- `states` rows are what `initial_state` and `select_state` take. Pass the whole row.
- A squad `members` entry is `{actor_class, behavior_config, default_faction}`. All three are nil
  when the actor class is not known exactly.
- A squad `anchors` entry is `{x, y, z, point}`, the authored spawn points.
- `slot` in a squad or scene row is a catalog row number, not a slot index.
- `minimum` and `maximum` of a trigger volume are the corners of its box, as the package stores
  them. The in-game Triggers page shows the same numbers as "world bounds". Use them to get a rough
  idea of where a trigger is, then confirm it in game.

### Constant tables

| table | key | value | pass it to |
|---|---|---|---|
| `mission.Slot` | slot key | slot id string | `context:slot(...)` |
| `mission.Squad` | squad key | squad id string | `context:squad(...)`, `context:cohort{...}` |
| `mission.Scene` | scene key | scene id string | `context:scene(...)` |
| `mission.Task` | task key | task id string | reference only |
| `mission.State` | state key | the state's public value | reference only |
| `mission.Auth` | auth type, then slot key | slot id string | `context:slot(...)` |
| `mission.TaskGroup` | objective slot key, then `GROUP_<n>` | `{slot_row, group_index}` | `task_group =` |
| `mission.ActorAbility` | actor slot key, `GROUP_<hash>`, `KEY_<hash>` | `{slot_row, group_hash, request_hash}` | `ability =` |
| `mission.DialogueCue` | dialogue slot key, then `CUE_<n>` | cue number | `cue =` |
| `mission.DialogueCueVariants` | dialogue slot key, then cue number | list of line texts | search only |
| `mission.DialogueDefinition` | dialogue slot key, then cue number | dialogue hash | reference only |
| `mission.Directive` | directive key | `{id, slot_row, name_hash, element, title, description}` | `directive =` |
| `mission.PerformanceState` | performance slot key, then `STATE_<hash>` | `{slot_row, name_hash, ordinal}` | `state =` in `play_performance` |
| `mission.TriggerVolume` | volume name in upper case | a row of `trigger_volumes` | reference only |
| `mission.ActorCommand` | command name | selector number | `command =` in `actor_command` |
| `mission.ActorCommandDefinition` | command name | `{selector, payload}` | reference only |
| `mission.ActorMessage` | message name | message schema row | reference only |
| `mission.Faction` | `NONE`, `REMOVED`, `HOSTILE_TO_ALL` | faction number | `value =` in `actor_command` |
| `mission.SimulationEvent` | event name | event type number | reference only |
| `mission.SimulationEventDefinition` | event name | `{event_type, primary_schema, secondary_schema}` | reference only |
| `mission.RuntimeFieldType` | codec family, then type name | type code | reference only |

### How keys are made

- A key is the authored name in upper case, with other characters folded to `_`.
- A name used by two objects gets the object tag: `O_CIV_0_80B4A6CB`.
- A name still not unique gets the slot index too: `..._0000E5DA`.
- A squad and its slot share one key. `mission.Squad.SQ_X` pairs with `mission.Slot.SQ_X`.
- A scene and its slot share one key too.
- A directive key comes from its title. Repeated titles get the name hash:
  `RENDEZVOUS_WITH_HAWTHORNE_1DD5B5F6`.
- A state key is its id in upper case: `STATE_<scenario>_<bubble>_<ordinal>_<entry>`.

A key never depends on row order, so a key you wrote stays valid when the data is regenerated from
the same install.

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

The file also holds `---@class` comments for the LuaLS editor plugin. They help with completion.
They can lag behind the runtime. When a hint and the runtime disagree, [Lua API reference](/docs/mission-scripting/lua-api/) is right.

## `sunrise/behaviors.lua`

Compiled behavior tables: `Program`, `Channel`, `Input`, `ChannelWrite`, `Owner`,
`ActivityBinding`, and the small enums `InputSelector`, `InputRole` and `SubmissionKind`.

- It is about 25 MB of source. A script has a 64 MiB memory limit. Do not require it from a mission
  script unless you need it.
- No current mission script uses it.

## `manifest.json`

The build identity of the generated set.

| key | meaning |
|---|---|
| `sdk_build_id` | `sha256:<64 hex>`; the same value as `context.sdk_build_id` |
| `format_version` | generator format number |
| `schema` | schema name |
| `counts` | row counts per table, useful to see how much data exists |

## The editor setup

An editor with the Lua language server (LuaLS) can use the generated hints. Open the `scripts`
folder and add the SDK folder as a library, for example in `.luarc.json`:

```json
{
    "runtime.version": "Lua 5.4",
    "workspace.library": ["E:/Games/Destiny2/bin/x64/Sunrise/sdk/lua"]
}
```

Use the full path of your own install. The mission modules are large, so the editor may be slow to
index them the first time.
