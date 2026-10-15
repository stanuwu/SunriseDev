---
title: "Edit items and vendors"
description: "Browse the item and vendor catalog and change rarity, stats, perks, sockets, sales and prices."
weight: 210
group: "Guides"
---
Investment data is the game's item, vendor and currency catalog. Studio reads it from the installed
packages. Each change is saved as a delta and builds into a patch. [Items, characters and
inventory](/docs/destiny-2/investment-data/) explains the data itself.

## Open an item or vendor

1. In the Asset browser, open the **Assets** tab.
2. Click an item category, for example weapons, armor, currencies or vendors. Or type a name or
   an item hash in **Search items, enemies and assets**.
3. Click the item or vendor.

The **Investment** tab shows its details. Studio reads the catalog the first time, in the
background, so the browser stays usable. If it is not read, press **Load investment**. If an item
fails to read, press **Retry**. [Find and open assets](/docs/sunrise-studio/find-assets/) explains
the categories and the search.

The item details show the icon, rarity, type, description, ITEM fields, BASE STATS, SOCKETS and
PERKS. **Display strings** opens the item's display record.

## Change a field

1. Open a project.
2. Click the value button next to the field, for example the rarity.
3. In **Edit investment field**, type or choose the new value.
4. Press **Save delta**.

The editable item fields are **Maximum stack**, **Inventory bucket** and **Rarity**. To change an
item's name or flavor text, press **Edit** in the viewer toolbar. See [Create items and
vendors](/docs/sunrise-studio/create-items/#edit-an-item).

A failed save keeps your value for another try. A successful save closes the editor.

## Change stats

1. Click a stat's value under BASE STATS.
2. Type the new base value. The editor shows the display value it gives.
3. Press **Save delta**.

| to | do this |
|---|---|
| add a stat | press **+** next to BASE STATS, choose the stat and value, press **Add** |
| remove a stat | press **-** on its row |

Base stats are authored values, before runtime modifiers and plugs. Computed marks a value
expression. Conditional marks an activation expression. A value of 0 uses the stat's level curve
when it has one. Rows with value 0 are grouped under **Zero stats**. New rows are unconditional.

## Change perks

| to | do this |
|---|---|
| add a perk | press **+** next to PERKS, choose the perk, press **Add** |
| remove a perk | press **-** on its row |
| change a perk | click its index button, type the new index, press **Save delta** |

Perks show their authored name, description and icon. Many perks have no authored name. Those show
the item that carries them, or their index.

## Change a socket's initial plug

1. Click the plug name under SOCKETS.
2. Choose a plug from the allowed list. **Find allowed plug** filters it.
3. Press **Save delta**.

Only plugs in the socket's own pool are offered. **Open** opens the current plug item. To give a
socket a plug copied in your project, use the item workflow. See [Create items and
vendors](/docs/sunrise-studio/create-items/#mods-and-plugs).

## Change a vendor

1. Open a vendor from the asset browser.
2. Open a sale row.

| to | do this |
|---|---|
| change the sold item or category | click the field's value and press **Save delta** |
| change a price | click the cost button, choose the item and quantity in **Edit cost**, press **Save delta** |
| copy a cost | press the Duplicate cost icon |
| remove a cost | press the Remove cost icon |
| copy a sale | press the Duplicate sale icon |
| remove a sale | press the Remove sale icon |
| open the sold item | press **Open item** |

A sale has a twin at the same index in the vendor's display record, so both change together in one
undo step. A copy goes to the end of both lists. A cost edit gives the sale its own cost list, so a
list shared with another sale never changes. A price marked Conditional keeps its expression. Studio
shows and edits the base quantity only.

## Limits

- Socket arrays cannot grow, and vendor categories cannot be added.
- Copying or removing a sale is refused when the vendor holds sale data Studio does not decode.
- A sale has at most four prices.
- Studio does not compute final runtime stats, plug effects or animated icons.
- Items with objectives, and subclass trees, are not read. Those items say so under their name.
- The Sunrise server sells at static prices only.

## Related pages

- [Create items and vendors](/docs/sunrise-studio/create-items/) makes new items and vendors.
- [Investment editing internals](/docs/sunrise-studio/investment-internals/) explains how edits are
  written.
