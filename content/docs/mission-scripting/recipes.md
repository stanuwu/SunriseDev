---
title: "Recipes"
date: 2026-09-17
description: "Short answers to how do I spawn, open, show, play, wait and finish."
weight: 70
---
Short answers to "how do I ...". Each recipe is a working pattern. The examples assume this header:

```lua
local missions = require("missions")
local mission = require(missions.MY_SCENARIO)
local lib = require("lib.mission_lib")
local Slot, Squad, Scene, Directive = mission.Slot, mission.Squad, mission.Scene, mission.Directive
```

Replace `MY_SCENARIO` and every `Slot.X` with real keys from your mission module.

A block made only of `on_... = function ... end,` lines shows entries of the program table. Put
them inside the table your script returns. A block of plain statements runs inside a callback,
where `context`, `state` and `event` exist.

**Field note.** A tip marked *field note* comes from a comment in an existing script under
`scripts/`. It describes client behavior seen in game. It is not checked against the Sunrise
source.

## Contents

- Basics: constants, variables, timers, phases, random numbers, lists
- Where the player is: arrival, regions, states, triggers, occupancy
- Enemies: squads, counts, objectives, clears, damage
- The world: devices, objects, interactables, filters, darkness
- Presentation: goals, dialogue, music, public events, idles, scenes, cinematics
- Actors: paths, abilities, atoms, sequences, commands
- Flow: request results, step graphs, several areas, checkpoints, completion
- Players: peers and party life

---

## Basics

### Keep constants safe

A missing key is `nil` and fails quietly later. Check keys when the file loads.

```lua
local DOOR = lib.one(Slot.D_FRONT_DOOR, "front door")
local GUARDS = lib.list(Squad.SQ_GUARD_A, Squad.SQ_GUARD_B)
```

The top-level code runs on every open, so these checks cost nothing later.

### Remember something

```lua
context:set_variable("door_open", true)
if state:variable("door_open") == true then
    -- the door was opened earlier
end
context:clear_variable("door_open")
```

- Only booleans, integers, numbers and short strings can be stored.
- Store a table as several variables, or as a short string you build yourself.
- Use a prefix per feature: `"door.open"`, `"wave.count"`. `lib.scope` does this for you.

### Run something once

```lua
local function once(context, state, key)
    if state:variable(key) then return false end
    context:set_variable(key, true)
    return true
end

return {
    on_event_region_changed = function(context, state, event)
        if event.region_index == 16 and once(context, state, "intro.done") then
            -- first visit only
        end
    end,
}
```

The mark is stored, so a reload does not run the work again.

### Wait some time

```lua
on_start = function(context, state)
    context:start_timer("intro", 5000)    -- 5 seconds
end,
on_event_timer_elapsed = function(context, state, event)
    if event.timer_name == "intro" then
        -- 5 seconds have passed
    end
end,
```

### Repeat every N seconds

A timer fires once. Start it again in its own callback.

```lua
on_event_timer_elapsed = function(context, state, event)
    if event.timer_name == "wave" then
        spawn_wave(context, state)
        context:start_timer("wave", 45000)
    end
end,
```

Stop it with `context:cancel_timer("wave")`.

### Track progress with a phase

```lua
local PHASE_INTRO, PHASE_FIGHT, PHASE_DONE = 0, 1, 2

return {
    on_start = function(context, state)
        context:set_phase(PHASE_FIGHT)          -- raises phase_entered after the commit
    end,
    on_event_phase_entered = function(context, state, event)
        if event.phase == PHASE_DONE then
            -- the last stage has started
        end
    end,
}
```

`state.phase` reads the current phase. A variable works just as well. Use the phase when you like
one number that names the stage.

### Random numbers

`math.random` is removed. Keep a seed in a variable and step it.

```lua
local function next_seed(seed)
    return (seed * 6364136223846793005 + 1442695040888963407) & 0x7FFFFFFFFFFFFFFF
end

local function roll(context, state, sides)
    local seed = next_seed(state:variable("rng") or 0x2545F4914F6CDD1D)
    context:set_variable("rng", seed)
    return 1 + ((seed >> 17) % sides)
end
```

To vary the start, mix in a value from an event, such as `event.sequence` (a decimal string).
`scripts/tangled_shore/port.lua` shows a full example with a shuffle.

