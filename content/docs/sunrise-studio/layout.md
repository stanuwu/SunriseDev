---
title: "Arrange the layout"
description: "Split, resize, swap, maximize and pop out editor areas, and reset the layout."
weight: 100
group: "Guides"
---
The layout is the set of areas in the window and the editor each one shows. Studio saves it, with
the pop-out windows, in its local settings, not in a project.
[The interface](/docs/sunrise-studio/interface/#areas-and-editors) lists the editors.

## Change what an area shows

1. Open the list in the area's header.
2. Choose an editor.

If another area already shows that editor, the two areas swap. If the editor is in its own window,
it comes back into this area.

## Split an area

1. Press **...** in the area's header.
2. Choose **Split left / right** or **Split top / bottom**.
3. In the new area's header list, choose an editor.

The new area starts empty and shows **Choose editor**.

## Resize areas

1. Drag the border between two areas.

## Maximize an area

1. Press **...** in the area's header.
2. Choose **Maximize area**.

To go back, choose **Restore areas** in the same menu, or **View > Restore areas**.

## Close an area

1. Press **...** in the area's header.
2. Choose **Close area**.

## Pop out an editor into its own window

1. Press **...** in the area's header.
2. Choose **Pop out window**.
3. Drag the new window by its top row to where you want it, for example to another monitor.

The area closes. If it was the only area, it stays and shows **Choose editor**.

The window's top row shows the editor name, **Pop in** and the window buttons.
[The interface](/docs/sunrise-studio/interface/#window-frame) describes the frame. Menu and view
shortcuts work in the window while it has focus.

A command that shows an editor, such as **View > Mission Graph**, uses its window instead of docking
a second copy. A minimized window is restored. **View > Panels** also brings the window to the
front.

On the next start, each popped-out editor opens in its own window again, at the same place. A window
whose place is on no screen opens centered instead.

## Put a popped-out editor back

1. In the editor's window, press **Pop in**, or close the window.

The editor takes an empty area, or splits the largest area. To put it into a particular area, choose
it in that area's header list instead.

## Reopen a closed editor

1. Choose **View > Panels**.
2. Choose the editor.

A check mark shows each editor that is open, in an area or in its own window.

## Reset the layout

1. Choose **View > Reset layout**.

The areas go back to the default layout, and every popped-out window closes. The Scene tab's object
tree panel shows again at its default width.

## Limits

- An editor shows in one place at a time.
- A window holds at most 16 areas.
- An area must be at least 280 pixels wide to split left and right, and 220 pixels tall to split top
  and bottom, at 100% display scale.
- The last area cannot close.
