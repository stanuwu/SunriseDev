---
title: "The live link"
description: "How Studio and a running game share camera, world, object, animation and UI screen data, and the command link."
weight: 610
group: "How it works"
---
The live link connects Studio to a running game through local shared memory. It has no network
listener, starts no game thread and writes nothing into game memory. It adds no Activity Host inputs.
[Connect to a running game](/docs/sunrise-studio/live/) covers the steps.

## How it attaches

The game side is off by default. `core.studio_attach` turns it on. See
[Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/). Only a program in the same
Windows session on the same machine can open the mappings.

**Attach** creates the camera and world mappings. Studio creates the others when it first needs them.
The game only opens a mapping that already exists. The game's existing camera callback publishes into
them while Studio keeps a fresh heartbeat. The CUI mapping is the exception: a hook on the UI frame
publishes it. See [CUI](#cui).
**Detach** releases them. The animation hook and the UI frame hook are installed whenever
`studio_attach` is on. They do nothing until Studio opens their mapping.

| mapping | carries | version |
|---|---|---|
| `Local\SunriseStudio.Live.<pid>` | the camera frame | 1 |
| `Local\SunriseStudio.World.<pid>` | world and object rows | 4 |
| `Local\SunriseStudio.Pose.<pid>` | animation | 5 |
| `Local\SunriseStudio.Object.<pid>` | the selected object | 1 |
| `Local\SunriseStudio.Cui.<pid>` | open CUI screens, one widget tree, one widget record | 1 |
| `Local\SunriseStudio.Command.<pid>` | commands | 1 |

Studio reports a missing or mismatched bridge with an update and restart note and ignores its data.

## What the game sends

| surface | data | when |
|---|---|---|
| camera | position, forward and up, horizontal field of view, aspect | every camera callback |
| player | physics position and the controlled handle | every camera callback |
| world | loaded map root and definition, active scenario, activity package name | every 500 ms, or at once on entering or leaving the world |
| bubbles | resident and current slice identities | every 500 ms |
| object rows | identity, handle and generation, class, position, rotation, scale, raw flags, the placed-not-hidden bit | a scan at most every 50 ms |
| animation | world-space skinning palettes of the owners Studio asks for | at most every 50 ms, while on |
| selected object | parent, root, attached objects, drawn models, raw datum bytes | once per request |
| CUI screens | the open screens of both layers, in list order, and each layer's top screen | at most every 100 ms, only when they change |
| CUI tree | the widgets of the screen Studio watches | at most every 100 ms, only when they change |
| CUI widget | one widget's record | once per request |

A placement scan yields after half a millisecond of each game frame. Each row carries its own read
time. World changes invalidate unfinished scans and earlier placement data.

## Placed and not hidden

The game side has one test, `is_placed_and_not_hidden`. Its result is a bit on each object row. Studio
draws a full model only for rows with the bit set. Other rows are markers. The test reads the datum
flags at `+4` of the object and of every ancestor up to its root.

| condition | datum flags |
|---|---|
| built | flags 1 and 2 of the object are clear |
| placed in the world | the root has `0x20`: it is linked into spatial cells |
| not hidden | the object lacks `0x800`, and no datum up the chain has `0x400`, `0x80` or 4 |

Rows are filtered before the test.

| case | effect |
|---|---|
| handle, generation or placement have changed | left out and counted as excluded |
| flag 4 (destroyed) on the object | left out and counted as excluded |
| the parent chain cannot be read | the bit is unknown; the row is treated as placed |
| flag 1 (not yet built) | the position is refused, so the marker has no position |

The test says nothing about active or visible. No per-object active bit is known. Visibility is a
property of each render object, not of the datum. A root with no spatial record never gets `0x20`.
Whether such an object is ever drawn is unverified.

## Placements

A mission scene can hold the same placement once per state. Copies with the same list, entry and
placement identity are one game object, and one live row moves all of them. A tuple that still has
several candidates is ambiguous and does not move.

**Placements** hides authored placements the game has not spawned, but only from an exhaustive
snapshot: complete, not cut off, and its rows plus its excluded rows equal the registry total. A busy
or cut-off registry hides nothing. A placed row whose bit is clear hides its authored copy and draws
as a marker.

Only objects more than a centimeter from their authored pose move. A moved static mesh draws with the
diagnostic shader, because the game shader path cannot move it. Observed uniform scale replaces the
authored scale. Live transforms never enter exports or project edits.

## Spawned entities

A class prototype loads only for a spawned row whose bit is set. Other rows share one marker prototype
and load nothing. Prototypes load once and share GPU resources. Classes, drawn models and the marker
share a limit of 256 prototypes, and a scene shows at most 2048 pooled instances.

## The selected object

Selecting a live object sends one request with its handle and generation. The game answers once, on its
next camera callback, with one record. Nothing is pushed again. **Refresh** sends a new request.

| field | source |
|---|---|
| identity, class, flags, placed-not-hidden bit | the object's datum at answer time |
| position, rotation, scale | the object's datum at answer time |
| parent handle | the object's datum |
| root handle, root flags, chain flags | the parent chain at answer time |
| attached objects | rows of the last scan whose parent is this object, at most 64 |
| drawn models | draws of this owner in the last animation capture, at most 32 |
| raw datum | the 224 bytes of the datum layout the reader knows |

## Animation

Studio writes an owner filter into the pose control block: one bit per object slot, for the owners it
draws a model for, the player and the selection. The game copies a completed skinning palette only for
owners in that filter. It never calls the animation evaluator. The palette is already in world space
and includes inverse bind transforms.

A part is posed only when its loaded model constants match the captured ones and a matching skinning
shader exists. A draw that stops appearing expires after 250 ms. A capture expires after 500 ms.
A draw holds at most 512 bones. One capture holds at most 1024 draws and 131,072 palette vectors.
Draws match full handles and generations, so a reused slot never inherits an older pose.

## CUI

The CUI link mirrors the game's open UI screens and their widgets. It is read only. It has not run
in a game yet.

| field | value |
|---|---|
| mapping | `Local\SunriseStudio.Cui.<pid>` |
| magic | `0x55435353`, ASCII `SSCU` |
| version | 1 |
| size | 460,736 bytes |
| created by | Studio, on first use |
| opened by | the game |

Studio creates the mapping when the Screens tab, **CUI screen** sync or the CUI page's
**Game state** first needs it. It writes the version, size, its process id and the heartbeat, then
the magic last. The game writes its own version when it connects, and its process id and a ready
flag on every capture. From the mapping it reads only the header, the heartbeat and Studio's
requests.

### Where the game reads

The game reads in a hook on its UI frame function. That function runs the UI update, then builds
the UI draw list. The hook calls it first, then copies. The copy therefore runs on the thread that
just updated the screens and widgets, after the update. The camera callback is not used for CUI.
Which thread runs the frame function is unverified.

Every read is a guarded copy. A fault fails that read only. Walks are bounded: at most 32 screens,
8,192 widget rows, and 16,384 visited nodes. No screen or widget pointer is kept past one frame.

### What Studio asks

| request | target | answer |
|---|---|---|
| watch | hierarchy tag, ordinal | the widget tree of that screen, while the watch holds |
| widget | hierarchy tag, ordinal, node id | one record of that widget |

The ordinal picks among open screens with the same hierarchy tag. 0 is the first. Studio writes the
target, then a new non-zero request id. The game reads the id, the target, then the id again, and
skips a torn read.

### Capture and publish

The game captures at most once every 100 ms.

1. It checks the header and the heartbeat. A heartbeat older than 3 seconds drops the link.
2. It writes `checkedTime`.
3. It walks the open screens. It rewrites the screen section only when its content changed.
4. If Studio watches a screen, it walks that tree. It rewrites the tree section only when the rows,
   the status or the watch id changed.
5. If Studio sent a new widget request id, it answers it once.

`checkedTime` moves on every capture, even when nothing else changes. Studio calls the mirror
**Stale** when `checkedTime` is older than 2 seconds. **Refresh** in the inspector sends a new
widget request id. **Auto** sends one 500 ms after each answer while the link is alive. Nothing is
pushed again for an answered id.

The tree walks every CUI object under the screen. A row flag marks the objects that are widgets.
Only a widget row carries the state word, slots and text hash. Studio never reads a row without the
flag as hidden.

Each section is written between two increments of its own sequence number. Studio copies a section
only when the number is even, new, and the same after the copy. It tries three times. It copies the
tree header first, then only the rows it counts.

A request answers with one status.

| status | meaning |
|---|---|
| complete | the rows or the record are valid |
| absent | no open screen has that tag and ordinal, or no widget has that node id |
| unavailable | the screen manager is not ready, or a read faulted |

### Diagnostics

Studio drops all CUI data while the game's version differs or is missing.

| condition | message |
|---|---|
| the game wrote another version | CUI bridge version differs. Update Sunrise and restart the game. |
| the game wrote no version after 5 seconds | CUI bridge unavailable. Update Sunrise and restart the game. |
| the game's ready flag is clear | The game has not built its screen list yet. |
| a fast re-attach still holds the old mapping | CUI link busy; retrying |

The last two clear by themselves, so the CUI page shows them as **Not ready**, not as **No link**. A
bad widget record marks only that record unavailable. It does not change the link status.

**Detach** sets the heartbeat to 0 and releases the mapping. A minimized Studio stops the heartbeat
too. The game drops the link after 3 seconds and connects again within 1 second of the next
heartbeat. It then republishes the screens, the watched tree and the last widget answer without a
new request.

## Command link

**Update running game** and **Reload bubble** use the command mapping. It does not need Attach, and
it is the one link that changes game state. Studio creates the mapping for one request and releases
it after the reply.

| command | what the game does |
|---|---|
| `reload_mod` | reloads the mod's mission scripts |
| `reload_tags` | loads the mod's new package generations, then answers for each changed tag |
| `patch_tags` | `reload_tags`, then writes the patch ranges into each tag when the client loads it, and poke-safe ranges into the tags it holds now |
| `reload_bubble` | makes the next launch land in the player's current bubble |
| `query_resident` | answers whether the client holds each tag, with the crc32 of its bytes. Studio does not send it yet |

The protocol is version 2. Studio sends `reload_mod` as version 1, so an older game still
answers it.
An older game does not answer the other commands; Studio stops waiting after 10 seconds.

### reload_mod

The game prepares replacements for the started, bound mission
programs owned by that mod or by mods that depend on it. The game answers once, after the mission
reaches a safe point. Studio waits up to 30 seconds.

- New source, loaded modules and `on_load` effects stay private until the whole batch commits.
- A preparation or commit failure returns an error and keeps the old programs running.
- An unbound or not yet started mission needs an activity restart.
- A disconnect or timeout cancels a pending request. A publication that has started cannot be undone.

The mapping is 320 bytes, magic `0x4D435353`, ASCII `SSCM`. Studio creates it as new, so a second
editor cannot replace a running request. If the game still holds the last mapping, Studio retries for
3 seconds. The game answers with one status.

| status | Studio shows |
|---|---|
| ok | how many running missions reloaded |
| invalid | the game refused the request |
| disabled | mission scripting is off in the game |
| not loaded | the mod did not load in this game session |
| compile error | a script did not compile; the old program keeps running |
| failed | the game could not reload the mod |

### reload_tags

The tag list goes in a second mapping, `Local\SunriseStudio.Manifest.<editor pid>.<request>`.
Studio creates it before it writes the request and keeps it until the reply. It holds up to
65,535 tags and 16 MiB.

```c
struct ManifestHeader {      // 64 bytes
    uint32_t magic;          // 0x464D5353, ASCII "SSMF"
    uint16_t version;        // 1
    uint16_t reserved;
    uint32_t request;        // the command's request id
    uint32_t count;          // tags
    uint32_t generation;     // the mod's live revision
    uint32_t patchBytes;
    uint64_t entriesOffset;  // count Entry rows, 32 bytes each
    uint64_t patchOffset;    // patch ranges, read by patch_tags
    uint64_t resultsOffset;  // count Result rows, 8 bytes each, written by the game
    uint8_t  pad[16];
};
```

The game restages every package of the mod against the installed packages, with the same checks as
at boot. If that fails, every tag is refused and the old data stays. Otherwise it serves the new
generations to its own readers, drops the spawn sets, scenario layouts and vendors the tags feed so
the next read rebuilds them, and writes one result per tag. Studio waits up to 10 seconds.

### patch_tags

A patch entry carries ranges. Each is an offset, a length, the CRC-32 of the bytes it replaces, then
the new bytes padded to 4. The CRC-32 is the IEEE one, reflected, with all-ones start and end.

The game keeps every patch entry until it restarts. Each time the client loads that tag, the game
writes the ranges into it before the tag is read. An entry that is not flagged poke-safe answers
**need Reload bubble**. So does a poke-safe entry whose tag the client does not hold now.

For each entry flagged poke-safe and layout-preserving, the game also finds the copy it holds,
checks the class and every range against that copy, and only then writes. It checks the bytes again
for half a second and writes again if the game moved the copy meanwhile. A tag flagged spawn-time
answers **next spawn**.

| result | Studio shows | meaning |
|---|---|---|
| applied (tier 2) or next spawn (tier 3) | applied, next spawn | the copy holds the new bytes |
| guard mismatch | changed in the game | the copy holds other bytes; nothing was written |
| needs bubble reload | need Reload bubble | the patch is kept and written when the client next loads the tag |
| not resident | not loaded | the client does not hold the tag now; only `query_resident` answers it |
| refused | refused | another class, a range outside the tag, or a write that did not hold |
| needs restart | need a restart | not Sunrise data and not patched; the client loads it only at startup |

The patch at load is tested in a running game, for a moved static. Writing into the copy the client
holds now is unverified in a running game.

## Performance

A new placement snapshot copies only its header and the rows it counts. A snapshot refreshes only
objects whose pose changed. The game reads object memory in place under a fault guard. The CUI
link writes the cost of its last capture to `captureMicros`.
[Viewport performance](/docs/sunrise-studio/performance/#while-a-game-is-attached) has the Studio
frame cap.
