---
title: "Items, characters and inventory"
date: 2026-09-28
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
    float    power;                     /* +0x070  the light shown on cards and the banner */
    float    inventoryPower;            /* +0x074  a second power value; write both */
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
- The customization rows must belong to the character's race and gender. A row from another race
  gives the model the wrong head. Which option group is face, hair or markings is not verified.
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
| 0, 1, 19 | never drawn |
| 2, 3 | class ability |
| 4 to 6 | movement |
| 7 to 9 | grenade |
| 10 | super |
| 11, 15, 21 | the melee of tree 1, 2 and 3 |
| 20 | the tree-3 super, which replaces entry 10 |
| others | tree perks |

Each entry names one plug pool, and each pool holds exactly one plug in this build. The state byte
only says whether the socket is absent, present or active. It cannot name a plug.

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
not verified in code.

## The package tables

All the tables below are package data. None is in the executable.

### The root blob

The tables hang off one package named tag, `investment_globals`. The client finds it by name through
the named-tag lookup ([Packages](/docs/destiny-2/packages/)).

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
| 408 | destinations | 48 |
| 504 | places | 27 |
| 776 | item definitions | 15424 |
| 1096 | progressions | 88 |
| 1528 | stats | 61 |
| 1560 | socket entry lists | 14 |
| 1752 | shared expression pool | 6541 |
| 1784 to 1832 | unlock flag and value maps | -- |

Most catalogs come in pairs. The root blob holds the half the game logic reads. A child of
`investment_globals` holds the half with the display strings. Both halves have the same rows in the
same order, so one row index works in either.

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

The hash-to-index loop is how offline tools map a published hash. The client's own hash lookup is
not known. Published item hashes from Season of Arrivals or earlier resolve against this build. A
miss usually means a later reissue of the item.

A second table, parallel to this one, has the same 15424 hashes in the same order. Its rows point at
the per-item string record instead of the gameplay record.

### The item definition

The definition record lists its object members with names. The names are FNV-1 hashes of lowercase
strings, and the strings are recovered. So these member names are Bungie's.

| offset | member | offset | member |
|---:|---|---:|---|
| 8 | `action_item_block` | 104 | `sockets_item_block` |
| 16 | `equipping_item_block` | 112 | `stats_item_block` |
| 24 | `finisher_item_block` | 120 | `summary_item_block` |
| 32 | `gearset_item_block` | 128 | `talent_grid_item_block` |
| 40 | `lore_item_block` | 136 | `translation_item_block` |
| 48 | `objective_item_block` | 144 | `unlock_item_block` |
| 64 | `plug_item_block` | 152 | `value_item_block` |
| 72 | `quality_item_block` | 176 | `inventory_item_block` |

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
  reading is right is not verified.
- Item stats live in `stats_item_block`, as 40-byte entries with the stat row at `+16` and the value
  at `+20`. An item instance carries no stat override.
- The same block holds a list of sandbox-perk indices. The character record's perk lists are built
  from it, for the base item and then each equipped plug.

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
so the link is not verified.

### Constants

The investment constants blob holds small game-wide numbers. The getter returns the blob base plus 8.

| offset | value | what it is |
|---:|---:|---|
| 592 | 0 | the stat row that holds light |
| 593 to 595, 622 to 624 | 4, 3, 5, 7, 6, 8 | the six character stat rows the sheet shows |
| 600 to 619 | -- | the weapon stat rows, one byte each |
| 650 | 7 | the character-level progression |
| 664 | 50 | the level cap |

### Names come from string banks

No item name is in the executable. Names are in localized string banks in the packages.

- Every string reference is a pair `{u32 bank index, u32 string hash}`.
- The bank index resolves through a bank table in `investment_globals` to a string container, then
  to per-language data.
- A string hash is unique only inside its bank. Resolving a hash without its bank gives the wrong
  text.
- The hash is FNV-1.

13884 of the 15424 items have a name. Lore, collectibles, stats, destinations, classes and activity
modes are named through the same chain.

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

A second route exists. An account-wide object carries two override lists of `{slot, value}` pairs,
100 rows each. The client copies them into the buffer after every mapping table, with no bounds or
kind check. So an override can set a slot that has no backing byte, and can clear most others.

Entering an activity also writes flags. The activity record carries a write list, and every value in
it is 2.

Only 108 flags have a display name in the unlock definition table. The rest are identified by what
their expressions gate. About a third of the slot space is stored by the client and never read by
any expression.

### The expression format

An expression record is `{u32 count; ...; i64 offset}`. Its instructions are 8 bytes each: the
opcode byte at `+0` and a u16 operand at `+4`. The evaluator is a stack machine.

| opcode | meaning | opcode | meaning |
|---:|---|---:|---|
| 1 | push a flag | 13 | `a > b` |
| 2 | NOT | 14 | `a >= b` |
| 3 | OR | 15 | `a < b` |
| 4 | AND | 16 | `a <= b` |
| 5 | NOR | 17 | `a + b` |
| 6, 9 | not equal | 18 | `a - b` |
| 7 | NAND | 19 | `a * b` |
| 8 | equal | 20 | `a / b` |
| 10 | push a value | 21 | `a % b` |
| 11 | push a constant | 24 | FNV-1 combine |
| 12 | evaluate a shared-pool row | 25, 26, 27 | `&`, `\|`, `^` |

The signedness and divide-by-zero behavior of opcodes 20 and 21 are not verified.

```c
bool unlock_eval(const EvalState *s, const ExprRecord *e)
{
    if (!e || e->count == 0)
        return true;                 /* callers treat "no expression" as a pass */
    int64_t stack[64];
    int sp = 0;
    const Instr *ins = expr_instructions(e);
    for (uint32_t i = 0; i < e->count; i++) {
        switch (ins[i].op) {
        case 1:  stack[sp++] = s->flags[(int16_t)ins[i].operand] == 2; break;
        case 10: stack[sp++] = s->values[(int16_t)ins[i].operand];     break;
        case 11: stack[sp++] = ins[i].operand;                         break;
        case 12: stack[sp++] = pool_eval(s, ins[i].operand);           break; /* raw result */
        case 2:  stack[sp - 1] = !stack[sp - 1];                       break;
        default: sp--; stack[sp - 1] = binary_op(ins[i].op, stack[sp - 1], stack[sp]); break;
        }
    }
    return sp == 1 && stack[0] != 0;
}
```

The shared pool holds numeric helpers, not only gates. Opcode 12 pushes the pooled row's number,
and the enclosing expression decides what it means.

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
