---
title: "Static collision internals"
description: "How Studio reads, draws, moves and writes baked Havok collision."
weight: 550
group: "How it works"
---
Static map collision is a baked Havok 2012 compound. It copies each static instance's world transform
and never reads the render rows. Studio decodes it, keeps it in step with static instance edits, moves
parts inside its shapes, and writes new shapes and instances into it. The steps are in
[Edit collision](/docs/sunrise-studio/collision/).

## Reading

The reader follows the client's chain. It walks the map's bubbles and containers to every object list.
An object list row whose payload marker is `0x80808A13` names a collision owner of class `0x80808A15`.
Owner `+0x58` is the compound packfile. Owner `+0x48` lists the child packfiles. Import `iN` is entry N.

Each collision entity gives its placement row, its owner, the decoded compound and its instances. An
instance's world transform is its own transform, then the entity's placement as rotation and
translation only. A child shape is decoded once in its own space and shared by every instance that
uses it. The reader reads through the catalog, so a project overlay shows edited compounds.

A shape is a triangle soup. Its triangles leave out the convex radius. Its bounds include it.

## What is decoded

| content | state |
|---|---|
| packfile sections, class names, fixups, imports | decoded |
| `hkpStaticCompoundShape` instances, flags and tree | decoded |
| `hkpBvCompressedMeshShape` triangles and quads | decoded; a quad is two triangles |
| `hkpBvCompressedMeshShape` custom primitives | decoded: kinds 0 to 4, vertex codecs 0 to 2, radius |
| compressed mesh top tree and section trees | walked |
| `hkpConvexVerticesShape` | vertices; faces built from the plane equations |
| `hkpBoxShape` | decoded |
| `hkpConvexTranslateShape` | its child, moved by `+0x40` |
| `hkpSphereShape` | triangles of radius `+0x20` |
| `hkpCapsuleShape` | a cylinder from `+0x30` to `+0x40` with a hemisphere at each end |
| inline trigger shapes | box, sphere, cylinder, or a referenced packfile |
| an import whose owner entry is `0xFFFFFFFF` | counted as a missing child |

Spheres and capsules are drawn with 16 segments and 6 rings per hemisphere.

A custom primitive is a small convex piece inside a compressed mesh. Kind 0 is a box that stores 4
corners. The other 4 are derived. Kinds 1 to 3 are convex vertex sets. Kind 4 is a cylinder between
two points, drawn with 16 sides. Its radius is header word 2 when the radius flag is set, else the
mesh's radius. In installed data nearly every custom primitive is kind 1 in codec 1. Codecs 0 and 2
and kind 4 follow the client code. No installed data uses them, so they are unverified.

## The collision layer

For a scene, the loader builds a set of distinct shapes and the placements that point at them with a
world matrix. Each placement keeps its compound tag and instance index.

| scene | collision |
|---|---|
| a map, bubble or mission | static entities and trigger rows in every object list the scene read, and the physics of every placed entity |
| a Havok packfile | its compound, mesh shape, shape array or physics data, at the origin |
| a collision owner | its compound, at the origin |
| an entity `0x80809C0F` | its physics bodies on its bind pose |
| a static model `0x808071A7` | the first placed row, in package ID order, that joins a compound instance |

### Trigger rows

An object list row with payload marker `0x8080929B` is a trigger volume. Payload `+0x18` indexes the
shape array at payload `+0x10`. A tag of `0xFFFFFFFF` uses the class's embedded shape config.
World-aligned boxes and cylinders ignore owner rotation. Other variants keep it. Placement scale is
ignored. An attachment that cannot be resolved uses the object frame and is reported.

### Entity physics

An entity's physics-model config has a template at `+0x10` and a payload at `+0x18`. Payload
`+0x380` is the packfile. Each 144-byte body row at `+0x388` with a nonzero mode places a shape on a
bone of the bind pose, times the entity transform. Each 20-byte phantom row at `+0x398` places a
shape at the entity transform. The initial-state preview resolves the object's authored part,
damage-state and region filters. Disabled bodies hide unless **Inactive bodies** is on or the body is
selected. Later damage, state changes and attachments are not simulated.

### Roles

| role | rule |
|---|---|
| World | a static instance with filter 0 or filter bit 6; a body row with mode bit 0 |
| Hitbox | a body row with mode 2; its region is the FNV-1 hash of a name such as `head` or `weakspot` |
| Trigger | a trigger row, a shape array opened alone, or layer 9 |
| Other | a static instance without filter bit 6, or a phantom off layer 9 |

