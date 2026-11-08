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

## Edit a tag by its fields

The **Tag** page shows any asset whose class the tag registry describes. It lists every field by
name, with nested structs, arrays, pointed-to objects and strings below their field. The
**Properties** page shows the same fields, and the **References** page lists each reference field as
**Typed**. On the **Properties** page, an array lists its first 256 rows; **Show all** lists the
rest. A vector shows one row per number and a flags field shows one number, so both edit there too.

1. Open the asset, then the **Tag** page.
2. Click a field. The right side shows its path, type and offset, and the bytes around it with the
   field highlighted.
3. Type the new value and press **Apply**, or press Enter.

| field | value to type |
|---|---|
| whole number | a number, or `0x` hex |
| float | a number, or its bits as `0x` hex |
| vector | numbers separated by commas |
| reference or hash | `0x` hex |
| flags | tick the bits |
| bytes no field covers | hex bytes; the length stays the same |

A reference field also has these buttons:

- **Open** opens the asset it names.
- **None** clears it.
- **Pick** lists the assets of the classes the field can name, or of the class it names now. Choose
  one, check its name and class, and press **Use**.

Strings are read only here, because a new string changes the tag's length. Edit them in a loose tag
file. See [New tags](/docs/sunrise-studio/project-storage/#new-tags).

### Arrays

Select an array and press **Add row** to append an empty row. Select a row for these buttons:

| button | does |
|---|---|
| **Insert before** | adds an empty row before it |
| **Duplicate** | adds a copy after it; the copy shares the arrays, objects and strings the row points at |
| **Delete** | removes it |
| **Up**, **Down** | moves it one place |

The changed array is written as a new block at the end of the tag. Every pointer to a row that is
kept follows it. The old rows stay in place, unused. An array shared by two fields cannot be
resized. Large arrays show 200 rows at a time; use **<** and **>** to page.

### Find and compare

- Type in the search box to filter by field name, value, or the name shown beside a value. Typing a
  string also finds hash fields that hold that string's hash.
- A search that starts with `.`, `@` or `##0x` is a path query; it runs on Enter.
  `.bubbles[0].name` starts at this asset, `@0x80A1B2C3.bubbles[*]` at another. Click a result to
  select it; a result in another asset opens that asset. See [Path queries](#path-queries).
- After an edit, changed fields show in the accent colour. **Changed** shows only those. A selected
  changed field shows its installed value.

Each edit is one undo step and is saved as a byte delta, like any other edit.

### Path queries

A path query names fields by their registry names. The Tag page and the asset browser search both
run them. A query has a start, then steps.

| start | starts at |
|---|---|
| `.` | the open tag; Tag page only |
| `@0x` and 8 hex digits | that tag |
| `##0x` and 16 hex digits | the tag with that wide hash |
| `@<class>` | every tag of the class |

| step | does |
|---|---|
| `.name` | a field of the struct |
| `[*]` | every row of an array |
| `[n]` | one row; a negative number counts from the end |
| `[#key]` | the rows whose key field holds that value |
| `->` | follows a reference or a pointer |
| `<class>` | keeps the rows of that class |
| `{field op value}` | keeps the rows where the test holds; `op` is `==`, `!=`, `<` or `>` |

A class is a registry name, the name without its `s_` prefix, a `.tft` type or `0x` and the class
id. A value is a decimal number, `0x` hex, or a string in quotes, compared as its FNV-1 hash. For
example, `@<s_scenario>.bubbles[*]` lists every scenario bubble, and `.bubbles[0].name` reads the
name of the open scenario's first bubble.

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

Field names in a property `.json` come from the tag registry. A file whose field names the current
registry no longer has does not import. Export the asset again.

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
