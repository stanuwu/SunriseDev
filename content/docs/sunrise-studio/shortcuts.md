---
title: "Shortcuts and presets"
description: "Every shortcut, its binding in each preset, and how to change a binding."
weight: 250
group: "Guides"
---
Studio has five shortcut presets: Sunrise Studio, Blender, Unity, Maya and Unreal. You can change
every binding in the Shortcuts window. The player camera keys are fixed. Shortcuts are saved in your
local settings, not in projects.

## Where a shortcut works

| section | works |
|---|---|
| Menus | anywhere, except while you type in a text field |
| 2D | in textures, CUI canvases and graphs, with the view under the pointer |
| 3D | in scene and asset views, with the view under the pointer |

Studio reads the keyboard and mouse only while one of its windows is active. Shortcuts do nothing
while Studio runs background work. Losing focus or opening the Shortcuts window ends a drag.

## Choose a preset

1. Choose **Edit > Shortcuts...**.
2. Open **Preset** and choose a preset.

Choosing a preset replaces every binding.

## Change a binding

1. Choose **Edit > Shortcuts...**.
2. Open the **Menus**, **2D** or **3D** tab.
3. In the **Binding** or **Second binding** column, click the button of the action.
4. In **Press a shortcut**, press the new key, click or drag. Hold `Ctrl`, `Shift` or `Alt` to
   include them.

`Escape` cancels. **x** next to a binding clears it. **Reset** returns the action to the preset's
binding. A changed action shows in the accent color. Every change saves at once. Press **Close** when
you are done.

## Conflicts

A binding with more modifiers wins over one with fewer. If two actions still match the same input,
neither runs. The window marks the conflict in red and counts it at the top. Hover the binding to see
which action it overlaps.

## Menus

Sunrise Studio is the default preset. The other presets follow their editors. An action with no
common binding in an editor stays unbound in that preset.

| action | Sunrise Studio | Blender | Unity | Maya | Unreal |
|---|---|---|---|---|---|
| New project | Ctrl+N | Ctrl+N | Ctrl+N | Ctrl+N | Ctrl+N |
| Open project | Ctrl+O | Ctrl+O | Ctrl+O | Ctrl+O | Ctrl+O |
| Save project | Ctrl+S | Ctrl+S | Ctrl+S | Ctrl+S | Ctrl+S |
| Undo | Ctrl+Z | Ctrl+Z | Ctrl+Z | Ctrl+Z | Ctrl+Z |
| Redo | Ctrl+Y | Ctrl+Shift+Z | Ctrl+Y | Shift+Z | Ctrl+Y |
| Build packages | Ctrl+Shift+B | unbound | unbound | unbound | unbound |
| Build and install | unbound | unbound | unbound | unbound | unbound |
| Update running game | unbound | unbound | unbound | unbound | unbound |
| Navigate back | Back click or Alt+Left Arrow | Back click | Back click | Back click | Back click |
| Navigate forward | Forward click or Alt+Right Arrow | Forward click | Forward click | Forward click | Forward click |

These creation actions are unbound in every preset: **New texture**, **New static prop**,
**New mission script**, **Clone material**, **Clone weapon**, **Clone armor**, **Clone plug** and
**Open Interface list**. [Create from a category](/docs/sunrise-studio/create-content/#shortcuts)
says what each does.

- Back click and Forward click are the side buttons of the mouse. They work anywhere in the window.
- Navigate back and forward move through the assets, maps, pages and selections you visited.
- While the Mission Graph is active, Save project saves the script.

## 2D

| action | Sunrise Studio | Blender | Unity | Maya | Unreal |
|---|---|---|---|---|---|
| Pan | Middle drag or Right drag | Middle drag | Middle drag | Alt+Middle drag | Right drag |
| Zoom | Wheel | Wheel or Ctrl+Middle drag | Wheel | Alt+Right drag or Wheel | Wheel |
| Frame selection | F or Numpad . | Numpad . | F | F | unbound |
| Frame all | unbound | Home | unbound | A | Home |
| Select; drag to move | Left click | Left click | Left click | Left click | Left click |
| Delete selection | unbound | X or Delete | Delete | Delete | Delete |
| Duplicate selection | unbound | Shift+D | Ctrl+D | Ctrl+D | Ctrl+D |

Delete selection works in CUI canvases and graphs. Duplicate selection works in CUI canvases.

## 3D

| action | Sunrise Studio | Blender | Unity | Maya | Unreal |
|---|---|---|---|---|---|
| Orbit | Right drag or Alt+Left drag | Middle drag | Alt+Left drag | Alt+Left drag | Alt+Left drag |
| Pan | Middle drag or Shift+Right drag | Shift+Middle drag | Middle drag | Alt+Middle drag | Middle drag |
| Zoom | Wheel | Wheel or Ctrl+Middle drag | Wheel or Alt+Right drag | Alt+Right drag or Wheel | Alt+Right drag or Wheel |
| Frame selection | F or Numpad . | Numpad . | F | F | F |
| Frame all | unbound | Home | unbound | A | unbound |
| Select | Left click | Left click | Left click | Left click | Left click |
| Set cursor to selection | unbound | unbound | unbound | unbound | unbound |
| Show or hide the 3D cursor | unbound | unbound | unbound | unbound | unbound |
| Show or hide the object tree | unbound | unbound | unbound | unbound | unbound |
| Hide selected object | unbound | H | unbound | Ctrl+H | H |
| Show all objects | unbound | Alt+H | unbound | unbound | Ctrl+H |
| Toggle player camera | unbound | unbound | unbound | unbound | unbound |

Show or hide the object tree, Hide selected object and Show all objects act on the map's object
tree. In the player camera, the orbit and pan drags look around, the zoom binding sets the speed, and
Frame all does nothing.

## Fixed keys

These inputs cannot be changed.

| input | action |
|---|---|
| W, A, S, D | player camera: move forward, left, back, right |
| Shift | player camera: sprint |
| Space | player camera: move up |
| Ctrl | player camera: move down |
| Escape | cancel **Press a shortcut** |
| right click on a node or link | graphs: open its menu |
| double-click a node | graphs: open it |

The player camera keys work while the pointer is over the view or a look drag is held. They do
nothing while you type in a text field. [Use the camera](/docs/sunrise-studio/camera/#player-mode)
explains the player camera.
