---
title: "Collections, vendors and other catalogs"
date: 2026-10-15
description: "The investment catalogs beyond items: collectibles, objectives, records, progressions, vendors, plug sets, map nodes, strings and icons."
weight: 35
---
The investment root blob indexes more than items and activities. It also holds the catalogs behind
Collections, triumphs, vendors, perk rolls and the map screen. All of them are package data, and
most come as a gameplay half and a display half with the same rows in the same order.

Field and function names are descriptive, not Bungie's. Root offsets and the unlock flag system are
on [Items, characters and inventory](/docs/destiny-2/investment-data/).

## Collectibles

The collectible table has 5181 rows of 184 bytes, paired row for row with a display table. A row
carries five unlock expressions, at `+48`, `+64`, `+80`, `+96` and `+112`.

| row offset | what it is |
|---|---|
| `+24` | the collectible's parent nodes in the Collections tree, as `u16` node rows |
| `+40` | the collectible's hash |
| `+44` | `u16` item index; the collectible names its item, not the other way round |
| `+48` | `NOT(+112)` where both exist: "not acquired" |
| `+112` | the acquired state |
| `+0x9A` | `u16` material-requirement set: the cost of pulling the item; `0xFFFF` for none |

The flag names show that `+112` is the acquired state. Sweet Business reads flag 3538
`Sweet Business Acquired`, Sunshot 3552 and Graviton Lance 3556. 4854 of the 5170 acquired
expressions are a single flag, so setting that flag's byte to 2 marks the item acquired. No native
reader of `+112` is known.

Ornaments, shaders and mods are collectibles too. Every shader and ornament resolves its acquired
flag into the account object at `+29740`. 330 collectibles are mod items and 297 carry an acquired
flag. Whether a mod can be inserted is not a flag. Only 47 plug-pool tags carry any unlock
expression. Insertability is assumed to be inventory and socket data.

A material-requirement set row is 16 bytes: a hash, then a pointer to 12-byte requirements
`{u32 item index, u32 quantity, u8 delete, u8 omit}`. The Collections pull check reads `+0x9A` and
tests each requirement's item and quantity against the player.

The paired display row holds the collectible's icon row at `+4`. It matches the item's own icon in
every row checked.

### The Collections tree

The presentation node table holds 924 rows of 168 bytes. Its display table pairs row for row, with
the name at `+8`. A node's children are typed arrays:

| row offset | content |
|---|---|
| `+104` | child nodes: `u16` node row, then a `u16` sort value (10, 20, 30) |
| `+120` | collectibles: `u16` collectible row, then `0x7FFF` |
| `+136`, `+152` | not identified |

Node 0, hash `0xE1EA9713`, is the Collections root.
Austringer, item 8021, is collectible 4717 under Items, Weapons, Primary, Hand Cannons (node 660).

## Objectives, records and catalysts

The objective table has 8483 rows, paired with a display table. Row `+48` is the completion
threshold. Merciless's catalyst kill objective reads 500, Sweet Business 250, Sleeper 1000, 1000,
2000, 1 and 500. Of 993 objectives an account can set, 154 have a threshold above 127, up to
1,200,000.

The record table has 2242 rows. Catalysts are records, not collectibles: 47 records named
`*Catalyst*` hold their objective indices at `+48`. Completing a catalyst goes through those
objectives. Acquiring one does not: the `Insert the Catalyst` objective's value hash has no slot in
the value table.

## Progressions and seasons

The progression table has 88 rows in each half. The display row holds the name at `+4` and the
description at `+12`. 46 rows have a name.

| index | name |
|---:|---|
| 6 | `XP` |
| 7 | none; the character level |
| 8 | `Legend` |
| 9 | `Clan Level` |
| 65 | `Triumph Points` |
| 66 | `Nightfall Rank` |
| 77, 84 | `Glory Rank` |
| 78, 83 | `Valor Rank` |
| 86 | `Infamy Rank` |

Valor and Glory each have two rows with the same strings and different definition hashes. The UI
names rows 83, 84 and 86. Which pair the account object carries is unverified.

The season table has 12 rows, from Curse of Osiris to Arrivals, plus `SEASON OF [REDACTED]`. The
equipment-slot table has 19 rows, from Subclass to Seasonal Artifact.

## Vendors

Root offset 1864 is a 511-row index whose every target is a vendor definition, class `0x80807850`.
The display half sits in `investment_globals` at byte 1280. Vendors include Tess Everis, Eva
Levante, Banshee-44, Lord Shaxx, Commander Zavala, the Drifter and Spider.

| vendor blob offset | what it is |
|---|---|
| `+8` | the vendor's definition hash, equal to its index row hash |
| `+12` | a second key; differs from `+8` in 24 rows; meaning not known |
| `+20`, `+24` | reset interval and reset offset, in minutes |
| `+32` | categories, 24-byte rows |
| `+48` | sale items, 184-byte rows, item index at `+70` |
| `+80` | a set of 80-byte rows |

Each sale row has a display twin at the same index, 128 bytes, in the display half. Adding or
removing a sale changes both halves at the same index. A sale names its category at `+100`. The
display sale `+32` array holds one `u16` selector per cost. The failed-cost index reads it without a
bound. So cost edits must keep that array in the same order and count.

