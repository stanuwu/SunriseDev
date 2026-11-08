---
title: "Getting started"
description: "Start Studio, choose the game installation and create a first project."
weight: 10
group: "Start here"
---
These steps take Studio from a fresh download to an open project.

## Requirements

| need | why |
|---|---|
| Windows 10 or 11 with a Direct3D 11 graphics card | Studio draws with Direct3D 11 |
| an owned Destiny 2 installation with Sunrise | Studio reads its packages, keys and decoder |
| Blender 5.2 or newer, optional | for the [Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin) |

Studio ships no game packages, keys, fonts or decoder libraries. It reads them from the
installation.

Large maps need a lot of memory. On a machine without a page file, several large map loads at once
can run out of memory. A read then fails with a "decryption failed" message that names the system
error, or Studio stops with an internal runtime error. Close other heavy programs and try again.
The package data is not damaged.

## Start Studio

Run `Sunrise Studio.exe`. It is one file and needs no .NET install. **Help > Licenses** shows
Studio's license and the licenses of what it includes.

To build Studio from source, install the .NET 9 SDK and run `publish.ps1` in the source folder. It
writes `publish\Sunrise Studio.exe`. [Installing Sunrise Studio](/guides/installing-studio/) has the
full steps, including the Sunrise version Studio needs.

## Choose the installation

On the first start the **Sunrise location** dialog opens.

1. In **Installation folder**, enter your game folder, or press **Browse** and pick it.
2. Leave **Package key source** on **Automatic**. Studio reads the package key export from the
   installation. Follow the one-time setup below if the keys have not been exported yet.
3. Press **Open Sunrise**.

The dialog accepts the installation root, its `packages` folder or its `bin/x64/Sunrise` folder.
Studio remembers the choice in its local settings. To change it later, use
**File > Sunrise location...**.

The loading screen stays until names, maps, missions and the asset browser are ready. The progress
bar names the current stage and its count. The first open scans every package for names and takes
longer. Later opens read the loading cache; see [Cache settings](/docs/sunrise-studio/cache/).

If the folder holds no packages, the loading screen shows **Unable to load** and the reason. Press
**Choose Sunrise location** to pick another folder. Without the package key export, the reason
starts with "No decryption keys were found". Follow the steps below.

## Export package keys once

The normal packed executable keeps its package keys hidden until it runs. Sunrise can export them
for Studio. No executable or memory dump is needed.

1. Close the game and open `bin/x64/Sunrise/settings.json` in the installation.
2. Inside the `"client"` object, set `"package_keys": true` in `"exports"`. Keep the other settings.
3. Run Sunrise once. After startup, it writes `bin/x64/Sunrise/exports/package_keys.bin`.
4. Close the game and set `"package_keys": false` again. The export remains available.
5. Open Studio with **Package key source** on **Automatic**. Clear an older custom path if needed.

This option is off by default. While enabled, it replaces the same export on each startup.
The export stays in your installation. Studio does not copy it into projects or mods.
If it is deleted, repeat these steps. A runtime that does not support this setting must be updated.

The advanced **Package key source** field and `--keys` accept an exported key file or an owned
unpacked executable of the same build. Automatic also supports an unpacked installed `destiny2.exe`.

## Create a project

You can browse without a project. To change anything, create one.

1. Choose **File > New project** or press `Ctrl+N`.
2. In **Name**, type a name for the project.
3. In **Parent folder**, enter a folder outside the game installation, or press **Browse**.
4. Press **Create project**.

Studio creates a folder with that name and a `sunrise.project.json` file in it. The toolbar then
shows the project name instead of **View only**. Changes save on their own.

## Open a project

1. Choose **File > Open project...** or press `Ctrl+O`.
2. Pick the project's `sunrise.project.json`.

**File > Recent projects** lists the last eight projects opened. **File > Close project** closes the
open one.

## What Studio keeps where

| data | location |
|---|---|
| settings, layout, pop-out windows, shortcuts, recent projects | `%LOCALAPPDATA%\Sunrise Studio\settings.json` |
| Mission Graph node positions | `mission-layouts`, next to `settings.json` |
| loading cache | `%LOCALAPPDATA%\Sunrise Studio\Cache\data-v1` |
| audio preview cache | `%LOCALAPPDATA%\Sunrise Studio\Cache\Audio` |
| live reports | `%LOCALAPPDATA%\Sunrise Studio\live-reports` |
| project changes | the project folder |
| package builds | the project's `build` folder |
| installed mods | `bin/x64/Sunrise/mods/<mod id>` in the installation |

A project holds no installation paths and no local preferences, so it can be shared.

## Launch options

`Sunrise Studio.exe` accepts these options.

| option | effect |
|---|---|
| `--game <folder>` | open this installation |
| `--project <file>` | open this `sunrise.project.json` |
| `--tag <hex>` | open this asset |
| `--map <hex>` | open this map |
| `--mission <hex>` | with `--map`, open this mission on that map |
| `--keys <file>` | use this Sunrise key export or unpacked executable |
| `--settings <file>` | use this settings file |
| `--category <kind>` | open a category, such as `Weapons`, or filter to a kind, such as `Entity / Prop`; then open its first asset |
| `--page <name>` | open this asset page, such as `Properties` |
| `--script <name>` | open this mission script |
| `--warp` | draw with the Windows software renderer instead of the graphics card |

`Sunrise Studio.exe --help` prints a short list of options. `Sunrise Studio.exe tft` works on loose
tag files; see [How projects store edits](/docs/sunrise-studio/project-storage/#new-tags).

## Related pages

- [The interface](/docs/sunrise-studio/interface/)
- [Open a map or mission](/docs/sunrise-studio/open-maps/)
- [Move, rotate and scale objects](/docs/sunrise-studio/move-objects/)
- [Build and install a mod](/docs/sunrise-studio/build-and-install/)
