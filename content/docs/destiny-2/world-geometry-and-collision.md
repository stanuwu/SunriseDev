---
title: "World geometry and collision"
date: 2026-11-08
description: "Static map instances, culling, occlusion tomes, level of detail, baked Havok collision, entity physics, hitboxes and the collision filter."
weight: 86
---
A map's static geometry has three separate parts: instance tables the renderer draws, a baked
visibility database that culls them, and a baked Havok compound that collides with them. The three
share no index. They agree because the content tools wrote matching transforms into each.

Class ids are package classes. Havok class names such as `hkpStaticCompoundShape` are the engine's
own, from Havok's reflection in the image. Other names are descriptive.

## Static instances

A map container (class `0x80808A54`) names object lists. An object-list entry can carry a static
instance owner (class `0x80806EF4`), which names an instance table (class `0x8080966D`). The table
names a paired bounds table (class `0x80809671`).

| table and field | element | stride | content |
|---|---|---:|---|
| instance table `+0x40` | `0x808071A3` | 48 | one instance: transform, two LOD scales, ambient-occlusion offset and flag |
| instance table `+0x58` | `0x8080967D` | 4 | renderer resource tags |
| instance table `+0x68` | `0x80807190` | 8 | ranges `{u16 count, u16 first, u16 resource, u16 flags}` |
| instance table `+0x80` | -- | 32 | the table-wide bounding box |
| bounds table `+8` | `0x80809673` | 48 | local min, local max, a 64-bit visibility id at `+0x20` |

