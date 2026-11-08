---
title: "Play and export audio"
description: "Play and export game audio, and preview music compositions, playlists and transitions."
weight: 225
group: "Guides"
---
The **Audio** page opens installed events, banks and streams. You can play a track, export it, and
preview how the game's music system would mix it. Audio is view only. This page writes nothing into
packages, and **New** and **Clone** in the **Audio** category are gray. To change sounds in game, see
[Replace the weapon's sounds](/docs/sunrise-studio/exotic-weapon/#replace-the-weapons-sounds).
[Audio internals](/docs/sunrise-studio/audio-internals/) has the timing rules.

Studio decodes and mixes audio itself. It needs no other program.

## Play a track

1. In the Assets tab, open the **Audio** category and click an event, bank or stream. It opens on
   the **Audio** page. The **Type** filter picks **Event**, **Bank**, **Init bank** or **Stream**.
   **Event timing** and **Event shared** rows do not open on the **Audio** page.
2. If the page asks, press **Load audio**.
3. Click a row under **Tracks and effects**. **Find track or composition** filters the list.
4. Press **Play**.

| control | effect |
|---|---|
| **Play** / **Pause** | starts or pauses playback |
| **Stop** | stops playback |
| **Prepare WAV** | decodes without playing |
| **Volume** | playback volume |
| position slider | seeks |

Duration and format load when you select a row. Nothing plays until you press Play.

## Media Studio cannot play

Studio plays Wwise Vorbis and 16-bit PCM. Every installed stream that holds audio is Wwise Vorbis.
For anything else, the page shows one of these messages instead of playing.

| media | message |
|---|---|
| a 1-byte placeholder stream | `Empty placeholder stream (no audio)` |
| data in a bank that is not a media file | `Not playable media` |
| big-endian media | `Big-endian (RIFX) media is not supported` |
| IMA ADPCM, xWMA, XMA2, AAC, DSP ADPCM, HEVAG, ATRAC9, Opus or PTADPCM | `<codec> audio is not supported`, for example `Opus audio is not supported` |
| any other codec | `Codec 0x<tag> is not supported`, with the format tag in hex |
| PCM that is not 16-bit | `<bits>-bit PCM is not supported` |
| PCM with an unknown header size | `This PCM layout is not supported` |
| Vorbis from Wwise older than 2012 | `This Wwise Vorbis layout is not supported (older than Wwise 2012)` |
| a damaged stream | the fault, for example `Vorbis packet is truncated.`; an unexpected decoder fault starts with `Audio stream is damaged: ` |

A composition can also hold a part Studio cannot render. The **Routing** section marks it
`-- not playable:` and the reason. Play and Prepare WAV show the reason.

| part | message |
|---|---|
| a sound made by a Wwise generator plug-in, such as SoundSeed Air or Synth One | `Generator plug-in: needs the Wwise engine` |
| a sound with no source | `Sound <id> has no source.` |
| an object from a bank that is not loaded | `Object <id> is not in the loaded banks.` |
| an event from a bank that is not loaded | `Event <id> is not in the loaded banks.` |
| a music object from a bank that is not loaded | `Music object <id> is not in the loaded banks.` |
| an object type Studio does not preview | `Object type <type> is not previewed.` |

The Wwise Silence plug-in plays as silence of its authored length.

## Export audio

| menu item | writes |
|---|---|
| **Export** > **WAV...** | the prepared audio as 16-bit PCM, mono or stereo |
| **Export** > **WEM...** | the original media bytes of the selected track |
| **Export** > **Composition WAVs and routing...** | the media, the banks, one WAV per composition and `routing.txt` |

**Export** > **Composition WAVs and routing...** writes the `.wem` and `.bnk` files, then a
`compositions` folder with one 48 kHz stereo WAV per composition. `routing.txt` lists the routing
of every composition. A composition Studio cannot render gets no WAV, and `routing.txt` gives the
reason.

**Export** > **WAV...** works after you play or prepare a track, composition or timeline.
**Export** > **Composition WAVs and routing...** works after you build composition previews.
Exports are refused inside the installation and inside a project.

Working files live in `%LOCALAPPDATA%\Sunrise Studio\Cache\Audio`. Studio removes them when you close
the asset.

## Preview compositions

An event combines several tracks. Studio can resolve it into compositions. A bank lists the
compositions of each of its events.

1. Open an event or a bank.
2. Press **Build composition previews**.
3. Click a row under **Compositions**.
4. Press **Play**.

To change the preview:

1. Open **Composition controls**.
2. Press **Read music routing**.
3. Set the controls below.
4. Press **Render choices**.

| control | effect |
|---|---|
| **Preview loops** | how many times an infinite loop plays |
| **Initial delay** | keeps the authored start delay |
| **Effect gain** | applies supported effect volume |
| **Random variants** | one composition per item of a random container; off plays the first item |
| state and switch lists | the authored choice to use; **Automatic** makes one composition per value |
| **Game parameters** | tick a parameter and set its value |

Choose every state or switch a nested route needs. Authored gain is kept, not normalized. The
**Routing** section shows each composition as a tree of events, containers and media. **Composer
notes** lists Studio's notes.

## Play a music playlist

1. Open **Composition controls**. Press **Read music routing** if it is shown.
2. Under **MUSIC TIMELINE**, choose a **Playlist**.
3. Choose where to **Start at**, or **Beginning**.
4. Set a **Variation** number for random branches.
5. Press **Play next**, or **Prepare next play** to render without playing.

Each play moves the playlist on, as the game would. **Reset history** starts over. **Export** >
**WAV...** exports the prepared timeline. **Timeline** lists its segments. **Clip envelopes** draws
each clip's volume and fade curves. Hover a curve to read its gain and time.

## Audition a transition

1. Open **Composition controls**. Press **Read music routing** if it is shown.
2. Open **Transition audition**.
3. Choose the **Container**.
4. Choose the **Source** segment, or **Nothing** for a start transition.
5. Choose the **Destination**, or tick **Playlist destination** and choose a playlist.
6. Type **Change after (s)**: when the change is requested, from the source's entry cue.
7. Press **Play transition**, or **Prepare transition** to render without playing.

**Source cues** lists the source's named cue positions. **Destination variation** picks a repeatable
choice where the destination is random. The audition follows the authored transition rule. It does
not simulate the game's state changes.

## Limits

- Music plays dry, in timelines, transitions and compositions: no effects, RTPC curves or state
  gains. The report lists what was left out.
- Compositions apply volume only: authored volume, the chosen game parameters and Wwise Gain
  effects. Pitch, filters, panning and other effects are not applied.
- The music timeline refuses random step playlists and randomized loop counts. A composition plays
  one pick of a random step playlist instead, not the game's random choice.
- Full Wwise engine playback is not implemented.
- Sound authoring covers weapon sounds only. See [Replace the weapon's sounds](/docs/sunrise-studio/exotic-weapon/#replace-the-weapons-sounds).
- A composition or timeline longer than 20 minutes is refused.
- The media of one selection, and each decoded WAV, are limited to 512 MiB.
- Only Wwise Vorbis and 16-bit PCM play. See [Media Studio cannot play](#media-studio-cannot-play).
