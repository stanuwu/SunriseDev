---
title: "Find and open assets"
description: "Search and filter the asset browser, open an asset, follow its links, and go back and forward."
weight: 115
group: "Guides"
---
Every package entry is an asset: a model, a texture, a material, an entity, a script table, a UI
screen and so on. The Assets tab of the Asset browser lists all of them, plus the assets the project
added.

## The category list

The Assets tab opens on a list of categories, grouped as ITEMS, WORLD and CONTENT. Each row shows
the category and how many assets it holds. Hover a row to see what it holds.

A category has its own viewer. It shows everything about one thing in one place: the model, when
there is one, beside the pages of that asset. Categories with no assets in your installation are not
listed.

**Guardians**, in the WORLD group, holds the three class bodies. Its viewer dresses a body with a
face, armor and a weapon. [Guardians](/docs/sunrise-studio/guardians/) has the steps.

Everything without its own viewer is under **All other assets**, the last row.

An open category has **New** and **Clone** icons at the right of its title. They create content of
that category. [Create from a category](/docs/sunrise-studio/create-content/) has the steps.

## Find an asset

1. In the Asset browser, open the **Assets** tab.
2. Type words in **Search items, enemies and assets**. With no category open, the search covers
   every asset, and the results show in place of the category list.
3. To look inside one category, click it. The search then covers that category only.
4. To narrow a category, choose a **Type**, for example a weapon type.
5. With a project open, tick **Changed only** to list only what the project changed or added. On
   the category list, this lists the changes of every category.
6. To go back to the category list, press the Back icon next to the list title. This also clears
   the search and **Changed only**.

Each search word must appear in the name, the kind, the extra names of the row, the package, the tag
or the class hash. Extra names are, for example, a combatant name or a prompt.

In a category, item names are coloured by rarity. The second line of a row shows its type and its
package. A type that repeats the name is left out. In search results, the second line also names
the category. Rows with no real name are listed last.

## All other assets

**All other assets** keeps the full filters:

1. Choose a **Category**, for example Texture or Material.
2. Choose a **Type** in that category, when it has types.
3. To see one package only, choose it in the package list. The package filter applies only here.

The **Category** list holds only kinds with no viewer of their own. The **Type** list holds the
types of the chosen category. It is disabled when the category has no types, and it resets when you
choose another category.

Some of these categories hold gameplay records:

| category | holds |
|---|---|
| **Investment** | item displays and the investment tables |
| **Icon** | icon containers, their bitmaps and icon libraries |
| **Network** | class records and replication schemas of networked objects |

Records Studio does not decode yet stay under **Other**.

**All categories**, **All types** and **All packages** remove a filter. The number next to the list
title is the count of matching rows. A dot at the right of a row marks an asset the project changed.

## Open an asset

1. Click the row.

The asset opens in the Workspace. With a map open, it opens in the world's **Asset** tab and the map
stays. The Inspector shows its package, tag and size.

An asset in a category opens in that category's viewer. To open it as a plain asset instead,
right-click its row and choose **Open as asset**. Some rows have no view of their own in the
category, such as the event timing records in Audio. The viewer then says so above its tabs.

A row clicked while Studio is still reading opens when the read ends.

To copy an asset's tag, right-click its row and choose **Copy tag**. To start a copy of an installed
asset, right-click its row and choose **Clone...**.

## Read an asset

