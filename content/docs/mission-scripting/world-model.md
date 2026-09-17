---
title: "The world model"
date: 2026-09-17
description: "Activity, scenario, state, region, slot, squad: the words the other pages use."
weight: 20
---
This page names the parts of a mission. Every other guide uses these words. Read it once before you
write code.

## The short version

A mission is an **activity**. The activity runs on one **scenario**. The scenario is split into
**bubbles**. Each bubble has one or more **states**. The world is full of **objects**. Each object
has **slots**. A script reads slots and sends requests to them. The client sends reports back. The
host turns reports into **events**, and your script reacts to events.

## Activity

An activity is one playable thing: a mission, a patrol zone, a social space, a raid encounter.

- It has an internal name, for example `mission_deadzone`.
- The runtime picks your script by that name. See [Your first script](/docs/mission-scripting/first-script/).
- Several activities can share one internal name. They then share one script.

## Scenario

A scenario is the authored level data behind an activity. It has a tag such as `0x80B9AD31`.

- One generated Lua module exists per scenario, for example
  `missions.mission_deadzone_80b9ad31`.
- The module lists every state, slot, squad and scene in that scenario.

## Bubble, state and region

A bubble is one loaded area of the map. The client loads one bubble at a time.

A state is one authored layout of a bubble. A bubble can have several states, for example "cutscene"
and "playable".

A **region** is the number that names one state. It is what the client reports when it moves.

```c
/* How the generator builds a region number. */
region_index = slice_set_index + state_ordinal;
```

- Bubbles often step by 8, so regions look like 0, 8, 16, 24.
- Two states of one bubble differ in the ordinal, for example 16 and 17.
- `context:select_state(state)` asks the client to load one state.
- `initial_state` in your program picks the state the player spawns into.

## Object and slot

An object is one authored thing in the world: a door, a squad spawner, a trigger, a HUD sensor.

A slot is one controllable part of an object. Scripts talk to slots, never to objects.

Each slot has:

| field | meaning |
|---|---|
| `id` | stable text id, `slot/<object tag>/<ordinal>/<slot index>/<slot type>` |
| `name` | authored name, for example `pt_mines_start` |
| `type` | what the slot is; see the table below |
| `index` | the slot's index inside its object's registry |

The slot type decides which methods work. Calling a method on the wrong type is an error.

## Slot types a script can drive

| type | what it is | common name prefix | main methods |
|---|---|---|---|
| 1 | squad spawner | `SQ_` | `assign_combat_objective` (on the slot), `place` (on the squad) |
| 2 | one combatant or actor in a squad | `SQ_<squad>_<name>` | `run_atoms`, `play_actor_path`, `play_actor_action`, `play_sequence`, `retire_actor` |
| 3 | objective | `OBJ_` | `reset_objectives`, target of `assign_combat_objective` |
| 4 | authored object (prop, pickup, chest) | `O_` | `set_object_active`, `set_interactable_object` |
| 5 | authored sequence | `SEQ_` | `play_sequence` |
| 6 | cinematic | varies | `set_cinematic_active` |
| 11 | music sensor | varies | `set_music_section` |
| 20 | damage monitor | varies | `watch_damage` |
| 23 | device (door, lift, lever, shield) | `D_` | `transition`, `set_channel`, `applied` |
| 30 | player occupancy monitor | `PM_` | `set_occupancy_condition` |
| 31 | player trigger | `PT_` | `fire_trigger`, `disarm_trigger` |
| 34 | object filter | `OF_` | `set_object_filter` |
| 35 | hard-wipe globals (darkness zone) | varies | `set_darkness_zone` |
| 38 | task sensor | varies | `advance_task` |
| 42 | performance sensor (NPC idle) | `..._IDLE` | `play_performance` |
| 43 | authored scene | `SC_` | use `context:scene(...)` |
| 47 | navigation marker | `AP_`, `LOOK_AT_` | used as `navpoint` in `set_directive` |
| 53 | dialogue sensor | `M_DIALOG_SENSOR_...` | `play_dialogue_cue` |
| 58 | actor path | varies | used as `path` in `play_actor_path` |
| 60 | trigger volume (a box in the world) | `TV_` | used as a filter or waypoint |
| 65 | Ghost link (scan) | varies | `set_ghost_link`, `ghost_link` |
| 66 | spawn rule | `SR_`, `..._SPAWNRULE` | used as `spawn_rule` in `place` |
| 68 | directive sensor (HUD objective) | `M_DIRECTIVE_SENSOR_...` | `set_directive`, `clear_directives` |
| 70 | engagement sensor | `M_ENGAGEMENT_SENSOR_...` | used as `audience` in `set_directive` |
| 71 | public event sensor | `M_PUBLIC_EVENT_SENSOR_...` | `set_public_event_state` |

The prefixes are an authoring habit, not a rule. Always check the `type` field in the generated
module. Slots with no authored name are called `SLOT_<index>_<tag>`.

## Squad

A squad is a group of enemies or NPCs that spawn together.

- A squad has members. Each member has a default count.
- A squad belongs to a type-1 slot. `mission.Squad.SQ_X` and `mission.Slot.SQ_X` name the same
  squad. You need the squad to place it and the slot to give it an objective.
- The members of a squad are type-2 slots, named after the squad, for example
  `SQ_HAWTHORNE_HAWTHORNE`.

## Scene

A scene is a small authored script that the client runs, for example two NPCs talking, or enemies
jumping down from a ledge.

- `context:scene(mission.Scene.X):activate{}` starts it.
- `stop{}` ends it and `send_event{key = n}` sends it a signal.

## Directive and dialogue

- A directive is the objective text on the HUD, with an optional map marker.
- A dialogue cue is one voice line list inside a dialogue sensor.
- The generated module lists both with their text, so you can search for a line.

## Requests, reports and events

A script never changes the world directly. It makes **requests**. The native host sends them to the
client. The client sends **reports**. The host turns reports into **events**.

```c
/* The loop every mission runs. */
while (mission_running) {
    Event event = host_wait_for_client_report();
    Requests requests = script_callback(context, state, event);   /* your Lua */
    host_send_to_client(requests);
}
```

- Every request returns a **request key**. The matching `effect_result` event carries the same key.
- The host owns revisions, counters and delivery. A script never counts them.
- A script reacts to what the client reports. It does not guess or resend on a timer.

## Attempt

An attempt is one run of the mission from a start or a checkpoint.

- `context.attempt_generation` names the current attempt.
- A checkpoint restart starts a new attempt.
- Timers are cleared when the attempt changes. Variables are kept.

## Mission state

The host stores a small amount of state for your script. It survives a script reload and a client
reconnect.

- **Variables**: named scalar values. Up to 512.
- **Timers**: named countdowns. Up to 32.
- **Phase**: one integer.

Plain Lua values, such as a local table, do not survive a reload. Keep anything that matters in
variables. See [How a script runs](/docs/mission-scripting/program-model/).
