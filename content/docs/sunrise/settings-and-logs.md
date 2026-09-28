---
title: "Settings, logs and in-game tools"
date: 2026-09-28
description: "The settings file, the log and its format, and the in-game menu."
weight: 20
---
Sunrise reads one settings file at startup, writes one log, and has one in-game menu. The settings
code is in `src/core/settings/`, the log in `src/core/logging/`, and the menu in `src/core/ui/`.

## The settings file

The file is `bin/x64/Sunrise/settings.json`. It sits in the `Sunrise` folder beside the DLL.

- If the file does not exist, Sunrise writes the default file there and uses it. The default is
  `resources/default_settings.json`, built into the DLL.
- Sunrise reads it once, at startup. Restart the game after a change.
- The file must be valid JSON and at most 1 MiB. A leading UTF-8 byte order mark is fine.
- Unknown keys are skipped. Most known keys may appear only once; a repeat is an error.
- A key you leave out keeps its built-in default.

If the file does not parse, Sunrise does not start. The reason goes to the debugger output as
`ev=settings result=fail reason=<step>`, because the log is not open yet.

### The version key

The root `version` key is the layout version of the file. This build expects `18`.

- A file with a lower version, or with no `version` key, is **deleted and replaced** by the
  default file. Your changes in it are lost. Copy the values you want before you update.
- A file with a higher version is still read. A mismatch line goes to the debugger output.

### Layout

```json
{
  "version": 18,
  "core":   { "logging": { ... }, "activity_sdk_generation": { ... } },
  "steam":  { "language": "...", "user": { ... } },
  "client": { "ui": { ... }, "external_server": { ... }, ... },
  "server": { "bap_port": 30974, "gameplay": { ... }, "activation": { ... } },
  "state":  { "activity": { ... } },
  "complete_exotic_catalysts": true
}
```

## Main keys

The default is the value in the default file. Where a missing key takes a different built-in
value, the table says so.

### Core

