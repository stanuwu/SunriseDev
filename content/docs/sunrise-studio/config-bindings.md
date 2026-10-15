---
title: "Bind CUI values to mod settings"
description: "Let players change a CUI layout value or comparison through a mod config setting."
weight: 205
group: "Guides"
---
A config binding ties a value in a CUI resource to a setting of your mod. Players change the setting
on the Sunrise **Mods** page. The game applies it at the next start. Studio previews the setting's
default.

## Declare a setting

1. Open a project.
2. Choose **Build > Mod details...**.
3. Under **Config**, press **Add config entry**.
4. Type a **Key**, for example `hud_scale`.
5. In **Type**, choose `int`, `float` or `bool`.
6. Set the **Default**.
7. Optionally type a **Name** for the Mods page.
8. Press **Save**.

[Mods](/docs/sunrise/mods/#mod-config) lists the rules for keys and defaults.

## Bind a site

1. Open a project.
2. Open the CUI resource. A hierarchy has no config bindings.
3. In the Inspector, press **...** (More) and choose **Config bindings...**.
4. In the list, select a site. **Find scalar property or comparison** filters it.
5. In **Setting**, choose a setting of the same type.
6. Press **Bind setting**.
7. Repeat for other sites.
8. Press **Save bindings**.

The save is one undo step. The **Changes** tab lists each binding as a Config row. A bound field
is locked. The Inspector shows **Bound to** and the setting's key. The CUI page shows the setting
and previews its default.

## Unbind

1. In the Inspector, press **...** (More) and choose **Config bindings...**.
2. Press **Unbind** on the binding.
3. Press **Save bindings**.

Or right-click the Config row in the **Changes** tab and choose **Unbind**. The field becomes a
plain value again.

## Supported sites

| site | type |
|---|---|
| layout X, Y, width and height of supported built-in widgets | `float` |
| text auto width | `bool` |
| comparison operands | `int` or `float` |

Hashes, enums, counts and pointers cannot be bound. One setting can drive several sites. A mod can
have 32 settings and 256 bound sites. Each bound resource must fit in 64 MiB.

A float keeps its stored unit. The dialog shows the unit of a layout site. One layout pool stores
fractions of screen height: **Units: fraction of screen height**. The other stores unscaled values:
**Units: unscaled native value**.

## How it ships

The build writes the bound defaults into your patch and records each site in `mod.json`. A mod with
bindings uses manifest version 3. At startup, Sunrise writes the saved values into a private copy of
each bound entry. [Mods](/docs/sunrise/mods/#package-config-bindings) has the loader's rules.

## Limits

- Bindings use the saved settings at the next game start. They do not change package data live.
- The game may still replace a stored default through its own bindings or layout rules.
- Startup `_unp1_` packages cannot be bound, because the mod loader cannot replace them.
- A source edit that moves a bound row, replaces its target or edits its literal is refused.
- unverified in game.
