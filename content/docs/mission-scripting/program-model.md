---
title: "How a script runs"
date: 2026-09-17
description: "Callbacks, transactions, faults, limits, the sandbox and what survives a reload."
weight: 30
---
This page explains the life of a script: how it loads, when each callback runs, what a callback may
do, and what survives a reload. The rules come from `src/server/activity/mission/mission_script_vm.cpp`
and the `mission_script_runtime*.cpp` files.

## The program table

A script is one Lua chunk. It must return one table. That table is the **program**.

```lua
return {
    initial_state = mission.states.STATE_80B48062_0002_0001_80B4805D,  -- optional
    on_start = function(context, state) end,                           -- optional
    on_load = function(context, state) end,                            -- optional
    on_event_region_changed = function(context, state, event) end,     -- optional, one per kind
}
```

| entry | type | when it runs |
|---|---|---|
| `initial_state` | a `mission.states` row, or `{region_index = n, spawn_set_hash = h, omit = {...}}` | read once when the script opens |
| `on_start` | `function(context, state)` | once, the first time the mission starts |
| `on_load` | `function(context, state)` | instead of `on_start`, when a started mission is opened again |
| `on_event_<kind>` | `function(context, state, event)` | once per event of that kind |

Rules:

- Every entry is optional. A missing callback costs nothing. Its events are not even queued.
- A value that is not a function is an error at load.
- A single catch-all `on_event` is refused. Write one callback per kind.
- The return value of a callback is ignored.
- `spawn_set_hash` names the authored spawn points the client filters its spawn by. It answers the
  arrival and every later host move into a slice set of the bubble that declares the set. Without
  it the client scores every loaded point named `default` and can land anywhere on the map. The
  generated SDK carries no spawn sets, so the hash is written out.

## Event callbacks

| callback | fires when |
|---|---|
| `on_event_region_changed` | the client now stands in a new region |
| `on_event_client_state_changed` | the client sent a state report, or the host's arrival answer reached it |
| `on_event_player_trigger` | an armed type-31 trigger reported the player |
| `on_event_trigger_entered` / `on_event_trigger_exited` | a type-30 occupancy monitor changed |
| `on_event_squad_state` | a squad's alive count, slot counts, removal flag or objective costs changed |
| `on_event_entity_spawned` | a squad member count rose |
| `on_event_entity_died` | a squad alive count fell |
| `on_event_squad_provoked` | the first damage to a watched squad was accepted |
| `on_event_damage_state` | a damage monitor or a combatant damage pool changed |
| `on_event_object_state` | a type-4 object changed presence, interaction or owner |
| `on_event_object_interacted` | a player used a type-4 object; once per object generation |
| `on_event_device_state` | a device reported new values, or a device request was applied |
| `on_event_ghost_link_state` | a Ghost scan level changed |
| `on_event_actor_path_state` | an actor's program or movement level changed |
| `on_event_scene_finished` | an authored scene reported it finished |
| `on_event_objective_progress` | an objective task counter rose |
| `on_event_cinematic_started` | a cinematic started |
| `on_event_cinematic_terminated` | a cinematic ended, or its start was refused |
| `on_event_cinematic_skip_requested` | a player asked to skip a cinematic |
| `on_event_fireteam_state` | the party's alive, dead or unknown count changed; private missions only |
| `on_event_session_joined` / `on_event_session_left` | another player joined or left this activity |
| `on_event_timer_elapsed` | one of your timers ran out |
| `on_event_phase_entered` | a callback changed the phase |
| `on_event_effect_result` | one of your requests reached its final outcome |
| `on_event_entity_slots_requested` | the client asked for entity slots |
| `on_event_sensor_sense_updated` | the client sent a sensor report; low level |
| `on_event_incident_received` | the client sent an incident; low level |
| `on_event_client_message_received` | the client sent another routed message; low level |
| `on_event_scriptable_override_transport_staged` | any request body reached the network queue; low level |

The fields of each event are in [Lua API reference](/docs/mission-scripting/lua-api/).

Some kinds exist in the enum but never reach a script today: `auth_state_committed`,
`auth_state_transport_staged`, `auth_state_canceled`, `incident_queued`,
`incident_transport_staged`, `incident_canceled`, `incident_refused`,
`scriptable_override_committed`, `scriptable_override_canceled` and `operator_refused`. Do not
write callbacks for them.