Filter bits 0 to 4 are the layer. A static instance's filter is instance `+0x38`. Filter 0 leaves the
mesh palette's filter in charge (unverified).

### Drawing and picking

The layer uploads each distinct shape once. Each frame it culls placements by frustum and by a 1.5
pixel screen size, then draws the visible ones with one instanced draw per shape. A pick finds the
nearest drawn triangle along the ray. A collision selection and an object selection exclude each
other. A static placement joins its render rows when the translation matches within 2e-3 per axis
and the relative matrix within 2e-2 per element.

### Updates

The layer remembers every tag it read. After a project change it takes the rewritten tags and applies
them to a copy.

| changed tag | result |
|---|---|
| not read by the layer | nothing |
| an object list with unchanged collision and trigger rows | nothing |
| a root compound packfile | placements move; in-file children decode again |
| a per-mesh packfile | its one shape decodes again |
| anything else | a full reload |

Entity physics, inline triggers, shape arrays and collision joined to a static model reload on any
change they read. A compound update refuses a changed instance count or a changed child. The world
matrix comes from the loader's own code, so an update equals a full reload bit for bit.

## Editing a static instance

An edited static instance runs four rules, in this order.

1. **Bounds.** The row's bounds box moves, and the table's aggregate box grows to hold it.
2. **Occlusion**, in a build only. Each bubble that places the table has two baked occlusion tomes.
   The rule opens the instance's old place in both, so it stops hiding what is behind it. It closes
   the new place only when the tome blocked sight through the old one, since not every mesh is an
   occluder. Doors the game opens and closes keep working. A tome it cannot edit, for example
   when the edit is far too large, stays unchanged, and the build lists a note. This rule is not
   verified in game.
3. **Culling.** The owner record's mode byte, class `0x80806EF4` `+0x20`, is set to 0, and the
   edited bounds row gets a fresh id at `+0x20`. The id is not a bucket id in any id map of the
   package and not another row's id. It comes from a hash of the table tag and row index, so the
   same edits always give the same ids. A package with id maps but no owner record for the table is
   refused. This rule is unverified in game.
4. **Collision.** The compound instances at the row's world transform move with it.

There is no stored link from a render row to a compound instance. The join is transform equality. The
rule composes the installed row with its owner placement, then looks for compound instances in the
same package at that transform:

- translation within 2e-3 on each axis;
- each quaternion component within 1e-3, for q or -q;
- each scale lane within 1e-3, relative above 1.

One object's collision can be several instances, one per child shape. The rule moves all of them. It
refuses the edit when:

- an instance sits at the translation but none matches the rotation and scale;
- another unedited row at the same transform uses the same instances;
- the compound is placed more than once;
- the package holds collision but no placement of the edited table;
- byte deltas changed the compound's layout.

For each moved instance it writes the new translation, quaternion and scale. A component the edit did
not change keeps its bytes. The entity's own placement is not touched, because the client builds no
body when its scale is not 1. The tree is refit, not rebuilt, so the file keeps its size. A leaf moved
far away makes its ancestors large, which costs query speed, not correctness.

A collision instance edit moves one compound instance directly, in compound-local values. Both kinds
of edit patch one compound with one tree refit. When a static instance edit moves the same instance,
the static instance edit wins.

## Importing collision

An import compares the edited export with the collision the project holds. It checks each exported
tag's SHA-256 first, so a stale export is refused.

| change | result |
|---|---|
| a placement's world transform | one collision instance object edit |
| a shape's vertices, same triangles | vertices requantized; the file keeps its size |
| a compressed mesh's triangles | re-encoded; replaces the per-mesh packfile |
| a convex shape's triangles | the hull of its points; replaces the convex packfile |
| a shape that grew past its box | every compound using it gets a refit tree |
| more child shape-key bits | every compound using it gets the new width, or the edit is refused |
| a copy of a placement | another instance of the same child |
| a new mesh or convex object | a new per-mesh packfile, owner rows and an instance |
| a placement left out | kept unchanged, with a note |

A glTF node that shares another node's identity is a copy. The node that keeps the exported name is
the original. A copy with the original's mesh is another instance. A copy with other geometry is a new
shape.

## Editing parts of a shape

A part is one connected piece of a shape, such as one leaf hull of a tree inside a map mesh.
Triangles join into one part when they share a vertex position, within 0.1 mm, or a shape key. Both
halves of a quad and every hull triangle of a custom primitive share a key, so each stays one part.

