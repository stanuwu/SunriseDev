---
title: "Items, characters and inventory"
date: 2026-10-15
description: "The account, character and item objects the client holds, and the package tables they point into."
weight: 30
---
Investment is the game's name for everything a player owns: characters, items, currencies,
progressions and unlock flags. The client holds this state as a few large objects that the server
pushes. Those objects carry small numbers. The numbers index tables in the game packages, and the
tables say what the numbers mean.

Field and function names are descriptive, not Bungie's, unless a section says a name was shipped.

- How the objects reach the client, and how Sunrise stores them:
  [Accounts, characters and saves](/docs/sunrise/save-data/).
- How a bit-packed body is encoded: [Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/).
- How packages and named tags are stored: [Packages](/docs/destiny-2/packages/).

## The objects the client holds

The server pushes seven objects to describe one player. Each one is a raw byte image of a fixed
struct. The schema hash names the struct.

| object | schema | size | what it is |
|---|---|---:|---|
| account (object A) | `0x80807807` | 96280 | roster, profile inventory, unlock flags, settings |
| character (object B) | `0x80807991` | 46928 | one character's inventory and equipment |
| item instance record | `0x80807791` | 416 | one item: identity, roll and socket state |
| roster list | `0x80807808` | 1768 | the account's character list |
| character record | `0x80807992` | 3904 | one character's identity and appearance |
| banner anchor | -- | 96 | which character the banner shows |
| banner record | `0x80807997` | 3856 | one character again, read only by the banner |

Every object is keyed by a 64-bit id in its first 8 bytes. The account object uses the account id.
A character object uses the character id. An item record uses the item instance id.

The account object, the character object and the item instance record are also the bodies of web
service responses 201, 202 and 203.

### Empty is a property of the type

A zero is not an empty field. It asserts the type's zero, and zero is often a real row. Each field
type has its own empty value:

| field type | what it holds | empty value |
|---|---|---|
| signed 8-bit key | a small index, such as a stat key | `0xFF` |
| biased 16-bit | usually a definition index | `0xFFFF` |
| unsigned 32-bit hash | a definition hash | `0x811C9DC5` |
| plain signed 32-bit | a count or value | none; 0 is a real value |

`0x811C9DC5` is the client's "unset hash" value. It equals the FNV-1 offset basis, but nothing
hashes anything on that path.

Two limits apply:

- The empty value is only safe where the reader tests for it. Some readers resolve an index without
  a test. At those sites `0xFFFF` becomes a null pointer instead of an empty slot.
- The type is a hint, not a meaning. A few 16-bit fields hold stat values or UTF-16 text, not
  indices.

## The account object

The account object holds everything shared by all characters. Its main ranges:

| range | what it is |
|---|---|
| `+0` | the account id |
| `+136` | the character roster: a count, then 10 rows of `{character id, 20 equipment refs}` |
| `+1832` | the selected character's id |
| `+2944` | the profile bank: settings, key binds, the new-item bitmap |
| `+4360` | the profile inventory: a count, then 701 item entries of 32 bytes |
| `+27708` | account progressions, 127 rows of 16 bytes |
| `+29740` | account unlock flags, one byte per flag |
| `+42040` | account objective values, one i32 per objective |
| `+66840` | four per-character unlock blocks of 256 flags and 256 values |
| `+74384` | profile unlock flags, including entitlements |

The character select screen counts characters from the roster at `+136`. A separate roster list
object carries the same layout, but the select screen does not read it.

## The character object

The character object holds one character's inventory and equipment.

| range | what it is |
|---|---|
| `+0` | the character id |
| `+8`, `+9`, `+10` | race, gender, class |
| `+12` | the 36-byte customization header |
| `+48` | the inventory row count |
| `+56` | the character inventory, 350 item entries of 32 bytes |
| `+11456` | the equipped item instance ids, 20 u64, one per equipment slot |
| `+11616` | the equipment and light summary |
| `+12032` | the part the client writes back to the server (5360 bytes) |
| `+17392` | character progressions, 127 rows of 16 bytes |
| `+19424` | the periodic-reset struct |
| `+37704` | character unlock flags |
| `+41800` | character objective values |

The inventory row count at `+48` is the highest used row plus one. It is not the item count. Items
are placed per bucket, so rows can have gaps.

The range at `+12032` is the only range the client sends back. The client compares it with its own
copy and resends until they match. Every other range is server state.

### An inventory entry

Both inventories use the same 32-byte entry.

```c
struct InventoryEntry {          /* 32 bytes */
    uint16_t definitionIndex;    /* +0x00  item row; 0xFFFF means the entry is free */
    uint8_t  pad0[6];            /* +0x02 */
    uint64_t instanceId;         /* +0x08  item record key; 0 when not instanced */
    int32_t  quantity;           /* +0x10  stack size; must be 1 or more */
    int32_t  serial;             /* +0x14  rising mutation serial; orders the grid */
    uint32_t stateBits;          /* +0x18  accumulated item state bits */
    uint8_t  pad1[4];            /* +0x1C */
};
```

