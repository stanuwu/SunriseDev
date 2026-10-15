---
title: "Edit collision"
description: "Show collision, edit parts of a collision mesh, and move, change and add collision shapes."
weight: 175
group: "Guides"
---
Collision is the invisible geometry that blocks movement, takes weapon hits and detects players.
Studio shows it as a layer, exports it as glTF or OBJ, and imports your edits. You can move
collision instances, move and resize parts inside a shape, change shapes and add new shapes. You
cannot remove collision.

Collision edits are unverified in game.

## Show collision

1. Open a map, a mission or an asset.
2. Open **Layers**.
3. In the Collision row, tick **Box** to see each shape's box, or **Content** to see its triangles.

The first time, Studio loads the collision in the background. The view stays usable.

| control | effect |
|---|---|
| **Collision edges** | adds wire edges |
| **Solid collision** | draws opaque faces that hide what is behind them; triggers stay see-through |
| **Inactive bodies** | shows entity bodies that the initial state disables |
| World, Hitbox, Trigger, Other | show or hide one role |

The colors show the role and the shape:

| color | collision |
|---|---|
| orange | world mesh |
| cyan | world convex shape |
| green | world box |
| pink | world sphere, capsule or cylinder |
| red | hitbox |
| violet | trigger |
| gray | other |

The Layers menu counts the placed, distinct and drawn shapes. Collision follows the bubble, tree,
map and mission filters.

## Inspect collision

1. Tick **Content** in the Collision row.
2. Hover a triangle to see its role, shape kind, triangle count, compound and instance. A hitbox
   names its damage region, such as `Hitbox head`.
3. Click a triangle to select its placement.

When an object and a collision triangle are both under the pointer, the nearer one is selected. With
Content off, a click selects objects only.

The Inspector shows the shape kind, role, initial state, region hash, bone, triangle count, parts,
shape, compound, instance, source, object list row, local transform and world position. For static
collision, **Static instance** lists the render rows at the same transform. **Select** next to a
row selects that object. The **Collision** and **Asset** buttons switch the Inspector between the
collision and the asset.

The **Report** tab's **Collision** section lists the counts, the load time, content with no
triangles, and whether the last change updated in place or reloaded.

## Edit parts of a shape

One baked collision mesh can hold the collision of many objects, such as the leaf hulls of a tree in
a map mesh. A part is one connected piece of a shape. You can move, rotate and scale parts inside
the mesh without Blender.

1. Open a project and the map.
2. Tick **Content** in the Collision row of **Layers**.
3. Click a collision triangle. The Inspector's **Parts** section shows the part under the pointer,
   and the view outlines it.
4. Press **Add picked part**.
5. Click another part and press **Add picked part** again. Repeat for each part.
6. Type **Move**, **Rotate (deg)**, **Scale** and **Pivot**.
7. Press **Apply to parts**.

Rotate is in degrees around X, Y and Z. Scale is one value for all three axes. The pivot starts in
the middle of the chosen parts, so Rotate and Scale keep the parts in place. **Pivot at cursor**
moves it. **Pivot at parts center** puts it back.

The chosen parts can be in several shapes. A click on another part of a shape with chosen parts
keeps them. A click on any other shape starts over. A second click on the picked part clears the
selection and all chosen parts. To drop one part, use **Remove picked part**. **Clear parts**
drops them all.

One Apply is one undo step, however many shapes it changes. After Apply the chosen parts clear and
the values reset. When Apply is refused, the parts and the values stay, and the status bar says why.

Only mesh and convex shapes can take a part edit. A body on a bone, or a box, sphere, capsule or
cylinder, can be chosen, but **Apply to parts** stays off and says why. Every placement of a changed
shape changes too. The Inspector counts them.

## Select connected parts

**Select connected** chooses every part that touches the picked part, or comes nearer than **Gap**.

1. Click a collision triangle.
2. Choose a scope in the list above **Select connected**.
3. Type a **Gap** in meters. The default is 0.02.
4. Press **Select connected**.

The search also grows from the parts you already chose. With no triangle picked, it starts from the
whole shape. The Inspector then says how many parts it found and how long it took. The search
examines at most 50,000 parts and says when it stops there.

| scope | searches |
|---|---|
| **This shape** | the picked shape only |
| **This entity** | every shown shape of the same entity, such as all bodies of a character |
| **Touching shapes** | any shown shape that touches, in any entity |

Each physics body, such as one hitbox, is its own shape. So for a body the scope starts at **This
entity**, and **Select connected** finds the touching bodies of the character. For any other shape
it starts at **This shape**. Studio keeps the scope you pick for each of these two cases.

