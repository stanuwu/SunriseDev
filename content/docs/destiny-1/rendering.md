---
title: "Rendering"
date: 2026-10-15
description: "The engine's render layer on PS4: the backend boundary, resources, surfaces, command recording and submission, draws, state, and what the GPU hands back to the CPU."
weight: 30
---
The engine renders through a thin Bungie render API. Under it sits Sony's own graphics library,
linked into the executable. Nothing outside the render layer writes GPU commands. What reaches the
render API is GPU-level data: raw texture, sampler and buffer descriptors, render targets as raw
register sets, and shader structs that point at GCN machine code.

## Two layers

| layer | what it is |
|---|---|
| render API | Bungie code: contexts, draws, state, clears, queries, recording and submission, plus frame, surface and job code |
| libGnm, GpuAddress, libGnmx | Sony's library, linked statically: descriptor helpers, the command packet writers, tiling math, and `GfxContext` with its constant update engine |

- Code outside the render layer calls Sony's library only to set up descriptors and to do tiling
  math: the surface allocator, lookup textures and the crash screen. The UI draws through the same
  render API as the world.
- One function submits work to the GPU. It is the only caller of both Sony submit calls.

## The backend boundary

**There is no virtual render interface** in any Tiger build. Each platform links its own version of
the same plain functions, with the same engine-side arguments. Destiny 2 PS4's RTTI names no device,
context, resource or state class either.

The boundary has three parts, and each platform implements all three:

1. **The context API**: per-context state, draws, clears, queries and recording. The first argument
   is always the engine context.
2. **The resource layer**: a 15-slot callback table the resource system calls per package tag, plus
   buffer and vertex format creation called by the engine.
3. **The surface layer**: render target allocation, binding as a target or a texture, clears and
   readback.

The engine reaches a context through a field at `+0x15C0` of a per-job render state object. It is a
plain data pointer, not a function table. Calls whose first argument comes from that field reach
154 functions on PS4 and 206 on Xbox, and they pair one to one.

The two draw calls differ slightly between platforms:

| draw | PS4 arguments | Xbox arguments |
|---|---|---|
| indexed | context, topology, base vertex (ignored), start index, count | context, topology, base vertex, start index, count |
| non-indexed | context, topology, count | context, topology, start, count |

## Resources

### The resource callback table

At start-up the backend registers 15 functions with the resource system. Xbox registers its 15 in the
same order. Registering 0 installs the "no GPU" table. The resource system calls each slot with the
tag's type byte, its handle and its GPU data address.

| slot | role |
|---:|---|
| 1 | header size per type |
| 2 | on load: create |
| 3 | on unload: destroy |
| 4 | on move: fix addresses after a heap move |
| 5 | create a run-time texture; kinds 0, 1 and 2 give engine formats 72, 83 and 71 |
| 6 | size of a run-time texture |
| 7 | fill a composite texture from source tags |
| 8 | no-op |
| 9 | GPU copy for a move, through the blitter ring |
| 10 | memory swap copy |
| 11 | point a texture at new mip memory, for streaming |
| 12 | are all mips resident |
| 13 | a flag; true on PS4 |
| 14 | memory offset and size |
| 15 | heap choice from flag bit 1 |

On PS4 the unload slot is never called. Xbox calls it on two load events. This rests on a static
cross-reference scan, which can miss calls, so it is unverified.

### What loading does per type

The type ids are the same on both builds. **The PS4 handler only fixes the addresses in a descriptor
the package already holds.** The Xbox handler creates a D3D object.

| type | kind | PS4 on load | Xbox on load |
|---|---|---|---|
| 1 to 3 | texture | sets the texture descriptor's base address | creates a placement texture over the data, and a view |
| 4 | vertex buffer | address at `+0x28`, count at `+0x30` | a buffer object at `+0x28` |
| 6 | index buffer | address at `+0x30`, 32-bit flag at `+0x38`, count at `+0x3C` | a buffer object at `+0x30` |
| 7 | constant buffer | base address into the buffer descriptor at `+0` | a dynamic constant buffer at `+0x18` |
| 8 | pixel shader | program address at `+0x08` and `+0x0C` | a shader object at `+0x08` |
| 9 | vertex shader | program address at `+0x1C` and `+0x20`, fetch shader at `+0x08` | a shader object |
| 10 | geometry shader; two programs on PS4 | fixes both | a shader object |
| 11, 14 | assumed: LS and ES stages, with a fetch shader | fixes addresses | no-op |
| 12, 13 | assumed: HS and CS stages | fixes addresses | no-op |
| 16 | sampler | no-op: the sampler descriptor is in the header | creates a sampler state |
| 18 | unknown | a handler exists | a handler exists |