### Walk lists without `pairs`

```lua
local WAVES = {
    {id = "a", squads = {Squad.SQ_A1, Squad.SQ_A2}},
    {id = "b", squads = {Squad.SQ_B1}},
}
for _, wave in ipairs(WAVES) do
    for _, squad in ipairs(wave.squads) do
        -- use wave.id and squad
    end
end
```

For lookups, build a map once at the top of the file, from a list:

```lua
local WAVE_BY_ID = {}
for _, wave in ipairs(WAVES) do WAVE_BY_ID[wave.id] = wave end
```

### Compare strings without patterns

```lua
local function starts_with(text, prefix)
    return string.sub(text, 1, #prefix) == prefix
end
```

### Split a big script

The main file is limited to 128 KiB. Put helpers next to it and load them with the folder name:

```
scripts/my_mission/my_mission.lua
scripts/my_mission/content.lua        -- require("my_mission.content")
```

A helper module can take the mission module as an argument:

```lua
-- scripts/my_mission/content.lua
return function(mission)
    return {door = mission.Slot.D_FRONT_DOOR}
end
```

```lua
-- scripts/my_mission/my_mission.lua
local content = require("my_mission.content")(mission)
```

---

## Where the player is

### Choose where the player spawns

Set `initial_state` in the program. The host selects it before `on_start` runs.

```lua
return {
    initial_state = mission.states.STATE_80B48062_0002_0001_80B4805D,
    on_start = function(context, state)
        -- the player is in that state now
    end,
}
```

Give a table instead when you need more than the region:

| key | meaning |
|---|---|
| `region_index` | the state to open on; required |
| `spawn_set_hash` | the authored spawn set the arrival and every host move use |
| `omit` | type-4 slots to keep out of every seed; up to 32 |

Read the spawn set hash off the **Closest spawn** line of the Current Status overlay, standing
where the player should arrive. See [Finding things in game](/docs/mission-scripting/finding-things/).

```lua
initial_state = {
    region_index = mission.states.STATE_X.region_index,
    spawn_set_hash = 0x8029E4B4,
    omit = {Slot.O_PEDESTAL, Slot.O_PIKE_1},
},
```

Spawn an omitted object later with `set_object_active`.

### Hold the spawn for an opening cutscene

A held spawn keeps the player without a body, so nothing is placed while an opening cutscene plays.

```lua
on_start = function(context, state)
    context:hold_spawn{active = true}
    context:slot(Slot.PF_OPENING_CINEMATIC):set_cinematic_active{active = true}
end,

on_event_cinematic_terminated = function(context, state, event)
    context:slot(Slot.PF_OPENING_CINEMATIC):set_cinematic_active{active = false}
    context:hold_spawn{active = false}
end,
```

- `active` is required. There is no default.
- The hold rides the roster, so it applies on the next roster publication.
- Always release it. A hold that is never released leaves the player with no body.
- Handle `on_event_cinematic_skip_requested` the same way, or a skip leaves the hold on.

### React when the player first arrives

`client_state_changed` with `entered == true` is the host's arrival answer.

```lua
on_event_client_state_changed = function(context, state, event)
    if event.entered == true and event.held_region_index == START_REGION then
        -- the player has the start area
    end
end,
```

*Field note:* the client sends many state reports while it loads. React to `entered`, not to every
report. A pending leg report names a region the client has not loaded yet.

### React when the player enters an area

```lua
on_event_region_changed = function(context, state, event)
    if event.region_index == mission.states.STATE_CAVE.region_index then
        -- the player now holds the cave state
    end
end,
```

`region_changed` fires only when the client holds the new region. It does not fire for a pending
move.

### Know when the player can move again after spawning

```lua
on_event_client_state_changed = function(context, state, event)
    if event.teleport_state == context.sdk.client_teleport_reset then
        context:set_variable("spawned", true)
    end
end,
```

*Field note* (`raid_gluttony_0.lua`): after the spawn, a report with no region, spawn or teleport
field means the player has control.

### Move to another authored state

```lua
local key = context:select_state(mission.states.STATE_BOSS_ROOM)
context:set_variable("move_request", key.value)
```

- If the client does not hold that state's region, the host arms a teleport.
- The result arrives as an `effect_result`. `refused` or `expired` means the move did not happen.
- Select the state before you activate its objects and scenes. Scene requests wait until the new
  state is published.

