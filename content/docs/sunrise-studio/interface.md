---
title: "The interface"
description: "The window frame, toolbar, editor areas, menus, panels and status bar of Studio."
weight: 20
group: "Start here"
---
The Studio window has four bands, top to bottom: the menu bar, the toolbar, the editor areas and the
status bar. The editor areas fill most of the window.

## Window frame

Studio draws its own window frame. The menu bar and the toolbar act as the title bar.

- The minimize, maximize and close buttons sit at the right end of the menu bar.
- Drag an empty part of the menu bar or the toolbar to move the window.
- Drag any edge of the window to resize it.

A popped-out editor window has the same frame. Its top row shows the editor name, a **Pop in**
button and the three window buttons. There, the close button puts the editor back into the main
window. [Arrange the layout](/docs/sunrise-studio/layout/) covers pop-out windows.

## Toolbar

| item | what it does |
|---|---|
| logo and SUNRISE STUDIO | the application name |
| version | the Studio version, such as 0.1.0 |
| Back and Forward icons | step through the history of opened tabs and selections |
| project name | the open project, or **View only** |
| **New project** | shown without a project; opens the New project dialog |
| **Add asset** | shown with a project; opens the Add asset dialog |
| **Build packages** | shown with a project; builds the project |
| **Game shaders** | draws with the game's material shaders; off draws simple shading |
| **Full detail** | draws static objects at full detail at every distance, with no far cull |
| Lighting list | **Studio**, **Sky** or **Ambient**; needs **Game shaders** |
| Working | shown while a background task runs |

