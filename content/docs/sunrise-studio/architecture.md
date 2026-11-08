---
title: "How Studio is built"
description: "The libraries that make up Studio, what each one owns, its threads, and how to extend it."
weight: 500
group: "How it works"
---
Studio is a .NET 9 Windows application. The window uses Dear ImGui drawn with Direct3D 11. The code is
split into libraries under `src/`, one per concern. All of them build with one version, set in
`Directory.Build.props`. The version is 0.1.0.

## Libraries

| library | owns |
|---|---|
| `SunriseStudio.Packages` | package catalogs, native metadata, block reads, package writing, overlays, the disk cache, the tag registry with each class's name and category |
| `SunriseStudio.Scene` | scene traversal, names, meshes, placements, lights, effects, SpeedTree foliage, markers, collision |
| `SunriseStudio.Animation` | skeletons, weights, control tracks, rig evaluation, root motion |
| `SunriseStudio.Rendering` | Direct3D 11 resources, the ImGui backend, shaders, game shader and emitter program execution, readback |
| `SunriseStudio.Viewport` | the cameras, previews, animation and particle playback, scene rendering, the shortcut registry |
| `SunriseStudio.Formats` | typed inspection, editable field definitions, interchange codecs |
| `SunriseStudio.Tags` | tag parsing and writing, the content graph, path queries, in-place struct views, `.tft` loose tags |
| `SunriseStudio.Projects` | the manifest, byte deltas, object edit storage, added assets, builds, mod installs |
| `SunriseStudio.World` | destination copies as `.tft` files, activity rows, the activity SDK pack |
| `SunriseStudio.Authoring` | imports that assemble native assets, and the object edit compiler |
| `SunriseStudio.Interchange` | Blender asset bundles, dependency groups, world scenes |
| `SunriseStudio.Missions` | lossless Lua parsing, flow and campaign graphs, SDK references, script projects |
| `SunriseStudio.Audio` | Wwise bank and media links, decoder jobs, WAV playback, music timelines |
| `SunriseStudio.Live` | the shared-memory link to a running game |
| `SunriseStudio.Editor` | the workspace, pages, theme, commands, layout, navigation history, pop-out windows |
| `SunriseStudio.App` | the Windows entry point and launch options |

`src/SunriseStudio.Tags.Generated` is not a library of its own. It holds one struct per tag class,
generated from the registry and never edited by hand. `SunriseStudio.Packages` compiles it, with
the struct views in `SunriseStudio.Tags/Views`, so the package readers can use them.