With options:

```lua
context:select_state(mission.states.STATE_BOSS_ROOM, {
    Slot.O_REWARD_CHEST,            -- kept out of the seed
    retire_placed_props = true,     -- end the old state's map props before the move
})
```

### Know when the player walks into a trigger

Type-31 player triggers report only after the host arms them.

```lua
local CAVE_REGION = mission.states.STATE_CAVE.region_index

local function arm(context, id)
    context:set_variable("armed/" .. id, true)
    context:slot(id):fire_trigger()
end

return {
    on_event_region_changed = function(context, state, event)
        if event.region_index == CAVE_REGION then
            arm(context, Slot.PT_CAVE_ENTRANCE)
        end
    end,

    on_event_player_trigger = function(context, state, event)
        local slot = event.slot
        if slot == nil then return end
        if state:variable("armed/" .. slot.id) == true then
            context:clear_variable("armed/" .. slot.id)
            slot:disarm_trigger()
        end
        if lib.is_slot(context, event, Slot.PT_CAVE_ENTRANCE) then
            -- the player crossed the cave entrance
        end
    end,
}
```

- Arm a trigger when its area is loaded. Arming also registers its object on the client.
- *Field note:* once armed again, a trigger reports on every update while the player stays inside.
  Disarm it on the first report.
- *Field note:* arming a trigger again reports a player who is already inside.
- The event also names the type-60 volume: `volume_registry_key`, `volume_slot_index`.

### Count who is inside a volume

A type-30 occupancy monitor reports `trigger_entered` and `trigger_exited`.

Set the condition once, for example when the area loads:

```lua
context:slot(Slot.PM_TOWER_TOP):set_occupancy_condition{value = 1}
```

Then react to its edges:

```lua
on_event_trigger_entered = function(context, state, event)
    if lib.is_slot(context, event, Slot.PM_TOWER_TOP) then
        -- event.member_count, event.all_inside
    end
end,
```

- Without `filter`, the client measures its default player set.
- With `filter = context:slot(Slot.OF_SOMETHING)`, the client uses that filter.
- The first report of a volume is recorded silently. The event comes on the next change.

---

## Enemies

### Spawn a squad

```lua
context:squad(Squad.SQ_GUARDS):place{}
```

- The squad spawns with its authored counts and spawn rule.
- `mode` picks how the placement combines with what is there:

```lua
context:squad(Squad.SQ_GUARDS):place{mode = context.sdk.squad_modes.replace}
```

| mode | wire value | use in the existing scripts |
|---|---|---|
| `reinforce` | 0 | the default; standing squads |
| `replace` | 2 | repeated waves in `tangled_shore/port.lua` |
| `reserve` | 3 | not used by any current script |

### Spawn a different number

```lua
local squad = context:squad(Squad.SQ_GUARDS)
local counts = squad:counts()          -- starts at the authored defaults
counts:set(1, 4)                       -- member 1: four of them
squad:place{counts = counts}
```

`squad.member_count` and `squad.default_counts` show what the squad has.

### Remove a squad

*Field note* (`adventure_ginger.lua`): placing all-zero counts makes the client remove the members.

```lua
local squad = context:squad(Squad.SQ_GUARDS)
local counts = squad:counts()
for index = 1, counts.count do counts:set(index, 0) end
squad:place{counts = counts}
```

### Use another spawn rule

```lua
context:squad(Squad.SQ_GUARDS):place{
    spawn_rule = context:slot(Slot.SQ_GUARDS_SPAWNRULE),
}
```

The rule must be a type-66 slot.

### Give a squad an objective

```lua
context:slot(Slot.SQ_GUARDS):assign_combat_objective{
    objective = context:slot(Slot.OBJ_COURTYARD),
    task_group = mission.TaskGroup.OBJ_COURTYARD.GROUP_0,
}
context:squad(Squad.SQ_GUARDS):place{}
```

- Call it on the squad's type-1 **slot**, not the squad handle.
- The objective must be in the same registry as the squad, or the call errors.
- *Field note:* assign the objective **before** the placement. A squad whose body changes after its
  members exist reports alive 0 for about a second, and a cohort reads that as cleared.

### Move a squad between task groups

