---
title: "Investment editing internals"
description: "How item and vendor edits are written, and what new items, vendors, perks and string banks add to the game data."
weight: 580
group: "How it works"
---
The **Investment** page shows the item or vendor opened from the asset browser. It reads the
installed definition and display indices. Names resolve through each record's own string bank.
[Investment data](/docs/destiny-2/investment-data/) describes the tables.
[Edit items and vendors](/docs/sunrise-studio/investment/) and
[Create items and vendors](/docs/sunrise-studio/create-items/) cover the steps.

## Editing records

| surface | read | edit |
|---|---|---|
| item | name, type, flavor, rarity, stack limit, bucket | rarity, stack limit, bucket |
| base stats | names, authored values, expression flags | add and remove rows, signed values |
| sockets | type, initial plug, embedded and shared plug pools | initial plug within its pool |
| sandbox perks | names, descriptions, icons, condition flags | add and remove rows, indices |
| vendors | sale items, categories, static cost quantities | sale item, category, cost rows; copy and remove sales |
| currencies | item definitions and cost references | stack limits and cost quantities |

To add or remove a stat or perk row, the writer appends a stats block and the changed array, then
repairs their relative pointers. Expression streams stay at their original addresses. A missing stats
block is created. Unrelated bytes stay unchanged.

A cost edit gives the sale its own cost array, so an array shared with another sale never changes. A
sale's display twin sits at the same index in the vendor's display record. A copy appends to both
arrays, and a removal shifts both. Nested data stays shared until one side is edited.

Stat displays apply the installed display curves to nonzero, unconditional values. Magazine stays a
base value, because its display needs item context. Reset fields keep their raw values, because their
time unit is not resolved.

## A new item

A new item of any category copies an installed item of the same category. The category comes from
the item's bucket, type line and blocks, as the asset browser sorts it.

