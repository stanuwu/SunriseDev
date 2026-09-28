---
title: "Rendering and effects"
date: 2026-09-28
description: "How package data drives the D3D11 renderer: TFX programs, scopes, lighting, atmosphere, water, effects and UI."
weight: 80
---

The renderer is data driven. Packages carry the input layouts, the shaders, small bytecode
programs that fill shader constants, and the placed lights, atmospheres, water and effects. The
executable supplies the passes that read them. The build is D3D11.

Stage, scope and technique names such as `transparents` or `global_lighting` are the game's own.
Function and field names are descriptive labels. Hex values like `0x80806E28` are package class
ids or tags. For how tags and classes work, see [Packages](/docs/destiny-2/packages/).

The facts come from the executable, the installed packages, and a standalone viewer that runs the
game's own shaders. Visual parity with the game is not verified.

## The launch record

One package record, class `0x80806CB1`, is the renderer's root. It holds:

| offset | content |
|---|---|
| `+0x08` | the input declaration resource |
| `+0x10` | the scope array, 16-byte rows |
| `+0x20` | the technique array, 16-byte rows; 623 rows |
| `+0x30` | a link to the global textures table |

## Native input declarations

Input layouts come from package data, not from shader reflection. A declaration resource holds
format groups and declarations.

```c
struct VertexElement {       /* 3 bytes, class 0x808072B2 */
    uint8_t semantic;        /* +0x00  index into the native semantic name table */
    uint8_t semantic_index;  /* +0x01 */
    uint8_t format;          /* +0x02  index into the native format table */
};

struct InputDeclaration {    /* 28 bytes, class 0x808072AC */
    uint16_t id;             /* +0x00 */
    uint8_t  instanced[4];   /* +0x02  per-stream instance flags */
    uint8_t  pad[2];
    int32_t  group[4];       /* +0x08  format group per stream; -1 omits it; width assumed */
    /* rest not read */
};
```

The engine turns each declaration into `D3D11_INPUT_ELEMENT_DESC` records. Each format id selects a
native row with a DXGI format, a byte width and a fallback format id. A zero DXGI format falls back.

A static mesh picks its declaration per part and per stage:

```c
struct StaticAssignment {    /* 8 bytes, class 0x8080719B */
    uint16_t part;           /* +0x00 */
    uint16_t stage;          /* +0x02  render stage */
    int16_t  declaration;    /* +0x04 */
    uint16_t pad;
};  /* row i uses material i of the mesh header */
```

One part can draw in several stages, each with its own material. Parts with detail category 7 draw
only in `shadow_generate` and sometimes `depth_prepass`. They are shadow casters, not a detail
level.

## Render stages

The draw loop walks stages 0 to 22. A few by name:

| stage | name |
|---:|---|
| 0 | `generate_gbuffer` |
| 3 | `shadow_generate` |
| 6 | additive decals |
| 7 | `transparents` |
| 9 | `light_shaft_occlusion` |
| 12 | `depth_prepass` |
| 13 | `water_reflection` |
| 20 | cubemap volumes |
| 22 | `world_forces` |

A stage number does not give the pass order.

### Render states

A draw's state is four packed bytes: blend, depth/stencil, rasterizer and depth bias. The low
seven bits select a native state index. A byte with its high bit set overrides the one below it:

```c
uint8_t ResolveStateByte(uint8_t pass, uint8_t material, uint8_t forced)
{
    uint8_t b = pass;
    if (material & 0x80) b = material;   /* material override */
    if (forced   & 0x80) b = forced;     /* final forced override */
    return b & 0x7F;                     /* native state index */
}
```

The state catalog holds 90 blend states, 83 depth/stencil states in two variants, 9 rasterizer
states and 9 bias states.

## Scopes and TFX

A shader's constants are not filled by code alone. Each material and each scope carries a small
bytecode program, called TFX here. It computes constant vectors from engine inputs, then
the engine uploads them.

### Scopes

A scope is a shared constant block, such as per-frame or per-view data. The launch record lists
them by index. A few:

| index | name |
|---:|---|
| 0 | `frame` |
| 1 | `view` |
| 2 | `rigid_model` |
| 7 | `skinning` |
| 9 | `chunk_model` |
| 11 | `instances` |
| 13 | `transparent` |
| 14 | `transparent_advanced` |
| 16 | `terrain` |

