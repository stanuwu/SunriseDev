---
title: "Effects and particles"
date: 2026-10-15
description: "How maps and entities place effects: particle nodes, the sequence player, particle locations, systems, emitters and their programs, and lens flares."
weight: 82
---
Effects are package data. An entity carries particle nodes inside a sequence. The sequence decides
when each node plays, and each node names particle systems. A system names an emitter. The emitter
runs a small bytecode program that spawns and moves particles. Lens flares are a separate, simpler
route.

Class ids like `0x80806E28` are package classes. Function and field names are descriptive. Channel
names such as `particle_age` and flow-node class names are the game's own.
[Sunrise Studio](/docs/sunrise-studio/rendering/#particles) draws this data. Its particle drawing is
an approximation, and visual parity is unverified.

## What places an effect

A map places effects in two ways. Both go through the map's placement rows.

| route | carried by | target |
|---|---|---|
| particle nodes | the placed entity's own component configs | particle systems |
| lens flares | a placement resource, class `0x80806CBF`, flare tag at `+0x10` | a flare, class `0x80806F68` |

Every particle node in Leviathan and the EDZ sits in an entity component whose primary class
is `0x808084D7`, the sequence player.

## Sequences

A sequence is a tree of two kinds of node: flow nodes, which decide order, and work nodes, which do
something. A particle node is a work node of type 4.

The sequence player reads a sequence resource, class `0x808084E9`:

| resource offset | field |
|---|---|
| `+0x158` | flow nodes, 24-byte rows pointing at node wrappers |
| `+0x168` | work nodes, the same row shape |
| `+0x188` | channels, 40-byte records, name hash at `+0x20` |
| `+0x1A0` | the location table; see "Particle locations" |
| `+0x2D0` | the root: kind (0 flow, 1 work, `0xFF` none) and index |
| `+0x2D8` | the sequence's end condition |
| `+0x2E0` | flags: bit 0 starts on spawn, bit 1 destroys the object when the root ends, bit 2 detaches it from networking |
| `+0x2E1` | an importance threshold; the player pauses while the object's importance is below it |

A channel is an object variable. That an unset channel reads 0 is assumed.

### The node header

| body offset | field |
|---|---|
| `+0x00` | name hash, FNV-1, for example `flames` or `sparks` |
| `+0x04`, `+0x06` | parent kind (`0xFF` for the root) and parent index |
| `+0x08` | flags; `& 0x18` means no timer |
| `+0x0C`, `+0x10` | start delay, shortest and longest |
| `+0x14`, `+0x18` | duration, shortest and longest |
| `+0x20` | type byte |
| `+0x21`, `+0x22` | repeat count and loop flag, flow nodes only |
| `+0x28` | flow nodes: children as `{u16 kind, u16 index}` |
| `+0x38`, `+0x40` | flow nodes: start and end conditions |
| `+0x48` to `+0x50` | type-6 flow nodes: range minimum, maximum and channel index |

A work node runs its delay, then its duration, or no timer at all. On timeout it ends and tells its
parent. Work nodes have no start condition. There are 72 work node types. Type 4 is the particle
node.

### Particle nodes

A particle node is an inline struct inside an entity config, class `0x80806CC6`, 296 bytes. Its body
is the shared node header above. It adds:

| body offset | field |
|---|---|
| `+0x30` | rows of 24 bytes: a byte array of location indices at `+0`, a particle-system tag at `+0x10` |
| `+0x40`, `+0x88`, `+0xD0` | three expressions, each a byte code array then a vec4 constant array |

No node field holds a position, rotation, scale or bone. The rows place the node; see "Particle
locations". A row can hold `0xFFFFFFFF` instead of a system tag. Its config then lists several
systems as variants, in the shape entity models use for material variants. How the runtime picks a
variant is unverified.

### Flow nodes

The type byte picks the class. Counts are over all 81,212 installed flow nodes.

| type | nodes | behavior |
|---:|---:|---|
| 0 | 4,791 | serial: each child starts when the one before ends |
| 1 | 52,572 | parallel |
| 2 | 1,046 | random: starts one child, picked by weight |
| 3 | 1,002 | starts its children and ends at once |
| 4 | 8,677 | parallel |
| 5 | 2,742 | parallel |
| 6 | 10,382 | channel gate: children start when a channel enters `[min, max)` and stop when it leaves |

A channel gate re-arms when its loop flag is set.

A condition is `{u8 kind, f32 min, f32 max, i32 channel}`:

| kind | true when |
|---:|---|
| 0 | the channel is in `[min, max)` |
| 1 | a bit is set in a per-object bitset; unverified |
| 2 | never |
| 3 | a component filter passes |

Every installed flow start condition is kind 0. It is sampled when the node starts or restarts.

### What starts a sequence

| start | how |
|---|---|
| spawn | flag bit 0, unless a per-spawn override turns autoplay off |
| gameplay | a play call (42 callers) or a restart call (13 callers) |
| effect spawn | autoplay off, destroy at end, up to six initial channel values, then play |

A node plays when its sequence plays and every flow node above it lets it through. A node under a
loop flag restarts. A node with no timer runs until stopped. A node with neither plays once.

Of 15,786 installed sequences, 13,419 start on spawn. The channels most often gating a node closed at
zero are `alive`, `vehicle_power`, `device_position`, `emote_active`, `power_anim`, `damage_type`,
`treasure_chest_looted` and `weapon_firing`. An animation clip lists channel names. That a playing
clip writes them is assumed.

## Particle locations

A particle node places its systems through the sequence's location table. Each node row holds a
byte array of location indices and a particle-system tag. Row byte `k` gives the frames for emitter
transform slot `k`.

| table offset | element |
|---|---|
| `+0x10` | a location, 6 bytes: first frame slot, count, first source, source count, flags |
| `+0x20` | a location source, 16 bytes: kind, cache slot, count, flags, name hash at `+8`, sub-object at `+12` |
| `+0x30` | one FNV-1 name per location; no known reader |

| source kind | frame |
|---:|---|
| 0 | the object's world transform, or a sub-object's |
| 1 | identity, so the frame is the world; named `world_space` |
| 2, 4 | the attachment points with the source's name hash on this object |
| 3 | the same lookup in a second pose mode; on a first-person weapon it lands on the first-person gun, and kind 2 on the world weapon |
| 6 to 8 | an attachment point on a linked object |
| 10 | `back`: the object frame turned 180 degrees about its Z |
| 11 | up: the object position with an upright frame |
| 12 | down |
| 13 to 25 | runtime frames such as the camera, a projectile target or a beam target |

Kinds 5 and 9 are not decoded. The empty-name hash `0x811C9DC5` gives the object transform. Source
flag `0x80` rebuilds a frame upright while keeping its position.

Each source kind uses one flags value at source `+4`, with or without the `0x80` bit. The location's
own flag byte holds the same value. What each bit selects is not decoded.

| kind | flags |
|---:|---|
| 0 | `0x3F` |
| 1 | `0x5F` |
| 2, 6 | `0x3C` |
| 3, 7 | `0x22` |
| 4, 8, 17 | `0x36` |
| 5 | `0x23` |
| 9 to 12 | `0x3F` |
| 13 | `0x3E` or `0x3C` |
| 14, 15 | `0x3E` |
| 25 | `0x26` |

### Attachment points

An attachment point set belongs to the placed entity, not to the sequence. It holds 64-byte rows
sorted by name hash, so several rows can share a name:

| row offset | field |
|---|---|
| `+0x00` | enable bit index |
| `+0x04` | node (bone) index |
| `+0x10` | rotation quaternion |
| `+0x20` | translation, then uniform scale at `+0x2C` |
| `+0x30` | FNV-1 name hash |

A name that repeats gives one frame per row. That is how an effect sits on both sides of an entity:
two rows of one name, never a mirrored frame. A Hydra's two `primary_trigger` rows put one muzzle
effect on each gun.

### Frames and instances

A location joins the frames of its sources up to its count. A point source gives one frame per row
of its name, and skips a row whose enable bit is clear. A lookup that finds no row gives no valid
frame.

A system runs one instance per valid spawn frame. Instance k takes spawn frame k, and simulation
frame k while there are enough simulation frames, else the first one. A spawn location whose point is
missing therefore emits nothing. Each instance emits at the full rate. That the count is not split is
assumed.

CPU particles are stored in the simulation frame. So a system that spawns and simulates in one
moving location keeps its particles with it. One that simulates in `world_space` leaves them where
they spawned. This storage rule is unverified. The `inherit_parent_velocity` channel adds the
parent's velocity at spawn. A burst on a moving weapon point follows the gun in game when that
channel is 0.

## Particle systems

Class `0x80806E28` is the particle system. All 29,785 installed tags are 52 bytes.

| offset | field |
|---|---|
| `+0x00` | emitter, class `0x80806E2C` |
| `+0x04`, `+0x08`, `+0x10` | compute materials, when GPU-simulated |
| `+0x14` | raster material |
| `+0x18` | a list of entity models |
| `+0x1C` | a material |
| `+0x20` | a hash |

About a quarter of systems simulate on the GPU with `cs_5_0` compute shaders. The raster vertex
shader reads per-particle data from vertex streams whose layout is not decoded.

## Emitters

Class `0x80806E2C` is the emitter: 26,250 installed tags, struct size 336.

| offset | field |
|---|---|
| `+0x08` | channel constants, vec4 array |
| `+0x18` | the slot list, one row-byte index per entry |
| `+0x28` | `{first, count}` groups over the slot list |
| `+0x38` to `+0x3F` | the spawn group, the simulation group and two more |
| `+0x40`, `+0x41` | transform slots: the spawn frame and the simulation frame |
| `+0x44` | u16 flags; `0x200` and `0x400` interpolate the spawn frame, `0x2000` picks grid cells at random |
| `+0x47` | total transform slots, at most 7 in the install |
| `+0x50` | the emitter program, bytecode |
| `+0x60` | the program's constants, vec4 array |
| `+0x70` | eight stage lengths; they sum to the program length |
| `+0x80` | 55 channel records `{group, slot}` |
| `+0x100` | small indices, 0 to `0x14`; not name hashes |
| `+0x115` | spawn shape |
| `+0x116` | spawn direction |
| `+0x141`, `+0x142` | vec4s per particle in streams 0 and 1 |
| `+0x149`, `+0x14A` | nonzero when acceleration 0 or 1 is authored in the emitter frame |

The 55 channels follow a fixed name list in the executable, from `particle_age` to
`emitter_grid_count`. The first ones are `particle_age`, `particle_random`, `particle_system_age`,
`particle_system_random`, `particle_emit_time`, `particle_lifetime`, `particle_position`,
`particle_velocity`, `initial_particle_position`, `initial_particle_velocity`, `emission_rate`,
`emitter_shape_scale`, `emitter_angle`, `emitter_radius`, `emitter_length`, `initial_speed`,
`initial_particle_count` and `particle_max_count`.

A channel record names a stream group and a float index into it. Group `0xFF` marks an unused
channel.

| group | holds |
|---:|---|
| 0, 1 | the particle's own two streams; position and velocity use group 1 |
| 2 | spawn scratch for the system; `initial_particle_position` always uses it |
| 4, 5 | the system instance; `particle_system_age` uses group 5 |
| 6 | the emitter's channel constants at `+0x08` |

A transform slot below the node row's byte count takes that row byte's frames. A slot at or above it
is a program slot: only the emitter program writes it. Program slots are common, most of all on
GPU-simulated systems.

## Emitter programs

The emitter program is the same kind of stack machine as the TFX interpreter on
[Rendering](/docs/destiny-2/rendering/#the-tfx-interpreter), over 32 vec4s. Opcodes `0x01` to `0x3B`
run the same math as TFX. The program is split into eight stages:

| stage | runs |
|---|---|
| 7, then 0 | once, when the system is created |
| 1 | once per system frame, before emission |
| 6, then 2 | before each spawn |
| 3 | for each new particle, after the spawn shape is sampled |
| 4 | for each CPU particle, each frame |
| 5 | for distance emission |

The emitter's own opcodes include:

| byte | operation |
|---|---|
| `0x07` | one in lanes equal to zero, else zero |
| `0x08`, `0x09` | min, max |
| `0x11` | lerp, then clamp to 0 to 1 |
| `0x14` | smooth step |
| `0x15`, `0x16` | absolute value; sign, keeping zero |
| `0x18`, `0x19` | ceiling; round to nearest even |
| `0x1B`, `0x1C` | normalize over four lanes or over XYZ |
| `0x1E` | sine wave: the `0x1F` wave without its quarter-turn offset |
| `0x2C` | rotate a vector about an axis by an angle in turns |
| `0x2F` to `0x33` | the curves `0x37` to `0x3B`, with the table on the stack |
| `0x36` | `0x35`, then clamp to 0 to 1 |
| `0x3D` | push a random value in 0 to 1 |
| `0x3E g s c`, `0x3F g s c` | load or store stream group `g` vec4 `s` in lane form `c` |
| `0x40`, `0x41`, `0x42` | write a transform slot, its position, or its rotation |
| `0x43` to `0x45` | push extern floats or vectors |
| `0x46`, `0x47` | push an object channel, or a hash-named one; zero when unbound |
| `0x48` | push zero |
| `0x49` to `0x4B` | read a transform slot |
| `0x4C` to `0x52` | move, lerp and turn transforms |

Byte `0x00`, byte `0x3C` and bytes above `0x52` end the stage. A transform is two vec4s: a rotation
quaternion, then a position with uniform scale in W. On the stack the position sits under the
rotation.

Load lane forms are xyzw, xyzz, xyxy, zwzw, xxxx, yyyy, zzzz and wwww. Store lane forms write all
lanes, xyz, xy, the source XY into ZW, or the source X into one of X, Y, Z or W.

Random values come from `s = 1664525 s + 1013904223`, taking the high 16 bits over 65,535. The spawn
samplers use the same generator. Extern float 0 is the wrapped simulation time, floats 1 to 4 are the
other frame clock values, float 5 is 1/30 and float 6 is 1/60.

### Spawn and update

Each frame adds `emission_rate` times the frame time to a carried fraction and spawns the whole
part. `initial_particle_count` spawns once. `particle_max_count` caps the live total; zero means no
cap. The system frame advances `particle_system_age` by the frame time over the system's duration,
clamped to 1.

A spawn runs in this order:

1. Set the particle's age to 0 and write its emit time and spawn id.
2. Run stages 6 and 2.
3. Pick a point by the spawn shape and a direction by the spawn direction, scaled by
   `initial_speed`. Write them to `initial_particle_position` and `initial_particle_velocity`.
4. Run stage 3. Spawn programs usually copy the initial values into `particle_position` and
   `particle_velocity`.
5. Move position and velocity into the simulation space by the spawn frame. Add the parent's
   velocity through `inherit_parent_velocity`.
6. Set the camera distances, a zero `angular_position`, and `angular_velocity` from
   `initial_rotation_rate`.

| spawn shape | point, scaled by `emitter_shape_scale` |
|---:|---|
| 0 | the origin |
| 1 | a ring of radius `emitter_radius` in the YZ plane |
| 2 | a sphere surface of radius `emitter_radius` |
| 3 | a segment along Y of length `emitter_length` |
| 4 | a cube of edge `emitter_length` |
| 5 | grid cells, `emitter_grid_count` per axis |

| spawn direction | direction before `initial_speed` |
|---:|---|
| 0 | random in a cone of half-angle `emitter_angle` degrees about +X |
| 1 | tilted `emitter_angle` degrees from +X toward the spawn point |
| 2 | random over the sphere |
| 3, 4 | from the origin toward the spawn point |

Each update advances the particle's age by the frame time over `particle_lifetime`, clamped to 1,
and runs stage 4. Then the native code integrates:

- `gravity_strength` times a system scale pulls along world -Z.
- Two accelerations add direction times strength times the frame time. A direction is in world space
  unless the emitter marks it as emitter-frame.
- `air_friction` times the frame time, clamped to 0 to 1, removes that share of the velocity.
- The position moves by the new velocity times the frame time.
- `angular_velocity` gains `rotational_acceleration` and loses its `rotational_friction` share.
  `angular_position` gains the velocity times 2 pi times the frame time, so the velocity is in turns.

The simulation space is the frame of slot `+0x41`. World directions and gravity are turned into it by
the inverse of that slot.

## Lens flares

A lens flare, class `0x80806F68`, holds 12-byte rows: a material, a parameter block and a flag. The
flare vertex shader builds a screen-space quad at a fixed clip depth of 0.99. The lens-flare role is
assumed from that shader.

## Counts

| map | placements with particle nodes | particle nodes | GPU-simulated systems | lens flares |
|---|---:|---:|---:|---:|
| Leviathan | 502 | 551 | 182 | 1,610 |
| EDZ | 1,251 | 2,914 | 1,189 | 2,202 |

## Open questions

- The helpers of opcodes `0x2B`, `0x2D` and `0x50`, the gravity scale, and the writer of
  `particle_random`.
- The particle stream layout the raster shader reads, and the GPU path's constant buffers.
- The runtime choice between particle-system variants.
- Which gameplay code plays the sequences that do not start on spawn.
- Who writes the gate channels, and condition kinds 1 and 3.
- Location kinds 5, 9 and 13 to 25, and the meaning of the location and source flag bits.
- Which skeleton a point's node index counts in.
- Where missing point hashes such as `0x60FECDD4` live at run time.

## Related pages

- [Rendering](/docs/destiny-2/rendering/) -- TFX, materials and object channels.
- [Weapons and perks](/docs/destiny-2/weapons-and-perks/) -- muzzle flashes and clip events.
