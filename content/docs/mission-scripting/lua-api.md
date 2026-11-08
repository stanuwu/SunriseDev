---
title: "Lua API reference"
date: 2026-11-08
description: "Every call a mission script can make, and every field an event carries."
weight: 40
---
This is the full list of what a mission script can call and read. One table in the Sunrise source,
`server/activity/mission/mission_api.h`, declares every member, argument and event field. The
runtime dispatches from that table, and the generator writes it out as `sunrise/mission_api.json`;
see [The generated SDK modules](/docs/mission-scripting/generated-sdk/).

The live SDK views (`context.sdk.catalog`, `world`, `manifest`, the row collections and the bounded
lanes) have their own page, [The live SDK views](/docs/mission-scripting/live-sdk-views/).

## How to read this page

- `context:name(...)` is a method. Call it with a colon.
- `context.name` is a field. Read it with a dot.
- Most requests take **one table of named arguments**: `slot:transition{transition = t}`.
- An unknown key in that table is an error. A misspelled key never passes silently.
- A request returns a **RequestKey**. See "Request keys".
- A 64-bit number is always a decimal **string**, because a Lua integer cannot hold every value.
- "slot of type N" means the method errors on any other slot type.

## Handles

Every object the API gives you is a locked handle. You cannot add fields to it, read its
metatable, or build one yourself. A handle re-checks its row on every read. If the data changed
under it, the read errors with "stale".

| handle | how you get it |
|---|---|
| context | first callback argument |
| state | second callback argument |
| event | third callback argument |
| slot | `context:slot(...)`, `event.slot`, `context.sdk.slots:at(n)` |
| squad | `context:squad(...)`, `context.sdk.squads:at(n)` |
| scene | `context:scene(...)`, `context.sdk.authored_scenes:at(n)` |
| request key | returned by every request |
| cohort | `context:cohort{...}` |
| lifetime | `context.lifetime` |

## Context

The first argument of every callback.

### Fields

| field | type | meaning |
|---|---|---|
| `sdk` | activity view | the live SDK; see [The live SDK views](/docs/mission-scripting/live-sdk-views/) |
| `sdk_build_id` | string | `sha256:<64 hex>` |
| `activity_id` | string | activity id |
| `activity_row` | integer | activity row |
| `definition_hash` | integer | activity hash |
| `activity_role` | string | `"public"` or `"private"` |
| `player_key` | string | the linked player's key, decimal |
| `attempt_generation` | string | current attempt, decimal |
| `mission_complete` | boolean | true after `complete_mission` was accepted in this attempt |
| `lifetime` | lifetime handle | see "Lifetime" |
| `mod_config` | mod config handle | see "Mod config" |
| `peers` | peer collection | see "Peers" |
| `timers` | timer name collection | see "Name references" |
| `variables` | variable name collection | see "Name references" |

### Mod config

`context.mod_config` holds the config of the mod that supplied the script.

`context.mod_config.<key>` returns the current value of one entry the mod declares in its
`mod.json`. An `int` entry reads as an integer, a `float` entry as a number and a `bool` entry as a
boolean. An undeclared key reads as nil, and so does every key in a base or generated script. The
value is read at each access, so a change on the Mods page applies at once. The handle is
read-only.

```lua
local respawn = context.mod_config.respawn_ms or 5000
```

### Lookups

| method | returns | notes |
|---|---|---|
| `context:slot(selector)` | slot handle | selector is a `mission.Slot` id string or a slot row number |
| `context:squad(selector)` | squad handle | selector is a `mission.Squad` id string or a squad row number |
| `context:scene(selector)` | scene handle | selector is a `mission.Scene` id string or a scene row number |
| `context:cohort{squads = list}` | cohort handle | see "Cohort" |

Row numbers start at 1. Pass the id string or the row number, not a handle. An unknown selector is
an error, for example "unknown or ambiguous activity slot".

### Mission state

