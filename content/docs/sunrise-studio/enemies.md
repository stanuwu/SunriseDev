---
title: "Enemies and NPCs"
description: "Find enemies and NPCs, see their model and components, and swap their local definition."
weight: 218
group: "Guides"
---
The **Enemies and NPCs** category lists every entity with a combatant component. Enemies, bosses
and friendly NPCs all use that component. Studio cannot tell their side apart, so they share one
category. Every other entity is in **Entities**.

## Find an enemy

1. Open the **Assets** tab of the asset browser.
2. Choose **Enemies and NPCs**, or type a name such as `Legionary` in the search box.
3. Pick a type in the **Type** list to narrow the list.

The type is the enemy's display name. An enemy with no display name uses its object type, such as
`biped`. One with neither is **Unnamed**.

## What the viewer shows

The model is on the left, or on top when the panel is narrow. The **Components** tab lists:

- The display name, the internal name, the object type and the package.
- A **Damage** section, when the entity has a damage config. It lists each damage part and pool.
- One section per component config. The combatant config comes first. Each section shows the
  component class, any model or prompt it links, and the strings the config holds. A role listed
  more than once gets one header with a node per config.

Press the open icon in a section to open that config as a plain asset. The **Parts**, **Materials**,
**Shaders**, **Related** and **Graph** tabs work as they do for any entity.

## Rank, look and shields

Many enemies change color with their rank or faction, and some parts show only while the game runs.
The **Parts** tab sets both:

- **Variant** picks values such as rank (`type`) and `faction`. See
  [Pick variant values](/docs/sunrise-studio/find-assets/#pick-variant-values).
- **Channels** sets the values materials read, such as a Hydra's shield. Each starts at the value
  the game holds while the enemy is alive and idle, where Studio can work it out. A Hydra opens with
  its shield plates on. See [Set channel values](/docs/sunrise-studio/find-assets/#set-channel-values).
  The same rest values apply wherever the entity is placed in a map.

**Assets > Export full asset to Blender...** uses the same choices.

## Edit

Open a project first. Type a new value and press Enter. A damage value applies when you leave its
field. Each change is one undo step.

An edit changes the config, not the enemy. Every enemy that uses the same config changes too.

| field | what it is | state |
|---|---|---|
| Local definition | The class `0x8080815F` record. It gives the display name and the enemy's action table (state machine, melee, jump, teleport). Changing it changes both. | may not work in game |
| Damage part scale, per-type scale, pool start fraction | Floats of the damage config, in the **Damage** section of the Components tab | may not work in game |

Studio refuses a Local definition value that is not a class `0x8080815F` tag.

The part value under **Health?** is read only. Its meaning is assumed.

## Not known

Studio does not show AI, weapons, loot or faction yet.

**New** and **Clone** are grayed out in both categories. Hover one to see why:

| category | action | reason |
|---|---|---|
| Enemies and NPCs | New | No AI, health or loot field is known. |
| Enemies and NPCs | Clone | Entity clone is not supported yet. |
| Entities | New | Use Import skinned model (Hob rig). |
| Entities | Clone | Nothing spawns or places a copy yet. |

[Import a skinned model](/docs/sunrise-studio/skinned-model/) makes a new entity on the Hob rig.
See [Create content](/docs/sunrise-studio/create-content/#limits).