Xbox stores its D3D object where PS4 stores the GPU address. Each engine object has one native
object, made in the load slot.

### Textures

**Neither build converts textures at load.** PS4 packages hold a complete GCN texture descriptor
and pre-tiled GCN data. Xbox packages hold an Xbox header, with a DXGI format and a Durango tile
mode, and pre-tiled Durango data.

The PS4 texture header is `0x54` bytes:

| offset | field |
|---|---|
| `+0x00` | the 32-byte GCN texture descriptor |
| `+0x28`, `+0x2A`, `+0x2C` | 16-bit width, height and depth |
| `+0x31` | mip count |
| `+0x34` | has streamed mips |
| `+0x35` | block-compressed |
| `+0x40` | dimension |

- Streaming points the descriptor at the streamed data.
- Defragmenting moves data through the blitter ring, then calls the move slot.
- The device makes two 256 x 256 RGBA8 default textures, white and black, and one default sampler.
- Built-in vertex and pixel shaders are parsed from embedded shader blocks. The vertex shader gets a
  fetch shader generated at run time. Package shaders ship with a prebuilt fetch shader.

### When CPU data becomes final

**PS4 never renames a buffer.** Writes land in place. A renderer that runs work later must copy or
version the data at the point it becomes final.

- Per-draw constants are allocated inside the command buffer. The allocation returns a CPU pointer,
  and the engine fills it after the call. They are final when the draw or the recording closes.
- Dynamic vertex buffers are final at unmap.
- UI vertices are copied into the command buffer at the draw call.
- CPU-written surfaces, such as video planes, are final at unlock.
- The glyph cache is final at its commit. It is multi-buffered.

The Xbox build does the same in its own way. It lays placement resources over engine memory, so the
CPU writes them with `memcpy` as on PS4. Its per-draw constants come from three 8 MiB rings, bound by
GPU address before the CPU fills them. Map and unmap are used only for dynamic vertex and index
buffers, the back buffer and screenshots.

## Surfaces

One surface manager holds every render target.

- 96 surfaces of 224 bytes, numbers 22 to 95 on the free list, and 256 slot surfaces.
- One heap of `0x1C210000` bytes, plus a CPU-readable twin heap of `0x74000` bytes.
- 20 fixed surfaces and 20 named recipes, set up once at device start-up.
- Allocators: bump, slot and arena.

A surface entry:

| offset | field |
|---|---|
| `+0x00` | flags: the recipe in the low 16 bits; `0x8000` allocated; `0x100000` depth |
| `+0x02` | built bits |
| `+0x04`, `+0x06`, `+0x08` | 16-bit width, height and slice count |
| `+0x0C` | kind |
| `+0x18` | a copy of the recipe |
| `+0x40` | GPU address |
| `+0x48` | CPU-readable twin address |
| `+0x50` | size |
| `+0x54` | Gnm depth render target |
| `+0x88` | Gnm render target |
| `+0xB4` | texture descriptor |

Recipe flag 4 forces a linear layout. Flag `0x4000` adds fast-clear metadata (CMASK). Flag 8 gives
the surface a CPU-readable twin. There are 13 surface formats; 7 and 8 are depth.

## Recording and submission

| item | fact |
|---|---|
| device manager | one block of 151,440 bytes; the device sits at `+0x11B50` |
| contexts | 7, made once: one primary, bound to a thread through a TLS slot, and 6 deferred for parallel render jobs |
| Gnmx contexts | two per engine context, used in turn; the active one is at context `+0x50` |
| ring | 64 record pointers |
| record | `0x938` bytes: a ready flag, a label slot, up to 64 command buffer segments with their sizes, and a flip flag |

**Submission follows ring order, not the order jobs finish.**

1. A frame snapshots the primary context's state, closes its current record and reserves one record
   per render job.
2. Each job takes a deferred context, restores the snapshot, records, and finishes.
3. Closing a record marks it ready. It enters the ring only if it holds commands.
4. The consumer walks the ring in order and stops at the first record that is not ready. Before each
   submit it waits until the GPU's frame label catches up, sleeping 300 us between checks.
5. It submits the record, and flips when the record asks for it. On a flip error it rebuilds a
   minimal flip record and tries again.

A frame runs: begin frame, which waits for the flip and binds the back buffer; render; end frame;
close the last record with a flip and consume; then frame end.

Frame end rotates the display buffer index modulo 3, hides the system splash screen once, and calls
Sony's "submit done" every frame. So even a frame that draws nothing still reaches the GPU library
there.

## The draw path

