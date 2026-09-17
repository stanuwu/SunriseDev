---
title: "The shared script libraries"
date: 2026-09-17
description: "Reference for lib.mission_lib, lib.flow, lib.campaign and lib.combat."
weight: 80
---
The `scripts/lib` folder holds plain Lua helpers that several missions share. They use only the
public API, so you can read them as worked examples. Load one with `require("lib.<name>")`.

| module | what it gives you |
|---|---|
| `lib.mission_lib` | constant guards, named variable scopes, small helpers |
| `lib.flow` | a step graph: steps that wait on facts, with checkpoints |
| `lib.campaign` | a full linear mission built from a content table, on top of `lib.flow` |
| `lib.combat` | pick the cheapest combat task group |

## `lib.mission_lib`

```lua
local lib = require("lib.mission_lib")
```

| function | what it does |
|---|---|
| `lib.one(value, name)` | returns `value`; errors with `name` when it is nil |
| `lib.list(...)` | returns the arguments as a list; errors on any nil |
| `lib.scope(context, state, tag)` | returns a scope object; see below |
| `lib.timer_name(tag, elapsed)` | returns the timer name without `tag.`, or nil when another tag owns it |
| `lib.is_slot(context, event, slot)` | true when the event names this slot |
| `lib.place_all(context, squads, mode)` | places each squad with one mode |
| `lib.activate_scenes(context, scenes)` | activates each scene |
| `lib.play_idles(context, idles)` | calls `play_performance` for each `{sensor, state}` |

### Scopes

A scope puts a prefix on every variable and timer name, so two parts of one script cannot clash.

```lua
local scope = lib.scope(context, state, "port")
scope:set_variable("seed", 42)      -- stored as "port.seed"
local seed = scope:variable("seed")
scope:start_timer("wave", 45000)    -- timer "port.wave"
scope:cancel_timer("wave")
scope:clear_variable("seed")
```

In `on_event_timer_elapsed`, map the full name back:

```lua
local name = lib.timer_name("port", event.timer_name)   -- "wave", or nil
```

## `lib.flow`

A flow is a list of steps. A step starts when the steps before it are done. It runs an action once,
then waits until its condition is true. All progress is stored in mission variables, so a flow
survives a reload.

### Build a flow

```lua
local flow = require("lib.flow")

local graph = flow.new{
    key = "intro",                         -- prefix for every stored name
    facts = {
        {id = "door_used", observe = function(context, state, event)
            return lib.is_slot(context, event, mission.Slot.O_DOOR_SWITCH)
        end},
    },
    steps = {
        {id = "arrive", await = flow.fact("door_used")},
        {id = "open", after = {"arrive"}, run = function(context, state)
            context:slot(mission.Slot.D_DOOR):transition{
                transition = context.sdk.device_transitions.open,
            }
        end},
    },
}
```

### Step fields

| field | type | meaning |
|---|---|---|
| `id` | string | unique step name |
| `after` | list of step ids | steps that must be finished first |
| `when` | condition | extra start condition; checked only before the step starts |
| `run` | `function(context, state)` | runs once, when the step starts |
| `await` | condition | the step finishes when this is true; nil means at once |
| `checkpoint` | boolean | a restart replays from here; see below |
| `reset_facts` | list of fact ids | facts to forget when this checkpoint replays; only on a checkpoint |

### Conditions

A condition is one of:

- `nil`: always true.
- `flow.fact(id)`: true once that fact was seen.
- `flow.all(a, b, ...)`: all are true.
- `flow.any(a, b, ...)`: at least one is true.
- a function `function(context, state) return <boolean> end`.

### Facts

A fact is a flag that latches. Its `observe(context, state, event)` runs for every event passed to
`handle`. Once it returns true, the fact stays true for the attempt. An event that arrived before
its step started is not lost.

### Drive a flow

```lua
return {
    on_start = function(context, state) graph:advance(context, state) end,
    on_load = function(context, state) graph:advance(context, state) end,
    on_event_player_trigger = function(context, state, event)
        graph:handle(context, state, event)
    end,
}
```

| method | what it does |
|---|---|
| `graph:advance(context, state)` | starts and finishes every step it can; returns true when all are finished |
| `graph:handle(context, state, event)` | records facts from the event, then advances |
| `graph:started(context, state, id)` | true once the step has started |
| `graph:fact(context, state, id)` | true once the fact was seen |
| `graph:finished(context, state)` | true when every step is finished |
| `graph:cancel(context, state)` | stops the flow for this attempt |

`advance` walks the steps in dependency order in one pass. A step that finishes lets the next step
start in the same pass.

### Attempts and checkpoints

The flow stores which attempt owns it. On a new attempt:

```c
if (previous_attempt_reached_a_checkpoint) {
    clear(checkpoint_step);
    clear(every_step_that_depends_on_it);
    clear(checkpoint.reset_facts);
} else {
    clear(all_steps);
    clear(all_facts);
}
```

So a checkpoint step and everything after it run again. Steps before it stay finished.

### Limits

