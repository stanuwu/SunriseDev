---
title: "Viewport performance"
description: "What the viewport keeps between frames and edits, so large maps stay fast to draw and edit."
weight: 600
group: "How it works"
---
A large map draws well over a hundred thousand native parts. The viewport keeps as much work as it can
between frames and between edits.

## Work kept between frames

- The render index keeps item kinds and native handle ranges in dense arrays. Native geometry does not
  enter a second mesh list each frame.
- Marker line vertices are prepared once per scene. The grid, the markers, the selected markers, the
  point proxies and the cursor each own a GPU line mesh. A frame with the same bytes reuses it and
  uploads nothing.
- Opaque and decal draws keep their instance data and draw list while the visible set, the enabled
  stages and the skin pose stay the same. A failure or a new pose rebuilds them.
- Each object's hide state is cached. It is rebuilt when any hide or display setting changes, when the
  attached game's bubbles or entities change, or when objects are moved, added or removed. A still
  camera reuses the last cull and its visible lists.
- Each shadow cascade keeps its own caster draws. A cascade records them again only when it moves,
  when caster hide state changes, or when the camera moves while distance levels are on. A material
  group whose casters all miss a cascade skips its parts. A group with no caster in any cascade is
  skipped whole.
- The backdrop bubble is chosen again only when the camera pivot or the hide state changes. The hide
  state of each candidate object is read once per hide state, and the search runs on several threads.
- A new backdrop bubble updates only the cull grid cells that hold backdrop objects of the old or the
  new bubble. Shadow casters are recorded again only when a backdrop object of either bubble casts a
  shadow. Over the EDZ, the frame that crosses a bubble edge costs a few milliseconds more than its
  neighbours.
- Animated materials that run the same program on the same inputs are evaluated once a frame and
  share the result.
- A material binds the frame textures its program picks again only when one of those textures or the
  program's result changes.
- Foliage wind rows are written once per tree type and model each time step, before their first draw.
- Object fog is evaluated again only when the camera position, the time of day or the fog table
  changes.
- An effect that no pose drives follows its placement again only when the placement changes.
- Foliage draws are kept while the camera position, the visible set and the foliage detail stay the
  same. Only their wind rows are written each time step.
- Each tree record's distance curve is worked out once. A moved tree works it out again.

Camera and frame buffers still update every frame. Sky and transparent draws are recorded every
frame. Their far-to-near order is kept while the camera, the visible set and the part positions stay
the same.

## While the camera moves

A moving camera needs a new cull every frame. These steps keep it short on large maps:

- The cull grid keeps, per cell, the objects the current hide state shows, with each object's bounding
  sphere in the same order. A hide or display change rebuilds that list once, on several threads. A
  camera move only tests cells, then reads the spheres of partly visible cells in order.
- A cell wholly inside the view adds all its objects without testing each one. A large cell is split
  into ranges of 4,096 objects, and the ranges are tested on several threads. They are joined in a
  fixed order, so the draw order never depends on timing.
