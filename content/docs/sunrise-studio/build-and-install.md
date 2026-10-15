---
title: "Build and install a mod"
description: "Build a project, install it as a Sunrise mod, and reload its scripts in a running game."
weight: 240
group: "Guides"
---
A build turns your project into package files and patches. An install puts them, with your scripts,
into a Sunrise mod folder. [Mods](/docs/sunrise/mods/) explains how Sunrise loads it.

## Set the mod details

An install needs mod details. If they are missing, Studio opens this dialog for you.

1. Choose **Build > Mod details...**.
2. Fill the fields.
3. Press **Save**.

| field | holds |
|---|---|
| **Id** | a lowercase reverse-domain id, such as `dev.example.mod` |
| **Version** | `MAJOR.MINOR.PATCH`, such as `1.0.0` |
| **Name** | the name on the Mods page |
| **Description** | optional text |
| **Authors, one per line** | optional names |
| **Source URL** | optional link |
| **Dependencies** | **Add dependency**, then the mod id, **Minimum** and optional **Maximum** version |
| **Incompatible mod ids, one per line** | mods that cannot load with this one |
| **Cheat** | loading this mod stops the player's progress from being saved that session |
| **Config** | **Add config entry**, then **Key**, **Type**, **Default** and **Name** |

Problems show in the dialog. **Save** stays disabled until they are fixed.
[mod.json](/docs/sunrise/mods/#modjson) has the rules for every field.

## Build packages

1. Choose **Build > Build packages**, press **Build packages** in the toolbar, or press
   `Ctrl+Shift+B`.

The build runs in the background. The status bar shows the stage and a progress bar, then the result
with an **Open folder** button. Each build goes into a new folder, named by date and time, inside the
project's `build` folder. A build never writes into the installation.

To build somewhere else, choose **Build > Build to folder...** and pick an empty folder outside the
installation.

The **Build** tab of Project changes lists the packages written and the object edits compiled.
**Open output folder** opens the build folder. Each build also writes a receipt that lists the files,
the new tags, the packages it needs, the dependency and manifest edits, and the merge data files.
Each package except a startup replacement gets a `.merge` file beside it, so Sunrise can merge it
with other mods that patch the same package.
[How a build works](/docs/sunrise-studio/build-pipeline/) explains them.

## Build and install

1. Close the game.
2. Choose **Build > Build and install**.

Studio checks the mod details, builds the project, and installs it in
`bin/x64/Sunrise/mods/<mod id>`. New packages go to `packages`, patches of installed packages go to
`patches`, and scripts and SDK modules go to `scripts` and `sdk`. Each `.merge` file goes beside its
package. An install replaces the whole mod folder. When it is done, the status bar says **Mod
installed. Restart the game to load it.**

If the Mission Graph has unsaved changes, Studio asks to save them first. If the game holds the mod's
files, the install fails. Close the game and install again.

## Update a running game

**Update running game** sends script changes to a game that is already running. It does not need the
Live tab.

Before the first update:

1. Install the mod with **Build and install**.
2. In the game's `settings.json`, set `studio_attach` to `true`. See
   [Connect to a running game](/docs/sunrise-studio/live/#before-you-start).
3. Start the game.

To update:

1. Save your mission scripts.
2. Choose **Build > Update running game**.

Studio builds the project, writes only the changed script files into the installed mod, and removes
the scripts you deleted. Then it asks the game to reload the mod. The game swaps the scripts when
each mission reaches a safe point. Studio waits up to 30 seconds. The status bar shows the game's answer.

Update running game writes nothing and asks for **Build and install** when any of these changed:

- `mod.json`;
- a package or a patch;
- an SDK module;
- whether the mod has a `scripts` folder.

If a script does not compile, the old scripts keep running. A mission that is not bound or not
started yet needs an activity restart. This step is unverified end to end with Studio.

**Build and install** and **Update running game** have no default keys. Set them in
[Shortcuts and presets](/docs/sunrise-studio/shortcuts/).

## Limits

- Edits and config bindings on startup `_unp1_` packages cannot be installed. **Build packages**
  still builds the edits, as full replacements.
- New packages need an ID from `0100` to `0CFF`. See
  [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
- A project with no package edits, scripts or SDK modules has nothing to install.
- Update running game needs exactly one game running from your installation, and the mod installed
  once with **Build and install**.
