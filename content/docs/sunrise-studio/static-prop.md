---
title: "Add a static prop"
description: "Create a new standalone static model from an OBJ, glTF or GLB file."
weight: 150
group: "Guides"
---
A static prop is a new model with one part and no skeleton. Studio compiles your mesh with one
verified game shader profile and keeps an installed material. The result is a standalone model
asset. It is not an entity and it is not placed in any map.

## Before you start

- Open a project.
- Prepare an OBJ, glTF or GLB file with triangle geometry, normals and one UV set.

## Create the prop

1. Open **All other assets** in the browser, press its **New** icon and choose **Static prop**. With a
   static prop open, you can press **New** in the viewer toolbar instead.
2. Leave **Source** on **Mesh file**.
3. Press **Browse** next to **Mesh file** and pick your file.
4. Type a **Name**.
5. Type an unused **Package ID**. See
   [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
6. To use a particular installed model as the template, choose it in **Template part**. Leave it
   empty to use the first installed static mesh with the supported shader. Its **New** choice is
   gray, since shaders cannot be authored.
7. Press **Create**.

The import runs in the background. When it finishes, Studio opens the new model. The **Changes** tab
lists its entries as `Added` and `Derived` rows.

**Clone** is gray for static props. A copy would share its buffers and material with the original.

## What you get

| part | how it is stored |
|---|---|
| model, mesh and buffer headers | deltas of the installed template |
| positions, normals, UVs, indices | your geometry, owned by the project |
| tangents | generated from your positions, normals and UVs |

New geometry can have up to 4,000,000 vertices and 8,000,000 triangles. Several primitives in the
file merge into one part with the template material. Mirrored UVs keep their tangent direction.

[Native authoring profiles](/docs/sunrise-studio/authoring-profiles/#static-mesh-profile) lists the
exact profile. To import materials and textures with the model, use
[Import an original Blender asset](/docs/sunrise-studio/original-asset/).

## Limits

- One shader profile, one part, one installed template material.
- No placement in a map, no collision, no cloth, no skeleton and no animation.
- The game's static shading needs an instance row and map AO data. A standalone model has neither.
  The 3D view still shows its geometry.
- In-game placement and culling of a new model may not work.
