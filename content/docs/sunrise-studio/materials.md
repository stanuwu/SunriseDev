---
title: "Edit materials"
description: "Read, change and copy a material, in Studio or in Blender."
weight: 170
group: "Guides"
---
A material binds textures to numbered shader slots and stores constant vectors. Studio does not know
which slot is color and which is normal, so you pick textures by slot number and check the preview.
Shaders cannot be authored.

## Read a material

1. Open the material, or click the material name in the Inspector's **PART** section.
2. Open the **Materials** page for its texture slots and constants.
3. Open the **Shaders** page for the compiled shader declarations and code.

A model's **Materials** page lists every material the model uses. Pick one in the list at the top.
**Open material** opens it as its own asset. On the **Shaders** page, **Open bytecode** opens the
shader code entry.

## Change a slot or a constant

1. Open a project.
2. Open the material.
3. Press **Edit** in the viewer toolbar.
4. Under **Texture slots**, open a slot and pick a texture.
5. Under **Constants**, type new values. Each must be a finite number.
6. Press **Create**.

The change is saved as a delta of the material. You can also edit a texture assignment or a vector
value on the **Properties** page. See
[Edit properties and bytes](/docs/sunrise-studio/edit-properties/).

## Copy a material

1. Open a project.
2. Open an installed material and press **Clone** in the viewer toolbar. It becomes the
   **Template material**. **Clone material** in the **All other assets** **New** list opens the same
   dialog. It uses the open material as the template when one is open.
3. Type a **Name** and an unused **Package ID**.
4. Change **Texture slots** and **Constants** as needed. A slot picks an installed or project
   texture. To use a new image, make it with **New** > **Texture** first.
5. Press **Create**.

The copy keeps the template's shaders and slot layout. It is stored as a delta of the template. The
template must be installed. **New** is gray for materials, because shaders cannot be authored.

## Edit a material in Blender

1. Open the material in Studio.
2. Choose **Assets > Export material to Blender...**.
3. Pick an empty folder outside the project and the installation.
4. In Blender, select a mesh.
5. Choose **File > Import > Sunrise material**.
6. Open `material.sunrise-material.json`. The material is added to the mesh and selected.
7. Edit the named nodes. Save image edits inside the material folder, as PNG or DDS.
8. In Material Properties, open the **Sunrise material** panel and press **Export Sunrise edits**.
9. In Studio, open the same material.
10. Choose **Assets > Import as delta...** and pick `material.edited.sunrise-material.json`.

Texture nodes keep the game's stage and slot names. Value nodes hold the constants. The native
texture tags are editable in the **Sunrise material** panel. The add-on leaves texture and value
nodes unconnected, because the slots have no known shader roles.

On this path, a PNG edit works only for a single-mip RGBA8 or BGRA8 texture. Edit other textures
as DDS. A full asset bundle also accepts PNG edits for compressed formats. See
[Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).