| method | returns | notes |
|---|---|---|
| `context:set_variable(name, value)` | nothing | value is a boolean, integer, finite number or string up to 127 bytes |
| `context:clear_variable(name)` | boolean | true when the variable existed |
| `context:start_timer(name, ms)` | string | the timer sequence; ms is 0 to 4294967295; replaces a timer with the same name |
| `context:cancel_timer(name)` | boolean | true when the timer existed |
| `context:set_phase(n)` | nothing | n is 0 to 4294967295; a change raises `phase_entered` |

A name is 1 to 63 bytes of letters, digits, `_`, `-`, `.` and `/`. `nil` is not a value; use
`clear_variable`.

### World requests

| method | arguments | notes |
|---|---|---|
| `context:select_state(state, options)` | `state`: a `mission.states` row; `options`: see below | load another authored state; moves the player when needed |
| `context:activate_objects{slots, active}` | `slots`: list of type-4 slot ids or handles, each once; `active`: default true | returns a **list** of request keys, one per object group |
| `context:complete_mission{}` | none | completes this attempt; errors when already complete |
| `context:hold_spawn{active}` | `active`: required boolean | hold the player's spawn, or release it |
| `context:restart_checkpoint{region, spawn_set_hash, release_request}` | see below | wipe and restart the party |

A held spawn keeps the roster's spawn gate closed, so the player has no body yet. Use it when the
mission opens on a cutscene. Release it with `active = false` when the player should arrive.

`select_state` options is either a plain list of slots whose objects stay out of the seed, or a
table with:

| key | type | meaning |
|---|---|---|
| `[1]`, `[2]`, ... | slot ids | each slot's object stays out of the new state's seed; up to 32 |
| `retire_placed_props` | boolean | end the map props captured from the old state before the move |

Any other named key is an error.

`restart_checkpoint` arguments:

| key | type | meaning |
|---|---|---|
| `region` | integer 0 to 1022 | the region the party is in |
| `spawn_set_hash` | integer 1 to 4294967294 | the authored spawn set to restart at |
| `release_request` | decimal string, optional | the `value` of the arming request; releases the wipe |

`region` and `spawn_set_hash` are required, also on a release.

Arming is refused unless the activity is private, the whole party is dead, the party is in
`region`, and the spawn set exists. An accepted arm starts a new attempt. See "Wipe and restart at
a checkpoint" in [Recipes](/docs/mission-scripting/recipes/).

## State

The second argument of every callback. Read-only.

| member | returns | notes |
|---|---|---|
| `state.phase` | integer | includes a `set_phase` made earlier in this callback |
| `state.revision` | string | the committed state revision |
| `state:variable(name)` | value or nil | sees changes made earlier in this callback |
| `state:has_variable(name)` | boolean | |
| `state:timer(name)` | string or nil | the timer's deadline tick |

## Request keys

Every request returns a RequestKey.

| member | meaning |
|---|---|
| `key.value` | the key as a decimal string |
| `key:matches(other)` | true when two keys are the same request |

A key handle is lost on reload. Store `key.value` in a variable when you need to match the result
later.

```lua
local key = context:select_state(mission.states.STATE_X)
context:set_variable("state_request", key.value)
```

## Slot

### Fields

| field | type | meaning |
|---|---|---|
| `row` | integer | slot row in this activity |
| `id` | string | same as the `mission.Slot` value |
| `name` | string | authored name |
| `object_id` | string | owning object id |
| `object_tag` | integer | owning object tag |
| `registry_key` | integer | registry key the client uses |
| `slot_index` | integer | index in the registry |
| `slot_type` | integer | the slot type |
| `component_class` | integer | component class id |
| `sense_schema`, `auth_schema` | integer | report and request schema ids |
| `sense_schema_id`, `auth_schema_id` | string | the same as text |
| `auth_type` | string or nil | request type name, for example `device_sensor` |
| `auth_min_bits`, `auth_max_bits` | integer or nil | request body size |
| `auth_component_offset` | integer or nil | |
| `auth_dynamic`, `auth_writable` | boolean or nil | |
| `flags` | integer | catalog flags |