Three rules come from the readers:

- A quantity of 0 is a zero stack, not an empty entry. Use 1 or more.
- A non-zero instance id is a promise. The equip summary dereferences the matching item record with
  no null check. An entry with an instance id and no record crashes the client.
- Keep a quantity at or below the item's own max stack (definition `+180`). The client does not
  clamp it. An over-cap stack reads as "bucket full".

A character inventory entry also needs two companion values before it draws. One is its bit in a
new-item bitmap at character `+15148`. The other is a per-slot i32 at `+15192 + 4 * slot`. The
client compares that i32 with the item record's progress value at `+184`, so it is a watermark, not
a flag. The need for both is seen in game; no traced reader explains it.

### Equipment references and the light summary

The roster rows use a smaller equipment reference:

```c
struct EquipmentRef {            /* 8 bytes */
    uint16_t definitionIndex;    /* +0x00  0xFFFF when the slot is empty */
    uint16_t pad;                /* +0x02 */
    int32_t  occupied;           /* +0x04  1 when the slot holds an item */
};
```

The light summary at character `+11616` holds two arrays of 20 `{u16 definition, u16 pad, i32 score}`
entries. Profile slots come first, then character slots. Then come the aggregates: the number of
slots that count, the summed score, and the average as an integer and as a float.

Sunrise computes the same average in
`src/state/equipment/light/calculation/equipment_light_calculation.cpp`. It sums every slot, counts
the slots with a positive score, and divides:

```c
/* From evaluate(): a character with nothing powered has no average. */
candidate.divisor = divisor_for(aggregate);
candidate.total   = (int32_t)wideTotal;
candidate.average = candidate.divisor == 0 ? 0 : candidate.total / candidate.divisor;
```

### Periodic resets

A 56-byte struct holds the last daily and weekly reset times, in unix seconds. The character object
carries it at `+19424`, and the character record carries a copy at `+48`.

- When a daily reset is due, the client clears each progression's daily counter and each item's
  daily counter.
- A weekly reset does the same for the weekly counters.
- A reset time of 0 is not neutral. The resets fire on the first update after sign-in.

## The character record

The character record describes a character's identity and appearance. The select screen and the
world use it to build the model. Most of it is one 3752-byte appearance block.

```c
struct CharacterRecord {                /* 3904 bytes, schema 0x80807992 */
    uint64_t characterId;               /* +0x000  the key */
    int8_t   race;                      /* +0x008  0 Human, 1 Awoken, 2 Exo */
    int8_t   gender;                    /* +0x009  0 Male, 1 Female */
    int8_t   classType;                 /* +0x00A  0 Titan, 1 Hunter, 2 Warlock */
    uint8_t  pad0;                      /* +0x00B */
    uint8_t  customization[36];         /* +0x00C  face and body option rows */
    uint8_t  resetTimes[56];            /* +0x030  periodic-reset struct */
    /* The appearance block starts here and runs to +0xF10. */
    int32_t  level;                     /* +0x068 */
    float    levelProgress;             /* +0x06C  level with its fraction */
    float    power;                     /* +0x070  the light on cards, banner and inventory */
    float    bannerPower;               /* +0x074  read only by the banner component; write both */
    struct {
        int8_t   kind;                  /*         0xFF when empty */
        uint8_t  pad[3];
        uint32_t hashes[16];            /*         0x811C9DC5 when empty */
    } abilityBuckets[12];               /* +0x078  68 bytes each */
    uint32_t overflowHashes[32];        /* +0x3A8 */
    uint8_t  renderArray[20][72];       /* +0x428  one entry per equipment slot */
    uint8_t  registryRows[8][16];       /* +0x9C8  {i8 index, u64}; 0xFF index is empty */
    uint16_t characterPerks[48];        /* +0xA48  sandbox-perk rows; 0xFFFF empty */
    uint16_t weaponPerks[3][16];        /* +0xAA8  one list per weapon */
    struct { int8_t key; uint8_t pad[3]; int32_t value; }
             stats[4][32];              /* +0xB08  character stats, then three weapons */
    int32_t  unknown3848;               /* +0xF08  no reader found */
    uint8_t  pad1[4];                   /* +0xF0C */
    uint8_t  block3856[32];             /* +0xF10  floats, indices and a hash */
    uint64_t cardValue;                 /* +0xF30  copied to the card; no reader found */
    uint8_t  cardFlag;                  /* +0xF38 */
    uint8_t  cardDisable;               /* +0xF39  0 enables */
    uint8_t  pad2[6];                   /* +0xF3A */
};
```