Each scope has one block per shader stage. The pixel block starts at `+0x40` and the
vertex block at `+0xD8`:

```c
struct StageBlock {
    ArrayRef textures;         /* +0x00  texture bindings */
    uint8_t  pad0[8];
    ArrayRef tfx_bytecode;     /* +0x18 */
    ArrayRef tfx_constants;    /* +0x28  vec4 constants the program reads */
    ArrayRef samplers;         /* +0x38 */
    ArrayRef initial_vectors;  /* +0x48  constant buffer template */
    uint8_t  pad1[0x20];
    uint32_t cb_slot;          /* +0x78  constant buffer slot */
    uint32_t extern_cb_tag;    /* +0x7C */
};
```

`ArrayRef` is a 16-byte package array reference: a count and an offset. The other shader stages
(hull, domain, geometry, compute) have their own blocks. Those are not read.

Scope 0 `frame` is special. The engine fills it with direct code and skips its program. Its
packaged template is all zero and is not the runtime value.

### Externs

A program reads engine data through externs. An extern is a block the engine fills before the draw,
held in a per-context table. The known ones:

| extern | content |
|---:|---|
| 1 | the frame: time, exposure, frame constants, a few global textures |
| 2 | the view: matrices and viewport |
| 3 | view targets: depth, G-buffer, lighting buffers, the sky hemisphere |
| 7 | the atmosphere |
| 8 | a rigid model: instance matrix and model constants |
| 39 | transparent pass inputs |
| 41, 42 | global lighting inputs |
| 43 | the current object effect |
| 44 | additive decal inputs |
| 67 | water, per object |

### The TFX interpreter

The interpreter is a small stack machine over `float4` values. The switch has 85 cases. The table
lists the decoded ones. The opcode numbers differ from newer public lists.

| byte | operation |
|---|---|
| `0x01`, `0x06` | add |
| `0x02` | subtract |
| `0x03`, `0x05` | multiply, per lane |
| `0x04` | divide, guarded near zero |
| `0x0A` | step: 1 where B is not below A |
| `0x0C`, `0x0D` | build a vector from lanes of two values |
| `0x0F` | cubic `(B.x*A + B.y)*A*A + (B.z*A + B.w)` |
| `0x10` | lerp |
| `0x12` | multiply-add |
| `0x13` | clamp between two values |
| `0x17`, `0x1A` | floor, fraction |
| `0x1F`, `0x20` | cosine-like wave; sin/cos pair |
| `0x23` | saturate |
| `0x25`, `0x26` | log2 approximation, vector length |
| `0x28`, `0x29`, `0x2A` | noise waves and a floor hash |
| `0x2E` | vector times a 4x4 matrix |
| `0x34`, `0x35` | push a program constant; lerp between two |
| `0x37`, `0x38`, `0x39` | piecewise cubic curves |
| `0x3A`, `0x3B` | 4-ramp and 8-ramp gradients |
| `0x3C`, `0x3D`, `0x3E` | push an extern float, vector, or four vectors |
| `0x43`, `0x44` | pop to one output vector, or to four |
| `0x49`, `0x4C` | bind a sampler; push an authored sampler |
| `0x4D` | push an object channel value |

The rest are not decoded. The engine keeps exact float order in the waves and curves, so a port
must not fuse multiply and add.

```c
/* Extern reads: two operand bytes, extern id then element index. */
case 0x3D:  /* push extern vector */
    ext = ctx->externs[op[1]];            /* one pointer per extern id */
    push(((float4 *)ext)[op[2]]);
    break;
case 0x3C:  /* push extern float, splatted */
    ext = ctx->externs[op[1]];
    push(splat(((float *)ext)[op[2]]));
    break;
```

## TFX parameters

Materials also read named global parameters. There are 153, each keyed by a 32-bit hash with an
authored default. Every frame the engine rebuilds a runtime table from those defaults, in a
fixed order.