### The first report

Some events skip the first report of a slot. The host only records the value, and the event comes
on the next change.

| event | on the first report |
|---|---|
| `trigger_entered`, `trigger_exited` | silent |
| `scene_finished` | silent |
| `objective_progress` | silent |
| `entity_died` | silent |
| `squad_state` | fires |
| `entity_spawned` | fires; every nonzero member count counts as a rise from zero |
| `device_state` | fires, with `first_report = true` |
| `object_state` | fires once the object's generation and state are known |
| `damage_state`, `ghost_link_state`, `actor_path_state` | fire once the level is complete |

A new attempt clears these records, so the first report after a restart follows the same rules.

## Loading

```c
/* What happens when an activity attaches. */
source = read_file("scripts/<stem>/<stem>.lua");
if (!source) source = read_file("scripts/activities/a_<index>_<hash>.lua");
if (!source) { log("open no_script"); return; }

compile(source);                      /* text only; max 128 KiB */
program = run_chunk();                /* your top-level code runs here */
capture(program);                     /* reads initial_state and the callbacks */
restore_mission_state();              /* variables, timers, phase, pending requests */

if (mission_already_started) {
    call(program.on_load);
} else {
    if (program.initial_state) {
        select_state(program.initial_state);
        wait_until_published();       /* inputs and timers wait too */
    }
    call(program.on_start);
}
```

- The top-level code runs once per open. `require` calls happen here.
- The top-level code has a budget of 100 million instructions, so large generated modules load.
- Client reports that arrive before the start are kept and delivered after `on_start`.

## The script file name

The runtime builds a file stem from the activity's internal name:

```c
/* Folding "Mission Deadzone-2" gives "mission_deadzone_2". */
stem = lowercase(name);
stem = replace_runs_of_non_alphanumeric(stem, "_");
if (stem is empty) stem = "unnamed";
if (stem starts with a digit) stem = "_" + stem;
path = "scripts/" + stem + "/" + stem + ".lua";
```

If that file does not exist, the runtime tries `scripts/activities/a_<index>_<hash>.lua`, with the
activity index as four decimal digits and the definition hash as eight hex digits.

The in-game "Script" page shows the exact path it looks for. See [Finding things in game](/docs/mission-scripting/finding-things/).

## A callback is a transaction

Each callback runs against a private copy of your state. Nothing it does is visible outside until
it returns.

```c
Candidate copy = committed_state;         /* variables, timers, phase */
ok = run_callback(&copy);                 /* every variable, timer and request lands here */
if (ok) {
    committed_state = copy;
    outbox_append(copy.requests);         /* requests go out in the order you made them */
} else {
    discard(copy);                        /* nothing happened */
    fault_program();                      /* see below */
}
```

So:

- Inside one callback, `state:variable(k)` returns what you set earlier in the same callback.
- Requests leave only after the callback returns.
- A request made in a callback cannot have a result yet in the same callback.

## Errors fault the program

Any Lua error in a callback stops the whole program. This includes `error`, a failed `assert`, a
wrong argument to an API call, running out of instructions, and running out of memory.

After a fault:

- The callback's changes are thrown away.
- No more callbacks run for this mission.
- The log gets a warning with the Lua error text.
- The "Script" page and the Mission Script HUD overlay show the error.
- Reopening the same state faults again. Only the "Reload script" button clears the fault.

`pcall` works as usual for your own errors, but an instruction or memory overrun cannot be caught.

Refused requests are not faults. They come back as an `effect_result` with outcome `refused`.

## Limits

| limit | value |
|---|---|
| main script size | 128 KiB; split larger code into modules |
| instructions per callback | 5,000,000 |
| instructions while opening | 100,000,000 |
| Lua memory per mission | 64 MiB |
| mission variables | 512 |
| mission timers | 32 |
| variable or timer name | 1 to 63 bytes of `A-Z a-z 0-9 _ - . /` |
| string variable value | up to 127 bytes |
| timer delay | 0 to 4294967295 ms |

## The sandbox

The script runs in Lua 5.4 with a reduced standard library.

