---
title: "The build"
date: 2026-09-28
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

The date comes from the build string. The executable's link time is the same day. The package
headers carry eight different content build numbers. The highest one, 86657, is the build itself.

### The depot manifest

Sunrise uses these Steam depot manifests. The installer and the
[install guide](/guides/installing/) download exactly these.

| depot | holds | manifest | manifest date |
|---|---|---|---|
| 1085661 | the shared Windows files | `7180122903232116872` | 2020-09-08 |
| 1085662 | the English language files | `2210332166360342287` | 2020-08-20 |

Each other language has its own depot and manifest. The installer lists them.

This is one of the last manifests before Beyond Light, not the last one. Later updates shipped on
2020-09-22 and in November 2020. The manifest dates come from a public record of Steam manifests.

### What the build does not have

| absent | note |
|---|---|
| BattlEye | anticheat was not yet part of this build |
| PlayFab | adopted years later; this client never uses it |
| crossplay identity services | added later |
| Bungie class RTTI | the only RTTI in the image belongs to Havok, CRI and the C runtime |
| plain-text log strings | every log format string is obfuscated |
| launch switches | the client reads no command line, and no environment variable controls it |
| a bungie.net REST API | all live services are Demonware; see [Network stack](/docs/destiny-2/networking/) |

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

Bungie said in September 2020 that Beyond Light moved mission scripting from the Mission Host to the
Physics Host. Build 86657 comes before that change. A design based on a later build can put mission
logic in the wrong process. See
[The Activity Host protocol](/docs/destiny-2/activity-host-protocol/).

## Differences from Destiny 1

Destiny 1 and Destiny 2 share the Tiger engine. They share the package container family and the
FNV-1 name hash. The Destiny 1 facts below come from two sources: Bungie's GDC 2015 talk on the
Destiny mission architecture, and the shipped Destiny 1 binary.

Treat every Destiny 1 fact as a hypothesis for build 86657. It becomes a fact only when this build
shows it.

### What carries over

| Destiny 1 | status on build 86657 |
|---|---|
| The Activity Host is a light process that runs the mission script | design guide; not verified |
| Clients send Sense data and receive Auth data | verified: message 6 is Sense, client to host; message 5 is Auth, host to client |
| Private missions and public bubbles have separate topology and lifetime | design guide |
| Mission state is small, driven by sensors, and persistent | design guide |
| The Activity Host hands out entity index leases and authority masks; the physics peer owns simulation | the same message family exists by name |
| The client joins the Activity Host first, then waits for entity indices | not verified |

Destiny 1 names an activity-physics join state in its RTTI. That state waits for a physics session
and reconciles peer slots. It runs no physics, AI or combat code. That supports a small physics
host endpoint, not a server-side simulation.

### What does not carry over

- Message ids. The lease messages have different ids in each game.
- Message bodies and bit layouts.
- The 10 Hz rate, memory figures and console host placement from the talk.
- Sensor names, state layouts and trust rules.

| message | Destiny 1 id | build 86657 id |
|---|---:|---:|
| `free_entity_indices` | 20 | 21 |
| `purge_abandoned_entity_slots` | 24 | 25 |
| `advance_replication_epoch` | 42 | 44 |

In 2017 Bungie said Destiny 2 moved the Physics Host from player consoles to its data centers,
beside the Mission Host. That is a second placement change between the two games.

## Open questions

- Whether the package build time of 2020-08-25, two days after the executable, means a later
  content patch shipped with the same executable.
- Whether PS4 build 87221 struct offsets hold beyond the ActivityClient.
- The exact Destiny 1 layouts for the authority mask messages, and whether build 86657 uses the
  same join order.
