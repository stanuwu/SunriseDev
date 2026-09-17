---
title: "Finding things in game"
date: 2026-09-17
description: "Use the in-game tools to find the slot, squad, line or goal you need."
weight: 100
---
A mission module lists thousands of slots. This page shows how to find the one you need: which
squad stands on that ledge, which trigger sits at that door, which cue says that line. The in-game
tools come from `src/server/ui/activity_host/` and `src/core/ui/hud/` in the Sunrise source.

## The tools at a glance

| tool | where | what it tells you |
|---|---|---|
| World window | Activity Host page, tick **World** | every SDK page below, with world markers |
| Current Status overlay | HUD page | the bubble and slice set you are in, and the closest spawn |
| Mission Script overlay | HUD page | each script's status, phase and last error |
| Logs page | Core group | the log, with a filter |
| The mission module | `Sunrise/sdk/lua/missions/*.lua` | every key, with names, types and text |

## Open the World window

1. Press **Insert**.
2. Open the **Activity Host** page.
3. In **Instance**, pick your activity. An active, linked instance is picked for you when it can
   be.
4. Under **Windows**, tick **World**.

The World window has a page list on the left. Each page shows a one-line summary at the top.

| page | use it to |
|---|---|
| Squads | find and test-place squads; see their spawn points |
| Idles | find NPC idle sensors and their states |
| Combatants | find actors; try their animation sequences |
| Devices | find doors, lifts and switches; move them |
| Triggers | find trigger volumes and draw their shapes |
| Objects | find any slot; fire a trigger; see positions |
| Scenes | find scenes in the current state; start one |
| Dialogue | find voice lines in the current state; play one |
| Directives | find goals; show or hide one |
| Objectives | reset objectives; advance tasks |
| Cinematics | play sequences and cinematics |
| Engagement | send an engagement body |
| Public event | start a public event |
| Occupancy | set an occupancy condition |
| Lifetime | set the lifetime state |
| States | list states and regions; move to one |
| Mission state | read your variables and timers |
| Positions | list package positions nobody's slot claims |
| Behaviors | list compiled behavior roots; read only |
| Script | your script's file, status, error, and **Reload script** |

A button on these pages sends the same kind of request a script would. Use them to test an idea
before you write it.

## Draw things in the world

The Squads, Objects, Devices, Triggers and Positions pages can draw markers in the world.

1. Tick **Draw in world**.
2. Pick what to draw in **Show**:
   - **Ticked rows**: only rows whose **Draw** box you ticked
   - **All rows**: every row on the page
   - **Within radius**: rows near the **camera**
3. Open **Render settings** to change the glyph, size and colors, and tick **Always label** to name
   every marker.

- Without **Always label**, a marker shows its label when you look straight at it.
- **Tick listed** ticks every row the current filter shows. **Untick all** clears them.
- A squad marker label reads `<name> point N | 0xLIST[ordinal]`.
- A trigger marker label is its name, or `trigger XXXXXXXX`.

Walk or fly to a spot, set **Show** to **Within radius**, and read the labels around you.

## Find a squad

1. Open **Squads**.
2. Tick **Current state only** to see just the squads of the state you are in.
3. Type part of a name in **Search**. The search also matches ids, tags and point coordinates.
4. Tick **Draw** on a row and **Draw in world** to see its spawn points.
5. Select the row. **Place this squad** lists each point as `point N 0xLIST[ord] (x, y, z)`.
6. Press **Place squad** to test it.

The **name** column is the slot name. The Lua key is that name in upper case:

| column shows | Lua key |
|---|---|
| `sq_cath_boss` | `mission.Squad.SQ_CATH_BOSS` and `mission.Slot.SQ_CATH_BOSS` |

If the name is used by more than one object, the key has the object tag at the end, for example
`O_CIV_0_80B4A6CB`. Search the module for the name to find the exact key.

The squad's members are type-2 slots named after it: `SQ_CATH_BOSS_BOSS`.

## Find a trigger

Player triggers (type 31) point at trigger volumes (type 60).

1. Open **Triggers**. It lists the volumes, with a **status** per row.
2. Hover a row to see its key, index, shape, and its bounds.
3. Tick **Draw** and **Draw in world** to see the shape.
4. To test the trigger itself, open **Objects**, search for the name, select the type-31 row, and
   press **Fire trigger** under **Actions**.

Trigger slot names often start with `pt_`. The volume often has the same name.
`mission.TriggerVolume.<NAME>` holds the volume row with its box corners.

## Find a door or lift

1. Open **Devices**. It is the Objects list limited to type 23.
2. Select a row. Under **Actions**, pick a **Channel**, move **Normalized value**, and press
   **Set channel**.
3. Watch which thing moves.

Device names often start with `d_`. The Lua key is `mission.Slot.D_...`.

## Find an object and its position

