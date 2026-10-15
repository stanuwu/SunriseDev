---
title: "Sunrise Studio"
description: "A Windows editor that browses, edits and builds Destiny 2 content for Sunrise."
weight: 25
# The sidebar lists pages under these headings, in this order; each page names its own in `group`.
groups: ["Start here", "Guides", "How it works"]
---

### Warning
> Studio is an alpha, and most of its edits may not work in game. One is checked: a scaled static
> object on `pvp_sabre` loads, draws, collides and culls. A feature known to be broken or only partly working carries a **WIP** tag in Studio.
> Hover the tag to see what is wrong.

Sunrise Studio is a Windows editor for the Destiny 2 build that Sunrise runs. It reads the packages
of the installed game directly, so the game does not need to run. Studio shows maps, missions and
assets, keeps changes in a project, and builds the project into a Sunrise mod.

Start with [Getting started](/docs/sunrise-studio/getting-started/), then read
[The interface](/docs/sunrise-studio/interface/).

## What Studio can do

| area | what Studio does |
|---|---|
| Browse | browse by category, such as items and enemies, each with its own viewer; dress [guardians](/docs/sunrise-studio/guardians/) in armor; search any package entry by name or tag |
| Maps and missions | open a whole map or mission in 3D with the game's own shaders |
| Placement | move, rotate and scale placed objects and groups of them; edit trigger bounds |
| Collision | view, export and edit static collision; add new shapes |
| Assets | read properties, references and bytes; edit fields Studio understands |
| Models | add static props from OBJ, glTF or Blender; replace a skinned model on an installed rig |
| Materials and textures | change texture slots and constants; import PNG and DDS images |
| Animation | play clips; edit dense control channels through glTF; animate an exotic weapon and its first-person arms in Blender |
| UI | edit CUI screens and bind their values to mod settings |
| Create | start new content as New or Clone from its category; pick or make each part |
| Items and vendors | edit stats, perks, perk behavior, sockets and prices; create items, exotic weapons and vendors from installed ones |
| Mission scripts | build and edit mission scripts as a node graph or as Lua |
| Audio | play, export and audition Wwise audio; replace a weapon's sounds with WAV files |
| Live | follow a running game: its camera, map, objects and animation |
| Mods | build packages, install the project as a Sunrise mod, reload scripts in a running game |

## What Studio cannot do

- Create a new map, activity, combatant, audio bank or animation clip from nothing.
- Place a new object in a map. A new static prop is a standalone model.
- Author shaders.
- Write into the game's `packages` folder. Inside the installation, Studio writes only into the
  Sunrise `mods` folder.
- Run mission logic or reproduce the game's lighting exactly.

[Author map content](/docs/sunrise-studio/new-map/) shows the closest supported path for map work.

## Main ideas

### Installation

The installation is the game folder with Sunrise in it. Studio reads its packages, its Sunrise SDK
files and the key and decoder files it needs. Studio never changes the installed packages.

### Project

A project is a folder with a `sunrise.project.json` file. All changes live there. Without a project,
Studio is view only. A project holds edits, not copies of game data.

### Byte delta and object edit

Studio stores a change in one of two ways.

| kind | holds | made by |
|---|---|---|
| object edit | new position, rotation, scale or trigger bounds for one world object | the placement editor, collision moves |
| byte delta | which bytes of an asset changed, as copy ranges and XOR masks | property edits, byte edits, imports, material and texture edits |

Both are checked against the installed bytes. If the game files change, Studio refuses to build
until the stale edit is reverted. [How projects store edits](/docs/sunrise-studio/project-storage/)
has the detail.

### Added asset

An added asset is a new package entry that the project owns, such as a new texture or a new item.
Added assets go into new packages with an unused package ID.

### Build

A build turns the project into package files and patches. **Build packages** writes them into the
project's `build` folder. It never touches the installation.

### Install as mod

**Build and install** builds the project and installs it as a Sunrise mod in
`bin/x64/Sunrise/mods/<mod id>`. Sunrise loads it at the next game start.
[Mods](/docs/sunrise/mods/) explains how Sunrise loads it.

## Pages in this section

The pages come in three groups:

- Start here: getting started and the interface.
- Guides: one task each, as numbered steps.
- How it works: the formats and the code behind Studio, for readers who want the detail.