The vendor screen reads the definition and the display record only after both report loaded. Its
title is at display `+64`, subtitle at `+72` and icon index at `+88`. Tess Everis's 1044 sale items
resolve to real Eververse inventory.

The vendor definition table supplies screen data. It does not place a vendor in the world. An
interaction names the vendor it opens by hash. Changing that hash lets an existing interaction open
a new vendor, with no new character in the world.

## Plug sets

Plug sets are the random and reusable perk pools, 607 rows. An entry is 32 bytes:
`{u16 item index, u64 expression count, i64 expression offset, float weight}`. The client sums the
weights and draws without replacement with a linear congruential generator (`1664525`,
`1013904223`), one draw per expression result. Row 300 is Headseeker, Kill Clip, Rampage and
High-Impact Reserves.

## The map screen tables

The destination map node table has 953 rows, paired with display rows. Its strings are fast-travel
points ("Trostland", "Winding Cove"), NPC markers ("Devrim Kay / Dead Zone Scout"), public events
and activity markers ("Altars of Sorrow", "Contact").

Map node placements are 40-byte rows: `{u64 map node index, u64 expression count, i64 expression
offset, u32 node kind hash, u32 -1, u64 activity index}`. There are eight kind groups. Kind
`0xD07BB2D7`, 341 rows, is activity type 9 `Explore`.

Class `0x80807512`, 20 tags, holds the Director's destination pages. Member `+8` is `nodes`, and a
node's `+8` is `activities`. An `activities` entry is `{u32 node hash, u32 activity index, u64
expression count, i64 expression offset}`.

A 393-row table in `investment_globals` slot 5 maps a key hash to activities: missions, heroic
adventures and Nightmare Hunts. Its key appears in no other investment table. It is assumed to be a
rotation or availability selector the server addresses by hash.

## Unlock value counters

The unlock value counter table, 62 rows, holds derived values. For each row the client counts how
many of the row's expressions are true and sets the value slot to that count.

## Strings

### The language data

A string container has one language data record per language. English is language 0. The record
has five arrays:

| offset | member | content |
|---|---|---|
| `+8` | `0x706DBBDC` | parts, 32 bytes each |
| `+24` | `0xA5C94ADD` | rows that hold colour floats; meaning unverified |
| `+40` | `wide_chars` | 16-bit characters |
| `+56` | `utf8_chars` | UTF-8 bytes |
| `+72` | `strings` | one `{relative first part, u64 count}` per string hash |

A part's byte `+0x1B` bit `0x04` picks the source: set reads UTF-8, clear reads 16-bit characters.
The 16-bit value at part `+0x18` is added to every decoded character. Part `+0x14` is the length.

The install holds 4489 containers. The bank index names 3108 of them, so some text is unreachable
through any `{bank, hash}` pair. The containers hold 95,808 distinct string hashes, and the bank
route reaches 28,174.

### Item icons

An item's display record holds its icon index as a `u16` at `+128`, `0xFFFF` for none. The index
selects a row of an icon table directly. The row's `+16` is an icon container. The container's
`+20` is the primary bitmap, and a bitmap holds groups of frames, each frame a texture tag. Shared
icon rows need not match the item's hash.

The inventory thumbnail also reads a per-item art table with one row per item index. It indexes
those rows without a bound check, so a new item needs a new art row too.

### Sandbox perk names

The sandbox perk display table holds 2481 rows. Each points at one of 1532 display records, which
several perks share. A display record holds the name and description string pairs and a `u16` icon
index. 1500 perks have a name: 421 is Outlaw, 380 Headseeker, 1189 Trench Barrel and 159 Hydraulic
Boosters. A perk with a display name does not have to have a gameplay program.

## Lock and restriction messages

`investment_globals` slot 76 holds 52 message rows. Each row is a key and a list of sub-entries.
Each sub-entry is an expression and a message tag. A message record names a group, a container and
four strings: banner, title, body and an extra line.

Group `0x5D6AEAD4` holds 16 rows: eight activity kinds (story, strikes, social spaces, Crucible,
raids, patrols, Iron Banner, Trials of the Nine) times a permanent ban and a temporary restriction,
plus one matchmaking row. Row 45 is `Survival Suspension`, banner `Time-Out!`.

Nothing inside a row picks it. The lock-reason resolver walks the requirement groups an activity
names, finds the first expression that is false, and reads that element's message tag. So the
message names the first prerequisite the account fails. The table only supplies the words. It does
not block anything.

The text `release_prelaunch_summary` is a real string Bungie shipped as a placeholder in base
Destiny 2's release container. Seeing it means the lookup worked.

## Open questions

- The native reader of collectible `+112` and of the objective threshold field.
- Which Valor and Glory progression pair the account carries.
- What the 393-row activity availability index is keyed by.
- The reader of the lock-message table, and the meaning of presentation node arrays `+136` and
  `+152`.
- Whether sale row `+176` is a second item index.

## Related pages

- [Items, characters and inventory](/docs/destiny-2/investment-data/) -- the root blob, items and
  the unlock evaluator.
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/) -- the activity
  catalog and its gates.