### Methods by slot type

Every method below returns a RequestKey unless the table says otherwise.

| method | slot type | arguments |
|---|---|---|
| `set_object_active{active, with}` | 4 | `active` default true; `with`: up to 63 more type-4 slot ids, not handles, sent together |
| `set_interactable_object{active, used, track_owner}` | 4 | `active` default true; `used` default false; `track_owner` default false |
| `watch_damage{target}` | 20 | `target`: a type-4 slot handle |
| `set_object_filter{players, target, inside, inside_any}` | 34 | see below |
| `set_occupancy_condition{value, filter}` | 30 | `value`: int32; `filter`: optional slot handle; without it the client measures its default player set |
| `set_darkness_zone{enabled, wipe_seconds}` | 35 | `enabled` default false; `wipe_seconds` -1 (none) to 3, default -1; a countdown needs `enabled` |
| `generate_map{record, seed, mode, anchors, enabled, values, reals, state_key}` | 37 | see below |
| `set_music_section{section, enabled}` | 11 | `section` 0 to 127; `enabled` default true |
| `set_ghost_link{active}` | 65 | `active` default true |
| `ghost_link()` | 65 | returns `{generation, progress, active}`, or nil until the client reported all three; not a request |
| `transition{transition, snap}` | 23 | `transition` from `context.sdk.device_transitions`; `snap` default false |
| `set_channel{channel, value, snap}` | 23 | `channel` from `context.sdk.device_channels`; `value` from `context.sdk.unit(x)`; `snap` default false |
| `applied{channel}` | 23 | returns boolean; not a request |
| `fire_trigger()` | 31 | arms the trigger |
| `disarm_trigger()` | 31 | stops it reporting |
| `set_volume_active{volume, active}` | 32 | `volume`: a type-60 slot handle on the toggle's own object; `active`: required boolean; turns that volume on or off |
| `set_directive{directive, state, navpoint, waypoint, audience, progress}` | 68 | see below |
| `clear_directives()` | 68 | hides the goal |
| `set_public_event_state{area, leave_seconds, state, player}` | 71 | see below |
| `play_sequence()` | 5 | plays the authored sequence |
| `play_sequence{sequence}` | 2 | plays an actor sequence; see "Actor sequences" |
| `sequences()` | 2 | returns the actor's sequence collection; not a request |
| `set_cinematic_active{active}` | 6 | `active` default true |
| `reset_objectives()` | 3 | resets every task of the objective |
| `advance_task()` | 38 | advances the authored task bit |
| `play_performance{state}` | 42 | `state`: a `mission.PerformanceState` entry; may be left out when the target has one state |
| `play_dialogue_cue{cue, filter}` | 53 | `cue` 0 to 65535, a `mission.DialogueCue` value; a cue past the sensor's cue count is refused; `filter`: optional type-60 slot handle |
| `assign_combat_objective{objective, task_group, reconsider, reserved, refresh_player_awareness}` | 1 | see below |
| `run_atoms{atoms, spawn}` | 2 | see "Atom programs" |
| `play_actor_path{path, spawn}` | 2 | `path`: a type-58 slot on the same object |
| `play_actor_action{ability, target, spawn}` | 2 | one `ability` atom |
| `retire_actor()` | 2 | removes the actor |
| `bind_combatant_to_squad()` | 2 | arms the actor for its scene's squad spawn |

"Slot handle" means a value from `context:slot(...)`, not an id string.

### `set_object_filter`

| key | type | adds this test |
|---|---|---|
| `players` | boolean | objects that are players |
| `target` | type-4 slot handle | this one object |
| `targets` | list of 1 to 8 type-4 slot handles | one test per object |
| `squad` | type-1 slot handle | this squad |
| `inside` | type-60 slot handle | objects inside this volume |
| `inside_any` | list of 1 to 5 type-60 slot handles | objects inside any of these volumes |

All tests share eight places. A filter that needs more is refused.

### `set_directive`

