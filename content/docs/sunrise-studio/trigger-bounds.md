---
title: "Edit trigger bounds"
description: "Resize a mission trigger volume by changing its minimum and maximum corners."
weight: 130
group: "Guides"
---
A trigger volume is a shape in a mission that detects when a player enters it. Its authored hull is
a flat outline raised to a height. Its bounds are a box around that hull. Studio edits the box only.
The hull stays as authored.

## Before you start

- Open a project.
- Open the mission. See [Open a map or mission](/docs/sunrise-studio/open-maps/#open-a-mission).

## Show the trigger volumes

1. In the Scene tab, open **Layers**.
2. Tick **Box** and **Content** in the Volumes row.

## Change the bounds

1. Click the trigger volume in the view, or its row in the **Mission** tab.
2. In the Inspector, find the **World placement** group.
3. Type the new lower corner in **Minimum**, in world meters.
4. Type the new upper corner in **Maximum**.
5. Press **Apply bounds**.

The volume updates in place. The Changes tab gets one Object row for it.

## Undo or revert

- **Edit > Undo** or `Ctrl+Z` undoes the last Apply.
- **Revert object** in the Inspector removes the edit from the object.

## Limits

- The box must hold the whole hull, up to its top. Apply refuses a smaller box.
- Each value of **Minimum** must be at most the same value of **Maximum**.
- The hull itself cannot be moved, turned or scaled.
- A trigger whose layout Studio cannot write shows **Placement read only**. Hover it for the reason.
