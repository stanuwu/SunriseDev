---
title: "Audio and music"
date: 2026-10-15
description: "The game's Wwise banks, music transitions, random playlists, switches, clip automation and 2D panning."
weight: 88
---
The game's audio is Wwise. Sound events and their banks are package entries. The music engine inside
the client schedules transitions between music segments from bank data. The rules below cover music
cue timing, fades, playlists, switches, clip automation and 2D panning. They do not cover device
buffer timing, plug-in effects or bus parameters.

Field names are descriptive. Curve and sync-type names follow the authored Wwise enums.

## Banks and events

A sound event tag holds:

| field | content |
|---|---|
| `+8` | the Wwise event id, FNV-1 of the lower-case event name |
| `+0xC` | the paired stop event, or `0x811C9DC5` |
| `+0x14` | the bank tag |
| `+0x18` | the streamed media array |

Each event has its own bank, Wwise bank version 113, stored as package type 26 subtype 5. The bank
entry's reference is the bank id. A bank carries byte copies of its routing parents: actor-mixers,
attenuations and states. An event plays only when its bank is loaded with it.

The runtime decodes two codecs itself: PCM and IMA ADPCM. Every installed sound is Vorbis.

The Vorbis decoder writes 32-bit float samples. It does not clip them, so a decoded sample can
exceed full scale until the mix. Voice gain applies before any 16-bit conversion.

