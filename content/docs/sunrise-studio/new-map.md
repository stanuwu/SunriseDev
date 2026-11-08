---
title: "Author map content"
description: "Copy an installed destination as a new one, change maps and missions, and ship the changes as a mod."
weight: 195
group: "Guides"
---
Studio can copy an installed destination as a new one that keeps some of its bubbles. It cannot
build a map from nothing: that needs terrain, collision, lighting and navigation writers, and Studio
has none of them yet. You can also change an existing map and its mission, then ship the changes as
a mod.

## Create a destination from an installed one

1. Create or open a project.
2. In the Asset browser, open **All other assets** and choose **New** > **Destination**.
3. In **Template**, search for an installed activity, such as `edz_freeroam`.
4. Tick the bubbles to keep. A gray bubble has no bubble record on its map, so it cannot be kept.
5. Enter a **Name**: lowercase letters, digits and `_`, at most 39. It names the new activity and
   its destination, and it cannot be the name of an installed one.
6. Check the **Activity template**. Studio picks the free-roam activity of the copied scenario. The
   launcher starts a destination only through an activity, so the copy gets one.
7. Enter a **Title**, and a **Description** if you want one. An empty title uses the name.
8. Check the **Package ID**. See [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
9. Optionally, pick a **Bundle bubble**. See [Place statics from a bundle](#place-statics-from-a-bundle).
10. Press **Create**. Studio writes the copy under `content/world/<name>/` in the project, then adds
    an activity row and a destination row for it.
11. Choose **Build > Build and install**, then start the game.
12. In Sunrise's Activity Launcher, open **Custom Launch**, choose the name, then its activity
    under **Activity variant**.

## Add an activity to a destination

The launcher starts a destination only through an activity. **New** > **Destination** adds one. If
that step failed, the status bar says so. Add the activity on its own:

1. In **All other assets**, choose **New** > **Activity**.
2. In **Destination**, choose a destination this project made. One that already has an activity is
   refused.
3. Check the **Template**. Studio picks the free-roam activity the destination was copied from.
4. Enter a **Title**, and a **Description** if you want one.
5. Check the **Package ID**, then press **Create**.

## Place statics from a bundle

A World Import Bundle describes one bubble in a `bubble.json` file: its static models as GLB files,
and its spawn points. **Bundle bubble** in **New** > **Destination** takes such a file.

Studio imports each static model as a project model. It places the models in the first kept
bubble, so that the bundle's first spawn point lands on that bubble's first spawn point, facing the
same way. Each model joins a placement list that the bubble loads. The bundle format is a draft and
may change.

## Open your destination

The copy opens like an installed map: type its name in **Find map** on the Asset browser's
**Maps** tab, or in **Find mission** on its **Missions** tab. See
[Open a map or mission](/docs/sunrise-studio/open-maps/). A static placed from a bundle bubble
moves with **Apply transform** in the Inspector. Studio writes the new transform into the copy's
files and grows the table's bounds to hold it. **Undo** restores the files. **Copy to this
transform** and **Remove object** are not offered for these statics.

The game finds the copy by its name: the scenario is `<name>:scenario_client`, and its map root is
`map:<name>:root`. The kept bubbles keep their installed content, and the others load nothing.
Each bubble gets a name of its own, `<name>_bubble_<row>`, where row is its place in the scenario,
so the copy shares no bubble name with its template.

The activity copies the template's free-roam row: its type, its rules and its link to the
destination. Its destination row copies the template's destination row, with the new title and the
template's bubble list and artwork. Sunrise numbers each mod's new rows after the installed ones and
the rows of mods loaded before it.

## What you can change

| change | guide |
|---|---|
| move, rotate and scale placed objects and groups | [Move, rotate and scale objects](/docs/sunrise-studio/move-objects/) |
| copy or remove a static object | [Copy or remove a static object](/docs/sunrise-studio/move-objects/#copy-or-remove-a-static-object) |
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

- A new map or bubble built from nothing. A new destination is a copy of an installed one.
- An activity other than free roam.
- New terrain, lighting, navigation or sky.
- Placing a new entity in a map. A new model is placed only from a bundle bubble in a new
  destination. In other maps, a static can only be copied; see
  [Copy or remove a static object](/docs/sunrise-studio/move-objects/#copy-or-remove-a-static-object).
  A static prop from **New** > **Static prop** is a standalone model with no placement.
- Removing collision from a map. A removed static keeps its collision.
- A new combatant type with its own AI, health or loot.