The ranges partition the instance rows, and each range selects one resource. The Leviathan map has
31 instance tables and 63,883 instance rows. A drawn mesh's materials must be loaded with it; see
[Static mesh materials](/docs/destiny-2/packages/#static-mesh-materials).

### The instance row

| row offset | type | content |
|---|---|---|
| `+0x00` | float4 | rotation quaternion |
| `+0x10` | float3 | translation |
| `+0x1C` | float | uniform scale |
| `+0x20` | float | multiplier for the resource's first two LOD distances |
| `+0x24` | float | multiplier for the third LOD distance |
| `+0x28` | u32 | ambient-occlusion byte offset |
| `+0x2C` | u8 | ambient-occlusion flag |

The row is in the owner placement's space. The renderer composes the two transforms before building
a matrix:

```text
q_world = q_owner * q_row
t_world = s_owner * rotate(q_owner, t_row) + t_owner
s_world = s_owner * s_row
```

The composed scale applies to the drawn mesh, the fine cull sphere and the LOD distances. A
placement's fourth translation lane is a uniform scale, not a homogeneous W of 1.0: on Leviathan it
is 1.0 on 4,738 of 6,100 placements and other values on the rest.

### Culling

Every instance passes two tests. The coarse test sets a per-instance visibility bit. The fine test
checks the cull sphere and picks the LOD. The fine test can only remove more.

The owner's byte `+0x20` picks how the coarse bit is made:

| owner `+0x20` | mode | coarse bit |
|---:|---|---|
| 1 | table mode | each row's visibility id is looked up in the bubble's id map; the bounds boxes are never read |
| 0 | per-instance mode | one visibility entry per bounds row, using that row's box |

On Leviathan, 26 of 31 owners use table mode. In table mode a row whose id is not a key in the
active id map is never drawn. In per-instance mode the bounds row is in instance-table space: only
the owner placement moves it, so it must already enclose the instance's moved mesh.

Owner byte `+0x21` set skips the coarse bits for the whole table, and makes the table follow
hierarchy hiding. The game's own tables with `+0x20` and `+0x21` both set (1,166 owners) all use an
empty bounds table.

A box moved by a placement must have min at or below max in all four lanes, or it becomes the empty
box and never shows. Both W lanes must be 1.0.

A visibility entry whose id is a key in the current bubble's id map is culled by a baked visibility
database, called the tome here. Its own box is never tested. An entry whose id is not a key is
culled every frame by its own box, against the view frustum and, when one exists, an occlusion
buffer. "The tome format" below has the tome's layout.

The table-wide box gates the whole table in both modes. When that box is culled, no instance of the
table is processed. On Leviathan its id is all ones, which is never a key, so it is culled by its own
box.

So an instance scaled or moved past its baked extent vanishes whenever the old extent is out of
view. To make culling follow a new box, the table must be in per-instance mode and the row must carry
a fresh id: one that is not a key in any id map of any bubble where the table can be current. Moving
a whole table to per-instance mode is limited: per-instance entries share a 4096-entry pool, and the
allocation does not fail safely when it runs out. A fresh id in table mode hides the row instead.
How Sunrise Studio edits an instance is on
[Static collision internals](/docs/sunrise-studio/collision-internals/#editing-a-static-instance).

### The id map

The id map (class `0x80807320`) is placed per bubble. Its key at `+0x50` is the bubble index. The
client activates the map whose key matches the new bubble. It holds two tome tags, a 16,384-bucket
hash table of `{u64 id, u32 slot}`, the map bounds and up to 20 view volumes. On Leviathan one map
holds 6,974 ids over 2,835 tome objects, so several instances share one tome object. The map also
lists the gate ids, in tome 0's gate order.

### The two tomes

An id map names two tomes. They are two bakes of the same map with different settings, and they
serve different readers:

| tome | readers |
|---:|---|
| 0 | instance visibility, the zone-crossing lookup, object cells, high-mip streaming of static geometry |
| 1 | audio spatial connectivity, object cells |

The id map's object indices fit only tome 0.

The visibility query reads only the tome, the camera, the gate bits and an object filter. No instance
box or mesh enters it. So occlusion comes only from the bake: a static instance baked as an occluder
still blocks at its old place after it is moved, scaled or hidden, and blocks nothing at its new
place. When the camera is outside every view volume of the id map, the query runs without occlusion
and the per-box entries are tested against the frustum only.

### Gates

A gate is a tome portal the game opens and closes at run time, such as a door. The visibility state
holds 256 gate bits, all open when a bubble activates. Gate `n` is bit `n`. A gate entry is owned by a
component of class `0x80807023`, whose class messages attach, detach, open and close it. Where its
definition and its open and close callers come from is not traced. Tome 0 on Leviathan has 9 gates.

### The tome format

Every installed tome is an Umbra tome of format 18, written by the Umbra 3.3.6 optimizer. The client
accepts a tome only when its first u16 is 18. It does not check the CRC.

| offset | content |
|---|---|
| `0x00` | `0xD600 << 16 \| 18` |
| `0x04` | CRC-32C of bytes `0x08` to the end |
| `0x08` | total size |
| `0x0C` | LOD base distance |
| `0x14`, `0x20` | tile-tree box |
| `0x40`, `0x44` | object count, object boxes |
| `0x4C`, `0x50` | user id starts and user ids per object |
| `0x68`, `0x6C` | gate count, user id of each gate |
| `0x7C`, `0x80` | cluster count, clusters |
| `0x90` | tile count |
| `0x98` | slot paths |
| `0xA0` | tile table |
| `0xBC` | the computation string, 128 bytes |

The header is 0x140 bytes. Pointers are u32 offsets from the start of the tome, or of the tile in a
tile header; 0 means absent. Every block is 16-byte aligned. A tile tree and per-tile view trees
are implicit breadth-first KD trees with 2-bit node codes. Tiles hold cells, portals and BSP nodes.

An edit must keep these runtime rules:

- A point lookup returns the cluster, not the cell. The game keeps per-cluster tables, so an edit
  must not renumber clusters.
- Gate order is run-time state. An edit must not add, drop or reorder gates.
- A camera sees every portal of its own cell, so nothing inside one cell occludes. A new occluder
  blocks only once its cell is split with no portal across it.
- The inside of an occluder can be a cell. What blocks is the missing portal between the cells on
  either side.
- Portals are not checked against cell boxes.
- The query rasterizes portals into a coarse buffer. The line-segment query does not, so it can read
  clear where the camera query hides an object.

### Level of detail

Each frame the client turns the camera distance of every static instance into one LOD value from 0
to 12. The value is the sum of three ramps, each starting at a switch distance:

```text
d  = distance from the camera to the instance's sphere centre
D0 = t0 * 16;  D1 = t1 * 30;  D2 = t2 * 200        /* default view scales */
b  = (d - D1) * 2
A  = clamp(max((d - D0) * 2, b + 4), 0, 4)
B  = clamp(b, 0, 4)
C  = clamp(min((d - D2) * 0.5, b - 4), 0, 4)
value = round_half_even(A + B + C)
```

The sizes come from the mesh header and the instance row:

```text
s  = s_owner * s_row
t0 = max(1, s * mesh[0x38] * row[0x20])
t1 = max(1, s * mesh[0x3C] * row[0x20])
t2 = max(1, s * mesh[0x40] * row[0x24])
```

A value of 12 is the far cull, a little past D2. The value maps to a level: 0 and 1 are level 0, 2
to 5 level 1, and 6 to 11 level 2. Level 3 never draws in the live batched path. A part's LOD
category (part row byte `+10`, bits 0 to 4) says which levels it draws at:

| category | levels |
|---:|---|
| 0, 10 | 0 |
| 1 | 0, 1 |
| 2 | 0, 1, 2 |
| 3 | 0 to 3 |
| 4 | 1 |
| 5 | 1, 2 |
| 6 | 1, 2, 3 |
| 7 | 2 |
| 8 | 2, 3 |
| 9 | 3 |

`generate_gbuffer` and `depth_prepass` crossfade between levels with a stencil dither. Every other
stage switches hard. Shadows use the main camera's value. There is no hysteresis. `depth_prepass`
also skips an instance whose radius is below 0.2 times its distance.

The `environment_detail` setting multiplies the three view scales by 0.8, 1.0 or 2.0. The factor is
applied twice, so the effect is 0.64, 1 or 4; the default is 1. That the multiplier reads this
setting is assumed. A field of view narrower than about 67 degrees raises the scales further. Two
view types keep every instance at level 0 and never distance-cull it.

Collision for static content does not read the instance rows. Each map area has a collision entity
whose Havok 2012 packfile holds one `hkpStaticCompoundShape`. Each compound instance repeats a render
instance's world transform, scale included, and points to a per-mesh shape in another packfile.
There is no stored index between the two. On Leviathan, 59,767 of 63,883 render rows have a compound
instance at the same position within `2e-3`.

The collision owner (class `0x80808A15`) holds:

| offset | content |
|---|---|
| `+0x08` | material tags |
| `+0x18` | material-map tags |
| `+0x28` | i16 material slots, each an index into `+0x08` |
| `+0x38` | i16 run starts, one per imported shape |
| `+0x48` | per-mesh shape packfile tags; import `iN` resolves to tag N |
| `+0x58` | the compound packfile tag |

The component (class `0x80808A11`) patches the packfile's imports, builds one fixed rigid body with
the compound as its shape, and adds it to the physics world. It refuses the entity unless its
placement scale is within `1e-4` of 1.0. Nothing bakes or rebuilds the compound at load.

A compound instance keeps its own scale. Flag bits in the low bits of its translation's W lane
record whether the child is convex (1), the transform is not identity (2), any scale lane is not 1
(4), and an odd number of scale lanes are negative (8).

### The packfile

Every Havok packfile in the install is a package entry of type 26, subtype 7. The packfile's user
tag separates the roles:

| user tag | root object | role |
|---:|---|---|
| 0 | `hkpStaticCompoundShape` | map static collision, one per collision entity |
| 0 | `hclClothContainer` | cloth |
| 1 | `hkpBvCompressedMeshShape` | a per-mesh shape |
| 1 | `hkpConvexVerticesShape` | a per-mesh convex shape |
| 2 | `s_hkpShape_array_data` | shape arrays, used by trigger volumes |
| 3 | `s_physics_component_havok_data` | an entity's own physics |

The packfile header carries the magic `57 E0 E0 57 10 C0 C0 10`, file version 9 and contents version
`hk_2012.2.0-r1`. It has three sections, `__classnames__`, `__types__` and `__data__`. Pointers are
zero on disk and filled from local, global and virtual fixup tables, plus an import table for
cross-packfile pointers.

### Compressed meshes

A compressed mesh is split into sections of at most 128 primitives. A primitive is four byte
indices: `DE AD DE AD` is empty, `i1 == i2 == i3` is a custom convex piece, `i2 == i3` is a
triangle, anything else a quad. A vertex is either a packed u32 in 11, 11 and 10 bits over the
section's range, or a shared u64 in 21, 21 and 22 bits over the mesh's range.

Every tree in these shapes codes a child box against its parent box. Per axis, with
`s = (parent.max - parent.min) / 226` and code byte `c`:

```text
child.min = parent.min + (c >> 4)^2  * s
child.max = parent.max - (c & 15)^2  * s
```

### Collision materials

A hit on static collision resolves to a surface material through the owner's arrays: the instance's
user data picks a run, the mesh's per-primitive data picks a slot in the run, and the slot picks a
material tag. Neither array is bounds-checked. A few instances name a material map instead; its slot
comes from a byte grid sampled at the hit's texture coordinate. The hit carries the material as a
tag, not as values.

A material record (class `0x80808BCB`) holds a name hash, a parent material and four floats. Read as
physical units, they fit friction, restitution, density in kg/m3, and a thickness in exact inch
fractions. All four readings are assumed. No reader of the floats is known. An impact
response matches a material by name, then by each parent in turn.

## Entity physics

An entity's collision, ragdoll and hitboxes come from one component (class `0x808092D8`), whose
resource names a user-tag-3 packfile and lists body rows, phantom rows and constraint rows.

A body row names one shape, a bone, an enabled-part bit, a collision layer, a mode, mass, friction,
restitution and a Havok motion type. The mode decides what is built:

| row mode | built |
|---:|---|
| 1 | a rigid body |
| 2 | a query collidable: a hitbox, in the broadphase but not a rigid body |
| 3 | a rigid body that also takes queries |

Every shape sits in its bone's frame. Across 43 NPC physics configs, the rows take these roles. The
roles are assumed from the values:

| mode | layer | motion | role |
|---:|---:|---|---|
| 1 | 13 | character | character stand-in capsules on bone 0 |
| 1 | 15 | dynamic | ragdoll capsules |
| 2 | 13, 23 | keyframed | hitbox hulls; most carry a region name |
| 3 | 7 | fixed | solid parts |

Hitbox region names include `head`, `body`, `gut`, `guts`, `pack`, `l_chest`, `r_chest`,
`l_shoulder` and `r_shoulder`.

### Hit regions and damage parts

A hitbox's region is only a key. The target's damage component (class `0x80804B85`) maps it to a
damage part through a region table, then its ancestors' tables, then a default region. A damage part
row holds an FNV-1 part name, a label list, a material override and a damage scale, default 1.0.

Which part counts as precision is not known. The label table names `precision` as label 9, and
`head` parts carry a head label. Marking a hitbox as precision when its part has a non-empty label
list fits every installed `head` part. That rule is assumed. The precision multiplier itself is a
per-weapon-family constant in script, not a stat.

### Trigger volumes

A trigger volume is a placed shape with an `hkpTriggerVolume` attached. It is never solid
collision. Its filter is layer 9, and it uses one shape from a user-tag-2 shape array. A trigger sits
at its row's rotation and translation. The row scale does not apply.

## The collision filter

Every body carries a 32-bit filter:

| bits | content |
|---|---|
| 0 to 4 | layer |
| 5 | same-layer only |
| 6 | takes part in solid contact |
| 7 | takes part in queries |
| 8, 9 | a 2-bit class, set per player relative to the local player |
| 10 to 21 | collision group, `0xFFF` for none |
| 22 to 29 | layer property flags |

Two bodies meet when their mode bits overlap, their layers meet in a 32 by 32 table, and their 2-bit
classes are both 1 or either is 0. Two bodies in one group never meet. Layer 7, static collision,
does not meet itself.

The 2-bit class is how players pass through each other. In the shipped default mode, players whose
fireteam Activity Host id equals the local player's get class 1 and collide with the local player.
Every other player gets class 2 and does not. The member record's fireteam Activity Host id feeds it.

### Weapon fire

A weapon shot is a projectile ray, not a separate hitscan path. Each projectile segment submits a
ray with filter `0x8C`: layer 12, the query bit, and the shooter's own physics group skipped. Under
the layer table that ray hits static collision of mode 3, hitbox hulls on layers 13 and 23, and
query-only static instances on layer 23. It does not hit character capsules, ragdolls or triggers.
That hitscan weapons are fast projectiles on this path is assumed.

On a hit, the impact handler picks one impact-response row and runs its entries through a 21-case
dispatch: attach, ricochet, detonate, overpenetrate, spawn at the hit, and more. A response row with
a region list matches only hits on those regions.

## Open questions

- Whether the client renders an edited tome correctly. Edited tomes pass the Umbra runtime offline.
- The reader of the four collision material floats.
- The reader of a damage part's label list, which would settle precision.
- How the collision container's zero mask binds to a bubble.
- The filters of beam supers and aim assist, which cast their own queries.
- Where gate definitions come from, and what opens and closes them.
- The coverage of each LOD dither step, and which tags the LOD settings volumes are.

## Related pages

- [Rendering](/docs/destiny-2/rendering/) -- static ambient occlusion and decorators.
- [Actors and AI](/docs/destiny-2/actors-and-ai/) -- the actors these bodies belong to.
- [Edit collision](/docs/sunrise-studio/collision/) and
  [Static collision internals](/docs/sunrise-studio/collision-internals/) -- editing instances and
  collision in Sunrise Studio.
