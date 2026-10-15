---
title: "How Studio names assets"
description: "Where asset, object and bubble names come from, how sure each one is, and how naming loads."
weight: 560
group: "How it works"
---
Most game entries have no stored name. Studio builds names from several sources and records where
each one came from. The **Name source** group in the Inspector shows the source, the confidence and
any alternatives for the selected object.

## Sources

| source | evidence |
|---|---|
| package named-tag rows | an authored name, from the current or an older package generation |
| localized text | a scoped lookup in a string container; conflicting global strings stay unresolved |
| renderer rows | the renderer's own name tables |
| item names | matching gameplay and display records and their string bank |
| vendor names | the vendor's display record and its string bank |
| perk programs | the perk's display name, joined to its program through the runtime name map; a program shared by perks with different names keeps its other label |
| behavior and CUI paths | strings inside the package; a path labels the resource that holds it |
| Sunrise SDK | candidate names from the installed SDK files, checked against the tag's class and FNV hash |
| built-in tables | the game's 29 object type names, and Studio's own labels for the 67 slot types |
| entity components | combatant, prompt and behavior labels from context |
| asset owners | labels from typed model, material, buffer and texture links |

SDK names stay candidates. Studio reads only their name sections. It does not re-check the files'
full content. Studio ships a few short name tables from the game, such as the object type names.
No name list enters a project.

## Confidence

| confidence | meaning |
|---|---|
| authored | a name the game stores, such as a package name, a localized title or a renderer row |
| contextual | a label from context, such as a component, a content path or an owner link |
| candidate | a name that matches the hash or class but is not confirmed, such as an SDK name |
| fallback | no name; a label from kind, entry and package |

When values conflict at the strongest source, Studio refuses to pick one. An asset with no name gets
its kind, entry number and package as a label. Its tag stays separate from the label, in tooltips and
source links. A perk the game leaves unnamed gets the item that carries it as a label, not as a name.

## Loading

Package metadata names publish at once, without decoding payloads. A worker then adds the rest in
stages:

1. localization
2. renderer tables
3. investment names
4. content paths
5. SDK names
6. entity components
7. typed owner links

Studio waits for all stages before it shows the asset browser and the map list. Lookups never read
packages. Owner links are kept apart from labels, so a name found later reaches dependent assets.

The investment stage also records each item's kind: its bucket, rarity and type line. The asset
browser sorts items into categories with it.

The finished index goes into the loading cache, item kinds included. A cached index loads without
the stages. The cache is not used while a project changes the packages.
[Cache settings](/docs/sunrise-studio/cache/) covers the cache.

A project edit does not rerun the stages. Studio rereads only the changed assets: their component
names and, for items, their kind. The asset browser rows update from that.

## Scene names

After a scene loads, Studio names its bubbles, states, slots, markers and model instances with the
same service. Authored marker names stay as they are. Generated labels can improve when a later naming
stage finishes. Bubble records keep their tag and name hash. Scoped text adds aliases for bubble tags.

Names are Studio's labels, built from the evidence above. They are not guaranteed to be the names the
developers used.
