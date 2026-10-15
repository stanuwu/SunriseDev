---
title: "CUI layout internals"
description: "How the CUI page composes screens, writes layout and content edits, evaluates bindings, draws text and matches game widgets."
weight: 570
group: "How it works"
---
The CUI page reads the game's native CUI resources and hierarchies and writes edits back as deltas.
The steps are in [Edit CUI screens](/docs/sunrise-studio/cui/).

## Composition

A hierarchy view composes the default property profile through imports and supported anchors, in the
native construction order. It marks unsupported branches instead of drawing guessed rectangles. A
stored rectangle can still be replaced at run time by a binding or a container rule.

| surface | support |
|---|---|
| stored rectangles | base X, Y, width and height on verified layout node types |
| hierarchy | construction order, import bases, default-profile overrides |
| local widgets | create core types, duplicate, reparent, remove, with stable native IDs |
| container anchors | stored, start, center, end and stretch; margins and size limits |
| property units | unscaled floats and screen-height-scaled floats |
| runtime sizing | unresolved branches keep their node and source links |
| custom containers | unresolved unless their children opt out of layout |
| text | English font and style lookup, size, ASCII case, alignment, palette, RGBA tint |
| bitmaps | authored group and frame selection, decoded textures |
| bindings | listed per widget; root comparisons editable; evaluated from page inputs |

## Layout and content edits

Layout values can share one pooled constant. An edit detaches the changed property inside its typed
pool, then repairs the pool descriptor and every reference, so other widgets keep their values.
Shared component and property arrays are detached before an edit. New fields create typed pools and
an empty selector path when needed. An unchanged edit keeps the original bytes. The project stores
copy ranges and XOR masks, never a copied resource.

The first hierarchy edit creates a private root resource as a delta of the installed root. It goes
into an unused package among the top 256 new package IDs. The hierarchy reference, the resource and
the widget name file are one transaction. Undo removes the
private additions. Redo restores their tags. Other screens and imported resources keep the originals.

A widget that an authored animation track targets cannot be deleted. Every structural edit checks
that each binding still reads the same afterwards, unless it belonged to a removed widget.

## Bindings

A binding copies a value from one widget property to another, sometimes through a NOT or a
comparison. A resource's bindings use its own node IDs, so the page maps them through the resource's
placement. An edit points the binding at a new record, so a record shared with other bindings keeps
its value.

Studio evaluates bindings only from the inputs set in the page. Comparisons never convert value
kinds. A binding whose source kind does not match its transform stays unevaluated. **Apply
bindings** hides a widget whose visibility, property `0x201` of a layout type, comes out false,
together with its children.

## Widget types

Type inheritance and constructor defaults come from the game's widget registry. The installed
executable is packed and does not expose it, so Studio carries a copy for this build: 390 types,
each with its parent and whether its constructor applies the standard 360 x 240 defaults.

## Text

DirectWrite validates and bakes the game's fonts from memory through an isolated loader. Fonts are
never installed in Windows. ImGui receives bounded alpha sprites and never parses font outlines.

Latin text uses the game's break and spacing rules with legacy pair kerning, one UTF-16 character at a
time. Modern ligatures and GPOS shaping are off, to match. Auto width and auto height measure the
prepared text. Raster edges can differ from the game's renderer.

## Live game state

The game sends one row per CUI object of the watched screen, parent before child. Each row carries
the object's hierarchy tag, node id and name hash. A widget row also carries a widget flag, the
state flags, the text key, four rectangle slots and slot 6.
[The live link](/docs/sunrise-studio/live-link/#cui) owns the transfer.

Studio joins a row to the open hierarchy by two keys:

| key | game | Studio |
|---|---|---|
| hierarchy tag | the tag the widget was built from | the open hierarchy's tag |
| node id | the widget's construction index | the composed node's id |

A row with another hierarchy tag belongs to a nested hierarchy. It is counted, never joined. A row
whose node id is missing here, or whose name hash differs from the node's authored name, is counted
as a mismatch. A node with no authored name, such as the screen root, joins on its id alone.

Studio treats a widget as shown when its state bit `0x2` is set and every parent row is shown.
A row without the widget flag has no state word, so Studio counts it as shown. Visibility, property
`0x201`, sets bit `0x2`. Whether that bit keeps a widget out of the draw is unverified.

A tree cut short at 8,192 rows or 256 levels marks the join partial. A node with no row is then
unknown, not unbuilt.

Not shown:

- nested hierarchies inside the screen
- live rectangles on the canvas; the canvas keeps the composed layout
- live binding values

## Limits

- CJK breaks, non-ASCII case maps, inline styles, text shrinking, ellipsis and parent reflow are not
  supported.