A map's static collision is one entity, and most of it touches the ground. So **This entity** and
**Touching shapes** on a map can choose almost the whole map, and take a few seconds. The view stays
usable while it searches. A part inside a hollow mesh, with no contact, is not found.

## Add parts to a group

A group keeps a set of chosen parts, so you can choose them again and move them with the group's
objects.

1. Open a project and the map. An asset view cannot add parts to a group.
2. Choose the parts, as above.
3. Open **Add to group** under the chosen parts.
4. Choose a group, or **New group**.

A group holds up to 50,000 collision parts. The parts follow the group when you move, rotate or
scale it. [Move, rotate and scale objects](/docs/sunrise-studio/move-objects/#group-objects)
explains groups.

## Collision in an asset view

Opening a Havok packfile or a collision owner shows its collision at once. An entity shows its
physics bodies on its bones. While its animation plays, the bodies follow the pose. A static model
shows the collision of the first placed row that uses it.

## Export collision

1. Open the map or the asset.
2. Choose **Assets > Export collision...**.
3. Pick a file type and a name.

| type | holds |
|---|---|
| GLB or glTF | one node per placed shape, named by shape, compound and instance; for editing |
| OBJ | the triangles; for viewing only |

## Edit the export in Blender

1. In Blender, import the GLB or glTF.
2. Make your changes. The table below lists what you can do.
3. Export glTF with **Custom Properties** included. Without them, the nodes lose their identity.

| to | do this |
|---|---|
| move a collision instance | move, rotate or scale its object; scale must be equal on all three axes |
| change a shape | edit its mesh; a mesh edit changes every placement of that shape |
| place a shape again | duplicate the object with `Alt+D` or `Shift+D`; do not rename the original |
| add a new shape | add a new mesh object |

A copy whose mesh you then change becomes a new shape. Do not delete objects: removing collision
cannot be imported.

## Import the edits

1. Open a project.
2. Open the same map or asset.
3. Choose **Assets > Import collision...**.
4. Pick the edited GLB or glTF.

The import is one undo step. Undo also removes new shapes. The shown collision updates in place when
only instances or per-mesh shapes changed.

| change | saved as |
|---|---|
| a moved instance | an object edit, one per instance |
| moved vertices of a shape | a byte delta of the shape; the file keeps its size |
| new triangles in a shape | a re-encoded shape, as a byte delta |
| a copied placement | a new instance in the compound |
| a new shape | a new packfile in a new project package, plus a new instance |

An export older than the project's collision is refused. Export again and redo the edit.

## Choose the kind, compound and material of a new shape

A new mesh object reads three optional custom properties.

| property | value | default |
|---|---|---|
| `sunrise_collision_kind` | `Mesh`, or `Convex` for the convex hull of its vertices | `Mesh` |
| `sunrise_collision_compound` | a compound tag in hex, such as `80EDC2D0` | the nearest collision object's compound |
| `sunrise_collision_material` | a material tag in hex from the compound's list | each face takes the nearest existing face's material |

A new shape also copies the collision filter of the nearest existing face. You cannot choose the
filter.

## Edit collision in a bundle

A full asset bundle holds the asset's collision in a child collection named Collision. See
[Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).

- Each placed shape is one wire object, left out of renders.
- Placements of one shape share one mesh.
- Each object carries its identity as custom properties, such as `sunrise_collision_compound`,
  `sunrise_collision_instance` and `sunrise_collision_shape`. Keep them.
- An object whose `sunrise_collision_editable` is 0 has no stored transform. It cannot move or be
  copied.
- The collection lists each compound's material tags in `sunrise_collision_materials`. The
  **Sunrise** sidebar shows them for a selected new object.

The editing rules are the same as above. Import the bundle with
**Assets > Import Blender asset...**.

## Moving an object moves its collision

When you move, rotate or scale a static object, Studio moves its static collision with it. You do
not need to edit the collision separately. See
[Move, rotate and scale objects](/docs/sunrise-studio/move-objects/).

## Limits

Studio refuses:

- Removing a collision instance or object.
- A scale that is not equal on all three axes.
- Different single-user edits of placements that share one native shape.
- A new shape in a compound with no owner, two owners, or inside a shape array.
- A flat convex shape. A convex shape needs 4 hull points.
- A shape edit, by import or by **Apply to parts**, inside a compound or a shape array. Only a
  per-mesh packfile takes shape edits.

[Static collision internals](/docs/sunrise-studio/collision-internals/) has the full rules and the
format.
