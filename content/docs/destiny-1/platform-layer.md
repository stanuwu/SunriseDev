---
title: "The platform layer"
date: 2026-10-15
description: "The engine's own operating-system layer: threads, locks, time, memory, files, sockets, input, audio, crash handling and the retail log."
weight: 10
---
The engine has a thin operating-system layer of its own. It is about 330 functions, most of them one
to three lines around one Sony system call. The Xbox One build and the Destiny 2 PC build have the
same layer, with the same struct offsets, call shapes and enums. They call Win32 where the PS4 build
calls the PS4 kernel or Fios2.

**Third-party libraries make most system calls themselves.** Havok, Wwise, CRI, Demonware, NP
Toolkit and Oodle each have their own small platform layer. The engine's layer does not cover them.
About 1,021 of the 1,189 kernel call sites outside the C library sit in the upper part of the image,
mostly in that library code.

## System calls by owner

There are 33,189 direct import calls. Most are not system calls: 16,883 are the stack-guard check
and 13,383 are calls into the bundled C library. 2,742 are real system calls.

| owner | system calls, not counting the C library | platform code |
|---|---|---|
| engine | 500, in 248 functions | the engine layer on this page |
| Havok 2012.2.0 | 161, plus 69 inlined into engine functions | file and semaphore wrappers; locks inline |
| CRI Movie 3.50 | 35 | 13 functions: locks, events, threads |
| Wwise | about 940 | scattered: locks, events and conditions inline |
| Demonware 45 | 133 | its own platform files |
| Sony graphics libraries | 15 | see [Rendering](/docs/destiny-1/rendering/) |
| NP Toolkit | 402, in 168 functions | the whole library wraps PSN |
| Oodle | 78 | its own platform files |
| bundled C library | 311 kernel, 9 Fios2 | TLS, errno, locks, signals, memory maps; stdio over Fios2 |
| bundled Fios2 | 92 kernel, 3 disc map | file calls, threads, read-write locks |

Owners come from source paths, version strings and log strings, spread over the call graph. The
library address ranges are inferred that way, not read from symbols.

## Threads

| role | detail |
|---|---|
| create | start function, argument, suspended flag, name, stack size |
| start gate | every thread starts at priority 700 and waits on its own semaphore, because the PS4 has no "create suspended" |
| defaults | name `unnamed-thread`, stack 256 KiB; a requested stack size is doubled |
| priority | an engine enum 0 to 6 |
| affinity | core n gives mask `1 << n`; 7 gives `0x30`; 8 gives `0x3F` |
| job system | threads named `job` and `async_job`; no Sony fiber library |

The priority enum maps to these values:

| engine priority | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| PS4 FIFO priority | 740 | 730 | 710 | 700 | 600 | 450 | 350 |
| Xbox and PC priority | -15 | -2 | -1 | 0 | 1 | 2 | 15 |

Job workers take their cores from a table that reads 0, 1, 2, 3, 4, 5, 5, 5. The engine assumes six
cores.

## Locks

The engine keeps one registry of lock objects, built at start-up from tables. A handle is
`type << 24 | group << 28 | index`.

| kind | built on |
|---|---|
| mutex | a recursive pthread mutex; 104 lock and 107 unlock sites |
| scoped locker | the mutex; 77 sites |
| semaphore | PS4 semaphores; 40 sites |
| event | PS4 event flags; 14 sites |
| lock-free list | `cmpxchg16b`; 232 sites |

Event flags have no Win32 twin. The Destiny 2 PC build uses plain events instead.

Third-party code takes about 600 more locks directly. Wwise, CRI, Demonware, Oodle and NP Toolkit
use kernel mutexes. Havok uses pthread mutexes.

## Time

**The engine clock is the CPU's time stamp counter.** The millisecond timer reads the counter and
divides by its frequency on every call. It has 526 call sites.

- Inline `rdtsc` appears about 1,200 times in 325 functions. The largest users write Havok profiling
  timers, not game time.
- Wall-clock time comes from `gettimeofday` and `clock_gettime`.

How game time is counted from this clock is in
[Time and frame pacing](/docs/destiny-1/time-and-frame-pacing/).

## Memory

The engine builds five heaps at start-up. Each takes a 112-byte entry in one table.

| heap | type |
|---|---|
| 0 | 0, CPU |
| 1 | 0, CPU |
| 2 | 1, GPU-visible |
| 3 | 0, CPU |
| 4 | 0, CPU |

- A heap reserves a named range, aligned to 64 KiB, then commits PS4 direct memory into it.
- Type 1 is GPU-visible memory. On the PS4 a CPU address is also a GPU address. The Xbox build marks
  the same heap as graphics memory.
- The engine has two allocators, aligned to 256 and 128 bytes. Their second argument is a stats id;
  14 means graphics.
- Command buffers come from heap 0, so per-draw constants live there, not in the GPU heap.

## Files

The engine has two file paths.