The Blender add-on is a separate Python package with its own repository,
[SunriseBlenderPlugin](https://github.com/stanuwu/SunriseBlenderPlugin). Users install it in Blender
separately; Studio does not build or ship it. Studio's exports carry data only, never a script.

## How data flows

1. The Packages library opens the installation and lists every entry.
2. The Scene library names the entries and decodes maps, missions and models on request.
3. The Formats library inspects an entry and lists its fields.
4. The Editor shows the result in pages and the Inspector.
5. An edit goes to the workspace, which hands it to the project as a byte delta or an object edit.
6. The project publishes an overlay. Every reader sees the edited bytes through it.
7. A build reads the same overlay and writes packages.

`PackageCatalog.Read` returns project bytes, with object edits on top. `ReadOriginal` always returns
the installed bytes, and it is the only base for deltas. The installed entry list never changes when
an overlay is applied. Added entries are listed by the project and found through the catalog's lookups.

## Threads

The window thread owns ImGui and the Direct3D 11 immediate context. Heavy work runs on workers.

| work | thread |
|---|---|
| package reads and block decoding | workers; different blocks decode in parallel, readers of one block share one decode |
| asset loading and material preparation | workers |
| buffer and texture creation during an upload | a worker, on the free-threaded device |
| binding resources and drawing | the window thread |
| collision layer decoding and upload | a worker, paused during project changes |

A pop-out editor window has its own ImGui context, which shares the main fonts, and its own swap
chain. The main window's frame draws it on the window thread.

An installation snapshot publishes names, assets and the world catalog together. A document publishes
its geometry, material data and native rendering plan together. The window uploads and warms the GPU
resources before it reveals the editor. During an upload, only the loading screen draws. Callbacks
never pump Windows messages or draw editor pages while resources are replaced.

A project change stops pending preview readers before it replaces the overlay. Read override callbacks
run one at a time.

## Selection model

A scene view selects whole placements. An asset view selects mesh parts. The decoder gives each
placement an identity, so parts of one placement group together and a reused mesh in another
placement is a separate selection. Live transforms are preview fields only. Exports and project edits
keep the authored transforms.

## Edits that update in place

With a map open, the workspace collects the tags each change rewrote and moves the affected objects
in place when it can. [Viewport performance](/docs/sunrise-studio/performance/#placement-edits) gives
the steps. This covers static instances, placements, slot placements, trigger volumes, lights, spawn
points and SpeedTree decorator records. Instance bounds and collision packfiles do not stop it: no
view reads the bounds, and the collision layer takes its own changes.

An edit to a static instance that shares its table also adds generated entries: a table holding only
the edited instance, and a placement list that the map container names after the edit. The update
accepts these
when each generated list only takes over draws the map already shows. The source row still moves the
instance, so the view matches a full reload, apart from the order of the instances.

Any other change reloads the map. [What still reloads](/docs/sunrise-studio/performance/#what-still-reloads)
lists the cases.

## Extend Studio

### Add a viewer

Implement `IAssetInspector` in Formats and register it with `AssetInspectionService.Register`. An
inspector returns sections, properties, references, diagnostics and an optional graph. Mark a
property editable only when its offset and encoding are known. The property page applies scalar
edits through `AssetEdit`. For a class the tag registry describes, the editor shows the inspector as
a panel above the field tree, so show only what the fields cannot, such as a graph or decoded values.

For a different UI, implement `IStudioPage` and register it with `StudioForm.Pages.Register`. The page
gets a `StudioPageContext` with the workspace and the viewport. A page with GPU resources implements
`IPreparedStudioPage`. Its preparation and disposal run between frames. Publish edits with
`StudioWorkspace.ApplyBytes`, `ApplyAssetEdits` or `ApplyObjectEdit`. Never write extracted game data
into project files from a page.

### Add a browser category

A browser category is a group of assets with its own viewer, such as weapons or enemies.
`StudioCategories` in Editor holds them. It has four registration hooks and four matching classify
hooks, one pair each for items, guardians, entities and content. Each hook is a `static partial
void` method that one category file implements, so the tree builds with or without that file.

| hook | does |
|---|---|
| `AddItemCategories`, `AddGuardianCategories`, `AddEntityCategories`, `AddContentCategories` | add `StudioCategory` records |
| `ClassifyItem`, `ClassifyGuardian`, `ClassifyEntity`, `ClassifyContent` | give a package entry its kind, extra search words and rarity tier |

An asset with no viewer goes to **All other assets**. Its **Category** there is the `category` of
its class in the tag registry, set in `data/seed-registry.json`, such as `Texture` or `Material`.

A `StudioCategory` names the kind prefix, the label, the group, the icon, the tooltip and its
`Sections`: the page ids it shows first. `ModelPane` draws the preview beside the tabs.
`OpenContext` gives the context that a plain open of the category's assets uses.

The classify hooks run once per catalog entry on the worker, so they read cached indexes only and
never read a package. A match whose category is not registered is ignored. The worker builds the
browser rows, the rows of each category and their counts together. Category rows come first.

The viewer shell draws a category document. It shows the Sections pages first, then every other page
that opens the asset. With `ModelPane`, the preview sits left of the tabs in a wide area and above
them in a narrow one. The Scene page is then not a tab. The pane hides while the Parts page shows,
as that page draws the model itself.

### Add creation to a category

`CreationTypes` in `Editor/Creation` maps a key and a `CreationMode`, **New** or **Clone**, to a
`CreationType`. The key is a category name, or `Texture`, `Material`, `Static prop` or `Other` for
an asset with no category. `CreationTypes.For` never returns null. A key with nothing registered
gives a gray type with the reason "Not built yet.". The list header, the row menu and the
viewer toolbar read it, so a registered type shows up in all three.

`CreationTypes` has one `static partial void` hook per area: `AddItemTypes`, `AddExoticTypes`,
`AddPerkTypes`, `AddVendorTypes`, `AddContentTypes` and `AddEntityTypes`. Each is implemented in its
own `CreationTypes.<area>.cs` file and calls `Add(key, mode, type)` for its categories. `Add` throws
on a key and mode registered twice.

A `CreationType` has one of three forms:

| form | when |
|---|---|
| a `Factory` that builds a `CreationWorkflow` | the type has a writer |
| the route name `Duplicate`, with no factory | another editor does the work |
| a non-empty `Blocker` | nothing can write it yet; the blocker is the tooltip |

A key with no registration gets the `NotBuilt` blocker, and the creation checks fail on it.

A Clone workflow overrides `CloneSource` with its base Tag field. Studio presets it with the
source asset. `Validate` must refuse a base that is not installed. Set `ClonesProject` on a Clone
that also takes a project asset as its base and never writes it. Build pickers with `RowPick`
over `StudioWorkspace.CategoryRowsOf` or `ClassRows`. These arrays are built with the browser rows
on the worker, so a picker never scans the catalog. A `RowFilter` runs on a worker and must not
read packages. A field with a `CreationPart` offers **New** next to **Pick existing**. Its
`NewFields` replace the picker while New is chosen. A non-empty `NewBlocker` keeps the part on Pick
existing and is the tooltip of the gray New.

### Add an importer

Keep file decoding in Formats and native asset assembly in Authoring. Return changed payloads as a
tag-to-bytes dictionary and pass the whole dictionary to `ApplyAssetEdits`, so paired payloads form
one transaction. Publish additions through `StudioProject.AddAssets`. When new assets and existing
references must change together, use `StudioWorkspace.ApplyAssetTransaction`: its factory receives
the allocated IDs and must not change the project itself. Refuse unsupported layouts instead of
dropping unknown data.

### Add an object edit rule

Implement `IObjectEditRule` and add it to `ObjectEditCompiler.DefaultRules`. A rule gets every edit of
its layout in one call. Start derived values from the installed original, never from an earlier
output, so every build gives the same bytes. A slow rule sets `BuildOnly`, so it runs in builds and
installs but not after every edit. A rule that leaves an asset unchanged on purpose calls
`ObjectEditContext.Note` with the reason. [How projects store edits](/docs/sunrise-studio/project-storage/#how-object-edits-compile)
describes the compiler.

### Add a shortcut

Add the action to `ShortcutActions` with a new id, and list it in every preset table in
`ShortcutPresets`. An empty text leaves it unbound. The id is saved in preferences, so never rename
it. Read input through `ShortcutInput`, never by testing a key in a page.