| key | type | meaning |
|---|---|---|
| `directive` | a `mission.Directive` entry | the goal to show; it must belong to this sensor |
| `state` | integer 0 to 2 | directive state; default 0 |
| `navpoint` | type-47 slot handle | map marker target |
| `waypoint` | type-60 slot handle | volume where the marker hides |
| `audience` | type-70 slot handle | engagement sensor for the mission banner |
| `progress` | list of 1 to 4 int32 values | counter values, for example `{current, maximum}` |

`progress` works only on a directive whose entry has `counter = true`. On any other directive it is
an error, because the HUD would ignore the values.

### `generate_map`

Call it on a type-37 map generator slot. The body holds two generator records. The call writes one
of them. Every field you leave out keeps its authored value. The exception is `state_key`, which
defaults to 0.

| key | type | meaning |
|---|---|---|
| `record` | 1 or 2 | which record to write; default 1 |
| `seed` | integer up to 4294967295 | the generator seed; a negative value keeps the authored seed |
| `enabled` | boolean | turns the record on or off |
| `mode` | integer -128 to 127 | raw mode byte |
| `anchors` | list of exactly 4 tables | each `{first, second, value, enabled}`; `first` and `second` are -128 to 127 |
| `values` | list of up to 5 int32 | raw integer inputs; -1 in the first two keeps the authored value |
| `reals` | list of up to 2 numbers | raw number inputs |
| `state_key` | integer 0 to 4294967295 | default 0 |

The meaning of `mode`, `anchors`, `values` and `reals` is not known yet. The existing scripts send
only `seed` and `enabled`:

```lua
context:slot(Slot.MAP_GENERATOR_SENSOR):generate_map{seed = 12345, enabled = true}
```

### `set_public_event_state`

| key | type | meaning |
|---|---|---|
| `area` | slot handle | the object whose zone bounds the event area; required |
| `leave_seconds` | finite number 0 or more | seconds outside the area before the client reports it; required |
| `state` | int32 | shown by the HUD; default 0 |
| `player` | decimal string | the watched player; default `context.player_key` |

### `assign_combat_objective`

Call it on the squad's type-1 slot.

| key | type | meaning |
|---|---|---|
| `objective` | type-3 slot handle | required; must be in the same registry as the squad |
| `task_group` | a `mission.TaskGroup` entry | which task group to use; must belong to `objective`; default none |
| `reconsider` | boolean | force the squad to pick again; default false |
| `reserved` | boolean | reservation flag; left out keeps the current reservation |
| `refresh_player_awareness` | boolean | default false |

Inside `on_event_squad_state` for the same squad, the request carries the reported objective
revision, so the host can reject a stale change.

## Squad

### Fields and methods

| member | returns | meaning |
|---|---|---|
| `row`, `id`, `name` | | identity |
| `member_count` | integer | members in the squad |
| `default_counts` | list | authored count per member |
| `anchors` | collection or nil | spawn points as world rows; nil when the world is stale; see [The live SDK views](/docs/mission-scripting/live-sdk-views/) |
| `counts()` | count vector | a new vector filled with the defaults |
| `place{counts, mode, spawn_rule, retire_on_return}` | RequestKey | spawn the squad |
| `actor_command{command, value}` | RequestKey | send one command to every live member |

### `place`

| key | type | meaning |
|---|---|---|
| `counts` | count vector from this squad | how many of each member; default the authored counts |
| `mode` | from `context.sdk.squad_modes` | `reinforce` (default), `replace` or `reserve` |
| `spawn_rule` | type-66 slot handle | replaces the authored spawn rule |
| `retire_on_return` | boolean | let the host retire the squad's old entities when the client returns them; default false |

A count vector from another squad is an error.

### Count vector

| member | meaning |
|---|---|
| `count` | number of members |
| `capacity` | 8; `counts()` errors on a squad with more members |
| `at(i)` | count of member `i`, from 1 |
| `set(i, n)` | set member `i` to `n`, 0 or more |

