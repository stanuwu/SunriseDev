---
title: "Script a mission"
description: "Create and edit mission scripts in the Mission Graph, as nodes or as Lua."
weight: 220
group: "Guides"
---
The Mission Graph edits mission scripts: the Lua files Sunrise runs while an activity is live. It
shows a script as a node graph and as Lua. [Mission Scripting](/docs/mission-scripting/) explains
what a script is and how it runs.

Mission scripts are plain Lua files, not package data. They are never stored as deltas.

| script | lives in | save writes |
|---|---|---|
| installed script | `bin/x64/Sunrise/scripts/<stem>/<stem>.lua` | that file, in place; no project needed |
| mod script | the project's `scripts/<stem>/<stem>.lua` | the project file; needs its project open |

## Open the Mission Graph

1. Choose **View > Mission Graph**.

It opens in its own area of the layout, or in its own window when it is popped out. See [Arrange the
layout](/docs/sunrise-studio/layout/). To open a script, choose it in **Installed scripts**, or in
**Mod scripts** with a project open.

The toolbar holds these controls. Icon buttons name themselves in their tooltip.

| control | does |
|---|---|
| **+** (**New script**) | starts a new script |
| **Installed scripts** | opens an installed script; its tooltip shows the open script's file |
| circular arrow (**Reload scripts and API schema**) | reads the scripts and the SDK again |
| **Mod scripts** | opens a script of the open project |
| **Save** | saves the script; it shows `Save*` while there are unsaved changes |
| export (**Export Lua for review**) | writes a copy to a folder outside the installation |
| **Read only** | shows when the script's project is not open for editing |
| warning icon | shows when there is no API schema; its tooltip says why |
| forward arrow (**Finish switching scripts**) | shows while a switch waits on unsaved changes; opens its dialog again |

Press reload after the game or a `git pull` changes the scripts or the SDK. Undo and redo are in the
**Edit** menu.

## Create a new script

1. Press **+** (**New script**), or choose **File > New mission script...**.
2. In **Activity**, search for and choose an activity from the installed SDK.
3. In **Arrival region**, choose the region where the script starts.
4. Check **Graph key**. It defaults to the script's name.
5. Under **Save to**, choose **Installed scripts** or **This project (mod)**.
6. Press **Create script**.

The activity sets the folder and file name, so a place holds one script per activity. Create refuses
a script that already exists. Open that one instead. A new script targets an existing activity. It
does not create a new activity.

The dialog names any SDK file that is missing or damaged. Start the game once to rebuild it. When
`scripts/lib/flow.lua` is missing, the dialog says so and **Create script** stays off.

The starter script waits until the player enters the arrival region, then runs its first step. It
resumes saved progress on load. It does not complete the mission on its own.

## Add a step

1. Open the **Nodes** tab.
2. Select the facts group or the steps group.
3. Press **+** (**Add node**).
4. Type a **Node id**.
5. Choose a **Template**.
6. Choose the **Sensor**, **Target**, **Navpoint**, **Scene**, **Input**, **Output** or **Inputs**
   the template asks for.
7. Press **Create**.

| template | group | does |
|---|---|---|
| Observe trigger | facts | waits for a player-trigger report, then disarms the trigger |
| Scene output | facts | waits until a scene reports one of its outputs |
| Immediate step | steps | starts with an empty action |
| Arm trigger | steps | arms an SDK trigger slot |
| Show objective | steps | sets a directive on its sensor, with an optional navpoint |
| Play dialogue | steps | plays a cue on its dialogue sensor |
| Select state | steps | selects an SDK state |
| Complete mission | steps | completes the mission |
| Start scene | steps | starts a scene, then sends the inputs you tick, in the order you tick them |
| Send scene input | steps | sends one input to a scene |

In a campaign graph, the steps group offers other templates: **Immediate step**, **Reach trigger**,
**Complete ghost scan** and **Use interactable**.

## Scene inputs and outputs

A scene is a scripted piece of a mission, such as an explosion or a character's performance. Each
scene has its own inputs and outputs.

- An **input** is an event the scene waits for. A script sends it.
- An **output** is an event the scene reports. A script waits for it.