| key | type | default | what it does |
|---|---|---|---|
| `core.logging.file_sink` | bool | `false` | writes the log to `Sunrise/logs/sunrise.log` |
| `core.logging.debugger_sink` | bool | `true` | sends each log line to the Windows debugger output |
| `core.logging.levels.<channel>` | string | `"warn"` | the lowest level kept for that channel; see [Log levels](#log-levels) |
| `core.activity_sdk_generation.lua_declarations` | bool | `true` | writes the `sdk/lua` tree that mission scripts use |

### Steam

| key | type | default | what it does |
|---|---|---|---|
| `steam.language` | string | `"english"` | the game language; an unknown value falls back to `english` |
| `steam.user.persona_name` | string | `"Player"` | your player name; 1 to 63 printable ASCII characters |

The accepted languages are `english`, `french`, `german`, `italian`, `japanese`, `brazilian`,
`spanish`, `russian`, `polish`, `schinese`, `tchinese`, `latam` and `koreana`.

### Client

| key | type | default | what it does |
|---|---|---|---|
| `client.ui.enabled` | bool | `true` | off: the menu key does nothing and no HUD overlay draws |
| `client.ui.toggle_key` | string | `"insert"` | the key that opens and closes the menu |
| `client.custom_bootflow_textures` | bool | `true` | replaces some startup screen textures with ones built into Sunrise |
| `client.socket_menu_routing` | bool | `false` | moves four leg mods into the leg mod menu |
| `client.reveal_lore_books` | bool | `true` | clears the visibility gates on lore book entries |
| `client.external_server.enabled` | bool | `false` | sends the game's traffic to another server instead of answering it in process |
| `client.external_server.host` | string | `"127.0.0.1"` | that server's IPv4 address; a host name is refused |
| `client.external_server.config_url` | string | `"https://127.0.0.1/config/"` | the config URL handed to the game; must be a route that server serves |
| `client.external_server.config_guid` | string | `"d2legacy-0000-0000-0000-000000000001"` | the 36-character config id the game checks the config against |

`toggle_key` accepts `insert`, `home`, `end`, `delete` and `f1` to `f12`.

### Server

| key | type | default | what it does |
|---|---|---|---|
| `server.bap_port` | int | `30974` | the loopback port the BAP listener binds; SignOn hands it to the game |
| `server.gameplay.topology` | string | `"embedded"` | who owns the gameplay UDP endpoint; see below |
| `server.gameplay.bind_address` | string | `"127.0.0.1"` | the local interface the endpoint binds |
| `server.gameplay.advertised_address` | string | `"127.0.0.1"` | the address the game is told to use |
| `server.gameplay.transport_address` | string | `"127.0.0.1"` | the address the game's packets land on after the redirect |
| `server.gameplay.port` | int | `30976` | the first UDP port; must be even |
| `server.gameplay.server_reserve_count` | int | `256` | entity slots held back for server-made entities |
| `server.gameplay.client_join_grant_count` | int | `8192` | entity slots the game gets on join, capped by what the reserve leaves |
| `server.gameplay.hold_launch_cinematic` | bool | `false`; not in the default file | holds a launch sync open through the load so the spaceflight scenes are skipped |
| `server.activation.default_client_activation` | bool | `true` | off: a request to start another activity is recorded and gets no answer |
| `server.activation.activity_public_membership` | bool | `true` | sends membership on a public activity link |
| `server.activation.prevent_ownerless_channel_close` | bool | `false` | diagnostic only; sets a game feature flag that keeps a channel open when its last owner leaves |
| `server.activation.mission_scripting` | bool | `true`; `false` if missing | runs [mission scripts](/docs/mission-scripting/) |

`topology` takes one of three values:

| value | meaning |
|---|---|
| `embedded` | Sunrise binds the gameplay UDP endpoint |
| `external` | another process owns the endpoint |
| `disabled` | no endpoint |

The gameplay block is checked as a whole. With a topology other than `disabled`:

- `port` must be nonzero and even.
- The endpoint binds 16 ports, `port`, `port + 2`, up to `port + 30`. That range must stay below
  65536 and must not contain 3074.
- `server_reserve_count` must be at least 8 and leave at least 4096 of the 8192 slots for the game.
- `client_join_grant_count` must be at least 400 and at most 8192.

If any check fails, the settings file fails to parse and Sunrise does not start.

### State

| key | type | default | what it does |
|---|---|---|---|
| `state.activity.default_destination` | object | package `city_tower_social_d2`, activity index 20 | the destination used when nothing else selects one |
| `state.activity.roster_key_from_identity` | bool | `false` | uses the membership identity as the player key in the activity roster |

`default_destination` must have all eight fields: `reason`, `source_activity_index`,
`activity_index`, `package_name`, `bubble_count`, `stateful_bubble_mask`, `initial_slice_set` and
`spawn_set_hash`. `stateful_bubble_mask` and `spawn_set_hash` take a number or quoted hex, like
`"0xCF"`.

### Root

| key | type | default | what it does |
|---|---|---|---|
| `complete_exotic_catalysts` | bool | `true` | completes the catalysts of released exotic weapons |

### Values the menu saves

The menu pages do not write `settings.json`. They save to their own files in the same folder:

| file | written by |
|---|---|
| `movement.json` | the Movement page |
| `player.json` | the Player page |
| `hud.json` | the HUD page |
| `world_markers.json` | the display options of the world markers |

## The log

Sunrise has two log outputs. Each is switched in `core.logging`.

| output | key | default |
|---|---|---|
| the Windows debugger output | `debugger_sink` | on |
| the file `bin/x64/Sunrise/logs/sunrise.log` | `file_sink` | off |

The file log is off by default. To get `sunrise.log`, set `file_sink` to `true`. On each start the
previous file is renamed to `sunrise.log.old`, so one earlier run is kept.

If the file sink is on and the file cannot be opened, Sunrise does not start.

The debugger output can be read with any tool that shows `OutputDebugString` text.

### Line format

Every line has the same shape:

```text
<channel> level=<level> t=<ms> ev=<event> key=value key=value ...
```

- `<channel>` is one of `core`, `client`, `state`, `server`, `middleware`.
- `t` is milliseconds since the log opened. Gaps in it show stalls.
- `ev` names the event. Most lines add `stage=` and `result=`.
- A line is at most 1024 bytes. Longer text is cut.

Examples from `src/server/transport/bap_listener.cpp` and `src/server/http/server_http.cpp`. The
`t` values are made up.

```text
server level=info t=4210 ev=transport stage=listen result=ok port=30974
server level=info t=31877 ev=http method=post route=signon result=ok
server level=info t=32015 ev=transport stage=accept result=ok conn=1
```

To find problems, search for `result=fail`, `level=error` and `level=warn`.

### Log levels

There are four levels, from most to least severe: `error`, `warn`, `info`, `debug`. The fifth
value, `off`, drops the channel.

Each channel has its own threshold. A line is kept when its level is at or above the threshold.
So `warn` keeps errors and warnings; `debug` keeps everything.

Every channel defaults to `warn`. This example turns on the file log, raises `server` to `info` and
drops `middleware`:

```json
"core": {
  "logging": {
    "debugger_sink": true,
    "file_sink": true,
    "levels": {
      "core": "warn",
      "client": "warn",
      "state": "warn",
      "server": "info",
      "middleware": "off"
    }
  }
}
```

To turn logging down:

- Set a channel to `error` to keep only errors, or to `off` to drop it.
- Set `file_sink` to `false` to stop writing the file.
- Set `debugger_sink` to `false` to stop the debugger output.

Debug level is for diagnosis. It adds timing lines, such as the server's two-second service report.

For the mission script lines and what they mean, see
[Debugging a script](/docs/mission-scripting/debugging/).

## The in-game menu

Press **Insert** to open or close the menu. The key is `client.ui.toggle_key`. The menu starts
closed. With `client.ui.enabled` set to `false`, the key does nothing.

The left column lists the pages, in this order: client pages, then server pages, then Core pages.

| page | from | what it has |
|---|---|---|
| Movement | client | Teleport (distance and key), Noclip (toggle key), Fly (toggle key and speed), Sword Skate Fix |
| Player | client | Infinite Ammo, Anti AFK |
| Activity Launcher | client | browse activities by content (expansions, seasons, events), search, and launch from orbit; Custom Launch picks the arrival by hand |
| Activity Host | server | an instance selector and two windows, World and Packets |
| HUD | Core | one switch per overlay, and one per line of the Current Status overlay |
| Logs | Core | recent log lines, with channel, level and text filters, auto-scroll and Copy Visible |

Changes on the Movement, Player and HUD pages save at once and survive a restart.

### Activity Host windows

The **World** window has one page per kind of authored content: Squads, Idles, Combatants, Devices,
Triggers, Objects, Scenes, Dialogue, Directives, Objectives, Cinematics, Engagement, Public event,
Occupancy, Lifetime, States, Mission state, Positions, Behaviors and Script.

The **Packets** window lists the messages the game sent to the Activity Host.

How to use these windows to find content for a script is in
[Finding things in game](/docs/mission-scripting/finding-things/).

### HUD overlays

Overlays draw in the top-left corner, with the menu open or closed.

| overlay | starts | shows |
|---|---|---|
| Sunrise Card | on | the Sunrise name, version and logo |
| Current Status | off | activity, bubble, slice set and closest spawn, each line switchable |
| Session | off | the instances of your current session |
| Client Activity Messages | off | recent client messages at the Activity Host |
| Mission Script | off | what the mission script runtime is doing, per activity |

### The Logs page

The Logs page keeps only the newest 128 lines, in memory. It shows lines that passed the channel
thresholds in `core.logging.levels`, whether or not the file sink is on. A line dropped by the
threshold is not on the page either. For a full record, turn on `file_sink`.
