---
title: "Client hooks"
date: 2026-09-28
description: "Every hook Sunrise installs in the game client, what it does, and what retires it."
weight: 60
---
A client hook is a change Sunrise makes to the game's code at run time. Sunrise keeps these to a
minimum. The tables below list every hook installed today, taken from the install calls in the code.
A hook that is never installed is not listed.

## The rule

A hook may do four things: redirect traffic, serve the Sunrise tools and menu, draw, or log.

A hook that changes game behavior is a stand-in for server behavior not yet understood. The live
game needed no such hook, so a correct server needs none. When the server behavior lands, the hook
is deleted in the same change.

The Activity Host never reads the client to make up events or state. It works only from the
activity messages.

Every hook finds its target by byte pattern, export name or a probe object, never by a fixed
address. It fails cleanly when the target is missing, and it can detach.

Stand-ins already retired this way:

| hook | replaced by |
|---|---|
| hold the spawn until the fade | the message 5 roster holds the client's own spawn gate |
| fix the solo fireteam check | the matchmaking config carries the fireteam threshold |
| skip the profile setup screens | the account object publishes a completion marker |
| drop an empty queue update | the subscribe answer carries the family snapshot |
| force the join state | the host waits for the client's join |

## Install order

Hooks use Microsoft Detours (`src/client/hooking/detour.cpp`). A group attaches in one transaction:
all or none.

| when | where | what |
|---|---|---|
| DLL load, Steam init | `src/dllmain.cpp`, `src/steam/runtime/steam_lifecycle.cpp` | egress guard, package trust, boot textures |
| Steam networking loads | `src/client/runtime/client_platform_hook_activation.cpp` | two Steam networking hooks |
| first frame | `src/client/runtime/client_hook_activation.cpp` | DXGI, cursor, keys |
| game image scanned | `src/client/runtime/client_hook_activation.cpp` | network group, all game hooks |
| on a trigger | `src/client/hooks/retail_log/`, `src/steam/runtime/callbacks/callback_dispatch.cpp` | two data fixes, one feature flag |

In the tables below, "detour" hooks a game function, "export" hooks a Windows, DXGI or Steam
export, and "data" writes a game value that is restored on detach. A number is how many hooks.

## Transport

| hook | what it does | kind |
|---|---|---|
| egress guard | sockets and DNS: blocks outbound traffic, sends connects to Sunrise | export (31) |
| HTTP executor | answers HTTP in process; unserved requests get 503 | detour |
| transport kind | uses direct sockets instead of the Steam relay | detour |
| Steam certificate | reports a local certificate as valid | export (2) |
| content config | answers the content manifest request; skips its signature check | detour (2), data |
| config URL and token | supply the values the content fetch asks for | detour (2) |
| external server | external-server mode only: sends HTTP to that server | detour |

The egress guard never detaches. The certificate and manifest hooks stay until Sunrise can sign
these itself.

## Tools and menu

Most of these attach at start, so a tool can be turned on without a restart.

| hook | what it does | kind |
|---|---|---|
| game windows | take mouse and keys while the menu is open | window subclass (2) |
| `SetCursorPos`, `ClipCursor` | free the pointer while the menu is open | export (2) |
| `GetKeyState`, `GetAsyncKeyState` | hide keys from the game; hold the teleport key | export (2) |
| camera and physics sync | teleport; also ticks fly and sword skate | detour (2) |
| physics step | noclip and fly | detour |
| ammo setters | infinite ammo | detour (3) |
| inactivity timeouts | anti-AFK | data |
| placed-object create, destroy | feed the world-object browser; read only | detour (7) |
| mission launcher | starts an activity through the game's own entry points | call |

## Rendering

| hook | what it does | kind |
|---|---|---|
| `Present`, `ResizeBuffers`, `SetFullscreenState` | draw the menu on the game's swap chain, only when the menu is on | export (3) |
| boot texture dispatcher | swap a few boot-screen textures for ones built into Sunrise | detour |

## Hooks that change game behavior

| hook | what it does | kind | retired by |
|---|---|---|---|
| bubble authority | lets message 5 set authority on every bubble | detour (2) | nothing yet; no server field reaches the gate |
| package trust | loads installed packages the trust check refuses | detour, patch (2) | unknown; the refusal is not understood |
| async I/O guard | stops a native reload from racing a teardown | patch | a fix for the native race |
| lore books | clears display gates on lore books; on by default | data | a data fix for the gates |
| Arrivals leg mods | moves four leg mods into the leg plug set; off by default | data | removal; retail had the same gap |
| ownerless channel | sets one client feature flag; off by default | call | server behavior that keeps the channel owned |

## Diagnostics

These only read and log, except the assert handler.

| hook | what it logs | kind |
|---|---|---|
| retail log | the game's own log, into the Sunrise log | detour |
| assert handler | the assert; the game keeps running unless the device was lost | handler swap |
| hitch watchdog | the watchdog snapshot and the stuck thread's stack | detour |
| stall watcher | every thread's stack when the frame pump stops | thread |
| cinematic readiness | the readiness stages of boot cinematics | detour (16) |
| lifetime gate | the spawn gate inputs and each message 5 roster apply | detour (2) |
| network tick | one byte of the network guard, each frame | call |
| entity create, purge, policy | entity ids and purge masks; 3 of the 7 object hooks above | detour |

## Related pages

- [How Sunrise is built](/docs/sunrise/architecture/)
- [From launch to orbit](/docs/sunrise/boot-and-sign-in/)
- [The Activity Host](/docs/sunrise/activity-host/)
