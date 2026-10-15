---
title: "Replace a skinned model"
description: "Put new skinned geometry on an installed rig, or create a new entity on the Hob profile."
weight: 180
group: "Guides"
---
**Assets > Import skinned model...** puts one glTF or GLB mesh with skin weights onto an installed
entity's rig. The rig, the clips and the material stay. It has two modes:

| mode | result |
|---|---|
| **Replace model** | replaces all geometry of the selected model |
| **Create asset** | adds a new entity, model component and model on the Hob rig profile |

Both modes save their data as deltas. Neither is tested in game.

## Before you start

- Open a project.
- Open the installed entity, or a related model or clip with its animation owner set. An added
  asset cannot take this import.

## Prepare the mesh in Blender

1. Export the entity's full asset bundle. See
   [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).
2. Import the bundle in Blender with the Sunrise add-on.
3. Keep the armature's rest pose, bone hierarchy and Sunrise bone properties.
4. Model your mesh. Use one material and at most four weights per vertex.
5. Select the mesh and its armature.
6. Export glTF or GLB with skins, normals, UVs and **Custom Properties** on. Leave tangents off.

## Import into Studio

1. Choose **Assets > Import skinned model...**.
2. Pick the glTF or GLB.
3. Choose **Replace model** or **Create asset**.
4. Choose the installed **Template** part.
5. Type a **Name**. It starts as the file name.
6. Type an unused **Package ID**. It starts as the last package ID your project used, or `0AA0`.
7. Press **Review import**.
8. Read the counts. For Replace model, the review says how many template parts it removes.
9. Press **Replace model** or **Create asset**.

**Edit > Undo** restores the earlier project state.

## What Replace model does

It replaces **all geometry in the selected model**. It keeps the template's matching render passes,
material assignment and visibility indices. Other parts and LODs of that model are removed. The new
vertices must stay inside the installed model's bind bounds. It needs six unused entries in a new
package for the buffers.

## What Create asset does

It adds a new entity root, model component and model, with your geometry and six buffers. These are
nine entries in a new package. It keeps the template's rig, clips and other components. It supports
one checked profile: the Hob root `80B82FE3`, component `80C443F8` and model `80C4424F`. The new
entity opens after creation and takes ordinary bundle edits.

## Rules for the mesh

- Export every joint of the entity's skeleton.
- Bone names, parents, bind matrices and inverse binds must match the installed rig.
- Use one material primitive and at most four weights per vertex. The weights must sum to one.
- Use one UV set. Vertex colors, authored tangents and morph targets are refused.
- The bind pose must be consistent. Studio derives the bind shape from the joints and ignores the
  mesh node transform.
- The template part must be a LOD0 part that is visible in the entity's initial state.

[Native authoring profiles](/docs/sunrise-studio/authoring-profiles/#skinned-model-profile) has the
exact profile.

## Limits

- New skeletons and retargeting are not supported.
- Materials, textures and animation in your file are not applied. Use the material, texture and
  animation editors for those.