1. Open **Objects**.
2. Type in **Search**. Tick **Has a place** to hide rows with no position.
3. The **Kind** column shows the slot type. The **Position** and **Shape** columns show what the
   row is linked to.
4. Select a row. The **Position** section shows `x, y, z`, and whether the object is live.
5. **Technical details** shows the object and slot rows, key, name hash and tags.

The **Reload** button next to the package name re-reads the world data. It does not reload your
script.

## Find a voice line

1. Open **Dialogue**. It lists the dialogue sensors of the current state.
2. Open a sensor. Each cue shows `Cue N`, its definition hash and its line texts.
3. Press **Play cue** to hear it.

In Lua:

```lua
local sensor = mission.Slot.M_DIALOG_SENSOR_80B9AF4B
local cues = mission.DialogueCue.M_DIALOG_SENSOR_80B9AF4B
context:slot(sensor):play_dialogue_cue{cue = cues.CUE_14}
```

You can also search the text in the module. `mission.DialogueCueVariants.<sensor>[N]` lists the
lines of cue `N`.

## Find a goal

1. Open **Directives**. Each entry shows its title, description, hash, element and slot.
2. Press **Show** to see it on the HUD, and **Hide** to clear it.

In the module, `mission.Directive` keys come from the title. A repeated title gets the name hash:
`RENDEZVOUS_WITH_HAWTHORNE_1DD5B5F6`. Match the hash from the page to the key. The `slot_row` of
the entry names its directive sensor; the sensor's key usually starts with `M_DIRECTIVE_SENSOR_`.

## Find a scene

1. Open **Scenes**. It lists only the current state.
2. The **scene** column shows the slot name and object. **linked squad** shows the squad it uses.
3. Press **Advance** to start it.

The Lua key is `mission.Scene.<NAME>`, the same key as its slot.

## Find an NPC idle

1. Open **Idles**. Search by name, object or slot.
2. Pick a **State** from the list and press **Start**.

The state list shows hex names. In Lua the entry is
`mission.PerformanceState.<SENSOR>.STATE_<HEX>`.

## Find an actor animation

1. Open **Combatants**. Select an actor.
2. Under **Animation sequence**, pick a **Sequence**. The list shows `symbol [0xKEY, kind N]`.
3. Press **Play sequence**.

In Lua, `actor:sequences().<SYMBOL>` or `actor:sequences().KEY_<8 hex>`.

## Find where you are

Turn on the **Current Status** overlay on the **HUD** page. It shows:

| line | meaning |
|---|---|
| Activity | the running activity |
| Bubble | `index 0xHASH name [host region]` |
| Slice set | `region state N` |
| Closest spawn | the spawn set of the spawn point nearest to you: its name hash, its name, and the distance |

The **region** number is what `event.region_index` reports. Match it on the **States** page, which
lists every state with its region. There, **Select** moves you to a state. Picking a state the
client does not hold arms a teleport.

The `Closest spawn` hash is a spawn set name hash. That is the value `restart_checkpoint` takes as
`spawn_set_hash`. Stand where the party should restart and read it.

## Read your variables

Open **Mission state**. It shows the revision, the phase, every variable with its value, and every
timer with its deadline and sequence. It is read only.

A script cannot print. Write what you want to see into a variable instead:

```lua
context:set_variable("debug.last_trigger", event.slot and event.slot.name or "none")
```

## Search the module text

The mission module is plain text. Search it with your editor, or from PowerShell:

```powershell
Select-String -Path "Sunrise\sdk\lua\missions\mission_deadzone_*.lua" -Pattern "PT_MINE"
```

Useful searches:

| search for | finds |
|---|---|
| `type = 31` | every player trigger row in `mission.slots` |
| `type = 23` | every device |
| `M_DIRECTIVE_SENSOR` | the goal sensors |
| `M_DIALOG_SENSOR` | the dialogue sensors |
| a line of dialogue | the cue that says it, in `DialogueCueVariants` |
| a goal title | its key in `mission.Directive` |
| `STATE_` | the states and their `region_index` |

Always check the `type` field of the row you pick. The methods refuse a slot of the wrong type.

## Look things up from a script

When the tools are not enough, walk the live SDK from a script and store the answer. See
[The live SDK views](/docs/mission-scripting/live-sdk-views/).

```lua
on_start = function(context, state)
    local slots = context.sdk.slots
    local triggers = 0
    for row = 1, slots.count do
        if slots:at(row).slot_type == 31 then triggers = triggers + 1 end
    end
    context:set_variable("debug.trigger_count", triggers)
end,
```

## What the tools cannot do

- There is no copy button for ids or Lua keys. Type the key, or search the module.
- There is no readout of your own coordinates. Use **Closest spawn**, and **Within radius** from
  the camera.
- There is no "you are inside this volume" indicator. Arm the trigger and watch
  `on_event_player_trigger`.
- There is no teleport to a marker. **States > Select** moves you to a whole state.
