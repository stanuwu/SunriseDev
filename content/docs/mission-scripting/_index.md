---
title: "Mission Scripting"
description: "Write and run mission scripts for Sunrise."
weight: 10
---

### Warning
> Sunrise is a work in progress. The scripting SDK and API are not complete. Some parts may be missing or may not work.

A mission script is a Lua file that runs on the local server while an activity is live. It reacts
to what the game client reports, and it asks the client to do things: spawn enemies, open doors,
show goals, play lines. Sunrise does the networking, counting and bookkeeping. The script only
decides what should happen.

Your scripts live in `Sunrise/scripts/<name>/<name>.lua` in your game install. A
[mod](/docs/sunrise/mods/) can ship scripts too, and its script replaces the base one. The scripts
that ship with Sunrise, and the shared libraries in `Sunrise/scripts/lib/`, are working examples.
Start with [Your first script](/docs/mission-scripting/first-script/).

These pages use a few conventions:

- Lua is shown for anything a script does. C-like pseudocode is shown for what Sunrise does.
- `Slot.X`, `Squad.X` and similar names are placeholders unless the text names a real mission.
- A path like `scripts/lib/flow.lua` is relative to the `Sunrise` folder in your game install.