Notes on the fields:

- The client copies all 3752 bytes of the appearance block over a package default. Nothing
  recomputes them. So every zero the server sends replaces a default the client had loaded.
- The customization header is the same 36-byte struct as character object `+12`. Its first `i16`
  is a face preset row; if that row does not resolve, no customization is built at all. The next
  three bytes pick option variants. The `i16` fields after them are dye indices, `-1` for empty.
  Its last byte, record `+44`, must be 1.
- The face preset must come from the character's own race and gender row. A preset from another
  race gives the model the wrong head. The client does not check the dyes against the row. Which
  option group is face, hair or markings is unverified.
- The 12 ability buckets have fixed meanings. Bucket 0 is the grenade, 1 the super, 2 the melee,
  3 the jump, 4 sprint and movement, 5 the dive. Buckets 6, 9 and 11 are the class ability, and the
  last non-empty one wins. Buckets 7, 8 and 10 are not read.
- The first stat table feeds gameplay, not only the UI. Mobility is stat row 3, and writing it
  changes movement speed.
- The class and race enum orders match Bungie's public ones.

### The render array

Each of the 20 render entries describes one equipped item for the model builder.

```c
struct RenderEntry {                    /* 72 bytes */
    uint64_t instanceId;                /* +0x00 */
    uint16_t definitionIndex;           /* +0x08  the gear builder never reads it */
    uint16_t socketTypeMarker;          /* +0x0A  used for the emblem lookup */
    uint16_t gearArtIndex;              /* +0x0C  decides whether the slot draws */
    uint16_t classArtVariant;           /* +0x0E */
    uint16_t overlays[8];               /* +0x10  ornament and plug art */
    struct { uint32_t hash; int32_t value; } unlockPairs[2];   /* +0x20 */
    struct { int8_t key; uint8_t pad; uint16_t value; }
             materials[6];              /* +0x30  render-material pairs; 0xFF key is empty */
};
```

The gear-art index at `+0x0C` is the only field the art resolver reads. If it does not resolve, the
slot draws nothing.

The six material pairs are built from the base item and its equipped plugs, in a fixed order. Later
rows replace earlier rows with the same key. An equipped shader supplies its pairs this way.

## The item instance record

One item instance record exists for every instanced item. It holds the item's identity, its random
roll and its socket state.

```c
struct ItemInstanceRecord {             /* 416 bytes, schema 0x80807791 */
    uint64_t instanceId;                /* +0x000  the key */
    uint8_t  unmapped[8];               /* +0x008  meaning unknown */
    uint16_t definitionIndex;           /* +0x010  row in the item table */
    uint8_t  pad0[2];                   /* +0x012 */
    struct {
        uint16_t plugIndex;             /*         item row of the plug; 0xFFFF empty */
        uint8_t  rest[10];
    } sockets[12];                      /* +0x014  12 bytes each */
    uint32_t plugPassMask;              /* +0x0A4  rebuilt by the client */
    uint32_t declaredEnableMask;        /* +0x0A8  rebuilt by the client */
    uint32_t plugClearMask;             /* +0x0AC  rebuilt by the client */
    uint32_t declaredClearMask;         /* +0x0B0  rebuilt by the client */
    uint32_t gateMask;                  /* +0x0B4  ANDed into +0x0A4; send 0xFFFFFFFF */
    struct {                            /* +0x0B8  100-byte socket and roll block */
        int32_t  progress;              /* +0x00 */
        int32_t  dailyCounter;          /* +0x04  cleared by a daily reset */
        int32_t  weeklyCounter;         /* +0x08  cleared by a weekly reset */
        uint16_t progressionIndex;      /* +0x0C  0xFFFF when none */
        uint8_t  pad[2];
        int8_t   selection[12][3];      /* +0x10  {entry, group, element}; 0xFF empty */
        uint16_t socketEntryList;       /* +0x34  row in the socket entry list table */
        uint8_t  rollOrdinals[8];       /* +0x36  the retained random roll */
        uint8_t  unknown62;             /* +0x3E  no reader found */
        uint8_t  plugState[36];         /* +0x3F  0 absent, 16 present, 18 active */
        uint8_t  unknown99;             /* +0x63  no reader found */
    } roll;
    uint8_t  creationRequest[96];       /* +0x11C  used by 14 special items only */
    uint16_t presentationIndex;         /* +0x17C  0xFFFF skips the branch */
    uint8_t  pad1[2];                   /* +0x17E */
    int32_t  valueBank[8];              /* +0x180  looked up by selector, not by index */
};
```

### Sockets and perks

A socket's plug index is an ordinary item definition index. There is no separate plug table.