```c
void Render_ResolveParameters(float4 *runtime, const Param *authored, int count)
{
    /* 1. keyed overrides from a variable bank */
    for (int i = 0; i < count; i++) {
        float4 v;
        if (VariableBank_ReadVec4ByKey(active_bank, authored[i].key, &v))
            runtime[i] = v;
        else if (restore_defaults_when_missing)
            runtime[i] = authored[i].value;
    }

    /* 2. a modifier list of 16-byte rows: {index, lane, value, op} */
    for (Modifier *m = modifiers; m; m = m->next) {
        float *x = &runtime[m->index].v[m->lane];
        switch (m->op) {
        case 0: *x = lerp(*x, m->value, weight); break;  /* weight source not read */
        case 1: *x += m->value; break;
        case 2: *x -= m->value; break;
        case 3: *x *= m->value; break;
        case 4: *x  = m->value; break;
        }
    }

    /* 3. placed parameter volumes, sorted by an int field, applied in order */
    for (Volume *v : sorted(placed_parameter_volumes))
        Volume_Apply(v, runtime);
}
```

The package classes behind the variable bank and the placed volumes are not verified.

Parameter key `0xE638AAEB` scales every ambient color in
`global_lighting_ambient_only`. Its authored default is zero. Without an override the ambient
term is black.

## View and frame data

### View matrices

Extern 2 holds the view as row vectors, with no transpose on upload. `V` is world-to-view, `P` the
projection, `C` the pixel-to-clip matrix.

| matrix index | value |
|---:|---|
| 2 | V |
| 6 | P |
| 10 | inverse(V) |
| 14 | inverse(P) |
| 18 | V * P |
| 22 | inverse(V * P) |
| 26 | C * inverse(V * P) |
| 30 | C * inverse(V * P) * V |
| 34 | U * inverse(V * P), where U is C for a 1x1 target |
| 50 | V without translation |

`C` has rows `(2/w, 0, 0, 0)`, `(0, -2/h, 0, 0)`, `(0, 0, 1, 0)` and `(-1, 1, 0, 1)`. The viewport
vector is `(w, h, 1/w, 1/h)`.

### The frame clock

Extern 1 float 0 is game time in seconds, wrapped at 28,800 s (8 hours). The engine counts time in
ticks of 1/673,200 s and wraps before it converts to float. Floats 1 to 4 hold the time again, the
fraction of the current second, time modulo 420 s, and the time of day.

The time of day is a 0-to-1 value. Its reset value is 0.2, which shows night on the EDZ sky. The
day is 3,600 s long by default. The running game advances it.

Float 7 is `2^EV`, the exposure. The exposure value starts at 0 and is clamped to `[-3, 3]` by
default.

### Model constants

For a rigid model, extern 8 holds the instance matrix in vectors 0 to 3, three model header vectors
in 4 to 6, and a draw vector in 7. The `rigid_model` scope copies them to vertex constant buffer 11.

Skinned and chunked models read a transform palette from the same buffer, from row 8:

| form | rows per entry | entry |
|---|---:|---|
| matrix | 3 | columns 0 to 2 of the world matrix, translation in W |
| dual quaternion | 2 | rotation, then dual part |

Vertices are stored in object space. How the game sizes the palette window is not verified.

### Terrain

Terrain draws parts as triangle strips with input declaration 60. Each 12-byte part row holds a
material, a first index, a count, a group and a detail level. A part draws when its group is
visible and its detail level equals the group's selected level. Per-vertex ambient occlusion comes
from a byte buffer indexed by vertex id.

## Lighting pass and the ambient technique

The lighting pass runs after the G-buffer stage. Its order is fixed:

1. `clear_lighting_buffers`: clear the three lighting targets to zero.
2. `cubemaps_render_pass`: technique `cubemap_apply_sky_copy_ao`, which applies the sky hemisphere
   and ambient occlusion. A global flag selects a different technique instead.
3. Placed cubemap volumes (stage 20), or three other techniques when a global flag is set.
4. `dominant_lighting_apply`: draw the global lighting technique selected for the view.

The three lighting targets are `lighting_diffuse`, `lighting_specular` and
`lighting_ibl_specular`, all `R11G11B10_FLOAT`.

The global lighting technique comes from a 16-row table. The read rows select `global_lighting`,
`global_lighting_ambient_only`, or a third technique between them. The ambient technique draws a
full-screen quad with additive blend and a depth test with no depth write. It reads the exposure
from extern 1.

### Sky hemisphere

Reflections and sky light read a generated hemisphere map, not a package cubemap. The engine
renders the sky into it, tints it, and filters mip levels 1 to 9 with a GGX filter. The base size
is 512, format `R16G16B16A16_FLOAT`.

