---
title: "Use the camera"
description: "Orbit, pan and zoom, fly through a map like a player, and jump to a spawn point."
weight: 110
group: "Guides"
---
The 3D view's camera has two modes. Orbit mode turns around a point, like a model viewer. Player
mode moves like a player. The bindings below are the Sunrise Studio preset.
[Shortcuts and presets](/docs/sunrise-studio/shortcuts/) changes them.

## Orbit mode

The orbit center is the 3D cursor: a marker with colored rings and axes. It stays visible through
geometry.

| input | action |
|---|---|
| right mouse button drag, or `Alt` + left mouse button drag | orbit around the cursor |
| middle mouse button drag, or `Shift` + right mouse button drag | pan |
| mouse wheel | zoom |
| `F` or `Numpad .` | frame the selection |

### Frame what you need

1. Click an object.
2. Press `F`, or press the Frame selection icon in the view toolbar.

The Frame all icon fits the whole scene. It leaves out distant backdrop geometry and mission volume
markers.

### Move the orbit center

1. Click an object.
2. Choose **View > Set cursor to selection**, or press the Set cursor to selection icon.

The camera stays where it is. Only the point it turns around moves.

### Hide the cursor marker

1. Press the 3D cursor icon in the view toolbar.

The orbit center stays. Only the marker hides.

## Player mode

Player mode flies through the map at 7 meters per second. It starts where the camera is. There is
no gravity and no collision.

1. In the 3D view's toolbar, press the Player camera icon. It shows a standing figure.
2. Keep the pointer over the view.
3. Move with the keys below.

| input | action |
|---|---|
| `W`, `A`, `S`, `D` | move forward, left, back, right |
| `Shift` | sprint at 1.6 times the speed |
| `Space` | move up |
| `Ctrl` | move down |
| right mouse button drag | look around |
| mouse wheel | change move speed, from 0.125x to 16x |

Movement stays level when the camera looks up or down. The orbit and pan drags both turn the
camera, so `Shift` can sprint during a look. The toolbar shows the speed when it is not 1x.

Press the Player camera icon again to go back to Orbit mode. The camera stays where it is and turns
around a point 10 meters ahead. The Orthographic view icon also leaves Player mode. The
**Toggle player camera** shortcut switches between the modes. It has no default key. Set one in
**Edit > Shortcuts...**, section 3D.

## Teleport to a spawn point

1. Open a map or mission.
2. In the 3D view's toolbar, open **Teleport to spawn**.
3. Choose a spawn point.

The camera switches to Player mode. Its eye moves to 1.7 meters above the spawn and faces the
spawn's direction. **Teleport to spawn** shows only when the scene has spawn points.

## Orthographic view

1. Press the Orthographic view icon in the view toolbar.

Press it again for perspective.

## Hover and select

- Hover an object to see its name.
- Click an object to select it. The outline of the selection stays visible through walls.
- Double-click an object to select it and frame it.
- Click the same object again, or empty space, to deselect.

In a map, a click selects a whole placement. In an asset view, a click selects one mesh part.

A click selects only what you see at that point. These are not clicked, so the object behind them is:

- parts that the distance levels or foliage levels leave out;
- with **Game shaders** on, the back of a surface the game does not draw;
- with **Game shaders** on, see-through parts such as glass, haze, light shafts and decals.

Select them in the [Object tree](/docs/sunrise-studio/interface/#object-tree) instead.

## Camera modes of the live link

When Studio is attached to a running game, the Live tab adds its own camera modes: **Off**,
**First person** and **Player cursor**.
[Connect to a running game](/docs/sunrise-studio/live/#follow-the-game-camera) covers them. While
the game drives the camera, the Player camera icon and the camera controls are off.