- The client always walks all 12 sockets. There is no socket count.
- `0xFFFF` is the only empty marker. A 0 names item row 0, a real item.
- The perk list in the item panel comes from these 12 instance sockets. The item definition also
  declares a socket block, but its gate does not pass, so it adds nothing to the panel.

The client rebuilds the four masks at `+0x0A4` to `+0x0B0` from the sockets and the item definition.
It reads the gate mask at `+0x0B4` once:

```c
rec->plugPassMask &= rec->gateMask;
```

A rebuild of the gate mask runs only on the roll and plug-insert paths. On a plain sign-in the gate
mask is exactly what the server sent. So send `0xFFFFFFFF`. A 0 blanks every item's perks.

The eight roll ordinals at `+0x0EE` are the item's random roll. The client picks one byte and reduces
it by the number of candidates. So regenerating these bytes changes the roll.

Fill every socket lane the item holds. A lane at `0xFFFF` is a socket with no plug. It does not fall
back to the plug the item definition declares.

Some perks come in two variants that must not both be published. For example, Worldline Zero's
completed catalyst replaces the normal Tesseract perk with a faster variant (perk 745 instead of
744). The two run the same effect with a different delay. The item definitions select one by an
enable expression on a value slot. Publishing both perk indices runs the effect twice.

### The subclass tree

A subclass has no separate replicated tree. The tree hangs off the equipped subclass item's own
instance record. Two fields carry it:

| field | what it decides |
|---|---|
| `roll.socketEntryList` (`+0x0EC`) | the row of the socket entry list table, so the subclass tree |
| `roll.plugState` (`+0x0F7`) | one byte per socket entry: 0 absent, 16 present, 18 active |

The socket entry list table has 14 rows. Row 0 and row 13 are empty lists. Nine rows hold the
24-entry subclass trees, three per class. Three rows hold a 4-entry list that nothing points at.

The entry index has a fixed meaning across all nine subclasses:

| entry | socket |
|---|---|
| 0 | base melee target; never drawn; differs by guardian class, not by subclass |
| 1 | base sprint selector; never drawn |
| 19 | shared marker; never drawn |
| 2, 3 | class ability |
| 4 to 6 | movement |
| 7 to 9 | grenade |
| 10 | super |
| 11, 15, 21 | the melee of tree 1, 2 and 3 |
| 20 | the tree-3 super, which replaces entry 10 |
| others | tree perks |

Each entry names one plug pool, and each pool holds exactly one plug in this build. The state byte
only says whether the socket is absent, present or active. It cannot name a plug. Entries 0, 1, 19
and the super at 10 carry no plug source at all.

The selected movement ability is a different entry per class:

| class | subclasses | entry | ability |
|---|---|---:|---|
| Hunter | all three | 6 | Triple Jump |
| Titan | all three | 5 | Strafe Lift |
| Warlock | Stormcaller, Dawnblade | 5 | Burst Glide |
| Warlock | Voidwalker | 6 | Burst Glide |

The Warlock rows are confirmed in game. The Hunter and Titan rows follow from the same table and are
assumed.

The instance record's progression index at `roll +0x0C` must be `0xFFFF` on a subclass. A 0 there
names progression row 0. With `0xFFFF` the sockets draw, and none of them shows as selected.

A subclass names its three Forsaken trees as objective indices, at item definition member `+48`.
For example, Gunslinger (item 1189) names objectives 1361 Knife Trick, 1362 Playing with Fire and
1363 The Burning Edge.

Ability names are not items. They come from a display table where the string hash is the socket and
the string bank is the subclass.

Rules for `socketEntryList`:

- Eight client readers use it. Five test for `0xFFFF`. Three do not, and one of those crashes when
  the inventory opens.
- So no constant is safe. Write the row the item definition names: 0 for ordinary items, 1 to 11
  for the nine subclasses.
- The client's own writer emits only 0 and 16 into the state bytes. The value 18 is written when a
  player picks a plug.

The item names its row at definition member `+128`. That member heads an 8-byte block whose first
u16 is the row. Across all 15424 items, nine carry a non-zero row, and those nine are the
subclasses. This mapping comes from the data. No client reader of member `+128` is known, so it is
unverified in code.

## The package tables

All the tables below are package data. None is in the executable.

### The root blob