Pickers only offer the inputs and outputs of the scene you chose. They come from the installed
SDK's `mission.SceneInput` and `mission.SceneOutput` tables. An SDK generated before these tables
existed lists none. Start the game once with the current Sunrise to regenerate it, then press reload
on the toolbar. See [Generated SDK](/docs/mission-scripting/generated-sdk/) and
[The world model](/docs/mission-scripting/world-model/#scene).

A **Scene output** fact needs the script to pass scene outputs to its flow. New scripts do this.
For an older script, add `on_event_scene_output` to the table it returns, the same way as its other
`on_event_` callbacks. Until then, Checks reports the fact.

## Campaign steps

Campaign steps run in list order. Select a step and press the up or down arrow (**Move before the
previous node**, **Move after the next node**) to move it. Links between campaign steps show that
order and cannot be dragged.

Select a step to edit its fields:

| field | does |
|---|---|
| **Objective**, **Navpoint**, **Waypoint volume** | what the step shows the player |
| **Start scene** | starts this scene when the step starts |
| **Inputs** | sends the ticked inputs right after the scene starts; needs a start scene |
| **Arm in leg**, **Trigger** | ends the step on that trigger; the leg arms it |
| **Ghost scan**, **Interaction** | ends the step on that scan or interaction |
| **Scene finished** | ends the step when that scene finishes |
| **Output scene**, **Scene output** | ends the step when that scene reports that output after the step started |
| **Encounter cleared**, **Region reached** | ends the step on that encounter or leg |
| **Barrier** | a later step's trigger cannot end this step early |
| **Revisit** | the step's trigger and region count only after the step starts |
| **Dialogue** | cue lines, each with an optional filter volume |

A step with no end condition completes at once. The inspector then shows **Completes immediately**.

Choosing another start scene drops inputs that belong to the old one. Clearing it drops all inputs.
Choosing another output scene clears the output until you pick a new one.

Select a leg to set its **State**. Edit its trigger and monitor lists in **Advanced Lua**.

Encounter nodes and a step's destroyed-object list have no typed fields. Edit them in **Advanced
Lua**.

## Make a step wait for another

This works for flow steps only. Campaign steps run in list order.

1. Drag from the first step's output arrow, on its right, to the second step's input ring, on its
   left.

The second step then runs after the first finishes. The **Dependencies** checkboxes of a selected
step set the same links.

To remove a link, do one of these:

- Click it and press **Disconnect**.
- Right-click it and choose **Disconnect**.
- Drag it off its input ring onto empty space.

Dropping a link on an invalid target keeps the old link.

## Edit a step's action

Flow steps only.

1. Select the step.
2. Under **Action**, press **Edit action**.
3. Choose the **Action type** and fill its fields.
4. Press **Apply**.

## Set when a step starts and finishes

Flow steps only.

1. Select the step.
2. In **Start when**, choose **Immediately**, **Fact**, **All** or **Any**.
3. In **Finish when**, choose the same way.
4. For **All** or **Any**, press **Add condition** for each child condition.

| condition | means |
|---|---|
| Immediately | no condition |
| Fact | a named fact in this flow is set |
| All | every child condition holds |
| Any | at least one child condition holds |

All and Any do not pick one branch: every eligible step can run. Facts stay set for the attempt
unless a checkpoint resets them. Tick **Checkpoint** on a step to make it one.

## Edit Lua directly

A Lua box opens as a preview. Press **Edit** to type in it, and **Preview** to go back.

| where | apply | drop the edit |
|---|---|---|
| a **Custom Lua** field, or a node written as Lua | **Apply** | **Revert** |
| the **Lua** section of a typed action or condition | **Apply** | **Revert** |
| **Code** or **Advanced Lua** on a script-view node | **Apply** | **Revert** |
| **Inputs** of a script-view node | **Apply** | **Revert** |
| **Advanced Lua** on a flow or campaign node | **Apply** | select the field again |
| the **Lua** tab | **Apply** | **Revert** |

Script-view inputs and the flow or campaign **Advanced Lua** box have no preview. In **Advanced
Lua**, pick a field from the list or type its path, then edit the box.

Unapplied Lua marks the script as unsaved.

- A pending field edit blocks Save, Undo, Redo, Export and other edits. Apply or revert it first.
- Save, Export and graph edits apply a pending **Lua** tab edit first. Undo drops it, and Redo
  brings it back.
- While a **Lua** tab edit is pending, the **Script** group is read only and no field edit applies.
  Redo is refused until you revert it.

Studio reads Lua 5.4 and refuses any edit that leaves a syntax error. On the **Lua** tab, the error
names its line and column, and the draft stays so you can fix it. A script file with a syntax error
does not open; fix it in a text editor first.

## Save

1. Press **Save**, or press **Ctrl+S** while the Mission Graph has focus.

An installed script saves in place. A mod script saves into the project. The export button
(**Export Lua for review**) writes a copy for review to a folder outside the installation. Node
positions are kept in your local settings, per script.

When you switch scripts, projects or installations with unsaved changes, the **Unsaved mission
script** dialog asks you to **Save and continue**, **Discard** or **Cancel**. After **Cancel**, the
switch waits. Press the forward arrow (**Finish switching scripts**) on the toolbar to choose again.
Saving also finishes the switch.

## Check the script

1. Open the **Checks** tab. Its title shows the number of problems.

It lists graph errors, such as unknown dependencies or facts, cycles, invalid conditions, duplicate
ids and over-long state keys. It also lists scene errors:

- an input sent to a scene that does not have it
- an output waited for on a scene that does not report it
- a campaign step with inputs but no start scene
- a campaign step whose scene is a slot, not a `mission.Scene` entry
- an input or output name that the installed SDK does not list
- a scene output fact in a script with no `on_event_scene_output` callback

It also names a missing or damaged SDK file, and lists the problems of typed calls. See [Checks on
typed calls](#checks-on-typed-calls). With nothing to report, it says **No problems found**. With
no API schema, it also says that API calls were not checked.

Graph errors block **Export Lua for review**, **Build and install** and **Update running game**.
They do not block **Save**. Scene and call problems block nothing.

It is not a Lua compiler, and a passing check does not prove the mission plays in game.

## Run it in the game

- An installed script runs the next time its activity starts. In game, the Script page's
  **Reload script** loads it again. See [Your first script](/docs/mission-scripting/first-script/).
- A mod script needs **Build > Build and install** while the game is closed.
- While the game runs, **Build > Update running game** reloads changed mod scripts. See [Build and
  install a mod](/docs/sunrise-studio/build-and-install/#update-a-running-game).

## The whole-script view

The **Script** group shows the whole Lua file as a graph. Every top-level statement is a node, and
so is every field of the returned callback table. A link runs from the node that defines a name to
each node that uses it. A module node shows its local name, with its `require` line below.

| control | effect |
|---|---|
| double-click a function or callback | opens its control flow |
| folder (**Open the body**), forward arrow (**Open the flow**) | open the selected node's body or flow |
| folder on a flow or campaign node (**Open run**, for example) | opens that field's function |
| back arrow (**Up to script**) | returns to the whole-script view |
| corners (**Frame all**) | fits the group in view |
| grid (**Arrange as a tree**) | lays the group out again as a tree |
| up and down arrows | move the node within its scope |
| trash can (**Remove node**) | removes the node |
| **+** (**Add node**) | adds a function, value, callback or statement |
| **+** next to a body or branch name, under **Add inside** | adds a statement or an API call there |
| **Add else if**, **Add else**, under **Branches** | adds a branch to an if node |

A group opens framed, but text never shrinks too small to read. A long chain wraps to the width of
the canvas. Pan or zoom out to see a graph that is still wider.

To add a function or a value, type its name in the **Name** box of the **Add node** popup, then
choose **Function** or **Value**.

If, else-if, else, while, for, repeat, local scopes, calls, assignments, returns and breaks have
their own nodes. Code the graph cannot show as nodes stays a **Custom Lua** block, and the
inspector says why. Its neighbors still show as nodes. Edits replace only their own source and keep
comments and line endings.

## Typed API nodes

A statement that is one Sunrise API call is a typed node. Its arguments are fields you edit, not Lua
text. A call inside a larger statement, such as an if condition, gets the same editor in that
statement's inspector. The statement's own call is open. Other calls fold under their own **Call**
headers. Calls the schema cannot describe stay **Custom Lua** blocks, so every script still opens
and edits in full.

The types come from the generated SDK file `sdk/lua/sunrise/mission_api.json`. Sunrise writes it
from the same table the runtime uses to check arguments. See [Generated
SDK](/docs/mission-scripting/generated-sdk/#sunrisemission_apijson). An installation that has not
written it yet shows every call as Lua, and the toolbar shows a warning icon. Start the game once
with the current Sunrise, then press reload on the toolbar.

### How a call is typed

Studio types parameters named `context`, `state` and `event`, and the handles their calls return. A
Sunrise API call it cannot type stays a **Custom Lua** block, and the inspector says why. Any other
call is a call node with **Call** and **Arguments** inputs.

### Edit a typed call

1. Select the node. Under **Call**, each argument has a row. A `*` marks a required argument.
2. Change a value. The edit replaces only that value in the source.

A text or number field applies when you press Enter or leave the field.

| argument kind | editor |
|---|---|
| boolean | checkbox |
| integer, number | number field, kept inside the allowed range |
| string, name | text field |
| scalar (boolean, number or string) | text field; type the Lua value, such as `true`, `3` or `"name"` |
| enum, such as a device transition | list of the collection's entries |
| generated entry, such as a directive or a scene input | picker of the installed SDK's entries |
| slot, squad or scene handle | picker of the entries that match the slot type |
| list | one row per entry |
| table | one row per field |
| atom of `run_atoms` | its kind, then the fields of that kind |
| function | Lua |

A picker offers only what the schema allows. A slot picker lists slots of the slot type the call
needs. A scoped picker lists the receiver's own entries, such as the inputs of that scene.

| button | effect |
|---|---|
| **Lua** | edits the value as Lua; it stays lit while on, and pressing it again goes back |
| **+** on an absent argument | adds it with its default or a valid placeholder |
| **+** (**Add entry**) under a list | adds a list entry, up to the allowed count |
| trash can | removes an optional argument or a list entry |

In Lua mode the box is open for typing at once. Press **Apply** to apply it, or **Revert** to drop
it. An absent optional argument shows its default, greyed out.

A value that is not a literal or a generated entry, such as a local, opens as Lua.

Adding keeps the table's style: one line or one field per line, and a trailing comma only where the
table has one.

A call that passes a table built in Lua, such as `squad:place(args)`, shows no argument rows. Edit
it in **Advanced Lua**.

### Checks on typed calls

Studio checks literal values the way the runtime does. It finds problems such as:

- the wrong call form: `:` where `.` belongs, or the wrong number of arguments
- a required argument that is missing, or a key the call does not take
- a value of the wrong type, such as text where a number belongs
- a number outside its range, or a string of the wrong length
- a list with too few or too many entries
- an entry that is not in the installed SDK, or that comes from another table
- a slot of the wrong slot type, or an entry that belongs to another slot or scene
- an atom with no kind, or a field its kind does not have

A problem shows on the node, in its inspector and on the **Checks** tab. It blocks nothing.
Code the checks cannot read, such as a value computed at run time, is not checked.

### Add a callback or a call

1. On the script view, press **+** (**Add node**). Under **Callbacks**, choose one. It is added to
   the returned table with the parameters the runtime passes. A callback the script already returns
   is greyed out.
2. In a function, press a **+** under **Add inside**. Choose a statement, such as **If** or
   **While**, or a call under **Sunrise API**.

The list holds the calls that a value in scope can make, such as `context` and what it reaches. A
call that needs a slot type the mission does not have is not listed.

A new call has a placeholder for each required argument. The placeholder is valid: the default, the
first matching SDK entry, or zero moved into the allowed range. Change it before you save. A
callback node shows the fields its event carries.

## Helpers and SDK modules

| file | example path in the project | loaded with |
|---|---|---|
| helper module | `scripts/lib/tools.lua` | `require("lib.tools")` |
| own SDK module | `sdk/my_mod/bindings.lua` | `require("my_mod.bindings")` |

Folder and module names use ASCII letters, digits and underscores. A controller must fit 128 KiB.
Other modules can be up to 16 MiB. Edit helpers in a text editor. The Mission Graph lists
controllers. Studio does not copy the generated SDK into projects.

## Legacy scripts

**Mod scripts** lists a project's `.sunrise-mission.json` scripts under **Legacy scripts**. Open one
and save it to create its Lua file. To get its exact source, right-click the entry and choose
**Export original Lua**.
