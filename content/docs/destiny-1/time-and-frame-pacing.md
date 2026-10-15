---
title: "Time and frame pacing"
date: 2026-10-15
description: "How the engine paces frames at 30 Hz, turns frame time into ticks, and counts gameplay and UI time."
weight: 20
---
The game runs at a fixed 30 ticks a second and one tick a frame. Gameplay time is counted in ticks,
not seconds. A slow frame slows the game down; it does not catch up.

The same "time control" engine is in all four builds checked: Destiny 1 PS4, Destiny 1 Xbox,
Destiny 2 PS4 and Destiny 2 PC. They share the config struct, the pump loop, the tick accumulator
and the published frame record. How Destiny 2 PC changes it is in
[Compared with Destiny 2 PC](/docs/destiny-1/compared-with-pc/).

## The config

The config is built from literals at start-up and never rebuilt.

| field | value | meaning |
|---|---|---|
| mode | 1, 2 or 3 | 1 server, 2 frames phased to the display's vblank, 3 capped |
| `+0x08` | 33,366 us | the frame interval, and also the tick interval |
| `+0x10` | 15,000 us | the minimum gap between two resource event jobs |
| `+0x38` | 30 | the tick rate |
| `+0x40` | 33,333 us | the time step of a queued tick |

The literal list also holds the 59.94 Hz refresh period, 16.683 ms, and 21.683 ms.

**One field is both the frame interval and the tick interval.** The pump reads `+0x08` as the frame
interval. Two getters read it as the tick interval, as seconds per tick and ticks per second, and
only the tick accumulator calls them. Destiny 2 PC has the same coupling.

The 15 ms field matters to any change of frame rate. The frame body starts the
`resourcerer process events` job at most once per 15 ms, and only when the last one has finished.
Above about 66 frames a second it no longer runs every frame.

## The pump

The main thread, `TIME_CONTROL`, runs the outer loop.

1. The next deadline is the last frame start plus the frame interval.
2. When the deadline is 3 ms or more away, the thread sleeps on a semaphore for that time minus
   1.5 ms. Closer than that, it spins with `pause`.
3. A frame starts when the deadline is within 13 us.
4. While a frame job runs, the thread waits on the job and pumps the network in between.

The clock is the CPU's time stamp counter. If a tick is queued, the pump does not wait for the
deadline: the next frame starts at once.

## Ticks

Each frame, the accumulator turns frame time into ticks:

```c
ticks = trunc(scale * dt * rate + carry);   /* capped at 10 */
```

The carry is stored before the fixed-clock test below, so the accumulator always runs.

**A fixed-clock byte overrides the result.** It is set to 1, so every frame runs exactly one tick
with the fixed time step. The byte changes only the frame's time step and tick count. The
accumulator's own output is still recorded. A second flag forces the game time step to one tick and
the accumulator's tick count to 1. Destiny 2 PC keeps its twin of the fixed-clock byte at 1 too.

With the fixed-clock byte at 1, a frame that takes longer than 33 ms still advances one tick. That
is why the PS4 game slows down under load instead of skipping ahead.

With the byte at 0, the accumulator's count stands. When more than one tick is due, one runs now and
the rest queue, one a frame. The game then catches up instead of slowing down. A frame that runs a
queued tick skips input sampling.

### Frame instances

Each frame has a 72-byte frame instance, named `Fiber Frame Time Info`. Its `+0x40` counts queued
ticks, and `+0x38` takes the queued tick's time step from the config.

## The frame record

The frame body publishes a 56-byte record. Two copies alternate, and a byte after them names the copy
just written.

| offset | type | meaning |
|---|---|---|
| `+0x0C` | float | frame time in seconds |
| `+0x10` | float | game time step in seconds |
| `+0x14` | int32 | ticks this frame |
| `+0x18` | int32 | accumulator ticks, before the fixed-clock override |
| `+0x28` | byte | ticks > 0 |
| `+0x29` | byte | 0 on a frame that runs a queued tick |
| `+0x2A` | byte | the tick runs |
| `+0x2B`, `+0x2C` | byte | no queued ticks |

## Gameplay time is counted in ticks

The tick counter has 366 callers. Conversions between seconds and ticks at the current rate have
about 360 more. The time globals are 24 bytes: the rate, 30, taken from the world options, and
1 / rate.

A Destiny 1 log line shows it: `game ticks %d - start ticks %d > timeout (%d) ticks`. Destiny 2 PS4
has the same check in seconds: `game time %s - start time %s > timeout (%0.3f) seconds`.

Some timers are literal tick counts, such as a 150-tick countdown. A full scan for them was not done.

The fixed tick runs through the rest of the engine:

- Havok steps once per tick, with the tick interval as its time step.
- Input builds one record per tick.
- A time-scale ramp rewrites the rate fields while it runs. No writer of the ramp was found.

**Destiny 2 changed the time base.** It counts gameplay time in seconds, in units of 1/673,200 s, and
each step carries its own time step. Destiny 2 PS4 already has that clock and a variable-step branch,
compiled in but turned off. Most of its gameplay reads the clock and rarely the tick counter.

So a variable time step cannot simply be switched on in Destiny 1. Every tick-based timer would run
faster as the frame rate rises.

## The UI clock counts whole milliseconds

The UI has its own 32-bit clock in milliseconds. Once a frame, the UI update adds
`trunc(dt * 1000)` to it. That is the clock's only add while the game runs.

**Each frame drops the part of the frame time below 1 ms.** At 30 frames a second a frame is
33.37 ms and counts 33, so the UI clock runs at 0.989 seconds per second. The loss grows with the
frame rate:

| frames a second | frame time | counted | UI time lost |
|---|---|---|---|
| 30 | 33.37 ms | 33 ms | 1% |
| 144 | 6.93 ms | 6 ms | 13% |
| 240 | 4.16 ms | 4 ms | 4% |
| 1,000 or more | 1 ms or less | 0 or 1 ms | up to all of it |

At 1,000 frames a second and above, the UI clock stops. The Bungie logo screen at boot then never
ends. On the PS4 the game never runs fast enough for this to show.

The UI clock has three readers: the current time, the time this frame, and a copy of the current
time.

## Not checked

- Whether rendering frame N overlaps gameplay frame N + 1.
- Who else signals the pump's semaphore.
- Whether network messages carry tick numbers.
- The full set of literal tick counts, and animation and AI timing one system at a time.
- The time units of the Activity Host's timers.
