---
title: "Packages"
date: 2026-11-08
description: "The Tiger package format: file names, header, entry table, blocks, named tags, how the client registers packages, and how entries get loaded."
weight: 10
---
The game keeps its content in `.pkg` files, called packages. A package holds many entries. Each
entry is one tag: a blob of bytes with a class. The bytes live in blocks, and a block can be
compressed, encrypted or both.

Every package in build 86657 uses package format version 38. Field names are descriptive, not
Bungie's. For what a tag is and how the engine reads its bytes, see
[Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/).

## Files and patches

A package file name has this form:

```text
w64_<family>_<package id>_<patch>.pkg
w64_sandbox_0197_5.pkg        family "sandbox", package 0x0197, patch 5
w64_globals_0377_en_2.pkg     an English locale package, package 0x0377, patch 2
```

| part | meaning |
|---|---|
| `w64` | the platform, 64-bit Windows |
| `<family>` | a content group, such as `sandbox`, `activities`, `investment` or `ui` |
| `<package id>` | 4 hex digits; the same value as header `+0x04` |
| `_en` | present on locale packages only |
| `<patch>` | a decimal patch number; the same value as header `+0x20` |

One package id can have several files, one per patch. The install for build 86657 holds 2202
files for 528 package ids.

Three packages break the naming rule: `w64_client_bootstrap_unp1_0.pkg`,
`w64_ui_bootflow_unp1_0.pkg` and `w64_ui_startup_unp1_0.pkg`. Their names have no hex id. Read the
package id from header `+0x04`, not from the file name.

### Picking the newest patch

A later patch replaces an earlier one. Use the file with the highest patch number for each package
id. The client does the same: at load it keeps the highest patch id it sees per package id.

