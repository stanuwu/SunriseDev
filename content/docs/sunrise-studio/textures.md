---
title: "Import and edit textures"
description: "Create a texture from a PNG, or replace the pixels of an installed texture."
weight: 165
group: "Guides"
---
Studio can create a new texture from a PNG and replace the pixels of an existing texture. Replaced
pixels are saved as a delta of the installed texture.

## View a texture

1. Open the texture.
2. On the **Scene** page, move **Mip** to pick a mip level.
3. For a cube or array texture, move **Face**. For a volume texture, move **Slice**.

The size of the shown level appears next to the sliders.

## Create a texture from a PNG

1. Open a project.
2. Open **All other assets** in the browser, press its **New** icon and choose **Texture**. With a
   texture open, you can press **New** in the viewer toolbar instead.
3. Press **Browse** next to **Image** and pick the PNG.
4. Type a **Name**.
5. Type an unused **Package ID**. See
   [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
6. Press **Create**.

The result is a 2D RGBA8 texture with one mip. Its header is a delta of an installed header.

**Clone** is gray for textures. A copy would share its pixels with the original.

## Replace the pixels of a texture

1. Open a project.
2. Open the texture.
3. Press **Edit** in the viewer toolbar.
4. Press **Browse** next to **Image** and pick the PNG.
5. Press **Create**.

This works on a single-mip RGBA8 or BGRA8 2D texture. The image must match the texture's size. The
format stays as it is. For other textures, use DDS or a bundle.

A project texture must own its pixels. A copy whose header still points at the original's pixels is
refused, so the edit cannot change the original.

## Edit a texture in an image editor

1. Open the texture.
2. Choose **Assets > Export...**.
3. Save it as PNG or DDS, outside the project.
4. Edit the file.
5. Choose **Assets > Import as delta...** and pick the edited file.

| format | rule |
|---|---|
| PNG | the texture must be a single-mip RGBA8 or BGRA8 2D texture of the same size |
| DDS | the file must keep the size, format, mip count, array size and texture kind |

PNG export writes the top mip of the first slice. It decodes RGBA8, BGRA8, R8 and BC1 to BC5. It
cannot decode other formats, such as BC6H and BC7. DDS keeps those blocks as they are. The split
between resident and streamed data is kept.

## Edit compressed textures in a bundle

In a full asset bundle, you can paint a PNG for BC1, BC2, BC3, BC4, BC5, BC7, RGBA8, BGRA8 and R8
textures. Studio re-encodes only the blocks you changed. See
[Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).

- Only the edited mip and slice change. Other mips are kept, not rebuilt.
- BC encoding loses some detail in the edited blocks. Untouched blocks stay byte for byte.
- R8 needs gray pixels with opaque alpha. BC4 and BC5 refuse changes to channels they cannot store.
- Other formats, such as BC6H, need an edited DDS file.

## Limits

- A PNG must use 8 bits per channel and no interlacing.
- A PNG can be at most 16384 pixels on a side, and at most 8192 x 8192 pixels in area.
