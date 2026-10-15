---
title: "Edit an asset in Blender"
description: "Install the Blender add-on, edit a full asset bundle in Blender and import the edits."
weight: 160
group: "Guides"
---
A full asset bundle is a working folder with an asset and everything it links to: its models,
materials, textures, shaders, particles, animation and collision. You edit it in Blender with the
Sunrise Studio add-on, then import the edits back as deltas or as a new asset.

## Install the Blender add-on

The add-on is a separate project,
[SunriseBlenderPlugin](https://github.com/stanuwu/SunriseBlenderPlugin). Studio does not ship it.
Install it in Blender yourself. It needs Blender 5.2 or newer. The same add-on also exports
[original assets](/docs/sunrise-studio/original-asset/) and
[weapons](/docs/sunrise-studio/exotic-weapon/).

1. Download the add-on zip from its repository's releases.
2. In Blender, open **Edit > Preferences > Add-ons**.
3. Choose **Install from Disk...** in the menu at the top right and pick the zip.
4. Enable **Sunrise Studio**.

The add-on's README also explains building the zip from source.

A single-file `sunrise_bundle.py` in the `addons` folder is an outdated add-on. Disable and delete
it first. An add-on older than the export stops the import with
`Unsupported shader expression: <name>`. Install the newest add-on.

## Export the asset

1. Open the asset in Studio.
2. Choose **Assets > Export full asset to Blender...**.
3. Pick an empty folder outside the project and the installation.

The Inspector's Export icon has the same command as **Full asset to Blender...**.

The **Asset transfer** report opens. It lists what was exported and what is only an approximation.
**Open export folder** opens the bundle. **Blender add-on** opens the add-on's page.

### Export a guardian

A guardian bundle is view only. You can edit it in Blender, but Studio refuses to import it back
with "Guardian exports are view only."

1. Dress the guardian. See [Guardians](/docs/sunrise-studio/guardians/).
2. Press the **Export to Blender** icon at the top of the **Guardian** tab. **Assets > Export full
   asset to Blender...** and the Inspector's Export icon do the same.
3. Pick an empty folder outside the project and the installation.
4. Open the bundle in Blender as below.

The bundle holds:

- One armature: the body skeleton.
- Every body, head and armor mesh, skinned to that armature. A one-bone class item model is not
  skinned and stays at the origin.
- Cloth, such as a cloak, a mark or a robe, skinned to the body bones in its rest shape. Blender
  does not run the cloth simulation. The **Asset transfer** report lists it as Skeletal input.
- One Blender material per dyed part, named after the part. It has the plate textures, dye colours
  and dye textures Studio draws that part with. The plate textures are PNG files in `textures`.
- The head mesh in its neutral face pose. The armature rests in its bind pose.
- The weapon, bound to the right hand bone, so it follows the hand.
- One action when a weapon is equipped: its hold pose. The face bones stay in their bind pose in
  it, because the neutral face is already in the mesh.
- Materials and textures, built as for any bundle. Lighting and screen effects, such as the stars
  on placeholder armor, are approximate.

## Open the bundle in Blender

1. Choose **File > Import > Sunrise bundle**.
2. Open `asset.sunrise-bundle.json`.
3. Save the `.blend` file beside the bundle, so your Blender data is kept.

The 3D View sidebar gets a **Sunrise** tab with the **Sunrise bundle** panel.

## Edit

| what | how | imports as |
|---|---|---|
| vertex positions | move vertices; keep the topology and skin | position edits |
| UVs | edit supported UV layouts | UV edits |
| material slots and constants | edit **Sunrise native fields** in Material Properties | material edits |
| textures | paint or edit images | changed blocks of the edited mip |
| animation | the control-action buttons in the Sunrise panel | dense control edits |
| particle constants | edit the emitter object's properties | constant edits |
| collision | see [Edit collision](/docs/sunrise-studio/collision/#edit-collision-in-a-bundle) | object edits and shape deltas |

The bundle refuses new topology, changed rigs and changed skin weights. It refuses new Blender
objects, except new collision shapes. Keep every native mesh object.

## Export the edits from Blender

1. In the **Sunrise** sidebar tab, press **Export bundle edits**.

The add-on writes `asset.edited.sunrise-bundle.json` beside the bundle. **File > Export > Sunrise
bundle edits** does the same.

## Import the edits into Studio

1. Open a project.
2. Choose **Assets > Import Blender asset...**.
3. Pick `asset.edited.sunrise-bundle.json`.
4. Choose **Apply deltas** to change the existing asset, or **Add new asset** to make a copy.
5. For **Add new asset**, type the asset name and an unused **Package ID**.
6. Press **Import**.

The import checks everything first. A change it cannot store fails before the project changes. The
report lists each surface under **Compatibility**.

**Add new asset** clones the root and its verified dependencies into one new package group.
Installed sources stay delta-backed. An entity with unresolved internal references cannot be cloned.
It still imports as deltas.

## Preview animation in Blender

1. In the **Sunrise** tab, choose a **Pose** action.
2. Press **Preview**.
3. Play the timeline.

**Bind pose** clears the preview and keeps the actions. **Loop range** leaves out the last sample.
Leave it off for transitions. Bone actions are a preview only. Native animation edits use the
control-action buttons below them.

## Refresh materials after an add-on update

1. In the **Sunrise** tab, press **Rebuild material preview**.

Native slot and constant edits are kept. Some fixes need a fresh export from Studio.

## How the preview looks

Blender materials are previews built from the game's pixel shaders. They are not the game's shaders.

- Alpha tests become material alpha with the Dithered render method. Texture alpha alone stays
  opaque.
- Each part uses the blend of its render stage. Transparents and additive decals add their color.
- A blended part that fades where it nears other geometry, such as a Vex shield, draws as if
  nothing were behind it. Blender has no scene depth to fade against.
- A part that writes no color, such as the depth prepass, is hidden.
- Decal parts on render stage 1 show when they draw on their own mesh, as most enemy decals do. A
  decal that reads scene depth or other frame textures starts hidden. **Native decal volumes** in
  the **Sunrise** tab shows it. A guardian's stage 1 parts, such as face markings, are skinned to
  the face and show.
- Parallax and ray-march loops are left out. The material notes say so.
- Blended decals that change the surface color before lighting, such as guardian brows and hair
  decals, are lit surfaces with alpha.
- Parts that start disabled in the game are hidden. **Inactive parts** in the **Sunrise** tab shows
  them.
- An entity exports as the **Parts** page shows it: the same spawn input, variant values and
  channel values. The bundle's notices list the ones used. See
  [Choose a spawn input](/docs/sunrise-studio/find-assets/#choose-a-spawn-input).
- Volume textures, such as Taken and Hive noise, are sampled from their slices. Cube textures show
  their mean color.
- Animated material values follow the timeline through a Scene Time node.
- A part whose vertex shader moves it over time, such as an Ogre head's pulsing bulges, gets a
  **Shader motion** modifier. It runs the same offset before the armature and follows the timeline.
- Preview nodes that do not reach the material output are removed. The native texture slots and
  constants stay unwired in a **Native fields (edit only)** frame. Edit them there.
- A material that draws with several blends gets a copy named `<material> [<blend>]`. Edit the
  original.
- A part with no resolved material shows untextured and is left out of renders.
- Particle effects play as looping sprites, as on a world scene; see
  [Export a map to Blender](/docs/sunrise-studio/export-world/#effects). Each loop is a child of its
  emitter object. The loop is a preview: edit the emitter object's constants, not the loop. Effects
  that gameplay starts, such as a Centurion's jetpack, start hidden.

When a model has several levels of detail, **Detail level** in the **Sunrise** tab picks the one
shown: **Best** or a **LOD** number. Every level stays editable.

[Interchange formats](/docs/sunrise-studio/interchange/#asset-bundles) has the full rules.

## Edit one mesh part without the add-on

You can move the vertices of one mesh part with any editor that keeps vertex order.

1. Open the model in Studio.
2. On the **Parts** page, select the part.
3. Choose **Assets > Export...** and save it as GLB, glTF or OBJ.
4. Move vertices in your editor. Keep the vertex order and the triangles.
5. In Studio, select the same part.
6. Choose **Assets > Import as delta...** and pick the edited file.

Positions must stay inside the part's original range. Shared vertices must get the same position.
This path cannot change topology.
