---
title: "Tags, classes and definitions"
date: 2026-09-28
description: "Tag hashes, tag classes, the definition registry, field descriptors and the bit-packed codec."
weight: 20
---
Every piece of content has a 32-bit id called a tag hash. Every tag has a class. The class names a
definition, and the definition lists the fields of the tag's bytes. The same definitions also drive
the bit-packed codec the game uses for Investment data and many network messages.

Field and function names are descriptive, not Bungie's. For the file format that holds the tags,
see [Packages](/docs/destiny-2/packages/).

## Tag hashes

A tag hash is a package id and an entry index packed into one 32-bit value:

```c
tag   = 0x80800000 + (package_id << 13) + entry_index;   /* entry_index < 8192 */

rel         = tag - 0x80800000;
package_id  = rel >> 13;
entry_index = rel & 0x1FFF;
```

Use addition and subtraction, not bitwise OR. For package ids of 1024 and above, `package_id << 13`
overlaps the `0x00800000` bit of the base, and an OR gives a different value.

Example: `investment_globals` is tag `0x81A2926E`.

```c
0x81A2926E - 0x80800000 = 0x0122926E
0x0122926E >> 13        = 0x914       /* package 0x914 */
0x0122926E & 0x1FFF     = 0x126E      /* entry 4718 */
```

### A tag hash is already a runtime handle

The client registers each package as a runtime handle table with id `1024 + package_id`. A handle
into such a table has exactly the tag hash form above. So a tag reference stored in content is a
valid runtime handle as it stands. The client does no tag-to-handle fixup at load.

### The value 0xFFFFFFFF

In definitions, `0xFFFFFFFF` in a handle field means "no handle".

## The class of a tag

Each entry-table record has a `reference` field. What it holds depends on the package layout.

| layout | `reference` |
|---|---|
| later (2018 to 2020) | the class itself, for 6397 of 6401 named tags |
| 2017 | usually a tag that points at a descriptor entry |

A 2017-layout descriptor entry looks like this:

```c
struct ClassDescriptorEntry {       /* entry class 0x80809EF9 */
    uint64_t size;                  /* +0x00 */
    uint32_t self_tag;              /* +0x08  this descriptor's own tag */
    uint32_t class_id;              /* +0x0C  the class of the subject */
    uint32_t subject_tag;           /* +0x10  the tag this descriptor describes */
};
```

To get the class of any entry:

```c
uint32_t tag_class(uint32_t tag) {
    ref = entry_record(tag).reference;
    d   = read_entry_as_descriptor(ref);   /* same group_id as the subject's package */
    if (d != NULL && d->subject_tag == tag)
        return d->class_id;
    return ref;
}
```

Do not tell the two cases apart by value range. Both layouts hold a mix of values. Resolve the
descriptor and check `subject_tag` instead.

A descriptor sits in a different package from its subject. Resolve it in the same build: pick the
file whose header `group_id` matches the subject's. The newest patch of the descriptor's package
can be a later build, where that entry index is something else.

