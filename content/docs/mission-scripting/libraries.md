---
title: "The shared script libraries"
date: 2026-10-15
description: "Reference for lib.mission_lib, lib.flow, lib.campaign, lib.freeroam and lib.combat."
weight: 80
---
The `scripts/lib` folder holds plain Lua helpers that several missions share. They use only the
public API, so you can read them as worked examples. Load one with `require("lib.<name>")`.

| module | what it gives you |
|---|---|
| `lib.mission_lib` | constant guards, named variable scopes, small helpers |
| `lib.flow` | a step graph: steps that wait on facts, with checkpoints |
| `lib.campaign` | a full linear mission built from a content table, on top of `lib.flow` |
| `lib.freeroam` | an open-world destination: zone population, respawns, public events, Lost Sectors |
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
local lib = require("lib.mission_lib")
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
start in the same pass. `handle` ignores an event from an older attempt.

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

A campaign builds a whole linear mission from one content table. The Red War missions use it.

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
| `legs` | list of `{id, state, arm, watch}`; the first leg is where the player spawns |
| `steps` | the goals, in order |
| `encounters` | squads to place, each after a step |
| `intro` | optional list of `{state, cinematic}` cutscenes played before the first leg |
| `outro` | optional list of `{state, cinematic}` cutscenes played after the last step |
| `spawn_set` | optional spawn set hash for the arrival and every host move |
| `finish` | optional `function(context)` run before the mission completes |
| `complete` | `false` to end without `complete_mission`; default true |
| `omit` | optional list of type-4 slots to keep out of every seed |

A leg's `arm` lists the type-31 triggers to arm when the player enters that leg's region. Its
`watch` lists the type-30 occupancy monitors to set up there. Each one reports when one player is
inside.

`campaign.new` checks the table when the script loads. These are errors:

- a step or encounter that ends on a trigger no leg arms, or on a monitor no leg watches
- an encounter whose `after` names no step
- a `health` end whose `at` is outside 0 to 1

`campaign.new` builds `initial_state` for you. It opens on the first intro state when there is one.
Otherwise it opens on the first leg's state. It carries `spawn_set` and the omit list. The omit list
also gets every object a step ends on with `interact`.

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

An `outro` works the same way after the last step, without a spawn hold. Its first state is selected
when the last step finishes. The mission completes once the last outro cutscene has ended.

### Step fields

| field | meaning |
|---|---|
| `id` | step name |
| `directive` | a `mission.Directive` entry to show when the step starts |
| `navpoint` | optional type-47 slot for the map marker |
| `waypoint` | optional type-60 volume; the marker hides inside it |
| `lines` | list of `campaign.line(cue, filter)` to play at start |
| `scene` | optional `mission.Scene` entry to activate at start |
| `scene_spawn` | true to also spawn the scene's authored cast |
| `inputs` | optional `lib.list` of `mission.SceneInput` keys sent to `scene` right after it starts |
| `on_start` | optional `function(context, state)` |
| `ends` | how the step ends; see below |
| `barrier` | true when a later trigger must not skip this step |
| `revisit` | true when the end trigger was already crossed earlier; arms it again at start |

`ends` can hold any of:

| key | ends when |
|---|---|
| `trigger` | a trigger slot, or a list of them, reports |
| `monitor` | a type-30 monitor slot, or a list of them, reports a player entering |
| `region` | the player enters that leg (a leg id) |
| `clear` | the named encounter, or list, is cleared |
| `ghost_link` | a Ghost scan on that slot starts and then finishes |
| `interact` | the player uses that type-4 object |
| `destroyed` | every listed object reports gone |
| `scene` | that scene's slot reports finished after the step started |
| `output` | `{slot, key}`: that scene reports that `mission.SceneOutput` key after the step started |
| `health` | `{slot, at}`: a `damage_state` for that slot reports health at or below `at`, 0 to 1; a report from before the step started counts |
| `await` | a `lib.flow` condition is true |

A step with no `ends` finishes at once. Unless `barrier` is set, a step also ends when the player
reaches any later step's trigger, monitor or region.

A scene that waits on an input never finishes until the input arrives. A step that ends on such a
scene needs `inputs`. The examples use
`local Input, Output = mission.SceneInput, mission.SceneOutput`:

```lua
{id = "reveal", scene = Scene.SCENE_IF_REVEAL,
    inputs = lib.list(Input.SCENE_IF_REVEAL.T_START_SCENE),
    ends = {scene = Slot.SCENE_IF_REVEAL}},
{id = "hop_on", scene = Scene.SC_ZAVALA,
    inputs = lib.list(Input.SC_ZAVALA.ZAVALA_START),
    ends = {output = {slot = Slot.SC_ZAVALA, key = Output.SC_ZAVALA.T_END_SCENE_START_HOP_ON}}},
```

`scene` in `ends`, and `slot` in `ends.output`, take the scene's `mission.Slot` key, not its
`mission.Scene` key:

```lua
{id = "minotaur", scene = Scene.SCENE_MINOTAUR, barrier = true,
    ends = {scene = Slot.SCENE_MINOTAUR}},
{id = "boss_half", barrier = true,
    ends = {health = {slot = Slot.SQ_BOSS_BOSS, at = 0.5}}},
```

### Encounter fields

| field | meaning |
|---|---|
| `id` | encounter name; `ends.clear` uses it |
| `after` | step id that must start first; default `"arrival"` |
| `trigger` | optional trigger that must also report; it must be armed by a leg |
| `monitor` | optional type-30 monitor that must also report; it must be watched by a leg |
| `when` | optional `function(context, state)`; the encounter waits until it returns true |
| `objective` | optional type-3 objective given to every squad before placing |
| `squads` | list of `campaign.unit(squad, slot, group)` |
| `lines` | optional lines to play |
| `on_start` | optional `function(context, state)` |

### Helpers

| function | returns |
|---|---|
| `campaign.unit(squad, source, group)` | `{squad, source, group}`; `source` is the squad's type-1 slot |
| `campaign.line(cue, filter)` | `{cue, filter}`; `filter` is an optional type-60 volume |
| `campaign.move(context, slots, name)` | nothing; runs `transition` on each device with the named transition |
| `campaign.run_seed(context)` | a positive integer from the attempt number; a seed for `generate_map` |

The sandbox has no random source, so `run_seed` gives a new seed on each attempt and the same seed
within one attempt.

## `lib.freeroam`

A freeroam program runs an open-world destination. Each zone is one authored state. The library
places the zone's population when the player enters it, respawns patrols, rotates public events and
runs Lost Sectors.

```lua
local freeroam = require("lib.freeroam")
local content = require("edz_freeroam.content")
local sectors = require("edz_freeroam.sectors")

return freeroam.new{zones = content(mission, freeroam),
    sectors = sectors(mission, freeroam)}
```

`freeroam.new` returns the whole program table. It sets no `initial_state`.

### Definition table

| field | meaning |
|---|---|
| `zones` | list of zones; see below |
| `sectors` | optional table from region number to Lost Sector encounter `{squads, boss, chest}` |
| `tick_ms` | service timer period; default 5000 |
| `respawn_ms` | delay before a dead patrol squad returns; default 30000 |
| `event_cooldown_ms` | delay before the next public event starts; default 120000 |

Delays are counted in service ticks, so a respawn can be up to one tick late.

### Zone fields

| field | meaning |
|---|---|
| `region` | the zone's region number; two zones may not share one |
| `state` | the `mission.states` row selected on entry |
| `patrol` | list of units placed on entry and respawned after they die |
| `ambient` | list of units placed on entry, never respawned |
| `events` | list of public event sites; see below |
| `sector` | optional Lost Sector; see below |

An event site is `{sensor, objective, squads, chest}`: the type-71 public event sensor, the
objective to reset, the units to place, and the chest objects shown when every squad is dead. One
site runs at a time. After its cooldown, the next site in the list starts.

A sector is `{squads, boss, chest, doors, blockers, crystals}`. An entry in `sectors` for the zone's
region sets its `squads`, `boss` and `chest`, and makes the zone a sector if it is not one.

| sector field | meaning |
|---|---|
| `squads` | units placed when the sector starts |
| `boss` | the boss squad's type-1 slot; its death opens the chest |
| `chest` | objects shown when the sector is cleared; without `boss`, every squad must die |
| `doors` | list of `{slot, channel, value}`; each device snaps to that value at start |
| `blockers` | objects removed at start |
| `crystals` | list of `{object, monitor, guard, boss}`; see below |

A crystal starts hidden, and its type-20 `monitor` watches it. A crystal with a `guard` squad slot
appears when that squad dies. Once every crystal without `boss` is destroyed, the `boss` crystals
appear.

### Units

`freeroam.unit(squad, slot, options)` pairs a squad with its type-1 slot. `options` may hold:

| option | meaning |
|---|---|
| `counts` | list of member counts, one per authored member |
| `objective`, `group` | a type-3 objective and task group assigned before placing |
| `member` | a type-2 slot to `bind_combatant_to_squad` after placing |
| `spawn_rule` | a type-66 slot used instead of the authored spawn rule |

Without `counts`, each member's authored count is capped at 1.

### What the library does

- A public activity runs every zone without a sector. A private activity runs only the sectors.
- A zone builds on its first entry. On a later entry, only patrol squads still waiting to respawn
  are placed.
- A sector starts as soon as the client reports its region, without selecting a state. Leaving it
  removes its squads, so the next visit starts it again.
- Every callback ignores events from an older attempt.
- One timer, `tick`, drives every delay. The library stores its own state in the variable `held`
  and under `z<region>.` names.

## `lib.combat`

| function | what it does |
|---|---|
| `combat.same_group(a, b)` | true when two task groups are the same |
| `combat.lowest_cost(event, groups, current)` | returns the cheapest group and `known`; keeps `current` on a tie |

Use it in `on_event_squad_state`. See "Move a squad between task groups" in [Recipes](/docs/mission-scripting/recipes/).
