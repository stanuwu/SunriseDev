---
title: "Sunrise Studio alpha and Sunrise 0.6"
date: 2026-10-15
description: "The Studio alpha and Sunrise 0.6 with mod loader support are up. Build them yourself for now."
author: "Stan"
---

Sunrise Studio is out as an alpha, and Sunrise 0.6 is on the main repo. 0.6 adds support for
loading mods.

Neither is a release or a release candidate. There is no download for either one yet. To try them,
build them yourself from source. Once they are tested and stable, they will get proper releases.

## Sunrise Studio alpha

[Sunrise Studio](https://github.com/stanuwu/SunriseStudio) is an editor for the game's content. It
reads your installed game and builds your edits into mods that Sunrise loads.

- View assets, maps, missions and item data.
- Move objects, and edit properties and collision.
- Create weapons, items, vendors, static props, textures, materials, perk behavior and more.
- Edit mission scripts as graphs.
- Export to Blender and import your edits back.
- Connect to a running game to see its screens and world.
- Build and install a project as a Sunrise mod.

It is an alpha. Things will be broken, and some will work in unexpected ways. Keep backups of your
projects. Features known to be broken carry a **WIP** tag in the editor. Hover it to see what is
wrong.

To build it, you need the .NET 9 SDK. The
[README](https://github.com/stanuwu/SunriseStudio#building) has the steps. Studio needs a Sunrise
install of the game. For Blender, install the
[Sunrise Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin) separately.

[Installing Sunrise Studio](/guides/installing-studio/) walks through building both Studio and
Sunrise 0.6. The [Sunrise Studio docs](/docs/sunrise-studio/) cover everything from the
[first start](/docs/sunrise-studio/getting-started/) to
[building and installing a mod](/docs/sunrise-studio/build-and-install/).

## Sunrise 0.6

Sunrise 0.6 is on the [main repo](https://github.com/stanuwu/Sunrise). Its big change is the mod
loader:

- Mods go in `bin/x64/Sunrise/mods`, one folder each.
- A mod can add new packages, patch installed ones, and add or replace mission scripts.
- Mods can have settings you change on the in-game Mods page.
- Mission scripts of a loaded mod can be reloaded without restarting the game.

[Mods](/docs/sunrise/mods/) explains how it works and what a mod folder holds.

To build it, you need Visual Studio 2026. The
[README](https://github.com/stanuwu/Sunrise#building) has the steps. The build writes
`steam_api64.dll` to `build/x64/Release/`. Replace `bin\x64\steam_api64.dll` in your game folder
with it.

The launcher still installs 0.5.1 until 0.6 is released.

> Sunrise and Sunrise Studio are experimental software. Features can change or break while
> development continues.
