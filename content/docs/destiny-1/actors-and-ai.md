---
title: "Actors and AI"
date: 2026-11-08
description: "The action system and animation rig from Bungie's SIGGRAPH 2014 course, and what the PS4 client shows about factions and object filters."
weight: 50
---
Actors run on each player's console, not on a server. This page covers how an actor chooses and
blends its actions, how factions are stored, and how objects are filtered.

## The action system

Bungie described Destiny 1's animation in the SIGGRAPH 2014 course
[Destiny Character-Animation System and Lessons Learned](https://advances.realtimerendering.com/destiny/siggraph2014/animation/index.html).
Its networking section was never published, so the course says nothing about the wire.

An **action** is one behavior: locomotion, a melee, an emote. Destiny 1 has 75 action types.

- Player control and AI control both submit **requests** to a queue. The queue is resolved once per
  tick.
- Resolution uses an N x N table in data: incoming action against running action. Its rules include
  `Interrupt`, `Simultaneous`, `Ignore`, `Allow After Event` and `Allow With Expression`.
- Any action can be interrupted at any time, and it blends into the next one.
- An action owns its own update. Actions talk through shared systems such as damage, animation and
  inventory, never to each other.
- There is no priority list and no fixed upper and lower body. Animators split the body with masks.

The course shows part of the table. Rows are the running action and columns the incoming one; the
axes are assumed from the content.

| running | Melee | Jump | Sprint | Death |
|---|---|---|---|---|
| Melee | Interrupt | Simultaneous | Ignore | Interrupt |
| Jump | Simultaneous | Ignore | Ignore | Interrupt |
| Sprint | Interrupt | Interrupt | Ignore | Interrupt |
| Death | Ignore | Ignore | Ignore | Ignore |

Destiny 2's action kinds appear to keep the course's list in the same order, with new kinds
inserted. That is assumed from the order alone. Destiny 2's kinds are in
[Actors and AI: Action kinds](/docs/destiny-2/actors-and-ai/#action-kinds). Destiny 2's rule
table gives ignore, simultaneous and interrupt results, the same as the course's first three rules;
see [Action rules](/docs/destiny-2/actors-and-ai/#action-rules).

## The animation rig

- Clips animate **controls**, not bones. A control has a rotation space, a translation space, a data
  stream and a function.
- Spaces are parent, object, bind, aim and virtual. Aim space can be partial, such as 50%. A virtual
  space is a point that is not a node, such as the midpoint between the clavicles.
- Functions are IK and rotation distribution, which spreads a rotation over the bones between two
  controls.
- A **rig subset** is a named group of controls. A rig is a list of subsets, and a subset can inherit
  another. Clips name the subsets they carry, characters name the subsets they accept, and only
  matching subsets retarget. One race was animated first and retargeted onto the others.
- The rig is solved in one pass, with every reference resolved offline. IK runs late.
- The bone on the floor between the feet is the `pedestal`.

## Animation layers

A layer is a clip played with others and combined in order. A replacement layer replaces the pose
below it. An additive layer offsets it.

- Expressions drive each layer's weight, playback rate or frame ratio. Game code publishes named
  values such as `linear_velocity`, `linear_speed`, `game_time`, `fp_iron_sight_fraction` and
  `look_yaw_pitch`.
- Interpolators smooth an expression: exponential, spring, and different rise and fall rates.
- Pose layers treat clip frames as poses in a 1D, disk, 2D or sphere space. Aim and look are 2D pose
  layers over yaw and pitch.
- Far characters drop layers that do not show at a distance.

The course's debug view shows one Fallen character's stack:

| layer | content |
|---|---|
| `base` | two clips blended by weight |
| `move_dip` | a dip as the velocity changes |
| `character_layer` | a fixed character pose |
| `twitch_layer` | an idle twitch |
| `aim` | six frames from two aim clips |
| `look` | six frames from two look clips |
| `grip` | finger poses |

The far view drops `move_dip`, `twitch_layer` and `grip`.

Encounters hold 16 to 30 combatants. To fit, objects update less often, "sometimes as low as 4 Hz".

## Factions

**Faction belongs to the object, and relations are global.** The PS4 client has two tables.

| table | size | role |
|---|---|---|
| faction allegiance | 64 bytes | authored faction pairs |
| faction lookup | 1,500 bytes | each object's faction |

- Package data fills the allegiance table: the loader clears it, then inserts the authored pairs.
- A relationship reader feeds the object-faction filter.
- When an object is set up, it reads its faction from its definition and writes it to the lookup
  table.
- The faction setter at run time updates the faction table and the actor's own byte, then publishes
  the changed replicated field. It needs no separate faction state from a server.

This is not a per-squad AI mode. It does not by itself make an enemy passive until damaged.

## Object filters

Objects are matched by filters: lists of small predicates over an object, combined with AND or OR.
Destiny 1 has the same 21 filter types as Destiny 2, in one registry with two registration sites.
The registry entries, the predicate list and the object handle decode match Destiny 2 PC field for
field. That layout is in [Behaviors: Object filters](/docs/destiny-2/behaviors/#object-filters).

## Not checked

- The action system, the animation rig and the animation layers come from the course only. They
  were not checked against the Destiny 1 code or packages.
- The authored faction pairs and what each relationship value means.
- What each of the 21 filter types tests in Destiny 1.
