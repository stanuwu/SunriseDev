---
title: "Create items and vendors"
description: "Clone items of any category and vendors, create exotic weapons, and edit items later."
weight: 215
group: "Guides"
---
Every item category in the Asset browser has its own **Clone**. A clone is a copy of an installed item
of that category, with its own identity, name and index rows. It keeps everything Studio does not
decode from its base: art, gear entity, lore and policies. Only Weapons has **New**, the exotic weapon
flow. **New** in every other item category is gray, because Studio writes no item from scratch.

Item clones may not work in game. The exotic weapon flow is tested in game, except the parts
listed in [Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/#limits). [Create from a
category](/docs/sunrise-studio/create-content/) explains where New and Clone are and how the dialog
works.

## Clone an item

1. Open a project.
2. Open the item's category in the Asset browser, for example **Ghosts**.
3. Press **Clone** at the right of the list header. Or right-click an item and choose **Clone**, or
   press **Clone** in the viewer toolbar of an open item.
4. In **Base item**, choose the installed item to copy. The list shows only items of this category.
5. Type the **Name**.
6. Type an unused **Package ID**. See [How projects store
   edits](/docs/sunrise-studio/project-storage/#package-ids).
7. Fill the optional fields you need, listed below.
8. Press **Create**.

| optional field | effect |
|---|---|
| **Description** | the flavor text; blank keeps the base item's |
| **Collections** | the Collections page for the new collectible, or Not in Collections |
| **Icon from item** | uses the icon of another item of this category; blank keeps the current one |
| **Rarity** | the rarity |
| **Inventory bucket** | the bucket; only buckets used by items of this category are offered |
| **Base stats** | the stat rows; **Add stat** adds one, untick a row to remove it |
| **Sandbox perks** | the perk rows; **Add perk** adds one |
| **Socket plugs** | the initial plug of each socket; project plugs are marked (project) |

Some fields have a **New** and **Pick existing** switch. On a clone, **New** is gray. Hover it to see
why.

| part | New | why New is gray |
|---|---|---|
| **Icon from item** | **New PNG** | a PNG icon is added with **Edit** after the item exists |
| **Sandbox perks** | **New perk** | only the exotic weapon flow registers new perks |
| **Socket plugs** | **New plug** | clone the plug in **Mods and plugs** first, then pick it |

Studio opens the base item first if nothing is open, then creates the copy. The new item opens in its
category when it is done. **Limits** at the top of the dialog lists what the copy keeps from its base.

## Weapons

**Clone** copies an installed weapon. The copy keeps the base weapon's model, sounds and gameplay
tables. **Weapon type** sets its type line.

**New** creates an exotic weapon with its own archetype, an exotic intrinsic, a unique normal trait, a
catalyst and art from Blender. [Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/) has the
steps, from the Blender export to the finished weapon.

## Armor

**Clone** copies an installed armor piece. It keeps the base armor's model. **New** is gray: Studio
has no armor model writer.

## Mods and plugs

1. In **Mods and plugs**, press **Clone**.
2. In **Base item**, choose a plug, such as a barrel, magazine or mod.
3. Fill **Name**, **Package ID** and the optional fields.
4. Press **Create**.

A plug carries installed sandbox perks only. To put a new plug in a weapon's socket, clone or edit
the weapon and choose the plug in **Socket plugs**. The plug's base must be one of that socket's
embedded plug choices. **New** is gray: Studio writes no plug from scratch.

## Other items

Ghosts, Vehicles, Ships, Subclasses, Shaders, Emblems, Emotes, Finishers, Clan banners, Artifacts,
Engrams, Consumables, Bounties, Quests and Other items each clone the same way. The copy keeps what
Studio does not decode:

| category | kept from the base |
|---|---|
| Ghosts, Vehicles, Ships | the model |
| Shaders | the dye data |
| Emblems, Clan banners | the banner art |
| Emotes, Finishers | the animation; only dense clips of an existing rig can be edited |
| Subclasses | the abilities |
| Artifacts | the artifact mods |

If the base has objectives, a sack block or a plug block, the copy keeps them. **Limits** lists
which.

## Currencies

**Clone** copies an installed currency. The copy has its own hash, so it is a separate currency. Its
**New** is gray, like the other item categories.

## Vendors

1. Open a project.
2. In **Vendors**, press **Clone**. Vendor clones may not work in game.
3. In **Base vendor policies**, choose the installed vendor to copy.
4. Type the **Name**.
5. In **Existing interaction**, choose the interaction that opens this vendor.
6. Under **Sales and prices**, set the stock. The controls are listed below.
7. Type an unused **Package ID**.
8. Optionally type **Secondary text** and choose **Icon from vendor**.
9. Press **Create vendor**.

| to | do this |
|---|---|
| add a sale | choose a sale of the base in **Sale policy**, press **Add sale** |
| remove a sale | press **Remove** on its row |
| change a sale | open its row, choose the item and **Category** |
| add a price | press **Add static price**, choose the item and **Quantity** |
| remove a price | press **Remove price** |

A sale has at most four prices. If **Preparation** reports a problem with the base vendor, fix it
and press **Retry preparation**.

The chosen interaction opens the new vendor and stops opening its old one. A new vendor does not
create or place an NPC. It keeps its base's categories and conditions.

## Edit an item

1. Open the item or its display record.
2. Press **Edit** in the viewer toolbar.
3. Change the fields.
4. Press **Save changes**.

The workflow saves the changes as deltas. Item and vendor edits may not work in game.
To edit a vendor, open either of its two records, press **Edit** and press
**Save vendor**.

If you add or remove a sandbox perk, Studio resets the item's perk display rows and sets its item art
perk list to the new perks. The reset clears the display text and visibility of every perk, also the
perks you keep, so a perk the base hid may show. An item with no perk display block cannot take
perks. [Investment editing
internals](/docs/sunrise-studio/investment-internals/#perk-rows) has the detail.

### Assign a custom icon

1. Open a project-created item and press **Edit**.
2. At **Icon from item**, choose **New PNG**.
3. In **Custom icon (PNG)**, choose a PNG with the current icon's dimensions.
4. Press **Save changes**.

The form reports the needed size if it differs. Heliostat uses 96 x 96 pixels. On an installed item,
**New PNG** is gray: clone the item first.

Studio creates a private texture, bitmap and icon container. It updates the item's icon hash row
and matching Collections display together. Installed icons stay unchanged. You can assign another
PNG later, and each assignment supports Undo.

Custom PNG icons need a static, single-mip RGBA8 icon profile. A profile can have several bitmap
groups. The PNG fills the first. Studio scales it for the others. An item with a plug block, such as
a mod or a shader, uses the perk profile: 96 x 96 pixels plus a 40 x 40 copy for compact perk rows.
Every other item uses the profile of its current icon. If that icon is animated or not RGBA8, the form says so and Studio writes nothing.

For a plug with one project-authored sandbox perk, **Sandbox perk icon (PNG)** changes that perk's
symbol separately. This lets a catalyst item and its bonus perk use different artwork. The behavior
program stays unchanged.

For a weapon with a project-authored archetype, **HUD silhouette (PNG)** accepts a 137 x 76
transparent PNG. It changes the gameplay HUD silhouette separately from the inventory icon. It
may not work in game.

**Weapon type** sets the type line under the name, the type identifier and the inventory trait. A
stock name such as Auto Rifle keeps that type's trait. A new name such as Induction Rifle gets its
own identifier and no stock trait, so bounties that count a stock type do not count the weapon.
The type name is only a label. It does not change how the weapon plays.

### Name the frame

**Frame name**, **Frame description** and **Frame icon from item** change the weapon's frame, such
as Adaptive Frame, or its exotic intrinsic. They start with the frame's current text. If the frame
perk belongs to the project, it gets the same name and description. **Frame icon from item** picks
an existing icon only; its **New PNG** choice is gray, since Studio has no frame icon writer yet.
The frame fields may not work in game.

Most stock frames are shared by many weapons, so Studio refuses to edit them in place. Copy the frame
first: **Clone** in **Mods and plugs** with the frame as the base item, then choose the copy under
**Socket plugs**. The copy keeps the frame's perk.

### Tune gameplay

How a weapon plays comes from its raw stats and from tables in its weapon translation config. The
config has one group of tables per weapon family. The weapon reads one group.

**Weapon family** picks that group: Auto Rifle, Pulse Rifle, Scout Rifle or Submachine Gun for the
auto rifle config. This is the real weapon type for gameplay. Save a family change before you
change its values.

The tuning, gameplay, reticle and HUD fields need a weapon made with **New**, which owns its
archetype. On a cloned or installed weapon they are replaced by one gray **Weapon tuning** row.
Hover it for why.

For a weapon with a project-authored archetype, three fields tune the most common values:

| field | effect |
|---|---|
| **Fire rate (RPM)** | rounds per minute as Inspect shows it, 60 to 6000 |
| **Damage per shot** | body damage of one bullet; precision hits multiply it |
| **Magazine (rounds)** | rounds per magazine at the weapon's magazine stat |

**Gameplay values** lists every table of the weapon's group, by the stat it reads. Each box shows the
value the weapon gets at its current stats, which add up the weapon's and its plugs' stats. Hover a
box to see its name where it is known. A changed value scales the whole column, so masterworks and
mods still move it. A column that is zero is set to the value at every stat.

The first change copies the shared translation config for this weapon and adds a private Inspect
stat group. Later changes edit those copies. Blank fields keep the current value, and a new fire
rate keeps the current magazine size. Other weapons are not affected. The Inspect bars of Range,
Stability and the other stats come from **Base stats** and do not follow the tables.

A pulse rifle's tables count bursts. Studio measures how many rounds Inspect shows per burst from
the installed weapons of that family, and uses it for the RPM field and the Inspect RPM.

### Write the item's lore

**Lore title**, **Lore subtitle** and **Lore text** change what Inspect's Show Lore page says. They
start with the item's current lore. The first change gives the item its own lore row, so the base
item keeps its text. Later changes edit that row. Clear all three fields to remove the lore. The
title is required otherwise. Use plain ASCII text.

**Sight reticle** adds the base weapon's holographic reticle to the sight. The reticle shows at the
center of the screen while aiming, so keep solid geometry off the line of sight. **Reticle texture
(PNG)** replaces its texture. The red and green channels pick its two colors. A later Blender
reimport keeps the reticle. Sight reticle and Reticle texture may not work in game.

## Limits

- Item and vendor clones, other than the exotic weapon flow, may not work in game.
- Only Weapons has **New**. Every other item category clones an installed item.
- Two mods that each add an item, a vendor or a collectible both keep their rows. Sunrise merges the
  installed tables at startup and moves each mod's references to its rows. If one of those tables
  cannot merge, none of them merges that startup, and the earlier mod's rows are lost. See
  [Two mods patching one package](/docs/sunrise/mods/#two-mods-patching-one-package).
- Whether the game accepts a row added to an installed index table is unverified.
- The first new collectible moves the collectible rows to the end of their entry. This adds about
  1 MB to the patch.
- A new collectible shares its base item's acquired state.
- A conditional price stays conditional. The Sunrise server sells at static prices only.
- Some base vendors have policies that refer to sales by position. For those, removing or reordering
  sales is refused.
- The last usable vendor index is 32,766.
- **Weapon family** and **Gameplay values** may not work in game. A new family may keep
  some firing behavior of the old one, such as burst fire. The three tuning fields work in game.
- **Sight reticle**, **Reticle texture (PNG)**, **HUD silhouette (PNG)** and the frame fields
  may not work in game.
- Whether Inspect shows the frame plug's text or its perk's text is unverified.

## Related pages

- [Edit items and vendors](/docs/sunrise-studio/investment/) changes installed items and vendors.
- [Investment editing internals](/docs/sunrise-studio/investment-internals/) explains the string
  bank, the index rows and the icon rows a new item gets.
