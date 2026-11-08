---
title: "How Sunrise is built"
date: 2026-11-08
description: "The parts, threads and startup order of the Sunrise DLL."
weight: 10
---
Sunrise is one DLL. The game loads it in place of its Steam API library. Inside the game process it
is two things at once: a client mod that hooks the game, and a local server that answers the game's
network traffic. Nothing leaves the machine unless you point it at an external server.

## How the game loads it

The build output is named `steam_api64.dll` (the `TargetName` in `Sunrise.vcxproj`). It sits in
`bin/x64` beside the game executable. The game loads it like the real Steam library and calls its
exports.

Sunrise implements those exports itself in `src/dllmain.cpp`. The game calls three of them at the
points that matter:

| export | what Sunrise does there |
|---|---|
| `SteamAPI_Init` | starts Sunrise: settings, logging, state, server and client setup |
| `SteamAPI_RunCallbacks` | runs every frame: attaches hooks, delivers Steam callbacks, runs client work |
| `SteamAPI_Shutdown` | stops everything in reverse order |

The other `SteamAPI_*` and `SteamInternal_*` exports answer the game's Steam questions locally:
user, language, callbacks, interfaces. The code is in `src/steam/`.

The DLL also exports three entry points for a host that loads it another way:

| export | what it runs |
|---|---|
| `SunriseInitialize` | the egress guard, then `core::initialize` |
| `SunriseActivateClient` | the game image scan and the main hook install |
| `SunriseShutdown` | the same shutdown as `SteamAPI_Shutdown` |

## The layers

Sunrise has six layers. Each one is a top-level folder under `src/`. Third-party code is in
`vendor/`: Detours for hooks, Dear ImGui for the menu, and Lua for mission scripts.

![The Sunrise layers inside the game process, and how they connect](/images/sunrise-architecture.svg)

Everything in the graph runs in the game process. The game reaches Sunrise three ways: through the
client's hooks, through Steam API calls, and over a real TCP connection to the server's BAP
listener on loopback. The client hands its requests to the server through `consumer.h`.

| layer | what it holds |
|---|---|
| `src/core` | the base every layer uses, and the startup order |
| `src/steam` | the local Steam API the game loads |
| `src/client` | everything that touches the game's own code |
| `src/middleware` | the game's wire and data formats, as encoders and decoders |
| `src/state` | what the server knows: the account, the activities, the game data |
| `src/server` | the local server that answers the game |

### Core

Core holds the parts with no game knowledge.

| folder | what it owns |
|---|---|
| `settings/` | reads and checks `settings.json`, one part per layer |
| `logging/` | the log sinks, the line format and the in-memory log view |
| `filesystem/` | the `Sunrise` folder and the paths under it |
| `threading/` | lock helpers |
| `json/` | the JSON reader that `settings.json`, `mod.json` and `mod_config.json` are parsed with |
| `ui/` | the menu and HUD framework: layout, theme, fonts, overlays, notices, world markers; and the Core pages HUD, Logs and Mods |
| `runtime/` | the startup and shutdown order across all layers |

`core/runtime` calls each layer's start and stop in order. See [Startup order](#startup-order).

### Steam

The game loads Sunrise as its Steam library, so Sunrise must answer every Steam call itself.

| folder | what it owns |
|---|---|
| `interfaces/` | the Steam interfaces the game asks for: apps, DLC, app ticket, friends, matchmaking, rich presence, user stats, networking |
| `runtime/` | the exports, the callback queue, and the per-frame pump |

The per-frame pump is where the client layer attaches and the server thread starts.

### Client

The client layer is the only layer that reads or changes the game's code.