```lua
local combat = require("lib.combat")
local GROUPS = lib.list(
    mission.TaskGroup.OBJ_ARENA.GROUP_0,
    mission.TaskGroup.OBJ_ARENA.GROUP_1
)

return {
    on_event_squad_state = function(context, state, event)
        if not lib.is_slot(context, event, Slot.SQ_ARENA) or event.alive_count <= 0 then
            return
        end
        local objective = context:slot(Slot.OBJ_ARENA)
        local current, assigned = event:task_group{objective = objective}
        if not assigned then return end
        local best, known = combat.lowest_cost(event, GROUPS, current)
        if known and not combat.same_group(best, current) then
            event.slot:assign_combat_objective{objective = objective, task_group = best}
        end
    end,
}
```

### Wait until an encounter is cleared

```lua
local ARENA = {Squad.SQ_ARENA_A, Squad.SQ_ARENA_B}

local function arena_cleared(context)
    return context:cohort{squads = ARENA}.cleared
end
```

- `cleared` is true only after every squad was seen at full strength and is now all dead.
- A placement still in the queue makes the squad unknown, so `cleared` stays false.
- Check it in `on_event_squad_state`, or in a `lib.flow` condition.

### React to each kill

```lua
on_event_entity_died = function(context, state, event)
    if lib.is_slot(context, event, Slot.SQ_BOSS) and event.alive_count == 0 then
        -- the boss squad is dead
    end
end,
```

`squad_state` carries the same counts and also fires on the first report.

### React when a squad is first hurt

`squad_provoked` fires on the first accepted damage to a squad. It has no `slot` field. Match the
numbers:

```lua
on_event_squad_provoked = function(context, state, event)
    local guard = context:slot(Slot.SQ_GUARD)
    if event.registry_key == guard.registry_key and event.slot_index == guard.slot_index then
        -- the guards were attacked
    end
end,
```

### Read an enemy's health

Type-2 combatant damage pools and type-20 damage monitors raise `damage_state`.

```lua
on_event_damage_state = function(context, state, event)
    if lib.is_slot(context, event, Slot.SQ_BOSS_BOSS) then
        context:set_variable("boss.health", event.health)
    end
end,
```

To watch an object instead, bind a damage monitor to it:

```lua
context:slot(Slot.DAMAGE_MONITOR):watch_damage{target = context:slot(Slot.O_GENERATOR)}
```

---

## The world

### Open a door or start a lift

```lua
context:slot(Slot.D_FRONT_DOOR):transition{
    transition = context.sdk.device_transitions.open,
}
```

| transition | does |
|---|---|
| `open` / `close` | position to 1 / 0 |
| `power_on` / `power_off` | power to 1 / 0 |
| `lock` / `unlock` | lock to 1 / 0 |

- `snap = true` jumps to the end instead of moving.
- The slot must be type 23. Device names often start with `D_`.

### Set a device to an in-between value

```lua
context:slot(Slot.D_BRIDGE):set_channel{
    channel = context.sdk.device_channels.position,
    value = context.sdk.unit(0.5),
}
```

### Wait until the door has opened

```lua
local function door_open(context)
    return context:slot(Slot.D_FRONT_DOOR):applied{
        channel = context.sdk.device_channels.position,
    }
end
```

- `applied` is false while your latest request is queued.
- It turns true once the client reported a value for that latest request.
- In `on_event_device_state`, `event:applied_request{channel = c}` gives the exact request key.
- The event also has `position`, `power` and `lock`.

### Spawn or remove a placed object

```lua
context:slot(Slot.O_REWARD_CHEST):set_object_active{active = true}
```

Many at once:

```lua
context:activate_objects{
    slots = {Slot.O_PIKE_1, Slot.O_PIKE_2, Slot.O_PIKE_3},
    active = true,
}
```

- `activate_objects` groups objects that share an owner into one request each.
- `set_object_active{with = {...}}` sends up to 63 more objects with the first one.
- *Field note:* a seeded object spawns when its group registers. To spawn it later, keep it out of
  the seed with `omit`, then activate it.

### Let the player use an object

```lua
context:slot(Slot.O_PEDESTAL):set_interactable_object{used = true}
```

```lua
on_event_object_interacted = function(context, state, event)
    if lib.is_slot(context, event, Slot.O_PEDESTAL) then
        -- the player used it
    end
end,
```

