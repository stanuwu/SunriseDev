---
title: "Edit CUI screens"
description: "Move, resize, add and remove UI widgets, change their text and bitmaps, and preview bindings."
weight: 200
group: "Guides"
---
CUI is the game's UI format. A screen is a hierarchy of widgets built from resources. The **CUI**
page edits the stored layout and content. It does not run animations. The game supplies binding
values at run time.

The CUI page has two views. A **resource** shows one resource's widgets and their stored rectangles.
A **hierarchy** shows the whole screen, composed from its resources.

## Open a screen

1. In the Assets tab, open the **Interface** category.
2. Find the resource or hierarchy. Type its name to search. The **Type** filter picks
   **Screen** for hierarchies or **Resource** for resources.
3. Click it. It opens on the **CUI** page.

**New** and **Clone** in the **Interface** category are gray. Studio has no path to a new screen. To
add to a screen, open it and use **Add widget**.

Studio has the game's widget type table built in, so every widget type is available without the
game.

## Move or resize a widget in a resource

1. Open a resource.
2. Click the widget in the list. **Find widget** filters the list.
3. Type new values in **X**, **Y**, **Width** and **Height**.
4. Press **Apply**.

You can also drag the rectangle on the canvas to move it. Drag its lower right handle to resize it.
A drag saves one change when you release it. **Reset** restores the stored values. **Fit** frames
the widget. Values are in the parent's space.

**Imports** under the widget list names the resources this one imports. Double-click one to open it.

## Change text, style and bitmaps

1. Select the widget.
2. Under **Content**, change the text key, style key, font size, case, alignment or tint.
3. To pick a string, press **Choose text** and search the localized strings.
4. To pick a bitmap, press **Choose bitmap** and search the installed and project bitmaps.
5. Press **Apply content**.

A bitmap widget may also store a group and a frame. Apply a new bitmap before you choose its group
or frame.

**Reset content** drops unapplied content changes. A font size of 0 uses the style's size. While
auto width or auto height is on, the matching size field and the resize handle are disabled.

To set a property the widget does not store yet, open **Add property**, choose the property, set its
value and press **Add**. Apply or reset content edits before you add a property.

## Work with a whole screen

1. Open a hierarchy.
2. Click a widget in the tree or on the canvas.

| control | effect |
|---|---|
| **Fit** | frames the screen |
| **Frame widget** | frames the selected widget |
| **Isolate** | previews only the selected widget and its children |
| **Apply bindings** | hides widgets whose bound visibility is false |
| **Edit source** | opens the resource that defines the selected widget |
| eye icon in the tree | hides the widget and its children in the preview |
| **Reveal selection**, **Show all widgets**, **Collapse tree** | icon buttons above the tree |

Search in the tree keeps each match's parents. Clicking a widget on the canvas reveals it in the
tree. Double-clicking a row frames it.

## Add a widget

1. Open a hierarchy and select the parent widget.
2. Press **Add widget**.
3. Choose the **Type**: Frame, Container, Text or Bitmap.
4. Type a **Name**.
5. Check the **Parent**. It must be the screen, a frame or a container.
6. Type the **Position** and **Size**.
7. Press **Create**.

Studio selects the new widget, frames it and turns on **Isolate**. New widgets use manual layout
in their parent's space. The first change to a screen creates a private copy of its root resource
in your project. Other screens that share resources keep the originals.

Widgets made with **Add widget** and **Duplicate** may not work in game.

## Copy, move or delete a widget

You can change only widgets that the screen defines itself. Edit an imported widget in its own
resource. Press **Edit source** to open it.

| to | do this |
|---|---|
| copy | select it and press **Duplicate** |
| move to another parent | choose the **Parent** and press **Set parent** |
| change its rectangle | type **X**, **Y**, **Width**, **Height**, then press **Apply layout** |
| change its content | use **Content**, as in a resource |
| delete it and its children | press **Delete** |