```lua
local squad = context:squad(mission.Squad.SQ_GUARDS)
local counts = squad:counts()
counts:set(1, 3)
squad:place{counts = counts, mode = context.sdk.squad_modes.replace}
```

### `actor_command`

| key | type | meaning |
|---|---|---|
| `command` | integer 0 to 4294967295 | a `mission.ActorCommand` value |
| `value` | int32 | the command value, for example a `mission.Faction` value |

## Scene

| member | returns | meaning |
|---|---|---|
| `row`, `id` | | identity |
| `activate{spawn}` | RequestKey | start the scene; `spawn = true` also spawns its authored cast; default false |
| `stop{}` | RequestKey | stop the running scene |
| `send_event{key}` | RequestKey | fire one input of the running scene; `key` is a `mission.SceneInput` entry, 1 to 4294967294 |

A `key` that no block of this scene waits on is refused: the `effect_result` outcome is
`refused`, and the log names `unknown_event`. Take `key` from this scene's own `mission.SceneInput`
entries.

`activate{spawn = true}` errors when the scene has no single authored cast.

## Cohort

A cohort is a read-only view of 1 to 64 squads. `squads` takes squad ids or squad handles, each
once.

```lua
local group = context:cohort{squads = {mission.Squad.SQ_A, mission.Squad.SQ_B}}
if group.cleared then
    -- every squad in the group is dead
end
```

| field | type | meaning |
|---|---|---|
| `alive_count` | integer or nil | total alive; nil while any squad is unknown |
| `observed_full` | boolean | every squad was seen at full strength |
| `cleared` | boolean | seen full, and now all dead |
| `size` | integer | number of squads |

A squad with a placement still in the queue counts as unknown. So `cleared` is false until the
placement is delivered and the client has reported the squad.

## Lifetime

`context.lifetime:set{state = s}` sets the activity lifetime state. `s` comes from
`context.sdk.lifetime_states`:

| member | meaning |
|---|---|
| `at(n)` | state `n`, 0 to 10; its `value` is `n` |
| `default` | state 3 |
| `count` | 11 |

`complete_mission` sets state 6 for you. Prefer it.

## Peers

`context.peers` lists the other sessions in this activity.

| member | meaning |
|---|---|
| `count` | number of peers |
| `at(i)` | peer `i`, from 1 |

A peer has `session_id`, `session_generation`, `member_key` and `join_identity`, all decimal
strings.

A peer handle follows its session, even when the list order changes. After that session leaves,
reading the handle is an error: "peer session is no longer in the published set".

## Name references

`context.timers:resolve(name)` and `context.variables:resolve(name)` check a name and return a
handle with a `name` field. `capacity` gives the store size (32 and 512). They only check names. No
request takes them yet.

## Value types

