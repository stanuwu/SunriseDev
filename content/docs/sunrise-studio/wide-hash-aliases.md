---
title: "Wide-hash aliases"
description: "Give a new native asset the 64-bit keys the game uses to find it."
weight: 235
group: "Guides"
---
Some game data refers to an asset by a 64-bit key instead of its 32-bit tag. A wide-hash alias maps
such a key to an asset your project added. An added native asset can have several aliases. Studio
does not derive keys from names. You enter the exact key.

## Add aliases

1. Open a project.
2. Open the added asset.
3. In the Inspector, press **...** (More) and choose **Wide-hash aliases...**.
4. In **Wide hash**, type the key as exactly 16 hex digits. A `0x` prefix is allowed.
5. Press **Add**.
6. Repeat for each key.
7. Press **Save aliases**.

You can also open the editor from the Changes tab: right-click the asset's row and choose
**Wide-hash aliases...**. **Remove** next to a key takes it out.

The save is one undo step. A failed save keeps the draft open. If the project or the asset changed
while the editor was open, reopen it.

## Rules

- The asset must be a native added asset. Its package ID must be from `0100` to `0CFF` and not
  installed. See [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
- A key cannot repeat another key in the project.
- A key cannot repeat a key the installation already claims, including older patches and claims
  whose target is missing or of another class.
- A package holds at most 1,000,000 alias rows.
- Studio needs the installation open to check these rules.

Saving aliases does not rewrite the asset's payload. The build writes them into the package's alias
table. See [How a build works](/docs/sunrise-studio/build-pipeline/#wide-hash-aliases).

## Limits

An alias alone does not make the game load a new map or bubble. unverified in game.
