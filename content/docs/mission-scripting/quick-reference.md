---
title: "Quick reference"
date: 2026-09-17
description: "The program skeleton, the calls you need most, and where every file lives."
weight: 120
---

## A whole script

```lua
local missions = require("missions")
local mission = require(missions.MY_SCENARIO)

return {
    initial_state = mission.states.STATE_X,
    on_start = function(context, state) end,
    on_load = function(context, state) end,
    on_event_region_changed = function(context, state, event) end,
    on_event_player_trigger = function(context, state, event) end,
    on_event_squad_state = function(context, state, event) end,
    on_event_timer_elapsed = function(context, state, event) end,
    on_event_effect_result = function(context, state, event) end,
}
```

Every entry is optional. See [How a script runs](/docs/mission-scripting/program-model/).

## The calls you need most

| to | call |
|---|---|
| remember a value | `context:set_variable(name, value)` / `state:variable(name)` |
| wait | `context:start_timer(name, ms)` |
| spawn enemies | `context:squad(Squad.X):place{}` |
| open a door | `context:slot(Slot.D_X):transition{transition = context.sdk.device_transitions.open}` |
| show a goal | `context:slot(Slot.M_DIRECTIVE_SENSOR_X):set_directive{directive = mission.Directive.X}` |
| play a line | `context:slot(Slot.M_DIALOG_SENSOR_X):play_dialogue_cue{cue = n}` |
| watch a trigger | `context:slot(Slot.PT_X):fire_trigger()` then `on_event_player_trigger` |
| check a clear | `context:cohort{squads = {...}}.cleared` |
| change area | `context:select_state(mission.states.STATE_X)` |
| finish | `context:complete_mission{}` |

The full list is in the [Lua API reference](/docs/mission-scripting/lua-api/). For worked examples,
see [Recipes](/docs/mission-scripting/recipes/).

## Where things are

Paths are inside your game install.

| thing | place |
|---|---|
| your scripts | `bin/x64/Sunrise/scripts/<name>/<name>.lua` |
| shared helpers | `bin/x64/Sunrise/scripts/lib/` |
| generated SDK | `bin/x64/Sunrise/sdk/lua/` |
| log | `bin/x64/Sunrise/logs/sunrise.log` |
| settings | `bin/x64/Sunrise/settings.json` |
| in-game tools | press **Insert** |
