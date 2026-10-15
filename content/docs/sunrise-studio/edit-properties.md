---
title: "Edit properties and bytes"
description: "Change any asset through its decoded fields, its bytes or an exported file."
weight: 140
group: "Guides"
---
The generic editors work on any asset. Use them when no dedicated editor covers the field you want.
Each change is saved as a byte delta. You need a project open.

## Change a decoded field

1. Open the asset.
2. Open the **Properties** page. Type in **Find property** to filter.
3. Click the field's row.
4. In the Inspector's **PROPERTY** section, type the new value.
5. Press **Apply**, or press Enter.

Only fields whose offset and encoding Studio knows are editable. Other fields show **Read only**.
A field bound to a mod setting shows its setting instead. See
[Bind CUI values to mod settings](/docs/sunrise-studio/config-bindings/).

## Replace bytes

1. Open the asset.
2. Open the **Bytes** page.
3. Type an offset in **Hex offset** and press **Go**, or click a row to take its offset.
4. Type the new bytes in **Replacement bytes**, as hex, for example `00 00 80 3F`.
5. Press **Apply**.

The bytes at the offset are replaced. The asset keeps its length.

## Export an asset

1. Open the asset.
2. Choose **Assets > Export...**, or press the Export icon in the Inspector and choose **Asset
   file...**.
3. Pick a file name and type, outside the project and the installation.

| asset | file types |
|---|---|
| texture | DDS, PNG, raw `.bin`, property `.json` |
| model or scene | GLB, glTF, OBJ, raw `.bin`, property `.json` |
| anything else | raw `.bin`, property `.json` |

With a mesh part selected, a model export writes that part alone, in model space, ready for
reimport.

## Import an edited file

1. Open the same asset.
2. Choose **Assets > Import as delta...**, or press the **Import as delta** icon in the Inspector.
3. Pick the edited file.

| file | effect |
|---|---|
| property `.json` | applies the changed field values; asset and field identities must match |
| raw `.bin` | replaces the whole entry; it may grow or shrink |
| PNG or DDS | replaces texture pixels; see [Import and edit textures](/docs/sunrise-studio/textures/) |
| OBJ, glTF or GLB | moves the vertices of one mesh part; see [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/#edit-one-mesh-part-without-the-add-on) |
| `.sunrise-material.json` | applies a material edit from Blender; see [Edit materials](/docs/sunrise-studio/materials/) |

For an asset your project added, the Inspector icon reads **Replace asset**. On a source asset, any
file replaces the stored file.

## Duplicate an asset

A duplicate is a new entry that keeps the original as its delta base. It keeps the original's
references. It does not copy the assets it depends on.

1. Open the asset.
2. Press the **Clone** icon above the asset's pages, or right-click its row and choose **Clone...**.
3. In the **Add asset** dialog, check the **Source** and type a **Name**. It starts as the source
   name plus ` copy`.
4. Type an unused **Package ID**. See
   [Package IDs](/docs/sunrise-studio/project-storage/#package-ids).
5. Press **Create copy**.

This is Clone for assets in **All other assets**. It may not work in game. An asset in a category,
such as an item, clones through its category's workflow instead. A texture cannot be duplicated,
because the copy would share its pixels.

## Add a file as an asset

1. Choose **Assets > Add asset...**, or press **Add asset** in the toolbar.
2. Pick the **File** with **Browse**.
3. Type a **Name**.
4. Choose the kind.
5. Fill the fields for that kind.
6. Press **Add asset**.

| kind | stores | fields |
|---|---|---|
| Source asset | the file, kept for external work and left out of builds | none |
| Native package entry | the file as a new package entry | **Package ID**, **Class / reference**, **Type**, **Subtype** |

A native entry needs an encoded game payload. An arbitrary model or animation file cannot be used as
one. For a PNG texture or a static mesh, use **New** in the **All other assets** header. See
[Create from a category](/docs/sunrise-studio/create-content/).

## Revert an asset

1. Open the asset.
2. In the Inspector, press **Revert to original**.

Or right-click its row in the **Changes** tab and choose **Revert**. To remove an added asset,
right-click its row and choose **Remove**.

## Read structure graphs

The **Graph** page draws the structure of a behavior or CUI asset: nodes and links. It does not run
the behavior. With the default preset, middle or right drag pans and the wheel zooms. **Reset view**
starts over.
