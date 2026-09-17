---
title: "Debugging a script"
date: 2026-09-17
description: "The Script page, the log, common errors, faults and an offline check."
weight: 110
---
A script cannot print. You debug it with four things: the Script page, the Mission state page, the
log, and an offline check before you launch.

## The fast loop

1. Save the file.
2. Press **Reload script** on the **Script** page.
3. Read **Program** and **Error** on the Script page.
4. Read your variables on the **Mission state** page.
5. Repeat.

Turn on the **Mission Script** overlay on the **HUD** page to see the status and last error while
you play.

## Show values without `print`

Write what you want to see into a variable. Use a `debug.` prefix, so you can find and remove them
later.

```lua
local function note(context, key, value)
    context:set_variable("debug." .. key, value)
end

return {
    on_event_player_trigger = function(context, state, event)
        note(context, "last_trigger", event.slot and event.slot.name or "unknown")
        note(context, "trigger_count", (state:variable("debug.trigger_count") or 0) + 1)
    end,
}
```

Remember the limits: 512 variables, names up to 63 bytes, strings up to 127 bytes. A debug note
that fails its own limits faults the script.

To see why an event did not match, store its raw fields:

```lua
note(context, "slot_index", event.slot_index or -1)
note(context, "registry_key", event.registry_key or -1)
```

## The log

Turn on the file and debug level first. See step 1 of [Your first script](/docs/mission-scripting/first-script/). The file is
`Sunrise/logs/sunrise.log`. The **Logs** page shows the same lines in game, with a text filter.

Every script line looks like this:

```
server level=<level> t=<ms> ev=mission_script stage=<stage> result=<result> session=<id> activity_row=<n> [fields] [error="<text>"]
```

Filter on `ev=mission_script`.

### Stages you will see

| stage | result | meaning |
|---|---|---|
| `initialize` | `enabled` | scripting is on |
| `initialize` | `path_error`, `sdk_lua_path_error` | the Sunrise folder was not found |
| `attach` | `ready` | the script attached |
| `attach` | `no_script`, `no_activity_link`, `sdk_status`, `capacity`, ... | why it did not attach |
| `open` | `ready` | the script loaded and started; `reason=state_reattached` after a reopen |
| `open` | `no_script` | no file at the expected path |
| `open` | `file_error`, `source_too_large` | the file could not be read, or is over 128 KiB |
| `open` | `compile_error` | a syntax error; see `error=` |
| `open` | `runtime_error` | the top-level code failed; see `error=` |
| `open` | `out_of_memory` | over 64 MiB while loading |
| `open` | `invalid_program` | the file did not return a valid program table |
| `initial_state` | `publication_pending` | waiting for the first state to reach the client |
| `initial_state` | a status | the first state was refused |
| `start`, `load` | `script_error`, `instruction_budget`, `out_of_memory` | `on_start` or `on_load` failed |
| `event` | `committed` | a callback ran; `detail=` names the event |
| `event` | `script_error`, `instruction_budget`, `out_of_memory` | a callback failed; the program is now faulted |
| `intent` | a request name | a request started delivery |
| `delivery` | a result | a request finished delivery |
| `intent_refused` | a reason | a request was refused; `error=` says why |
| `player_trigger` | `resolved` or a status | a trigger report was matched to its slot, or not |
| `cinematic` | a signal or a status | a cinematic report was matched, or not |
| `trigger`, `squad`, `scene`, `objective`, `device_state` | `watch_capacity` | too many watched slots of that kind |
| `reload` | `requested` | the Reload button was pressed |
| `close` | `stale_generation` | the script was closed; it reopens on the next tick |

### Examples

A syntax error:

```
server level=warn ... ev=mission_script stage=open result=compile_error ... error="[string 'act/0125/87d9ca16']:42: '}' expected near 'end'"
```

The main file is named after the activity id. The number after it is the line. The log turns
double quotes in the message into single quotes. An error inside a required module names that
module's file instead.

A refused checkpoint:

```
server level=warn ... ev=mission_script stage=intent_refused result=checkpoint_refused ... error="party_or_spawn_unavailable"
```

## Common problems

| problem | cause | fix |
|---|---|---|
| `open no_script` | wrong folder or file name | match the path on the Script page |
| `runtime_error` with `module 'x' not found` | a bad `require` name | use `missions.X`; check the folder name |
| `runtime_error` with `missing mission constant` | a key that does not exist | search the module for the right key |
| `attempt to call a nil value (global 'pairs')` | `pairs` is removed | walk arrays with `ipairs` |
| `attempt to call a nil value (field 'match')` | pattern functions are removed | use `string.sub` and `==` |
| `effect argument is not declared` | a misspelled argument | check the argument table in [Lua API reference](/docs/mission-scripting/lua-api/) |
| `activity slot is not an exact type-N ...` | the slot is of another type | check the `type` in the module |
| `unknown or ambiguous activity slot` | the key belongs to another scenario | use the id from this mission's module |
| `bad argument #2 to 'slot' (string expected, got userdata)` | you passed a slot handle to `context:slot` | pass the id string, or use the handle directly |
| `instruction_budget` | a loop ran too long | walk less; store results; split work over events |
| a trigger never reports | it was never armed, or was armed before its area loaded | arm it in `region_changed` for its region |
| a squad never counts as cleared | no report at full strength yet, or the placement was refused | check `effect_result`; check the Squads page |
| a goal shows no marker | the marker's object was not registered yet | send the goal again after its area loads |
| the script stops after a reload | the saved state is faulted | press Reload script again after fixing the error |
| nothing happens after an effect | results wait for the request queue to empty | do not wait for a result inside the same callback |

