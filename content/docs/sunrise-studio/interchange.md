---
title: "Interchange formats"
description: "What each export and import format holds, including Blender asset bundles and world scenes."
weight: 530
group: "How it works"
---
Studio converts game data to common formats for outside tools and brings edits back. The codecs are
written for Studio. Exported files are working copies. Only imported differences enter a project.

## Inspectors

An inspector decodes one kind of asset for the Properties page. The binary view is always available.

| format | shows | editable |
|---|---|---|
| binary | strings and possible tag references | bounded byte replacement |
| CUI resource | imports, nodes, bindings, typed property operations | text hashes, raw flags, raw operation values |
| CUI program | the node hierarchy and root resource | raw only |
| behavior | a typed graph, source paths, linked tags | target tags, target hashes, raw comparison modes |
| investment item | stack size, bucket, sockets, stats, sandbox perks | existing scalar fields |
| investment tables | item index, display string hashes, collectible rows | display string hashes |
| material | shader stages, texture slots, inline vectors | texture assignments, raw flags, vector values |

Behavior expressions and CUI bindings are not run. Unknown behavior nodes stay visible.

## File formats

| format | export | import |
|---|---|---|
| OBJ | triangles, normals, UVs | polygon meshes, negative indices, split attributes |
| glTF and GLB | triangles, normals, UVs | triangle primitives, scene transforms, interleaved buffers |
| glTF animation | a sampled joint hierarchy | not for clips; see the control importer |
| DDS | native formats, mips, cubes, volumes | DX10, DXT1, DXT3, DXT5, BC4, BC5, supported legacy RGBA masks |
| PNG | RGBA8, BGRA8, R8, BC1 to BC5 decoded | non-interlaced 8-bit grayscale, RGB, indexed, RGBA |
| property JSON | editable values and field identities | matching asset and field identities only |

glTF mesh import refuses skins, morph targets, sparse accessors and required extensions. It accepts
embedded buffers and buffer files inside the asset folder. The original asset importer can skip skins
and morphs.

