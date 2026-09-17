---
title: "Build a mission from scratch"
date: 2026-09-17
description: "A whole mission in four beats, from survey to a finished run."
weight: 90
---
This page walks through a whole mission, from an empty folder to a finished run. It uses the tools
from [Finding things in game](/docs/mission-scripting/finding-things/) and the patterns from [Recipes](/docs/mission-scripting/recipes/).

The example mission has four beats:

1. The player lands. A goal points at a gate.
2. At the gate, enemies spawn. The goal says "clear the area".
3. When they are dead, the gate opens and a line plays.
4. Past the gate, a trigger ends the mission.

All keys below are placeholders. You will find the real ones in step 2.

## Step 1: pick the activity and plan

1. Pick an activity whose map has what you need: an area to fight in, a door, triggers.
2. Find its script path and mission module. See [Your first script](/docs/mission-scripting/first-script/), steps 3 and 4.
3. Write the beats down as a list, like the one above. Each beat is one step later.

For each beat, note:

| question | example answer |
|---|---|
| what starts it | the previous beat ended |
| what the player sees | a goal, a line, enemies |
| what ends it | a trigger, a clear, an interaction, a timer |

## Step 2: survey the map

Launch the activity and walk the route with the tools open.

1. Turn on the **Current Status** overlay. Note the region number of each area you pass.
2. On **States**, match each region to a state key.
3. For each area, open these pages with **Current state only** where it exists:

| you need | page | note down |
|---|---|---|
| the arrival state | States | the state key where the player lands |
| the goal sensor and goals | Directives | sensor key, directive keys |
| the voice lines | Dialogue | sensor key, cue numbers |
| enemies | Squads | squad keys, and their objective slots |
| doors | Devices | device keys; test with Set channel |
| triggers | Objects, Triggers | trigger keys; test with Fire trigger |
| map markers | Objects | type-47 navpoint keys |

4. Test each piece with its page button before you use it in code.

Keep the notes in a content file. That is the next step.

## Step 3: write the content file

Put every key in one place. Check each one when the file loads.

```lua
-- scripts/my_mission/content.lua
local lib = require("lib.mission_lib")

return function(mission)
    local Slot, Squad = mission.Slot, mission.Squad
    return {
        arrival = lib.one(mission.states.STATE_AAAA_0001_0000_BBBB, "arrival state"),
        gate_area = lib.one(mission.states.STATE_AAAA_0002_0000_CCCC, "gate state"),

        goals = lib.one(Slot.M_DIRECTIVE_SENSOR_DDDD, "goal sensor"),
        goal_reach = lib.one(mission.Directive.REACH_THE_GATE, "reach goal"),
        goal_clear = lib.one(mission.Directive.CLEAR_THE_AREA, "clear goal"),
        gate_marker = lib.one(Slot.AP_GATE, "gate marker"),

        voice = lib.one(Slot.M_DIALOG_SENSOR_DDDD, "dialogue sensor"),
        line_open = lib.one(mission.DialogueCue.M_DIALOG_SENSOR_DDDD.CUE_3, "gate line"),

        gate = lib.one(Slot.D_GATE, "gate device"),
        at_gate = lib.one(Slot.PT_GATE, "gate trigger"),
        at_exit = lib.one(Slot.PT_EXIT, "exit trigger"),

        objective = lib.one(Slot.OBJ_GATE_FIGHT, "fight objective"),
        squads = {
            {squad = lib.one(Squad.SQ_GATE_A, "squad a"), slot = lib.one(Slot.SQ_GATE_A, "slot a")},
            {squad = lib.one(Squad.SQ_GATE_B, "squad b"), slot = lib.one(Slot.SQ_GATE_B, "slot b")},
        },
    }
end
```

If a key is wrong, the script fails at open with a clear message, before anything reaches the
game.

## Step 4: write the program

Use `lib.flow`. Each beat becomes one or two steps.

