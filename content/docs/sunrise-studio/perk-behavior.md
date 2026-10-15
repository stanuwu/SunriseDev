---
title: "Edit perk behavior"
description: "Build a new perk graph, or open an installed perk and save a patch."
weight: 216
group: "Guides"
---
A perk program is a list of conditions and effects. The game's code runs each operation. The graph
sets each operation's inputs, phase and order.

## Edit an installed perk

1. Open your installation. Open a project when you want to save changes.
2. Choose **Assets > Edit perk behavior...**, search by the perk's name or description, and press
   **Open node editor**. Or open the perk program in the **Perks** list and press **Edit** in the
   viewer toolbar.
3. Select a node to edit its supported inputs.
4. Press **Compile and save**. Its tip says the change may not work in game. For an installed perk
   it also says the change reaches every item with this perk.

The change is saved as a byte delta in the project. **Edit > Undo** restores the earlier bytes.
If another edit changes the same asset while a draft is open, saving stops. **Reload source**
drops the draft and reads the current project bytes.

Editing an installed perk may not work in game.

Some perks have no behavior program of their own. The picker says so and opens nothing. A node
with inputs Studio cannot decode stays visible and keeps its data.

## Create a behavior

1. Open the **Perks** list. Press **New** in its header, or **Clone** to copy a program.
2. Under **Start from**, choose **Blank graph** or **Pick existing**. Enter a name.
3. Choose **Activation**, then **Add node** to add the starting condition.
4. Choose **Effects**, then add the operation the perk performs.
5. Add a **Deactivation** condition if the effect should end.
6. Read the checks and press **Compile and create**.

**Pick existing** opens an installed or project program in the editor. **Clone** in a perk's
viewer starts with that program, also for a perk the project added. Create writes the copy as a new
entry. The source program is not changed. A program Studio cannot read is refused with "Uses
operations that cannot be compiled yet." **Package ID** sits under **Advanced > Package settings**.

No item uses the new program yet, and it may not work in game.

**New** in the **Weapons** list creates an exotic weapon. It creates two graphs and connects them
to their perk items, sockets and sandbox entries. See
[Create an exotic weapon](/docs/sunrise-studio/exotic-weapon/).

The exotic workflow can also create a third graph for the catalyst's bonus perk. The bonus has its
own name and sandbox identity. Choose **New graph** on **Catalyst bonus perk** to author it with
the same node editor.

## Work with nodes

Select a node to see its inputs. Drag a node to change the layout. **Earlier** and **Later**
change its order within a phase. **Undo** and **Redo** restore graph edits. **Frame all** fits
the graph into view. **Arrange** resets its layout.

A link shows which phase owns a node. It is not an execution path. The program stores the
conditions and effects as ordered lists.

### Conditions

A phase passes when any one of its conditions passes. Every condition has a **Probability**.

These conditions react to the perk itself, combat and the weapon:

| condition | what passes it | inputs |
|---|---|---|
| When activated | the perk enters the phase | probability |
| After a delay | the phase timer runs out | duration |
| On kill | the owner kills a target | only this weapon, weapon slot mask, minimum damage share |
| On kill credit | a kill is credited to a listed player | minimum and maximum damage share |
| On damage dealt | the owner damages a target | only this weapon, weapon slot mask, minimum damage share, damage above zero |
| On owner damaged | the owner takes damage | damage share, attacker distance, damage types, slot and part masks |
| On shot resolved | a shot hits or misses | only this weapon, slot mask, result |
| On reload | the active weapon reloads | only this weapon, flag tests, slot mask, recent kill window |
| On ammo picked up | ammo is picked up | weapon slot mask, ammo type mask |
| On aim change | aiming down sights starts or stops | aiming, not airborne, only this weapon |
| On finisher phase | a finisher reaches a phase | phase |
| On object picked up | the player picks up an object | pickup definition, two value ranges |
| On player spawned | the player spawns | spawn reason mask |

These react to items and abilities:

| condition | what passes it | inputs |
|---|---|---|
| On item readied | an item becomes active, for example a drawn weapon | only this item, slot mask |
| On item equipped | an item is equipped | only this item, slot mask |
| On item unequipped | an item is unequipped | only this item, slot mask |
| On item stowed | an item leaves its active or equipped state | only this item, slot mask |
| On item event | an item event per slot; "fired" is a guess | only this item, slot mask |
| On weapon counter tick | a weapon counter rises | only this item, slot mask |
| On weapon event 41 | a weapon event of unknown meaning | slot mask |
| On ability used | an ability in the mask is used | ability mask |
| On ability event 7 and 9 | other ability messages | ability mask |
| On ability gained, On ability lost | the owner gains or loses an ability definition | ability definition |

These react to named events and flags:

| condition | what passes it | inputs |
|---|---|---|
| On gameplay event | the perk receives an event hash | event hash, from the hashes installed perks use |
| On gameplay event (second stream) | the same, on a second message | event hash, from installed hashes |
| On incident | a world incident of a type | incident type and role, from installed values |
| On hashed message | a message with a hash | message hash, or Any |
| On tracked entry timer, On tracked object gone | an entry stored by **Register a tracked target** | tracked name, distance |
| On owner message | an owner message; "death" is a guess | none |
| On another player killed | another player is killed; raised for every other player | damage types, only with no other living teammate |
| On crouch change, On action state change, On flag 25 change, On flag 36 change | a flag changes to the chosen value | state |

And these combine or watch state:

| condition | what passes it | inputs |
|---|---|---|
| While a state holds | a property of the weapon is in range, tested on every update | property, minimum, maximum, hold time, invert, only while this weapon is active |
| ... while a state holds | the inner condition passes while the state test holds | the state inputs and the inner condition's inputs |
| Counter reaches a threshold | the perk counter reaches the threshold | threshold, reset level, minimum, maximum, and its rows |
| All groups pass | every group passes | its groups |

A slot mask has one bit per slot. 0 accepts any slot.

**While a state holds** offers the property names Studio can read from installed perks:
`super_active`, `is_thermal`, `is_arc`, `is_void`, `reloading`, `nearby_enemy_count`,
`melee_energy`, `equipped_item_magazine_fraction`, `is_guarding_with_sword` and
`melee_overcharge_state`. **None** skips the range test.

**Add node** lists four state-gated conditions in the main list. The rest are under **While a state
holds**: one for every condition that reacts to a single event.

A counter is a list of rows. Each row is a condition plus three inputs: what it does to the counter
when it passes (add, set or multiply), the value, and a window in seconds. Select a new counter and
use **Add row**. A row can be any condition that reacts to a single event, plain or state-gated.

**All groups pass** holds groups. A group passes when any of its conditions passes, or passed
within its window. Select a new **All groups pass** node and use **Add group**, then select the
group and use **Add condition**. Groups with a window must come before groups without one. The
checks say so if they do not.

The rows and groups of an installed node keep their layout. You can still edit their values.

### Effects

These change the weapon or the owner while the perk is active:

| effect | what it does | inputs |
|---|---|---|
| Change object property | writes a named property | target, property, value, arithmetic operation and restoration |
| Damage multiplier | multiplies damage by one plus the bonus | bonus, bonus against players, element mask, any element, only this weapon |
| Owner damage multiplier | multiplies the owner's damage; "damage taken" is a guess | multiplier, distance, damage types |
| Add labels to damage | adds a label to damage records | label, damage types |
| Add labels to item events | adds a label to item event records | label |
| Add ability modifier key | adds or removes a key on one ability | ability, modifier key, remove |
| Override projectile | writes an object definition into the weapon | object definition |
| Set weapon mode tag | sets a tag that while-state tests can read | tag hash |
| Add a named flag to items | adds a flag that properties can read | this item, other slots, flag hash |
| Set a channel hash | sets a hash on a component channel | target, channel, hash, owner too |
| Set radar values, Raise the radar counter, Set radar byte | change the radar | values |
| Add to a team stat | adds to the owner's team stat | stat name, amount |
| Set three weapon values, Set two weapon bytes, Set slot weapon byte, Push a weapon override byte, Set weapon element choice, Raise a weapon flag count | set weapon values of unknown meaning | values |
| Enable sword guard, Set owner flag, Set slot flag | turn on a behavior | none |
| Adjust ammo drops | changes drop chances | primary, special and heavy interval, chance and repeat modifiers |
| Extend timers on event | a passing condition adds seconds to running timers | seconds, cap, and its conditions |

These act once, when the perk activates:

| effect | what it does | inputs |
|---|---|---|
| Spawn an object | creates an object, removed when the perk ends | target, object definition, keep on removal, removal message, counter parameter |
| Spawn an object driven by a value | creates an object and pushes a value into it | target, object definition, expression, constant, input, divide by magazine size |
| Spawn an object once | creates an object that outlives the perk | snap, face, position, object definition |
| Create orbs | creates pickups for the player and allies | position, count, value, definition |
| Create an ammo drop | creates an ammo drop | position, who gets it, attached object, per-category amounts and weights |
| Add ammo (rounds), Add ammo (fraction) | adds ammo to weapon slots | magazine or reserves, flags, per-weapon and per-ammo-type amounts |
| Refill magazine from reserves | moves reserves into the magazine | flags, input, five fractions |
| Grant ability energy | adds part of a full charge to one ability | ability, gate, amount, cap, expression, constant, input |
| Set perk counter | sets or adds to the perk counter | mode, value |
| Run a behavior script | runs an installed script | three targets, script |
| Scale component values | changes named component values by an expression of an input | component name, cap, mode, input and target objects, expression |
| Movement mode | puts the owner into a movement mode; "hover" is a guess | two sets of speed limits and other mode values |
| Apply a component config | applies an installed config to a target | target, config |
| Post a sim object | posts a sim object for a player owner | definition hash |
| Register a tracked target | stores a target under a name | target, tracked name |
| Transmat or Ghost effect | picks the player's transmat or Ghost effect | effect key, from the installed effect table |