Back and Forward work like a web browser. By default the mouse back and forward buttons, and
`Alt+Left Arrow` and `Alt+Right Arrow`, do the same.
[Find and open assets](/docs/sunrise-studio/find-assets/#go-back-and-forward) lists what the history
records. [Rendering and lighting](/docs/sunrise-studio/rendering/) explains the lighting modes and
**Full detail**. With **Full detail** off, Studio switches detail and culls with distance, as the
game does.

## Areas and editors

The middle of the window is split into areas. Each area shows one editor. The header of an area
holds a list that picks its editor, and a **...** button with the area options. An empty area shows
**Choose editor**.

| editor | shows |
|---|---|
| Workspace | the open map, mission or asset, and the **Live** tab |
| Asset browser | maps, missions, the object hierarchy and all assets |
| Inspector | details of the selected object or asset, and its edit controls |
| Project changes | the project's changes and the last build |
| Object tree | the objects of the open map or asset |
| Mission Graph | the mission script editor |

Each editor shows in one place at a time. Choosing an editor that another area already shows swaps
the two areas. Choosing a popped-out editor brings it back into this area. The default layout has
the Asset browser on the left, the Workspace in the middle, Project changes below it and the
Inspector on the right.

The **...** menu has these options:

| option | effect |
|---|---|
| **Split left / right** | splits the area into two columns |
| **Split top / bottom** | splits the area into two rows |
| **Maximize area** | fills the window with this area; **Restore areas** undoes it |
| **Pop out window** | moves the editor into its own window |
| **Close area** | removes the area |

Drag the border between two areas to resize them. A window holds at most 16 areas.
[Arrange the layout](/docs/sunrise-studio/layout/) has the steps.

## Menus

| menu | items |
|---|---|
| File | **New project**, **Open project...**, **Recent projects**, **New mission script...**, **Save project** or **Save script**, **Close project**, **Close world**, **Sunrise location...**, **Cache...**, **Exit** |
| Edit | **Undo**, **Redo**, **Convert placement deltas to object edits**, **Shortcuts...** |
| Assets | **Export full asset to Blender...**, **Export world to Blender...**, **Import Blender asset...**, **Import skinned model...**, **Export...**, **Export animation...**, **Export editable animation...**, **Import animation controls...**, **Export material to Blender...**, **Export collision...**, **Import collision...**, **Import as delta...**, **Add asset...**, **Edit perk behavior...**, **Resolve asset names** |
| Build | **Build packages**, **Build and install**, **Update running game**, **Build to folder...**, **Mod details...** |
| View | **Mission Graph**, **Live**, **Items**, **Frame selection**, **Set cursor to selection**, **Wireframe**, **Grid**, **Panels**, **Restore areas**, **Reset layout** |
| Help | **Third-party notices**: the licenses of the libraries and code Studio includes |

**Save project** becomes **Save script** while the Mission Graph has focus. A menu item is gray when
it does not apply, for example an edit command without a project.

## Asset browser

The Asset browser has four tabs.

| tab | holds |
|---|---|
| Maps | every map; **Find map** filters the list |
| Missions | the missions of the open map, or all missions when no map is open; **Find mission** filters |
| Hierarchy | the object tree of the open map or asset |
| Assets | every package entry and every asset the project added |

The Assets tab opens on a list of categories, grouped as ITEMS, WORLD and CONTENT, with a count on
each row. The last row, **All other assets**, holds everything without its own viewer. **View >
Items** opens the Assets tab on the Weapons list, or on the category list when there is no Weapons
category. [Find and open assets](/docs/sunrise-studio/find-assets/) explains the list.

One search box, **Search items, enemies and assets**, covers every asset. Inside a category it
covers that category only. Every word must match.

| control | where | effect |
|---|---|---|
| Back icon | a category, All other assets or search results | returns to the category list and clears the search |
| **Type** | a category or All other assets | a type inside the category; **All types** shows every type |
| **Category** | All other assets | a broad kind, such as Texture; **All categories** shows every kind |
| package list | All other assets | one package; **All packages** shows every package |
| **Changed only** | every list, and the category list | only entries the project changed or added; shown with a project open |
| **New** and **Clone** icons | a category, at the right of the title | create content of that category; see [Create from a category](/docs/sunrise-studio/create-content/) |
| **New** icon | All other assets | a list of plain asset types: Texture, Static prop, Clone material |

All filters apply together. **Type** is unavailable until the chosen category has types. A row in a
category shows the name, coloured by rarity for items, and its type and package. In search results
it shows its full kind and package. Other rows show the name and the kind, such as `Texture`. A dot
at the right of a row marks an entry the project changed. Hover a row for its name, package and tag.
Right-click a row for **Open**, **Open as asset**, **Clone...** and **Copy tag**. **Open as asset**
opens a category row as a plain asset. **Clone...** shows when the row's category can clone and the
row is installed. A perk program the project added can be cloned too. While the clone cannot run,
the item reads **Clone**, is gray, and its tip gives the reason.

## Workspace

The Workspace has two tabs: **Assets** and **Live**.

With a map or mission open, the Assets tab shows the world tabs:

| tab | holds |
|---|---|
| Scene | the 3D view of the map, with the scene filters and the object tree |
| Mission | the mission's bubbles, states and authored content; shown for a mission |
| Asset | the open asset, while the map stays loaded |
| Report | object counts, environment controls, map layers and load reports |

Above the pages of the open asset, one row of icons holds **New**, **Clone** and **Edit**. New and
Clone act on the asset's category, or on its kind when it has no category. Clone uses the open asset
as the base. A gray icon shows its reason when you hover it. See
[Create from a category](/docs/sunrise-studio/create-content/).

Without a map, the Assets tab shows the open asset. An asset from a category opens in that
category's viewer. Where the category has a model, the model shows beside the pages when the area is
wide and above them when it is narrow, and there is no separate Scene page. The model hides while
the Parts page is open, as that page shows it. Tabs that do not fit scroll, and the list button
beside them lists every tab. The pages depend on the asset:

| page | shows |
|---|---|
| Audio | playback and export for audio entries |
| Perk behavior | the behavior of a perk, as editable source; **Compile and save** stores it |
| Weapon | a weapon's model, perk behaviors and catalyst |
| Guardian | a class body with its face, armor and weapon choices; see [Guardians](/docs/sunrise-studio/guardians/) |
| Investment | the stats, perks, sockets and sale rows of one item or vendor |
| Scene | the model or texture, with a picker and playback controls for linked animations |
| Parts | the mesh parts, with vertex, triangle and material columns |
| Materials | the texture bindings and constants of a material |
| Shaders | the compiled shader declarations and code |
| Related | connected models, materials, textures, shaders, skeletons and clips |
| Components | each config of an entity with its fields, and damage parts for enemies; edits may not work in game |
| CUI | the CUI layout editor |
| Graph | the structure of a behavior or CUI asset |
| Properties | every decoded field |
| References | every tag the asset points at |
| Bytes | the raw bytes, with a byte editor |

The Live tab is described in [Connect to a running game](/docs/sunrise-studio/live/).

## The 3D view toolbar

Each 3D view has its own toolbar of icons. Hover an icon for its name and its shortcut.

| icon | effect |
|---|---|
| Frame all | fits the whole scene in view |
| Select, Move, Rotate, Scale | picks the mouse tool; world views only. See [Drag with the handles](/docs/sunrise-studio/move-objects/#drag-with-the-handles) |
| Frame selection | fits the selection in view |
| Set cursor to selection | moves the orbit center to the selection |
| Grid | shows the ground grid |
| 3D cursor | shows the orbit center marker |
| Wireframe | draws edges only, also for parts drawn with game shaders |
| Orthographic view | switches between perspective and orthographic |
| Player camera | switches between the orbit and player cameras |
| **Teleport to spawn** | moves the player camera to a spawn point; shown when the scene has spawns |
| LOD | picks the level of detail; asset views only |
| Layers | shows or hides each kind of content; asset views only |

The world Scene tab draws its own filter row above the view: the Object tree icon, **Bubbles** and
**Layers**. A mission adds the **Map** and **Mission** checkboxes. While an object is isolated, the
row also has **Show all**. [Use the camera](/docs/sunrise-studio/camera/) covers the camera modes.

A texture view has a Fit image icon, a **Mip** slider and the image size. A texture with several
faces or depth slices adds **Face** or **Slice** sliders.

## Object tree

The Object tree lists the objects of the open map or asset: bubbles, states, containers, placements,
markers, lights, authored objects and squads. It appears in the Hierarchy tab, in its own editor,
and as a side panel of the Scene tab.

| control | effect |
|---|---|
| **Groups** | the project's object groups; click a row to select the group. Shown with a map and a project |
| **New group from selection** | makes a group of the selected object |
| **Find object** | filters rows; matching rows keep their parents |
| Reveal selection | scrolls to the selected object |
| Show all objects | clears every hide choice |
| Collapse tree | closes every branch |
| eye icon on a row | hides or shows the object and its children |

Click a row to select the object. Double-click to frame it. [Hide and isolate
objects](/docs/sunrise-studio/hide-and-isolate/) has the steps. [Group
objects](/docs/sunrise-studio/move-objects/#group-objects) covers groups.

## Inspector

The Inspector shows the selection. It has two modes, switched by the **Object** and **Asset**
buttons when a world object is selected.

In **Object** mode it shows the object's name and kind, its group, its bubble and state, the action
icons, **Open asset**, the placement editor, the decoded detail groups and the object's references.
**Expand details** opens every detail group. The action icons are Frame selection, Set cursor to
selection, Isolate selection and Show all objects.

With an object group selected, it shows the group instead: its name, Frame group, **Delete group**,
the **Transform group** fields, the group's objects and its collision parts.

In **Asset** mode it shows the asset's name, kind, **Package**, **Tag** and **Size**, and these
controls:

| control | effect |
|---|---|
| **Native metadata** | the reference class, type, subtype and entry number |
| Export icon | a menu: **World to Blender...** for the open map, **Full asset to Blender...** and **Asset file...** |
| Import icon | **Import as delta**, or **Replace asset** for an asset the project added; brings an edited file back |
| **...** | **Wide-hash aliases...** for a native added asset, **Config bindings...** for a CUI resource |
| **Revert to original** | shown when the project changed the asset |

The Assets menu has the same commands under their full names.

A selected part or property adds the PART or PROPERTY section below. A collision
selection shows its own fields. See [Edit collision](/docs/sunrise-studio/collision/).

## Project changes

The Project changes editor has two tabs.

The **Changes** tab lists one row per change.

| change | meaning | right-click |
|---|---|---|
| Config | a config binding | **Unbind** |
| Object | an object edit on one world object | **Revert** |
| Delta | a byte delta on one asset | **Revert** |
| Added | a new native asset | **Export**, **Wide-hash aliases...**, **Remove** |
| Derived | a new asset stored as a delta of an installed one | **Export**, **Wide-hash aliases...**, **Remove** |
| Source | a source file kept for external work | **Export**, **Remove** |

Click an Object row to select that object in the open map. With no map open, it opens the source
asset. Click any other row to open its asset. An asset or map that is already open does not
reload. Hover an Object row to see the assets it writes.

The **Build** tab shows the last install and the last build: the file counts, the packages written,
the object edits compiled, and **Open mod folder** or **Open output folder**.

## Status bar

The status bar shows the last status message. Errors show in red. While a background task runs, it
shows the task, its stage and a progress bar. Some tasks, such as a build, an install or a collision
export, leave a result message. It stays until **Dismiss** is pressed. A result that wrote files has
an **Open folder** button.

## Shortcuts

Every shortcut can be changed. [Shortcuts and presets](/docs/sunrise-studio/shortcuts/) lists them.
