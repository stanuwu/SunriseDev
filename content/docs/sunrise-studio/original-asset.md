---
title: "Import an original Blender asset"
description: "Export a model you made in Blender and import it with its materials and textures."
weight: 155
group: "Guides"
---
An original asset is a scene you made in Blender, not one exported from the game. The Blender add-on
exports it. Studio imports every surface it can encode and lists the rest by name.

## Before you start

- Install the [Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin). See
  [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/#install-the-blender-add-on).
- Use PNG images, one UV set, repeat wrapping and backface culling in your materials.

## Export from Blender

1. Select the objects to export. With nothing selected, the whole scene is exported.
2. Choose **File > Export > Sunrise original asset**.
3. Pick a folder and a name.

The add-on writes two files side by side. Keep them together.

| file | holds |
|---|---|
| `<name>.glb` | meshes, UVs, normals, materials, images, skins, morph targets and animations, Y-up |
| `<name>.sunrise-original.json` | every particle system, because glTF cannot hold particles |

The export refuses a scene with no mesh.

## Import into Studio

1. Open a project.
2. Open **All other assets** in the browser, press its **New** icon and choose **Static prop**.
3. Set **Source** to **Original Blender asset**.
4. Press **Browse** next to **Mesh file** and pick `<name>.glb`.
5. Read the **Surfaces** list. Each surface is marked **Ready**, **Absent** or **Unsupported**. Its
   first line counts the ready and unsupported surfaces. Hover a surface for the detail.
6. If a surface is **Unsupported**, set **Skip unsupported surfaces** to
   **Yes: import the supported surfaces only**.
7. Type a **Name** and an unused **Package ID**.
8. Press **Create**.

Without Skip, **Create** stays disabled while a surface is unsupported, so nothing is dropped
silently.

## Which surfaces import

| surface | imported |
|---|---|
| mesh geometry | triangle primitives; one static part per primitive |
| UVs | the first UV set |
| normals | yes; missing normals are generated from the faces |
| tangents | generated from the UVs; authored tangents have no encoder |
| textures | PNG images, as RGBA8 2D textures with one mip |
| materials | opaque base color, metallic, roughness and tangent normals |
| vertex colors | no |
| skin weights | no; use [Replace a skinned model](/docs/sunrise-studio/skinned-model/) |
| skeleton, animations, morph targets, particles | no |

With Skip, a skinned mesh imports at its node transform, a morphed mesh imports as its base shape,
and point and line primitives are dropped.

## How materials convert

Studio clones one checked opaque game material and fills it from your glTF material.

| glTF input | game input |
|---|---|
| base color texture and factor | slot 0 color |
| metallic texture and factor | slot 1 red |
| roughness texture and factor | slot 1 green, as smoothness |
| normal texture and scale | slot 2, red and green |
| no normal texture | a flat normal |

These are refused, or omitted with Skip:

- alpha blending and alpha masks
- emission and occlusion textures
- double-sided shading
- extra UV sets, texture transforms and texture extensions
- nearest filtering and non-repeat wrapping
- material extensions
- images other than PNG
- normal maps with negative Z

[Native authoring profiles](/docs/sunrise-studio/authoring-profiles/#original-asset-materials) has
the exact conversion.

## What you get

One model with one part per primitive, and per material one material, its constants and three
textures. Each part keeps its own material. The model has the same limits as a static prop. See
[Add a static prop](/docs/sunrise-studio/static-prop/#limits).