| draw | arguments | notes |
|---|---|---|
| indexed | context, topology, unused, start index, count | skipped when the context's draw-enable byte at `+0x26` is 0 |
| non-indexed | context, topology, vertex count | skipped the same way |
| indexed, instanced | context, topology, count, unused, instances, unused, start index | sets the instance count, draws, resets it to 1 |
| non-indexed, instanced | context, topology, vertex count, unused, instances | the same |
| indexed from memory | context, topology, start index, primitive count | 16-bit indices; no draw-enable check; the title screen UI uses it |
| from CPU vertices | context, topology, primitive count, vertices, stride | copies the vertices into the command buffer; draws nothing without an input layout; no draw-enable check |
| compute | context, compute shader, groups x, y, z, wait | one call site in the whole build, used by two helper passes |
| full-screen rect | context | the device's own shaders, 3 vertices as a rect list |

Topologies:

| id | topology | vertices for n primitives |
|---:|---|---|
| 0 | point list | n |
| 1 | line list | 2n |
| 2 | line strip | n + 1 |
| 3 | triangle list | 3n |
| 4 | triangle fan | n + 2 |
| 5 | triangle strip | n + 2 |
| 6 | rect list | 3n |
| 7 | quad list | 4n |
| 8 to 11 | patch | |
| 12 to 15 | adjacency | |

The index type is 0 for 16-bit and 1 for 32-bit. Rect list and quad list are the GCN primitive types
of the same names.

The Xbox build maps topologies 4, 6 and 7 to "undefined". So engine code shared with Xbox never
uses fans, rect lists or quad lists. On PS4 they appear inside the backend and in the UI.

## State

### Context fields

| offset | field |
|---|---|
| `+0x26` | draw enable |
| `+0x50`, `+0x58` | the active Gnmx context and the active ring record |
| `+0x1D28`, `+0x1D30` | the bound vertex and pixel shader |
| `+0x1D60` | input layout: element count, a stride per stream, then 8-byte elements of format, byte offset and stream |
| `+0x1D68`, `+0x1D70` | cached index handle and index record |
| `+0x1D78`, `+0x1DF8` | cached vertex handle and offset per stream, 32 streams |
| `+0x1E78`, `+0x21F8` | texture and sampler descriptor pointers, 7 stages x 16 slots |
| `+0x2578` | viewport: x, y, width, height, min z, max z |
| `+0x2590` | scissor |
| `+0x25B4` to `+0x25C0` | blend, depth-stencil, depth bias and raster preset ids |
| `+0x25D0` | clip control register |
| `+0x25D4` | raster mode register |
| `+0x25D8` | blend control register, the same for all four colour targets |
| `+0x25DC`, `+0x25E0` | depth control and stencil control registers |
| `+0x25E4` | stencil reference and masks |
| `+0x26B0` | depth target, 13 dwords |
| `+0x26E4` | 5 colour targets, 11 dwords each |
| `+0x27C4` | one in-use word per colour target |

Every setter skips the call when the cached id or pointer is unchanged. A target is off when the
format in its info register is 0. Its base address is then stale.

**The context is a complete record of fixed-function draw state.** Its copies match the GPU
registers on every draw, on the primary and the deferred contexts alike: shaders, colour and depth
targets, blend, depth and stencil control, raster mode, clipping and viewport. A deferred context's
command buffers are assumed to inherit the render-target registers from earlier buffers in submit
order. The snapshot restore at a job's start keeps the context's copies equal to them.

Textures, samplers, buffers and constants are not in that check. They reach the GPU through
descriptor tables, not registers.

### The constant update engine

Sony's constant update engine keeps a 48 KB CPU copy of every stage's resource tables: 7 stages,
`0x642` dwords each.

| dword offset | table |
|---|---|
| `0x000` | texture descriptors, 128 x 8 dwords |
| `0x400` | read-write texture descriptors, 16 x 8 |
| `0x480` | sampler descriptors, 16 x 4 |
| `0x4C0` | vertex buffer descriptors, 32 x 4 |
| `0x540` | constant buffer descriptors, 20 x 4 |

Setters write into it and mark a table dirty. Before each draw, the engine binds changed
shaders, then for each dirty table the shader uses it writes the table to constant RAM, dumps it to
a ring, and points the shader's user registers at it. Shaders find their resources through their
input-usage slots.

| stage numbering | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Gnm stage | CS | PS | VS | GS | ES | HS | LS | |
| engine stage | | PS | VS | GS | HS | CS | PS4 only | PS4 only |

Engine stages 1 to 7 map to Gnm stages 1, 2, 3, 5, 0, 6 and 4.

### Where state comes from

