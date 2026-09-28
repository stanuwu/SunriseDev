---
title: "Destiny 2"
description: "How Destiny 2 works: data formats, network protocols and engine systems."
weight: 30
---

These pages describe how the game works: its data formats, its network protocols and its engine
systems. The facts come from reverse engineering the client that Sunrise runs on.

Every page is about PC build 86657, the build Sunrise uses. It is dated 2020-08-23, in Season of
Arrivals, the last season before Beyond Light. Other builds differ, and layouts and ids may not
carry over. [The build](/docs/destiny-2/the-build/) has the details.

Conventions:

- Most function and field names are descriptive names, not Bungie's. The game ships without most
  of its names.
- Offsets are in hex. Sizes are in bytes unless a page says bits.
- Data layouts are C-like structs. Logic is C-like pseudocode.
- A fact that is not proven is marked "not verified" or "unknown".

For how Sunrise answers the game, see [Sunrise](/docs/sunrise/).