| available | removed |
|---|---|
| `assert`, `error`, `ipairs`, `select`, `type`, `tostring`, `tonumber`, `rawget`, `rawset`, `setmetatable`, `pcall`, `require` | `pairs`, `next`, `print`, `warn`, `load`, `loadfile`, `dofile`, `collectgarbage`, `getmetatable`, `rawequal`, `rawlen`, `xpcall` |
| `string` library | `string.find`, `string.match`, `string.gmatch`, `string.gsub`, `string.dump` |
| `table` library | nothing |
| `math` library | `math.random`, `math.randomseed` |
| | `io`, `os`, `debug`, `coroutine`, `utf8`, `package` |

What this means in practice:

- **No `pairs`.** You cannot walk a table with string keys. Keep lists as arrays and walk them with
  `ipairs` or a number loop. Use string-keyed tables only for lookups.
- **No `print`.** Store values in mission variables and read them in game. See
  [Debugging a script](/docs/mission-scripting/debugging/).
- **No pattern matching.** Use `string.sub`, `string.byte` and `==`.
- **No random numbers.** Keep your own generator in a variable. See "Random numbers" in
  [Recipes](/docs/mission-scripting/recipes/).
- `setmetatable` works, but a metatable with `__gc`, `__mode` or `__close` is refused.
- `require` takes names made of letters, digits, `_` and single dots only.

## What survives a reload

A reload, a reconnect or a data change can close the Lua state and open it again. Then `on_load`
runs.

| survives | lost |
|---|---|
| mission variables | every Lua local and upvalue |
| mission timers (unless the attempt changed) | module-level tables you filled at run time |
| the phase | request key handles you kept in Lua |
| requests not yet delivered | |

Rules that follow:

- Keep every fact that matters in a variable.
- To match an `effect_result` after a reload, store `key.value` in a variable. Compare it with
  `event.request_key.value`.
- `on_load` must not replay work that is already done. Check your variables first.
- Constant tables built at the top of the file are fine. The top-level code runs again on every
  open.

## Order of events

- Client reports are delivered in the order the client sent them.
- One client packet can raise several events. The report callback runs first, then the events
  derived from it, in this order: trigger, Ghost link, object, damage monitor, actor path, squad,
  combatant damage, device, scene, objective.
- An incident raises `player_trigger`, then the cinematic events.
- A state report raises `region_changed` after the report itself.

## Requests are delivered one at a time

Your requests form a queue. The host works on the first one until it reaches an outcome.

```c
/* Delivery of one request. */
reserve_host_revision();              /* most requests use exactly one */
wait_host_commit(2 s);                /* else: refused */
wait_network_queue(15 s);             /* else: cancel is requested */
/* 60 s after the first try at most, else: expired */
report(effect_result);
```

- While a request is being delivered, no other event, input or timer runs for this mission.
- Effect results are delivered after the whole queue is empty.
- `select_state`, `restart_checkpoint`, `hold_spawn` and `actor_command` finish locally, with no
  host revision.

### Outcomes

| outcome | meaning |
|---|---|
| `transport_staged` | the request body reached the network queue; for a local request, it succeeded |
| `refused` | nothing was sent; the preconditions did not hold |
| `expired` | 60 seconds passed before it was sent |
| `canceled` | the host dropped it before sending, for example after the client reloaded |

`transport_staged` does not prove the client applied it. For devices, wait for
`slot:applied{channel}` or `event:applied_request{channel}` instead.

## Timers

- `context:start_timer(name, ms)` sets a deadline. Starting the same name again replaces it.
- The clock is the server tick. A timer fires at most once per tick per mission, and can fire late.
- A timer does not fire while a request is being delivered or while client reports are waiting.
- The timer is removed before its callback runs.
- Timers survive a reload. A timer that ran out during the reload fires soon after `on_load`.
- A new attempt clears all timers.

## Attempts

An attempt starts at 1. Only one thing starts a new attempt: an accepted
`context:restart_checkpoint{region, spawn_set_hash}`.

When a new attempt starts:

- all timers are cleared
- device request records and squad population records are cleared
- the first report of each world value is recorded silently again
- events and requests from the old attempt are dropped
- `fireteam_state` is sent again

Variables and the phase are kept. `lib.flow` uses `context.attempt_generation` to reset its own
progress. See [The shared script libraries](/docs/mission-scripting/libraries/).

## Public and private activities

`context.activity_role` is `"public"` or `"private"`.

- `fireteam_state` fires only in private activities.
- `restart_checkpoint` works only in private activities.
