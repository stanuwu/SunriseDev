---
title: "Destiny 1"
description: "How Destiny 1 works: its platform layer, frame timing, renderer, Activity Host and actors."
weight: 40
---

These pages describe how Destiny 1 works inside: its platform layer, its frame timing, its renderer,
its Activity Host and its actors. The facts come from reverse engineering the game's PS4 executable,
and from Bungie's own talks where a page says so.

Every page is about PS4 version 1.29, from September 2016. The Xbox One build and Destiny 2 are used
for cross-checks. [The build](/docs/destiny-1/the-build/) has the details.

Conventions:

- Function and field names are descriptive names, not Bungie's, unless they are in backticks.
- Offsets are in hex. Sizes are in bytes unless a page says bits.
- A fact that is not proven is marked "unverified" or "assumed".
- Each page ends with what was not checked.

Destiny 1 facts do not carry over to Destiny 2 on their own. For Destiny 2, see
[Destiny 2](/docs/destiny-2/).
