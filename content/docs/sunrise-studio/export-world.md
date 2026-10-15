---
title: "Export a map to Blender"
description: "Write the open map or mission as a shared world scene and open it in Blender."
weight: 190
group: "Guides"
---
A world scene is a read-only copy of a whole map or mission for work outside Studio, such as renders
or reference. It shares geometry and materials between placements, so even a large map stays small
enough to open. You cannot import a world scene back. To change assets, use asset bundles; see
[Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/).

## Export

1. Open a map or mission.
2. Choose **Assets > Export world to Blender...**. The Inspector's **Export** menu has it too, as
   **World to Blender...**. **Export full asset to Blender...** is off for a map: a whole map is too
   big for one asset bundle.
3. Pick an empty folder outside the project and the installation.

The **World export** report opens. It lists the counts and notes, and says when some source content
was unavailable. **Open folder** opens the export.

## Open in Blender

1. Install the [Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin). See
   [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/#install-the-blender-add-on).
2. Choose **File > Import > Sunrise world scene**.
3. Open `world.sunrise-scene.json`.
4. Save the `.blend` file beside the export folder. The geometry and textures stay external files.

The import option **Instances** is **Automatic** by default: placements share one collection where
the material allows it. **Linked objects** makes one object per part, sharing the mesh data.

## What the scene holds

| holds | detail |
|---|---|
| geometry | every decoded part with its vertex colour, shared between placements |
| materials | a shader-derived preview per material and render stage, and per gear dye and plate |
| textures | used 2D textures as top-mip PNGs; a volume texture as its slices side by side |
| vertex motion | a **Passive motion** modifier on parts whose shader motion is decoded |
| placements | each placement's transform, source tags and identity; one per ground plant |
| markers | in a hidden child collection |
| lights | the map's placed lights, the time-of-day sun and the light volumes, in a child collection |
| sky | the map's sky, as the scene's world |
| effects | particle loops baked from Studio's viewport, in a child collection |

The importer hides parts that are hidden in the game's initial state. It also hides passes that
draw no color. It uses the most detailed LOD. A triangle that repeats a vertex index is left out.
[Interchange formats](/docs/sunrise-studio/interchange/#world-scenes) has the file layout.

## Lights

Each game light becomes a Blender light at its place, with its colour, range and cone. Studio runs
the light's own game shader to measure how bright it is in each direction and at each distance,
then picks the closest Blender light.

| game light | Blender |
|---|---|
| point | point light |
| spot, or a light that shines mostly one way | spot light, plus a point light for the light it sends outside the cone |
| a light that is dark behind | the above, plus a spot light of negative power facing back |
| line (a tube) | a row of point lights along it, at most 16; spot lights when it shines mostly to one side |
| sun | sun light, from the map's time-of-day curves at the map's start time |

The lights cast no shadows, like the game's placed lights. The sun casts shadows. Each light uses
**Soft Falloff**, a **Radius** and a **Custom Distance**; together they follow the game light's fade
to zero at its range. Cycles ignores Custom Distance, so each light also carries a small node
setup that fades it the same way. Several identical lights at one place import as one light with
their summed brightness, because the game draws every copy. Past 1,024 Blender lights, the weakest
are hidden, negative lights first.

## Sky and exposure

Most of a map's light comes from its sky, not the sun. The import sets up three things:

| part | Blender |
|---|---|
| sky | a new world, the scene's world: the camera sees the map's sky at its start time, and surfaces get the game's sky light |
| light volumes | one baked EEVEE **Volume** light probe per game cubemap box, so covered and indoor places get less sky |
| view | **Color Management**: **AgX**, look **AgX - High Contrast**, **Exposure** 0 |

The sky light is fitted so a surface open to the sky gets the game's light. Blender then works out
what blocks the sky: Cycles traces it, and EEVEE reads the baked light volumes. The game uses its
own baked occlusion instead, so shaded corners differ.

The import bakes the light volumes. In Blender's window the bake runs in the background; the status
bar shows it. After you move geometry, bake again with **Scene properties > Light Probes > Bake All
Light Probe Volumes**.

The view matches the game's final tone curve within 3% of the display range. Exposure 0 is the
game's starting exposure. The game and Studio's viewer both adjust exposure as you look around;
Blender does not, so a dark interior renders darker than Studio shows it. Raise **Exposure** about
1 to 2 stops for interiors. The scene keeps the chosen values as the custom properties
`sunrise_view_transform`, `sunrise_view_look` and `sunrise_exposure`.

An export from an older Studio has no sky. Its import leaves the world and the view as they are.

## Effects

Studio runs each particle system as its viewport does and records every sprite, frame by frame.
Blender plays the record back as a loop on the timeline. Each emitter is one object in the
`<map> effects` collection. It draws its sprites as squares that face the active camera.

- A sprite looks as it does in Studio: the texture of its material, Studio's size and fade, and its
  spin.
- Additive and alpha-blended sprites use the blend of their material. They show in EEVEE and
  Cycles.
- An effect that restarts on its own loops over one whole run. Any other effect loops as a steady
  stream, 4 seconds long.
- Loops run at 30 frames per second, whatever the scene's frame rate.
- An effect that gameplay starts, such as one waiting on a switch, is baked as **Show all effects**
  runs it, and starts hidden. Unhide it to see it.
- The object's properties name the effect, its trigger and its loop.

These stay as hidden markers, and the export report lists them:

- lens flares;
- particle systems that draw nothing in Studio either, such as one whose attachment point the
  entity lacks.

The record is small. Altar of Flame bakes 28 emitters into about 250 KB.

## Limits

- Lights are approximate. Light textures, such as striped cookies, and lights cut to a box or a
  wedge are averaged into a round cone. Many game lights also light surfaces that face away from
  them; Blender cannot, so that light is added to the surfaces that face the light. A surface at
  60 degrees to the light gets the game's light, one facing it gets more, one facing away gets none.
- The game fades out a light seen from far away. Blender lights do not fade with the camera.
- The sky and the sun are at one time of day: the start time the map authors, or 0.35 when it has
  none. The **Time of day** you set in the view does not change the export. The map's fog and the
  colours of its local cubemaps are not exported; reflections show the blurred sky light instead of
  the sharp sky.
- The sun shades and casts shadows along one direction. The game casts its sun shadows along a
  second direction, up to about 10 degrees away.
- Faces the game culls are hidden in EEVEE and the viewport. Cycles draws both sides.
- Cloth keeps its rest shape. It is not simulated.
- Particle effects are Studio's preview of them, not the game's. Sprite size and fade are Studio's
  choice, ribbons and beams draw as sprites, and sprite sheets show their whole texture. Effects on
  bones stay at the bind pose. Lens flares are hidden markers.
- Laser beams and glows that are meshes, such as the lasers on Altar of Flame, are materials, not
  effects. They draw as their material previews, so the Altar of Flame lasers show. A blended
  material that needs runtime inputs, such as scene lighting, draws nothing.
- Blended effects that need the scene depth, such as fog cards, sky glows and shoreline glows, draw
  nothing.
- Water is opaque. It shows its color, ripples and reflections of the Blender world, but not what
  is under it.
- The open sea, such as the ocean on Titan and around Deep Six, is flat. The game moves it with
  waves; the export does not. The export puts it at the height the game draws it, which can differ
  from the height of its model. The export notices say how far it moved.
- Ground plants that take their tint from per-plant data show white.