| kind | source |
|---|---|
| textures | the engine texture object starts with its raw descriptor; set by the material bytecode (opcode `0x46`) and by technique binds |
| samplers | a 16-byte descriptor at sampler object `+0x08`; material opcode `0x47` |
| constant buffers | allocated in the command buffer; filled per draw by the technique bind and the material bytecode |
| vertex streams | one buffer descriptor per layout element; the vertex shader slot is the element index |
| shaders | the technique apply |
| blend, depth-stencil, raster, depth bias | preset tables of fixed rows, turned into registers at bind time |
| render targets | 4 colour targets and a depth target; the viewport comes from their size |

The Xbox build builds the same preset rows into D3D state objects on the device at start-up. PS4
converts them at each bind.

### Clears

A clear takes a mask. Bits `0x3C` clear colour targets, bit `4 << i` for target i. Bits `0xC0` clear
depth: `0x40` writes depth and `0x80` stencil.

- A colour clear skips empty slots and uses a fast clear where the target allows it. The rest is one
  rect list drawn with the device's clear shaders, blend off.
- A depth clear is one rect list with the depth test set to always and stencil replace.

### Handles

Engine resources resolve from 32-bit handles through one pool table.

```c
uint32_t s     = (int32_t)h >> 13;             /* signed shift */
uint32_t pool  = s & ((s >> 18) | 0x3FF);       /* ids with bit 31 set reach pools up to 0x3FFF */
uint32_t index = h & 0x1FFF;
```

A pool entry is 64 bytes: base at `+0x10`, stride at `+0x30`, mask at `+0x34`. A vertex buffer
object holds its GPU address at `+0x28` and its element count at `+0x30`.

### Shaders

A shader is a Gnmx vertex or pixel shader struct. Its header dword holds the size in bits 0 to 22
and a "uses shader resource table" flag in bit 23. The engine vertex shader object wraps it at
`+0x14`, with the fetch shader's GPU address at `+0x08`. The shader hardware registers are written
inside Sony's driver module, not in the executable.

## What the GPU gives back to the CPU

The engine reads GPU results on the CPU and depends on submission order.

| item | fact |
|---|---|
| frame label | 4 bytes in GPU-visible memory, written by an end-of-pipe event at every record close and finish, or only at flips when a global byte is set; the consumer keeps the CPU at most one flip ahead |
| label slots | 512 slots of value and block list. Label values climb by one per slot. A record takes its slot when it begins but enters the ring when it closes, so slot order is not ring order |
| blitter ring | a CPU-side queue of 2,560 GPU copies of 64 bytes each, used by memory defragmenting, with its own label. It is flushed once a frame, and by a blocking defragment that only runs while the main loop has stopped time |
| occlusion queries | 899 slots with 128-byte result buffers. The only CPU reader found is the lens flares, which poll without blocking. A flare's visible fraction is its pixel count over the expected count |
| predication | only in the lens flares: draw if visible, or if the result is not final yet |
| CPU-readable surfaces | autoexposure, `minmax_depth` and `impulse_*_tex`; see below |
| colour grading table | drawn on the GPU every frame, one draw per slice; no CPU readback found |
| compute | one dispatch call site; no async compute |
| flip | an event queue with a GPU end-of-pipe event; the flip status is polled |

The occlusion query result is 16 qwords, read as 8 begin and end pairs. It is ready when bit 63 is
set in all 16. The count is the sum of end minus begin. The counts come from pixel pipeline
statistics dumps. A query's begin first clears its 128-byte result to zero, then waits for the clear.

### CPU-readable surfaces

A surface with recipe flag 8 gets a twin in CPU-readable memory. A copy draws the surface into the
twin, so the twin holds the GPU's tiled layout, not plain rows.

| surface | size | read by |
|---|---|---|
| autoexposure, surfaces 2 to 4 | 40 x 1, RGBA16F | exposure; reads the first `width` 8-byte values |
| `minmax_depth`, surfaces 13 and 14 | 1 x 1, RG32F | the shadow cascade fit; a minimum of 0 or less resets the fit |
| `impulse_*_tex`, surfaces 15 to 20 | | read only when a global flag is set |

**Both readers expect the GPU to have finished the previous frame.** Autoexposure draws into the
next of its three surfaces each frame and reads the one drawn the frame before. Shadow fitting draws
one of two surfaces and reads the other.

Each exposure step moves at most 5% of the gap, clamped to -1 to 1, and only when the last 6
targets lie on one side. The step runs once a frame, not once a second. So at a higher frame rate,
exposure settles faster, for example after a loading screen.

### Surface copies below the render API

A surface copy between two different surfaces draws through Gnmx directly, so no context draw
records it:

- a depth surface is drawn into the target's depth memory, and stencil too when both have it;
- a colour surface of the same size, and the same value in one header word, is drawn into the
  target;
- any other colour copy runs a compute pass. The director's cursor lens uses the same pass.

In patrol, one depth copy and two colour copies run each frame:

- The depth copy puts scene depth into a 1920 x 1080 R32F surface that 7 later draws sample.
- One colour copy copies the scene colour.
- The other copies a quarter-size particle target. The 6 particle draws after it sample the copy as
  a 480 x 270 RGBA16F texture.

## One orbit frame

One frame in orbit made 5,720 render API calls on four threads.

| what | count |
|---|---|
| draws | 282: 116 non-indexed, 112 indexed, 50 UI draws, 4 others |
| colour grading table draws | 33, one per slice |
| lens flare draws | 18 indexed |
| surface unbinds | 131, each followed by a GPU stall |
| other GPU stalls | 41 |
| render jobs | 3, on deferred contexts 2, 3 and 4 |

The primary context passes between three threads. Each piece ends with a record close, which writes
a frame label, so the label climbs through the frame rather than once per flip.

At the title screen every draw is a UI draw, about 27 a frame, each with a full state set.

## The Xbox build

The Xbox backend pairs with the PS4 render API almost function for function. Both builds reach their
backend through the same context field with the same arguments. The Xbox context copies the D3D11
context's method table into itself and calls through it.

| PS4 render API | D3D11 on Xbox |
|---|---|
| indexed draw | set topology, `DrawIndexed`; Xbox also passes a base vertex |
| non-indexed draw | `Draw`; PS4 has no start vertex |
| vertex streams, index buffer, input layout | `IASetVertexBuffers`, `IASetIndexBuffer`, `IASetInputLayout` |
| vertex and pixel shader | `VSSetShader`, `PSSetShader` |
| blend, depth-stencil, raster, depth bias | `OMSetBlendState`, `OMSetDepthStencilState`, `RSSetState` |
| viewport, render targets, clear | `RSSetViewports`, `OMSetRenderTargets`, the clear calls |
| textures, per-draw constants | `*SetShaderResources`, a constant buffer from the rings |
| queries and predication | `CreateQuery`, `Begin`, `End`, `GetData`, `SetPredication` |
| finish a recording, consume in order | `FinishCommandList`, `ExecuteCommandList` in ring order |

- Only on PS4: compute dispatch, draws from CPU vertices, GPU stalls, primitive restart, depth
  decompress, fast-clear eliminate, and combined viewport and scissor.
- Only on Xbox: hull, domain, geometry and compute shader setters, stream-out targets, ESRAM
  discard and mip generation.
- The Xbox constant buffer and sampler binds write D3D11.X fast-path packets straight into the
  command buffer. Xbox also ends in GCN descriptors.

## Destiny 2

Destiny 2's PS4 build from 2020 is a direct descendant of this layer. Destiny 2 PC implements it on
D3D11.

- The same device manager, a primary context with a per-thread claim, and a ring of records consumed
  in order. PS4 has 1 + 6 contexts and a 64-record ring with the same 300 us wait. PC has 1 + 8
  contexts and a 128-record ring.
- The same draw shape, topology enum, handle tables and engine buffer object.
- PC builds 90 blend, 83 x 2 depth-stencil and 9 x 9 raster and depth bias states at start-up. PS4
  keeps the same 132-byte rows and converts them at bind time.
- PC constants come from one dynamic buffer per stage and size bucket: 7 stages x 21 buckets, from
  64 to 2,048 bytes, then 4,096. They are filled and unmapped before the bind. PS4 keeps Destiny 1's
  "allocate in the command buffer, return a pointer".
- PC patches no GPU memory in place. Package textures are immutable. Streaming builds a new texture
  and swaps it in after 3 frames. PC uses no GPU fence anywhere.
- PC tag types: 12 hull shader, 13 domain shader, 14 compute shader, 17 sampler. On Destiny 1 PS4 the
  sampler is type 16.

How Destiny 2 PC renders is in [Rendering](/docs/destiny-2/rendering/).

## Not checked

- Device start-up, the constant update engine's emission code in full, and the preset tables.
- The material bytecode interpreter beyond opcodes `0x46` to `0x49`.
- Who builds input layouts.
- Resource types 7, 11 to 14, 16 and 18 in detail.
- Who predicates outside the lens flares, at a destination.
- Which job uses which deferred context.
- The reader of the general occlusion query controller. Orbit begins 3 queries a frame; their owners
  were not traced.
- Scissor, primitive restart and the clear values, against the GPU registers.