The newest file is not always self-contained. Each block record names the patch file that holds
its bytes. So the block table of patch 5 can point into the file for patch 2. See
[Blocks](#blocks).

A later patch can also reuse an entry index for a different tag. Data read from an older patch file
can be wrong for the shipped game. Filter to the newest patch before you trust any entry.

## The header

The header is the first 0x180 bytes of the file. All values are little-endian.

```c
struct PackageHeader {              /* 0x180 bytes read */
    uint16_t version;               /* +0x00  always 38 */
    uint16_t platform;              /* +0x02  2 = w64 */
    uint16_t package_id;            /* +0x04  high bits of every tag in this file */
    uint16_t unknown_06;            /* +0x06  1 in every package; meaning unknown */
    uint64_t group_id;              /* +0x08  build signature; files of one build share it */
    uint64_t build_time;            /* +0x10  Unix time; 2017 to 2020 in this install */
    uint32_t content_build;         /* +0x18  highest value is 86657, the exe build */
    uint32_t content_revision;      /* +0x1C  0, 1 or 2; breaks ties in content_build */
    uint16_t patch_id;              /* +0x20  matches the file name; at most 0xFF */
    uint16_t language;              /* +0x22  matches the locale in the file name */
    char     tool_string[128];      /* +0x24  zero in every file */
    uint8_t  unknown_a4[0x0C];      /* +0xA4 */
    uint32_t signature_offset;      /* +0xB0  file offset of the signature; 0x800 in every file */
    uint32_t entry_count;           /* +0xB4  1 to 8192 */
    uint32_t entry_table_2017;      /* +0xB8  entry table offset, 2017 layout only */
    uint8_t  unknown_bc[0x14];      /* +0xBC */
    uint32_t block_count;           /* +0xD0 */
    uint32_t block_table_2017;      /* +0xD4  block table offset, 2017 layout only */
    uint8_t  unknown_d8[0x14];      /* +0xD8 */
    uint32_t unknown_ec;            /* +0xEC  zero in most packages; not the misc size */
    uint32_t misc_offset;           /* +0xF0  file offset of the misc block; 0 = none */
    uint32_t misc_length;           /* +0xF4  bytes the misc block hash covers */
    uint8_t  misc_sha1[20];         /* +0xF8  SHA-1 of the misc block */
    uint8_t  unknown_10c[4];        /* +0x10C */
    uint32_t entry_table_raw;       /* +0x110 table blob offset; entry table is at +96 */
    uint32_t table_blob_length;     /* +0x114 bytes the table blob hash covers */
    uint8_t  table_blob_sha1[20];   /* +0x118 SHA-1 of the table blob */
    uint8_t  unknown_12c[0x38];     /* +0x12C */
    uint32_t file_size;             /* +0x164 exact size of this file */
    uint32_t locale_check;          /* +0x168 a per-locale value the client checks at load */
    uint8_t  locale_id;             /* +0x16C 0, or 1 for the three unp1 packages */
};
```

Notes:

- `package_id` is a 16-bit value. Read as 32 bits, it is wrong in almost every file.
- `entry_count` is capped at 8192. The client rejects a larger value. 8192 is also the limit a tag
  can address, because a tag has 13 bits for the entry index.
- `entry_count` and `block_count` are different fields. They are never equal in this install.
- The package id range `0x100` to `0xA9F` is not a validity check. A package outside it still
  loads. The loader only skips recording its content build.
- `locale_check` has one value for every locale-0 package and another for the three locale-1
  packages. It depends on the locale and on the content id the client holds, not on the package.
  A client with the wrong content id fails every locale-0 package at this check.
- The `unknown_*` gaps are fields that are not identified.

### The signature and the footer

The 256 bytes at file offset `0x800` are a signature, followed by zero bytes. It is RSA-2048 PSS
with a 16-byte salt, over the SHA-256 of header bytes `0x000` to `0x16F`. The client holds one
public key for it. Every installed package verifies.

So any edit to the first `0x170` bytes breaks the signature. That range includes `file_size` and
`locale_check`.

The last `0x800` bytes of every package are not a signature. They are `0xDEADBEEF` followed by 2044
zero bytes. A tool that rewrites a package does not need to refresh them.

### What the client checks at load

| check | data | result on the install |
|---|---|---|
| header signature | the signature above | every package passes |
| misc block hash | SHA-1 of `misc_length` bytes at `misc_offset`, against `misc_sha1` | every package passes |
| table blob hash | SHA-1 of `table_blob_length` bytes at `entry_table_raw`, against `table_blob_sha1` | every later-layout package passes |

The table blob check also bounds the blob's own entry count to 8192. Packages in the 2017 layout
have no table blob: all three fields are zero. Whether the client runs the table blob check on them
is unverified.

### Two header layouts

The install holds two layouts. Both are version 38, so the version does not tell them apart.

| layout | built | entry table offset | block table offset |
|---|---|---|---|
| 2017 | 2017 | `entry_table_2017` at `+0xB8` | `block_table_2017` at `+0xD4` |
| later ("pre-Beyond Light") | 2018 to 2020 | `entry_table_raw + 96`, from `+0x110` | not in the header; see below |

Byte `+0x1A` picks the layout: 0 for the 2017 layout, 1 for the later one. It is the third byte of
`content_build`, so the later layout is every package with a content build of 0x10000 or more.

Every package id in this install resolves to a later-layout file at its newest patch. A reader that
only reads the newest patch never meets the 2017 layout.

## Typed arrays

The entry table, the block table and the tables inside the misc block are all engine arrays. Each
array has a 20-byte prefix directly before its data:

```c
struct ArrayPrefix {                /* 20 bytes, directly before the array data */
    uint32_t marker;                /* -0x14  always 0x80809FBD */
    uint64_t count;                 /* -0x10  element count of this array */
    uint32_t element_class;         /* -0x08  class of one element */
    uint32_t pad;                   /* -0x04 */
};
```

| element class | array | element size |
|---|---|---|
| `0x80809EF3` | entry table | 16 |
| `0x80809EEE` | block table | 48 |
| `0x80809EEC` | named-tag table | 16 |
| `0x80809D02` | 64-bit name hash table | 16 |

A field inside a blob that points at an array is 16 bytes:

```c
struct ArrayField {                 /* 16 bytes */
    uint64_t count;                 /* +0x00 */
    int64_t  relative_offset;       /* +0x08  from the address of this field */
};
/* prefix_count = field + 8 + relative_offset
   marker       = prefix_count - 4
   data         = prefix_count + 16 */
```

## The entry table

The entry table has one 16-byte record per entry. The entry index is the record's position.

```c
struct EntryRecord {                /* 16 bytes */
    uint32_t reference;             /* +0x00  the tag's class; see below */
    uint32_t type_info;             /* +0x04  file type and subtype bits */
    uint64_t block_info;            /* +0x08  where the bytes are; three packed fields */
};

start_block  = block_info & 0x3FFF;                  /* index into the block table */
start_offset = ((block_info >> 14) & 0x3FFF) << 4;   /* byte offset in that block, 16-byte units */
size         = block_info >> 28;                     /* entry size in bytes */
```

`type_info` carries a file type in bits 9 to 15 and a subtype in bits 6 to 8. This split is
unverified against the client. The other bits are unknown.

In the later layout, `reference` is the tag's class. In the 2017 layout it is often a tag that
points at a descriptor entry instead.
[Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/#the-class-of-a-tag)
explains how to resolve it.

The array prefix count can be larger than `entry_count`. The table is padded. Use the prefix count
to find the end of the table, and `entry_count` to bound the indices you read.

## Blocks

Entry bytes live in a block stream. A block holds up to 0x40000 bytes (256 KiB) once decoded. An
entry starts at an offset inside one block and runs on through the blocks that follow it by index.

### Finding the block table

In the 2017 layout the header gives the offset at `+0xD4`.

In the later layout no header field gives it. It follows the entry table:

```c
entry_table  = header.entry_table_raw + 96;
entry_slots  = prefix_count(entry_table);        /* ArrayPrefix.count, not header.entry_count */
block_table  = entry_table + entry_slots * 16 + 32;
/* check: the prefix before block_table has marker 0x80809FBD and class 0x80809EEE */
```

### The block record

```c
struct BlockRecord {                /* 48 bytes */
    uint32_t offset;                /* +0x00  file offset of the stored block */
    uint32_t size;                  /* +0x04  stored size in bytes */
    uint16_t patch_id;              /* +0x08  which patch file holds the bytes */
    uint16_t flags;                 /* +0x0A  see below */
    uint8_t  hash[20];              /* +0x0C  Sunrise does not read it; meaning unverified */
    uint8_t  auth_tag[16];          /* +0x20  authentication tag for an encrypted block */
};
```

| flag | meaning |
|---|---|
| `0x1` | the block is compressed with Oodle |
| `0x2` | the block is encrypted |
| `0x4` | the block uses the second of two keys |

A block is stored as encrypt(compress(data)). Undo them in reverse order: decrypt first, then
decompress.

The block bytes are in the file `w64_<family>_<id>_<block.patch_id>.pkg`. This can be an older patch
than the file whose table you are reading.

The client reads every block of an entry from the patch file its first block names. It never reads
the `patch_id` of the later blocks. The first block's `patch_id` must also equal the patch the
request is for, or the load fails.

So a tool that writes a patch must put each edited entry wholly into blocks of one patch file. An
entry whose blocks are split across patch files reads the wrong bytes.

### Encryption

Encrypted blocks use authenticated encryption (AES-GCM). The 16-byte tag in the record must check,
or the block is rejected. The keys are not covered here.

You do not need a key to read the header, the entry table, the block table or the misc block. Only
block contents are encrypted. So a scan for every tag of one class needs no decryption.

### Compression

Compressed blocks use Oodle. The matching Oodle library ships with the game. A block can decode to
less than 0x40000 bytes. Oodle accepts only output sizes that are a multiple of 0x4000. A reader
that searches for the real size must step by 0x4000, not by halves. Halving skips real sizes and
truncates the block silently.

## Reading one entry

```c
/* Returns the bytes of entry `index` of package `id`. */
bytes read_entry(uint16_t id, uint32_t index) {
    file   = newest_patch_file(id);            /* highest patch number */
    header = read(file, 0, 0x180);
    if (header.version != 38 || index >= header.entry_count) return FAIL;

    entry_table = (header[0x1A] == 0) ? header.entry_table_2017
                                      : header.entry_table_raw + 96;
    block_table = find_block_table(file, header, entry_table);

    e     = read_entry_record(file, entry_table + index * 16);
    start = e.block_info & 0x3FFF;
    skip  = ((e.block_info >> 14) & 0x3FFF) << 4;
    size  = e.block_info >> 28;

    out   = empty;
    first = read_block_record(file, block_table + start * 48);
    for (b = start; out.length < size; b++) {
        if (b >= header.block_count) return FAIL;
        rec  = read_block_record(file, block_table + b * 48);
        /* every block comes from the patch file the first block names */
        data = read(patch_file(id, first.patch_id), rec.offset, rec.size);
        if (rec.flags & 0x2) data = decrypt(data, key(rec.flags & 0x4), rec.auth_tag);
        if (rec.flags & 0x1) data = oodle_decompress(data);
        from = (b == start) ? skip : 0;
        take = min(data.length - from, size - out.length);
        if (take == 0) return FAIL;
        out.append(data[from .. from + take]);
    }
    return out;
}
```

Sunrise reads entries in `src/middleware/content/packages/reader/package_entry_reader.cpp`. It
takes each block from the patch file its own record names. That gives the same bytes as long as an
entry's blocks sit in one patch file. It keeps decoded blocks in a cache, because neighboring
entries often share a block.

## The misc block and named tags

`misc_offset` at `+0xF0` points at the misc block. A value of 0 means the package has none. The
block always sits below the entry table, so bound it by the entry table offset. `+0xEC` is not its
size. Whether `misc_length` always covers the whole block is unverified.

The misc block holds array fields. Their positions are not fixed. To find a table, walk the block's
array fields and keep each one whose prefix has marker `0x80809FBD` and the element class you want.

### The named-tag table

Element class `0x80809EEC`. Each element names one tag.

```c
struct NamedTag {                   /* 16 bytes */
    uint32_t tag;                   /* +0x00 */
    uint32_t class_id;              /* +0x04  the tag's class when the name was written */
    int64_t  name_offset;           /* +0x08  name is at &name_offset + name_offset */
};
/* The name is a zero-terminated string, such as "map:leviathan:root". */
```

Many names have a `<subject>:<role>` form, for example `<activity>:scenario_client` or
`map:<name>:root`.

Rules for using these names:

- Only some tags are named. A name missing from every table does not mean the tag is missing. Scan
  the entry tables by class before you conclude that.
- Read names from the newest patch only. An old patch can name an entry index that a later patch
  reuses for a different tag.
- Trust a name only when `class_id` equals the live class of the tag. In the install, some names
  point at tags whose live class differs from `class_id`.

### The 64-bit name hash table

Element class `0x80809D02`.

```c
struct NameHash64 {                 /* 16 bytes */
    uint64_t name_hash;             /* +0x00  a 64-bit hash of a name */
    uint32_t tag;                   /* +0x08 */
    uint32_t class_id;              /* +0x0C */
};
```

Some content links by this 64-bit hash, not by a tag. A map root names its bubbles this way. A walk
that follows only tag references stops at the map root. Which hash function makes `name_hash` is
unverified.

### The client's own name lookup

The client does not read the named-tag tables to find a tag by name. It uses a separate index, in
tags of class `0x80809780`. Each of those tags carries a sorted array of:

```c
struct NameIndexEntry {             /* 8 bytes, element class 0x80809252 */
    uint32_t name_hash;             /* FNV-1 of the name; the array is sorted by this */
    uint32_t tag;
};
```

The lookup binary-searches this array. So a name can be in this index and not in any named-tag
table, and the other way round. For example, `player_globals` is only in the client's index.
[Tags, classes and definitions](/docs/destiny-2/tags-and-definitions/#name-hashes) gives the hash.

## How the client registers packages

The client registers every package file at boot, before it loads any entry.

- The three `_unp1_` packages register from local disk in `bootflow:bootload`. The content
  configuration does not list them.
- Every other package file is a row in the content configuration that SignOn delivers (see
  [From launch to orbit](/docs/sunrise/boot-and-sign-in/)). There is
  one row per patch file, every patch included. The client keeps the highest patch per package id.
- `bootflow:package_registration` runs one registration job per row and waits until all of them
  finish.

A row carries the file name with its patch suffix, the package id and the expected file size. The
client cuts the name down to its bare stem, so a row cannot point outside the `packages` folder. It
then opens `packages\<stem>.pkg` under the game folder.

| result | the job fails when |
|---:|---|
| -81 | the file cannot be opened or read |
| -88 | `file_size` differs from the row's size |
| -87 | `locale_check` differs from the value the client computes |
| -91 | `package_id` differs from the row, when that check is on |
| -90 | `group_id` differs from the row, when that check is on |
| -93 | the header signature fails |
| -61 | the package id is out of range |

A failed job stops the boot with `Patchable package registration failed with result (<n>)`.

The client caches the headers it read in `cache_phr_*.dat` in the game folder. The file name is
tied to the content configuration's identity. If the list of packages changes but that identity
does not, the client replays the stale cache and registers nothing new.

A package file written after boot is never registered. So an entry that unloads always reloads
from the files that were there at boot.

## How an entry gets loaded

The client never loads a whole package. An entry loads in one of three ways:

1. A dependency record names it. Maps load this way.
2. A manifest names it. A manifest loads together with its root tag.
3. Code asks for its handle directly. Item, vendor and string language records load this way.

An entry that none of the three reaches is never requested. A reference to it from loaded content
then points at nothing.

### Dependency records

A package's dependency records are load lists. A map loads the entries its records name, not every
entry in its package. A record can name entries of any package.

The records sit in the misc block:

| misc offset | content |
|---|---|
| `+0x00` | u64 header size; the record stream starts at `align8(size)` |
| `+0x30` | root record count; child record indices count from here |
| `+0x40` | array of record words |

A record word holds three flag bits and a stream offset in its low 29 bits. The record body follows
in flag order:

| flag | section |
|---|---|
| bit 31 | `u16` group count, then per group `{u16 package, u16 words}` and that many `u16` run words |
| bit 29 | `u16` count, then `u16` child record indices |
| bit 30 | `u16` count, zero padding to 8 bytes, then `u64` keys |

A run word with any of its top three bits set marks `word >> 13` entries starting at
`word & 0x1FFF`. A word with none of them set gives a run of `word + 1`, and the next word gives the
start.

239 of the 528 newest packages hold records. Every record table re-encodes to its original bytes.

A patched record can make a new package load, because a record can name any package. How Sunrise merges the records of several mods is on
[Mods](/docs/sunrise/mods/#two-mods-patching-one-package).

### Manifests

A manifest is a tag of class `0x80809EF9`. The install holds 53,342. Each belongs to one root entry.
A root has `0x2000` in the `0xF000` nibble of its entry type field. When the client requests such a
root, it also requests the root's manifest and marks every entry the manifest lists.

| manifest offset | content |
|---|---|
| `+0x00` | u64 size of the tag |
| `+0x08` | u32 the manifest's own tag |
| `+0x0C` | u32 its root tag |
| `+0x10` | group array: count, then a relative offset |
| `+0x20` | record key array, as in dependency records |

A group is 40 bytes, and groups are sorted by package id:

| group offset | content |
|---|---|
| `+0` | u16 package id; `0x100` to `0xCFF` are accepted |
| `+8` | u32 bitmap word count, then at `+16` the offset of a bitmap; bit `n` marks entry `n` |
| `+24` | u64 entry count, then at `+32` the offset of a `u16` entry list |

An offset is relative to the field that holds it, and 0 means none. Every installed manifest lists
both its root tag and its own tag.

The root-to-manifest map is not in the misc block. It is in the package metadata that header
`+0x110` locates: an array of `{u32 root tag, u32 manifest tag}` rows, element class `0x80809A13`,
sorted by root tag.

The manifests list 2,784,122 tags in all. For example, the manifest of `investment_globals` lists
all 4,495 string containers, the string bank index, the investment root blob and the item table. No
manifest lists item records, vendor records or string language data. Those load on request.

### Streamed texture entries

An entry whose type field has `0x6000` in the `0xF000` nibble is a streamed texture buffer. Content
may reference it, but it never belongs in a manifest. No installed manifest lists one: 15,478 such
entries exist and none appears in any of the 1,191,098 manifest groups. The loader reads a streamed
entry's owner record without a null check, so listing one as resident is a crash risk. That a listed
streamed entry reaches that read is unverified.

### Static mesh materials

A static mesh, class `0x808071A7`, names its materials and its mesh data tag. The load set must
hold both, and each material's own closure. A mesh whose material nothing loads draws with a null
material. The draw reads that material's `+0x48` with no null check and faults on a worker. The
main thread then waits on the job forever, and the screen stays black after
`activity:initial_slice_set_loading`. Nothing reaches the retail log.

## What the families hold

The largest families by file count are `sandbox`, `environments`, `activities` and `audio`. Others
are per destination (`edz`, `dreaming_city`) or per PvP map (`pvp_*`).

A family name suggests what it holds, but the name is not proof. Find content by tag and class,
not by family. For item and character data, see
[Items, characters and inventory](/docs/destiny-2/investment-data/). For activity content, see
[Activities and destinations](/docs/destiny-2/activities-and-destinations/).

The client carries only the client half of activity logic. Tags such as `<activity>:scenario_client`
ship. The host-side scenario tags do not exist in the install. A server has to supply that logic.