PNG cannot decode BC6H or BC7. DDS keeps those blocks. Texture replacement rules are in
[Import and edit textures](/docs/sunrise-studio/textures/#edit-a-texture-in-an-image-editor).

## Coordinates

The game uses Z-up. OBJ keeps package coordinates. glTF export adds an exact Z-up to Y-up transform,
and glTF import converts back. The glTF UV origin is converted too.

A single-model export keeps positions in model space, ready for reimport. A whole-scene export bakes
placement transforms. Reimporting a scene export into a model would apply the placement as a geometry
edit.

## Native mesh reimport

Position reimport keeps topology, UVs, normals, skin weights and every other stream byte. It accepts
one OBJ or glTF mesh for one selected part.

| mesh | position layouts |
|---|---|
| static | signed normalized shorts, strides 8 to 32 |
| entity | the same, plus float positions at stride 48 |
| terrain | not supported |

Vertex order and triangle indices must match the export. Positions must fit the original value range.
Shared vertices must get the same position.

## Animation export

**Export animation...** writes an animated node hierarchy from the native rig, without a skinned mesh.
Relative clips need a base layer and are refused. The export does not evaluate gameplay inputs or
extract root motion. Editable control export is a separate path. See
[Edit animation controls](/docs/sunrise-studio/animation/).

## Asset bundles

An asset bundle is a working folder for Blender: `asset.sunrise-bundle.json` and its files. Studio
checks the source and project fingerprints first. Then it checks every edit before it publishes one
project transaction.

| surface | export | import |
|---|---|---|
| geometry | glTF with native vertex identity, normals, UVs, skin, LOD metadata | fixed-topology positions and supported UV layouts |
| normals | authored static-123 normals and tangents | the verified static-123 profile only |
| skin and rig | joints, bind matrices, weights, linear or dual-quaternion mode | must stay unchanged |
| materials | shader-derived previews, native slots, scalar nodes | slots and scalar constants |
| textures | every DDS subresource; PNG mips and slices | matching DDS or PNG edits; BC1 to BC5 and BC7 re-encode changed blocks |
| animation | sampled rig actions and native control actions | dense control edits in the existing layout |
| particles | effect metadata, emitter objects, constants | decoded constant channels |
| shaders | DXBC, disassembly, Blender text | raw working payloads only |
| other dependencies | typed graph and possible references | raw bytes; unsafe clone remaps fail |
| collision | `collision/collision.json`: shapes, placements and identity | instance moves as object edits; shape edits as deltas |

LODs come from the original packages. The Blender importer shows one level per model and
configuration group. The others stay available for editing.

Exports must stay outside the installation and every project. Bundle and glTF paths cannot leave the
bundle or follow file system links. Reference remapping uses installed native readers, never editable
manifest claims or matching words.

### Blend modes in the preview

A part's blend comes from its render stage, as the game resolves it. A forced stage blend wins, then
the material's override, then the stage's own pass blend.

| stage | blend without an override | override applies |
|---|---|---|
| 0 `generate_gbuffer`, 10 `skin_prepass` | opaque | yes |
| 1 `decals`, 2 `investment_decals` | alpha | yes |
| 6 `decals_additive`, 7 `transparents` | additive | yes |
| 8 `distortion` | additive, forced | no |
| 12 `depth_prepass` | no color, forced | no |
| any other stage | opaque | yes |

One material can draw at several stages. The bundle stores the blend per stage. In Blender, each
other blend gets a copy of the material named `<material> [<blend>]`. A part that writes no color
gets no preview and Blender hides it.

A stage 1 `decals` part shows when its shader reads only its own mesh and textures. Most enemy
decals are such shells over the body. A decal that reads frame textures, such as scene depth,
imports hidden: Blender cannot composite it as the game does. **Native decal volumes** in the
Sunrise sidebar shows it. A bundle whose materials lack the `ReadsFrameTextures` flag keeps every
stage 1 part hidden. A guardian
export shows its stage 1 parts: they are face markings skinned to the face. A world scene shows
only parts with no stage or at stages 0, 1, 2, 6 and 7.

### Material previews

Blender previews follow the dataflow of the game's pixel shaders. They approximate dye, detail,
lighting and effects. They are not translated game shaders.

- Color textures use their sRGB format. Packed channels and normal maps keep data values.
- Native smoothness becomes Blender roughness. Normal XY rebuilds a positive Z.
- An alpha test becomes material alpha with the Dithered method. Texture alpha alone does not make a
  material transparent.
- Matching wrap or clamp axes map to Blender's repeat or extend. Point filters use closest sampling.
  Mixed-axis addressing and other filters are approximations.
- Blender picks its own mip levels from the preview image.
- Metalness and roughness are clamped to 0 to 1.
- A loop with a constant trip count unrolls. A loop whose exit depends on the pixel, such as parallax
  or ray marching, stops at that exit. Its offset is left out, and the material notes say so.
- A `switch` becomes a selection between its cases.
- A texture slot whose material row is empty reads zero, as in the viewport.
- Supported vertex-wave shaders export their motion as geometry nodes that follow the timeline.
- Any other entity part whose vertex shader moves it over time exports that offset as a program,
  read with every bone at rest. The add-on runs it as a **Shader motion** geometry-nodes modifier
  before the armature. A vertex texture read is sampled from the bundle's image. A shader whose
  vertex constants Studio cannot evaluate, or that reads a volume texture there, keeps its rest
  shape.
- Animated material values, such as scrolling, rotating or pulsing layers, follow the timeline at the
  scene frame rate. Layers that read the view direction use Blender's camera, normal and UV tangent.
  The bitangent takes its sign from the UV map, as the game's does.
- An entity part's vertex shader is run on sample vertices at the rest pose. That names each shading
  input: world normal, tangent, bitangent or position, a UV map, COLOR0 or raw POSITION0. A position
  the shader offsets, such as cloth sway, reads the Blender mesh's own position.
- World scenes do not carry raw POSITION0. A shader that reads it sees zero there.
- A volume texture is written once as its top-mip slices side by side, `textures/<tag>_volume.png`.
  The preview reads the eight nearest texels and blends them, so Hive and Taken noise moves as in
  the game. Without that file it reads its mean color. Cube textures read as their mean color.
- An effect range with an open bound, such as a gate with no minimum, is written as the largest
  float of that sign. JSON has no infinity.
- Inputs the game fills at run time stay unknown. When a preview cannot build its color, its notes
  list the inputs and operations it could not resolve.
- Water is an opaque, smooth surface. It keeps the game's ripple normal and in-scatter color.
  Refraction, shoreline fades and screen reflections are left out.

### Clip names

A clip's name is Studio's name for its tag, else the package name, else a name recovered from an
audio-event path inside the clip, else `Clip N`. Pose actions are named `<name> [Pose_<tag>]` and
control animations `<name> [<tag>]`. Reimport reads the tag from glTF extras, not from the name.

### New asset mode

**Add new asset** clones the root and its verified dependencies into one new package group. Installed
and derived sources stay delta-backed. Whole payloads are allowed only when the source was already an
added asset. An entity with unresolved internal references cannot be cloned. The import fails before
the project changes.

## World scenes

`world.sunrise-scene.json` is a read-only scene, format `sunrise-world-scene` version 1. It holds the
authored scene with no camera culling and no live transforms. Geometry arrays never enter the JSON.
They live in binary shards of at most 128 MiB, little-endian, each with its byte length and SHA-256.
A failed or cancelled export leaves no partial folder.

| part | content |
|---|---|
| geometry | float32 positions, normals and UVs, uint32 indices; shared when the content is identical |
| vertex inputs | COLOR0 as four uint8 lanes and the UV stream's z and w as float32, when a part has them |
| materials | per material tag, render stage, terrain dye binding and gear inputs; native slots, a preview, culling |
| textures | used 2D textures, once each, as top-mip PNGs; composed plate atlases as their first mip |
| prototypes | ordered parts, material references, local transforms, stages, LODs, visibility |
| placements | fixed 128-byte rows |
| placement inputs | eight float32 per placement, when any has them: a ground plant's record and occlusion |
| markers | transforms and source identities, as metadata |

Coordinates are native Z-up with unchanged units. Matrices are 16 float32 values in row-major,
row-vector order. Translation is in elements 12 to 14. A part's local matrix multiplies its placement
matrix on the left. Blender transposes both and evaluates `placement * local`.

| offset | placement row field |
|---:|---|
| 0 | uint32 prototype index |
| 4 | uint32 name index |
| 8 | 16 float32 matrix values |
| 72 | uint32 bubble hash |
| 76 | uint32 instance source tag |
| 80 | int32 instance source index; a ground plant adds its record number |
| 84 | uint32 placement source tag |
| 88 | int32 placement source offset |
| 92 | uint32 object class tag |
| 96 | uint64 placement identity |
| 104 | uint32 model source configuration tag |
| 108 | uint32 activity tag |
| 112 | int32 state ordinal |
| 116 | int32 scene layer |
| 120 | uint32 state-name index |
| 124 | reserved zero |

The Blender importer creates each mesh and material once. It uses collection instances when the
material allows, and linked mesh objects with a shared geometry-node group when a material needs
per-object world-basis attributes. A triangle that repeats a vertex index is left out before Blender
computes normals. The count is stored on each mesh. A material whose game draw culls back faces
turns on **Backface Culling**; EEVEE and the viewport follow it, Cycles does not.

A SpeedTree part's LOD is the first level that draws it. Its far billboard is the last level, so the
importer hides it with the other lower levels.

A shared export of a large city map is about a sixth the size of a plain GLB of the same scene, and
imports into Blender many times faster.

### World effects

`world.effects.json` sits beside the manifest, format `sunrise-effects` version 1. The manifest does
not list it. A scene with no effect markers writes none. Studio runs its own particle simulation,
the one the viewport draws, and bakes each emitter into looped sprite samples that Blender plays
back.

| part | content |
|---|---|
| `effects/particles.bin` | 20-byte samples: float32 X, Y, Z; float16 size, alpha and spin; uint16 frame |
| `effects/sprites/<tag>.png` | each emitter material's sprite, at the largest mip no wider than 256 |
| emitters | name, source identity, system and emitter tags, material, sample range, origin |
| materials | the sprite and the blend state; without a usable sprite, an additive soft dot |
| skipped | lens flares and failed systems, which stay hidden markers |

Sprite size and fade are Studio's choice. Emitters that gameplay starts are baked and hidden.
Emitters the game runs on the GPU use Studio's CPU steps, so they are approximate. One export holds
at most 8,000,000 samples; later emitters stay markers.

### World lights

`world.lights.json` sits beside the manifest, format `sunrise-world-lights` version 1. The manifest
does not list it. It holds one row per placed light, the sun, the sky and the light volumes. Values
are the game's lighting units before exposure. These are irradiance units, the same as Blender's.
`Sky` and `Volumes` are optional. An add-on that does not know them ignores them.

| field | content |
|---|---|
| `Kind` | `Point`, `Spot` or `Line` |
| `Position`, `Direction` | world position; the spot axis or the line axis |
| `Color` | linear RGB, largest channel 1 |
| `Intensity` | radiant intensity along `Direction`; a line gives it per metre |
| `Omni` | intensity a spot adds in every direction |
| `Back`, `BackAngle`, `BackBlend` | intensity a negative spot takes away behind the light, along `-Direction`; never more than `Omni` |
| `Range` | Blender's custom distance, where the light ends |
| `Radius` | Blender's soft falloff radius |
| `SpotAngle`, `SpotBlend` | full cone angle in degrees, and Blender's blend |
| `Length`, `Points`, `Aim` | line length centred on `Position`, its number of Blender points, and the axis they shine along as spots, or null |
| `Copies` | identical light rows at this place; the intensities are their sum |
| `Shadows`, `Enabled`, `Animated` | shadow flag, the light's enable program, and whether it changes with time |
| `TableTag`, `Row`, `MaterialTag`, `PixelShaderTag`, `BubbleHash`, `Layer`, `Fit` | source identity and fit notes |

A light of intensity I lights a surface facing it at d metres by
`I / (d^2 + Radius^2) * (1 - (d / Range)^4)^2`, times the spot's cone. That is Blender 5.2's soft
falloff and custom distance, in EEVEE and Cycles.

`Sun` holds `Direction` toward the sun, `Color` and `Irradiance`. `Direction` is the time-of-day sky
direction, which the game's sun pass shades with. `ShadowDirection` is the light direction the
game's sun shadows use; it can differ by about 10 degrees.

`Sky` names two Radiance `.hdr` images beside the file. Both are equirectangular. Row 0 is straight
up. Column u looks along the azimuth `atan2(y, x) = (0.5 - u) * 2 pi`, the same layout as Blender's
Environment Texture.

| field | content |
|---|---|
| `Path` | `world.sky.hdr`, 512 by 256: the sky the camera sees |
| `LightPath` | `world.sky-light.hdr`, 128 by 64: the sky light surfaces receive |
| `TimeOfDay`, `Keyframe` | the time, and the sky lookup slice it picks |
| `PlacementListTag`, `LookupTag`, `BubbleHash` | the placed atmosphere, its 3D sky lookup, its bubble |

`Volumes` lists the map's local cubemap boxes. `Transform` maps the box to the world, as a
placement matrix does. The box spans `-Extents` to `Extents`.

Studio measures each light by running its game pixel shader on the CPU. The light's TFX program
runs as the deferred light pass runs it, at full fade. The shader lights a white surface facing the
light, at points along 512 directions and inside the light's volume. Rings around the brightest
direction give the cone. `Radius` and `Range` are fitted once to the summed rings, each sample
weighted by its shell's area over its own value, so the dim edge counts by its relative error. The
cone is an omni part, a spot, and when it helps a negative spot facing back. The light that reaches
a surface edge-on is added, so a surface at 60 degrees gets the game's light. A box volume longer
along one axis holds a line light; its extra length is the line. An animated light uses its mean
over 13 seconds.

The add-on sets point and spot power to `4 * pi * Intensity` watts, the back spot to
`-4 * pi * Back`, and sun strength to `Irradiance`. A row of points along a line shares
`Intensity * Length`. A file without `Points` gets one point per half range. Cycles ignores custom
distance, so each light's shader applies the same `(1 - (d / Range)^4)^2` window.

Studio builds the sky from the placed atmosphere, as the game's sky lighting does:

1. The sky colour of each direction is the atmosphere's 3D lookup at the time of day, plus a glow
   around the sun. This is a CPU port of technique 418; it matches Studio's GPU result within 1% on
   average.
2. The game folds the sky into a mirror-ball map, blacks out directions more than 35 degrees below
   the horizon, and halves it down to 2 by 2 texels. It reads surface light from that map between
   its last two levels.
3. `world.sky-light.hdr` is built so that Blender's diffuse light from it equals that read for
   every surface direction. The fit uses order-2 spherical harmonics. On the two maps checked it is
   within 5% of Studio's sky light per pixel.

The game then multiplies the sky light by baked occlusion. The export leaves that out: Blender
shades occlusion itself.
