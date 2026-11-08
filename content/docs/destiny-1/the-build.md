---
title: "The build"
date: 2026-11-08
description: "The Destiny 1 build these pages describe: PS4 version 1.29, its modules and libraries, and the Xbox One build used for cross-checks."
weight: 5
---
Every fact in these pages is about one build: the PS4 executable of Destiny 1, version 1.29. Other
builds are used for names and cross-checks only.

## PS4 version 1.29

| property | value |
|---|---|
| title | `CUSA00219`, the US release |
| version | 1.29 |
| date | September 2016 |
| module name | `tiger_release_final` |
| executable size | 29.1 MB |
| executable SHA-256 | `7271fcb926401df8defb126cb8eb2b247134138b81e401bbacb2ab60791b7954` |
| compiler | Sony's clang toolchain, release build |
| obfuscation | none: no packing and no control-flow flattening |
| class names | full Itanium RTTI, with 1,380 Bungie `c_` and `s_` type names |

The executable is plain. Unlike the Destiny 2 PC build, nothing is encrypted and every string can be
read from the file.

### The three modules

The game ships its own C library and file library. They load next to the executable and bind to it
directly.

| | executable | `libc.prx` | `libSceFios2.prx` |
|---|---|---|---|
| functions | 55,080 | 2,028 | 650 |
| symbols | 787 | 2,171 | 248 |
| imports used by relocations | 655 | 74 | 81 |
| exports | 52 | 2,095 | 165 |
| TLS image size | 8,176 | 1,168 | 64 |

- The executable's imports come from 43 libraries.
- 182 imports bind between the three modules. The rest go to the system.
- The executable's code ends with a PLT of 639 entries. Read-only data follows in the same
  executable segment.
- Every function larger than a leaf stub has unwind data: 54,065 entries, none overlapping.
- C++ exceptions are used in only 33 functions of the executable, with 144 landing pads. `libc.prx`
  has 225 exception tables.
- No code reads its own return address, and the only thread-local access pattern is
  `mov rax, fs:[0]`, 2,542 times.

### Third-party libraries

Most of the image is engine code. These libraries are linked in:

| library | role |
|---|---|
| Havok 2012.2.0 | physics |
| Wwise | audio |
| CRI Movie 3.50 (Sofdec2) | video |
| Demonware, version 45 | online services |
| NP Toolkit | PSN services |
| Oodle | compression |
| libGnm, libGnmx, GpuAddress | Sony's graphics libraries, linked statically |
| libtommath | big-number math |
| Umbra | assumed: one string only |

These libraries make most of the game's system calls themselves. See
[The platform layer](/docs/destiny-1/platform-layer/).

### Video

Movies are CRI USM files: CRI MPV 2.100 video with ADX and HCA audio, decoded in software. The game
imports no Sony video decoder. A read of all 1,647 package files finds 16 USM movies.

Bink is dead code. A function still builds the paths `bink\%s_%d.bik` for `attract_1` to
`attract_3`, `intro`, `credits` and `story`, but it passes them to an empty function.

### What the build does not have

| absent | note |
|---|---|
| a save data library | characters live on the server |
| a keyboard or mouse library | pads only; see [The platform layer](/docs/destiny-1/platform-layer/) |
| a video decoder, microphone input, JPEG or PNG | none of these libraries is imported |
| `libSceFiber` | the job system runs on plain threads |

## The Xbox One build

The Xbox One executable is used to cross-check the PS4 build. It is never a base.

| property | value |
|---|---|
| file | `tiger_release_final.exe` |
| build | 56578 |
| date | 12 April 2017, about 6.5 months after PS4 version 1.29 |
| SDK | Xbox One XDK, November 2015 |
| compiler | MSVC |

- It has no Bungie class names. Its 495 RTTI names all belong to Havok, Demonware, CRI and WinRT.
  The PS4 build stays the source of class names.
- It shares 5,155 log and format strings with the PS4 build. 3,708 of them are used by exactly one
  Xbox function, so they pair functions across the two builds.
- Its `.schmr` section holds the tag schema table. 5,871 schema ids are the same as in the PS4 build.
- 15 built-in shaders carry their HLSL source. The PS4 build has 29 built-in shader blocks, tagged
  `OrbShdr`. They are assumed to be the same set.
- Its render backend runs on D3D11.X and pairs with the PS4 one almost function for function. See
  [Rendering](/docs/destiny-1/rendering/).

## Destiny 2

Destiny 1 and Destiny 2 share the Tiger engine. Destiny 2's PS4 build from 2020 keeps the same time
control and render layer. The Destiny 2 PC build keeps the same time control, render layer and
platform layer. Many struct offsets are the same. What carries over to Destiny 2 build 86657 and
what does not is in
[The build: Differences from Destiny 1](/docs/destiny-2/the-build/#differences-from-destiny-1).

## Not checked

- Whether the packages hold movies in any format other than USM.
- How much of Umbra the build uses.
- Whether the 29 `OrbShdr` blocks match the Xbox build's 15 HLSL shaders.
