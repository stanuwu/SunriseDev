---
title: "Guardians"
description: "View the Titan, Hunter and Warlock bodies with a face, armor and a weapon, and export the whole guardian to Blender."
weight: 217
group: "Guides"
---
The **Guardians** category shows a player body with a face, armor and a weapon. You pick each part,
and Studio puts the guardian together. You can export the whole guardian to Blender.

The game builds a guardian from character data, not from one package asset. Studio reads the same
tables, but much of the mapping is assumed. [May be inaccurate](#may-be-inaccurate) lists it.
[What is WIP](#what-is-wip) lists what is known to be wrong.

## Open a guardian

1. Open the **Assets** tab of the asset browser.
2. Choose **Guardians**, in the WORLD group.
3. Click **Titan guardian**, **Hunter guardian** or **Warlock guardian**.

Each row is one class body. The class picks the body. Race and gender do not.

A guardian opens in the class's placeholder armor, the galaxy pattern the game shows when you
preview gear. Each class has its own placeholder set. The hands always draw, for the chosen gender.

The placeholder helmet hides the face. To see it, turn off **Show helmet** or set **Helmet** to
**None**.

## What the viewer shows

The model is on the left. The tabs on the right are **Guardian**, **Parts**, **Materials** and
**Related**. The **Guardian** tab holds every choice. The other tabs work as they do for any
entity.

A change rebuilds the guardian in the background. Studio reads the tables and the body rig once, so
later changes are quicker. **Back** and **Forward** keep your choices.

With a weapon, the guardian opens holding it, in the stand pose the game picks for that weapon type.
The pose holds on its first frame. Press play in the clip panel to run it; the clip list names it
**Weapon hold pose**. With no weapon, the guardian opens in its bind pose.

The face always shows the head's neutral pose, in the bind pose and in every clip. Each head
carries this pose in its own data. Without it the head mesh looks wrong: on Human and Awoken heads
the eyes stare and the lips part, and on Exo heads face plates stick out.

The top of the **Guardian** tab has these controls:

| control | effect |
|---|---|
| **Class** | opens the Titan, Hunter or Warlock body with the same choices |
| **Show helmet** (eye icon) | draws the helmet and hides the head parts; off shows the head. Hoods follow it; see [Hoods](#hoods) |
| **Export to Blender** (export icon) | exports the whole guardian; see below |

**Notes**, at the bottom of the **Guardian** tab, lists each part that could not load or skin, and
why. Such a part is left out or stays in its rest pose.

## Change the body and face

| choice | what it picks |
|---|---|
| **Race** | Human, Awoken or Exo |
| **Gender** | Male or Female |
| **Face** | a face preset, **Face 1** to the last one |
| **Hair** | a hair style of the face, **Hair 1** to the last one |
| **Markings** | face markings, or **None** |
| **Colour 1** to **Colour 6** | one colour list each, numbered from 1 |

A drawn helmet hides these parts; see [Open a guardian](#open-a-guardian).

Studio also draws **Head** and **Eyebrows**. Neither has a choice of its own. Studio assumes
Colours 1 to 3 tint Head, Colour 4 Hair, Colour 5 Eyebrows and Colour 6 Markings. Exo has no
Eyebrows and no Colour 5.

The **Hair** and **Markings** pickers are in the **Head** section. Each head part has a second
lookup in the game data. What it is for is unknown, so Studio does not draw it.

A colour list the race does not have is hidden.

A face, hair or colour number stays valid when you change race or gender. Studio moves it to the
last entry of the new list when it is past the end.

## Equip armor and a weapon

1. In the **Guardian** tab, open a slot: **Helmet**, **Gauntlets**, **Chest**, **Legs** or **Class
   item**.
2. Type in the search box to narrow the list.
3. Click an item. **Default** picks the class's placeholder.

**Default** is the first row of every armor slot. Hover it to see which item it is. Only the
**Helmet** slot also has **None**, which takes the helmet off. The other slots always draw an item.

Each slot lists every armor item of that slot, from the **Armor** category. Studio cannot tell an
item's class yet. So a Titan can wear a Hunter item, and the result may look wrong. Each row shows
the item's tag on the right. The open icon next to a slot opens that item. Hover the **(!)** mark
after it to read that item's notes.

Each armor piece shows with the item's default dyes. A female body uses the female model of a
piece when it has one. Inside one model, Studio draws only the parts made for the chosen gender, as
the game does.

A cloak, mark or robe holds more than one copy of its cloth. Studio draws only the copy the game
draws, so the cloth shows once, on the body. The Blender export holds that one copy too.

### Hoods

Some armor has a hood that the game shows only while the helmet shows. Most Hunter cloaks have one.
A few chest, leg, gauntlet and helmet items have one too. Some Hunter vests and cloaks also have
parts that show only while the helmet is hidden, such as a hood worn down.

Studio follows the game. With a helmet drawn, the hood shows. With **Show helmet** off, or the
**Helmet** set to **None**, the hood is hidden and the hood-down parts show. The game data names
this switch only by a number, so its name is unknown.

The **Weapon** picker, the last row, lists the **Weapons** category. **None** removes the weapon.
The weapon is held in the right hand. There is no stowed or holstered weapon.

The body takes the weapon's stand pose. Each weapon names an animation tag, and the game's tag tree
turns the tag into a pose. Studio runs the same tree, so the pose follows the weapon type:

| weapon types | pose |
|---|---|
| Rifles of every kind, submachine guns, shotguns, machine guns, grenade and rocket launchers | both hands on the weapon at chest height |
| Hand cannons, sidearms | one hand, the weapon pointing down by the leg |
| Most swords | the same one-hand pose; the blade points forward at hip height |
| Bows | a crouch; see [What is WIP](#what-is-wip) |

A few items of a type use another type's pose, because their own tag says so. In the two-hand pose
the fingers take the rig's resting curl. The one-hand pose sets its own fingers, and its right hand
stays almost open; see [What is WIP](#what-is-wip).

## Export to Blender

The **Export to Blender** icon at the top of the **Guardian** tab exports the dressed guardian as a
view-only bundle. [Export a guardian](/docs/sunrise-studio/blender-round-trip/#export-a-guardian)
has the steps and lists what the bundle holds.

## What is WIP

These are broken or only partly working. In Studio, the bow pose, cloth and hand notes end in (WIP).

| what | state |
|---|---|
| Bow pose | the game's tag tree picks a crouched clip for bows, though Studio asks for standing; why is not understood |
| One-hand grip | hand cannons, sidearms and swords sit in an almost open right hand; the clip's fingers are nearly straight, and the game layer that closes the hand is not found |
| Cloth: cloaks, marks, robes | drawn in its rest shape, skinned to the body; the game's cloth simulation is not run, so it does not swing or fall |
| Hand skin colour | not applied |

## May be inaccurate

| what | state |
|---|---|
| Awoken, Exo and Female rows | the row names are proven; only Human male is checked in the viewer |
| Part names: Head, Hair, Eyebrows, Markings | assumed; Eyebrows is named from how it looks |
| Which part each colour tints | assumed |
| **Show helmet** | which mode the game uses where is assumed |
| Hoods and gender parts | traced in the game code, not seen in a running game; each armor part shows for the chosen gender and helmet state |
| Which cloth copy draws | traced in the game code, not seen in a running game; the game may switch copies at run time |
| Neutral face | proven from the data, for every face of every row; the game code that applies it is not traced |
| Weapon place in the hand | the third-person art is assumed to match first person |
| Hold pose | Studio runs the game's tag tree in the combat stance, on the ground; the result is not compared with the game |
| Placeholder armor close to the camera | draws near black; whether the game draws it the same is not checked |

## Not built yet

| what | state |
|---|---|
| Second lookup of each head part | not drawn; its use is unknown |
| Face motion: blinks, talking, eye movement | not played; the face holds its neutral pose |
| Armor lists | no class filter |
| One-bone class item model, such as the Hunter cloak and Warlock bond placeholders | stays at the origin, with a note; the placeholders are a 1 cm box whose shader writes zero, so they likely show nothing in game |

## New and Clone

**New** and **Clone** in the Guardians category are gray. The tip says: "Guardians need character
data Studio cannot write."
