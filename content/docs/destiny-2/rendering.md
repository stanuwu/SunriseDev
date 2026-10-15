---
title: "Rendering"
date: 2026-10-15
description: "How package data drives the D3D11 renderer: TFX, scopes, stages, materials, lighting, shadows, fog, atmosphere, water and decorators."
weight: 80
---

The renderer is data driven. Packages carry the input layouts, the shaders, small bytecode
programs that fill shader constants, and the placed lights, atmospheres, water and effects. The
executable supplies the passes that read them. The build is D3D11.

Stage, scope and technique names such as `transparents` or `global_lighting` are the game's own.
Function and field names are descriptive labels. Hex values like `0x80806E28` are package class
ids or tags. For how tags and classes work, see [Packages](/docs/destiny-2/packages/).

## The launch record

One package record, class `0x80806CB1`, is the renderer's root. It holds:

| offset | content |
|---|---|
| `+0x08` | the input declaration resource |
| `+0x10` | the scope array, 16-byte rows |
| `+0x20` | the technique array, 16-byte rows; 623 rows |
| `+0x30` | a link to the render globals, which hold the global textures |

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

One part can draw in several stages, each with its own material. Static parts on Leviathan and the
EDZ use stages 0, 3, 6, 12 and 18. LOD category 7 (part row byte `+10`) is a detail level, the far
level. On Leviathan and the EDZ most category-7 parts have rows only in `shadow_generate`, sometimes
with `depth_prepass`. On the Dreaming City most also have a `generate_gbuffer` row and draw as the
far level. How the client picks a level is on
[World geometry and collision](/docs/destiny-2/world-geometry-and-collision/#level-of-detail).

## Render stages

The draw loop walks stages 0 to 22. The names are the game's own. The blend column is what a
material with no blend override gets from the stage's submitter.

| stage | name | default blend |
|---:|---|---|
| 0 | `generate_gbuffer` | opaque |
| 1 | `decals` | alpha blend |
| 2 | `investment_decals` | alpha blend |
| 3 | `shadow_generate` | no color |
| 4 | `lighting apply` | additive |
| 5 | `light probe apply` | additive |
| 6 | `decals_additive` | additive |
| 7 | `transparents` | additive |
| 8 | `distortion` | additive, forced |
| 9 | `light_shaft_occlusion` | opaque |
| 10 | `skin_prepass` | opaque |
| 11 | `lens_flares` | inherited |
| 12 | `depth_prepass` | no color, forced |
| 13 | `water_reflection` | inherited |
| 14 | `postprocess_transparent_stencil` | not decoded |
| 15 | `impulse` | premultiplied |
| 16 | `reticle` | additive |
| 17 | `water_ripples` | premultiplied |
| 18 | `mask_sun_light` | no color |
| 19 | `volumetrics` | opaque |
| 20 | `cubemaps` | inherited |
| 21 | `postprocess_screen` | inherited |
| 22 | `world_forces` | additive |

A stage number does not give the pass order. A stage-7 material with no blend override draws
additive, `ONE, ONE`, not opaque. "Inherited" means the submitter writes no pass byte, so the
previous value stays.

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
states and 9 bias states. The main view uses reversed depth, `GREATER_EQUAL`. Shadow maps use
`LESS_EQUAL`, with no color, no culling and slope-scaled bias. Which variant a view uses is
unverified.

### Stencil bits

| bit | written by | read by |
|---:|---|---|
| 2 | set by the clear; cleared by first-person geometry in stage 0 | the environment view, so the world skips first-person pixels; the holographic reticle |
| 3, 5, 7 | each entity draw; static instances clear them | weapon outline materials read bit 3 |
| 4 | the sky pass marks sky pixels | deferred shading skips them |

The clear value is 4. Water also marks bit 2 in its own surface draw; see "Water". Which draws set
bits 0, 1 and 6 is not located.

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

Scope 0 `frame` is special. The engine fills it with direct code and skips its program, then binds
the same buffer as CB13 to both the pixel and vertex shaders. Its packaged template is all zero and
is not the runtime value. Row 1 X is the exposure, `2^EV`.

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
lists the decoded ones. The opcode numbers differ from newer builds of the game.

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
| `0x15` | absolute value |
| `0x17`, `0x1A` | floor, fraction |
| `0x18`, `0x19` | ceiling; round to nearest even |
| `0x1C` | scale by the reciprocal square root of the XYZ length |
| `0x1F`, `0x20` | cosine-like wave; sin/cos pair |
| `0x23` | saturate |
| `0x25`, `0x26` | log2 approximation, vector length |
| `0x27` | twice the absolute value after wrapping to the nearest integer |
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
        case 0: *x = lerp(*x, m->value, m_weight); break;  /* lerp by W */
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

The package classes behind the variable bank and the placed volumes are unverified.

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
| 38 | C * (inverse(P) * inverse(V) without translation) |
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

Skinned and chunked models read a transform palette from the same buffer, from row 8. Rows 5 to 7
are fixed: row 5 is the object offset and scale from the model header, and row 7 is a lighting
value from the pose. The palette has three forms:

| form | rows per entry | entry |
|---|---:|---|
| matrix | 3 | columns 0 to 2 of the world matrix, translation in W |
| dual quaternion | 2 | rotation, then dual part |
| 4x4 matrix | 4 | a 64-byte matrix; the row order and which shaders use it are assumed |

Vertices are stored in object space. The palette is built each frame from the evaluated pose and the
inverse bind rows, in skeleton bone order, and only the consumed bone count is uploaded. The
`skinning` scope's template is 4096 vectors, larger than any one material declares.

### Entity materials and part visibility

An entity part row holds a direct material and a signed external-group index. Index -1 uses the
direct material. Otherwise the part takes the material its group selected, even when a direct
material is present. A draw-wide override takes precedence over both.

A group selects its material from a list of candidates. Each candidate has a condition of required
and excluded bits in the entity's enabled-part bitset. The first candidate whose condition passes
and whose material is not -1 wins. So the first listed material is not a universal default. The
bitset comes from the entity's components at spawn. Damage, scripts and spawn overrides can change
it later.

Three things stop a part from drawing:

- its logical index tests clear in the enabled-part bitset;
- its selected material is -1;
- it has part flag `0x40`.

The model header's `+0x30` is a visibility-bit count, not a stage mask. It must stay a multiple of
32 and cover every part's visibility index.

### Gear plates and dyes

Weapons and armor draw as render type 4, which adds plated textures and dyes to the bone-palette
path. Scope 25, `gear_plated_textures`, binds three atlas textures at pixel slots 0 to 2. Each atlas
is composed from source textures by placement rectangles, `{texture, x, y, w, h}`, with v not
flipped. The gear manager builds the atlases. Every atlas is square, and its size comes from the
gear kind:

| gear kind | atlas sets | edge of set 0, 1, 2, 3 |
|---:|---:|---|
| 0 | 4 | 2048, 2048, 1024, 1024 |
| 1 | 3 | 2048, 1024, 1024 |
| 2 | 3 | 2048, 2048, 1024 |
| 3 | 2 | 2048, 1024 |
| 4 | 1 | 1024 |

Which kind each item has is inferred from its plate rectangles, not read. Armor atlases come out at
2048, 2048 and 1024 for sets 0 to 2 under every kind that fits. Face markings use set 3, which only
kind 0 has. The atlas formats are unverified.

Up to four dye entries bind scopes 26 to 29: `gear_dye_0`, `gear_dye_1`, `gear_dye_2` and
`gear_dye_decal`. A dye runs when the material sets the matching bit. Part byte `+0x1A` picks which
dye pair and which half of it the part uses, so the choice belongs to the part, not the material.
An item's default dyes come from its art block. With no dye, a scope uses its global default, whose
constants are zero. Scopes 26 to 28 run in stages 0, 1, 2, 6, 7, 10 and 16. Scope 29 runs in stages
1, 2, 3, 6, 10 and 12.

A real decal dye forces its draw's blend, from a dye byte assumed to be file `+0x14`. All installed
decal dyes hold 0 there, which selects blend 23: `ONE, SRC_ALPHA` on targets 0 and 1, RGB only.
That fits the decal shaders, which write premultiplied color with `1 - mask` in alpha.

Class-item cloth uses the same plate record. Its draw runs the plate scope and only one dye scope,
27.

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
`lighting_ibl_specular`, all `R11G11B10_FLOAT`. Step 2 also writes `temp_ao`, `R8_UNORM`.

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
world placement, so moving the placement row does not move the volume. The engine picks one of many
techniques from a six-bit key built from which features the volume uses. The first technique is
519.

The volume draws as a unit cube. Inside the box the engine runs a stencil prepass. Outside it, the
engine draws the faces directly. A grid dimension of zero must stay zero, which disables the grid path.

### Static ambient occlusion

Static instances read ambient occlusion from an `R8_UNORM` buffer. An ambient-occlusion map
(class `0x80807268`) holds rows keyed by the instance table's u64 key. A row gives the buffer and a
byte offset. Each instance adds its own byte offset, and the vertex shader adds the vertex id. When
the instance's flag bit 25 is set, the per-vertex offset is not added.

### Frame texture 24

Extern 1 resource 24 is a 64 by 128 `R16G16B16A16_FLOAT` texture from the render globals. The
deferred lighting shader reads it when the albedo target's alpha is above 0.5. Binding nothing
there removes that branch's color.

### Deferred shading and fog

After lighting, the shading pass draws the sky first, marking sky pixels in the stencil. Then it
draws `deferred_shading` over every non-sky pixel. That shader lights the G-buffer and applies
atmospheric fog:

```c
color = lit * transmittance + (inscatter + tint * haze) * fog_scale * exposure;
```

Some distant scenery draws black because its albedo is zero with the authored data. Some vista cards
are constant black and are meant to be seen through the fog. Others multiply a texture by a render
parameter whose authored default is zero, such as parameter 55 on Black Garden cards and 65 on
Mercury planes. The run-time source of those parameters is not located.

### Sun cascade shadows

The sun uses four shadow cascades. At the default `shadow_quality` of 2, cascades 0 and 1 are 1536
pixels, cascade 2 is 1280 and cascade 3 is 1024. The splits blend log and uniform splits with lambda
0.6, and the last cascade ends 300 units out, fading from 270. Each cascade but the last extends by
5 percent of its depth. Only cascade 3 is stable: it grows to the slice's diagonal and snaps against
the last frame.

Casters draw with `LESS_EQUAL` and depth writes, no color, no culling, depth bias 10 and slope 4.
The cascades write a half-resolution shadow mask. Where history exists, the mask blends with the
last frame's mask at weight 0.7, then a separable blur runs. `global_lighting` adds the sun from that
mask. The sun direction comes from "The light direction" below. The sample-distribution path is not
read.

### Local lights

After `dominant_lighting_apply`, stage 4 draws placed light tables (class `0x8080713A`), one
160-byte row per light. Every row draws, duplicates included, unless it has flag `0x2000`, its
enable program gives no positive output, or its visibility bit is clear. The visibility bit is a
culling result from the tome; see
[World geometry and collision](/docs/destiny-2/world-geometry-and-collision/#culling). So duplicate
rows add their light together.

| row offset | use |
|---|---|
| `+0x20` | volume matrix: the unit cube to light space |
| `+0x60` | sphere for the distance fade |
| `+0x70` | sphere for the inside or outside test |
| `+0x80` | material |
| `+0x8C` | enable program |

Each light draws as a unit cube, additive. Within 10 radii of the camera the engine runs a stencil
prepass first.

### Final combine

Techniques `final_combine` and `final_combine_no_film_curve` draw a full-screen quad from the lit
image. The first applies two saturated rational curves with a 0.4 blend. The second applies a power
curve near `1/2.2`, so it is not an identity copy. Both force alpha to one.

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

## Decals

Stages 1, 2 and 6 draw decals. After stage 0 the engine copies G-buffer target 1, the normals, and
binds the copy as target 1 for the decal stages. The original goes to extern 44 resource 1. So every
decal reads the normals as they stood before any decal drew. Extern 44 vector 1 converts depth to
view depth: `1 / view_depth = x + depth * y`.

## Transparents and fog

Stage 7 binds scope 13, `transparent`, for every draw. Its pixel CB2 has six vectors:

| CB2 vector | content |
|---:|---|
| 0 | depth-to-view-depth conversion, from extern 3 |
| 1 | the two height fogs at the camera height: `(density A, density B, falloff A, falloff B)` |
| 2 to 4 | hemisphere irradiance for red, green and blue |
| 5 | zero |

The irradiance adds an up light, a down light and a uniform light from render parameters. Each
directional light adds `c * (2/3 * spread * direction, 1/3)`, where `c` is color times scale times
0.25. A shader evaluates `dot(vector.xyz, normal) + vector.w`.

Scope 14, `transparent_advanced`, has no program. The engine writes its eight-vector pixel CB8 per
draw from the draw's bounding box. It holds height-fog density and integrals at the box centre and at
its lowest and highest points, a fog amount, and the object's cell in a 32 by 32 lighting grid. The
object fog is:

1. `range = max(0, |P - C| - start)`, in kilometres for the integrals.
2. The optical depth is minus the sum of both height-fog integrals along the ray.
3. With a fog color table (16 by 256, RGBA8), a sample at `(time of day, sqrt(sqrt(t)))` scales the
   optical depth per channel. `t` is the range between two authored distances.
4. `T = exp(optical)`. The fog amount is `(0.3, 0.59, 0.11)` times `1 - T`.

Stage 7 binds one color target, so pixel outputs past `o0` are discarded. The depth it reads at t10
is device depth.

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
the atmosphere lookups for fog and the sky hemisphere for reflection. Its sky reflection and
in-scatter are scaled by the exposure. Its tint and sun highlight are display values and are not.

### The ocean

The open sea, as on Titan, is an ordinary placed model with an ocean material, not a separate
class. Ocean materials read extern 67 like other water and also extern 91, a wave block. Extern 91
comes from a water settings tag (class `0x80806D49`). On map load the engine looks up a settings
tag by name hash `0x1C03307A` and keeps it when both noise textures are set. Otherwise it uses the
render globals' default.

| settings field | default | Titan |
|---|---|---|
| two 3D noise textures | set | set |
| scroll speed | 0.045 | 0.03 |
| base height | 0 | -15 |
| height amplitude | 20 | 22 |
| wavelength | 600 | 700 |
| octave gain | 0.5 | -0.25 |
| octave frequency step | 2 | 1.333 |
| drift | 2, 0 | -6, 6 |

The column names follow the vertex program. It ignores the mesh height, samples five octaves of noise
at world XY over the wavelength, and places each vertex at base height plus noise times amplitude.
So the sea sits at the settings' base height, not the model's height.

## Effects

Particle systems, emitters, the sequences that start them and lens flares are on
[Effects and particles](/docs/destiny-2/effects-and-particles/).

### Object channels

Some materials read per-object values with TFX opcode `0x4D`. The value comes from a channel table
on the object: a count and a pointer to float4 values. The opcode checks neither the count nor a
null table.

The table's first entries are a value bank authored in the entity's model component, one named
request per channel. At load each request binds by name to a value provider in the same entity. A
provider output updates from an expression, from a bound input, or stays at its stored value.
Controllers and code can also write it. All 6,146 shipped providers start every output at zero, so
the at-rest value is set at run time. Zero is often not the at-rest look: a dissolve material is
fully discarded at zero and fully visible at one.

## SpeedTree and decorator placements

Tree canopies and ground plants are not static instances. They are instanced models in a decorator
payload, named by a placement row whose resource class is `0x808071AD`. The payload (class
`0x80807164`) holds types, instance group starts, cell starts, an instance header, cell boxes and a
payload box. The install has 1,339 payloads and 6,507,625 instances.

An instance record is 16 bytes, and the model's own input declaration describes it. For SpeedTree
models (declarations 21, 25 and 26):

| bytes | element | format |
|---|---|---|
| 0 to 7 | `TEXCOORD5` | `R16G16B16A16_SNORM`: position xyz, scale w |
| 8 to 11 | `TEXCOORD6` | `R8G8B8A8_UNORM`: X axis |
| 12 to 15 | `TEXCOORD7` | `R8G8B8A8_UNORM`: Z axis |

A quantization record of six float4 rows decodes them: position and scale are `row1 + v * row0`, the
X axis is `row3 + v * row2`, the Z axis `row5 + v * row4`, and Y is Z cross X. The placement's
rotation and translation then apply. This decode is read from a SpeedTree leaf vertex shader. Ground
decorators draw with declaration 71, and whether their bytes 8 to 15 hold the same two axes is
unverified. The vertex buffer holds the same records rounded to nearest. The instance block holds
them truncated. An edit writes both.

A type is a SpeedTree (1,849) or a ground decorator (1,007). A SpeedTree payload has one instance
group per type. A ground-decorator payload can have many groups for one type. There the payload's
group starts at `+0x18` are bands: a part's logical part index is its band, and band k uses model
mesh k. The cell starts at `+0x38` split the records into cells. A SpeedTree model has a branch mesh,
a leaf mesh and a 6-vertex far billboard.

A tree's canopy is a separate placement from its trunk's static instance. Editing the static
instance does not move the canopy.

### Decorator draws

Besides the record stream, a decorator draw binds two runtime streams: a per-instance LOD fade made
on the CPU each frame from the camera distance, and the instance's ambient occlusion from the map's
AO map. The fade distance is measured in X and Y only and scaled by the instance scale. The
`foliage_detail` setting (0 to 2, default 1) picks a quality cap of 0.5, 1.0 or 1.8 for it.

Each cell draws LOD level k when the LOD byte of its first record is in `[4k - 3, 4k + 3]`. The last
model mesh is the billboard. Ground decorators compute one LOD byte per cell from the distance to
the cell's box centre.

Wind always runs; all-zero wind rows make the vertex shader divide 0 by 0. The wind comes from a
wind settings tag (class `0x80806D33`) that the map root's name table names, by name hash
`0xC6B22D98`. All 85 installed maps name one, so a decorator takes the wind of the loaded map. The
SpeedTree wind output fills vertex CB10 rows 34 to 53. Ground decorators get their own wind floats
in extern 47.

## Frame fibers

The client runs each frame as a job graph over three engine fibers: one for simulation and physics,
and two render fibers with 8 and 7 phases. The network tick runs only after all three fibers finish
the frame. So a render job that never finishes also stops networking.

## Static geometry and the UI

Static map instances, their culling and their collision are on
[World geometry and collision](/docs/destiny-2/world-geometry-and-collision/). The UI package format,
its widgets, fonts and text layout are on [The UI format](/docs/destiny-2/ui-format/).

## Open questions

- Most TFX opcodes.
- The hull, domain, geometry and compute stage blocks.
- The package classes that drive runtime parameter overrides.
- The producers of several extern values and pass states.
- The row order of the 4x4 palette form, which gear kind each item has, and the plate atlas formats.
- Which code fills an entity's dye-set rows.
- The run-time sources of render parameters 55 and 65, and of the variable bank and parameter
  volumes.
- The shadow sample-distribution path, and which tables each light renderer draws.

## Related pages

- [Packages](/docs/destiny-2/packages/) -- how tags and classes are stored.
- [Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/) -- the class ids used
  here.
- [Effects and particles](/docs/destiny-2/effects-and-particles/) -- particle systems and lens
  flares.
- [World geometry and collision](/docs/destiny-2/world-geometry-and-collision/) -- static instances
  and culling.
- [The UI format](/docs/destiny-2/ui-format/) -- screens, widgets and text.
- [Rendering and lighting](/docs/sunrise-studio/rendering/) -- how Sunrise Studio draws this data.