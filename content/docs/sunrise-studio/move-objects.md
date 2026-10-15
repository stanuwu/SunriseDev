---
title: "Move, rotate and scale objects"
description: "Move, rotate and scale placed objects and groups in a map, then undo or revert the change."
weight: 125
group: "Guides"
---
A placed object in a map or mission can be moved, rotated and scaled, alone or in a group. Studio
saves the change as object edits and moves only the edited objects in the view. Most changes do not
reload the scene. See [When the view reloads](#when-the-view-reloads).

## Before you start

- Open a project. Without one the placement fields are disabled and the Inspector shows
  **Create a project to edit**.
- Open the map or mission. See [Open a map or mission](/docs/sunrise-studio/open-maps/).

## Move, rotate or scale an object

1. Click the object in the 3D view, or its row in the Object tree.
2. In the Inspector, find the placement group. Its title names the coordinate space, for example
   **World placement** or **Local placement**.
3. Type the new values in **Position**, in meters.
4. Type the new values in **Rotation**, in degrees around X, Y and Z.
5. Type the new value in **Scale**. Scale is one number for all three axes.
6. Press **Apply transform**.

The object moves in place. The Changes tab gets one row for it, for example `Tree: scale 3`. The
fields start from the current edited values, so a second Apply on the same object updates its one
row.

Only the fields you changed are saved. A field you left alone keeps its current bytes, so an
unchanged rotation is never re-encoded. An Apply with no change saves nothing.

A SpeedTree tree is one placement too. Its group reads **Payload placement**, and **Scale** resizes
the whole tree.

## Drag with the handles

1. In the 3D view toolbar, pick **Move**, **Rotate** or **Scale**.
2. Select the object. Arrows (Move), rings (Rotate) or square handles (Scale) appear on it, one per
   world axis: X red, Y green, Z blue.
3. Drag a handle. A yellow box shows where the object will go.
4. Release the mouse. Studio saves the drag as one object edit, the same as **Apply transform**.

Rotate turns the object around the world axis of the ring you drag. Scale is uniform, because the
game stores one scale. Every handle scales all three axes. Dragging the center square up or to the
right makes the object bigger. **Select** goes back to plain selection. When an object gets no
handles, hover the tool button for the reason.

## Group objects

A group is a set of objects that are selected and transformed together. The project saves it. The
build ignores it. [How projects store edits](/docs/sunrise-studio/project-storage/#object-groups)
describes how a group is stored.

To make a group:

1. Select an object.
2. In the Object tree, open **Groups** and press **New group from selection**. Or, in the Inspector,
   open **Add to group** and choose **New group**.

Studio names it **Group 1**, **Group 2** and so on. Type another name in the group's Inspector.
The **Groups** list shows only while a map is open in a project.

To add an object, select it and choose the group in **Add to group** in the Inspector. To take it
out, press **Remove from group** in its Inspector, or **x** next to it in the group's Inspector.
Removing the last object removes the group, unless the group holds collision parts.
**Delete group** removes the group only. Its objects and their edits stay.

An object can be in one group only. Only an object that gets handles can join a group, so lights,
trigger volumes and collision instances cannot.

A group can also hold collision parts. Choose them in the collision Inspector, then use **Add to
group** there. See [Edit parts of a shape](/docs/sunrise-studio/collision/#edit-parts-of-a-shape).
In the group's Inspector, **Select collision parts** chooses them again, even after the map
reloads. The group transform moves them with the objects, in the same undo step. The pivot covers
both. Show the **Collision** layer first. Without it Studio refuses the change, so no part is left
behind. **Remove collision parts** takes them out of the group. A part can be in one group only. A
group holds up to 50,000 collision parts.

## Select and transform a group

1. Click the group's row under **Groups**, or press **Select group** in a member's Inspector. Every
   member is selected and outlined in the 3D view.
2. Drag a Move, Rotate or Scale handle.

The handles sit at the group's center: the middle of the box around the members' positions. To type
the change instead, fill **Move by**, **Rotate by** and **Scale by** under **Transform group** in
the group's Inspector, then press **Apply to group**. **Rotate by** is in degrees around X, Y and Z.

Each object moves through its own parent space, so objects with different parents move together. One
drag or one Apply is one undo step for the whole group. The Changes tab gets one row per object.

Scale works in two ways:

- The center square, or the same value on all three axes, scales the whole group. Positions spread
  from the center, and objects that store a scale grow by the same factor. A spawn point stores no
  scale, so only its position moves.
- An axis handle, or different values per axis, spreads positions along that axis only. Every object
  keeps its size, because the game stores one scale per object.

A group change saves every object or none. When one object cannot take the change, nothing is saved
and the status bar names the object. A group gets no handles when one of its objects has none, or
when a static instance and the placement that holds it are both in the group. Objects of the group
that are not in the open map show dimmed in its Inspector and stay where they are.

Turning a spawn point writes a full rotation into its row. Whether the game reads more than the
spawn's heading is unverified.

Group changes are not undo steps: creating, renaming and deleting a group, and changing its members.
Object names work the same way. An older Studio cannot open a project that has groups.

## Name an object

1. Select the object.
2. In the Inspector, type a name in **Name in this project** under the object's title.
3. Click elsewhere. Studio saves the name in the project.

The name replaces the object's label in the Inspector, the Object tree and the 3D view. The original
label stays below it in the Inspector. A placement's parts share one name. Clear the field to remove
the name. Names are labels inside Studio only: the build ignores them, and undo does not cover them.
An older Studio cannot open a project that has names. Tree search still matches the original labels.

## Undo a change

1. Choose **Edit > Undo** or press `Ctrl+Z`.

**Edit > Redo** or `Ctrl+Y` puts it back. The view updates in place both ways.

## Revert an object

1. Select the object.
2. In the Inspector, press **Revert object**.

Or right-click its row in the Changes tab and choose **Revert**. The object returns to its installed
placement.

## What follows the object

Studio rebuilds the values that depend on a placement from the installed data every time it reads or
builds the project:

- the object's bounding box and the bounding box of its table, which the game uses to cull it;
- the static collision that copies the object's transform;
- for a SpeedTree tree, the box of its cell and the box of its payload.

The game culls each static instance by its box, so a stale box would hide a moved or scaled object.
[Static collision internals](/docs/sunrise-studio/collision-internals/#editing-a-static-instance)
explains both rules.

## When the view reloads

A placement-only change moves the object in place. The scene, the loaded meshes and textures, the
camera and the selection stay. This includes the first edit of a static instance that shares its
table with other instances: the build gives it a table of its own, and the view still moves only
that object. A SpeedTree tree moves in place too.

A few placements reload the map instead, such as a reflection probe, a placement that anchors a
squad, or one that owns terrain or water. The reload keeps the editor in view and shows its
progress in the status bar. [Viewport performance](/docs/sunrise-studio/performance/#what-still-reloads)
has the full list.

## How the edit is stored

The project stores the values you set, the row they target and a hash of that row's installed
bytes. [How projects store edits](/docs/sunrise-studio/project-storage/#object-edits) has the
detail.

## Limits

Some placements show **Placement read only**. Hover it for the reason. Studio has not decoded their
layout for writing. **Scale** appears only for placements that store a scale.

Apply can also refuse an edit. The status bar names the reason. A static instance edit is refused
when:

- another unedited object at the same transform shares its collision;
- its collision sits at the same place but at another rotation or scale;
- its collision compound is placed more than once.

A SpeedTree tree edit is refused when its payload shares its instance data with another payload,
because the edit would move both.

Opening the object's source asset still allows the generic property and byte editors.