A part edit is one world transform. Studio carries it into shape space through the frame of each
placement the parts were chosen in and moves the parts' vertices. The result runs as an import with
the same triangles. A mesh keeps its file size. A convex shape keeps it unless its plane count
changes. Every compound whose tree does not enclose the moved shape gets a refit tree. A shape is
shared, so every placement of it changes. One edit is one undo step.

The edit is refused when:

- a chosen placement is a body on a bone;
- the shape is not a compressed mesh or a convex vertices shape;
- one vertex is chosen in two placements that would move it to different points.

**Select connected** joins parts whose triangles come within the gap (0.02 m by default) plus both
convex radii. A convex part also joins a part that has a point inside it. A part inside a concave
mesh with no contact stays apart. The search stops at 50,000 parts.

### Parts in a group

A group stores each part as a key: the entity, its object list row, the compound instance, the
shape, the bone, an ordinal among placements with the same fields, and the part's smallest shape
key. A shape without shape keys stores `0xFFFFFFFF`, the whole shape. A vertex move keeps the shape
keys, so the key finds the part again after an edit. A group transform writes its object edits and
its part moves as one undo step.

## Adding collision

The compound must be a root compound placed in the scene, and exactly one owner in its package must
name it.

- A copy repeats its source instance: the same child, filter, mask and user data, with the new
  transform.
- A new shape becomes a per-mesh packfile in a new project package: the project's collision-only
  package, else the lowest unused new package ID.
- A mesh shape gets one material palette entry per material it uses. Its instance has filter 0.
- A convex shape is the hull of the object's points. Its instance takes the filter of the nearest
  existing face, because a convex instance with filter 0 would have no filter (unverified).
- Each triangle takes the material of the nearest existing triangle, or the chosen material.
- The owner gets the new shape, its material slots and any chosen material tag it lacks.
- A rigid transform with one scale stays the instance transform. Any other transform keeps its
  translation, and the rest is baked into the vertices.

The compound gets the new rows and a new tree over every instance. Installed instances keep their
bytes, index and offset, so edits that name them still apply. The change is one manifest write and one
undo step. A build adds each new packfile to the dependency records that list the compound.

## Writing shapes

The mesh encoder builds a compressed mesh from triangles:

1. A triangle and the next one sharing its `0-2` edge become a quad. A triangle that repeats a vertex
   is dropped.
2. Median splits make sections of at most 128 primitives and 255 vertices.
3. Vertices used by several sections are shared, at 21, 21 and 22 bits over the mesh. So are those of
   a section whose packed step would pass 4 mm. The rest are packed at 11, 11 and 10 bits over the
   section's box.
4. The section trees and the top tree come from median splits. Leaf boxes enclose the decoded
   vertices.
5. One data run covers each range of primitives with the same filter and user data.

The packfile writer uses the layout of the installed files: 16-byte aligned blocks padded with
`0x7F`, arrays after their object in member order. The installed mesh and convex shapes tested
rewrite to the same bytes. The compound and owner writers also give back the installed bytes
unchanged.

Moving vertices keeps every array size, requantizes the vertices, refits both trees and recodes custom
vertices over their new leaf boxes. A moved convex shape rebuilds its box and planes from the hull.
The installed shapes carry extra bevel planes by an unknown rule, so a rebuilt convex shape can
change size.

## Limits

- Removing a collision instance is refused. It would renumber later instances, and edits name
  instances by number.
- An edit of an owner placement does not move collision.
- The encoder writes triangles and quads only. An installed custom primitive re-encodes as its hull.
- The encoder writes no shared vertex pages, so a mesh holds at most 65,536 shared vertices.
- A mesh with user strings is not written.
- Only a shape in its own per-mesh packfile can change. Collision inside a shape array is view only.
- Moving vertices refuses a mesh with a cylinder primitive, and a convex shape that stores
  connectivity.
- A new convex shape needs 4 hull points. A compound whose faces all sit under material maps, or have
  no material, cannot take a new shape.
- An owner holds at most 32,767 material slots. A new mesh uses at most 255 materials and 255
  filters.
- Inline trigger attachments are not resolved.
- Entity physics shows every body row with a mode. The parent mask and the spawn's bone selector are
  not applied.
- A placed entity in a map shows its bind pose. Only the opened entity follows an animation.
- Id maps and owner records are read only from the table's own package.
- Added shapes are unverified in game.
