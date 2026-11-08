---
title: "Tags, classes and definitions"
date: 2026-11-08
description: "Tag hashes, tag classes, loaded tags in memory, the definition registry, field descriptors and the bit-packed codec."
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

## Loaded tags in memory

A loaded tag sits in the tag heap as one blob. The blob holds the entry's bytes as they are in the
package. Each package has a slot table that maps a tag to its blob. The tag hash is the slot's
handle.

```c
struct ContentSlot {
    uint32_t size_or_class;   /* +0x00  size | 0xC0000000; a class reference for some entries */
    uint32_t type_word;       /* +0x04  the entry's type word; 0x100000 while loading */
    int64_t  link;            /* +0x08  slot address minus blob address */
    uint32_t class_ref;       /* +0x10  the entry's class; 0xFFFFFFFF while loading */
};
```

| state | what the slot holds |
|---|---|
| empty | `0xC0000000`, a link equal to the slot's own address, so it resolves to 0 |
| loading | bit `0x100000` set in `type_word`, `class_ref` -1 |
| resident | a non-zero blob address, both top bits set in word 0, loading bit clear, `class_ref` set |

Word 0 holds a class reference instead of the size for a manifest root and for type nibble 1
entries. A class reference has only the top bit set, so the two forms cannot be confused. Bit
`0x200000` in `type_word` marks a blob the tag heap does not own. Unload frees the blob only when
that bit is clear.

### The load order

A load request walks its tags through a state machine. After the blocks land, it queues a fixup
job for every tag of the request, then resolves references. The fixup job runs before any class
code reads the blob. It runs for every tag, even a class with no fixup callback.

### Defrag moves blobs

The tag heap defragments itself and moves blobs without telling their readers.

- A full pass copies the blob and moves the slot link at once.
- An incremental pass copies the blob first and moves the link later. Between the two, the slot
  still points at the old copy. A write there is lost when the link moves.

So code that writes into a resident blob must resolve the slot right before it writes. A write that
stays inside the blob and touches no offset, count or reference is safe, because blobs hold only
relative offsets.

An unloaded tag reloads from the package files the client registered at boot. The client never
registers a package file written after boot. See
[Packages](/docs/destiny-2/packages/#how-the-client-registers-packages).

Which classes copy their values out at load, for example into GPU buffers or physics bodies, is
unverified. For those, a change to the blob changes nothing visible.

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

The client's name index maps `player_globals` to its tag. See
[Packages](/docs/destiny-2/packages/#the-clients-own-name-lookup). The executable also holds the
`investment_globals` hash, but that hash is in none of the parsed name index tags. The name is in a
package named-tag table. Which lookup the client uses for it is unverified.

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

The same value is also a package class. 129 package entries in 23 packages carry class
`0x80800000`, all of file type 8. Each entry is a definition record, in the layout described under
[Definition records](#definition-records), and its tag hash is the class handle. So these are
classes that packages define. Content uses them: in 597 installed configs of class `0x80809C36`,
an object's class is one of these tag hashes. Which engine code registers them as classes is not
known.

The executable holds the string `bungiescript` next to this value, but the link from that name to
the class is unverified. No script interpreter is known in the client. So a bare `0x80800000`
proves nothing on its own.

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
public manifest hash is unverified.

## Definition records

A definition record describes one struct. Records sit back to back. The next record starts at
`align8(record + length)`. There are 20,410 records in this build.

```c
struct DefinitionRecordHeader {
    uint32_t length;                /* +0x00  whole record in bytes */
    uint32_t unknown_04;            /* +0x04 */
    uint32_t definition_hash;       /* +0x08  the merge-join key */
    uint32_t unknown_0c;            /* +0x0C */
    uint32_t base_type;             /* +0x10  0xFFFFFFFF = none; element type of an array object */
    uint32_t struct_size;           /* +0x14  bytes of the described struct */
    uint32_t unknown_18;            /* +0x18 */
    uint16_t flags;                 /* +0x1C  0x20 or 0x40 = an array object */
    uint8_t  unknown_1e[0x1A];      /* +0x1E */
    int64_t  pointer_map_rel;       /* +0x38  self-relative; 0 = none */
    int64_t  defaults_rel;          /* +0x40  self-relative; 0 = none */
    /* ... more fields, then the block chain ... */
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

### The pointer map

The pointer map lists the fields the engine must find in an instance: pointers, references into
other tags, handles and hashes. 13,524 records have one. The engine walks it to relocate the
pointers in a range of memory and to deep-copy an object.

```c
struct PointerMap {
    uint64_t word_count;
    struct { uint32_t offset; uint8_t kind; uint8_t zero[3]; } words[];
};
```

The offset counts from the start of the struct, or of the current group element. Most kinds take
one word.

| kind | field size | meaning |
|---:|---:|---|
| 1 | 8 | self-relative pointer to a zero-terminated string |
| 2 | 8 | self-relative pointer to an untyped block |
| 3 | 8 | self-relative pointer to a typed object; its class is the `u32` just before the target |
| 4 | 4 | tag handle, unverified |
| 5, 6 | 4 | schema handle, unverified |
| 8 | 4 | handle, unverified |
| 9 | 16 | `{u32 datum handle; u32 unknown; i64 byte offset}`, a pointer into another tag |
| 10 | group | `{offset, 10} {count} {stride} {n}`, then n words of a nested map, repeated `count` times at `offset + i * stride` |
| 11 | 4 | FNV-1 string hash, unverified; takes a second word `{u32 type id, u32 0}` |
| 12, 13 | -- | unknown |

The engine reads only kinds 1, 2, 3 and 9. It steps over the others. Their meanings come from their
default values, so they stay unverified.

An array object has flag `0x20` or `0x40`. Its instance is a header of the record's size, then
`count` elements, with `count` the `u64` at instance `+0`. Under `0x20` the element type is the
record's `+0x10`. Under `0x40` it is the `u32` at instance `+8`. Only class `0x80809FBD`, the array
header that [Packages](/docs/destiny-2/packages/#typed-arrays) shows, carries `0x40`. So a dynamic
array names its element class in the data, not in a definition.

### Default values

The default-value block gives an instance's starting bytes. 10,548 records have one. It starts with
a `u64` byte length counted from the block start. Items follow, each one optional zero padding,
then a `u32` class, then a payload. The next item starts 4-byte aligned after the payload.

| item class | payload | effect |
|---|---|---|
| `0x80800073` | `{u64 n; u64 dst_offset; u8 bytes[n]}` | copy n bytes |
| `0x80800074` | `{u64 dst_offset; u64 stride; u64 count}` | apply the next item, a nested block, `count` times at `dst_offset + i * stride` |
| `0x80800075` | `{u64 dst_offset; i64 rel}` | write a self-relative pointer to a copy of a string |
| `0x80800076` | `{u64 dst_offset; u32 value}` | write one dword |
| `0x80800077` | `{u32 hash; u32 type_id}` | ignored |

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
Read it as "which bits come out, in which order". A dynamic count writes only that many elements.
The element and its size come from the nested definition, one level down.

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
the Investment mode does the same remap before its 17-bit form is unverified.

### Real numbers

For a real field, `params[0]` and `params[1]` are floats that give the range, and `params[2]` is
the bit count. Reading `params[1]` as a width gives nonsense. For example `0x3F800000` is `1.0f`,
not a width. How the value is quantized inside the range is not covered here.
