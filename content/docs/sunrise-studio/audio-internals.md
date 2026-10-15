---
title: "Audio internals"
description: "How Studio reads Wwise banks, mixes music timelines, times transitions and builds weapon sound banks."
weight: 620
group: "How it works"
---
The game's audio is Wwise version 113. Studio reads the banks, decodes the media and mixes the
result with its own code. It runs no external program. None of this is the Wwise engine.
[Play and export audio](/docs/sunrise-studio/audio/) covers the steps.

## Decoding media

Every installed stream that holds audio is Wwise Vorbis. Wwise strips the standard Vorbis headers
to save space:

- The format chunk holds the sample count, the two block sizes and where the setup and audio start.
- The setup packet names its codebooks by number in a shared library instead of storing them.
- Each audio packet leaves out the packet type and window flags that standard Vorbis stores.

Studio rebuilds a standard Vorbis setup from the stripped one. Its own Vorbis decoder, a C# port of
libvorbis, then reads the stripped audio packets directly. A stream with more than two channels is
mixed down to stereo with vgmstream's speaker matrix. The result is 16-bit PCM. Studio's own weapon
sound banks hold 16-bit PCM, which needs no decoding.

Duration and format load on selection. Studio reads them from the format chunk and checks the
rebuilt setup, without decoding audio.

## The codebook library

Wwise Vorbis setups name codebooks from a library of 598 books. Studio embeds its own copy. It is
packed from the encoder codebooks of libvorbis 1.3.7 or aoTuV 6.03. Both are BSD licensed, and both
give the same file. Each book equals the book with the same number in ww2ogg's aoTuV 6.03 codebook
file, compared after unpacking. The installed streams use books up to number 445 (unverified).

## Reading banks

The reader checks event media arrays, bank identities, HIRC record bounds and embedded media slices.
External media lookup supports version 113. Other versions keep their embedded media and report the
missing lookup.

Studio's bank reader decodes every version 113 HIRC object a composition needs: events, actions,
sounds, random and sequence containers, switch and layer containers, buses and the music objects. It
reads the selected bank and the two init banks together.

## Compositions

The event composer follows an event the way the game would start it:

1. Each Play action of the event, after its delay.
2. The object the action plays: a sound, a container or a music object.
3. Each child of a container, down to the media.

| object | plays as |
|---|---|
| sound | its media, with its loop count, start delay and volume |
| layer container | every child at once |
| continuous random or sequence container | every item in authored order, with the container's loops and transition |
| step random or sequence container | the first item; **Random variants** gives one composition per item |
| switch or state container | the chosen value; **Automatic** gives one composition per value. A value listed with no children plays nothing; an unlisted or unset value plays the default |
| music object | a music timeline, as below |
| Wwise Silence plug-in | silence of its authored length |

Each path through switches, states and random items is one composition. Paths that play the same
media in the same order merge into one; its routing names the others. A bank lists the compositions
of each of its events. A randomized range uses its midpoint. A random step music playlist plays one
pick, not the game's random choice. A music switch path that leads to no music is a silent
composition.

A sound's volume adds its authored volume, the chosen game parameters and Wwise Gain effects, up its
parents and down its output buses. Pitch, filters and other effects are not applied. The mixer is the
one music timelines use. Authored gain is kept and not normalized. Decoded sources are not clipped
before their gain, as in the game; only the final mix clips.

A sound is placed on the two channels as the game places a 2D sound. Its positioning comes from the
nearest object up its parents that overrides positioning. With that object's 2D panner on, the
left-right pan sets the left and right levels for mono and stereo sources alike; a centred stereo
source plays 3 dB lower on each side. With the panner off, a mono source plays at -3 dB on each
channel and a stereo source plays unchanged. A 3D sound plays as with the panner off, because a
preview has no listener position. Music tracks follow the same rule, from the track up through its
segment and playlist.

## Music timelines

The timeline mixer keeps entry and exit cue timing, including audio that plays before entry and after
exit at the same time as its neighbors.

| supported | detail |
|---|---|
| tracks | normal music tracks, clip trims, whole-source extension loops |
| gain | static voice and bus gains |
| sequences | continuous sequences and exit-marker to entry-marker transitions |
| random playlists | each loop of a continuous random item plays every child once, in a repeatable order |
| clip timing | clip start, source offset and loop length round to whole 48 kHz samples, as the game does |
| fades | all nine native fade curves, and the constant curve 9 in graphs |
| bridges | transition segments with their own fades and pre-entry and post-exit flags |
| clip automation | clip volume, fade-in and fade-out |