- `object_interacted` fires once per object generation.
- `track_owner = true` also reports who owns the object: `owner_known`, `has_owner`, `owner_key`
  in `object_state`.
- *Field note:* without this request, the client never reports a use. A row not yet used shows a
  generic prompt, so the existing scripts send `used = true`.

### Know when an object is destroyed

```lua
on_event_object_state = function(context, state, event)
    if lib.is_slot(context, event, Slot.O_SHIELD_GENERATOR) and event.present == false then
        -- it is gone
    end
end,
```

### Run a Ghost scan

```lua
context:slot(Slot.GHOST_LINK):set_ghost_link{active = true}
```

```lua
on_event_ghost_link_state = function(context, state, event)
    if not lib.is_slot(context, event, Slot.GHOST_LINK) then return end
    if event.active and event.progress > 0 then
        context:set_variable("scan.started", true)
    elseif not event.active and state:variable("scan.started") then
        -- the scan finished
    end
end,
```

`slot:ghost_link()` reads the last reported level at any time, or nil before one exists.

### Filter which objects a sensor counts

```lua
context:slot(Slot.OF_ARENA):set_object_filter{
    players = true,
    inside = context:slot(Slot.TV_ARENA),
}
```

| key | adds |
|---|---|
| `players` | players only |
| `target` | one type-4 object |
| `inside` | objects inside a type-60 volume |
| `inside_any` | objects inside any of up to 5 volumes |

### Turn on a darkness zone

```lua
context:slot(Slot.HARD_WIPE_GLOBALS):set_darkness_zone{enabled = true}
-- later
context:slot(Slot.HARD_WIPE_GLOBALS):set_darkness_zone{enabled = false}
```

`wipe_seconds` (0 to 3) starts the wipe countdown. It needs `enabled = true`.

---

## Presentation

### Show a goal on the HUD

```lua
context:slot(Slot.M_DIRECTIVE_SENSOR_80B9AF4B):set_directive{
    directive = Directive.RENDEZVOUS_WITH_HAWTHORNE,
    navpoint = context:slot(Slot.AP_ELEVATOR_TOWN),
}
```

- The directive must belong to that sensor. Its `slot_row` names the sensor.
- `navpoint` (type 47) places the map marker.
- `waypoint` (type 60) is a volume where the marker hides.
- `audience` (type 70) is the engagement sensor for the mission banner.
- `state` is 0, 1 or 2.

*Field notes* (`lib/campaign.lua`):

- A goal with no navpoint shows its text and no marker.
- Sending the same goal again moves the marker without a popup.
- A goal sent before its marker's object is registered shows no marker. Send it again once the
  area that holds the object is loaded.

### Hide the goal

```lua
context:slot(Slot.M_DIRECTIVE_SENSOR_80B9AF4B):clear_directives()
```

### Play a voice line

```lua
local cues = mission.DialogueCue.M_DIALOG_SENSOR_80B9AF4B
context:slot(Slot.M_DIALOG_SENSOR_80B9AF4B):play_dialogue_cue{cue = cues.CUE_14}
```

With a filter volume:

```lua
context:slot(Slot.M_DIALOG_SENSOR_80B9AF4B):play_dialogue_cue{
    cue = cues.CUE_38,
    filter = context:slot(Slot.SLOT_0017_80BDA140),
}
```

- `mission.DialogueCueVariants.<sensor>[n]` holds the text of cue `n`. Search it to find a line.
- *Field note:* a filtered line waits in the client until the player enters the filter volume.
- *Field note:* a filtered line plays reliably only when the player is already inside. Send it
  when a trigger inside that volume reports.

### Change the music

```lua
context:slot(Slot.MUSIC_SENSOR):set_music_section{section = 3}
```

`section` is 0 to 127. `enabled = false` turns that section off.

### Run a public event

```lua
context:slot(Slot.M_PUBLIC_EVENT_SENSOR_80FD9392):set_public_event_state{
    area = context:slot(Slot.M_PUBLIC_EVENT_SENSOR_80FD9392),
    leave_seconds = 30.0,
}
```

- `area` is the object whose zone bounds the event.
- `leave_seconds` is how long a player may be outside before the client reports it.
- `player` defaults to this link's player.
- `tangled_shore/port.lua` runs three events with cooldown timers.

### Play NPC idle animations