The class value has the form of a schema handle (see [Schema handles](#schema-handles)). The
definition with that handle describes the tag's bytes.

## Resolving a tag to its bytes

```c
bytes read_tag(uint32_t tag) {
    package_id  = (tag - 0x80800000) >> 13;
    entry_index = (tag - 0x80800000) & 0x1FFF;
    return read_entry(package_id, entry_index);   /* see Packages */
}
```

The client loads a content tag into its tag heap and reads the blob in whole. It checks only that
the byte count matches. Nothing walks or patches the buffer.

So a content blob has no absolute pointers. Links inside a blob are relative offsets. Links to
other content are tag hashes. The client can move a blob in memory without notice. So an offset in
a package blob is the same offset the client sees at runtime.

A few classes register a load callback and are exceptions. Of 40,960 definition slots, 219 carry a
callback of any kind.

## Name hashes

The engine hashes strings with 32-bit FNV-1. The multiply comes before the XOR. FNV-1a, which does
it the other way round, gives different values.

```c
uint32_t fnv1(const char* s) {
    uint32_t h = 0x811C9DC5;               /* offset basis */
    for (; *s; s++)
        h = (h * 0x01000193) ^ (uint8_t)*s;
    return h;
}
```

| name | FNV-1 | tag |
|---|---|---|
| `investment_globals` | `0x6F7125CB` | `0x81A2926E` |
| `player_globals` | `0x3BAAD9FB` | `0x80B9E5C4` |

The client's name index maps these hashes to tags. See
[Packages](/docs/destiny-2/packages/#the-clients-own-name-lookup).

`0x811C9DC5` in a hash field means "no string". It is the basis with nothing hashed. The name
lookup returns "not found" for it at once.

## Schema handles

Definitions are held in five runtime handle tables. A handle into them looks like a tag hash:

```c
handle = 0x80800000 + (table << 13) + index;   /* table 0..4, index 0..8191 */
```

| table | handle range |
|---|---|
| 0 | `0x80800000` to `0x80801FFF` |
| 1 | `0x80802000` to `0x80803FFF` |
| 2 | `0x80804000` to `0x80805FFF` |
| 3 | `0x80806000` to `0x80807FFF` |
| 4 | `0x80808000` to `0x80809FFF` |

These tables use the ids 1024 to 1028. That is the spot package ids 0 to 4 would take. No
installed package uses those ids, so the two never meet. But a `0x8080xxxx` value alone can be a
class, a schema handle or, in principle, a tag. Know which one you hold before you feed
it to a package reader.

Handle `0x80800000` itself is table 0, index 0. The loader binds the root of the current definition
file there.

Example: the Investment root definition is handle `0x80808699`, table 4, index 1689.

## The definition registry

The executable refers to 21,922 definitions directly. Each reference is a pair:

```c
struct PendingBinding {             /* 16 bytes */
    struct DefinitionSlot* slot;    /* +0x00 */
    uint32_t definition_hash;       /* +0x08 */
    uint32_t pad;                   /* +0x0C */
};

struct PendingGroup {               /* 16 bytes */
    struct PendingBinding* bindings;
    uint32_t count;
    uint32_t cursor;
};

struct DefinitionSlot {             /* 32 bytes */
    uint32_t schema_handle;         /* +0x00  0x8080xxxx */
    uint32_t pad;                   /* +0x04 */
    void*    definition;            /* +0x08  the definition record */
    void*    next_bound;            /* +0x10  list used to unbind at unload */
    void*    mirror;                /* +0x18 */
};
```

The references form 15 groups. Each group is sorted by `definition_hash`, low to high. Group sizes
range from 50 to 3765. The largest group holds the definitions the tag codec uses, including the
Investment root and the web service messages. What the other 14 groups serve is unknown.

### How definitions bind

The definition file carries a bind table. Each entry places one record in a schema table:

```c
struct BindEntry {                  /* 16 bytes */
    int64_t  record_offset;         /* +0x00  record = &entry + record_offset */
    int16_t  table;                 /* +0x08  0..4 */
    uint16_t index;                 /* +0x0A  0..8191; 0xFFFF = no handle */
    uint32_t pad;                   /* +0x0C */
};
```

The file picks the index, not the loader. So a definition gets the same handle on every run.

The loader then fills the slots with a merge join:

```c
for each record, in ascending definition_hash order:
    handle = make_handle(entry.table, entry.index);
    for (g = 0; g < 15; g++) {
        if (group[g].cursor >= group[g].count) continue;
        b = &group[g].bindings[group[g].cursor];
        if (b->definition_hash == record.definition_hash) {
            if (b->slot->definition == NULL) {
                b->slot->definition    = record;
                b->slot->schema_handle = handle;
            }
            group[g].cursor++;
        }
    }
```

Only the cursor entry of each group is tested, and cursors only move forward. So records must
arrive sorted by hash. A tool that replays definitions must keep that order.

The definition hash is not a hash of any string found in the executable. Whether it matches a
public manifest hash is not verified.

## Definition records

A definition record describes one struct. Records sit back to back. The next record starts at
`align8(record + length)`. There are 20,410 records in this build.

```c
struct DefinitionRecordHeader {
    uint32_t length;                /* +0x00  whole record in bytes */
    uint32_t unknown_04;            /* +0x04 */
    uint32_t definition_hash;       /* +0x08  the merge-join key */
    uint32_t unknown_0c;            /* +0x0C */
    uint32_t base_type;             /* +0x10  0xFFFFFFFF = none */
    uint32_t struct_size;           /* +0x14  bytes of the described struct */
    /* ... more fields, meaning unknown ... */
};
```

After the header comes a chain of blocks. The chain starts at record offset `0x58`, `0x60`, `0x68`
or `0x70`, so find it by value: the first block's tag is `0x80800050`. The chain runs to the end
of the record.

```c
struct BlockHeader {
    uint32_t tag;                   /* +0x00  0x80800050 on the first block, 0 after */
    uint32_t block_type;            /* +0x04 */
    uint32_t count;                 /* +0x08  elements in this block's array */
    /* type-specific header fields, then the array */
};
/* block_size = header_size + stride * count */
```

| block type | header size | stride | array holds |
|---|---|---|---|
| `0x8080010A` | `0x28` | 40 | field descriptors for the bit codec |
| `0x8080012F` | `0x20` | 12 | named members `{u32 name_hash, u32 type, u32 byte_offset}` |
| `0x8080010D` | `0x10` | 8 | method slots, zero on disk |
| `0x8080004C` | `0x18` | none | no array; 28 records only |

A record with no blocks describes a type with no methods, members or fields.

In a `0x8080010A` block, `+0x10` is the record's own handle. `+0x14` and `+0x18` are two struct
sizes, one per layout. They are usually equal. When they differ, the field descriptors' two offsets
differ by the same amount.

Member names in a `0x8080012F` block are FNV-1 of the lower-case name. The block's header ends with
an entry whose name hash is `0x811C9DC5` and whose type is the record's base type. Use it as a
check when you walk the block.

## Field descriptors

A field descriptor is 40 bytes. It says where a field sits in memory and how it is coded on the
wire.

```c
struct FieldDescriptor {            /* 40 bytes */
    int32_t  byte_offset;           /* +0x00  offset in the struct; also the array step */
    int32_t  alt_offset;            /* +0x04  offset in the second layout */
    int32_t  presence_index;        /* +0x08  bit index into the in-memory presence bitmap */
    float    unknown_0c;            /* +0x0C  0.5 in every descriptor read; meaning unknown */
    uint8_t  type;                  /* +0x10  type code, 0 to 45 in this build */
    uint8_t  has_presence;          /* +0x11  1 = a presence bit precedes the value */
    uint16_t zero;                  /* +0x12 */
    uint32_t sub_handle;            /* +0x14  nested definition, or 0xFFFFFFFF */
    int32_t  params[4];             /* +0x18  meaning depends on the type */
};
```

`params` depends on the type:

| type | `params[0]` | `params[1]` | `params[2]` |
|---|---|---|---|
| integer (3 to 10) | bias | bit width | unused |
| real (11, 42, 45) | range minimum, as float | range maximum, as float | bit count |
| nested (1) | 1 = the count is read at runtime | byte offset of that count | unused |

### The walker's view

At runtime the walker reads a compact form of a definition:

```c
struct WalkerDefinition {
    uint64_t field_count;           /* +0x00  number of descriptors, for a struct */
    uint8_t  unknown_08[16];        /* +0x08 */
    int32_t  array_length;          /* +0x18  > 0: an array; <= 0: a struct */
    uint32_t pad;                   /* +0x1C */
    struct FieldDescriptor fields[];/* +0x20 */
};
```

When `array_length` is above 0, the definition is a fixed array. Descriptor 0 repeats that many
times, and each copy steps `byte_offset` further. Otherwise it is a struct with `field_count`
distinct descriptors.

The walker keeps its own stack of 32 frames, so nesting is at most 32 deep.

### Type codes

The client has several walker modes, one handler table each. The Investment blob and activity
messages use one mode. Simulation messages use another. Codes 1 to 11 are the same on the wire
in every mode. The known differences are in codes 18 to 31 and 34 to 43, so rows in that range are
a general guide only.

| code | type | wire form |
|---|---|---|
| 0, 17, 32, 33 | none | nothing |
| 1 | nested definition | the fields of `sub_handle`, in place |
| 2 | bool | 1 bit |
| 3 | int8 | biased, `params[1]` bits |
| 4 | int16 | biased |
| 5, 9 | int32, uint32 | biased |
| 6, 10 | int64, uint64 | biased |
| 7 | uint8 | biased |
| 8 | uint16 | biased |
| 11 | real32 | quantized to `params[2]` bits when that is 1 to 31, else raw 32 bits |
| 12 | raw 64-bit value, such as a hash | 64 bits |
| 13 to 16 | vectors, quaternion, transform | fixed layouts; not covered here |
| 18, 20, 30 | nullable tag reference | see below |
| 24 | tagged union | a 6-bit code, then the chosen type |
| 34, 35, 37 | nested definition by handle | the fields of that definition |
| 41 | schema value, in the Investment mode | presence bit, 32-bit schema handle, then that schema's fields |
| 44, 45, 46 | scalar, real, quaternion with a scrambled value | plain bit count; only the value is mixed |

Types 44 and 46 are not used anywhere in the shipped definitions. Type 45 is used twice.

Field names do not appear on the wire. A field's position is its descriptor index, walked depth
first. A nested field expands in place, at its own position.

### Walking a definition

```c
void walk(handle def, uint8_t* obj, BitStream* bs) {
    for (i = 0; i < def.field_count; i++) {
        f = &def.fields[i];
        if (f->has_presence) {
            present = bit_set(obj_presence(obj), f->presence_index);
            write_bits(bs, present, 1);
            if (!present) continue;
        }
        if (f->type == 1) {
            if (f->params[0] == 1)                     /* dynamic count */
                walk_elements(f->sub_handle, obj + f->byte_offset,
                              read_int(obj + f->params[1]), bs);
            else
                walk(f->sub_handle, obj + f->byte_offset, bs);
            continue;
        }
        write_field(bs, f, obj + f->byte_offset);      /* dispatch on f->type */
    }
}
```

This is a sketch of the order, not a copy of the client's code. The client's walker is iterative.
Read it as "which bits come out, in which order". A dynamic count writes only that many elements;
the element and its size come from the nested definition, one level down.

A common array shape: a type-5 count at byte offset 0, then a type-1 field with `params[0] = 1` and
`params[1] = 0`. The count's bit width is sized to the capacity, so it hints at the maximum length.
The definition's `struct_size` is the capacity, not the encoded length.

## The bit-packed codec

The Investment blob and many network messages use this codec. For what the Investment blob holds,
see [Items, characters and inventory](/docs/destiny-2/investment-data/).

The codec is range compressed. Each integer field stores `value + bias` in a fixed number of bits.
A field with a range of 0 to 100 costs 7 bits, not a byte.

### The rules

- Bits are written most significant first. Wire bit 0 is the top bit of byte 0.
- Nothing is byte-aligned. Each field starts right after the last one.
- The last byte is padded with zero bits.
- An integer is stored as `stored = value + params[0]`, in `params[1]` bits. Reading undoes it:
  `value = stored - params[0]`.
- A field with `has_presence` set has one bit first. 0 means the value is absent and takes no more
  bits.
- A field without `has_presence` is always written. You cannot leave it out.
- There are no field numbers and no lengths. One wrong width shifts every field after it, and there
  is no way to resync.

A zero on the wire does not mean zero. All-zero bits decode to minus the bias. A field with bias 1
reads as -1. A byte with bias `0x80` reads as -128. A 32-bit field with bias `0x80000000` reads as
`0x80000000`. If you want a logical zero, write the bias.

### Worked example

Take a struct with three fields. Their parameters are real ones, taken from an Investment
definition.

| # | type | presence | bias | width | value |
|---|---|---|---|---|---|
| 0 | 3, int8 | no | 1 | 4 | 3 |
| 1 | 3, int8 | yes | `0x80` | 8 | -5 |
| 2 | 2, bool | no | 0 | 1 | true |

Encode each field:

```c
field 0:  3 + 1      = 4    -> 4 bits:  0100
field 1:  present           -> 1 bit:   1
          -5 + 0x80  = 123  -> 8 bits:  01111011
field 2:  true              -> 1 bit:   1
```

Join the bits and pack them from the top of each byte:

```text
bits:   0100 1 01111011 1          14 bits
bytes:  01001011 110111|00         last 2 bits are padding
hex:    4B DC
```

If field 1 is absent, its presence bit is 0 and its 8 value bits are gone:

```text
bits:   0100 0 1                   6 bits
bytes:  010001|00
hex:    44
```

Reading `00` as the first byte gives field 0 = 0 - 1 = -1, not 0.

### Nullable tag references

Types 18, 20 and 30 differ by walker mode. In the mode Investment and activity messages use:

```c
if (value is present) {
    write_bits(bs, 1, 1);
    write_bits(bs, value & 0x1FFF, 13);
    write_bits(bs, (value >> 16) & 0xF, 4);
} else {
    write_bits(bs, 0, 1);
    write_bits(bs, value == -2, 1);    /* two "empty" values: -1 and -2 */
}
```

The simulation mode writes a presence bit and 32 raw bits instead. Using the wrong mode costs 15
bits per field and breaks the rest of the stream.

In the simulation mode, a tag reference is first replaced by a stable 32-bit id read from the
client's definition table. So a decoder needs those tables to interpret a reference field. Whether
the Investment mode does the same remap before its 17-bit form is not verified.

### Real numbers

For a real field, `params[0]` and `params[1]` are floats that give the range, and `params[2]` is
the bit count. Reading `params[1]` as a width gives nonsense. For example `0x3F800000` is `1.0f`,
not a width. How the value is quantized inside the range is not covered here.
