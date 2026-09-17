---
title: "Mission scripting, and where Sunrise is going"
date: 2026-09-17
description: "The scripting SDK and its docs are up, the team is growing, and here is the plan."
author: "Stan"
---

Sunrise 0.5 just released and this is what you can expect.

## Plans for Sunrise

The main goals we are working on:

- **Complete scripting.** Every mission runs from a script, with the API and SDK to write one.
- **Complete progression.** Characters, inventory and quests all work and persist.
- **P2P multiplayer.** Play together locally, with no servers in the middle.

## Dev team

Welcoming members to the official Sunrise team. Check the discord for more information.

## Mission scripting

A mission script is a Lua file that runs on the local server while an activity is live. It spawns
enemies, opens doors, shows goals and plays lines. Sunrise handles the rest.

- **The SDK.** Sunrise reads the installed game data and writes Lua modules from it, so a script
  names a squad, a door or a voice line by a readable key instead of a raw id.
- **The Lua API.** Scripts react to what the game reports and send requests back. Everything a
  script can call is documented.
- **Documentation.** The [Mission Scripting docs](/docs/mission-scripting/) are new: a first
  script, the full API and SDK reference, recipes, and how to build a mission from scratch.
- **A separate repo.** Mission scripts live in
  [SunriseMissions](https://github.com/stanuwu/SunriseMissions). The game loads that folder
  directly, so there is no build step. New missions do not need a new version of Sunrise.
- **Pull requests welcome.** Missions are the easiest place to contribute. Pick an activity that
  has no script yet, write it, and open a PR.
- **A scripting channel** on [Discord](https://discord.com/invite/projectsunrise) for dedicated users working on scripts.

### The tools

Sunrise ships the tools it uses itself. Press **Insert** in game to open them:

- Find any squad, trigger, door, scene, voice line or goal, and search by name.
- Test one before you write it: place a squad, fire a trigger, open a door, play a cue, show a
  goal.
- Draw positions and trigger shapes in the world, with labels.
- Watch your script while it runs: its status, its last error, its variables and its timers.
- Reload a script without restarting the game.

## Other changes

- **Persistent saves.** Characters, inventory and quest progress are kept in a local database.
- **Mission launch.** Pick any activity from the launcher in game and drop straight into it.
- **Language select.** Choose the game language in the Sunrise settings.
- **A new launcher.** It installs the game, Sunrise and the mission scripts, and keeps them
  updated.
- **Bug fixes** across the board.

> Sunrise is experimental software. Features can change or break while development continues.
