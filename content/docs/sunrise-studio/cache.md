---
title: "Cache settings"
description: "Turn the loading cache on or off, set its size limit and clear it."
weight: 245
group: "Guides"
---
Studio caches the finished naming index of your installation. The next open restores it instead of
scanning every package. The first open of an installation takes the longest. Later opens are much
faster. The cache holds names, categories, item and perk names, item kinds and ownership links. It
holds no package keys, geometry or GPU data.

## Change the cache settings

1. Choose **File > Cache...**. The **Disk cache** dialog opens.
2. Tick or untick **Cache package loads**.
3. Move **Limit** to the size you want, from 128 to 4096 MiB.
4. Press **Close**.

The default is on, with a 512 MiB limit. Changes apply the next time Studio opens the installation.
With an installation open, the dialog shows how much is stored. Hover that line for the folder.

## Clear the cache

1. Open the installation.
2. Choose **File > Cache...**.
3. Press **Clear cache**.

The open scene stays. The next open rebuilds the cache.

## Where it lives

The cache is in `%LOCALAPPDATA%\Sunrise Studio\Cache\data-v1`. Its files are disposable. They are
not project files or build output. Studio refuses a cache folder inside the installation or a
project, and a linked folder.

## How it stays correct

A cache entry is tied to:

- the installation path and every package generation;
- the SDK name files;
- the key source and decoder files;
- the cache format and the Studio build that wrote it.

Studio detects replaced and edited files by their Windows file identity and change time, even when a
file's write time was restored. A change in any input makes a full scan run again.

Each snapshot has a checksum. A missing, cut-off or damaged file is a cache miss, and Studio reads
the packages instead. Studio deletes a damaged file. A new snapshot is written to a temporary file
and then swapped in, so a failed write keeps the old one. When the cache would pass its limit, the
least recently used snapshots go first.

Project data never enters the cache. A naming index that saw project changes is not cached.