| limit | value |
|---|---|
| facts per flow | 64 |
| steps per flow | 64 |
| entries in one `after`, `all` or `any` list | 64 |
| condition nesting depth | 16 |
| stored name length | 63 bytes, `flow.<key>.<kind>.<id>` |
| variables used | one per fact, one per step, plus 3 |

Keep `key` and ids short. Use two flows when one would pass 64 steps; `lib.campaign` does this.

## `lib.campaign`

A campaign builds a whole linear mission from one content table. The Red War drafts use it.

```lua
local campaign = require("lib.campaign")
local unit, line, move = campaign.unit, campaign.line, campaign.move

return campaign.new{
    key = "deadzone",
    directive_sensor = Slot.M_DIRECTIVE_SENSOR_80B9AF4B,
    dialogue_sensor = Slot.M_DIALOG_SENSOR_80B9AF4B,
    legs = {
        {id = "town", state = mission.states.STATE_80B9AD31_0033_0000_80B9A87B,
            arm = {Slot.PT_ELEVATOR_TOWN}},
    },
    steps = {
        {id = "town", directive = Directive.RENDEZVOUS_WITH_HAWTHORNE,
            navpoint = Slot.AP_ELEVATOR_TOWN,
            ends = {trigger = Slot.PT_ELEVATOR_TOWN}},
    },
    encounters = {
        {id = "devrim", squads = {unit(Squad.SQ_DEV_LUZ, Slot.SQ_DEV_LUZ)}},
    },
}
```

### Content table

| field | meaning |
|---|---|
| `key` | flow key; keep it short |
| `directive_sensor` | the type-68 slot that shows goals |
| `dialogue_sensor` | the type-53 slot for lines; needed when any step has `lines` |
| `legs` | list of `{id, state, arm}`; the first leg is where the player spawns |
| `steps` | the goals, in order |
| `encounters` | squads to place, each after a step |
| `intro` | optional list of `{state, cinematic}` cutscenes played before the first leg |
| `spawn_set` | optional spawn set hash for the arrival and every host move |
| `finish` | optional `function(context)` run before the mission completes |
| `omit` | optional list of type-4 slots to keep out of every seed |

A leg's `arm` lists the type-31 triggers to arm when the player enters that leg's region.

`campaign.new` builds `initial_state` for you. It opens on the first intro state when there is one,
otherwise on the first leg's state, and it carries `spawn_set` and the omit list. The omit list also
gets every object a step ends on with `interact`.

### Opening cutscenes

Each `intro` entry is one cutscene in its own authored state, played in list order before the first
leg:

```lua
intro = {
    {state = mission.states.STATE_CINE_A, cinematic = Slot.PF_OPENING_CINEMATIC},
},
```

What the library does:

1. `on_start` holds the player's spawn, so no body exists while the cutscene plays.
2. Entering a cutscene's region starts that cutscene.
3. When a cutscene ends, is skipped or is refused, the next one is selected. After the last one,
   the first leg's state is selected and the spawn is released.
4. A reload while a cutscene is marked playing ends it instead of replaying it.

A mission with no `intro` never holds the spawn.

### Step fields

| field | meaning |
|---|---|
| `id` | step name |
| `directive` | a `mission.Directive` entry to show when the step starts |
| `navpoint` | optional type-47 slot for the map marker |
| `waypoint` | optional type-60 volume; the marker hides inside it |
| `lines` | list of `campaign.line(cue, filter)` to play at start |
| `on_start` | optional `function(context)` |
| `ends` | how the step ends; see below |
| `barrier` | true when a later trigger must not skip this step |
| `revisit` | true when the end trigger was already crossed earlier; arms it again at start |

`ends` can hold any of:

| key | ends when |
|---|---|
| `trigger` | a trigger slot, or a list of them, reports |
| `region` | the player enters that leg (a leg id) |
| `clear` | the named encounter, or list, is cleared |
| `ghost_link` | a Ghost scan on that slot starts and then finishes |
| `interact` | the player uses that type-4 object |
| `destroyed` | every listed object reports gone |

A step with no `ends` finishes at once. Unless `barrier` is set, a step also ends when the player
reaches any later step's trigger or region.

### Encounter fields

| field | meaning |
|---|---|
| `id` | encounter name; `ends.clear` uses it |
| `after` | step id that must start first; default `"arrival"` |
| `trigger` | optional trigger that must also report; it must be armed by a leg |
| `objective` | optional type-3 objective given to every squad before placing |
| `squads` | list of `campaign.unit(squad, slot, group)` |
| `lines` | optional lines to play |
| `on_start` | optional `function(context)` |

### Helpers

| function | returns |
|---|---|
| `campaign.unit(squad, source, group)` | `{squad, source, group}`; `source` is the squad's type-1 slot |
| `campaign.line(cue, filter)` | `{cue, filter}`; `filter` is an optional type-60 volume |
| `campaign.move(context, slots, name)` | nothing; runs `transition` on each device with the named transition |

## `lib.combat`

| function | what it does |
|---|---|
| `combat.same_group(a, b)` | true when two task groups are the same |
| `combat.lowest_cost(event, groups, current)` | returns the cheapest group and `known`; keeps `current` on a tie |

Use it in `on_event_squad_state`. See "Move a squad between task groups" in [Recipes](/docs/mission-scripting/recipes/).