### Placed cubemap volumes

Local reflections are placed boxes, resource class `0x80806B7F`. Each holds a world matrix, extents,
fade vectors, an intensity, an optional grid and three textures. Their matrices already contain the
world placement. The engine picks one of many techniques from a six-bit key built from which
features the volume uses.

### Deferred shading and fog

After lighting, the shading pass draws the sky first, marking sky pixels in the stencil. Then it
draws `deferred_shading` over every non-sky pixel. That shader lights the G-buffer and applies
atmospheric fog:

```c
color = lit * transmittance + (inscatter + tint * haze) * fog_scale * exposure;
```

## Atmosphere

The atmosphere is a placed resource, not a standalone tag. A map's placement list carries it,
together with a time-of-day resource.

```c
struct AtmosphereResource {        /* class 0x80807086, fields from +0x10 */
    uint32_t keyframes_a[16];      /* +0x10  handles; empty in all shipped data */
    uint32_t keyframes_b[16];      /* +0x50  handles; empty in all shipped data */
    uint32_t lookup_3d;            /* +0x90  128x128x16, one slice per time key */
    uint32_t lookup_3d_second;     /* +0x94  optional, blended in */
    uint32_t lookup_2d;            /* +0x98  16x1024 */
    uint32_t unused_tag;           /* +0x9C  not read by the fill */
    float    time_keys[16];        /* +0xA0  rising, wrapping at 1 */
    float4   clear_color;          /* +0xE0  for mode 4 */
};
```

The 3D lookup is sampled by view azimuth, view height and time key. The engine finds the two keys
around the time of day and blends them.

The atmosphere also has 30 keyed parameters: fog densities, height falloffs, phase terms. Two
height fogs fall off with camera height as `exp(-(z - base) * falloff / 1000)`.

### Sky modes

| mode | technique | output |
|---:|---|---|
| 0 | `sky` | the generated sky lookup |
| 1 | `sky_ref_atm` | same material as mode 0 |
| 2 | `sky_no_atm` | black |
| 3 | `sky_grognok_atm` | same material as mode 0 |
| 4 | `sky_grognok_clear` | a clear color |

With no atmosphere loaded, the mode is 2 and the sky is black.

### The light direction

The time-of-day resource holds a day length, a start time and a curve set. The curve set has two
time windows and four curves: the sky direction and the light direction, each inside and outside
its window. The engine samples them every frame at the time of day. The result is the sun
direction, which also feeds the shadows.

### The sky lookup

Each frame the engine builds a screen-space sky lookup in these passes:

1. `sky_generate_sky_mask`: a 64x64 mask from min/max depth.
2. `downsample_block_2x2`.
3. Two radial blurs toward the light, for light shafts.
4. `sky_hemisphere_seed_inscattering` and `sky_hemisphere_spherical_blur`.
5. `sky_lookup_generate`, which blends the 3D lookups and adds a glow around the light.

## Water

Water is a render feature. Maps place it as resource class `0x80806DE0`: a model, bounds and a
physics shape. It draws in two stages:

| stage | what it does |
|---|---|
| 13 `water_reflection` | planar reflection; skipped when the camera is more than 0.5 units behind the plane |
| 7 `transparents` | the surface |

The surface draw first marks its pixels in the stencil. The water material then draws only where
that mark is set. Extern 67 carries its per-object inputs: position, scale, a refraction copy of
the lit scene, a planar reflection, ripple normals and a shadow term. The water shader also reads
the atmosphere lookups for fog and the sky hemisphere for reflection.

## Effects

Maps place effects in two ways. Both go through the map's placement rows.

| route | carried by |
|---|---|
| particle nodes | inside the placed entity's component configs |
| lens flares | a placement resource, class `0x80806CBF`, that names a flare |

### Particle nodes

A particle node is an inline record inside an entity config. It names one particle system per row.

```c
struct ParticleNode {              /* class 0x80806CC6, 296 bytes */
    uint32_t name_hash;            /* +0x00  FNV-1 of a name such as "sparks" */
    uint16_t pad;
    uint16_t parent;               /* +0x06  assumed */
    uint8_t  pad1[4];
    float    start[2];             /* +0x0C  assumed */
    float    duration[2];          /* +0x14  assumed */
    uint8_t  pad2[0x14];
    ArrayRef systems;              /* +0x30  class 0x80806CC8 rows, 24 bytes each */
};
```

