---
title: "How projects store edits"
description: "How a project stores its changes as differences from the installed game."
weight: 510
group: "How it works"
---
A project is a folder with a `sunrise.project.json` manifest. It holds its changes as differences
from the installed game, never as copies of game data. The manifest also holds the optional mod
details.

| content | stored as |
|---|---|
| object edits | values per world object, in the manifest |
| byte deltas | files under `deltas` |
| added assets | files under `assets` |
| config bindings and wide-hash aliases | entries in the manifest |
| object names and object groups | entries in the manifest; the build ignores them |
| mission scripts and helpers | plain Lua under `scripts` |
| own SDK modules | plain Lua under `sdk` |

Installation paths and preferences stay outside the project. The `build` folder and exported working
copies are disposable. Undo history lives in memory for the session only.

## Byte deltas

A byte delta records how an asset's bytes differ from the installed original. It holds source hashes,
copy ranges and XOR masks. It never stores unchanged byte ranges or an extracted original.

Property edits, byte edits, imports, and material and texture edits save byte deltas. Insertions,
deletions, growth and derived copies all rebuild against the matching original. If the installed
original's hash differs, Studio cannot rebuild the asset, and the build stops.

## Object edits

An object edit records the values set on one world object: position, rotation, scale or trigger
bounds. Rotation is a unit quaternion.

| layout | row |
|---|---|
| `Placement` | a placement row in a placement table |
| `SlotPlacement` | a placement row under a type-4 slot of a config |
| `StaticInstance` | a static instance row |
| `Light` | a light transform row |
| `SpawnPoint` | a spawn row |
| `TriggerVolume` | a trigger volume row; bounds only |
| `CollisionInstance` | an instance in a static collision compound |
| `DecoratorInstance` | a SpeedTree decorator record |

The placement editor saves them. A collision import, a collision part move and a group move save one
for each moved collision instance.

- One object has one entry. A later edit of the same object replaces the values it sets and keeps
  the others.
- A value that was not set keeps its installed bytes.
- Each entry names its source row and the SHA-256 of that row's installed bytes. If the installed row
  changes, Studio refuses to build until the edit is reverted.

## Object groups

A group stores an id, a name and its objects. Each object is stored as the same row reference an
object edit uses: the source tag, layout, offset, length, index, identity and the hash of the
installed row. The row offset alone cannot find some objects again, so the whole reference is kept.
[Move, rotate and scale objects](/docs/sunrise-studio/move-objects/#group-objects) has the steps.

A group can also store collision parts. Each part is stored as one text key: its entity, its list
row, compound instance, shape tag and offset, bone, its place among equal placements, and its
smallest shape key. A part number would change when a shape is edited. The shape key does not.

Moving a group saves an object edit for each object. Its collision parts move as a collision edit
in the same undo step: instance moves become object edits, shape changes become byte deltas.

## How byte deltas and object edits combine

Studio applies byte deltas first, then object edits on top. Where both change the same bytes, the
object edit wins, and the Changes panel lists both. The preview, **Build packages**, **Build and
install** and **Update running game** all use this one result.

A byte delta that would stop an object edit from compiling is refused when it is saved. Revert the
object edit first. A Blender bundle import keeps object edit values out of the byte deltas it saves.

## How object edits compile

The object edit compiler knows the row layouts. The project only checks each target row against its
installed hash.

1. The compiler starts from each tag's byte-delta result.
2. It writes every edit in key order.
3. It runs its rules in a fixed order. A rule gets every edit of its layouts in one call.

Some rules run only in a build, because they are slow. The editor compile skips them, so the viewport
and the Changes panel do not show what they write. The project caches each kind of result for each
saved manifest. The catalog overlay reads the editor result. The build and the mod installer read
the build result.

Values that depend on an edit are rebuilt from the installed original every time, so they never go
stale.

| rule | rebuilds |
|---|---|
| `InstanceBoundsRule` | a static instance's bounds row and its table's aggregate box |
| `OcclusionTomeRule` | the bubble's occlusion tomes; build only |
| `InstanceCullRule` | the culling data |
| `StaticCollisionRule` | the static collision, and moved collision instances |
| `DecoratorInstanceRule` | SpeedTree decorator records, their vertex buffer, and the cell and payload boxes |

A decorator value outside the block's stored range re-quantizes the whole block. A decorator payload
that shares its instance data with another payload is refused, because an edit would move both.
[Static collision internals](/docs/sunrise-studio/collision-internals/#editing-a-static-instance)
has the collision details. The build receipt lists each object edit and the assets it wrote. A rule
that leaves an asset unchanged, such as a tome it cannot edit, adds a note. The build still succeeds;
the build message shows the notes and the receipt keeps them under `objectEditNotes`.

## Added assets

An added asset is stored whole under `assets`, or as a delta of an installed entry when it keeps that
entry's fields. The second kind shows as Derived in the Changes panel.

| kind | in builds |
|---|---|
| Added | yes, as a new native entry |
| Derived | yes, rebuilt from its installed base |
| Source | no; kept for external work |

An import prepares a copy of its input before it saves one asset group. Cancelling before the save
leaves the project unchanged. Undo removes the group. Redo restores the same asset IDs and entry
numbers. A changed project or installed source refuses publication and needs a fresh import.

## Package IDs

New native assets go into new packages. Use an unused package ID from `0100` to `0CFF`. The game
refuses higher IDs. A project saved with a higher ID still opens, but its build is refused. Entries
with the same ID share one package.

A new entry's tag is `0x80800000 + (package << 13) + entry`.

## Manifest versions

Studio writes the lowest manifest version that can store every feature the project uses.

| version | needed for |
|---|---|
| 1 | byte deltas and added assets only |
| 2 | object edits |
| 3 | wide-hash aliases |
| 4 | config bindings |
| 5 | object names (`objectNames`), editor labels the build ignores |
| 6 | object groups (`objectGroups`), editor groups the build ignores |
| 7 | collision parts in object groups (`collisionParts`) |

Removing a feature lowers the version again. An older Studio refuses a newer manifest, so it cannot
silently drop edits. Byte deltas in an older project stay byte deltas until they are converted. See
[Convert placement deltas](/docs/sunrise-studio/convert-deltas/).

## Saving

Changes save on their own. Each save replaces the manifest atomically. Payload edits that belong
together publish together.

## Limits

- An object or a collision part is in one group at most.
- A group holds up to 4096 objects and up to 50,000 collision parts.
- Trigger volumes and collision instances cannot join a group.
- Object and group names are one trimmed line of up to 200 characters.