The tables hang off one package named tag, `investment_globals`, tag `0x81A2926E`. A package
named-tag table names it. Which lookup the client resolves the name through is unverified; see
[Name hashes](/docs/destiny-2/tags-and-definitions/#name-hashes).

- `investment_globals` holds 81 children. Child 0 is the investment root blob.
- The root blob (1912 bytes) holds 119 table slots.
- The two blobs use different strides. In `investment_globals` the tag handle for slot `n` is at
  `16 + 16n`. In the root blob it is at `8 + 16n`.

The client reads the root blob through a registry object. Each table has a getter in the registry's
virtual table. Callers use the getter, not the offset.

| root offset | table | rows |
|---:|---|---:|
| 40 | start-destination table | 8 |
| 72 | activity definitions | 1170 |
| 88 | activity types | 54 |
| 184 | investment constants | -- |
| 280 | inventory buckets | 49 |
| 312 | collectibles | 5181 |
| 408 | destinations | 48 |
| 456 | map node placements | 927 |
| 472 | destination map nodes | 953 |
| 504 | places | 27 |
| 536 | equipment slots | 19 |
| 776 | item definitions | 15424 |
| 824 | plug sets | 607 |
| 840 | item lore | 1425 |
| 936 | objectives | 8483 |
| 984 | requirement lists | -- |
| 1016 | presentation nodes (the Collections tree) | 924 |
| 1096 | progressions | 88 |
| 1160 | records | 2242 |
| 1416 | vendor sale items (assumed) | 979 |
| 1432 | seasons | 12 |
| 1512 | socket types | -- |
| 1528 | stats | 61 |
| 1560 | socket entry lists | 14 |
| 1704 | sandbox perk gameplay index | -- |
| 1752 | shared expression pool | 6541 |
| 1784 to 1832 | unlock flag and value maps | -- |
| 1848 | unlock value counters | 62 |
| 1864 | vendor definitions | 511 |

Most catalogs come in pairs. The root blob holds the half the game logic reads. A child of
`investment_globals` holds the half with the display strings. Both halves have the same rows in the
same order, so one row index works in either.

What the collectible, objective, record, vendor and other catalogs hold is on
[Collections, vendors and other catalogs](/docs/destiny-2/content-catalogs/).

### How investment content loads

The tables and the string containers load with `investment_globals`, through its manifest. Item
definitions, vendor records and string language data load only when the UI asks for their handles.
No package dependency record lists any of them. A string container is read in place and never
requested, so a container loads only if a manifest lists it.

### Reading a table

There are three row shapes. The stride belongs to the table.

- **Index rows, 24 bytes.** `{u32 definition hash @+0; 12 zero bytes; u32 tag handle @+16}`. The row
  points at a separate record. The item table uses this form.
- **Index rows, 16 bytes.** `{u32 definition hash; u32 pad; i64 relative offset}`. The record is at
  `row + 8 + offset`. The activity table uses this form.
- **Inline rows.** Rows sit in the blob at a fixed stride. Destinations, activity types and places
  use this form.

An array header is the same everywhere. For a header at blob offset `p`, the count is the u64 at `p`
and the data starts at `p + 8 + *(int64_t *)(p + 8) + 16`.

### Resolving an item hash to its definition

The objects carry a definition index, not a hash. A published item hash is found by its row.

```c
/* Item table: root offset 776, 15424 rows of 24 bytes. */
typedef struct {
    uint32_t definitionHash;     /* +0x00 */
    uint8_t  zero[12];           /* +0x04 */
    uint32_t tagHandle;          /* +0x10  the item's definition record */
    uint8_t  pad[4];             /* +0x14 */
} ItemIndexRow;

const ItemDefinition *item_by_index(const Registry *reg, uint16_t index)
{
    const uint8_t *table = registry_table(reg, 776);        /* registry getter */
    int64_t i = (int16_t)index;                             /* 0xFFFF becomes -1 */
    if (i < 0 || i >= table_count(table))
        return NULL;                                        /* callers may not test this */
    const ItemIndexRow *row = table_row(table, i, 24);
    return tag_resolve(row->tagHandle);
}

int item_index_from_hash(const Registry *reg, uint32_t hash)
{
    const uint8_t *table = registry_table(reg, 776);
    for (int64_t i = 0; i < table_count(table); i++)
        if (table_row(table, i, 24)->definitionHash == hash)
            return (int)i;
    return -1;                                              /* a later-season hash */
}

/* A member block is a self-relative offset stored in the record. */
const void *item_block(const ItemDefinition *def, uint32_t member)
{
    int64_t rel = *(const int64_t *)((const uint8_t *)def + member);
    return rel ? (const uint8_t *)def + member + rel : NULL;
}
```

The bounds check sign-extends the index from 16 bits. That is why `0xFFFF` resolves to NULL.

The hash-to-index loop maps a published hash to its row. The client's own hash lookup is not known.
Published item hashes from Season of Arrivals or earlier resolve against this build. A
miss usually means a later reissue of the item. For example, Austringer `2429822977` is item 8021,
Trust `4077196130` is item 6062 and Worldline Zero `1864563948` is item 4718.

A second table, parallel to this one, has the same 15424 hashes in the same order. Its rows point at
the per-item string record instead of the gameplay record.

### The item definition

The definition record lists its object members with names. The names are FNV-1 hashes of lowercase
strings. The strings below match those hashes, so these member names are Bungie's.

| offset | member | offset | member |
|---:|---|---:|---|
| 8 | `action_item_block` | 104 | `sockets_item_block` |
| 16 | `equipping_item_block` | 112 | `stats_item_block` |
| 24 | `finisher_item_block` | 120 | `summary_item_block` |
| 32 | `gearset_item_block` | 128 | `talent_grid_item_block` |
| 40 | `lore_item_block` | 136 | `translation_item_block` |
| 48 | `objective_item_block` | 144 | `unlock_item_block` |
| 56 | `metric_item_block` | 152 | `value_item_block` |
| 64 | `plug_item_block` | 176 | `inventory_item_block` |
| 72 | `quality_item_block` | 224 | `traits` |
| 80 | `record_item_block` | | |
| 88 | `sack_item_block` | | |
| 96 | `set_item_block` | | |

Plain scalars are not in that list. Two matter:

| offset | type | what it is |
|---:|---|---|
| 180 | i32 | max stack size |
| 184 | u8 | inventory bucket id |

Notes:

- `sockets_item_block` is 0 on all nine subclasses. Their sockets come from the socket entry list
  table instead.
- `translation_item_block` is the art block: gear art, geometry and dyes. It is 0 when the item has
  no art.
- Member `+128` is read here as the socket entry list row. Its shipped name says talent grid. Which
  reading is right is unverified.
- `plug_item_block` leads to a record whose class marker `0x808077E3` usually sits at `+388`, with
  the plug category hash 4 bytes after it. An optional record ahead of it can shift it, so find the
  marker rather than assume the offset. A socket accepts a plug when its whitelist lists that
  category.
- `lore_item_block` points at a 4-byte block: a `u16` lore row, then zero. `0xFFFF` means no lore.
  1323 items have lore, sharing 689 rows.
- An item instance carries no stat override. Item stats are content.

### Item stats and sandbox perks

`stats_item_block` points at a 32-byte block with two arrays:

| array | row size | fields |
|---|---:|---|
| investment stats, at `+0` | 40 | `u8` stat row at `+0`, `i32` value at `+4`, value expression at `+8`, activation expression at `+24` |
| sandbox perks, at `+16` | 24 | `u16` perk index at `+0`, activation expression at `+8` |

The client evaluates each stat row's activation and value expressions and sums rows of the same
stat. A positive computed value replaces the stored one. These are base inputs, not the numbers the
UI shows.

The sandbox-perk rows feed the character record's perk lists: the base item's perks first, then
each equipped plug's.

The number Inspect shows comes from a display curve. The item's display record selects a stat group,
and each stat in the group has a list of `{i32 input, i32 output}` points. The client clamps to the
end points, interpolates in single precision and rounds to the nearest integer, ties to even. A stat
with no row in the group shows its raw value. For example, Forward Path's raw rate of fire 80 shows
as 600.

Perk names and icons come from a separate display table; see
[Sandbox perk names](/docs/destiny-2/content-catalogs/#sandbox-perk-names).

### Render art

The art block names the gear-art index and an arrangement index for the render array. The art is
class-specific: the same armor set uses different art rows on a Hunter, a Titan and a Warlock. The
client takes the first art row whose class byte is `-1` or equals the character's class (0 Titan,
1 Hunter, 2 Warlock).

### Item lore and socket types

The lore row index selects the same row in two tables. The display table row holds a title, a
subtitle, a body and a `u16` icon. The gameplay table row holds only the lore hash. No reader uses
the hash. A new lore row goes at the same index in both tables.

A socket's type number selects the same row in two tables in the same way. The gameplay row holds
the insertion rules:

| gameplay row | meaning |
|---|---|
| `+8` | insertion rule: 1 refuses insertion, 2 refuses when the socket is empty |
| `+16` | insertion unlock expression; false refuses |
| `+39` | plug bucket, or `0xFF` |
| `+40` | plug whitelist, 8-byte rows led by a plug category hash |

Exotic weapons have their own socket types. Tommy's Matchbook uses type 728 for its ornament and 725
for its catalyst.

### Buckets and equipment slots

Two different tables are involved.

The **inventory bucket table** has 49 buckets. A bucket names one inventory array and a slot range
inside it. An item only shows in the range its bucket owns.

| array | where | slots |
|---:|---|---:|
| 0 | the character inventory | 350 |
| 1 | the profile inventory | 701 |
| 2 | a small 6-slot array | 6 |

So the bucket decides whether an item is per character or account-wide. Currencies sit in array 1,
so they are account-wide.

The **bucket definition table** has 34 rows. Its field `+64` gives a dense index over the equippable
buckets. It reads as the equipment slot:

| slot | bucket | name | slot | bucket | name |
|---:|---:|---|---:|---:|---|
| 0 | 16 | Subclass | 10 | 10 | Ships |
| 1 | 3 | Helmet | 11 | 9 | Vehicle |
| 2 | 4 | Gauntlets | 12 | 8 | Ghost |
| 3 | -- | Auras | 16, 19 | -- | no bucket |
| 4 | 5 | Chest Armor | 13 | 27 | Emblems |
| 5 | 6 | Leg Armor | 14 | 41 | Emotes |
| 6 | 7 | Class Armor | 15 | 17 | Clan Banners |
| 7 | 0 | Kinetic | 17 | 47 | Finishers |
| 8 | 1 | Energy | 18 | 49 | Seasonal Artifact |
| 9 | 2 | Power | | | |

This table matches the order in the data. No client code that turns a bucket into a slot is known,
so the link is unverified.

### Constants

The investment constants blob holds small game-wide numbers. The getter returns the blob base plus 8.

| offset | value | what it is |
|---:|---:|---|
| 592 | 0 | the stat row that holds light |
| 593 to 595, 622 to 624 | 4, 3, 5, 7, 6, 8 | the six character stat rows the sheet shows |
| 600 to 619 | -- | the weapon stat rows, one byte each; below |
| 646, 648 | 14, 1 | the two progressions the banner's XP fields show |
| 650 | 7 | the character-level progression |
| 664 | 50 | the level cap |

The weapon stat bytes name rows of the stats table. `0xFF` is empty.

| offset | row | stat | offset | row | stat |
|---:|---:|---|---:|---:|---|
| 600 | 14 | Rounds Per Minute | 610 | 27 | Reload Speed |
| 601 | 24 | Magazine | 611 | 18 | Charge Time |
| 603 | 32 | Zoom | 612 | 15 | Impact |
| 604 | 17 | Accuracy | 614 | 25 | Inventory Size, the reserves stat |
| 605 | 22 | Stability | 615 to 617 | 26 | Handling |
| 607 | 20 | Velocity | 618 | 30 | Aim Assistance |
| 608 | 16 | Range | 619 | 31 | Recoil Direction |
| 609 | 21 | Blast Radius | | | |

The stat names are assumed. They rest on these bytes forming one coherent weapon-stat list.

A sword has no reserve stat. No sword declares Inventory Size, and a sword's whole supply is its
magazine. The supply is a float with its own setter, which clamps to the sword's maximum. Ordinary
weapons store magazine and reserves as encoded integers, and those setters do not clamp.

### Names come from string banks

No item name is in the executable. Names are in localized string banks in the packages.

- Every string reference is a pair `{u32 bank index, u32 string hash}`.
- The bank index resolves through a bank table in `investment_globals` to a string container, then
  to per-language data.
- A string hash is unique only inside its bank. Resolving a hash without its bank gives the wrong
  text.
- The hash is FNV-1.

13884 of the 15424 items have a name. Lore, collectibles, stats, destinations, classes and activity
modes are named through the same chain. The language data layout is on
[Collections, vendors and other catalogs](/docs/destiny-2/content-catalogs/#strings), and so is how
an item picks its [icon](/docs/destiny-2/content-catalogs/#item-icons).

## Unlock flags and the evaluator

Much of what the client shows is gated by unlock expressions over flags and values.

### Flags and values

A flag is a slot in an evaluated-state buffer, not an object byte. The client scatters the object
bytes into that buffer through mapping tables. A map row is `{u32 unlock hash, i16 slot, u16 zero}`,
and the object array index is the row number.

| map | rows | object region |
|---|---:|---|
| flags 0 | 11923 | account `+29740` |
| flags 1 | 320 | account `+74384` |
| flags 2 | 3195 | character `+37704` |
| flags 3 | 47 | a context object |
| flags 4 | 211 | account per-character blocks |
| values 0 | 5867 | account `+42040` |
| values 1 | 538 | character `+41800` |
| values 2 | 64 | a context object |
| values 3 | 33 | account per-character blocks |

The flag space has 21613 slots and the value space 13231.

- A flag reads true when its buffer byte equals 2.
- 15696 flag slots have a backing byte in an object. The rest have none.
- 197 slots with no byte are computed from the player's items.
- The other no-byte slots read false, unless an override list writes them.

A second route exists. One more pushed object, family 5, carries two override lists of
`{slot, value}` pairs, 100 rows each. The client copies them into the buffer after every mapping table, with no bounds or
kind check. So an override can set a slot that has no backing byte, and can clear most others. A
flag set by progression cannot be cleared this way: progression writes a lower-priority buffer that
a 0 falls through to. The slot is a signed 16-bit raw offset, so a bad slot writes out of bounds.
Keep flag slots in 0 to 23499 and value slots in 0 to 15499.

Entering an activity also writes flags. The activity record carries a write list, and every value in
it is 2. Across all 1170 activities that is 5892 writes to 389 slots, and only 2 of those slots are
settable from any object the server sends. The destination row and the matching bubble carry write
lists of the same form.

Only 108 flags have a display name in the unlock definition table. The rest are identified by what
their expressions gate. About a quarter of the flag slots, 5197, have a backing byte that no
expression reads.

Expressions are not the only readers. Some content records carry a plain `u16` unlock slot field,
`0xFFFF` for none, and code tests it directly:

| table | field | slots |
|---|---|---:|
| records | `+100`, completion | 2222 |
| progression steps | step `+36` | 760 |
| activity definitions | `+216` | 208 |
| achievements | `+4` | 122 |
| requirement lists | row `+0` | 239 |
| records | `+98`, category gate | 64 |

Every season-pass and rank-step flag is read only this way. No call to the client's flag readers
passes a constant slot. Every reader takes the slot from a record or an argument. An inline test
with no call was not searched for.

The 3828 stored flags with no reader do not form one subsystem. They split into 915 runs spread
across the slot space. The server writes them. The client mirrors most of them and never reads
them.

### Entitlement flags

Ownership is unlock flags in the account object at `+74384`. Fourteen flag slots resolve their
unlock hash directly as a string in bank 16. Eight of those are the platform set:

| slot | index | text |
|---:|---:|---|
| 577 | 3 | Next-Gen Platform |
| 581 | 5 | a different platform |
| 583 | 7 | a different platform |
| 584 | 8 | Stadia |
| 585 | 9 | Steam |
| 586 | 10 | Online Enabled Account |
| 587 | 11 | Full Purchase |
| 588 | 12 | User-Generated Content is Blocked |

Slots 584, 585 and 587 have no expression reader. "Full Purchase" gates nothing. The store's
full-game gate is slot 302, index 1: 1062 expressions read it.

The full-version and expansion flags are named by the unlock definition table:

| slot | index | name |
|---:|---:|---|
| 2260, 2261 | 132, 133 | `Requires Full Version of Destiny 2` |
| 3837 | 169 | `Requires Destiny 2: Curse of Osiris` |
| 4723 | 170 | `Requires Destiny 2: Warmind` |
| 6038 | 173 | `Requires Destiny 2: Forsaken` |
| 9395 | 238 | none; gates Shadowkeep content (assumed) |

A blanket fill of the account's entitlement bank is wrong. It claims every platform at once and sets
index 12, which is a restriction, not an entitlement.

### Value slots need a descriptor

A value slot is read through a descriptor table of 13,231 eight-byte rows: a name hash, a kind
byte, a flags byte and a `u16` backing index. A second array holds the slot indices sorted by name
hash, for lookup by name. The integer reader accepts value indices below 15500, then computes a row
address without a bound. The 2269 buffer positions after the installed rows have no descriptor.
Adding a value means appending a descriptor and keeping the sorted index.

### The expression format

The expression format and its evaluator are on
[Behaviors](/docs/destiny-2/behaviors/#unlock-expressions).

## The gameplay-switch table

The game also keeps a table of gameplay switches. A switch is a keyed value that tunes or disables a
feature: spawn behavior, camera behavior, or ability suppression.

The table is a flat sorted array of up to 350 records:

```c
struct GameplaySwitch {          /* 24 bytes */
    uint32_t key;                /* +0x00  a hash; the names are not in the client */
    uint32_t valueClass;         /* +0x04  bool, i32, float and nine more */
    uint8_t  payload[16];        /* +0x08  a bool is the byte at +0x08 */
};
```

The client rebuilds the whole table from scratch on each change. Later sources win:

1. the switch defaults of the current activity's gameplay-settings record
2. two fixed keys taken from that record
3. a 50-slot list in the session blob
4. definition refs in the session blob, each merged in turn
5. two lists on the activity-lifetime object, which the server fills
6. three fixed keys from a per-mode table

A lookup that misses returns 0. So every switch is off, or zero, until something writes it. That is
not always safe. Some readers return early when the record is missing, which turns the feature off.

The gameplay-settings record is picked by name hash. The client takes the first value that is not
`0x811C9DC5` from the activity, then the activity type, then a built-in default. So the activity the
server names decides the default switches.

## Open questions

- how the client maps a hash to an item index at runtime
- which option group in the customization header is face, hair or markings
- the meaning of item record bytes `+0x008` to `+0x00F`, and bytes `+0x0F6` and `+0x11B`
- the reader of the socket entry list row at definition `+128`
- the link from the bucket definition table to the 20 equipment slots
- the names of the gameplay switches
