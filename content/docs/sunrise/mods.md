---
title: "Mods"
date: 2026-11-08
description: "How Sunrise finds, orders, checks and loads mods, the folder and manifest a mod needs, mod config and cheat mods."
weight: 70
---
A mod adds packages, patches installed packages, and adds or replaces mission scripts. Sunrise
loads mods once, at startup, before the game asks for its content list. Restart the game after you
add or remove a mod, or change its `mod.json`. Changed mission scripts and Lua modules of a loaded
mod can be reloaded in the running game. See
[Mission scripts and SDK modules](#mission-scripts-and-sdk-modules). Some package changes can reach
a running game too. See [Package changes in a running game](#package-changes-in-a-running-game).
Scripts read changed config values immediately. Config bound to package data applies at the next
startup. The loader code is in `src/state/mods/`.

Loading a mod's packages, a mod destination and its `activity_sdk.pack`, and Reload bubble have
run in game. Merging two mods' patches, typed config baking and the move to free package IDs are
tested offline only. In game they are unverified.

## The mods folder

Mods live in `bin/x64/Sunrise/mods`, one folder per mod. Sunrise creates the folder at startup.
Sunrise Studio's **Build and install** writes a mod there, into a folder named after the mod id.

- A folder whose name starts with `.` is skipped. Studio stages an install there.
- A folder name may use only letters, digits, `.`, `-` and `_`, up to 64 characters. The game opens
  package files by an ASCII path, so the name must be plain ASCII.
- Sunrise reads at most 64 mod folders, in name order. The rest are skipped and counted in the
  summary notice.

```
mods\dev.example.mod\
  mod.json           the manifest
  refmap.bin         where the mod's packages name their own package IDs; see below
  activity_sdk.pack  the activity SDK rows of the mod's own destinations
  packages\          new packages: every generation of each new package id, plus .merge files
  patches\           patches of installed packages: the next generations of each id, plus .merge files
  sdk\               Lua modules added to the mission require path
  scripts\           mission scripts: <stem>\<stem>.lua controllers and helper modules
```

Only `mod.json` is required. Leave out the folders a mod does not use.

A destination a mod adds needs `activity_sdk.pack`. The server builds the destination's roster
from it, and without it the load stays on a black screen. Studio writes it on every build of a
project with a destination. Sunrise reads it once at boot. It is refused when Sunrise moved the
mod to free package IDs, because the pack still names the old ones.

A `<stem>.merge` file sits next to `<stem>.pkg`. It is the package's merge data, and Studio writes
it. A package without one still loads, but its entries cannot merge with other mods. See
[Two mods patching one package](#two-mods-patching-one-package).

`refmap.bin` lists every place in the mod's files that names one of its own package IDs. Studio
writes it on each build. Sunrise reads it only when it must move the mod to free package IDs. See
[When a package ID is taken](#when-a-package-id-is-taken).

## mod.json

```json
{
  "manifestVersion": 4,
  "id": "dev.projectsunrise.example",
  "version": "1.0.0",
  "name": "Example",
  "description": "What the mod does.",
  "authors": ["Name"],
  "src": "https://example.com/mod",
  "dependencies": [
    { "id": "dev.projectsunrise.base", "minVersion": "1.2.0", "maxVersion": "1.9.0" }
  ],
  "incompatible": ["dev.other.mod"],
  "packages": ["0x0412"],
  "cheat": false,
  "config": [
    { "key": "respawn_ms", "type": "int", "default": 5000, "name": "Respawn delay" },
    { "key": "scale", "type": "float", "default": 1.5 },
    { "key": "hard_mode", "type": "bool", "default": false }
  ]
}
```

| key | required | rule |
|---|---|---|
| `manifestVersion` | yes | 1 to 4. `configBindings` needs version 3, `packages` needs version 4. A higher number needs a newer Sunrise |
| `id` | yes | lowercase reverse-domain id, 3 to 64 characters: letters, digits, `-`, `_`, at least two parts split by `.` |
| `version` | yes | `MAJOR.MINOR.PATCH`, each 0 to 65535, no leading zeros |
| `name` | yes | 1 to 64 bytes of UTF-8 |
| `description` | no | up to 512 bytes |
| `authors` | no | up to 8 names of up to 64 bytes |
| `src` | no | up to 256 bytes. Shown in the Mods page, never opened |
| `dependencies` | no | up to 32. `id` and `minVersion` are required; `maxVersion` is optional. Both ends are inclusive |
| `incompatible` | no | up to 32 mod ids |
| `packages` | no | the mod's own new package IDs, up to 256, each `0x0100` to `0x0CFF`, as a number or a `"0x"` hex string, each once. Version 4. Studio writes it |
| `cheat` | no | `true` or `false`. Version 2 or higher. See [Cheat mods](#cheat-mods) |
| `config` | no | up to 32 entries. Version 2 or higher. See [Mod config](#mod-config) |
| `configBindings` | no | up to 256 typed sites. Version 3 or higher. See [Package config bindings](#package-config-bindings) |

The file is UTF-8 JSON of at most 256 KiB. Unknown keys and repeated keys are refused, so a
misspelt `dependencies` cannot quietly drop a dependency. A mod cannot depend on itself, list
itself as incompatible, list the same id twice, or list one id as both a dependency and
incompatible.

Versions 1 to 3 are read too. Version 1 cannot use `cheat` or `config`. Versions 1 and 2 cannot
use `configBindings`. Versions 1 to 3 cannot use `packages`. The refusal names the key.

## Mod config

A mod can declare values that the player changes on the Mods page. Its mission scripts read them
while the game runs.

### What a mod declares

Each entry in `config` is one value.

| field | required | rule |
|---|---|---|
| `key` | yes | 1 to 32 characters of `a-z`, `0-9` and `_`, starting with a letter. Unique in the mod |
| `type` | yes | `int`, `float` or `bool` |
| `default` | yes | a value of that type. `int` is a whole number that fits 32 bits. `float` is any finite number that fits a 32-bit float; a whole number such as `2` is fine. `bool` is `true` or `false` |
| `name` | no | the label on the Mods page, 1 to 64 bytes of UTF-8. The key is shown when it is absent |

Unknown fields are refused. A refusal names the entry by its place in the list, for example
`config entry 2: 'type' must be "int", "float" or "bool"`.

### Where the player changes it

Open the Sunrise menu, then **Mods**, then the mod. Each entry has a control:

- a checkbox for `bool`,
- a number field for `int` and `float`,
- a **Reset** button that returns the value to the mod's default.

A number is saved when you press Enter or leave the field. Scripts see the change on their next
config read. For a bound package value, the page shows **(restart)** when the saved value differs
from the value applied at startup. Hover it to see the applied value. Reset follows the same rule.
**Reset** is greyed out while no value is saved. Hover the label to see the key and its
default.

### Where the values are saved

Values are saved in `bin/x64/Sunrise/mod_config.json` on every change. The whole file is written
to a temporary file beside it, then moved into place. If saving fails, the previous file and the
live config values stay as they were.

```json
{
  "version": 1,
  "mods": {
    "dev.projectsunrise.example": {
      "respawn_ms": 2500,
      "hard_mode": true
    }
  }
}
```

- The file holds only the values you changed. **Reset** removes the value, so the mod's default
  applies again, even when a later version of the mod changes it.
- Values of a mod that is not loaded are kept.
- A value whose type does not match the mod's declaration is ignored, and the default applies.
- A missing file means every value is at its default. The log line is
  `ev=mods stage=config result=none`. A broken file, or one with another `version`, means the
  same. Sunrise renames it to `mod_config.json.bad`, so a later save cannot overwrite it, and logs
  `ev=mods stage=config result=fail reason=bad_file kept=bad`. The game starts as normal in both
  cases.

The file is separate from the mod folder, so installing a new version of a mod keeps its values.

### How a script reads it

A mission script that the mod ships reads its values through `context.mod_config`. For example,
`context.mod_config.respawn_ms` returns an integer, `scale` a number and `hard_mode` a boolean.
Each read returns the current value, so a change on the Mods page reaches the next read. A key the
mod does not declare reads as `nil`, and so does every key in a script that no mod ships.

## Package config bindings

Manifest version 3 adds `configBindings`. Sunrise Studio writes this metadata when you bind a
supported CUI site to a setting of the same type. One setting can drive several sites. The loader
checks the exact source entry, scalar ownership and type before accepting a mod.

| profile | supported values | site fields |
|---|---|---|
| `cui-property-v1` | float layout X, Y, width or height on supported built-in widgets; boolean text Auto width | `propertyOffset`, `poolOffset` |
| `cui-comparison-v1` | signed integer or float comparison operands | `bindingOffset` |

Each site also needs `key`, `type`, `tag`, `class`, `size`, `sourceSha256` and `offset`. The key must
be declared in `config`. `tag` and `class` are unsigned 32-bit JSON numbers. The supported resource
class is `0x80804825`. `sourceSha256` is the 64-digit hexadecimal digest of the supplied plaintext
entry. Offsets are byte offsets within that entry. Studio derives them from supported rows. They
are not arbitrary write locations. A site on a hash, an enum, a structural field, a pointer or
shared scalar storage is refused. So is an earlier direct property that a later direct property
supersedes. All sites for one entry must agree on its identity and may not overlap. A bound entry
may be at most 64 MiB.

The declaring mod must supply the bound entry in its own new package or changed patch entry. A
binding cannot edit installed bytes or an earlier dependency's entry without supplying its own
replacement. Target data must be plaintext in mod-supplied blocks. Encrypted or compressed target
blocks and missing older mod generations are refused. Original package files stay unchanged.

At startup, the loader reads saved values or defaults, merges patches and tables, then writes
merged entries and private copies of bound entries into cached packages. It verifies source
SHA-256, class, size and typed sites before it applies values. Floats keep their binary32 bits,
including the sign of zero. These values stay fixed in package data until the next startup.
Native bindings or layout rules may still replace the stored defaults when the resource runs.

Config snapshots and applied-value records are published only with a successful overlay. A later
patch that replaces an earlier mod's required bound entry is refused. If a required merge or bake
fails, no mod loads this session. The notice reads "Mod packages could not be checked. No mods
are loaded." Cached files from earlier runs and `mod_config.json` stay as they were.

## Cheat mods

A mod with `"cheat": true` is a cheat mod. When one is loaded, nothing earned or changed in that
session is saved. The session plays on a copy of the save held in memory, and the copy is gone when
the game exits. [Cheat sessions](/docs/sunrise/save-data/#cheat-sessions) has the detail.

- A cheat mod that is refused does not count.
- A notice at startup reads "Cheats are on. Progress this session is not saved." The Mods page
  says so too, and shows `(cheat)` after the mod's name.
- If the copy fails, Sunrise does not start, so nothing can reach the save.
- To save progress again, remove the mod and restart the game.

The log line is `ev=mods stage=cheat result=session_copy mods=1 tools=0`. `mods` counts the loaded
cheat mods. `tools` is 1 when `client.cheats` is on.

## Load order

A mod loads after every mod it depends on. When two mods have no order between them, the one with
the lower id loads first. Load order decides two things when mods patch the same package. Rows that
mods add to one table follow each other in load order. When two mods change the same bytes, or an
entry cannot merge, the later mod's values are used. See
[Two mods patching one package](#two-mods-patching-one-package). A later patch replacing an entry
with an earlier required config binding is refused.

A dependency orders ordinary overrides. It does not permit replacing a required bound entry.

## Why a mod does not load

A mod that fails any check is not loaded at all. A mod that depends on it is not loaded either.

| reason | log `reason=` | what happened |
|---|---|---|
| bad folder name | `folder_path` | the folder name breaks the rules in [The mods folder](#the-mods-folder) |
| no `mod.json` | `manifest_missing` | the folder has no manifest |
| unreadable manifest | `manifest_unreadable` | `mod.json` could not be read or is over 256 KiB |
| bad manifest | `manifest_invalid` | the JSON or a field breaks a rule above; the message names the field |
| newer manifest | `manifest_version` | `manifestVersion` is higher than this Sunrise reads |
| duplicate id | `duplicate_id` | two folders use the same id; both are refused |
| missing dependency | `missing_dependency` | a dependency is not installed |
| wrong version | `dependency_version` | a dependency is installed but outside the range |
| dependency did not load | `dependency_not_loaded` | a dependency was refused itself |
| circular dependency | `dependency_cycle` | mods depend on each other in a loop; every mod in the loop is refused |
| incompatible | `incompatible` | the mod lists an installed mod as incompatible. The mod that declares it is refused, not the other one |
| package conflict | `package_conflict` | a new package id is already installed or added by a mod that loads earlier, and the mod cannot move to a free id; see [When a package ID is taken](#when-a-package-id-is-taken) |
| bad package | `package_invalid` | a file name, header or table does not fit the rules below, or the move to free package IDs failed |
| bad patch | `patch_target`, `patch_invalid` | the patched package is not installed, or the patch does not fit the rules below |
| too many package files | `capacity` | the mods together add more than 1024 package files, or no free package id is left to move to |
| bad config binding | `package_invalid` | the declaration, source identity, typed site or required block data fails validation |
| required config conflict | `asset_override` | a later patch replaces an entry with an earlier required binding |

The keys `asset_override` and `merge_failed` also appear with `result=warn` on a mod that loads.
They mean it overwrites another mod's bytes, or some of its changes were left out of a merge.
[Merge warnings](#merge-warnings) lists each one. The key `package_remapped` is a warning too: the
mod loads from other package IDs than it ships. A failed merge or bake that carries required
config bindings stops every mod. See [Package config bindings](#package-config-bindings).

Each refusal shows as a notice at the top of the screen while the game loads, as "Mod <name> did
not load: <reason>". Up to three are shown, then one summary line: "N more mods did not load. See
Sunrise > Mods." In a cheat session two refusals are shown, so the cheat notice still fits. When no
refusal is hidden, the summary line instead counts the loaded mods that have warnings. The Sunrise
menu has a
**Mods** page with every mod, its details, and every reason. The log has one line per mod and per
reason, for example
`ev=mods stage=load folder=dev.example mod=dev.example result=refused reason=missing_dependency`.

## Packages and patches

A package file name is `w64_<family>_<4-digit hex id>_<generation>.pkg`, with an optional locale
before the generation. Startup `_unp1_` packages cannot be added or patched by a mod.

**New packages** go in `packages`. Their id must be `0x0100` to `0x0CFF`. The game's content list
takes ids up to `0x19FF`, but its header check refuses any id above `0x0CFF`. The id may not be installed or
used by another mod. Ship every generation from 0 to the newest.

**Patches** go in `patches`. A patch is the next generation of an installed package, built against
the installed newest generation, never against another mod's patch. It keeps every block record of
that generation and changes some entries. A mod may also patch a new package added by a mod that
loads before it.

A mod may ship several patches of one package as a chain: generations `n + 1`, `n + 2` and so on,
each built against the one before. Studio's **Update running game** writes such chains. A chained
package cannot be patched by any other mod. Whichever of the two mods loads later is refused with
`patch_invalid`.

## When a package ID is taken

A mod's new package ID can clash with an installed package, a startup package or a mod that loads
earlier. Sunrise then moves the mod's own packages to free IDs, when it can:

1. The mod lists its own IDs in `packages` in `mod.json`, and ships a `refmap.bin` that names the
   same mod and the same IDs.
2. For each own ID that is taken, Sunrise picks a free ID. It reuses a move it saved earlier while
   that ID is still free. Otherwise it picks a free ID from a fixed sequence that depends only on
   the mod id.
3. It writes moved copies of every affected package file to `cache\mods\remap\<mod id>`, with the
   package IDs rewritten at every place `refmap.bin` names. The mod folder is not changed.
4. The mod gets a `package_remapped` warning per move: "Package 0x.... is also used by <source>, so
   this mod uses 0x....". The log has `ev=mods stage=remap mod=<id> from=0x.... to=0x....`.

The moves are saved in `bin/x64/Sunrise/mod_remaps.json`, so the next start uses the same IDs.
Moves of a mod that is not loaded stay in the file.

```c
/* One entry of mod_remaps.json. */
struct SavedRemap {
    char     id[];         /* the mod id */
    uint16_t packages[];   /* the mod's own IDs, as "0x0412" strings */
    struct { uint16_t from, to; } moves[];
};
```

A mod is not moved, and the old `package_conflict` refusal stays, when:

- it has no `packages` list, or no `refmap.bin`, or the two do not match its files;
- its `refmap.bin` names a package ID inside a Lua script. Scripts are not rewritten, so the mod
  gets a warning that its scripts name its own tags.

A moved mod's `activity_sdk.pack` is refused, because the pack still names the old IDs.

## Two mods patching one package

Sunrise merges them, so each mod keeps its changes wherever the merge can be exact.

Loading the patches in order is not enough. Each generation of a package carries the complete entry
and block tables, and the game uses only the tables of the newest generation. Two mods that patch the
same package both ship the same next generation. Whichever file the game took, the other mod's
changes would be gone, even when the two mods change different entries.

So Sunrise writes one new generation that holds:

- the installed generation's tables,
- each mod's changed entries, in load order, with required bound-entry conflicts refused,
- the union of every mod's dependency records,
- each mod's new blocks, copied in. Installed blocks are still read from the installed files.

Then it merges each entry that several mods change, using the mods' `.merge` files. Merged entries
go into new plaintext blocks of the served file, the same way bound config values do.

### What merges

| change | how it merges |
|---|---|
| dependency records | per record, the union of the entries every mod added |
| manifests | per package group, the union of the entries every mod added |
| sorted maps | the union of the rows by key, kept sorted |
| field edits to an installed entry that keeps its size, or inside a table listed in [How a build works](/docs/sunrise-studio/build-pipeline/#merge-data) | in aligned 8-byte words. Edits in different words all apply |
| rows added to an installed table | each mod's rows follow the rows of the mods before it. Its references to them move with them, and so does a record a new row points at |

The merge never reads the installed package. Each mod's copy of an entry already holds the installed
rows, and its merge data lists the installed bytes it changed. For a table, Sunrise restores the
installed entry from each copy and checks its SHA-256. A copy that fails the check does not merge.

Studio decides which tables a `.merge` file describes. See
[How a build works](/docs/sunrise-studio/build-pipeline/#merge-data).

### Rows added by several mods

Rows are found by their position. Two mods that each add one item both add the same row number. So
Sunrise places the first mod's rows first and the next mod's rows after them. A mod's merge data
lists every reference it makes to a row it added. Sunrise adds to each such reference the number of
rows that earlier mods added to that table. A reference to an installed row never moves.

The row merge has these rules:

- A listed reference must name a row the mod itself added. If not, all of that mod's merge data is
  ignored.
- A mod must ship a `.merge` file with every package file, and each must be readable. If one is
  missing or cannot be used, all of that mod's merge data is ignored. Its rows might have to move,
  and an entry without merge data could not follow them.
- The merged row count must fit the table's limit. Tables read with a signed 16-bit row number stop
  at 32,768 rows, and some at 32,767.
  [How a build works](/docs/sunrise-studio/build-pipeline/#merge-data) lists each limit.
- Paired tables, such as the item index and the item display index, must grow by the same count for
  each mod.
- Item hashes, collectible hashes and string bank name hashes must stay unique across mods. The
  string bank index stays sorted when the installed one is.

**Row merging is all or nothing for one startup.** If any row table breaks a rule, no row table
merges and no reference moves. This also happens when an entry of a row table cannot merge for any
reason below, such as a mod without `.merge` files or a copy that fails its SHA-256 check. Each of
those tables uses the later mod's copy. Each earlier mod that added rows to one gets a warning,
because its references may now point at other rows. Dependency records, manifests, sorted maps and
field edits still merge.

### What does not merge

These keep the later mod's copy of the entry, and the later mod gets a warning:

- CUI screens, materials, textures and raw entry edits.
- An entry that Studio marks as not mergeable, or a table copy that fails its SHA-256 check.
- An entry from a mod without `.merge` files, such as one built by an older Studio.
- An entry of a mod whose merge data was ignored.
- Edits that change the size of an installed item, vendor or other record outside the tables in
  [How a build works](/docs/sunrise-studio/build-pipeline/#merge-data).

For a row table, these also turn row merging off for that startup.

Edits clash per aligned 8-byte word, so no field mixes two mods' values. When two mods change bytes
in the same word, the later mod's whole word is used and it gets a warning. The rest of that entry
still merges. The same holds when two mods add one key to a sorted map with different rows.

When the package merge itself fails, only the first patch loads and later mods get a warning. A
dependency record change that is not an addition does this. A merge with required config bindings
must succeed. Partial fallback is refused.

### Merge warnings

| warning | key | meaning |
|---|---|---|
| `Replaces N assets in package 0x.... that <mod> also changes.` | `asset_override` | entries that kept the later mod's copy |
| `Changes N bytes of entry 0x........ that <mod> also changes; its values were used.` | `asset_override` | two mods changed bytes in the same 8-byte word |
| `Merge data for package 0x.... was ignored: <reason>, so all of its merge data was ignored.` | `merge_failed` | the `.merge` file is missing, unreadable or does not match its package, or a reference failed its check |
| `Its rows added to entry 0x........ were not merged: <reason>. Its references to them may point at other rows.` | `merge_failed` | row merging was off this startup |
| `Its rows were not merged: package 0x.... failed: <reason>. Its references to them may point at other rows.` | `merge_failed` | a package with merged entries could not be served, so no merged entry was served |
| `Its changes to package 0x.... were not applied: <reason>.` | `merge_failed` | the package merge failed, so only the first patch loaded |

The log has `ev=mods stage=table_plan` once per startup when an entry is planned for merging, with
`result=ok` or `result=off` and the table that turned row merging off. It has
`ev=mods stage=table_merge` once per planned entry, with `result=ok` or `result=fallback` and the
reason. A cached file of merged entries that cannot be written logs
`ev=mods stage=rewrite result=fail`. When a package merge or a rewrite fails, every merged entry is
dropped, and the log has `ev=mods stage=table_merge result=dropped`.

### The merge cache

Merged and configured files live in `bin/x64/Sunrise/cache/mods`. Their cache keys include complete
source contents. Rewritten files also key the merged entries, the exact typed recipes and the
values. Startup redoes the table merge to build the key, then checks cached bytes against the
current inputs. A damaged cache is rebuilt without changing mod files. Unused cache files are pruned
only after the new overlay and config snapshots are published. A failed staging or publication step
keeps files used by the prior overlay.

A single patch without bindings or merged entries is served directly. A single patch or new package
gets a cache copy when it is bound, or when its references move because an earlier mod added rows.

## How the game finds mod files

Sunrise answers the game's content-list request itself. It adds one row per mod package file, then
gives the list a new identity so the game does not reuse its package header cache from the old list.

The game drops any folder from a name in that list and opens `packages\<name>.pkg`. It builds that
path in two places: the package file object, and the package header cache, which opens the file on
its own. So Sunrise detours both the path builder and the file opener, and gives each mod stem its
real path under the game folder. A stem no mod serves keeps the stock path. The same hook group has
a third detour, on the call that runs when a tag finishes loading. It writes the kept live updates
into the tag; see [Package changes in a running game](#package-changes-in-a-running-game). This is
the one client hook group the mod loader needs. It attaches only when a mod serves a package file.
See [Client hooks](/docs/sunrise/client-hooks/). If it cannot attach, a notice says mod packages
cannot load. The Sunrise folder must be inside the game folder, which it is in a normal install.

## Package changes in a running game

Sunrise Studio's **Update running game** writes the next generation of each changed package into
the installed mod, then asks Sunrise to reload the mod's packages. The Studio side is in
[Build and install](/docs/sunrise-studio/build-and-install/#update-a-running-game).

The game reads its package list once, at startup. A reload cannot change that list. So Sunrise
answers each changed tag in one of these ways:

| answer | what Sunrise does | when |
|---|---|---|
| applied, tier 1 | rebuilds its own data from the tag: spawn sets, scenario layouts or vendors | the tag's class feeds that data |
| applied, tier 2 | writes the new bytes into the copy of the tag the game holds now | the change is numbers only, in a part marked safe to patch |
| next spawn | the same, for a tag the game reads when something spawns | as above |
| need Reload bubble | keeps the new bytes and writes them into the tag each time the game loads it | the change is numbers only and keeps the tag's size |
| need a restart | nothing | any other change: a reference, a count, a new size |

The reload works like this:

1. Sunrise stages every mod again, with the same checks as at startup. It refuses when the set of
   loaded mods is not the one that loaded at startup. The log has
   `ev=mods stage=reload result=refused` with the reason.
2. It replaces the server's own package table only when it changed. The game's package list is not
   touched, and no cache file is deleted.
3. A kept update is guarded by a CRC-32 of the bytes it replaces. When the game loads the tag,
   Sunrise writes every kept update, oldest first. It stops at the first update whose guard fails,
   so a tag never mixes two versions. The log has `ev=load_patch tag=<hash> written=<n> kept=<n>`.
4. The worker logs `ev=studio stage=reload_tags` with the count of each answer and the time taken.

Kept updates live in memory and end when the game exits.

**Reload bubble** on Studio's Live tab sets a forced destination: the package, bubble and slice set
the player is in now. Leave the world, by going to orbit or by **Change Character**, then launch
again. The new load reads every tag of that bubble again, so a "need Reload bubble" change shows.
Clear the forced destination afterwards with **Clear active override** on the
[Activity Launcher](/docs/sunrise/settings-and-logs/#the-activity-launcher) page.

Reload bubble has run in game for a moved static. Tiers 1 and 2 and next spawn are unverified in
game.

## Mission scripts and SDK modules

When an activity starts, Sunrise looks for its controller script in this order:

1. each loaded mod's `scripts\<stem>\<stem>.lua`, the last loaded mod first,
2. `bin/x64/Sunrise/scripts\<stem>\<stem>.lua`,
3. the generated script in `scripts\activities`.

The Lua require path is searched in this order: the generated SDK in `sdk\lua`, each mod's `sdk`
folder in load order, each mod's `scripts` folder from the last loaded mod back, and the base
`scripts` folder. A mod cannot hide a generated SDK module behind one of its own.

Script files are read from disk again on a reload, so a changed script or Lua module of a loaded mod
takes effect without a restart. Press **Reload script** on the Script page of the World window, or
use **Update running game** in Sunrise Studio. A Studio reload covers the named mod and every loaded
mod that depends on it. Which folders a mod has is read only at startup, so a `scripts` or `sdk`
folder added later needs a restart. How the reload works is in
[The Activity Host](/docs/sunrise/activity-host/#where-mission-scripts-plug-in).

## Limits

- The server reads the package files Sunrise serves, merged and rewritten ones included, as well as
  the installed ones: the item, vendor and other mappings and the named tags see them. A change to
  a mod's packages rebuilds those at the next start, which takes longer than a normal start. A mod
  with only scripts changes none of them.
  Entity position profiles still read installed packages only. This has not been run in game yet.
- The generated mission SDK is built from the installed packages only. Mods do not change it, and
  installing or updating a mod does not rebuild it. A mod that needs Lua bindings for its own
  content ships them in its `sdk` folder.
- Mods may add at most 1024 package files together, and the whole content list holds at most 4000
  rows, about 1800 more than a stock install.

## Related pages

- [Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/)
- [Client hooks](/docs/sunrise/client-hooks/)
- [Packages](/docs/destiny-2/packages/)
