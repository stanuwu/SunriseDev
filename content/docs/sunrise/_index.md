---
title: "Sunrise"
description: "The parts, settings and internals of Sunrise."
weight: 20
---

Sunrise is one DLL. It loads into the game and carries both a client mod and a local server. The
game talks to that server as if it were the live service. No outside server is involved.

Start with [How Sunrise is built](/docs/sunrise/architecture/).

Conventions:

- A path like `src/server/bap/` is relative to the `Sunrise` folder of the
  [Sunrise repo](https://github.com/stanuwu/Sunrise).
- Most function and field names come from Sunrise, not Bungie. The game ships without them.
- Code is either a short excerpt from the source or C-like pseudocode.
- For how the game itself works, see [Destiny 2](/docs/destiny-2/).
