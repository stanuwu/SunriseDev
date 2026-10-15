---
title: "The build"
date: 2026-10-15
description: "The Destiny 2 build Sunrise targets, its reference build, and how it differs from newer builds and Destiny 1."
weight: 5
---
Sunrise targets one build: the Steam PC client, build 86657, stamped 2020-08-23. Every fact in
these pages is about that build unless the page says otherwise. Other builds are used for names and
cross-checks only.

## Build 86657

| property | value |
|---|---|
| build number | 86657 |
| build string | `86657.20.08.23.1800.d2_rc___release` |
| build date | 2020-08-23, 18:00 |
| branch | `d2_rc` |
| configuration | `tiger_final`, game type `tiger_release_final` |
| base content version | `86657-2-6791813` |
| content revision / content build | 19492 / 84840 |
| newest package build time | 2020-08-25 |
| package format version | 38 |
| season | Season of Arrivals, in the Shadowkeep era, the last season before Beyond Light |
| distribution | Steam, app 1085660, content depot 1085661 |
| platform | PC, 64-bit Windows, Direct3D 11 |
| copyright string | (C) 2020 Bungie |

The executable's link time is the same day as the build date. The package
headers carry eight different content build numbers. The highest one, 86657, is the build itself.

### The depot manifest

Sunrise uses these Steam depot manifests. The
[Sunrise Launcher](https://github.com/stanuwu/SunriseLauncher) and the
[install guide](/guides/installing/) download exactly these.

| depot | holds | manifest | manifest date |
|---|---|---|---|
| 1085661 | the shared Windows files | `7180122903232116872` | 2020-09-08 |
| 1085662 | the English language files | `2210332166360342287` | 2020-08-20 |

An install needs the shared depot and one language depot. The other languages are depots 1085663
to 1085674, one each. The launcher pins a manifest for each and installs the language you pick.

This is one of the last manifests before Beyond Light, not the last one. Later updates shipped on
2020-09-22 and in November 2020.

### What the build does not have

| absent | note |
|---|---|
| BattlEye | this build has no anticheat |
| PlayFab | this client does not use it |
| crossplay identity services | not in this build |
| Bungie class RTTI | the only RTTI in the image belongs to Havok, CRI and the C runtime |
| plain-text log strings | every log format string is obfuscated |
| launch switches | no command-line switch is read, and no environment variable controls the client |
| a bungie.net REST API | all live services are Demonware; see [Network stack](/docs/destiny-2/networking/) |

### The executable is packed

The installed `destiny2.exe` is protected with VMProtect. Its main code section and its read-only
data are encrypted on disk, so no string, table or constant can be read from the installed file.
The image decrypts itself in TLS callbacks before the entry point runs. Once the game reaches the
title screen, the main code section is fully decrypted in memory. A second code section holds the
VMProtect virtual machine and stays partly encrypted, decrypted block by block.

Most functions are only mutated: scrambled into small islands joined by jumps, which confuses
function bounds and cross-references but not the code itself. A few are virtualized. Many singleton
pointers are stored encrypted and decoded inline by their getters. Some functions begin with an
integrity check that runs and then returns into the plain body.

### Engine globals

The engine allocates its long-lived state in named blocks through one function. Build 86657 has 315
such call sites. The names are obfuscated with a per-string rolling XOR, and 309 of them decode.
They include the world controller's managers (`world controller state manager`,
`world controller slice set manager`, `world controller matchmaking manager` and others) and the
network blocks (`network simulation globals`, `bap connection manager globals`). Fourteen names are
not in the 2017 beta. Among them are `Steam QoS globals`, `gambit slicer globals` and
`player melee finisher registry handle`. All of them fit a 2020 Steam build.

## The naming donor: PS4 build 87221

One other Destiny 2 build is used as a reference. It is not a target. An address, a structure
offset or a vtable slot number never carries from one build to another without a check.

Build 87221 is 564 builds and 18 days newer than build 86657. Its build string is
`87221.20.09.10.1506.d2_live`. It carries full RTTI for 3,060 classes, and its log strings can be
decoded as plain text.

Four measures place it in the same protocol generation as build 86657:

| measure | 87221 | 86657 |
|---|---|---|
| wire class ids (`0x8080xxxx`) | all 500 | 500 |
| Demonware source tree | `D2_12` | `D2_12` |
| bdLobby service ids | the same 71 | 71 |
| activity message ids | the same 59 names on the same ids | 59 |

Its content fits the same point in time. It has season pass and seasonal artifact strings and no
Beyond Light Stasis string.

What transfers:

- Class names. Build 86657 has no Bungie RTTI, so class names come from here.
- 1,917 log lines are identical to those in build 86657, character for character.
- Struct offsets on the ActivityClient. Seven offsets were checked and all seven match. Only that
  one class was checked.

What does not transfer:

- Addresses, vtable slot numbers and class sizes. The PS4 compiler emits two destructor slots where
  the PC compiler emits one, so slot numbers shift.
- Field names. Neither build carries any.

## Differences from newer builds

### Content

- The Destiny Content Vault later removed much of the 2020 content from the live game. The build
  86657 install still holds it.
- Beyond Light is a hard engine break. Package format details, tag class hashes, struct offsets and
  enum values all changed after it. A package reader needs a separate pre-Beyond Light path for this
  build. See [Packages](/docs/destiny-2/packages/).

### Where mission scripts run

Bungie describes Beyond Light as moving mission scripting from the Mission Host to the Physics
Host. Build 86657 comes before that change. A design based on a later build can put mission logic
in the wrong process. See [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/).

## Differences from Destiny 1

Destiny 1 and Destiny 2 share the Tiger engine. They share the package container family and the
FNV-1 name hash.

Treat every Destiny 1 fact as a hypothesis for build 86657. It becomes a fact only when this build
shows it. The Destiny 1 design is on
[The Activity Host, Destiny 1](/docs/destiny-1/activity-host/#bungies-design), and its
activity-physics join state under
[Joining an activity](/docs/destiny-1/activity-host/#joining-an-activity).

### What carries over

| Destiny 1 | status on build 86657 |
|---|---|
| The Activity Host is a light process that runs the mission script | unverified |
| Clients send Sense data and receive Auth data | verified: message 6 is Sense, client to host; message 5 is Auth, host to client |
| Private missions and public bubbles have separate topology and lifetime | unverified |
| Mission state is small, driven by sensors, and persistent | unverified |
| The Activity Host hands out entity index leases and authority masks; the physics peer owns simulation | the same message family exists by name |
| The client joins the Activity Host first, then waits for entity indices | verified: the client's activity slot is ready only after `join_result`, then `entity_slots_allocated` |

### What does not carry over

- Message ids. The lease messages have different ids in each game.
- Message bodies and bit layouts.
- Destiny 1's 10 Hz rate, memory figures and console host placement.
- Sensor names, state layouts and trust rules.

| message | Destiny 1 id | build 86657 id |
|---|---:|---:|
| `free_entity_indices` | 20 | 21 |
| `purge_abandoned_entity_slots` | 24 | 25 |
| `advance_replication_epoch` | 42 | 44 |

Destiny 2 runs the Physics Host in Bungie's data centers, beside the Mission Host.

## Open questions

- Whether the package build time of 2020-08-25, two days after the executable, means a later
  content patch shipped with the same executable.
- Whether PS4 build 87221 struct offsets hold beyond the ActivityClient.
- The exact Destiny 1 layouts for the authority mask messages.
