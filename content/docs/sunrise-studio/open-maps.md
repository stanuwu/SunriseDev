---
title: "Open a map or mission"
description: "Open a whole map, add a mission's content to it, and choose which states and layers you see."
weight: 105
group: "Guides"
---
A map is the scenery of a destination. A mission adds its authored content on top of a map: spawns,
squads, triggers, effects, lights and objects. Studio opens both in the Scene tab of the Workspace.

## Open a map

1. In the Asset browser, open the **Maps** tab.
2. Type part of the name or the tag in **Find map**.
3. Click the map.

The loading screen stays until the scene's geometry, materials, textures and shaders are ready. The
camera starts 1.7 m above the player spawn, looking 10 m ahead along the spawn's heading. Choosing
the map that is already open does not reload it.

Hover a map row to see its bubble count and tag. A destination the open project made is listed with
the installed maps, and its mission with the installed missions. See
[Author map content](/docs/sunrise-studio/new-map/#open-your-destination).
[Use the camera](/docs/sunrise-studio/camera/#teleport-to-a-spawn-point) shows how to jump to
another spawn.

## Open a mission

1. In the Asset browser, open the **Missions** tab.
2. Type part of the name or the tag in **Find mission**.
3. Click the mission.
4. If the **Choose mission map** list opens, click the map to use.

With a map open, the list shows only that map's missions. With no map open, it shows every mission.
The **Choose mission map** list opens only for a mission that uses several maps. A mission that
names no map cannot be opened.

The map scenery stays, and the mission's content is added. The **Mission** tab appears. In a
mission, the camera prefers a spawn in a package-enabled state. Choosing the mission that is
already open does not reload it.

## Open an asset while a map is open

1. Open the asset from the Assets tab, the Inspector or the Related page.

The asset opens in the world's **Asset** tab. The map stays loaded.

## Close the map

1. Choose **File > Close world**.

## Show a map or a mission layer

A mission scene has two layers: the map and the mission.

1. In the Scene tab, untick **Map** to hide the map scenery, or **Mission** to hide the mission
   content.

Nothing is unloaded. Tick the box again to show it.

## Choose which mission states to preview

A mission's bubbles each hold several authored states. Studio can preview all of them, the ones the
package enables, or the ones you pick. This is a preview of authored data. It does not run the
mission.

1. Open the **Mission** tab.
2. In **Preview states**, choose **All authored states**, **Package-enabled states** or
   **Selected states**.
3. For **Selected states**, open each bubble and choose a **State**.
4. Press **Apply states**.

The scene reloads with that choice. **Apply states** is available only after the choice changes.

## Inspect mission content

1. Open the **Mission** tab.
2. Open a bubble, then a state, then a group such as Spawns or Squads.
3. Click a row to select the object in the scene. Double-click to frame it.

**State details** selects the state itself. **Open source** opens the asset that defines it. Content
no state owns is under **Shared content** and **Shared mission objects**.

## Show or hide bubbles

1. In the Scene tab, open **Bubbles**.
2. Untick a bubble to hide it.

**Show all** in the same list shows every bubble again. In the **Mission** tab, each bubble has a
**Visible** checkbox and an **Only this bubble** button.

## Choose map layers

A mission loads only the map layers it uses, so an edit targets the copy the game draws. This list
replaces that choice. It appears only when the map has authored layers.

1. Open the **Report** tab.
2. Open **Authored map layers**.
3. Tick the layers you want.
4. Press **Apply map layers**.

## Show or hide kinds of content

1. In the Scene tab, open **Layers**.
2. Tick or untick **Box** and **Content** for each kind.

**Box** shows the placement boxes. **Content** shows what the placements draw: the model for
Objects, the trigger shape for Volumes, and the particles for Effects. Spawns, squads, lights and
transitions have boxes only. Transition, squad, effect and light boxes start hidden. Selecting a
hidden object shows its layer and bubble again.

**Inactive parts** shows parts that the initial state disables. The Collision row is covered in
[Edit collision](/docs/sunrise-studio/collision/).

## Change the environment

1. Open the **Report** tab.
2. Use the controls under **Environment**. The section starts open.

| control | effect |
|---|---|
| **Time of day** | sets the time of day of the sky, from 0 to 1; a map opens at its own start time until you move it |
| **Backdrop** | **Follow cursor**, **Fixed bubble** or **All bubbles** |
| **Sky bubble** | the bubble whose sky to use with **Fixed bubble** |
| **Auto exposure** | adjusts brightness on its own |
| **Exposure** | sets brightness by hand when Auto exposure is off |

## Read the reports

The **Report** tab lists object counts, the naming coverage under **Names**, decoding problems
under **Load report**, the collision load under **Collision**, and shader coverage under
**Shader report**.