| folder | what it owns |
|---|---|
| `patterns/`, `targets/` | find game functions by byte pattern and keep the resolved addresses |
| `executable/`, `memory/`, `process/` | read the game image's sections, access game memory, and stop the other threads for a code patch |
| `hooking/` | the Detours wrapper: one transaction per hook group, and a detach that waits for running calls |
| `hooks/` | every hook; see [Client hooks](/docs/sunrise/client-hooks/) |
| `network/` | `consumer.h`, the request types the hooks hand to the server |
| `content/` | workers that read the installed packages and build caches and the activity SDK |
| `diagnostics/` | the game side of the [Sunrise Studio link](#the-sunrise-studio-link): camera, world, object, animation and CUI screen data; and the input guards of a test process |
| `activity/` | the mission launcher, which starts an activity through the game's own entry points |
| `movement/`, `player/` | the saved values of the Movement and Player pages, and the player position |
| `graphics/`, `input/` | display setup under Wine, and the game window's focus |
| `ui/` | the Movement, Player and Activity Launcher menu pages |
| `runtime/` | installs the hooks in groups and removes them at shutdown |

A hook does not answer the game itself. It turns the game's call into a request, and the server
answers it. The rule for hooks that change game behavior is on
[Client hooks](/docs/sunrise/client-hooks/).

### Middleware

Middleware is the game's formats, written as code. It encodes and decodes. It does not decide what
to send.

| folder | what it owns |
|---|---|
| `signon/` | the SignOn request and response |
| `bap/` | BAP frames, the service catalog and every service body, including the activity messages |
| `secure_channel/`, `crypto/` | the encrypted BAP frame and the ciphers it needs; SHA-1 for the package header digests |
| `web_service/` | the ws RPC envelope and one codec per opcode |
| `queuez/` | the service 123 update body |
| `datagen/` | builds the game's account, character and roster records from Sunrise's state |
| `protobuf/`, `encoding/`, `compression/` | protobuf, the bit-packed codec, and Oodle |
| `content/` | the package reader and its mod overlay, named tags, the package tables, the package merge and config bake writers, and the CUI checks for mod config bindings |
| `gameplay/` | the peer transport: association, DTLS records, NAT, peer and group messages |
| `runtime/` | loads the package name catalog on the first boot |

The formats are described in the [Destiny 2](/docs/destiny-2/) section.

### State

State is what the server knows about the world. It holds facts, not protocol.

| folder | what it owns |
|---|---|
| `account/`, `investment/` | the account, its characters and items, and the SQLite store |
| `equipment/`, `progression/`, `unlocks/`, `entitlements/` | equipped gear and light, progress, unlock flags, owned content |
| `activity/` | activity sessions, bubbles, membership, entity slots and destinations |
| `activity_sdk/` | the generated activity SDK that mission scripts read |
| `build_data/` | game data read from the installed packages and mod packages: items, activities, vendors, records and more |
| `content_manifest/` | the scan of the installed packages, its cache, and the rows mods add |
| `content/` | the name-to-definition catalog read from the installed content |
| `mods/` | the [mod](/docs/sunrise/mods/) loader: discovery, manifests, load order, package checks, merges, mod config |
| `matchmaking/`, `gameplay/`, `steam/` | matchmaking config, replicated entity state, local Steam data such as rich presence and achievements |
| `runtime/` | starts the state, and holds the per-run values such as session tokens |

How the account is stored is on [Accounts, characters and saves](/docs/sunrise/save-data/).

### Server

The server answers the game. It reads requests, asks state, and uses middleware to write answers.

| folder | what it owns |
|---|---|
| `http/` | the SignOn answer |
| `transport/` | the BAP listener: a nonblocking TCP socket on loopback, 8 slots |
| `bap/` | one session per connection, the plaintext and encrypted routes, and every push |
| `web_service/` | the ws RPC handlers: equip, dismantle, vendors and the rest |
| `activity/` | the Activity Host and the mission script runtime |
| `gameplay/` | the gameplay UDP endpoint and its peer protocol |
| `runtime/` | the server thread and its service slice |
| `studio/` | the command side of the [Sunrise Studio link](#the-sunrise-studio-link): mod script and package reloads, tag patches, Reload bubble |
| `ui/` | the Activity Host menu page and its World and Packets windows |

See [The Activity Host](/docs/sunrise/activity-host/) and [Mission scripting](/docs/mission-scripting/).

### How the layers depend on each other

The main direction is one way: the server uses middleware and state, and everyone uses core.

| layer | uses |
|---|---|
| core | the other layers only in three places: `core/runtime` starts and stops them, `settings/` parses into state types, and the HUD overlays and the Mods page read their status |
| steam | core; it starts the server thread and the client activation |
| client | core, middleware and state; the server only as noted below |
| middleware | core and state |
| state | core, and a few middleware helpers |
| server | core, middleware, state, and the client's request types |

Three links cross the main direction:

- **Middleware and state use each other.** `datagen` reads the account from state to build the
  game's records. State uses a few middleware parts, such as the loadout resolver and SHA-256.
  The mod loader in state hands the mod package files to the middleware package reader.
- **The client reaches the server in two places.** It registers an investment consumer with the BAP
  server at start, and one world-marker renderer reads the current activity link.
- **The server uses client UI code.** The Activity Host windows draw world markers with the client's
  marker code.

Everything else between client and server goes through the request types in
`src/client/network/consumer.h`.

## The files Sunrise writes

Sunrise keeps its files in one folder, `Sunrise`, beside the DLL. For a normal install that is
`bin/x64/Sunrise/`. The path code is in `src/core/filesystem/path.cpp`.

| path | what it holds |
|---|---|
| `settings.json` | the settings; see [Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/) |
| `logs/sunrise.log` | the log, when the file log is on |
| `cache/` | caches built from the installed packages and mod packages |
| `cache/mods/` | merged and configured mod package files; `cache/mods/remap/<mod id>/` holds packages moved to free IDs |
| `data/investment.sqlite3` | the persistent SQLite database |
| `sdk/` | the generated activity SDK, with `sdk/catalog.bin` and `sdk/lua/` |
| `scripts/` | your mission scripts |
| `mods/` | installed mods, one folder each; Sunrise creates the folder |
| `mod_config.json` | the mod config values changed on the Mods page |
| `mod_remaps.json` | the free package IDs Sunrise moved mods to; see [When a package ID is taken](/docs/sunrise/mods/#when-a-package-id-is-taken) |
| `exports/package_keys.bin` | the package keys for Sunrise Studio, when `client.exports.package_keys` is on |
| `exports/tagdefs-raw.<id>.json` | the tag definitions for Sunrise Studio, when `client.exports.tag_definitions` is on |
| `movement.json`, `player.json`, `hud.json`, `world_markers.json` | values saved by the menu pages; see [Values the menu saves](/docs/sunrise/settings-and-logs/#values-the-menu-saves) |

## Startup order

Startup is split in two. `SteamAPI_Init` builds all process state, but installs no game hooks. The
first calls to `SteamAPI_RunCallbacks` then attach to the game.

This is the order in `src/steam/runtime/steam_lifecycle.cpp`, `src/core/runtime/core_runtime.cpp`,
`src/server/runtime/server_runtime.cpp` and `src/steam/runtime/callbacks/callback_dispatch.cpp`,
with logging and error paths left out.

```c
/* SteamAPI_Init -> steam::initialize */
if (running_under_wine) initialize_wine_display();
egress::install();                 /* socket and name-lookup redirect, before anything connects */

core::initialize(module):          /* each step must succeed, or every earlier one is undone */
    settings::initialize();        /* reads Sunrise/settings.json */
    log::initialize();             /* opens the sinks */
    ui::runtime::initialize();     /* menu visibility and toggle key */
    hud::initialize(); logs::initialize(); mods_page::initialize();  /* the three Core pages */
    initialize_content_manifest(): /* outside the game process only the SDK step runs */
        content_manifest::initialize();   /* reads the installed packages */
        mods::initialize();               /* loads and serves the mods; a failure only logs */
        build_data::bind_content();       /* its cache keys on the content, mods included */
        initialize_activity_sdk();        /* keys on the installed packages only */
    investment::store::initialize();  /* opens or creates the save database, then checks it */
    initialize_cheat_session();    /* in-memory save copy for a cheat mod or client.cheats */
    state::initialize();           /* account and build data */
    middleware::initialize();      /* package name catalog, first boot only */
    server::initialize():
        activity::mission::initialize();  /* mission script runtime */
        register_http_consumer(http::consume);
        register_bap_consumer(bap::consume);
        transport::initialize();   /* BAP listener on 127.0.0.1:bap_port; a failure only warns */
        gameplay::initialize();    /* gameplay UDP endpoint; a failure only warns */
        server_ui::initialize();   /* Activity Host page */
    client::initialize();          /* SDK worker setup, saved page values, client pages */

package_trust::install();          /* must attach before the base packages register */
bootflow_texture_override::install();

/* SteamAPI_RunCallbacks -> run_slice, every frame */
activate_graphics_once();          /* presentation, cursor and input hooks */
if (main_activation_pending()) { show_busy_overlay(); return; }  /* one frame to draw it */
main_ok = activate_main_once();    /* scan the game image, install the network and feature hooks */
deliver_queued_steam_callbacks();
if (main_ok) {
    apply_feature_flags_once();
    server::start_service();       /* from here the server has its own thread */
    service_client_workers();      /* investment, SDK generation, scriptables */
}
```

If a step of `core::initialize` fails, the log gets `ev=initialize stage=<step> result=fail`. A
failed mod load is the exception: it logs `ev=initialize stage=mods result=fail`, and the game
starts with no mods. If the image scan fails, the screen shows "Sunrise could not attach to the
game. The boot will not finish."

## Threads

The server never runs on the game's frame. The game can block on a loopback send until the server
answers, so the game must not be the server's clock.

| thread | what runs on it |
|---|---|
| the game thread that calls `SteamAPI_RunCallbacks` | hook activation, Steam callback delivery, and the client content workers' `service` calls |
| the server thread | one service slice every 10 ms: BAP transport, Activity Host, mission scripts, gameplay endpoint |
| the game thread that sends an HTTP request | the SignOn answer, built in place by `server::http::consume` |

The server owns its thread (`src/server/runtime/server_runtime.cpp`). The frame pump calls
`server::start_service` on each frame after the image scan succeeds. The first call starts the
thread. If that fails, the next frame tries again. Server shutdown signals the thread and waits for
the running slice to end. The loop is:

```c
while (WaitForSingleObject(stop_event, 10) == WAIT_TIMEOUT) {
    server::service(GetTickCount64());
}

void server::service(uint64_t now) {
    transport::service(now);           /* accept, read, route frames, write answers */
    activity::host::service(now);
    studio::service(now);              /* the Studio command link; timed with the mission stage */
    activity::mission::service(now);   /* mission scripts and script reloads */
    gameplay::service(now);
}
```

Each stage is timed. A stage over 40 ms logs `ev=core stage=service result=slow step=<stage>`.
Every 2 seconds a debug line reports the worst times of the window.

`SteamAPI_RunCallbacks` wraps its work in a structured exception handler. A fault inside it is
logged on the next call as `ev=core stage=pump result=fault code=0x...`, so one fault does not stop
every later frame.

## How a request reaches the server

The game expects remote servers. Sunrise catches that traffic at two points and answers it in the
same process.

### Sockets and name lookups

The egress hooks in `src/client/hooks/egress/` replace the Winsock connect and send calls and the
name resolvers. Every IPv4 destination keeps its port but gets its address replaced with the
redirect target. The target is `127.0.0.1`, or `client.external_server.host` when the external
server is on. A connect the policy cannot redirect fails with `WSAEACCES`. The game's Demonware
discovery query is answered by the hooks themselves. The guard attaches before Core starts and
never detaches.

### HTTP: SignOn

The game sends HTTP through one shared executor. Sunrise replaces it
(`src/client/hooks/network/http/`). For each request:

```c
if (external_server.enabled) {
    rewrite_url_host(descriptor);      /* send it to the external server */
    return original_executor(descriptor);
}
if (descriptor.operation != POST) return refuse_unmapped(url);
HttpRequest request = { url, content_type, body, response_buffer };
if (!http_consumer(&request, &response)) return refuse_unmapped(url);
publish_completion(response.size, response.status);
return SKIP_NATIVE_OPERATION;          /* the game's own transport never runs */
```

The server's HTTP consumer (`src/server/http/server_http.cpp`) answers one route: a URL that
contains `/SignOn`. The hook refuses any other URL and logs `ev=http stage=route result=unmapped`.
The SignOn answer carries the BAP port from `server.bap_port`.

### BAP

The game then opens a TCP connection for BAP. The egress hook sends it to `127.0.0.1`, where the
server's listener (`src/server/transport/bap_listener.cpp`) waits on the BAP port.

On each server slice the listener:

1. Accepts a waiting connection into a free slot. There are 8 slots.
2. Reads what the socket has.
3. Splits the stream into frames and passes each one to `bap::consume`.
4. Writes the answer back.
5. On a poll tick, asks the session whether it owes a push.

`bap::consume` (`src/server/bap/bap_route.cpp`) takes four events: `open`, `frame`, `poll` and
`close`. A frame is parsed, then routed to the plaintext or the encrypted handler of that
connection's session. Its scratch buffer is wiped after every call.

```c
struct BapRequest {
    BapEvent event;              /* open, frame, poll or close */
    uint32_t connectionId;       /* one per listener slot */
    span<const byte> frame;      /* inbound bytes, for a frame */
    span<byte> response;         /* caller-owned output buffer */
};
```

The listener calls `bap::consume` itself; no hook is involved. The type sits in
`src/client/network/consumer.h` beside the HTTP request types, which the HTTP hook uses to reach
the server. The two other client-to-server links are listed in
[How the layers depend on each other](#how-the-layers-depend-on-each-other).

### Gameplay traffic

In-activity gameplay uses UDP. With `server.gameplay.topology` set to `embedded`, the server binds
its own UDP endpoint (`src/server/gameplay/endpoint/`). The port settings are on
[Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/).

## The Sunrise Studio link

Sunrise Studio talks to a running game through named shared memory, never a socket. Studio creates
each mapping. Sunrise only opens one that already exists, at most once a second. It drops the
mapping when Studio's heartbeat goes stale. The link is off unless `core.studio_attach` is `true`.

| part | code | runs on | does |
|---|---|---|---|
| camera, world, object and animation links | `src/client/diagnostics/studio/` | the game's camera callback | publishes snapshots; reads only |
| CUI link | `src/client/diagnostics/studio/` | the game's UI frame, after the game's own UI update | copies the open CUI screens and one widget tree; reads only |
| command link | `src/server/studio/` | the server thread, right before the mission scripts run; tag requests run on a worker thread | takes one request at a time and answers it once |

The command link takes five kinds of request. Each names one mod. `reload_mod`, `reload_tags` and
`patch_tags` need that mod to have loaded this session.

| request | what Sunrise does |
|---|---|
| `reload_mod` | hands it to the mission runtime, which reloads the scripts of that mod and of the mods that depend on it; the answer comes after every affected mission reaches a safe point |
| `reload_tags` | reloads the packages of every mod and answers for each changed tag |
| `patch_tags` | the same, and also keeps the new numbers of each tag for its next load, or writes them into the copy the game holds |
| `query_resident` | says for each tag whether the game holds it now, with a CRC-32 of its bytes |
| `reload_bubble` | sets a forced destination to the bubble the player is in now |

After a tag request, Sunrise drops the build data the changed tags feed, so it is rebuilt from the
new packages. The answers are in
[Package changes in a running game](/docs/sunrise/mods/#package-changes-in-a-running-game). The
**Reload script** button on the Script page of the World window uses the `reload_mod` path for every
running script. The script reload rules are in [Debugging a script](/docs/mission-scripting/debugging/).

The mapping names, layouts and timings are on [The live link](/docs/sunrise-studio/live-link/).