The object definition decides what a spawn does. The picker lists every installed definition.
Definitions an installed perk uses come first. Studio cannot author a new definition.

An expression is either **Constant** or **Pass input through**. With **Constant**, the value is the
constant. With **Pass input through**, the value is the input, for example the perk counter.
Installed nodes with longer expressions show **Other (read-only)**.

A label comes from the installed label table. Picking one writes both the label row and its bit.

A property operation needs a property the target exposes. Any other hash does nothing to damage,
fire rate or heat. Ammo-drop modifiers change how drops are generated. They do not refill a
magazine or reserves.

**Owner damage multiplier** stores the perk's own tag. Create writes the new entry's tag.

### Label filters

Many conditions and effects test the labels of an item, a weapon, a victim or a damage source. The
inspector shows each label filter as four lists:

| list | passes when the tested thing has |
|---|---|
| Any of | at least one of the labels |
| All of | every one of the labels |
| None of | none of the labels |
| Not all of | at least one of the labels missing |

An empty list does not test anything, so a filter with four empty lists passes everything.

**Add label** offers the installed label table: 306 single labels and 22 label groups. A group
stands for several labels at once. Names show where Studio can resolve them. The rest show as hex.
Studio refuses a label that is not in the table. On save, Studio writes the label rows and rebuilds
the game's compiled form of the filter. Every installed filter rebuilds to the same bytes the game
ships.

A filter in a form Studio does not write is kept as installed and shown read-only. No installed
perk has one.

### Pickers

Some inputs take only values installed perks already use: event hashes, incident types and roles,
tracked names, message hashes, modifier keys, sim objects, stat names and channel hashes. Their
meaning is not known, so a new value would have no known effect. The picker fills once Studio has
read the installed perks.

### Read-only parts

Installed nodes can hold settings Studio does not write for new nodes. Examples are relation
filters, range rows and longer expressions. The inspector lists them as read-only lines,
such as **Other native settings (kept as is)**. Studio saves them unchanged.

Every installed node kind can be written fresh. Some installed nodes still hold parts Studio
only keeps, such as the longer expressions of **Scale component values** and movement blocks
of other classes.

### What works in game

A working exotic weapon uses **When activated**, **After a delay** and **Adjust ammo drops**. These
work in game. Every other condition and effect may not work in game.

- **Damage multiplier** is partly unverified. It is not known whether it scales the owner's damage
  or the damage the owner takes. The element mask values (2 Solar, 4 Arc, 8 Void) are assumed.
- Many names above are guesses from perk names: death, fired, crouch, airborne, orbs, sword guard,
  projectile, damage taken, element choice, drop magazine.
- The event, incident, message and channel hashes have no known names.
- The ability slots (grenade, super, melee, class ability) and the gate values are assumed from
  perk names.
- Input meanings other than the perk counter are assumed.
- What a driven spawn does with its value is not known.
- The weapon slot mask meanings and the counter row window are assumed.
- New **On kill**, **On damage dealt** and **On item stowed** nodes start with empty label
  filters. Most installed ones have one, so add the labels a new node should test.
- What most labels and label groups mean is not known beyond their names.

## Show the perk in the HUD

A perk is invisible in game unless it adds an entry to the HUD buff tray. With no node selected,
the inspector shows **HUD buff**:

- **Show while active** adds a tray entry while the perk is active.
- The label list holds labels the game already has icons and text for. **Ammo Finder** is the first.
- **Show deactivation timer** shows the countdown of the graph's deactivation timer. It needs an
  **After a delay** node in **Deactivation**.

An installed perk that already has HUD feedback keeps it. The graph cannot add a second entry.

**HUD buff** may not work in game.

## Limits

- HUD feedback, cooldown branches and stack branches are kept, but the graph cannot edit them.
- Adding a condition to a perk with stack branches is refused. Every condition needs an index
  no other condition uses, and Studio cannot read the stack branches to check.
- A copy must name its own entry. Copying a program whose stack branches name the program itself
  is refused, because Studio cannot rewrite those branches.
- Relation filters and expressions other than a constant or a pass-through stay as installed.
  Studio cannot author them yet.
- New graphs and edited programs pass the package round-trip checks. In game, only the three kinds
  in [What works in game](#what-works-in-game) are tested.
