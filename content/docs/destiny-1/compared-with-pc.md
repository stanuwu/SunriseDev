---
title: "Compared with Destiny 2 PC"
date: 2026-10-15
description: "How the Destiny 2 PC build adds the PC features this console build lacks: frame pacing, vsync, mouse and keyboard, resolution and field of view."
weight: 25
---
Destiny 1 is a console build. It has no frame rate setting, no vsync choice, no mouse or keyboard,
no resolution change and no field-of-view setting. The Destiny 2 PC build, 86657, has all of them,
built on the same engine. This page lists what Destiny 2 PC does for each feature and what the
Destiny 1 code has in its place.

## Frame pacing

Both games use the same time control engine. See
[Time and frame pacing](/docs/destiny-1/time-and-frame-pacing/) for Destiny 1's. Destiny 2 PC
changes four things:

- The config comes from the display refresh rate, vsync and the frame cap, not a fixed 30 Hz. It is
  rebuilt when a setting changes.
- Mode 3, capped, drops the vblank phase. The frame interval is 1000 / cap, in ms.
- A variable-step flag is on for clients. Each frame runs one update, with the smoothed real frame
  time as its time step.
- In the background the game is held to 30 frames a second, with a lower cap.

| step | Destiny 2 PC | Destiny 1 PS4 |
|---|---|---|
| config | built from the display settings | literals, built once |
| rebuild on a setting change | yes | none |
| clock | the performance counter, in ms | the time stamp counter |
| frame record | 64 bytes; frame time clamped to 10 s; an average weighted 0.95 / 0.05 | 56 bytes |
| fixed-clock byte | 1 | 1 |
| variable step | on for clients; the time step is a 120-frame average of min(real dt, 1 / max(10, rate)) | absent; the time step is fixed |

Destiny 2 PC has no render interpolation: its frame record holds no blend factor between two ticks.
That rests on absence and is unverified.

Destiny 2 can use a variable step because it counts gameplay time in seconds. Destiny 1 counts it in
ticks, so the same change would speed up every timer. See
[Gameplay time is counted in ticks](/docs/destiny-1/time-and-frame-pacing/#gameplay-time-is-counted-in-ticks).

## Vsync and presenting

| step | Destiny 2 PC | Destiny 1 PS4 |
|---|---|---|
| video settings | 36 settings, among them `vsync_mode` 0 to 5 (default 1), `window_mode` 0 to 3 (default 3) and `framerate_cap` 30 to 10,000 (default 200) | none |
| present | sync interval 0 with vsync off, else 1 to 4; no tearing flag; runs on the window thread | a flip from the GPU submission thread |
| frame latency | 1; 2 or more in window mode 3 | the engine stays at most one flip ahead of the GPU |
| resize | `ResizeBuffers` with one buffer; the game handles Alt+Enter itself | none |

Destiny 1 sets the flip rate to 1 at device start-up. Each flip sets it again from a device field.
The writer of that field was not traced.

Without the tearing flag, variable refresh rate works on Destiny 2 PC only in exclusive fullscreen.
That is unverified.

## Mouse and keyboard

| step | Destiny 2 PC | Destiny 1 PS4 |
|---|---|---|
| raw input | a hidden window, `Tiger Input Window`, takes raw input even without focus | no keyboard or mouse library |
| mouse sample | filled each frame | the same slot exists and is cleared each frame, but nothing fills it |
| device update | one 944-byte double buffer for pads, keyboard and mouse | a double buffer, pads only |
| mouse getter | present | present, with four callers |
| PC gate | none | at least one caller takes the mouse path only when a stub returns true; the stub always returns false |
| keyboard | a key message queue plus a poll of 105 keys | not found |
| cursor | clipped while the game has focus and captures it | none |

The mouse sample has the same layout in both:

| offset | field |
|---|---|
| `+0x00` | x movement |
| `+0x04` | y movement |
| `+0x08` | wheel, in steps of 120 |
| `+0x30` | held-frame counts for 5 buttons |

So Destiny 1 still carries the data path for a mouse. Only the input source is missing.

## Resolution

| step | Destiny 2 PC | Destiny 1 PS4 |
|---|---|---|
| display mode | applied from the settings, with a mode switch | fixed |
| render targets | all released and rebuilt on a change | built once at device start-up |
| render target sizes | size classes from full size down to 1/40, a class 360 high, and a class clamped to 1920 x 1080 | not compared |
| render resolution | a percentage, 25 to 200 | clamped to 320 to 1920 wide and 240 to 1080 high |

Destiny 2 PC imports no DPI-awareness call. That is unverified.

## Field of view

| step | Destiny 2 PC | Destiny 1 PS4 |
|---|---|---|
| default field of view | clamped to 1 to 150 degrees, fallback 1.3439 radians | a matching function exists; the pairing rests on one read |
| aspect fit | Hor+: the horizontal field of view is set for 16:9, turned into a vertical one, then back into a horizontal one for the real aspect | Vert-: the vertical field of view is computed from the horizontal one at the real aspect |
| field-of-view setting | `fov_adjustment_offset`, 55 to 105, default 85 | none |

**Destiny 1 is Vert-.** A screen wider than 16:9 keeps its horizontal view and loses vertical view.
The lens flares and four other functions also read the aspect ratio.

## Other PC features

- Settings are saved as `cvars.xml` in `AppData\Roaming\Bungie\DestinyPC\prefs`.
- The game takes over Alt+Enter and the Windows key. It also has a keyboard hook, not read.

## Not checked

- Destiny 2 PC: the pump loop body, the window procedure, swap-chain creation, the consumer of the
  field-of-view setting, gamepad code, key binding consumers, and interpolation outside time control.
- Destiny 1: the action layer behind input, two of the mouse getter's callers, the render target
  rebuild and free paths, the writer of the flip rate field, whether the input block holds a
  keyboard array, and the UI canvas and letterbox.
- The Destiny 1 Xbox input and present paths.
