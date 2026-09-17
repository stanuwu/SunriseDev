---
title: "Your first script"
date: 2026-09-17
description: "From an empty folder to a running, reloadable mission script."
weight: 10
---
This page takes you from nothing to a running script. It uses the in-game tools, so keep the game
open while you work.

## What you need

- The game installed with Sunrise, running under the local server.
- A text editor.
- The `Sunrise` folder in your game install: `<game>/bin/x64/Sunrise/`.

| folder | what is in it |
|---|---|
| `Sunrise/scripts/` | your scripts |
| `Sunrise/sdk/lua/` | the generated SDK modules; read only |
| `Sunrise/logs/` | `sunrise.log`, when file logging is on |
| `Sunrise/settings.json` | Sunrise settings |

## Step 1: turn on the script log

By default Sunrise writes no log file and shows only warnings. Script lines are at debug level.

Open `Sunrise/settings.json` and change only these two values:

```json
"core": {
  "logging": {
    "file_sink": true,
    "levels": {
      "server": "debug"
    }
  }
}
```

Keep the rest of the file as it is. Restart the game. The log now goes to
`Sunrise/logs/sunrise.log`, and the previous run is kept as `sunrise.log.old`.

Mission scripting itself is on by default. It is `server.activation.mission_scripting`.

## Step 2: open the Sunrise menu

Press **Insert**. The "SUNRISE" menu opens. The left column lists the pages.

| page | group | what you use it for |
|---|---|---|
| Activity Launcher | Client | start an activity |
| Activity Host | Server | open the "World" window with the SDK pages |
| HUD | Core | turn on the "Mission Script" overlay |
| Logs | Core | read the log in game |

To use another key, set `client.ui.toggle_key` in `settings.json`. It accepts `insert`, `home`,
`end`, `delete` and `f1` to `f12`.

## Step 3: pick an activity and find its script name

1. Open **Activity Launcher**.
2. Find your activity and open its card.
3. Open "Activity information". It shows the package name, for example `adventure_ginger`.

The script file is named after the activity's internal name. That is usually the package name. The
`name` field of the activity module in `Sunrise/sdk/lua/activities/` holds the same name the
runtime uses, before it is folded to lower case with `_` for other characters.

```
Sunrise/scripts/<name>/<name>.lua
```

For `adventure_ginger` that is `Sunrise/scripts/adventure_ginger/adventure_ginger.lua`. The exact
rule is in [How a script runs](/docs/mission-scripting/program-model/). Once the activity runs, the "Script" page shows the path it
looks for. Step 6 shows where.

If a script already exists for your activity, copy the folder away first, or pick another activity.

## Step 4: find the mission module

Open `Sunrise/sdk/lua/missions.lua`. Find the upper-case scenario name, for example:

```lua
ADVENTURE_GINGER = "missions.adventure_ginger_80b2e043",
```

If you are not sure which scenario your activity runs, open
`Sunrise/sdk/lua/activities/<name>_<hash>.lua`. Its `mission` field requires the right module.

## Step 5: write the script

Create the folder and the file. Put this in it:

```lua
-- My first mission script.
local missions = require("missions")
local mission = require(missions.ADVENTURE_GINGER)

return {
    -- Runs once, when the mission starts for the first time.
    on_start = function(context, state)
        context:set_variable("hello", "started")
    end,

    -- Runs each time the player moves into another region.
    on_event_region_changed = function(context, state, event)
        context:set_variable("last_region", event.region_index)
        local seen = state:variable("regions_seen") or 0
        context:set_variable("regions_seen", seen + 1)
    end,
}
```

What it does:

- `require("missions")` loads the name table. `require(missions.X)` loads the mission module.
- The file returns one table, the program.
- `on_start` stores a variable. Variables are how a script remembers things.
- `on_event_region_changed` counts region changes.

The script sends nothing to the game yet. That is on purpose: first check that it loads.

## Step 6: run it

1. Go to orbit.
2. Launch your activity normally or In **Activity Launcher**, open your activity and press **Launch activity**.
3. When you have landed, open **Activity Host**, tick **World**. A window opens.
4. In that window, pick the **Script** page.

The Script page shows:

| line | what to look for |
|---|---|
| `File Sunrise/scripts/<name>/<name>.lua` | the path the runtime reads |
| `Attach ...` | `ready` when the script attached |
| `Program ...` | `loaded` and `active` |
| `Error ...` | the Lua error text, when there is one |

Then pick the **Mission state** page. You should see `hello = started`, and `last_region` and
`regions_seen` once you move between areas.

You can also turn on the **Mission Script** overlay on the **HUD** page. It shows each running
script, its phase, its file and its last error, on screen at all times.

## Step 7: change it and reload

1. Edit the file and save it.
2. On the **Script** page, press **Reload script**.

The runtime closes the script and opens it again. Your variables stay. Because the mission already
started, `on_load` runs instead of `on_start`. Add one when you need it:

```lua
on_load = function(context, state)
    context:set_variable("reloaded", true)
end,
```

## Step 8: make it do something

Show a goal on the HUD when the mission starts. Find a directive sensor and a directive in the
mission module, then:

```lua
local Slot, Directive = mission.Slot, mission.Directive

return {
    on_start = function(context, state)
        context:slot(Slot.M_DIRECTIVE_SENSOR_80B2E0B4):set_directive{
            directive = Directive.SOME_DIRECTIVE_KEY,
        }
    end,
}
```

The names above are placeholders. Search the module for `M_DIRECTIVE_SENSOR` and for
`mission.Directive`, and use real keys. [Finding things in game](/docs/mission-scripting/finding-things/) shows how.

## When it does not work

| what you see | what to check |
|---|---|
| `open no_script` in the log | the folder or file name is wrong |
| `open compile_error` | a Lua syntax error; the log line has the text |
| `open runtime_error` | the top-level code failed, often a bad `require` name |
| `open invalid_program` | the file did not return a table, or an entry is not a function |
| `Program ... faulted` | a callback failed; the Error line has the text |

More in [Debugging a script](/docs/mission-scripting/debugging/).

## Next

- [The world model](/docs/mission-scripting/world-model/): the words the rest of the guides use.
- [How a script runs](/docs/mission-scripting/program-model/): how callbacks, state and requests work.
- [Recipes](/docs/mission-scripting/recipes/): how to do each thing a mission needs.
- [Build a mission from scratch](/docs/mission-scripting/new-mission/): build a whole mission.