Device channels, device transitions, squad modes, lifetime states, `context.sdk.unit(x)` and
`context.sdk.position(x, y, z)` make the values that `set_channel`, `transition`, `place` and
`context.lifetime:set` take. [Vocabularies](/docs/mission-scripting/live-sdk-views/#vocabularies)
lists each one, its fields and the six transitions.

## Actor sequences

`slot:sequences()` on a type-2 actor returns its sequence collection.

| member | meaning |
|---|---|
| `count` | number of sequences |
| `at(n)` | sequence `n`, from 1, or nil |
| `<SYMBOL>` | the sequence with that symbol, or nil |
| `KEY_<8 hex>` | the sequence with that key hash, or nil |

A sequence has `id`, `name`, `symbol`, `source_path`, `key`, `kind`, `resource_tag`,
`table_index`, `ordinal`, `source_offset` and `playable`.

```lua
local actor = context:slot(mission.Slot.SQ_BOSS_BOSS)
local sequence = actor:sequences().BERSERK_ANIMATION
if sequence ~= nil and sequence.playable then
    actor:play_sequence{sequence = sequence}
end
```

Only a playable sequence of this same actor is accepted.

## Atom programs

`slot:run_atoms{atoms = list, spawn = flag}` sends a small program to a type-2 actor. The list has 1
to 32 atoms. Each atom is a table with a `kind`. `context.sdk.atom_kinds` holds the kind names.

| kind | fields | meaning |
|---|---|---|
| `face` | `target`, `value` | turn to a point of `target` |
| `snap_to` | `target`, `value` | jump to a point of `target` |
| `move_to` | `target`, `value`, `enabled` | move to a point of `target` |
| `sequence` | `value` | play a sequence by number |
| `sleep` | `seconds` | wait |
| `trivial` | none | an empty step |
| `control_flag` | `value` 0 to 63, default 0 | set a control flag |
| `set_temperament` | `value`, `enabled` | set a temperament |
| `set_channel` | `channel`, `value` | set an actor channel to a number |
| `ability` | `ability`, `target` | use a `mission.ActorAbility` entry of this actor |

- `target` is a slot handle. `value` on `face`, `snap_to` and `move_to` is an authored point number
  of that target, 0 to 255, default 0. An unknown point is an error.
- `value` on `sequence` and `set_temperament`, and `channel` on `set_channel`, are 0 to 4294967295.
  `seconds` and the `set_channel` `value` are finite numbers.
- `enabled` defaults to false. Any value other than nil or false counts as true.
- An `ability` must belong to this actor. Its optional `target` must have an authored point 0.
- An `ability` atom refuses unknown fields. The other kinds ignore them.
- Any atom may add `quantized`, 0 to 2047.
- `spawn = true` creates the actor from its authored source first. It errors when the actor has no
  single authored source.

`play_actor_action{ability, target, spawn}` is a one-atom `ability` program.
`play_actor_path{path, spawn}` sends the actor along an authored type-58 path that has a
destination.

## Events

Every event has these fields:

| field | type | meaning |
|---|---|---|
| `kind` | integer | the `EventKind` number; compare it with `require("sunrise.activity_sdk").EventKind.SQUAD_STATE` and the like |
| `sequence` | string | event order number |
| `source_generation` | string | client generation that produced it |
| `attempt_generation` | string | attempt it belongs to |

Most events also have `mission_sequence` (string), the input order. The events marked "no
`mission_sequence`" in "Fields per event" do not.

### Slot identity

Events about one slot also have:

| field | type |
|---|---|
| `slot` | slot handle, or nil when the slot is not in this activity |
| `registry_key`, `object_tag`, `slot_index`, `slot_type` | integer |

To test an event against a slot:

```lua
local function is_slot(context, event, id)
    return event.slot ~= nil and event.slot.id == context:slot(id).id
end
```

### Fields per event

A field that the report did not carry reads nil. A field of another event kind also reads nil, so
one handler can test the fields of several kinds. The first column is the callback name without
its `on_event_` prefix.

| event | fields beyond the common ones |
|---|---|
| `region_changed` | `region_index`; `previous_region_index` (nil the first time) |
| `client_state_changed` | `client_message_sequence`, `payload_bytes`, `activity_state_revision`, `membership_revision`, `region_index`, `current_region_index`, `held_region_index`, `region_slice_set_hash`, `spawn_state`, `teleport_state`, `teleport_slice_set_index`, `teleport_slice_set_hash`, `entered` |
| `player_trigger` | slot identity; `volume_registry_key`, `volume_slot_type`, `volume_slot_index`, `resolved_object_id` |
| `trigger_entered`, `trigger_exited` | slot identity; `member_count`, `value`, `all_inside` |
| `trigger_state` | slot identity; Sense generation; `available`, `continuity`, `occupied`, `member_count`, `value`, `all_inside`; the last four are nil when `available` is false |
| `squad_state` | slot identity; Sense generation; `alive_count`, `previous_alive_count`, `removal_flag`, `slot_counts` (list); methods `task_cost{group}`, `task_group{objective}` |
| `entity_spawned` | slot identity; Sense generation; `member_slot`, `count`, `previous_count` |
| `entity_died` | slot identity; Sense generation; `alive_count`, `previous_alive_count`, `removal_flag` |
| `squad_provoked` | `registry_key`, `slot_type`, `slot_index`; **no `slot`** |
| `damage_state` | slot identity; `health`, `shield`, `revision` |
| `object_state`, `object_interacted` | slot identity; Sense generation; `generation`, `present`, `alive` (same as `present`), `interaction_open`, `owner_known`, `has_owner`, `owner_key`, `initial_observation` (first report of this generation), `entry_index` (the authored entry the object came from), `spawn_mask_low`, `spawn_mask_high` |
| `device_state` | slot identity; `position`, `power`, `lock`, `position_sequence`, `power_sequence`, `lock_sequence`, `first_report`, `reset`; method `applied_request{channel}` |
| `ghost_link_state` | slot identity; `generation`, `progress`, `active` |
| `actor_path_state` | slot identity; `generation`, `revision`, `path_state`, `delivery_revision`, `delivery_state`, `suppressed` |
| `scene_finished` | slot identity; `activation_token` |
| `scene_output` | slot identity; `key`, the output key; `activation_token` of the run that reported it |
| `objective_progress` | slot identity; `objective`, `task`, `task_count`, `previous_task_count` |
| `cinematic_started`, `cinematic_terminated`, `cinematic_skip_requested` | slot identity; `runtime_object_id` (string), `event_value` |
| `fireteam_state` | `alive_count`, `dead_count`, `unknown_count` |
| `session_joined` | `session_id`, `session_generation`, `member_key`, `joined_revision` |
| `session_left` | `session_id`, `session_generation`, `member_key` |
| `timer_elapsed` | `timer_name`, `timer_deadline_tick`, `timer_sequence` |
| `phase_entered` | `phase`, `previous_phase`, `state_revision` |
| `effect_result` | `request_key`, `effect`, `outcome`, `outcome_code` |
| `entity_slots_requested` | `requested_count` |
| `sensor_sense_updated` | `client_message_sequence`, `payload_bytes`, `state_revision`, `peer_heard_mask`, `objects_decoded`, `groups_decoded`; slot identity of the first object, when there is one |
| `incident_received` | `client_message_sequence`, `payload_bytes`, `incident_target`, `incident_extra_targets`, `incident_selector_bytes`, `incident_payload_bytes` |
| `incident_queued`, `incident_transport_staged`, `incident_canceled`, `incident_refused` | `incident_revision`, `incident_target`, `incident_extra_targets`, `incident_selector_bytes`, `incident_payload_bytes`; no `mission_sequence` |
| `client_message_received` | `client_message_sequence`, `payload_bytes`, `peer_heard_mask`, `state_revision`, `message_type`, `message_status`, `message_name`, `message` |
| `auth_state_committed`, `auth_state_transport_staged`, `auth_state_canceled` | `state_revision`; no `mission_sequence` |
| `scriptable_override_committed`, `scriptable_override_transport_staged`, `scriptable_override_canceled` | `scriptable_revision`; no `mission_sequence` |
| `operator_refused` | `state_revision`; no `mission_sequence` |

"Sense generation" is two fields, each nil when the report did not carry it:

| field | meaning |
|---|---|
| `spawn_generation` | the spawn generation a squad report echoes from its placement |
| `sense_generation` | the report's record counter, plus one |

`trigger_state` comes from a type-30 occupancy monitor on every report it accepts, the first one
included. It skips a stale report and an exact repeat. `continuity` says how the report relates to
the one before: `baseline`, `consecutive`, `duplicate`, `conflict`, `gap`, `reset`,
`missing_counter`, `wrap` or `invalid`. The event only informs. `trigger_entered` and
`trigger_exited` still follow the occupancy level alone.

On `incident_canceled` the four body fields are 0 when there is no record. On `incident_refused`,
`incident_revision` is always 0. On `operator_refused`, `state_revision` is 0 on most refusals.

### `client_state_changed` in detail

The client sends state reports often, even while it loads. Most carry no change.

| field | present when |
|---|---|
| `entered` | true only on the host's arrival answer; nil otherwise |
| `held_region_index` | the host knows which region the client holds |
| `region_index` | the report names a region leg |
| `current_region_index` | the report names the current region |
| `spawn_state` | the report carries a spawn byte |
| `teleport_state` | the report carries a teleport byte; `context.sdk.client_teleport_reset` (0) marks a finished spawn |

Use `region_changed` to react to movement. Use `client_state_changed` with `entered == true` to
react to the first arrival.

### `squad_state` methods

| method | returns |
|---|---|
| `event:task_cost{group = g}` | `cost` (number or nil) and `known` (boolean) for a `mission.TaskGroup` entry |
| `event:task_group{objective = slot}` | the current group (compares equal to a `mission.TaskGroup` entry) or nil, and `assigned` (boolean) |

### `device_state:applied_request`

`event:applied_request{channel = c}` returns the RequestKey that this report satisfied on channel
`c`, or nil.

### `effect_result`

| field | meaning |
|---|---|
| `request_key` | the key of the request |
| `effect` | the request name from the list below, or nil for any other request |
| `outcome` | `transport_staged`, `refused`, `expired` or `canceled` |
| `outcome_code` | 0 to 3 in the same order |

`effect` names: `squad.place`, `scene.activate`, `scene.stop`, `scene.send_event`,
`slot.set_object_active`, `slot.set_channel`, `slot.run_atoms`, `slot.retire_actor`,
`slot.set_interactable_object`, `slot.set_ghost_link`, `slot.watch_damage`,
`slot.assign_combat_objective`, `lifetime.set`, `mission.restart_checkpoint`, `slot.fire_trigger`,
`slot.play_sequence`, `slot.set_cinematic_active`, `slot.play_performance`,
`slot.reset_objectives`, `slot.advance_task`, `slot.play_dialogue_cue`, `mission.select_state`,
`mission.hold_spawn`.

Some requests report the name of the effect they share. `complete_mission` reports
`lifetime.set`. `activate_objects` reports `slot.set_object_active`. `transition` reports
`slot.set_channel`. `disarm_trigger` reports `slot.fire_trigger`. `play_actor_path` and
`play_actor_action` report `slot.run_atoms`.

### `client_message_received`

| field | meaning |
|---|---|
| `message_type` | the message id |
| `message_status` | `unclassified`, `decoded`, `decoded_partial`, `prefix_only`, `opaque`, `outer_decoded`, `prepared`, `prepare_refused`, `malformed` or `quarantined` |
| `message_name` | the catalog name, or nil |
| `message` | the catalog message row, or nil; see [The live SDK views](/docs/mission-scripting/live-sdk-views/) |

A message row's `matches{event = e}` tells whether an event is that message.

## Errors you will see

| message | cause |
|---|---|
| `effect argument is not declared` | a misspelled or extra key in the argument table |
| `effect arguments must be one table` | you passed a value that is not a table |
| `<key> must be a <type>` | wrong type for a named argument |
| `unknown or ambiguous activity slot` | the id is not in this activity; squads and scenes say `activity squad` and `authored scene` |
| `activity slot is not an exact type-N ...` | the method does not fit this slot type |
| `activity slot is stale` | the data changed under a handle you kept |
| `mission variable name is invalid` | empty, too long, or a bad character |
| `mission variable value is not a bounded scalar` | nil, a table, a non-finite number or a long string |
| `mission variable capacity exceeded` | more than 512 variables |
| `mission timer capacity exceeded` | more than 32 timers |
| `directive does not belong to this slot` | the directive comes from another sensor |
| `directive progress requires an element with a counter` | `progress` on a directive without `counter = true` |
| `squad counts were minted by another squad` | a count vector from a different squad |
| `mission attempt is already complete` | `complete_mission` called twice |

Faults that stop a whole callback, such as `instruction_budget`, are in
[Common problems](/docs/mission-scripting/debugging/#common-problems).
