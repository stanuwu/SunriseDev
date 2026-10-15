---
title: "Author map content"
description: "Change an existing map and its mission, and ship the changes as a mod."
weight: 195
group: "Guides"
---
Studio cannot create a brand new map. A complete map needs terrain, collision, lighting and
navigation writers, and Studio has none of them yet. You can change an existing map and its mission,
then ship the changes as a mod.

## What you can change

| change | guide |
|---|---|
| move, rotate and scale placed objects and groups | [Move, rotate and scale objects](/docs/sunrise-studio/move-objects/) |
| resize trigger volumes | [Edit trigger bounds](/docs/sunrise-studio/trigger-bounds/) |
| move collision, edit its shapes and parts, add shapes and copies | [Edit collision](/docs/sunrise-studio/collision/) |
| change the materials of placed models | [Edit materials](/docs/sunrise-studio/materials/) |
| change the textures of placed models | [Import and edit textures](/docs/sunrise-studio/textures/) |
| change the geometry of a model, keeping its topology | [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/) |
| change what the mission does | [Script a mission](/docs/sunrise-studio/mission-graph/) |

## Build a changed map

1. Create a project. See [Getting started](/docs/sunrise-studio/getting-started/#create-a-project).
2. Open the map, or the mission that uses it. See
   [Open a map or mission](/docs/sunrise-studio/open-maps/).
3. In a mission, open **Report > Authored map layers** to see which map layers it loads. Edit the
   copy the mission draws.
4. Move, rotate or scale an object. See
   [Move, rotate and scale objects](/docs/sunrise-studio/move-objects/).
5. Repeat for each object. Each object gets one row in the Changes tab.
6. To add walls or floors that players collide with, add collision shapes. See
   [Edit collision](/docs/sunrise-studio/collision/).
7. To change what the mission does, add a mod script in **View > Mission Graph**. See
   [Script a mission](/docs/sunrise-studio/mission-graph/).
8. Choose **Build > Mod details...**.
9. Fill in the mod's **Id**, **Version** and **Name**.
10. Choose **Build > Build and install**.
11. Start the game.
12. Load the activity.

[Build and install a mod](/docs/sunrise-studio/build-and-install/) covers the last steps.

## New native assets and wide hashes

A new native asset that the game looks up by a 64-bit key needs an alias. See
[Wide-hash aliases](/docs/sunrise-studio/wide-hash-aliases/).

## Limits

Studio does not support:

- A new map, bubble, activity or destination.
- New terrain, lighting, navigation or sky.
- Placing a new model or entity in a map. A static prop is a standalone model with no placement.
  See [Add a static prop](/docs/sunrise-studio/static-prop/).
- Removing objects or collision from a map.
- A new combatant type with its own AI, health or loot.
