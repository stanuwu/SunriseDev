---
title: "How a build works"
description: "How a build writes packages and patches, updates dependency records and manifests, and installs a mod."
weight: 520
group: "How it works"
---
A build reads the project overlay, the same view the editor shows, and writes package files. It never
writes into the installation. An install copies the build into a Sunrise mod folder.
[Packages](/docs/destiny-2/packages/) describes the package format itself.

**Build packages** writes into a new folder `build/<UTC time>-<random id>` inside the project. An
output folder must be empty and outside the installation. Before every build, Studio rebuilds three
investment tables from the installed bytes;
[Investment editing internals](/docs/sunrise-studio/investment-internals/#perk-rows) says which.
Object edits are compiled again from the installed originals, never read from an older build.

## What the writer produces

The writer builds version-38 packages, the pre-Beyond Light layout this build uses.

| change | output |
|---|---|
| new entries in a new package ID | a new package, `w64_sunrise_<id>_0.pkg` |
| entries that object edits generate | a new package of their own, named the same way |
| changed entries of an installed package | a patch: the next generation of that package |
| changed entries of a startup `_unp1_` package | a full replacement with the installed file name and patch number |

[Package IDs](/docs/sunrise-studio/project-storage/#package-ids) gives the range a new package can
use. An entry whose bytes equal its installed original is left out. A build where every entry is left
out and nothing else changed stops with "nothing was built".

New blocks are written uncompressed. Existing block records and required patch generations are kept.
Every current package family in a checked installation uses the supported variant-1 metadata. Older
variant-0 blocks may be inherited, but patching or replacing a variant-0 package is refused.

A startup replacement's receipt lists the files it replaces.

The output needs Sunrise's custom package trust support, because stock signatures cannot be made.

## Dependency records

The game loads only entries that a dependency record names. A build keeps that true for the project's
changes.

1. Each generated entry is added to every installed record that names its source.
2. Each added entry is added to every record that names an entry pointing at it, by tag or by wide
   hash. This follows chains of added entries too.
3. Each changed package's records are encoded once.
4. A package whose only change is its records gets a patch of its own.

A generated entry whose source no record names stops the build. An added entry that no record reaches
is listed in the receipt under `addedAssetsInNoRecord`. New item and vendor entries are listed there
on purpose: the client requests them by tag handle.

Records only gain entries, so two mods' record edits to one package merge at startup. See
[Two mods patching one package](/docs/sunrise/mods/#two-mods-patching-one-package).

## Manifests

A root tag also loads the entries its manifest lists. An added entry joins each manifest that lists an
entry pointing at it, when that manifest already lists entries of its class. The receipt lists these
under `manifestEdits`, each with its reason. A new string bank joins the `investment_globals`
manifest this way.

| reason | an entry joins when |
|---|---|
| `reference` | a listed entry, or an entry that already joined, points at it by tag or wide hash |
| `native dependency` | a listed entry's decoded fields name it |
| `socket dependency` | it is a new socket plug, or its display, of an item with bucket byte 2 or less |

Native dependencies skip the class rule. An edited installed entry adds only the dependencies its
installed original lacks, because its manifests already load the rest. A newly referenced installed
entry brings its own dependencies. Socket dependencies always go to `investment_globals`,
`0x81A2926F`. A manifest that the project edits itself and that also needs new entries stops the
build.

A new root entry gets a manifest of its own. The build copies the manifest of the installed root it
was cloned from, adds the new root's resident closure, and writes it into the same new package. The
receipt lists it under `rootManifests`.

## Wide-hash aliases

Only new packages carry aliases. A build writes each alias as a `{uint64 key, uint32 tag, uint32
class}` row in the alias table of the package's misc region, class `0x80809D02`. Rows are sorted by
key, and a repeated key is refused. Named tags keep their rows and string offsets. A patch keeps the
source misc region, apart from dependency record edits.

## Merge data

Each built package gets a `<stem>.merge` file beside it. Startup `_unp1_` replacements get none.
Sunrise uses it to merge the package with other mods' patches of the same package.
[Two mods patching one package](/docs/sunrise/mods/#two-mods-patching-one-package) says how. The
binary layout is version 3, defined in Sunrise's `table_merge/sidecar.h`. Sunrise still reads
version 2 files.

The file gives each edited entry one kind:

| kind | given to |
|---|---|
| table | an entry of a table listed below, or any other installed entry edited at the same size |
| manifest | a manifest that only manifest planning changed |
| added | an entry of a new package that names rows this build added |
| opaque | every other installed edit, which changes the entry's size |

A table entry lists the installed bytes it changed and the SHA-256 of the installed entry. An entry
of a listed table also lists each array Sunrise rebuilds, grown or not. A change outside those
arrays, or a removed row, makes it opaque. A same-size entry outside the list has no arrays, so two
mods' edits to different 8-byte words of it both apply.

Table, opaque and added entries also list each field that names a row this build added. A field
that names an installed row, or holds `0xFFFF` for none, is not listed. Each listed field records
its width, 1, 2 or 4 bytes, the width the registry gives the field. Sunrise applies each field at
the width its file records.

Some rows point at a record outside every array, as an activity row does. The file lists the
pointers in such a record, so Sunrise can rewrite them when it moves a mod's record. Version 2 has no
such records.

These installed tables merge by appended rows:

| table | tag | limit | pair group |
|---|---|---|---|
| item index | `0x81327CCB` | 32,768 | item |
| item display index | `0x81613CF1` | 32,768 | item |
| icon index | `0x81A291C2` | 32,768 | |
| item art | `0x81A28B23` | 32,768 items | item |
| collectibles | `0x81327CDE` | 32,768 | collectible |
| collectible displays | `0x81327D67` | 32,768 | collectible |
| presentation nodes | `0x8131933F` | 32,768 | |
| sandbox perk definitions | `0x81319327` | 32,768 | perk |
| sandbox perk displays | `0x81613D28` | 32,768 | perk |
| socket types | `0x8131932F` | 32,767 | socket_type |
| socket type displays | `0x81613D06` | 32,767 | socket_type |
| lore text | `0x81613CF2` | 32,767 | lore |
| lore rows | `0x81319348` | 32,767 | lore |
| stat groups | `0x81613D08` | 128 | |
| gear | `0x81613D27` | 32,768 | gear |
| gear definitions | `0x81319326` | 32,768 | gear |
| arrangements | `0x81613D23` | 32,768 | arrangement |
| arrangement definitions | `0x81319329` | 32,768 | arrangement |
| vendor index | `0x8131931D` | 32,767 | vendor |
| vendor display index | `0x81A2926D` | 32,767 | vendor |
| string bank index | `0x81A27211` | 32,768 | |
| activity definitions | `0x81327CF0` | 4,095 | activity |
| activity texts | `0x81327D35` | 4,095 | activity |
| destinations | `0x81327CDA` | 256 | destination |
| destination texts | `0x81327D6B` | 256 | destination |

Tables in one pair group must grow by the same count. A build that breaks this stops. Item hashes,
collectible hashes, bank name hashes, activity hashes and destination hashes are marked unique.

These installed tables merge as sorted maps, keyed by the u32 at row `+0`: the runtime name map
`0x80EC3F60`, the art name map `0x80EC3F61` and the HUD icon library `0x80EFC07B`.

`data/merge-annotations.json` in the Studio source holds both lists, the rules that find row
references, and the `.merge` layout, by registry name. Studio's recipe code and Sunrise's
`table_merge/generated/sidecar_format.h` are generated from it. Each build also writes
`merge-sidecars.json`, a readable copy of every `.merge` file with each entry's kind and the reason
an entry is opaque.

## The build receipt

Each build writes `build-receipt.json` into its output folder.

| field | holds |
|---|---|
| `packages` | the output files |
| `addedAssets`, `generatedAssets` | the new tag handles and their package files |
| `configBindings` | the config binding sites |
| `objectEdits` | each object edit, its change and the tags it wrote |
| `objectEditNotes` | notes from compiling the object edits |
| `sourceAssetsNotBuilt` | added assets with no native layout |
| `dependencyEdits`, `dependencyTablesSkipped` | each record edit, and the tables that could not be read |
| `addedAssetsInNoRecord` | added entries that no record reaches |
| `manifestEdits` | each manifest an added entry joined, and the reason |
| `rootManifests` | each new root's manifest, the installed manifest it copies, and the entries it adds and keeps |
| `requiredPredecessors` | the installed packages the patches need |
| `replacesInstalledFiles` | the installed startup files that full replacements stand in for |
| `mergeSidecars` | each `.merge` file, its package and its SHA-256 |

## Installing

**Build and install** checks the mod details, builds, stages the result in a folder whose name starts
with `.`, then replaces `bin/x64/Sunrise/mods/<mod id>` with it. Sunrise ignores folders that start
with `.`, so the staged copy stays inert until the swap. The old install is renamed aside and deleted
only after the swap. If the game holds the folder open, the install stops and asks to close the
game. A project with only scripts or SDK modules installs without building packages.

| source | goes to |
|---|---|
| new packages | `packages` |
| patches of installed packages | `patches` |
| `.merge` files | beside their package |
| Lua controllers and helpers | `scripts` |
| own SDK modules | `sdk` |
| activity SDK rows of the project's destinations | `activity_sdk.pack` |
| mod details | `mod.json` |

A build of a project with a destination also writes `activity_sdk.pack`. A destination copies an
installed scenario, so its rows are that scenario's rows in the installed activity SDK, cut to the
kept bubbles, renumbered, and moved to the project's tags. The build needs the installed SDK: start
the game once with Sunrise before the first build.

The install writes only under `bin/x64/Sunrise/mods`, never into `packages`. It keeps an ownership
receipt of the script files it installed, so **Update running game** can replace and remove its own
files and leave files added by hand.

## Updating a running game

### Own packages and the reference map

The build lists the new package IDs the mod ships in `mod.json` as `"packages"`, which needs
`manifestVersion` 4. It also writes `refmap.bin`: every place in the mod that holds one of its
own tags or package IDs.

- Tag references the registry types, in new entries and in patched installed entries.
- Named tags and wide-hash aliases in each new package's misc region.
- Package IDs in dependency records and root manifests.
- Hex literals in mission scripts and SDK modules, by file, line and column.

If an own tag sits in a field the registry does not type as a reference, the build stops with
**Unresolved own-hash occurrence** and names the tag and offset. A loader could not move it.

When another mod or the installation already uses one of the mod's package IDs, Sunrise moves the
mod to a free ID. It writes moved copies of the mod's packages under `cache/mods/remap`, warns
naming both sides, and keeps the move in `mod_remaps.json` so the IDs stay the same next time. A
mod without `refmap.bin` is refused as before. A mod whose scripts name its own tags is refused
too, since Sunrise does not move script copies yet.

**Build and install** also writes `.studio-live.json` into the mod folder. It records the SHA-256
and size of each entry the mod serves, by package file.

**Update running game** builds the same way, then compares each entry with that record.

- A package with changed entries is written as its next generation, `<family>_<n+1>.pkg`, in the
  same folder as the earlier one. It holds only the entries that changed since that one. An entry
  reverted to its installed bytes is written again with those bytes. Earlier generations are never
  rewritten, since the game may hold them open.
- The record is saved after each file, so it always names files that exist.
- Studio then sends `patch_tags` when any changed tag carries patch ranges, else
  `reload_tags`, and `reload_mod` when scripts changed.
  [The live link](/docs/sunrise-studio/live-link/#command-link) describes both commands.

A full build of the same project serves the same bytes as the chain of generations.

The game reads SDK modules, `activity_sdk.pack`, `mod.json` and the list of packages once at boot.
A changed `activity_sdk.pack`, a new package, a new entry, a package the project no longer builds or
a dependency record change also needs a restart.
In those cases the update writes nothing and asks for **Build and install** with the game closed.
The mod must be installed once before it can be updated. Exactly one game must run from this
installation.

## Limits

- A startup replacement cannot install as a mod.
- A record change that is not an addition cannot merge with another mod's patch of that package.
- A patch number stays below 255.
- A package holds at most 8192 entries and 16384 blocks.
- A package holds at most 1,000,000 alias rows.