```lua
context:slot(Slot.VENDOR_ZAVALA_IDLE):play_performance{
    state = mission.PerformanceState.VENDOR_ZAVALA_IDLE.STATE_08BA6CD2,
}
```

- Leave out `state` when the NPC has only one state.
- *Field note* (`lib/mission_lib.lua`): the sensor's object must be active first.

### Start an authored scene

```lua
context:scene(Scene.SC_BAR_SCENE):activate{}
```

| request | effect |
|---|---|
| `activate{}` | start the scene |
| `activate{spawn = true}` | also spawn its authored cast |
| `stop{}` | stop it |
| `send_event{key = n}` | send signal `n` to the running scene |

`on_event_scene_finished` fires when the scene reports it is done.

### Play a cinematic

```lua
context:slot(Slot.PF_CINEMATIC_BOOKEND_CINEMATIC):set_cinematic_active{active = true}
```

```lua
on_event_cinematic_terminated = function(context, state, event)
    -- the cinematic ended, or its start was refused
end,
on_event_cinematic_skip_requested = function(context, state, event)
    -- a player asked to skip
end,
```

- A skip request is its own event. Handle both callbacks if you react to the end.
- *Field note* (`raid_gluttony_0.lua`): send `active = false` before a state change, or the rebuilt
  component plays the cutscene again.

### Play an authored sequence

```lua
context:slot(Slot.SEQ_WAVE_ANNOUNCE_START):play_sequence()
```

The slot must be type 5.

### Reset or advance objectives

```lua
context:slot(Slot.OBJ_COURTYARD):reset_objectives()
context:slot(Slot.TASK_SENSOR):advance_task()
```

```lua
on_event_objective_progress = function(context, state, event)
    -- event.objective, event.task, event.task_count, event.previous_task_count
end,
```

---

## Actors

Actor requests go to a type-2 slot: one named member of a squad, such as `SQ_HAWTHORNE_HAWTHORNE`.

### Walk an authored path

```lua
context:slot(Slot.SQ_ESCORT_ESCORT):play_actor_path{
    path = context:slot(Slot.PATH_TO_GATE),
    spawn = false,
}
```

The path must be a type-58 slot of the same object, with an authored destination.

### Use an ability

```lua
local abilities = mission.ActorAbility.SQ_MINE_CAPTAIN_YARR
context:slot(Slot.SQ_MINE_CAPTAIN_YARR):play_actor_action{
    ability = abilities.GROUP_1F992208.KEY_00479128,
    target = context:slot(Slot.SOME_POINT),
}
```

### Run a small program

```lua
local kinds = context.sdk.atom_kinds
context:slot(Slot.SKIFF_ACTOR):run_atoms{spawn = true, atoms = {
    {kind = kinds.ability, ability = SKIFF_ENTER, target = context:slot(Slot.SKIFF_IN)},
    {kind = kinds.sleep, seconds = 6},
    {kind = kinds.ability, ability = SKIFF_EXIT, target = context:slot(Slot.SKIFF_OUT)},
}}
```

`adventure_ginger.lua` flies a Skiff this way. The atom kinds are in [Lua API reference](/docs/mission-scripting/lua-api/).

### Play an actor animation

```lua
local actor = context:slot(Slot.SQ_BOSS_BOSS)
local sequence = actor:sequences().BERSERK_ANIMATION
if sequence ~= nil and sequence.playable then
    actor:play_sequence{sequence = sequence}
end
```

Walk `actor:sequences()` with `count` and `at(n)` to see what an actor has.

### Remove an actor

```lua
context:slot(Slot.SQ_ESCORT_ESCORT):retire_actor()
```

### Send a command to every member of a squad

```lua
context:squad(Squad.SQ_ALLIES):actor_command{
    command = mission.ActorCommand.COMMAND_3,
    value = 0,
}
```

- `command` is a `mission.ActorCommand` value. `value` is an int32.
- The command names and what they do come from the game data. The names above are placeholders.
- `mission.Faction` holds the special faction values a set-faction command takes.
- No current script uses `actor_command`. Test it in game before you rely on it.

---

## Flow

### Act on a request's result