**The synchronous path** is an engine file API of 53 functions over 26 POSIX-style calls. Its mount
roots are `/app0/` and `/download0/`, plus `/temp0` for temporary data.

**The asynchronous path** loads packages and streams data. One thread, `FILE ASYNC IO`, issues every
read and write. It loops: process the queue, then wait. The wait has no timeout. A request is a
record in one table; a read starts at a 32-bit offset, and a 32-byte descriptor holds the offset,
length, buffer, file id and request index. A write at offset -1 appends.

The same design exists in all three builds:

| step | PS4 | Xbox | Destiny 2 PC |
|---|---|---|---|
| open | Fios2 open | `CreateFileA` | `CreateFileW` |
| read | Fios2 read with a completion callback | `ReadFileEx` | `ReadFileEx` |
| write | Fios2 write | `WriteFileEx` | `WriteFileEx` |
| wait and wake | an event flag | an alertable wait and `SetEvent` | not traced |

The engine's Fios2 layer is 18 functions. Havok calls Fios2 through about 20 functions of its own.

### Error codes

The engine reads Fios2 error codes above the file layer, so they are part of its contract.

| code | meaning |
|---|---|
| `0x80820010` | end of file |
| `0x8082000B` | bad file |

One function maps each code to an engine error. When an open fails with engine error 11, the game
stops with `files: System OOM!`.

### Package block hashes

Package blocks that carry a stored hash are checked on the I/O thread.

1. A block is read as one request, its length rounded up to 2,048 bytes. A short read is finished by
   the request's callback.
2. If bit 0 of the block's byte at `+114` is set, the block is hashed on two jobs and compared with
   the stored hash.
3. A mismatch stops the game with `hash verification failed for package`, followed in double
   braces by the package name, the offset and both hashes.

The block record holds the buffer at `+0`, the computed hash at `+32`, the file index at `+96`, the
offset at `+104`, the length at `+108` and the stored hash at `+116`.

## Sockets

The engine has a bank of 20 BSD socket functions: socket, send, recv, close, select, recvfrom,
connect, bind, sendto and others. It has 52 call sites. The Destiny 2 PC build has the same bank.

- An engine transport wraps the bank. A new socket is made blocking, then non-blocking before
  connect. "Would block" becomes -2.
- An unknown socket error maps to 7 in the Destiny 1 Xbox build and to 8 in Destiny 2.
- The main thread, `TIME_CONTROL`, pumps the network while it waits for a frame job. It logs
  `networking:update` when two updates are more than 500 ms apart.
- Every 5 s the network update prints two lines to stdout, from a job the main loop waits on. A slow
  stdout therefore stalls the main loop.
- A main-loop stall of 2 s or more also stalls the network pump. The client can then fail
  `c_simulation_world::simulation_queue_allocate()` and drop with `error.networking_not_ok`.
- Demonware, NP Toolkit and HTTP call the PS4 network, HTTP and SSL libraries directly. The engine
  bank does not serve them.

## Input, audio and system services

- **Pad**: 7 engine functions open the pad, read it, and set vibration and the light bar.
- **Keyboard and mouse**: no library is imported. The engine still carries an unused mouse data
  path; see [Compared with Destiny 2 PC](/docs/destiny-1/compared-with-pc/#mouse-and-keyboard).
- **Audio**: only Wwise calls the PS4 audio output and the ATRAC9 decoder. Wwise opens one output
  port: 1,024 frames a buffer, 8-channel float, about 47 buffers a second. Orbit and patrol audio
  does not use the ATRAC9 decoder.
- **Game volume**: an account setting the server keeps, in the account's profile block. A block
  that was never saved is all zero. The client reads that as Game volume off, so the world is
  silent.
- **Users**: the initial user is read at 30 call sites in 23 functions.

## Crash handling and the retail log

- The crash handler catches signals 4, 8, 10 and 11. The Xbox build installs an unhandled-exception
  filter instead.
- An engine halt formats its reason into a 1,024-byte buffer, then stops with `ud2`.
- The retail log is a ring of the last 1,124 lines, starting at offset 104,544 in the log object.
  Each line is 336 bytes and holds, in order, a 64-bit Unix time in microseconds, a 32-bit format
  slot and 320 bytes of text. The exact field offsets are unverified.

## Where PS4 assumptions sit in the engine

- GPU-visible memory is CPU memory at the same address.
- Thread priorities and affinity assume six cores and FIFO priorities.
- The time stamp counter is the engine clock.
- Fios2 operations carry attributes and a completion callback. Files are also referred to by index.
- Locks use PS4 event flags, which have no direct Win32 twin.

## Not checked

- Xbox and Destiny 2 PC twins of the thread functions were paired by call shape, not decompiled.
- The idle wait of the job workers.
- The 53 synchronous file functions beyond open.
- Voice chat, PlayGo, downloadable content mounts and the NP calls the engine makes itself.
- The system calls of the bundled C library and Fios2.
- Which Wwise software codecs carry the orbit and patrol audio.
- What a retail server stored in a new account's profile block.