Clip automation follows the trimmed clip's clock, keeps sample-rounded control points and the native
interpolation curves. Volume automation stores a gain offset: `-0.5` gives a gain of `0.5`. It is not a
decibel value. Fade automation stores gain directly. The mixer multiplies the clip gains and the
transition envelope. It reports clipping instead of normalizing it.

Bus effects, RTPC curves and state gains left out of the dry mix are listed in its report.

## Playlist steps

A sequence-step container plays one child per play and moves its cursor after each play. The session
keeps one cursor per step container and a play count per playlist. A play moves them only after it
renders. A canceled or failed play leaves them alone. **Reset history** starts over.

A jump to a leaf plays that leaf. A jump to a container resumes its cursor. Either then continues
through the parent in authored order. A preview ends inside an infinite item instead of falling through
to siblings the game would never reach. **Variation** picks a repeatable path through random branches
and respects the avoid-repeat count. It is not the game's random seed.

## Transitions

The selected rule is the lowest match for the segments or their parent containers. **Change after
(s)** is measured from the source's entry cue. **Nothing** as the source auditions a start or stop
transition.

| part | timing |
|---|---|
| source sync | immediate, beat, bar, grid, next cue or next custom cue |
| meter | the source's nearest authored meter override |
| fade-out | ends at the sync point plus its signed offset; its duration sets the start |
| fade-in | starts at the chosen destination position plus its signed offset |
| bridge | entry aligns with the sync point, exit with the destination position |

Beat, bar and grid changes move past an exact request boundary unless the destination uses same-time
entry or cue matching. The sync waits until the authored preparation lead-in fits after the request.
The source exit is a hard limit. A request with no valid point left is refused, not guessed.

## Destination entries

Same-time entry uses the source's entry-relative position, wrapped inside the destination's entry and
exit range. It skips the destination's prefix and turns off pre-entry playback. A bridge changes the
arrival time but does not add its length to that position.

Random cue and random custom cue modes keep named filters and cue matching. **Destination variation**
picks a repeatable candidate. A missing custom match falls back to the entry cue, as the game does.
Leaf jumps work when the chosen destination is the leaf's segment.

## Weapon sound banks

Replacing a weapon sound builds a new version 113 bank from the base event's bank. The steps are in
[Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/#replace-the-weapons-sounds). The
new bank keeps the template's whole tree: containers, loops, actions, volumes and routing.

| part | written |
|---|---|
| bank and event ID | FNV-1 of the lower-case name Studio picks |
| other events | FNV-1 of the name plus the template's ID |
| actions, sounds, containers, layers | FNV-1 of the name plus the template's ID, kept below 2^30 like every installed ID |
| every codec sound | plays the WAV as in-bank PCM, plug-in `0x00010001`, media on 16-byte boundaries |
| release sound | a sound only the paired stop event reaches plays `NAME.release.wav`, when given |
| trigger-rate containers | a `rate_of_fire` curve from 1 to 31 rounds a second, transition time 1/x seconds |
| other objects | copied unchanged |

Play actions are pointed at the new bank. A new ID that collides with another is refused; choose
another name. A template bank with feedback data is refused. The PCM media has a RIFF header the
game's parser accepts, then 16-bit samples, mono or stereo.

## Storage

Working files live in a disposable session folder under `%LOCALAPPDATA%\Sunrise Studio\Cache\Audio`.
Changing the asset stops playback. Closing the session removes its files. Canceling stops only that
operation and leaves no partial output, so the same choices can be tried again. The media of one
selection, and each decoded WAV, are limited to 512 MiB. A composition or timeline longer than 20
minutes is refused.

## Limits

- Full Wwise engine playback is not implemented. Dynamic transitions and effects need a compatible
  Wwise engine and its plug-ins, which Studio does not have. A current SDK is not automatically
  compatible with these older banks. The game's own audio is not used.
- Unsupported automation types are refused. Music timelines also refuse random step playlists and
  randomized loop counts.
- Missing or ambiguous jump targets are refused.
- Alternate initial entries without a source need a separate startup model and are not supported.
