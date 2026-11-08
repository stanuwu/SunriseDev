---
title: "Connect to a running game"
description: "Attach Studio to a running game to follow its camera, map, objects, animation and UI screens."
weight: 230
group: "Guides"
---
The Live tab attaches Studio to a Destiny 2 process running from your installation. Studio then shows
what the game has loaded: its camera, map, bubbles, objects, animation and open UI screens. The link
is read only. Studio changes game state only through
[Update running game](/docs/sunrise-studio/build-and-install/#update-a-running-game), which sends
changed scripts and package data. The **Live** checkbox at the top of the tab runs it after each
change, and **Reload bubble** sets the next launch to land where the player is. Both work without
Attach. Both need a project with mod details; without them, they are gray.

The live link is unverified end to end in a running game.
[The live link](/docs/sunrise-studio/live-link/) explains what the game sends and when.

## Before you start

1. Close the game.
2. Open `bin/x64/Sunrise/settings.json` in your installation.
3. Under `core`, set `studio_attach` to `true`.
4. Start the game through Sunrise.

`studio_attach` is off by default. Until you attach, the Live tab shows **Attach needs
studio_attach**. The game also needs a Sunrise build with the matching Studio bridge. A game that is
already running needs a restart to get a newer build.

## Attach

1. Choose **View > Live**, or open the **Live** tab in the Workspace.
2. Choose the game in the process list. **Refresh** looks for it again.
3. Press **Attach**.

The status turns green when the game is in the world. One summary line names the activity, the
loaded bubbles, the player position, the live object count and how many objects are markers. When
the open map matches the game, it also counts the unspawned placements Studio hides.

**Detach** ends the link.

## Follow the game camera

1. Open the **Camera** list in the Live toolbar.
2. Choose a mode.

| mode | camera |
|---|---|
| **Off** | the editor camera, free |
| **First person** | copies the game camera |
| **Player cursor** | starts 5 m behind and 1.5 m above the player, then orbits the player as it moves |

While a mode drives the camera, Frame, Set cursor, their shortcuts and panning are disabled. First
person also disables orbit, zoom and the player camera, and hides the player's own model.

**Snap to player** puts the editor camera 5 m behind and 1.5 m above the player. The camera looks at
the player along the game camera's direction. It is disabled in First person.

## Choose what to sync

1. Press the circular arrow (**Sync**) in the Live toolbar.
2. Tick what you want.

| item | effect |
|---|---|
| **Map** | opens the map and mission the game has loaded, with only its loaded bubbles |
| **Loaded bubbles only** | draws only the bubbles the game has loaded |
| **Placements** | moves placed objects to their game positions and hides those the game has not spawned |
| **Spawned entities** | shows objects spawned at run time |
| **Animation** | copies the pose of each shown object and of the selection |
| **CUI screen** | opens the game's top UI screen in the CUI page; off by default; may be inaccurate |
| **Sync map now** | asks the game for its map again |
| **Sync screen now** | opens the game's top screen again; needs **CUI screen** |

When the loaded bubbles change, Studio waits until they hold for two seconds, then reloads the map
with the new set.

**CUI screen** waits until the top screen holds for half a second, then opens it once. The top
screen is the top active screen of layer 1, else of layer 0. Only a screen that is a hierarchy in
your installed packages opens. The status line says **Screen not in packages** or **Screen open
failed** when it cannot open one. **Sync screen now** tries again. The status line says **No top
active screen** when screens are open but neither layer has a top active screen.

## Watch the game's screens

1. Open the side panel with its icon in the Live toolbar.
2. Open the **Screens** tab.
3. Double-click a screen to open it in the CUI page.

The tab lists the open screens by layer, layer 1 first, each in the game's draw order. The icons
show three raw values: an eye for state bit `0x2`, a warning sign while screen flag `0x10` is set,
and a target on the layer's top active screen. The last two are blank when off. Their meanings are
unverified. Hover a screen for its tags, view, page and priority. Gray screens are not in your
installed packages and do not open.

In the CUI page, **Game state** shows the game's widgets over the open screen.
[Edit CUI screens](/docs/sunrise-studio/cui/#live-game-state) covers the tree, the canvas and the
inspector.

The CUI mirror may be inaccurate. These parts are unverified:
the top screen choice, the layer meaning, the bit 0x2, flag 0x10 and top-screen icons, the page and
priority values, the live slot 6 value and rectangle values, and the raw slots. Nested hierarchies
are not shown.

## Inspect a live object

1. Open the side panel with its icon in the Live toolbar.
2. On the **Objects** tab, click an object. The nearest to the player come first. **Find object**
   filters the list.
3. Read the Inspector's **In game now (read only)** and **Game record** sections.

Double-clicking an object opens its asset. **Refresh** asks the game for the record again. **Open
class** opens the object's class asset.

| tab | shows |
|---|---|
| Objects | live objects, their distance, and a kind: placed or spawned, marker, at origin |
| World | the loaded bubbles, the current slice, the player and the game camera |
| Screens | the game's open UI screens |
| Notes | match counts, excluded objects, spawned entities with no preview, animation state |

Studio draws a full model only for objects the game reports as placed in the world and not hidden.
Every other object is a marker. A marker says nothing about whether the object is active.

## Save a report

1. Press the export icon (**Save live state to a file**) in the Live toolbar.

Studio writes the current observation to `%LOCALAPPDATA%\Sunrise Studio\live-reports`. Hover the
icon for the last file's path.

## Limits

- Live objects and live widgets cannot be edited.
- A moved static mesh draws with a plain diagnostic shader and looks brighter than its neighbors.
- Animation copies drawn skinning poses. It does not capture animation graphs, cloth or objects the
  renderer did not evaluate.
- While a game is attached, Studio draws at most 30 frames a second, and 10 when it is not focused.