A system row can hold `0xFFFFFFFF` instead of a tag. The config then lists variants, and the
runtime picks one. How it picks is not verified.

### Particle systems

```c
struct ParticleSystem {            /* class 0x80806E28, 52 bytes */
    uint32_t emitter;              /* +0x00  class 0x80806E2C */
    uint32_t compute[2];           /* +0x04  compute materials, when GPU-simulated */
    uint8_t  pad[4];
    uint32_t compute_third;        /* +0x10 */
    uint32_t raster_material;      /* +0x14 */
    uint32_t models;               /* +0x18  lists entity models */
    uint32_t material;             /* +0x1C */
    uint32_t hash;                 /* +0x20 */
    uint8_t  rest[0x10];           /* +0x24 */
};
```

About a quarter of systems simulate on the GPU with compute shaders. The rest do not. The
simulation and its output stream layout are not decoded.

### Emitters and the channel map

The emitter, class `0x80806E2C`, is 336 bytes. It holds a constant array, a small program with its
own constants, and a channel map.

```c
struct EmitterChannel {            /* 2 bytes */
    uint8_t kind;                  /* 0xFF unused; 6 = a constant */
    uint8_t slot;                  /* for kind 6: float index into the constant array */
};

struct Emitter {
    uint8_t        pad[8];
    ArrayRef       constants;      /* +0x08  vec4 array */
    uint8_t        pad1[0x38];
    ArrayRef       program;        /* +0x50  bytecode */
    ArrayRef       program_consts; /* +0x60 */
    uint8_t        pad2[0x10];
    EmitterChannel channels[55];   /* +0x80 */
};
```

The 55 channels follow a fixed name list in the executable, from `particle_age` to
`emitter_grid_count`. Examples: `particle_lifetime`, `particle_velocity`, `emission_rate`,
`emitter_radius`, `initial_speed`, `particle_max_count`.

Kind 6 as "a constant from the array" is assumed. It fits a census of all 26,250 emitters: every
slot is in range, and `emission_rate` and `particle_max_count` are whole numbers in 98 to 99 percent
of them. Per-particle channels such as `particle_position` always use kind 1. Kinds 0 to 5 and the
emitter program are not decoded.

### Lens flares

A lens flare, class `0x80806F68`, holds an array of 12-byte rows: a material, a parameter block and
a flag. The flare shader builds a screen-space quad at a fixed clip depth of 0.99. The lens-flare
role is assumed from that shader.

### Object effects

Some materials read per-object values with TFX opcode `0x4D`. The value comes from a channel table
on the object. The table's values come from value providers in the entity, which inputs and
controllers update at run time. All shipped providers start at zero, so the at-rest value is set at
run time.

## Frame fibers

The client runs each frame as a job graph over three engine fibers: one for simulation and physics,
and two render fibers with 8 and 7 phases. The network tick runs only after all three fibers finish
the frame. So a render job that never finishes also stops networking.

## The UI package format

The whole game UI ships as package data in three classes:

| class | role |
|---|---|
| `0x808047B7` | screen |
| `0x8080496A` | hierarchy |
| `0x80804825` | widget table |

The chain runs screen -> views -> hierarchies -> widget tables:

```text
screen
  -> view (named)
     -> view entry -> hierarchy
        -> node tree
        -> widget table
           -> node bindings -> back to hierarchy nodes
           -> objects -> components -> property refs -> slot + pooled value
```

### The array container

A UI blob starts with its own length. Everything after it is arrays reached through 16-byte
descriptors. Every stored offset is relative to the field that holds it.

```c
struct UiArrayRef {        /* 16 bytes */
    uint64_t count;        /* +0x00 */
    uint64_t relative;     /* +0x08 */
};  /* data header at: descriptor offset + 0x18 + relative */

struct UiArrayHeader {     /* 20 bytes, packed */
    uint32_t marker;       /* +0x00  always 0x80809FBD */
    uint64_t count;        /* +0x04  same as the descriptor's count */
    uint64_t item_class;   /* +0x0C  class of the elements */
};  /* elements start at +0x14 */
```

The element class is only in the header. A parser must read it there and dispatch on it.

### Screens and hierarchies

