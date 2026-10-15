---
title: "Native authoring profiles"
description: "The exact game layouts Studio writes new geometry, materials, skins and animation controls for."
weight: 540
group: "How it works"
---
Studio writes new game data only for layouts it has verified. Each verified layout is a profile. An
input that does not fit a profile is refused instead of guessed.

## Static mesh profile

New static models use one profile.

| property | value |
|---|---|
| model class | `0x808071A7` |
| resource class | `0x80807194` |
| input declaration | 123 |
| position stream | 8-byte stride, signed normalized XYZ shorts |
| attribute stream | 20-byte stride: UV, normal and tangent shorts |
| index stream | 32-bit triangle list |
| render stage | 0 |
| parts | one part per imported primitive; all parts share one buffer group |
| material | one per part: the given material, or the template's |

The template's vertex shader must match one exact bytecode hash. That shader reads XYZ positions, XY
UVs, XYZ normals and XYZW tangents, and builds the bitangent from the normal, the tangent and the
tangent's W sign. The hash check stops a matching declaration from standing in for a shader that reads
other attributes.

The compiler computes new position and UV scales, and generates tangents from the imported positions,
normals and UVs. Mirrored UVs keep their handedness.

| entry | stored as |
|---|---|
| model header, mesh resource, three buffer headers | deltas of the installed template |
| position, attribute and index payloads | the imported data, owned by the project |

Typed arrays are appended and their descriptors updated. Unknown template bytes stay tied to the
original package through the delta. No original geometry is copied into the project. Studio picks the
checked installed template by default, then searches other supported static models.

The original asset importer uses this profile too. With **Skip unsupported surfaces**, it imports a
skinned mesh as static geometry at its node transform. Whether this matches the Blender rest pose is
unverified.

## Original asset materials

The original asset importer clones one checked opaque game material, `815B8158`, after verifying the
installed material and shader hashes. Its vertex shader matches declaration 123.

| glTF input | game input |
|---|---|
| base color texture and factor | slot 0 RGB, sRGB RGBA8; factors baked in linear color |
| metallic texture blue channel and factor | slot 1 red |
| roughness texture green channel and factor | slot 1 green, as one minus roughness |
| normal texture and scale | slot 2 red and green, with reversed green |
| no normal texture | a flat tangent normal |

New constants turn off the template's emission and tint. Normal blue is one, so it does not cap
smoothness. Texture coordinates keep the glTF image orientation. The game shader keeps its own
samplers and bytecode.

Normal maps follow the glTF normal texture rules: decode RGB to XYZ, scale X and Y, then normalize. Positive Z lets the game shader rebuild Z. Normals
facing negative Z cannot use this profile. They are refused, or replaced by a flat normal with
**Skip unsupported surfaces**.

Each material becomes nine entries: a material, a constant-buffer pair and three texture pairs.
Texture maps are RGBA8 with one mip, so colors and factors can lose some precision. Material
textures must be PNG images.

The importer refuses these unless **Skip unsupported surfaces** omits them: alpha blending and
masks, emission, occlusion textures, double-sided shading, material and texture extensions, texture
transforms, UV sets other than UV0, wrapping other than repeat, and nearest filtering.

## Skinned model profile

Skinned model replacement accepts one vertex profile.

| property | value |
|---|---|
| input declaration | 16 |
| streams | 16 bytes of position, weights and joints; 20 bytes of UV, normal and tangent |
| weights | four byte weights per vertex |
| joint indices | bytes |
| vertex shader | a matrix-palette shader pinned by bytecode hash |
| shadow pass | its own pinned four-weight matrix shader |

Dual-quaternion, cloth and other profiles are refused. Every material alternative of the part must use
the pinned shader. The template must be visible in its initial state.

The reader follows the glTF skin rules. It ignores the mesh node transform and builds the bind shape
from the joint transforms and inverse bind matrices. Geometry converts to package Z-up space once.
Joint properties, or unique template names, map the file's joint order to the package's. Tangents are
rebuilt from UV0.

The compiler refuses a replacement unless these hold:

- The bone count, bone name hashes and parent order match the installed rig.
- Both bind matrices of every bone match the rig within 0.0002.
- Every vertex has four weights that sum to one. They are stored as bytes that sum to 255.
- Every weighted joint is inside the bone range the model uses, at most 256 bones.
- Every vertex lies inside the bind bounds of the source model.

| mode | stored as |
|---|---|
| replace | the model and its six buffers, as deltas of the installed originals |
| create | nine added entries, as deltas of the originals; the installed root is untouched |

The working glTF is never copied into the project. Each replacement allocates new buffer entries. The
earlier ones stay in the project. Source hashes are checked again before the one transaction
publishes.

The create mode supports the Hob root `80B82FE3`, component `80C443F8` and model `80C4424F`. The root
and its 62 component configs must match the installed profile.

## Animation control profile

The control importer edits existing control channels of a clip.

| supported | value |
|---|---|
| channel codecs | 2 and 3 |
| channels | translation, rotation, uniform scale |
| keys | linear or step, sampled at 30 Hz |
| layout | the original duration, control groups, component maps and value ranges |

Sparse codec-1 channels are left out of the export and stay unchanged. The writer changes sample words
only and keeps the rest of the clip. Every result is decoded again before it is saved. Node custom
properties carry identity, in case an editor drops file-level extras. External buffer paths must stay
inside the imported file's folder.