```lua
local function start_move(context)
    local key = context:select_state(mission.states.STATE_BOSS_ROOM)
    context:set_variable("move.request", key.value)
end

return {
    on_event_effect_result = function(context, state, event)
        if event.request_key.value ~= state:variable("move.request") then return end
        context:clear_variable("move.request")
        if event.outcome ~= "transport_staged" then
            -- refused, expired or canceled: try another way
        end
    end,
}
```

Results arrive after the whole request queue is empty.

### Build the mission as steps

Use `lib.flow`. Each step waits for facts, then runs once. See [The shared script libraries](/docs/mission-scripting/libraries/) for the full
reference. A small example:

```lua
local flow = require("lib.flow")

local graph = flow.new{key = "m", facts = {
    {id = "entered", observe = function(context, _, event)
        return lib.is_slot(context, event, Slot.PT_CAVE)
    end},
}, steps = {
    {id = "go", run = function(context)
        context:slot(Slot.PT_CAVE):fire_trigger()
    end, await = flow.fact("entered")},
    {id = "fight", after = {"go"}, run = function(context)
        context:squad(Squad.SQ_CAVE):place{}
    end, await = function(context)
        return context:cohort{squads = {Squad.SQ_CAVE}}.cleared
    end},
    {id = "done", after = {"fight"}, run = function(context)
        context:complete_mission{}
    end},
}}

return {
    on_start = function(context, state) graph:advance(context, state) end,
    on_load = function(context, state) graph:advance(context, state) end,
    on_event_player_trigger = function(c, s, e) graph:handle(c, s, e) end,
    on_event_squad_state = function(c, s, e) graph:handle(c, s, e) end,
}
```

For a linear story mission, `lib.campaign` builds all of this from a content table.

### Run several areas in one script

Give each area its own tag and keep its variables and timers under that tag.
`scripts/tangled_shore_freeroam/tangled_shore_freeroam.lua` does this:

```lua
local BUBBLES = {require("tangled_shore.port")(mission)}

return {
    on_event_region_changed = function(context, state, event)
        for _, bubble in ipairs(BUBBLES) do
            if bubble.state.region_index == event.region_index then
                bubble.enter(context, lib.scope(context, state, bubble.tag))
            end
        end
    end,
}
```

The real script also remembers which areas it has entered, so a return visit does not place
everything again.

Stop an area's timers when the player leaves it, so no request reaches an area the client does not
hold.

### Wipe and restart at a checkpoint

Only a private activity can do this. The whole party must be dead.

```lua
on_event_fireteam_state = function(context, state, event)
    local wiped = event.dead_count > 0 and event.alive_count == 0 and event.unknown_count == 0
    if not wiped or state:variable("wipe.request") ~= nil then return end
    local key = context:restart_checkpoint{region = OUTPOST_REGION, spawn_set_hash = OUTPOST_SPAWN}
    context:set_variable("wipe.request", key.value)
end,

on_event_effect_result = function(context, state, event)
    local request = state:variable("wipe.request")
    if request == nil or event.request_key.value ~= request then return end
    context:clear_variable("wipe.request")
    if event.outcome ~= "transport_staged" then return end
    -- the new attempt has started; release the client's wait
    context:restart_checkpoint{
        region = OUTPOST_REGION, spawn_set_hash = OUTPOST_SPAWN, release_request = request,
    }
    -- reset the area: despawn squads, turn off darkness, and so on
end,
```

- An accepted arm starts a new attempt. Timers are cleared. Variables stay.
- `lib.flow` checkpoints replay the steps after the checkpoint on the new attempt.
- `adventure_ginger.lua` has the full pattern, including waiting for the respawn.

### Finish the mission

```lua
context:slot(Slot.M_DIRECTIVE_SENSOR_X):clear_directives()
context:complete_mission{}
```

`complete_mission` works once per attempt. `context.mission_complete` tells you if it already ran.

To set another lifetime state:

```lua
context.lifetime:set{state = context.sdk.lifetime_states:at(4)}
```

---

## Players

### See who else is here

```lua
for index = 1, context.peers.count do
    local peer = context.peers:at(index)
    -- peer.session_id, peer.member_key, peer.join_identity
end
```

`on_event_session_joined` and `on_event_session_left` fire when the list changes.

### Know when the party is alive or dead

```lua
on_event_fireteam_state = function(context, state, event)
    -- event.alive_count, event.dead_count, event.unknown_count
end,
```

This fires only in private activities. It is sent again after a new attempt.
