---
title: "Create an exotic weapon"
description: "Model a weapon in Blender, export it with the add-on, and build an exotic weapon from it."
weight: 217
group: "Guides"
---
An exotic weapon has its own archetype, an exotic intrinsic, a unique normal trait and a catalyst.
Studio copies an installed base weapon, assigns the art exported from Blender, and compiles the
intrinsic and trait from new behavior graphs.

## Before you start

- Install the [Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin). See
  [Edit an asset in Blender](/docs/sunrise-studio/blender-round-trip/#install-the-blender-add-on).
- Open a project.
- The importer supports only the Tommy's Matchbook frame.

## Model the weapon

Point the weapon along +Y, with +Z up. Studio turns it to the game's axes on import.

Split the meshes into four art parts. Each part needs at least one mesh.

| art part | holds |
|---|---|
| **Main assembly** | the main weapon geometry |
| **Moving assembly** | the separate moving assembly |
| **Detail assembly** | separate detail geometry |
| **Helper geometry** | the frame's auxiliary art part |

The animated profile uses exactly five bones. In the **Sunrise** > **Weapon** panel, assign each
bone a different **Control slot** from 0 through 4. Each vertex must have one bone weight of 1.
Mixed weights and morph targets are refused. Materials follow the rules of an original asset. See
[Import an original Blender asset](/docs/sunrise-studio/original-asset/#how-materials-convert).

## Add animations and particles

For each Blender action, choose its **Weapon event** in the **Weapon** panel. **Fire** and
**Reload** replace those native actions. **Idle**, **Inspect** and **Named clip** add native named
animation requests. They have no automatic input binding. **Named clip** also accepts a **Clip
name**. Blank uses the action name.

You can preview every imported clip in Studio. You can also assign any imported clip to **Fire**
or **Reload** on the Weapon page. The other native inputs remain fixed.

A particle emitter needs a **Weapon event**. It needs no art-part assignment. These events work in
game:

| event | plays |
|---|---|
| **Muzzle (every shot)** | at the emitter on every shot, in place of the base muzzle flash |
| **Eject (every shot)** | at the emitter on every shot, in place of the base shell casings |

Use at most one Muzzle and one Eject emitter. Both bursts follow the first-person gun. Studio moves
the weapon's barrel point to the Muzzle emitter, so the tracers start there. The base weapon's
projectile stays.

Each emitter is a point burst from a flat emitter surface:

- Set the emission start and end to the same frame.
- Use 1 to 4,096 particles and a positive lifetime.
- Use normal velocity with no random velocity, object velocity, lifetime randomness or gravity.
- Set Blender particle size to `0.035` and size randomness to zero.
- Parent the emitter to the weapon rig or a bone when it should follow that attachment.

The native burst keeps its fixed sprite material and program. The count, lifetime, speed and
position come from the export. Blender's instance mesh is a preview aid.

Not every event works yet:

| event | state |
|---|---|
| **Reload** | plays on the gun while it reloads, delayed by the emitter's frame; may not work in game |
| **Fire**, **Idle**, **Inspect**, named clips | clip bursts; WIP: they do not show in game, so the import skips them |

## Export from Blender

1. Keep one weapon and its rig, actions and emitters in the scene. The exporter reads the scene.
2. In the 3D view sidebar, open the **Sunrise** tab and find the **Weapon** panel.
3. Select each visual mesh and choose its **Art part**. Assign the rig controls and action events.
4. Set **Metres per unit** to the length of one Blender unit in meters. The default is 1.
5. Press **Export weapon**. **File > Export > Sunrise weapon** does the same.
6. Pick a file name in a folder outside the Studio project, and export.

The add-on writes three files with the same name. It writes all three or none.

| file | holds |
|---|---|
| `<name>.glb` | the scene, with its buffers and images embedded |
| `<name>.sunrise-original.json` | particle-system source data |
| `<name>.sunrise-weapon.json` | art parts, axes, scale, controls, actions and emitter bindings |

Keep the three files together. Studio reads all of them.

If the export stops, it names the problem:

| message | fix |
|---|---|
| Assign an art part to *mesh* | choose an **Art part** for that mesh |
| The supported frame needs main, moving, detail and helper geometry | give each of the four parts a mesh |
| Export working assets outside the Studio project | export to a folder outside the project |
| Export one weapon armature at a time | keep one weapon armature in the scene |
| Assign every bone a control slot | assign slots 0 through 4 once each in the Weapon panel |

## Create the weapon in Studio

1. Open **Weapons** in the browser. Press the **New** icon on the list header, or on the toolbar of
   an open weapon.
2. **Base** shows Tommy's Matchbook, the only supported layout.
3. Type the **Name** and the **Weapon type**, such as Induction Rifle. A stock type name such as
   Auto Rifle keeps that type's inventory trait. A new name gets its own type identifier.
4. Type the **Intrinsic name**, the **Trait name** and the **Catalyst name**.
5. In **Blender asset**, choose the `.glb` file.
6. Read **Imported surfaces**. Every surface must read `ready`, `absent` or `skipped`. **Clip
   bursts** reads `skipped` with a **WIP** tag: they do not show in game.
7. Open the **Intrinsic** section. Under **Intrinsic behavior**, press **Edit nodes**, build the
   perk's effect, then press **Done**. See
   [Edit perk behavior](/docs/sunrise-studio/perk-behavior/#work-with-nodes).
8. Do the same in the **Trait** section, under **Trait behavior**.
9. **Catalyst bonus perk** starts on **New graph**. Fill **Catalyst perk name**, and edit
   its nodes under **Catalyst perk behavior**. **Pick existing** instead picks an installed perk
   with normal presentation.
10. Set the catalyst's stat bonuses and fill the optional fields below.
11. Press **Create exotic weapon**.

The optional fields sit in sections: **Weapon**, **Intrinsic**, **Trait**, **Catalyst**, **Art and
import** and **Advanced**. Click a section's header to open it. **Weapon** and **Art and import**
start open.

| optional field | effect |
|---|---|
| **Description** | the weapon's flavor text |
| **Intrinsic description**, **Trait description**, **Catalyst description** | the perk and catalyst texts |
| **Catalyst perk description** | the new bonus perk's text |
| **Weapon icon (PNG)**, **Intrinsic icon (PNG)**, **Trait icon (PNG)** | private artwork for the weapon and its two perks |
| **Catalyst icon (PNG)**, **Catalyst perk icon (PNG)** | separate artwork for the catalyst item and its bonus perk |
| **HUD silhouette (PNG)** | a 137 x 76 transparent weapon silhouette for the gameplay HUD; may not work in game |
| **Catalyst stat bonuses** | stat changes the catalyst gives; it starts with two; **Add stat** adds one |
| **Collections** | the Collections page for the new collectible; it starts on the base weapon's page |
| **Advanced** > **Package and sockets** | the **Package ID**, and the socket that holds each role |

Names are at most 200 characters. Descriptions are at most 4,000 characters.
The weapon icon is a 96 x 96 PNG used as drawn. The intrinsic, trait, catalyst and catalyst perk
icons are symbols: a PNG of any size with a transparent background. Studio uses the symbol's shape
and draws the native style around it:

| icon | style |
|---|---|
| **Intrinsic icon** | white symbol on the gold exotic disc |
| **Trait icon**, **Catalyst perk icon** | white symbol on a clear background |
| **Catalyst icon** | gold symbol on the template catalyst's panel |

Each perk icon gets a 96-pixel and a 40-pixel image, because compact perk rows show the small one.
Blank icon fields keep the template artwork or leave a fresh sandbox perk without an icon.

Create runs in the background. It is one undo step. When it is done, the new weapon opens on its
**Weapon** page. [Investment editing internals](/docs/sunrise-studio/investment-internals/#a-new-exotic-weapon)
lists every record it makes.

When Create finishes, Studio also gives the weapon its own copies of the records only the base
weapon uses: its weapon config and class record, its art configs and effect, its gear key, and its
ornament and catalyst socket types. The catalyst gets its own plug category, and the model stops
using the base weapon's plated textures. This is a second undo step. For a weapon without these copies,
press the build icon, **Copy shared base records into this project**, on the Weapon page.

Studio assigns exotic presentation to the intrinsic and normal presentation to the unique trait
and catalyst bonus. Each authored socket keeps only its new plug. The ornament socket keeps only
its default plug, because the base weapon's ornaments carry its art. The catalyst keeps its native
exotic item tier. These display choices do not change the behavior graphs.

## The Weapon page

A weapon opened from the browser shows its model beside the **Investment** and **Weapon** tabs. The
model sits on the left, or on top when the panel is narrow. If Studio cannot read the weapon's art,
the weapon opens without a model. Hover **Preview notes** to see why.

The **Weapon** page shows the weapon's name, type and description, and links to its parts.

Hover an icon to see its name.

| section | buttons |
|---|---|
| **Model** | the cube icon opens the weapon scene, and shows only after **Open as asset**; the import icon reimports the Blender export; the build icon copies the records only the base weapon uses; the spark icon applies an export's Muzzle, Eject and Reload emitters; **Model parts** opens each part |
| **Animation** | **Fire** and **Reload** pick their gameplay clips; the export icon starts an arms rig for Blender (may not work in game) |
| **Effects** | the rows below |
| **Perks** | one button per perk, named after it, opens its behavior graph |
| **Catalyst** | the open icon opens the catalyst item |

The import, build and spark icons and the **Effects** section show only with the project open, for
a weapon the project built from a Blender export.

The **Effects** section has one row per effect:

| row | state |
|---|---|
| **Muzzle and Eject** | works in game |
| **Reload** | may not work in game |
| **Tracer colour** | WIP, turned off: in game the colour did not change and tracers broke while moving; **Reset** removes an older one |
| **Clip bursts** | WIP, does not show in game; listed only for a weapon that still has them |

The import icon, **Reimport the Blender export**, applies a new export to the same weapon.
Geometry, UVs, textures, motion and particle emitters may change. Studio deletes the records of an
emitter you removed. Keep the material count, art parts and named clips. Links made in Studio after Create, such as the
weapon's own records and sounds, stay in place.

To change the perks later, open their behavior graphs from this page. To change the item fields,
press **Edit** on the weapon's toolbar. Item edits may not work in game.
See [Create items and vendors](/docs/sunrise-studio/create-items/#edit-an-item).
That workflow also [assigns a custom PNG icon](/docs/sunrise-studio/create-items/#assign-a-custom-icon).
It also [names the frame and tunes gameplay](/docs/sunrise-studio/create-items/#tune-gameplay):
fire rate, damage and magazine size. Weapon family and the gameplay tables may not work in game.

The model starts in the weapon's bind pose. Use its animation picker to search and play any clip
linked to its presentation rig, including installed clips and every named clip you export. The
assembled weapon stays in view while you change clips.

Playback does not change gameplay bindings. A named clip can play in the scene without an automatic
input binding. The **Fire** and **Reload** assignments are project changes and support Undo.

The native weapon links identify its animation owner. The project also keeps the authored perk
graphs and a creation receipt. The receipt identifies the catalyst after a rename and records the
imported surfaces.

## Replace the weapon's sounds

Open the weapon's **Weapon** page and expand **Sounds**. It shows with the project open, for a
weapon the project added. It lists the sound events the weapon plays
through its own records and the base weapon's. Shared selector configs hold rows for other weapons.
Only this weapon's own row is listed. A name such as `ar_ex_tommy_reload3` comes from the
base weapon's animation sound table. Other rows show the record that holds the event.

1. Press the import icon next to a sound.
2. Choose a WAV file: mono or stereo, 16-bit PCM, any sample rate.
3. Studio builds a sound bank and an event of the weapon's own. The bank keeps the base event's
   whole sound tree: containers, loops, volumes and routing. Every sound in it plays your WAV.
   Studio points the weapon at the new event and copies the base weapon's records, so other weapons
   keep their sounds.

An automatic weapon's fire sound loops while the trigger is held, one shot per round at the weapon's
fire rate. Releasing the trigger plays a tail. To give the tail its own sound, put
`NAME.release.wav` beside `NAME.wav`. Otherwise the tail plays your shot. Stock shots are stereo and
peak at 0 dBFS, so a quiet or mono WAV sounds quieter in game. Replacing a sound again rebuilds the
weapon's bank in place. The game keeps the sound in memory.

## Fit the first-person hands

The base weapon's first-person animations place the hands and the aiming eye at fixed points. Studio
does not move them, so model the weapon around them. For a rifle, in Blender meters (+Y forward):

| point | position |
|---|---|
| right palm, inside the pistol grip | origin |
| trigger | 5 cm forward, 3 to 6 cm up |
| left palm, on the magazine or foregrip | 13 cm forward, 2 cm up |
| bore line | 11.4 cm up |
| aim line, the screen center while aiming | 17.15 cm up, parallel to the barrel |

Keep the sight's opening on the aim line and nothing solid across it.

The base weapon's Fire and Reload also move the hands. Without arms actions, Studio keeps that hand
motion and replaces only the weapon's own motion, so time the **Reload** action to it. For the
supported frame:

- Give the Reload action 106 frames, one per native frame.
- Put the magazine on the bone mapped to control 2. From frame 14 to 64 the left hand carries it
  out, brings it back and pushes it home.
- From frame 73 to 80 the left hand pulls a charging handle back along the top left edge, from
  5.4 cm to 16.7 cm behind the grip, about 15 cm up. Put a handle there on the bone mapped to
  control 1, or author your own arms.

## Author the first-person arms

Authored arms may not work in game.

The arms can have their own motion for each weapon event.

1. Create the weapon once, then open its **Weapon** page.
2. Under **Animation**, press the export icon, **Export first-person arms**, and save the file
   outside the project. It holds the arms and the current Fire and Reload hand motion.
3. In Blender, open the weapon scene. In the **Weapon** panel, press **Import first-person arms**
   and choose that file. The arms appear around the weapon with the actions `Arms fire` and
   `Arms reload`.
4. Edit the arms actions. **Preview** *event* plays the weapon and arms actions together.
5. Delete an arms action to keep the base weapon's hand motion for that event.
6. Export the weapon. The export also writes `<name>.sunrise-arms.glb`. Keep it beside the GLB.
7. On the **Weapon** page, press the import icon, **Reimport the Blender export**, and choose the
   GLB.

| rule | why |
|---|---|
| An arms action lasts as long as the weapon action with the same event. | Both play on the same native frames. |
| The bone `fp_02_...` is the view. Move it to move the weapon in view. | The game keeps this bone where the base clip has it and places the weapon from it. |
| The game bends the elbows. | Only the shoulders, hands, fingers and view follow your keys exactly. |
| Keep each hand within arm's length. | Studio refuses a pose the game cannot reach. |

An arms action can belong to an added clip too. Give it the clip's event name in the **Weapon**
panel.

The base clip's sound and effect events stay on their frames. Studio cannot move them, so keep
the new motion's key moments near the base clip's.

## Limits

- The rig must fit the supported five-control frame, with one full bone weight per vertex.
- Emitters must fit the point-burst profile above.
- The export must hold exactly the four art parts, and the base weapon's art must have the same
  four.
- The axes are fixed: +Y forward, +Z up.
- Buffers and images must be embedded in the scene file.
- If the Blender files change while Create runs, Create stops. Export again if needed, then press
  **Create exotic weapon** again.
- If the project or the installation changes while Create runs, Create stops. Press **Create exotic
  weapon** again.
- The copied catalyst socket type keeps the base weapon's unlock flag.
- The base weapon's clip sound and effect events stay on their frames.

These parts are WIP:

- **Tracer colour** is turned off. In game the tracers kept the base colour and broke while moving.
- Clip bursts do not show in game. The import skips them.

These parts may not work in game:

- The **Reload** effect.
- Authored first-person arms.
- The **HUD silhouette**.
- **Weapon family** and **Gameplay values**.
- Some perk kinds. See [Edit perk behavior](/docs/sunrise-studio/perk-behavior/#limits).

## Related pages

- [Edit perk behavior](/docs/sunrise-studio/perk-behavior/) builds the perk graphs.
- [Create items and vendors](/docs/sunrise-studio/create-items/) creates other weapons, armor and
  plugs.
- [Investment editing internals](/docs/sunrise-studio/investment-internals/#a-new-exotic-weapon)
  explains the records an exotic weapon gets.