```lua
-- scripts/my_mission/my_mission.lua
local missions = require("missions")
local mission = require(missions.MY_SCENARIO)
local lib = require("lib.mission_lib")
local flow = require("lib.flow")
local content = require("my_mission.content")(mission)

-- Show one goal, with an optional marker.
local function show(context, directive, marker)
    context:slot(content.goals):set_directive{
        directive = directive,
        navpoint = marker ~= nil and context:slot(marker) or nil,
    }
end

-- Arm a trigger and remember it, so its first report can disarm it.
local function arm(context, id)
    context:set_variable("armed/" .. id, true)
    context:slot(id):fire_trigger()
end

local function squads_of_fight()
    local list = {}
    for _, unit in ipairs(content.squads) do list[#list + 1] = unit.squad end
    return list
end
local FIGHT = squads_of_fight()

local function trigger_fact(id, slot)
    return {id = id, observe = function(context, _, event)
        return lib.is_slot(context, event, slot)
    end}
end

local graph = flow.new{
    key = "mm",
    facts = {
        {id = "arrived", observe = function(_, _, event)
            return event.entered == true
                and event.held_region_index == content.arrival.region_index
        end},
        {id = "gate_area", observe = function(_, _, event)
            return event.region_index == content.gate_area.region_index
        end},
        trigger_fact("at_gate", content.at_gate),
        trigger_fact("at_exit", content.at_exit),
    },
    steps = {
        -- Beat 1: the player lands and gets a goal.
        {id = "arrive", await = flow.fact("arrived")},
        {id = "reach", after = {"arrive"}, run = function(context)
            show(context, content.goal_reach, content.gate_marker)
        end},

        -- The gate trigger can only be armed once its area is loaded.
        {id = "gate_loaded", await = flow.fact("gate_area")},
        {id = "arm_gate", after = {"gate_loaded"}, run = function(context)
            arm(context, content.at_gate)
        end},

        -- Beat 2: at the gate, the fight starts.
        {id = "at_gate", after = {"reach", "arm_gate"}, await = flow.fact("at_gate")},
        {id = "fight", after = {"at_gate"}, run = function(context)
            show(context, content.goal_clear)
            for _, unit in ipairs(content.squads) do
                context:slot(unit.slot):assign_combat_objective{
                    objective = context:slot(content.objective),
                }
                context:squad(unit.squad):place{}
            end
        end, await = function(context)
            return context:cohort{squads = FIGHT}.cleared
        end},

        -- Beat 3: the gate opens and a line plays.
        {id = "open", after = {"fight"}, run = function(context)
            context:slot(content.gate):transition{
                transition = context.sdk.device_transitions.open,
            }
            context:slot(content.voice):play_dialogue_cue{cue = content.line_open}
            arm(context, content.at_exit)
        end, await = function(context)
            return context:slot(content.gate):applied{
                channel = context.sdk.device_channels.position,
            }
        end},

        -- Beat 4: the exit trigger ends the mission.
        {id = "exit", after = {"open"}, await = flow.fact("at_exit")},
        {id = "done", after = {"exit"}, run = function(context)
            context:slot(content.goals):clear_directives()
            context:complete_mission{}
        end},
    },
}

local function handle(context, state, event)
    graph:handle(context, state, event)
end

return {
    initial_state = content.arrival,

    on_start = function(context, state) graph:advance(context, state) end,
    on_load = function(context, state) graph:advance(context, state) end,

    on_event_client_state_changed = function(context, state, event)
        if event.entered == true then handle(context, state, event) end
    end,
    on_event_region_changed = handle,
    on_event_squad_state = handle,
    on_event_device_state = handle,

    on_event_player_trigger = function(context, state, event)
        local slot = event.slot
        if slot ~= nil and state:variable("armed/" .. slot.id) == true then
            context:clear_variable("armed/" .. slot.id)
            slot:disarm_trigger()
        end
        handle(context, state, event)
    end,
}
```

How it fits together:

- `initial_state` puts the player in the arrival state.
- `on_start` and `on_load` both call `advance`, so a reload picks up where the mission was.
- Each event goes to `graph:handle`. Facts latch, so a trigger that fired early is not lost.
- A step whose `await` is a function is checked again on every handled event. The squad and device
  events are wired in so the clear and the gate are noticed.

## Step 5: test it

1. Save both files.
2. Launch the activity from orbit.
3. Open the **Script** page. Check that the program is loaded and there is no error.
4. Open **Mission state**. Each step shows as a variable `flow.mm.step.<id>`. The value is 1 while
   a step waits and 2 when it is done. Facts show as `flow.mm.fact.<id>`.
5. Play through. Watch which step is stuck.
6. Fix, save, press **Reload script**.

When a step never finishes, the matching fact never turned true. Check:

| stuck at | check |
|---|---|
| `arrive` | the arrival state key; compare `held_region_index` with the Current Status overlay |
| `at_gate` | the trigger was armed; the trigger key is right; you walked into its volume |
| `fight` | the squads spawned; they share the objective's registry; they were seen at full strength |
| `open` | the device key is type 23; the device moved |

## Step 6: make it robust

- **Reloads.** Everything important is in variables, so a reload is safe. Do not keep request key
  handles in Lua locals. Store `key.value`.
- **Early events.** Facts latch. A trigger crossed before its step still counts.
- **Skipped fights.** A player can run past a fight. If that should end the step, use
  `flow.any(cleared, flow.fact("next_trigger"))` as the `await`.
- **Refused requests.** Add `on_event_effect_result` for requests that must work, such as a state
  change.
- **Wipes.** In a private mission, add a checkpoint step and `restart_checkpoint`. See "Wipe and
  restart at a checkpoint" in [Recipes](/docs/mission-scripting/recipes/).
- **Public activities.** `fireteam_state` and checkpoints do not work there. Check
  `context.activity_role`.
- **Seeded objects.** Objects you spawn later belong in `initial_state.omit`.

## A shortcut for story missions

A linear mission of goals, triggers and encounters fits `lib.campaign`. It builds the flows, arms
triggers per region, shows goals and plays lines from one content table. The Red War drafts under
`scripts/mission_*` use it. See [The shared script libraries](/docs/mission-scripting/libraries/).

## Checklist

1. The file is `scripts/<name>/<name>.lua` and the Script page finds it.
2. Every key goes through `lib.one` or `lib.list`.
3. `initial_state` is set.
4. `on_start` and `on_load` both advance the mission.
5. Triggers are armed after their area loads, and disarmed on their first report.
6. Objectives are assigned before squads are placed.
7. Every fact the mission needs is stored in a variable.
8. The mission ends with `clear_directives` and `complete_mission`.
9. A full run shows no error on the Script page.