The pages of an asset depend on its kind. [The interface](/docs/sunrise-studio/interface/#workspace)
lists them. These are the common ones:

- **Scene** shows a model or texture, with animation controls for linked clips.
- **Properties** lists every decoded field. **Find property** filters them.
- **References** lists every tag the asset points at. Double-click a row to open it.
- **Bytes** shows the raw bytes.

A reference marked Candidate is a number that equals an installed tag. It may not be a real link.
The Related page labels such links as Possible reference.

## Follow related assets

1. Open the **Related** page.
2. Type in **Find connected asset** to filter.
3. Click a row to open it.

Opening a related model or clip keeps its entity owner, so the animation context is not lost.

## Choose the entity owner

A shared model or clip can belong to several entities. Studio needs one to preview animation.

1. Open the list next to the asset name. It reads **Choose entity owner** when no owner is set.
2. Choose the entity.

The Scene view's animation picker then shows that owner's clips.

## Preview animation

1. Open an entity, or a model or clip with a known owner.
2. Open the **Scene** page.
3. Open the animation picker above the scene and choose a clip. **Find animation** filters its list.

| control | effect |
|---|---|
| **Bind pose** | resets the preview to the rest pose |
| Play / Pause | starts or stops playback |
| Loop animation | repeats the clip |
| **Speed** | playback rate |
| time slider | scrubs the clip |
| Show bones | draws the skeleton |
| **Base** | for a relative clip, the clip it plays over; **Rig pose** uses the rest pose |
| **Pose x**, **Pose y** | for a pose clip, the parameter that picks its frames |
| **Aim and look** | the aim and look directions, as yaw and pitch, for rigs that aim |

Some clips are pose clips, such as aim and look. Their frames are poses picked by a parameter, not
played in order. For these, the **Pose** sliders choose the frames the way the game does. A sphere
clip shows **Pose yaw** and **Pose pitch** instead. The time slider still moves the base clip.

Cloth moves with the bones it is weighted to, with or without game shaders. It is not simulated, so
it does not swing or settle. Particles on a bone follow that bone.

## Open a weapon

A weapon opened from the browser shows its assembled model beside its pages. After **Open as
asset**, press the **Open the weapon scene** icon on the Weapon page instead. The assembled model
stays in view while you switch between any of its linked clips. The camera frames a newly selected
clip once. Playing or scrubbing after that keeps your camera position.

Every weapon opens, and almost every weapon animates. Parts the viewer does not draw, such as the
holographic reticle, are left out. A weapon with no first-person presentation, such as some vehicle
weapons, shows at rest, and the Inspector's **Load report** says why. If the assembled view cannot
be built at all, the item opens with the reason under **Preview notes**, and each art part still
opens on its own.

Weapons show their default shader and the item's default dyes. A single art part opened on its own
has no item, so its colours look flat. Scope outlines draw nothing, as in the game outside
aim-down-sights. **Shader report** lists any part that still shows the fallback material.
[Gear dyes and plates](/docs/sunrise-studio/rendering/#gear-dyes-and-plates) and
[Stencil](/docs/sunrise-studio/rendering/#stencil) explain why.

## How maps and plants draw

Trees, bushes and grass draw with the game's shaders and move with the map's wind. A decorator
payload opened on its own may show some plants as plain geometry. Open the map to see them drawn
fully. Large maps never drop objects; when texture memory is short, some textures show lower mips.
[SpeedTree foliage](/docs/sunrise-studio/rendering/#speedtree-foliage),
[Wind, occlusion and detail](/docs/sunrise-studio/rendering/#wind-occlusion-and-detail) and
[Texture memory](/docs/sunrise-studio/rendering/#texture-memory) have the detail.

## Select a mesh part

1. Open a model.
2. Open the **Parts** page, or click a part in the **Scene**.

The Inspector's PART section shows the part's LOD, vertex and triangle counts, render stage, blend
and depth. **Frame part** frames it. Click the material name to open the material.

## Choose a spawn input

Missions and maps spawn an entity from authored spawn rows. A row can pick a variant, a damage
state and other settings, and these decide which parts are on. Cabal Centurions, for example,
show different armor and decals for different spawns.

An entity opens on its **first authored spawn**: the spawn row that comes first in package order.
The **Parts** page shows a list of spawn inputs above the part search:

- **Native default (no spawn input)** shows the entity as the game builds it with no spawn row. No
  authored spawn uses this state. If no variant has a positive weight here, no variant turns parts
  off. The Inspector then explains each part that every variant turns off.
- Each **Spawn** entry is one distinct input. Its label names the variant it selects. Its tip names
  the first row that uses it, as tag and offset, and how many rows use it.

Pick an entry to read the entity again with that input. The drawn parts and the collision layer
both use it. The choice applies only to the open entity. It resets to the first authored spawn when
you open another asset or apply an edit.

An entity with no authored spawn row opens on the native default. If it has variants, the list
offers them instead as **Variant** entries. Their tip says they are not an authored spawn. A
variant entry reads the entity as a spawn that asks for that variant, with the variant's own
settings.

An entity placed in a map uses its own spawn row. Placed entities have no spawn list.

Studio finds the spawn rows the first time you open an entity. This takes a few seconds, once per
installation. The list does not follow later project edits to spawn rows.

## Pick variant values

A spawn passes values to the entity's variant component. Each value picks parts and materials.
On a Vex Hydra, for example, `type` is the rank (`minor`, `major`, `miniboss`, `ultra`) and changes
the armor colors. `faction` picks the look, such as Taken or a timeline.

The **Variant** section of the **Parts** page lists each value:

1. Open the entity's **Parts** page.
2. Pick a value in a row's list. Studio reads the entity again with it.
3. To go back to the spawn's own values, press the reset icon next to **Variant**.

A pick replaces the spawn's value for that row only. **Unresolved** means the read found no value.
One row is filled from player state in the game, such as the planet the player is on. Its list
offers the values the parts name. Pick one to see those parts.

## Set channel values

Materials read object channels. The game sets them while it runs, for example to show a shield or
light an eye. Studio starts each channel at its rest value: the value the game holds while the entity
is alive, unhurt and idle. A Vex Hydra's channel 1 rests at 0, so its shield plates show.

Studio works out a rest value from the entity's own data. When a channel depends on something that
only happens in the game, such as a script, the parent object or the time, the rest value is not
known and Studio uses 1. Hover a slider to see its rest value, or why it is not known. A rest value
can name a component that may change it while the game runs.

1. Open the entity's **Parts** page.
2. Open **Channels**.
3. Drag a slider and let go. Studio reads the entity again with that value. Ctrl+click a slider to
   type a value.

**All 0** sets every channel to 0, the value the game starts from. The reset icon sets every channel
back to its rest value. Names show when Studio knows them; otherwise a channel shows its hash.

An entity placed in a map also uses its rest values. Each model has its own set. Your values apply
only to the entity you open.

Picks and channel values apply only to the open entity. They reset when you open another asset.

## Parts the game never draws

Some model parts carry a flag that tells the game never to draw them. Studio hides these parts and
the Inspector says why. **Inactive parts** in the 3D view shows them again.

## Go back and forward

Studio keeps a history of the places you visit. A place records:

- the open map or mission;
- the open asset and its entity owner;
- the open tab: a page of the asset, the Scene, Mission, Asset or Report tab of a map, or Live;
- the selected world object.

To go back, press **Back** in the toolbar, the mouse back button or `Alt+Left Arrow`. To go forward,
press **Forward**, the mouse forward button or `Alt+Right Arrow`. The other shortcut presets use the
mouse buttons only.

Each new tab or selection is a new place. A step inside the open map keeps the map open. A step to a
place in another map opens that map. A step to a place outside any map closes the open map. A place
whose map or asset is gone is skipped. The history holds the last 200 places and starts
empty for each installation.

## Fix missing names

Names finish loading before the browser opens. If names look stale after a change to the
installation:

1. Choose **Assets > Resolve asset names**.

[How Studio names assets](/docs/sunrise-studio/names/) explains where names come from.