- It gets two new records and two new index rows, appended to the installed item table `0x81327CCB`
  and display table `0x81613CF1`. That patches installed entries. Sunrise merges the rows that
  several mods add; see [Mods](/docs/sunrise/mods/#rows-added-by-several-mods).
- It gets its own icon row in `0x81A291C2`, keyed by its hash, pointing at the base or the chosen icon
  item's container. Some screens look icons up by item hash.
- If the base has a collectible, the copy can get its own on the chosen Collections page. The
  collectible copies the base item's row. The first new collectible moves the collectible rows to the
  end of their entry.
- It keeps the base item's art, gear entity, lore and every block Studio does not decode: the
  objectives at `+48`, the plug block at `+64` and the sack at `+88`. If the base record holds its own
  hash, the copy keeps the base hash there.

### Perk rows

The display block at display `+96` (class `0x80805D08`) holds 32-byte `0x80805D0A` rows at `+8`.
They pair by index with the definition's 24-byte sandbox perk rows. When the perk rows change, Studio
resets the display rows to empty rows of the new count. The item art row in `0x81A28B23` lists the
perks whose text and icons the UI loads. Studio sets it from the new perk rows, on a copy and on an
edit.

Every item art edit is written from the installed table. A pool that grew is copied once to the end
of the entry; the other pools stay in place. Setting the icon an item already has leaves the table
unchanged. Each new icon adds one handle and one copy of that item's field list.

A saved table can still hold old copies of pools it grew. Before **Build packages**, **Build and
install** and **Update running game**, Studio rebuilds three tables from the installed bytes when the
project edits them: item art, socket types `0x8131932F` and sandbox perk displays `0x81613D28`. The
rebuilt table is saved as the project's edit. It holds the same rows, so a second rebuild changes
nothing.

New item and vendor entries are in no dependency record. The client requests item, vendor and string
records by tag handle, so they do not need one. One case needs a manifest instead: a new item that
is a socket plug of an item whose bucket byte at `+184` is 2 or less. The Collections code reads plug definitions early, so the build adds such plugs and
their displays to the `investment_globals` manifest `0x81A2926F`. [How a build works](/docs/sunrise-studio/build-pipeline/#manifests) has the
rule.

## A new vendor

A new vendor is two new records and two paired index rows, which patch the installed index tables. It
gets a new identity hash, its own name and subtitle, and its own sale rows. Its icon can come from
another vendor. It keeps its base's categories, conditions and policies. The chosen interaction is
redirected to it.

## A new sandbox perk

A new perk joins both sandbox perk tables at the same index: the definition table `0x81319327` and
the display table `0x81613D28`.

| row | written |
|---|---|
| definition | the new hash, `0xFFFF` at `+4`, the active flag at `+6` |
| display | the new hash, the gameplay name hash, a pointer to a new text row |
| text | bank index, name hash, description hash, icon |
| runtime name | gameplay name hash -> the new behavior entry, in map `0x80EC3F60` |

The runtime name map stays sorted by name hash, because the game searches it by binary search. A
definition hash or name hash already in use is refused. Only the exotic weapon workflow adds perks.

## A new exotic weapon

**New** in the Weapons category builds every new item, behavior, model and table edit first, then applies
them as one project change. It needs an unused new package ID and an installed base weapon.

- Two exotic perks. Each is a new behavior graph compiled into a new behavior entry, with a new
  sandbox perk. Each perk plug copies a template plug from the base's socket, without its stats and
  perks, and carries the new perk.
- A catalyst. It copies a template plug from a third socket and carries one bonus perk and
  optional stats. The bonus is a new behavior graph or an installed perk.
- The weapon. It copies the base weapon and drops the base's own perks. Each new plug joins its
  socket's pool and becomes the initial plug. Optional stats replace the base values. The rarity
  field is set to 5. Name, flavor and type text are new.
- The art. Every art part of the base must use a newly imported Blender entity. The weapon gets new
  gear and art rows. Its firing components stay shared with the base.

The project also gets a `.creation.json` record of the weapon, its perks and its catalyst.
[Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/) has the steps.
[Edit perk behavior](/docs/sunrise-studio/perk-behavior/) covers the behavior graphs.

## String banks

A new name or description goes into one string bank per project package. The first new text in a
package creates the bank and appends its row to the installed bank index `0x81A27211`. A string's
hash is the FNV-1 hash of its UTF-8 text, so equal texts share one string. Two different texts with
the same hash are refused.

The game reads a bank's container without requesting it, so the container must load with
`investment_globals`. A build adds a new entry to every installed manifest that lists an edited entry
pointing at it, when that manifest already lists entries of the same class. For a bank container that
is the manifest `0x81A2926F`. Sunrise merges the manifest entries that several mods add.

The writer copies an installed bank and changes only what the reader decodes. It refuses a template
that breaks any rule below.

| part | written |
|---|---|
| hash array, text parts, text bytes, combinations | rebuilt |
| 13 language slots | all point at the new English data |
| undecoded part bytes | copied; the template's plain parts must agree on them |
| part flags and head | copied; plain parts must be UTF-8 with a zero head |
| character lengths | counted the way the template counts |
| data array `+24` | left empty |
| wide text array `+40` | one zero character |
| hash order and terminators | as the template has them |
| bank index name hash | FNV-1 of a chosen name |

## Limits

- An index table holds at most 32,768 reachable rows. The client sign-extends a 16-bit index.
- The vendor index holds at most 32,767 rows, so the last usable index is 32,766. The client scans it
  with a signed 16-bit cursor.
- All vendors together hold at most 16,384 sale rows and 4,096 category rows. A sale has at most
  4 cost rows.
- Removing or reordering sales is refused when the base has extra rule tables. It is also refused
  when a moved sale has a nonzero member at `+48`.
- An exotic weapon needs three separate sockets for its two perks and its catalyst. Each template
  plug must already be in its socket's pool. Names hold 1 to 200 characters without outer spaces.
  Descriptions hold at most 4000.
- An exotic perk must be a new behavior graph. An installed behavior program is refused.

## Open questions

- Whether the client accepts a row appended to an installed index table.
- Whether the game accepts the same English data in all 13 language slots of a bank.
- Which reader uses a bank index row's name hash.
- New string banks have not run in game.
- Clones of items other than the exotic weapon flow have not run in game.