```c
struct UiScreen {                  /* class 0x808047B7, 80 bytes */
    uint64_t   length;             /* +0x00 */
    uint32_t   font_set;           /* +0x08  class 0x808047C5 */
    uint32_t   unused;             /* +0x0C */
    UiArrayRef views;              /* +0x10  class 0x808047CB */
    UiArrayRef resources;          /* +0x20  class 0x808047C6 */
    uint8_t    filled[0x14];       /* +0x30  0xFF */
    uint32_t   optional_fonts;     /* +0x44 */
    uint32_t   pad[2];             /* +0x48 */
};

struct UiView {                    /* class 0x808047CB, 24 bytes */
    uint32_t   name_hash;          /* +0x00 */
    uint32_t   pad;
    UiArrayRef entries;            /* +0x08  class 0x808047CD, {u32 name, u32 hierarchy} */
};

struct UiHierarchy {               /* class 0x8080496A, 40 bytes */
    uint64_t   length;             /* +0x00 */
    UiArrayRef nodes;              /* +0x08  class 0x80804616 */
    uint16_t   count_a, count_b;   /* +0x18 */
    uint32_t   widget_table;       /* +0x1C */
    uint32_t   pad[2];             /* +0x20 */
};

struct UiNode {                    /* 4 bytes */
    uint16_t parent;               /* +0x00  0x7FFF on the root */
    uint16_t id;                   /* +0x02 */
};
```

Node ids are local to the hierarchy. The array is not stored in id order, so read the tree through
the id, not the array position.

### Widget tables

The widget table root is 344 bytes: a length, eight array descriptors, then thirteen value-pool
descriptors. The main arrays:

| offset | class | element |
|---:|---|---|
| `+8` | `0x80804607` | links to other widget tables |
| `+72` | `0x8080462A` | objects, 64 bytes |
| `+88` | `0x808046D8` | node bindings, 56 bytes |
| `+120` | `0x80804943` | slots, 16 bytes |
| `+136` to `+328` | several | value pools: bytes, 16-bit, ints, floats, vec4s |

Widget tables link to each other, so the set is a graph, not a tree.

```c
struct UiObject {                  /* class 0x8080462A, 64 bytes */
    uint8_t    type_hash[20];      /* +0x00  a type id, not per object */
    uint32_t   pad[3];             /* +0x14 */
    UiArrayRef components;         /* +0x20  class 0x808046D4 */
    UiArrayRef extra;              /* +0x30  class 0x808046F3 */
};

struct UiComponent {               /* 24 bytes */
    uint64_t   key;                /* +0x00  small integer; meaning not known */
    UiArrayRef property_refs;      /* +0x08  class 0x80804858 */
};

struct UiPropertyRef {             /* 24 bytes */
    int64_t  slot_rel;             /* +0x00  self-relative, to a slot */
    uint64_t selector;             /* +0x08  which property */
    int64_t  value_rel;            /* +0x10  self-relative, to a pooled value */
};

struct UiNodeBinding {             /* class 0x808046D8, 56 bytes */
    uint16_t node_a, node_a_copy;  /* +0x00  hierarchy node id */
    uint32_t pad0;
    int64_t  slot_a_rel;           /* +0x08 */
    uint64_t selector_a;           /* +0x10 */
    uint16_t node_b, node_b_copy;  /* +0x18 */
    uint32_t pad1;
    int64_t  slot_b_rel;           /* +0x20 */
    uint64_t selector_b;           /* +0x28 */
    uint64_t pad2;                 /* +0x30 */
};
```

A node binding points from the widget table to a hierarchy node. A property reference binds a slot
to a pooled value. Both meet at the same kind of slot. A slot is itself a short array of 4-byte
codes. What the codes and selectors mean is not known.

Positions and sizes are in units of screen height. Most float values are exact multiples of
`1/1080`, so `1.0` is 1080 pixels and `1.777778` is the 16:9 aspect ratio. Not every value follows
that rule.

## Open questions

- Most TFX opcodes.
- The hull, domain, geometry and compute stage blocks.
- The package classes that drive runtime parameter overrides.
- The particle simulation, emitter programs and channel kinds 0 to 5.
- The producers of several extern values and pass states.
- The meaning of UI selectors and slot codes.

## Related pages

- [Packages](/docs/destiny-2/packages/) -- how tags and classes are stored.
- [Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/) -- the class ids used
  here.