Weapon sound wiring is on [Weapons and perks](/docs/destiny-2/weapons-and-perks/#weapon-sounds).

## Music transitions

A transition rule names source and destination segments, then a source fade and a destination fade.
Each fade has a duration, a curve and an offset. The parser converts the offset from milliseconds to
samples. The source fade runs from 1 to 0, the destination fade from 0 to 1.

### Meter and markers

A music node can carry an authored meter: grid period, grid offset, tempo, beats per bar and beat
value. From them the client computes, in sample frames:

| value | formula |
|---|---|
| beat | round `240 / beat_value / tempo * rate` |
| bar | the rounded beat times beats per bar |
| grid period | round `rate * grid_period * 0.001` |
| grid offset | round `rate * grid_offset * 0.001` |

The rounds put a midpoint tie away from zero. A node with no meter of its own inherits its parent's.

A segment holds ordered markers, each `{id, position in ms, optional name}`. The first marker is the
entry and the last is the exit. The ones between are custom cues.

### Where the source leaves

The source leaves at a point chosen by a sync type, measured in frames from entry:

| sync | rule |
|---:|---|
| 0, immediate | the requested frame |
| 1, grid | the first grid point at or after the request |
| 2, bar | the first bar at or after the request |
| 3, beat | the first beat at or after the request |
| 4, next cue | the next marker at or after the request; if a cue filter matches none, the exit |
| 5, next custom cue | the next custom marker after the request; none if no custom marker remains |
| 6, entry | only for a request of zero, outside strict mode |
| 7, exit | the exit |

In strict mode the grid, bar and beat rules move one frame past an exact boundary, and next cue
skips the entry. Grid, bar and beat report no point when the result lies after the exit.
Same-time entry, and entry types 2 and 3 with source-cue matching, turn strict mode off.

### Where the destination enters

The destination rule picks an entry point:

| entry type | candidates |
|---:|---|
| 1, same time | the source's position, wrapped by the destination's length |
| 2 | the entry marker plus eligible custom cues, picked at random |
| 3 | custom cues only, picked at random; the entry if none remain |

A cue filter keeps custom cues with that id. Source-cue matching replaces the filter with the cue the
source left on. A destination can start before its entry marker (pre-entry) only when the selected
position is zero and the entry type is not same-time. An optional bridge segment can play between
the two. The client schedules the source so that the bridge and the destination's lead-in fit after
the request.

A non-zero playlist jump picks a leaf of the destination's playlist by item id before the entry is
chosen.

### Continuous random playlists

A continuous random playlist item (type 2) plays every child once per loop. It keeps a count of
children left in the pass:

- Shuffle mode lowers the count on every pick.
- Standard mode lowers it only on a child's first play in the pass, so repeats do not end the pass.
- Avoid-repeat blocks the last `min(avoid, children - 1)` picks.

When the count reaches zero, a finite loop ends after its loop count. An infinite loop resets the
count and the played set. Blocked children stay blocked into the next pass.

### Music switches

A music switch resolves the current value of each argument through a decision tree. It follows exact
keys first, then the `any` key 0. It returns node 0 when no path matches, when the leaf holds 0, or
when the leaf's probability test fails. Node 0 is a real target: the music transitions to silence
through the normal transition rules. It is not a fallback to another path.

### Fade curves

| id | curve | fraction at progress x |
|---:|---|---|
| 0 | Log3 | `1 - (1 - x)^3` |
| 1 | Sine | a native sine polynomial at `x * pi / 2` |
| 2 | Log1 | `x * (3 - x) / 2` |
| 3 | Inverse S | a piecewise half-sine polynomial |
| 4 | Linear | `x` |
| 5 | S | a native cubic polynomial |
| 6 | Exp1 | `x * (x + 1) / 2` |
| 7 | Sine reciprocal | one minus a native cosine polynomial |
| 8 | Exp3 | `x^3` |

The value is the first endpoint plus the fraction times the endpoint difference. For a falling fade
the client mirrors the curve to `8 - id`, except ids 3 and 5. So an authored Exp1 fade-out uses the
Log1 branch, with a midpoint of 0.375, not 0.625. The native polynomials keep single-precision
operation order. Standard sine and cosine calls give different values.

## Clip automation

A music clip can carry automation curves: `{from seconds, to value, interpolation}` points per clip
and type. The loader converts each time to samples, rounding a midpoint away from zero. Times are
relative to the trimmed clip start, `PlayAt + BeginTrim`, not to the untrimmed source. Source looping
does not reset them.

Type 0 is volume: the curve value plus 1.0 is a linear gain. Clip fades, types 3 and 4, are direct
linear gains. The client multiplies all gains and clamps the product at zero. The bank's static
volume is a separate decibel gain. Types 1 and 2 drive other voice properties.

## Switch containers

A switch container plays the children of one switch or state value:

1. If its value list holds the current value, that value's children play. A listed value with no
   children plays nothing.
2. Otherwise the default value's children play.
3. If the default is not listed either, nothing plays.

So an unset switch or state takes the default path. It is not silence.

## 2D panning

A node's positioning byte decides whether it pans:

| bit | effect |
|---:|---|
| 0 | the node overrides its parent's positioning |
| 1 | the next bit is stored |
| 2 | the 2D panner is on |
| 3 | 3D fields follow |

Bits 1 to 3 are read only when bit 0 is set, and the panner is off by default. A voice walks up its
parents to the first node with bit 0 set, or to the top node. It takes the left-right pan, front-rear
pan, centre percentage and panner flag from that one node. Nothing is summed down the chain. RTPCs
can replace the three pan values.

A voice with no 3D type pans in 2D. The left-right pan, -100 to 100, maps to
`x = clamp(pan * 0.0049999999 + 0.5, 0, 1)`, in single precision. On a stereo output:

| input | panner off | panner on |
|---|---|---|
| mono | `0.70710677` on each side | left `sqrt(1 - x)`, right `sqrt(x)` |
| stereo | each channel to its own side at 1 | left channel `sqrt(1 - x)`, right channel `sqrt(x)` |

So a centred stereo source with the panner on is -3 dB per channel. With a centre speaker and the
panner off, each side gets `sqrt((1 - c) / 2)` and the centre `sqrt(c)`, where `c` is the centre
percentage. Inputs with more than two channels and the panner off use a standard downmix: centre
channels at 0.707 on both sides, LFE dropped, and back and side channels at 0.707 on their own side.

## Open questions

- Audio device timing, plug-in effects and bus parameter evaluation.
- The full Wwise action set.
- Container jumps that need live playlist state.

## Related pages

- [Weapons and perks](/docs/destiny-2/weapons-and-perks/) -- weapon sound events.
- [Packages](/docs/destiny-2/packages/) -- how banks are stored.
- [Play and export audio](/docs/sunrise-studio/audio/) -- playing banks and auditioning
  transitions in Sunrise Studio.
