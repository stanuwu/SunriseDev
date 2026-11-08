---
title: "Create from a category"
description: "Start new content as New or Clone from its category, pick or make each part, and edit an existing asset in a workflow."
weight: 145
group: "Guides"
---
Each category in the Asset browser creates its own content. **New** starts from nothing. **Clone**
starts from a copy of an installed asset of the same category. Both open one guided dialog. It asks
for every value it needs, checks them, and creates the result in one undo step. The result then
opens in its category viewer.

## Where to start

| place | what it offers |
|---|---|
| a category list header | **New** (plus icon) and **Clone** (copy icon), at the right of the title |
| a row's right-click menu | **Clone...**, with that row as the base |
| the viewer toolbar, above the pages of the open asset | **New**, **Clone** (the open asset as the base) and **Edit** (pencil icon) |
| the **All other assets** header | a **New** list: **Texture**, **Static prop**, **Clone material**, **Destination** and **Activity**, then the types Studio cannot write yet |
| **File > New mission script...** | the Mission Graph's **New mission script** dialog |

**Clone** from a list header uses the open asset as the base when it belongs to that category.
Otherwise you pick the base in the dialog. An asset the project added cannot be a base, except a
perk program. Its Clone icon is gray with the tip "Clone an installed one". Clone on an item's or a
vendor's display record uses the item or the vendor as the base.

A gray icon cannot run. Hover it to see why: the action is not built yet, Studio has no writer for
it, or no project is open.

## Run a workflow

1. Open a project.
2. Press **New** or **Clone** in a category, or choose **Clone...** on a row.
3. Read **Limits** at the top of the dialog.
4. Fill the fields under **REQUIRED**.
5. Fill the fields under **OPTIONAL** that you need.
6. Fix every problem listed under the fields.
7. Press **Create**.

The title bar names the workflow. Some workflows name the button differently, such as **Create
vendor**, **Compile and create** or **Create exotic weapon**. **Create** stays disabled while any
problem remains. **Cancel** closes the dialog without a change. Some workflows finish in the background. **Cancel** then turns into
**Close**, and the work goes on after you close the dialog.

## New or pick existing

A part of the new content, such as a model or a texture, can show two choices under its label:

- **New** makes the part in the dialog. Its own fields show in place of the picker.
- **Pick existing** chooses an installed or project asset that fits.

**New** is gray when Studio cannot write that part from scratch yet. Hover it for why. The part then
stays on **Pick existing**.

A picker lists only assets that fit the part. Type in **Search** to narrow the list. A project row
says **Project**. An installed row shows its tag, so rows with the same name differ. Hover a row
for its package and tag. **Clear** removes the choice.

## Choose a package ID

Every workflow that adds entries asks for a **Package ID**. Entries with the same ID share one new
package, so several workflows can use the same ID. The field starts with the last ID your project
used, or the next free ID of your mod. [Package IDs](/docs/sunrise-studio/project-storage/#package-ids)
has the rule.

## Guides per category

| category | guide |
|---|---|
| Weapons, exotic weapons | [Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/), [Create items and vendors](/docs/sunrise-studio/create-items/) |
| Armor, Mods and plugs, other item categories, Vendors | [Create items and vendors](/docs/sunrise-studio/create-items/) |
| Perks | [Edit perk behavior](/docs/sunrise-studio/perk-behavior/) |
| Guardians | [Guardians](/docs/sunrise-studio/guardians/#new-and-clone): view only, **New** and **Clone** are gray |
| Enemies and NPCs | [Enemies and NPCs](/docs/sunrise-studio/enemies/) |
| Interface | [Edit CUI screens](/docs/sunrise-studio/cui/) |
| Texture | [Import and edit textures](/docs/sunrise-studio/textures/) |
| Material | [Edit materials](/docs/sunrise-studio/materials/) |
| Static prop | [Add a static prop](/docs/sunrise-studio/static-prop/) |
| Mission script | [Script a mission](/docs/sunrise-studio/mission-graph/) |
| Destination (in **All other assets**) | [Author map content](/docs/sunrise-studio/new-map/#create-a-destination-from-an-installed-one) |
| Activity (in **All other assets**) | [Author map content](/docs/sunrise-studio/new-map/#add-an-activity-to-a-destination) |

An asset with no category has **Clone** as a plain duplicate. It opens the **Add asset** dialog with
the asset as the source and a **Create copy** button. The copy is stored as a delta of the asset. It
may not work in game. A texture cannot be duplicated this way, since the copy would share its
pixels. Use **New** > **Texture** instead.
[Duplicate an asset](/docs/sunrise-studio/edit-properties/#duplicate-an-asset) has the steps.

## Edit in a workflow

1. Open an item, a vendor, a material, a texture, a CUI screen or a perk.
2. Press **Edit** in the viewer toolbar.
3. Change the fields.
4. Press the save button: **Save changes** for an item, **Save vendor** for a vendor, **Create** for
   a material or a texture.

On an installed asset, the tip says "Stores a delta of the installed asset". A gray **Edit** says
why in its tip. Item, vendor and perk edits may not work in game. A vendor opens from either of
its two records. For a CUI screen, **Edit** opens the CUI page. For a perk, it opens the **Perk
behavior** page. **Assets > Edit perk behavior...** opens a picker instead. Its **Open node editor**
button opens the same editor.

## Shortcuts

These actions have no default keys. Set them in
[Shortcuts and presets](/docs/sunrise-studio/shortcuts/).

| action | does |
|---|---|
| New texture | **New** texture |
| New static prop | **New** static prop |
| Clone material, Clone weapon, Clone armor, Clone plug | **Clone** in that category, based on the open asset when it fits |
| Open Interface list | opens the Interface category, where a screen opens on the CUI page |
| New mission script | **File > New mission script...** |

## Limits

The **All other assets** **New** list shows these grayed out. Hover one for its reason.

| type | reason |
|---|---|
| Animation | Edit clips of an existing rig with Import animation. |

The Animation item points at **Assets > Import animation controls...**. See
[Edit animation controls](/docs/sunrise-studio/animation/).

Categories carry their own reasons on their gray icons. For example, **New** in Enemies and NPCs
says that no AI, health or loot field is known, and **Clone** there says that entity clone is not
supported yet.
[Replace a skinned model](/docs/sunrise-studio/skinned-model/) can create a visual entity on the Hob
rig profile. [Author map content](/docs/sunrise-studio/new-map/) covers what you can do to a map,
and [Wide-hash aliases](/docs/sunrise-studio/wide-hash-aliases/) covers native additions.
