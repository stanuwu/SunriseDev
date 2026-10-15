---
title: "Rendering and lighting"
description: "How Studio draws game materials, decals, foliage and particles, and how it lights them."
weight: 590
group: "How it works"
---
Studio draws scenes with the game's own material shaders, run through its own deferred renderer. The
lighting around them is Studio's. It is an inspection view, not a copy of the game's frame.
[Rendering](/docs/destiny-2/rendering/) and [Effects and particles](/docs/destiny-2/effects-and-particles/)
describe the game's renderer.

## Game shaders

**Game shaders** is on by default. Shader preparation finishes on a worker before the scene appears.
Turning the checkbox off draws simple shading and keeps the selection.

Only color-stage parts are drawn. Shadow and depth-prepass parts repeat the color geometry. The
game never draws them in color, so both shading modes hide them.

A material Studio cannot run falls back to simple lit geometry with shared depth, so its object stays
visible, selectable and outlined. The fallback shows the material's first sRGB color texture, cut
out where the shader's alpha test reads that texture's alpha. Without such a texture it stays gray.
The **Shader report** counts textured and gray parts.

Some entity materials read object channels, such as a shield, a glow or a fade. Each placed entity
uses its model's rest values, the values the game holds while the entity is idle. See
[Set channel values](/docs/sunrise-studio/find-assets/#set-channel-values). A value Studio cannot
work out reads 1. A light or a glow that the game turns on only during an event stays off.

A part's blend and depth are its stage's pass states, with the material's overrides on top, as the
game resolves them. The Inspector shows the result, for example `Opaque; depth Test and write,
LessEqual`.

A cloth shader reads finished object-space positions, normals and tangents from its vertex buffer.
The game fills that buffer from its cloth simulation (unverified). Studio fills it on the CPU with
the cloth skinned to its bones, and refills it when the pose changes. The simulation is not run.

## Gear dyes and plates

Weapons and armor use gear-plated materials: three plate textures and four dye slots. An item opened
from the browser uses the item's own dyes. A slot the item names no dye for, and every slot of an
art part opened on its own, uses the game's four global default dye records. Those make the colours
look flat. A cloth part runs only the second dye slot, as the game's cloth draw does.

Plate textures are composed into plate atlases from their descriptor rows, as the game builds them.
Each gear object, such as one weapon or one armor piece, gets its own atlases. Their size comes from
the item's gear kind, read from its bucket; an unknown kind uses the weapon size. The atlas formats
and mips are unverified.

## Stencil

Every draw writes and tests the game's G-buffer stencil, with the state and reference of its draw
path: entity, decorator, static or terrain. A weapon draws as the game's first-person hip-fire view.
Materials that the game draws only under another stencil value draw nothing in Studio either, such
as scope outlines, which show only while aiming down sights. A shader that reads the scene stencil
gets the copy taken after the G-buffer stage.

## Texture memory

A scene has a texture budget of 512 MiB. The budget never drops a part. Every texture loads its
resident mips. Streamed mips go first to the textures of the most-used materials, while the budget
holds. The other textures show their lower-resolution mips, as the game does before it streams in
the full ones. The load report counts them.

## Level of detail

Static map objects change detail with distance, as they do in the game. Each frame Studio works out
a level for every static object from its distance to the camera and three sizes. The sizes come from
the mesh and the placement, and are about the object's radius.

| distance from the camera | level |
|---|---|
| up to about 16 times the first size | 0, full detail |
| up to about 30 times the second size | 1 |
| up to about 200 times the third size | 2 |
| farther | not drawn |

Each part of a mesh draws at some levels only, so a far object swaps its detailed parts for coarser
ones. A narrow field of view pushes the switches farther away, as zoom does in the game. Shadow
casters use the same level, and stop a few meters before the object's far cull.

The game blends two levels over a short distance with a dither. Studio draws one level at a time, so
the switch is a hard cut.

**Full detail** in the toolbar keeps every static object at level 0 at any distance and turns the far
cull off. Use it to see and edit distant objects. It is off by default and is remembered. An
orthographic view, or a level chosen in the asset view's LOD list, also turns the distance levels off.

A click selects only the parts the view draws. A part its distance level hides cannot be clicked;
the coarser part drawn in its place can. Turn on **Full detail** to click the level 0 parts of a
distant object. The outline of a selected object still shows its level 0 shape.

Entities, terrain and foliage keep their own rules. Foliage has its own distance levels.

## Draw order and decals

Each frame draws the color stages in this order:

| order | stages | target |
|---|---|---|
| 1 | `generate_gbuffer` | G-buffer |
| 2 | `decals`, `investment_decals` | G-buffer |
| 3 | lighting | lit color |
| 4 | sky parts | sky color |
| 5 | `decals_additive`, `transparents` | lit color |

Decals change the G-buffer before lighting, so they are lit with the surface under them. A decal
shader that reads the G-buffer normals gets a copy taken before the decal stages.

## Water and the sea

Water draws in the `transparents` stage with its game shader. It bends the lit color under it. It
reflects the sky that the lighting mode uses: the sky reflection image in Sky mode, the
neutral environment in Studio mode, and nothing in Ambient mode.

The open sea, such as the ocean on Titan and around Deep Six, also runs the game's wave shader. The
map picks its wave settings. Titan has its own; other maps use the game's default. The waves move
with the scene clock. The sea sits at the height its settings give, not at the height of its model,
as in the game.

Studio leaves out the mirror reflection of nearby objects, the ripple and shadow images, and the
water mask. So water reflects only the sky, and two water surfaces that overlap both draw.

## Lighting modes

| mode | lighting |
|---|---|
| Studio | a neutral environment with no world fog; the default |
| Sky | the game's sky chain, its sun and supported local cubemaps; a preview |
| Ambient | ambient light only, for comparison |

All three keep the material shaders, their G-buffer outputs and the game's diffuse and specular
split. Studio lighting feeds neutral radiance to the game's lighting shader and neutral fog inputs to
deferred shading.

## The sky preview

Sky mode runs part of the game's sky chain with the installed shaders and textures.

| step | technique | output |
|---|---|---|
| generate | 418, `full_hemisphere_sky_color_generate` | a 64 x 64 atmosphere image |
| copy and tint | 587, `sky_hemisphere_copy_and_tint` | a 512 x 512 reflection image |
| filter | 585, `sky_hemisphere_downsample_filter_ggx` | ten mip levels |
| apply | 568, `cubemap_apply_sky_copy_ao` | diffuse, IBL and temporary AO |

The renderer adds the environment diffuse to the ambient pass. Deferred technique 0 reads the IBL
result. After the sky fill, supported local cubemap volumes (technique 519) apply with their authored
cube texture, box, fades and stencil prepass. Other cubemap variants are reported as unsupported.
Volume draws keep their load order. The game's visibility registration and priority are not
reproduced.

Generation is cached by its lookup textures, the time-of-day keyframe and the light direction.

## Sun and shadows

In Sky mode the time-of-day sun lights the scene with the game's `global_lighting` technique.
Studio uses the game's default shadow quality. Shadow casters, the `shadow_generate` parts, draw into
four cascades out to 300 m, of 1536, 1536, 1280 and 1024 texels. The shadow mask is half resolution.
It is blurred across and down, then spread over the full image by depth. Casters follow the same
layer, bubble and visibility filters as the parts you see. A caster outside the view still casts when
it is inside a cascade. Studio and Ambient modes have no sun. Caster lists are kept between frames, as
[Viewport performance](/docs/sunrise-studio/performance/) describes.

## Local lights

Placed lights draw into the lighting with their own game materials. They follow the bubble filter
and fade out between 28 and 30 times their radius. A light whose enable program is off does not draw.

## SpeedTree foliage

A map places SpeedTree foliage through a decorator payload, class `0x80807164`. Its instance block
holds one 16-byte record per tree. Each type of tree owns one run of records and one model.

```c
struct DecoratorRecord {   // block 0x80807173, rows of class 0x80807175
    s16 position[3];       // snorm, unpacked by the quantization rows
    s16 scale;             // snorm, same rows
    u8  x_axis[3];         // unorm
    u8  unknown0;          // kept as stored
    u8  z_axis[3];         // unorm; Y is Z cross X
    u8  unknown1;          // kept as stored
};
```

The quantization record, class `0x8080716B`, is the decorator vertex shader's `cb0[0]` to `cb0[5]`.
Studio places each model part once per record, the far billboard included. The draw picks one part
by distance. Each mesh is scaled and offset by its tree type's own rows, as the vertex shader does,
not by the model's.

A ground decorator payload holds ground plants instead of trees. All its types must be ground types;
a payload that mixes both is not decoded and keeps its placement marker. Its records are split into
bands, and each band into cells. A cell draws all its records with the parts of its band: one model
mesh per level. The level comes from the distance to the cell centre. A ground record keeps its
rotation as a quaternion in bytes 8 to 11. Ground cells cannot be moved.

A tree can be moved, turned and scaled like other objects. The edit writes the record into both the
instance block, which the CPU reads, and the vertex buffer, which the GPU draws. The block copy
truncates and the vertex buffer copy rounds, as the installed pairs do. A value outside the stored
ranges quantizes the whole block again. A cell that holds one tree takes the tree's moved box.
A shared cell and the payload box grow to hold it. A payload that shares its instance data with
another payload is refused, because an edit would move both.

### Wind, occlusion and detail

Trees and ground plants draw with the game's shaders and the game's wind. The wind settings come
from the table the map root names. A payload opened on its own uses the wind of the maps that place
it. If those maps name different wind settings, it gets no wind and the load report says so: open it
from a map.

Each decorator also reads its ambient occlusion rows from the map's AO maps. When several AO maps
match, the game picks one by the active map variant. Studio picks the one in the payload's own
package, then one of the loaded variant. A payload opened on its own can still match several. Those
plants then draw without game shading, as plain geometry.

Studio draws the default foliage detail, `foliage_detail` 1. Trees fade between levels as their
distance grows, and far trees show their billboard. Ground plants thin out with distance.

## Particles

Particles run their emitter programs. Studio follows the game's spawn shapes, spawn directions,
program stages and motion: emission rate, lifetime, gravity, accelerations, friction and spin.
Each particle draws as a camera-facing sprite with the material's first color texture. Its size
and fade are Studio's choice, because the particle vertex shader is not decoded. Systems that the
game simulates on the GPU run the same CPU steps in Studio. One emitter draws at most 256 particles.
An emitter is skipped when it is more than 250 m from the camera, plus the reach of its particles.

A lens flare draws one sprite with the material of its first element. Lens flares always run.

An entity's particles start where its game data puts them. That is the entity's origin, an
attachment point on one of its bones, such as a jetpack nozzle, or a frame turned to face up, down
or back. When the entity holds several points with the same name, the effect runs once at each, so
a two-gun turret fires from both guns. They move, turn and scale with the entity's placement.
Systems that the game simulates in world space are simulated in world space in Studio too. An
effect whose attachment point the entity does not hold is skipped, because the game draws nothing
there. **Report > Load report** counts them, and lists the locations Studio cannot place. Those
start at the origin.

When you preview a clip on the opened entity, each particle system follows the bones its game data
names. A system that lives on a bone carries its particles with that bone. A world-space system
spawns at the moving bone, and its particles stay where they spawned. Entities placed in a map keep
the bind pose.

Effects follow their triggers. In the game, each effect waits on its sequence and on the switches
above it, and Studio reads the same rules. By default an effect runs only when it starts on its own
when the entity appears, keeps running, and every channel it waits on is open at 0. These are off by
default:

- Effects that gameplay starts, such as a weapon firing.
- Effects that play once, such as a burst at spawn.
- Effects that wait on a channel that is closed at 0, such as `alive` or a device position.
- Effects picked at random, or that wait for an untimed effect before them.
- Effects whose sequence or start condition Studio cannot read.

The **Effects** section of the inspector turns them on. It shows for the opened entity, or for the
selected effect in a map.

- **Show all effects** runs every effect all the time.
- Each channel has a box that sets it to 0 or 1 and a field for any other value.
- **Play** starts a sequence again. **Stop** ends it. A play-once effect runs once per press.
- **Force on** runs one effect all the time.

While a clip plays on the opened entity, a channel that the clip lists reads 1. Studio does not read
the clip's values for it. Whether clips drive these channels is unverified.

## Backdrop and exposure

The backdrop follows the bubble under the camera cursor by default. **Report > Environment** can fix
it to one bubble or show all.

Exposure is an inspection control, separate from the game's. **Auto exposure** reads the frame's
brightness without waiting for the GPU. It treats a surface as reflecting at least 2% of its light,
so near-black materials do not brighten the frame. Turning it off keeps the current brightness, and
**Exposure** then sets it directly, from -4 to 16 EV.

## Limits

- The six sky-object captures and their projection are not drawn.
- Local lights cast no shadows.
- The sun shadow mask is not blended with the previous frame, and the shadow bounds are not fitted
  to the visible depth.
- Dynamic world parameter overrides are not applied.
- Cloth is not simulated, and some materials do not run.
- Parts in the `distortion` stage are not drawn.
- Skinned parts whose shader reads four palette rows per bone use the fallback.

These change color, fog and contrast, most of all indoors and across bubbles. Sky mode is not
a parity check against the game.