A widget that an authored animation targets cannot be deleted. Every structural change checks that
each binding still reads the same afterwards. A change that would break one is refused.

## Preview bindings

A binding copies a value from one widget property to another, sometimes through a NOT or a
comparison. The game supplies the source values. Studio lets you set them by hand.

1. Select a widget in a hierarchy. Its bindings are listed.
2. Press **Input** on a binding row and type a source value.
3. Read the result next to each binding it feeds.
4. Tick **Apply bindings** to hide widgets whose visibility comes out false.

To change a comparison on the screen's own root, press **Edit** on its row, change it and press
**Apply**. Inputs are dropped when you open another screen.

## Live game state

While Studio is attached to a game, the CUI page can show the game's own widgets over an open
hierarchy. [Connect to a running game](/docs/sunrise-studio/live/) covers the attach. This view is
read only. It may be inaccurate.

1. Open a hierarchy, or let **Sync > CUI screen** in the Live tab open the game's top screen.
2. Turn on **Game state** in the toolbar. It is on by default.
3. Read the status chip next to it. Hover it for detail.

| chip | meaning |
|---|---|
| **Live** | the game has this screen open and its widgets match |
| **Following game** | as Live, and Sync opened this screen |
| **Waiting** | the game has not answered yet |
| **Not open in game** | the game has no open screen with this hierarchy |
| **Stale** | the game stopped answering; the last game state stays, dimmed |
| **No match** | no game widget matches this hierarchy |
| **Unavailable** | the game could not read this screen |
| **Not ready** | the game is still building its screen list, or the link is re-attaching; it clears by itself |
| **No link** | the CUI link is out of date or sent bad data; the tooltip says why |

| where | shows |
|---|---|
| tree | rows hidden in game are muted and carry a small **Game state** icon; rows the game has not built are dimmed |
| tree tooltip | **In game:** Shown, Hidden, Hidden by parent, Not built, or Not reported (partial tree) |
| canvas | widgets hidden in game, or under a hidden parent, are not drawn; a text key the game changed replaces the authored text |
| inspector | **In game now (read only)** and **Game record** |

Hidden, hidden by parent and the small icon may be inaccurate. A row that is not a widget never hides its
children. When the game's tree is cut short, rows it did not reach say **Not reported (partial
tree)** and are not dimmed.

The eye column in the tree stays your own preview toggle. Rectangles on the canvas stay the authored
ones.

**In game now (read only)** sits at the top of the selection pane while the game state applies. It
lists whether the widget is shown, its own visibility bit, the string of its live text key, its
visibility value (slot 6), X, Y, width, height and type key. X, Y, width and height are parent-local
base values without animation. The visibility value (slot 6) and the rectangle may be inaccurate.

**Game record** asks the game for the selected widget's record: flags, parent, child count, text
source, style, live text and the raw slots. **Auto**, on by default, asks again twice a second, so
live text such as numbers and names stays current. **Refresh** asks once. The copied live text also
replaces the widget's text on the canvas. **Auto** may not work in game.

A warning **Different build or edited screen** means some game widgets have no node with the same id
and name here. A count of nested widgets means the screen holds another hierarchy. Studio does not
place those widgets.

## Limits

- Studio cannot create a new screen. A new widget goes into an installed screen.
- A screen holds at most 5,120 widgets.
- Text layout supports Latin wrapping and kerning. CJK line breaks, inline styles, text shrinking,
  ellipsis and parent reflow are not supported.
- Custom containers and runtime sizing are shown as unresolved, not guessed.
- Edited screens are unverified in game.
- Live game state shows no live rectangles, no live binding values and no nested hierarchies.

## Related pages

- [Bind CUI values to mod settings](/docs/sunrise-studio/config-bindings/) lets players change a
  layout value or comparison.
- [CUI layout internals](/docs/sunrise-studio/cui-internals/) explains how edits are written and
  how game widgets are matched.
