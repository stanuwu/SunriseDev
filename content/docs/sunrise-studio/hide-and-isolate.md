---
title: "Hide and isolate objects"
description: "Hide objects and branches of the object tree, isolate a selection, and show everything again."
weight: 120
group: "Guides"
---
Hiding changes only the view. It is not a project edit and it is not saved into packages. Hide
choices survive a reload of the same map or asset. Opening another map clears them. With no map
open, opening another asset clears them.

## Hide an object and its children

1. Find the object in the Object tree. **Find object** filters the tree.
2. Press the eye icon at the right of its row.

The object and everything under it disappear from the view. Rows of hidden objects are dimmed.
A child keeps its own hide choice when its parent is hidden and shown again. A child under a hidden
parent shows **Hidden by parent**. Hiding the selected object clears the selection.

The Asset browser's **Hierarchy** tab shows the same tree, with the same eye icons.

## Hide the selected object with a key

1. Set a key for **Hide selected object** in **Edit > Shortcuts...**, section 3D.
2. Select an object.
3. Keep the pointer over the 3D view and press the key.

The Sunrise Studio preset leaves this action unbound.
[Shortcuts and presets](/docs/sunrise-studio/shortcuts/) lists the keys of the other presets.

## Show everything again

1. Press the **Show all objects** icon above the Object tree.

A key for **Show all objects** can also be set in the shortcuts. Selecting a hidden object's row
shows its ancestors again.

## Isolate the selection

Isolation hides everything except the selected object.

1. Select an object.
2. In the Inspector, press the **Isolate selection** icon.

To end isolation, press **Show all** in the Scene tab's filter row, or the **Show all objects** icon
in the Inspector.

## Show or hide the object tree

1. In the Scene tab, press the **Object tree** icon.

Drag the divider between the tree and the view to resize the tree. Double-click the divider to reset
its width. A key for **Show or hide the object tree** can also be set in the shortcuts.

## Hide by bubble, layer or kind

| to hide | use |
|---|---|
| a bubble | **Bubbles** in the Scene tab, or **Visible** in the Mission tab |
| everything but one bubble | **Only this bubble** in the Mission tab |
| the map or the mission | the **Map** and **Mission** checkboxes |
| a kind of content | **Layers**, Box and Content columns |
| collision of one role | the World, Hitbox, Trigger and Other checkboxes under **Layers** |

[Open a map or mission](/docs/sunrise-studio/open-maps/) has the steps for bubbles and layers.
