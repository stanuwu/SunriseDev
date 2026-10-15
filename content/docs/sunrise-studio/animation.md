---
title: "Edit animation controls"
description: "Export a clip's control channels to glTF, edit them in Blender and import them back."
weight: 185
group: "Guides"
---
Studio can edit the dense control channels of an existing clip. It does not turn arbitrary bone poses
back into the game's rig. Playback in game is unverified.

## Export a clip for viewing

1. Open the entity.
2. On the **Scene** page, choose a clip in the animation picker and press Play.
3. Choose **Assets > Export animation...**.

This writes a baked animated joint hierarchy, without a mesh. It is for viewing. It cannot be
imported back.

## Export the controls

1. Open the entity.
2. Select a clip in the **Scene** page's animation picker.
3. Choose **Assets > Export editable animation...**.
4. Save the glTF outside the project.

With the clip asset itself open, skip steps 1 and 2. The export is one `.gltf` file with its data
inside.

## Edit in Blender

1. Import the glTF into Blender.
2. Set the scene frame rate to 30 fps. Keep frame 0 as the start and keep the original end frame.
3. Edit the animation channels on the `Control` objects. Keep their custom properties and parent.
4. Keep the `Sunrise control coordinates` object and its transform. Do not apply its transform.
5. Export glTF Separate with **Custom Properties** and **Animations** on.
6. In the animation export options, use Scene animation mode, **Always Sample Animations** and
   **Limit to Playback Range**.

glTF Separate writes a `.bin` file beside the `.gltf`. Keep both.

## Import the controls

1. Open a project.
2. Select the same clip in the **Scene** page's animation picker.
3. Choose **Assets > Import animation controls...**.
4. Pick the edited glTF.

Studio decodes the result again before saving it as a delta.

## What you can edit

You can edit:

- existing translation, rotation and uniform scale channels;
- linear or step keys at 30 Hz;
- values inside the original range;
- one animation per file.

The duration, control groups and value ranges stay as they are. Sparse channels are left out of the
export and stay unchanged.

Some clips are shared by bodies of different sizes. The rig then scales the clip's translations.
Playback and the viewing export apply that scale. The editable export keeps the clip's own values,
so an import writes values in the clip's own scale.

## Edit controls in a bundle

A full asset bundle offers the same control edits. In the **Sunrise** sidebar, each clip has a
button with its name. See [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).

## Limits

Studio refuses:

- unmapped controls;
- a static channel that changes;
- non-uniform scale;
- values outside the original range.

The export refuses a clip with no dense control channels. Skinning, IK, retargeting and new clips
are not supported.