## After a fault

A faulted program runs no more callbacks. Reopening it faults again.

1. Read the error on the Script page or in the log.
2. Fix the script.
3. Press **Reload script**. It clears the fault and keeps your variables and timers as of the last
   good callback. Then it runs `on_load`, or `on_start` if the mission had not started yet.

The fault is not cleared while the saved state still holds requests made before it. The log then
shows `stage=reload result=intent_mismatch`. If that happens, leave the activity and launch it
again. A new launch is assumed to start with fresh mission state; this is unverified.

Client reports that arrived while the program was faulted are not replayed. Your `on_load` must
bring the mission back to a sane state from its variables.

## Check a script offline

You can load a script with a stock Lua 5.4 interpreter before you start the game. This catches
syntax errors, bad `require` names, missing keys, and errors in `on_start`. It does not prove the
game accepts your requests.

Save this as `check_script.lua` in the `Sunrise` folder:

```lua
-- Offline check for one mission script. Run it from the Sunrise folder:
--   lua54 check_script.lua my_mission
local name = assert(arg and arg[1], "usage: lua54 check_script.lua <script name>")
package.path = "sdk/lua/?.lua;scripts/?.lua"

local out, open_file = print, loadfile
local calls = {}

-- A fake handle: listed fields answer; any other key is a method that records its call.
local function fake(label, fields)
    return setmetatable(fields or {}, {__index = function(_, key)
        return function()
            calls[#calls + 1] = label .. ":" .. key
            return fake(label .. ":" .. key, {value = tostring(#calls)})
        end
    end})
end

local sdk = fake("sdk", {
    device_transitions = {open = "open", close = "close", power_on = "power_on",
        power_off = "power_off", lock = "lock", unlock = "unlock"},
    device_channels = {position = "position", power = "power", lock = "lock"},
    squad_modes = {reinforce = "reinforce", replace = "replace", reserve = "reserve"},
    atom_kinds = {face = "face", sequence = "sequence", sleep = "sleep", move_to = "move_to",
        trivial = "trivial", control_flag = "control_flag", snap_to = "snap_to",
        set_temperament = "set_temperament", set_channel = "set_channel", ability = "ability"},
    client_teleport_reset = 0,
    unit = function(x) return x end,
})

local variables = {}
local function selector(kind)
    return function(_, id)
        assert(type(id) == "string" or math.type(id) == "integer", kind .. " selector is invalid")
        return fake(kind .. " " .. tostring(id), {id = id})
    end
end

local context = fake("context", {
    sdk = sdk,
    attempt_generation = "1",
    activity_role = "private",
    player_key = "1",
    mission_complete = false,
    slot = selector("slot"),
    squad = selector("squad"),
    scene = selector("scene"),
    cohort = function() return {cleared = false, observed_full = false, size = 1} end,
    set_variable = function(_, key, value) variables[key] = value end,
    clear_variable = function(_, key)
        local had = variables[key] ~= nil
        variables[key] = nil
        return had
    end,
    start_timer = function() return "1" end,
    cancel_timer = function() return false end,
    set_phase = function() end,
})

local state = {
    phase = 0,
    revision = "0",
    variable = function(_, key) return variables[key] end,
    has_variable = function(_, key) return variables[key] ~= nil end,
    timer = function() return nil end,
}

-- Remove what the runtime sandbox removes, so the script cannot use it here either.
for _, key in ipairs({"collectgarbage", "dofile", "getmetatable", "load", "loadfile", "next",
    "pairs", "print", "rawequal", "rawlen", "warn", "xpcall"}) do
    _G[key] = nil
end
for _, key in ipairs({"dump", "find", "match", "gmatch", "gsub"}) do
    string[key] = nil
end
math.random, math.randomseed = nil, nil

local chunk = assert(open_file("scripts/" .. name .. "/" .. name .. ".lua", "t"))
local program = chunk()
assert(type(program) == "table", "the script must return a table")
if program.on_start ~= nil then
    program.on_start(context, state)
end

out("requests made by on_start:")
for _, call in ipairs(calls) do
    out("  " .. call)
end
```

What it checks and what it does not:

| checked | not checked |
|---|---|
| the file compiles | whether a slot has the right type for a method |
| every `require` resolves | argument names and value ranges |
| every `lib.one` key exists | whether the client accepts a request |
| `on_start` runs without a Lua error | events; you can call handlers with your own fake events |
| no use of removed functions | the instruction and memory budgets |

`io`, `os` and the other libraries still exist in a stock interpreter. Do not use them in a script;
the runtime does not have them.

To test an event handler, build a fake event and call it:

```lua
local event = {kind = 40, region_index = 16, attempt_generation = "1"}
program.on_event_region_changed(context, state, event)
```

## Ask for help with the right facts

When you report a problem, include:

- the script path from the Script page
- the `ev=mission_script` lines around the problem, with `error=`
- the variables from the Mission state page
- what you did in game just before it happened
