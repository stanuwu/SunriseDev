---
title: "Weapons and perks"
date: 2026-10-15
description: "How a weapon is put together from package data: sandbox perks, weapon type, fire rate tables, first-person presentation, firing effects and sounds."
weight: 37
---
A weapon is several kinds of package data joined by indices and hashes. The item definition names
its stats, perks and art. A gameplay entity holds the firing tables, the presentation rig and the
effects. Sandbox perks are small programs of native operations. No native code keys on a weapon
type.

Field and function names are descriptive. Bungie class names quoted here, such as
`c_client_sequence_atom_control`, are the game's own. Item stats and display curves are on
[Items, characters and inventory](/docs/destiny-2/investment-data/#item-stats-and-sandbox-perks).

## Sandbox perks

A sandbox perk has a gameplay row and a display row at the same index, with the same definition
hash. Both tables must grow together.

| table | row size | content |
|---|---:|---|
| gameplay index | 8 | definition hash, an optional `u16` (`0xFFFF`), an active byte at `+6` |
| display index | 24 | definition hash, a runtime gameplay name hash at `+4`, a pointer to display text |

The runtime gameplay name hash resolves through the client's name index to a perk program tag. A
display row with a name does not mean the perk has a program: Heat Sink has an inactive gameplay
row and an empty runtime name. The program format, its lifecycle and its HUD feedback are on
[Behaviors](/docs/destiny-2/behaviors/#perk-programs).

Display text defaults: no string bank `0x0000FFFF`, empty hashes `0x811C9DC5`, no icon `0xFFFF`.
Text `+20` is a presentation hash: 224 rows, including exotic armor effects and Ignition Trigger,
carry `0x85899A33`, which the perk UI compares to show its exotic style. Ordinary perks such as
Outlaw and Rampage carry the empty hash.

An item's display block holds one 32-byte row per gameplay sandbox-perk row, paired by index. A
missing display row leaves an unchecked read.

## Weapon type

No native code keys on a weapon type. A type is three pieces of item data:

| field | meaning | reader |
|---|---|---|
| definition `+164` | FNV-1 of the type identifier, such as `auto_rifle` | objective and bounty filters |
| definition `+224` | trait indices into a 75-row trait table | the UI only |
| display `+144` | the type line, such as "Auto Rifle" | the UI |

Trait names look like `weapon_type.auto_rifle`. The frame, such as "Adaptive Frame", is the weapon's
intrinsic plug: it carries one sandbox perk and no stat, and is shared across weapon types. Exotics
use the same socket for their intrinsic.

Firing, animation, aim and attachment come from the gameplay entity, not from the type. Stock auto
rifles, pulse rifles, scouts and SMGs share entities that all name one translation config.

## Fire rate and the stat tables

The rounds-per-minute stat is stat 14. Inspect turns its value into a display number through a curve.
The firing cadence comes from a separate weapon translation config, built from
`bs\weapons\weapon_translation_assault_rifles.bs`. The two agree only because both were authored to.

The config holds four weapon-type groups of 14 tables. The weapon's gear row picks the group by key.
A key no row holds gives group 0. Each table maps one stat onto rows spread over a stat range, and
may blend the two nearest rows:

```text
position = clamp((stat - min) * (rows - 1) / (max - min), 0, rows - 1) + row_offset
```

The stat is the sum the server sends: the weapon's stat plus its plugs'.

| table | stat | output |
|---:|---|---|
| 0 | RPM | rounds per second, extra bullets per shot, damage per shot |
| 1 | RPM | magazine reference rate, precision multiplier |
| 2 | Range | auto-aim distances |
| 3 | Range | damage falloff start and end |
| 4 | Range | spread |
| 5 | Stability | recoil scales |
| 6 | Zoom | magnification, raw / 10 |
| 7 | Magazine | magazine base, reserve factor |
| 8 | Inventory | reserve multipliers |
| 9 | Handling | ready, stow and aim-down-sights times |
| 10 | Reload | reload duration |
| 11 | Aim Assist | auto-aim angle |
| 12 | Recoil Direction | recoil pattern |
| 13 | Handling, fixed at 50 | zoomed movement penalties |

The refire interval is `1 / rate`. The magazine is `round_half_even(table 7 base * rate / table 1
rate)`. Tommy's Matchbook's 72 rounds are `45 * 12 / 7.5`. A pulse rifle's table holds bursts per
second. Where the burst size comes from is not known.

## First-person presentation

The first-person rig is the player's 72 bones followed by the weapon's own bones, 3 to 14 of them.
Each weapon bone shares its hash, parent and bind pose with the matching presentation bone. The
weapon root is parented to the right palm grip, so the weapon's origin is the right palm. The clips
store the left-hand target in that frame, and a two-bone IK reaches it.

Points in weapon space (+X forward, +Y left, +Z up), on the shared rig:

| point | value |
|---|---|
| right palm | the origin |
| trigger finger joint | (0.042, -0.006, 0.058) |
| left palm | (0.131, -0.017, 0.023) |
| aim line | z 0.1715, parallel to +X |
| bore line | z 0.114 |

A flat aim line is assumed. The weapon's presentation also owns a clip definition with named
entries, looked up by name hash through a query table.

A holographic reticle is a 4-vertex quad in the sight model, at the origin, drawn in render stage
16. Its vertex shader treats the model position as view space and moves it 5.5 units ahead of the
camera, so the weapon pose does not move it. Extern 73 adds a screen offset. The pixel shader
discards pixels without stencil bit 2. Opaque first-person geometry clears that bit, so solid
geometry on the aim line hides the reticle.

### Model scale and bones

The weapon model header's `+0x50`, `+0x60` and `+0x70` become constant rows 4 to 6, uploaded as
constant buffer 11. Header `+0x60` holds the vertex position scale and offset. The bone palette is the
pose times the inverse bind.

Weapon input declarations 137, 139, 141 and 143 share stream 0: `POSITION` as four snorm16, stride 8.
The vertex shader reads the bone index as `ftou(POSITION.w * 32767 + 0.1)` and reads palette rows
`8 + 3i` to `10 + 3i`. The buffer holds 24 rows, so bone indices 0 to 4 fit.

## Firing effects

A weapon's HUD config holds 22 rows of 448 bytes keyed by the gear key. A row names the entities
spawned for a shot:

| row offset | content |
|---|---|
| `+0x60` | the muzzle flash sequence; shell casings are part of it (inferred) |
| `+0x70`, `+0x80`, `+0x90`, `+0xA0` | further effect slots |
| `+0xB0` | the fire sound config |
| `+0xE0` | the HUD silhouette glyph hash |
| `+0xF0` | the projectile, spawned at the barrel once per pellet |

The six slot entities from `+0x60` to `+0xB0` spawn once, at equip, as nodes on the weapon. Every
slot except `+0x90` is then paused. Each shot restarts a slot's sequence by handle. No shot restarts
`+0x90`, so its sequence runs only on its own start flags and channel gates.

A sequence's lifecycle byte decides how it starts and ends. Bit 0 starts it on its first update. Bit
1 deletes the node when every work node is done. A firing slot needs both bits clear: a deleted node
leaves every later restart a dead handle. All stock muzzle slots use `0x08`.

The projectile entity carries the tracer. A tracer trail's colours and widths are constants of its
emitter program, but where they sit differs between emitters. See
[Effects and particles](/docs/destiny-2/effects-and-particles/#emitter-programs).

### Clip events

A clip event of kind 3 names an entity, a frame and an attachment point. It spawns on the object
that plays the clip. For a first-person clip that object is the player, not the weapon. It resolves
the player rig's control names, such as `left_hand`, and not the weapon's points. A missing point
uses the object's own transform. So a clip event cannot place an effect on a weapon point. No stock
weapon places a particle on the first-person gun from a clip event.

### Attachment points

A weapon's attachment points come from its gameplay entity: 64-byte rows sorted by name hash, each
with eligibility bits, a bone, a local transform and a uniform scale. Lookup binary-searches the
whole row array, so rows must stay sorted. The presentation and effect nodes share the gameplay
object, so they read the same points.

The weapon config holds its own barrel set in the same row layout. The barrel mode picks a barrel per
shot: all, cycling or random.

## HUD silhouette

The ammo HUD draws a named icon from the weapon's HUD config, not the inventory thumbnail. The
selected firing row's glyph hash at `+0xE0` keys a HUD icon library of 112-byte rows, sorted by name
hash. Each row names a bitmap.

## Weapon sounds

A weapon reaches its sound events three ways: an animation sound table keyed by event name hash (such
as `reload_1`), play-sound records in its configs, and clip events. A selector config holds a row for
every gear key, and a weapon plays only its own row. Event tags and banks are on
[Audio and music](/docs/destiny-2/audio-and-music/#banks-and-events).

Automatic fire does not post a sound per round. The fire event starts once per trigger hold. Its
containers loop with a trigger-rate transition, and the transition time is an RTPC on
`rate_of_fire`. That `rate_of_fire` is rounds per second is assumed, from installed curves that
break at RPM / 60 values. A stop event stops the loop and plays the tail.

## Open questions

- Where a pulse rifle's burst size comes from.
- What sets `rate_of_fire` at run time.
- The meaning of the fire-rate selector row's bytes and floats at `+20` to `+32`.

## Related pages

- [Behaviors](/docs/destiny-2/behaviors/) -- perk programs.
- [Items, characters and inventory](/docs/destiny-2/investment-data/) -- item definitions, stats
  and sockets.
- [Effects and particles](/docs/destiny-2/effects-and-particles/) -- the sequences firing effects
  use.
- [Audio and music](/docs/destiny-2/audio-and-music/) -- banks and transitions.
- [Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/) and
  [Edit perk behavior](/docs/sunrise-studio/perk-behavior/) -- authoring these formats in Sunrise
  Studio.