- Static objects take their distance level on several threads. See
  [Level of detail](/docs/sunrise-studio/rendering/#level-of-detail). The kept objects are turned
  into draw handles on several threads too.
- The visible parts are sorted into their draw groups on several threads. Each thread writes its own
  share in a fixed order.
- The opaque draw list is laid out on one thread and filled on several.
- Animated materials are evaluated on several threads, then bound in draw order.
- Each foliage payload works out the distance level of each of its cells on its own thread, once per
  camera position. A tree works out its fade only when it draws.
- Foliage objects are tested against their cell's level inside the cull. An object that does not draw
  leaves there, before the static distance levels and before its parts are sorted into draw groups.
  It does not count as drawn or visible, and its material's program does not run. Wireframe and
  simple shading skip this test and show every foliage object the cull keeps.
- Shadow casters are tested against the cascades on several threads. The draw lists are still built
  in a fixed order.

The distance levels do most for a far view. Over Dreaming City, 37 million triangles draw instead of
263 million at full detail. **Full detail** draws every static object at full detail, so a far view
costs more with it on.

Foliage is most of what a far view holds. Over the EDZ about 452,000 foliage parts are in view and
about 11,000 of them draw. The rest leave inside the cull. The cull of an EDZ or Dreaming City
overview orbit takes about 2 ms. Foliage keeps its distance levels in **Full detail** too.

## Garbage collection

.NET pauses the window thread for each garbage collection. Each generated scene label lives on its
object, not in a side table, so a collection does not walk one entry per object. Over the EDZ a
collection during a pan takes 2 to 4 ms.

A moving frame allocates little, so collections are rare. Over the EDZ a panning or orbiting frame
allocates about 0.5 MB on all threads:

- A new backdrop bubble reuses the arrays of the cull grid's previous shown list.
- Each foliage payload keeps its band curves until the foliage detail changes.
- A line stream grows its buffers by half again, so a growing marker set reallocates rarely.
- Material evaluation reuses its per-thread input copies.
- A material program writes its constants and samplers into the buffers of the last frame's result.
  Each material keeps its own copy of the constants it last bound.
- Local lights keep the light record of each light row.

Studio uses the default .NET collector. The server collector and a larger first generation both
make each pause longer.

At the end of a map load, while the loading screen still shows, Studio runs one blocking collection
of generations 0 and 1. It moves the load's last objects into the old generation, so the first
collection while moving is short: usually 4 to 6 ms, about 85 frames in. The load collection costs
about 50 ms on the EDZ and on Dreaming City. Studio does not run a full compacting collection there,
because it takes seconds.

## The first frames after a load

.NET first runs new code in a quick, unoptimized form. After enough calls, an optimized form
replaces it in the background. Frame code runs once a frame, so with the default settings the first
15 to 30 frames after a load run the quick form and take 10 to 30 ms longer each. Studio starts
counting calls at once and replaces a method after 5 calls. The two settings are
`TieredCompilation.CallCountingDelayMs` 0 and `TieredCompilation.CallCountThreshold` 5 in
`SunriseStudio.App.csproj`. Over the EDZ the first 20 moving frames take about 1.0 s, and over
Dreaming City 0.66 s.

Studio keeps the quick form on. Turning it off makes every later frame 5 to 15% slower. Precompiled
code does not speed up the first frames.

## Exposure without stalls

Automatic exposure reads the frame's brightness back from the GPU without waiting. Busy readbacks stay
queued. When all three slots are busy, the new sample is skipped instead of overwriting an unread one.
A first frame that asks for exposure still waits, so the first image is right. A blocking read costs
several milliseconds a frame. The queued read costs a fraction of one.

## Loading in parallel

- The scene plan decodes shared textures in parallel, and the catalog decodes different blocks at once.
- Mesh buffers are created on a worker while the window thread indexes the scene.
- Textures and shared buffers are created on a worker while the window thread builds materials.

The gain comes from overlap: the worker creates GPU resources while the window thread does other
work. Creating buffers on several threads alone does not help.

## Placement edits

A placement-only edit moves the loaded objects instead of reloading the map. The scene, the GPU
uploads, the camera and the selection stay. Move, rotate and scale edits take this path.

1. Studio compares each changed tag with the bytes the map was decoded from. Every changed byte must
   be a placement field that a decoded row reads.
2. It reads the new values with the loader's own row readers. It moves the matching instances,
   markers, lights, effects and decorator records.
3. It recomputes the native draw constants and bounds of the moved parts only.

The first frame after a move rebuilds the culling grid and the marker lines. On a large map a moved
object takes a fraction of a second. A full reload takes several seconds. Most of the remaining time
is compiling the object edit.

An open asset tab is read again only when the change touched a tag it read. Collision updates the
same way. See [Static collision internals](/docs/sunrise-studio/collision-internals/).

### What still reloads

A change reloads the map, with the editor still in view, when:

- a changed tag is not placement data, changed size or changed its decoded structure;
- a changed byte is not a placement field;
- the placement anchors a squad, is a reflection probe, or owns decoded content below it;
- the placement's effects cannot be matched to it;
- a moved part is water, terrain, reads per-object fog or uses a preview binding;
- Studio does not know which tags changed.

A reload of the open map keeps the decoded meshes and their GPU uploads, and the textures it already
created.

## Choosing what is already open

Choosing the open map, mission or asset again reads nothing and does not reload. A delta row in the
**Changes** tab opens its asset the same way, so choosing it again costs nothing.

## While a game is attached

Studio draws at most 30 frames a second while a game is attached, and 10 when its window is not
focused. **Loaded bubbles only** uses the cached visibility pass, so the per-frame cull skips other
bubbles without a lookup. [The live link](/docs/sunrise-studio/live-link/#performance) has the game
side.
