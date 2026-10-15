---
title: "The UI format"
date: 2026-10-15
description: "How the game UI ships as package data and runs: screens, hierarchies, widget tables, bindings, layout, text, fonts and bitmaps."
weight: 84
---
The whole game UI ships as package data in three classes. A screen names views, a view names
hierarchies, and a hierarchy is a node tree that names one widget table. The widget table holds the
values and the bindings that drive each node.

Class ids are package classes. Native class names such as `c_text_widget` are the game's own. Field
names are descriptive.

| class | role | entries |
|---|---|---:|
| `0x808047B7` | screen | 20 entries, 10 payloads |
| `0x8080496A` | hierarchy | 340 |
| `0x80804825` | widget table | 1,254 |

Every screen is stored twice, as package file type 8 and type 16, with byte-identical payloads. Why
is not known.

```text
screen
  -> view (named)
     -> view entry -> hierarchy
        -> node tree
        -> widget table
           -> node bindings -> back to hierarchy nodes
           -> objects -> components -> property refs -> slot + pooled value
```

## The array container

A UI blob starts with its own length. Everything after it is arrays reached through 16-byte
descriptors. Every stored offset is relative to the field that holds it.

```c
struct UiArrayRef {        /* 16 bytes */
    uint64_t count;        /* +0x00 */
    uint64_t relative;     /* +0x08 */
};  /* data header at: descriptor offset + 0x18 + relative */

struct UiArrayHeader {     /* 20 bytes, packed */
    uint32_t marker;       /* +0x00  always 0x80809FBD */
    uint64_t count;        /* +0x04  same as the descriptor's count */
    uint64_t item_class;   /* +0x0C  class of the elements */
};  /* elements start at +0x14 */
```

The element class is only in the header. A parser must read it there and dispatch on it. The 1,254
widget tables hold 54,510 arrays, and every one resolves this way.

## Screens and hierarchies

```c
struct UiScreen {                  /* class 0x808047B7, 80 bytes */
    uint64_t   length;             /* +0x00 */
    uint32_t   font_set;           /* +0x08  class 0x808047C5 */
    uint32_t   unused;             /* +0x0C */
    UiArrayRef views;              /* +0x10  class 0x808047CB */
    UiArrayRef resources;          /* +0x20  class 0x808047C6, {u32 tag, u32 flag} */
    uint8_t    filled[0x14];       /* +0x30  0xFF */
    uint32_t   optional_fonts;     /* +0x44  class 0x808047C7, or -1 */
    uint32_t   pad[2];             /* +0x48 */
};

struct UiView {                    /* class 0x808047CB, 24 bytes */
    uint32_t   name_hash;          /* +0x00  251 distinct over 570 views */
    uint32_t   pad;
    UiArrayRef entries;            /* +0x08  class 0x808047CD, {u32 name, u32 hierarchy} */
};

struct UiHierarchy {               /* class 0x8080496A, 40 bytes */
    uint64_t   length;             /* +0x00 */
    UiArrayRef nodes;              /* +0x08  class 0x80804616 */
    uint16_t   count_a, count_b;   /* +0x18 */
    uint32_t   widget_table;       /* +0x1C */
    uint32_t   pad[2];             /* +0x20 */
};

struct UiNode {                    /* 4 bytes */
    uint16_t parent;               /* +0x00  0x7FFF on the root */
    uint16_t id;                   /* +0x02 */
};
```

Node ids are a permutation of `0` to `count - 1`, local to the hierarchy. The array is not stored in
id order, so read the tree through the id, not the array position. The client sizes its node array
from the hierarchy's count and refuses more than `0x1400` nodes.

## Widget tables

The widget table root is 344 bytes: a length, eight array descriptors, then thirteen value-pool
descriptors. The main arrays:

| offset | class | element |
|---|---|---|
| `+8` | `0x80804607` | links to other widget tables, 12 bytes |
| `+24` | `0x80804618` | the `objects` index, 4-byte ids |
| `+56` | `0x80804622` | the `components` index, 16-byte rows |
| `+72` | `0x8080462A` | objects, 64 bytes |
| `+88` | `0x808046D8` | node bindings, 56 bytes |
| `+120` | `0x80804943` | slots, 16 bytes |
| `+136` to `+328` | several | value pools |

The member names `objects` and `components` are Bungie's. They name the index tables at `+24` and
`+56`, not the 64-byte object records. Widget tables link to each other, so the set is a graph, not
a tree.

```c
struct UiObject {                  /* class 0x8080462A, 64 bytes */
    uint8_t    type_hash[20];      /* +0x00  a type id: three values over the corpus */
    uint32_t   pad;                /* +0x14 */
    uint32_t   constant;           /* +0x18  0xB93A719D on every object */
    uint32_t   pad2;               /* +0x1C */
    UiArrayRef components;         /* +0x20  class 0x808046D4 */
    UiArrayRef animations;         /* +0x30  class 0x808046F3 */
};

struct UiComponent {               /* 24 bytes */
    uint64_t   key;                /* +0x00  low 16 bits: a node id, local to the resource */
    UiArrayRef property_refs;      /* +0x08  class 0x80804858 */
};

struct UiPropertyRef {             /* 24 bytes */
    int64_t  slot_rel;             /* +0x00  self-relative, to a slot */
    uint64_t selector;             /* +0x08  which property */
    int64_t  value_rel;            /* +0x10  self-relative, to a pooled value */
};
```

A component's key is the node it sets properties on. The client adds the current import base to
the key's low 16 bits, checks the import span, and selects that node. A property reference binds a
slot to one pooled value, and the selector says which property.

The object's `+0x30` array holds animation rows. Each row's array holds animation targets, 32 bytes,
with the target node id at `+0`.

### Node bindings

A node binding reads one node's property and writes another's. The binding record and its
transforms are on [Behaviors](/docs/destiny-2/behaviors/#node-bindings).

### Slots

A slot is itself an array descriptor, pointing at 1 to 5 elements of 4 bytes. An element is a pair of
16-bit halves. Element 0 draws from the selector space. Later elements are small integers. That
a slot is a short typed tuple, a code then operands, is unverified.

## Properties

Property ids are per type. A selector means nothing without the type that owns it.

The base layout type owns the `0x200` band. Every type that inherits it reads these the same way:

| selector | property |
|---|---|
| `0x201` | visible, a bool |
| `0x206`, `0x207` | X and Y, relative to the parent |
| `0x208`, `0x209` | width and height |
| `0x20F` | the layout mode: 0 none, 1 the ordinary box constraint, 2 another constraint |
| `0x210` | the box constraint: anchors, margins, minimum and maximum size |

A type outside that line can reuse a number for something else. Native containers can overwrite the
stored rectangle during layout, so the stored values are not the composed screen position.

### Layout anchors

The box constraint at `0x210` holds a vertical anchor, a horizontal anchor, four margins and minimum
and maximum sizes. Anchor modes:

| mode | placement |
|---:|---|
| 0 | keep the stored position |
| 1 | start padding plus start margin |
| 2 | centered in the parent |
| 3 | from the end: parent size minus child size, end padding and end margin |
| 4 | stretch between the padded margins, within the size limits |

The ordinary container's `0x600` and `0x601` alias width and height. `0x602` and `0x603` turn on
automatic height and width. `0x604` to `0x607` set its left, top, right and bottom padding. One
container type distributes its children along an axis instead and must not be treated as the
ordinary container.

### Value pools and units

The value pools hold floats, vec4s, integers, 16-bit values and bytes. The two float pools have
different units. One supplies a float directly. The other multiplies by the current screen height
and rounds to the nearest even integer, unless the property's metadata says otherwise.

Most stored coordinates are in units of screen height: 28,409 of 30,813 non-zero floats are exact
multiples of `1/1080`. So `1.0` is 1080 pixels and `1.777778` is the 16:9 aspect ratio. Not every
value follows that rule.

The base reset makes a new node `screen_width / 1920 * 360` wide and `screen_height / 1080 * 240`
tall. These are constructor values, not measured content sizes.

## Text and bitmaps

### Text

`c_text_widget` owns the `0x400` band.

| selector | property |
|---|---|
| `0x401` | minimum text width; not a font size |
| `0x403`, `0x404` | minimum and maximum height for automatic height |
| `0x405` | the localized string hash |
| `0x40A` | case: original, uppercase, lowercase |
| `0x40C` | the style key, looked up in a language-specific style table |
| `0x40D` | palette key |
| `0x40E` | horizontal alignment: left, center, right |
| `0x414` | RGBA tint |
| `0x41A`, `0x41B` | automatic width and automatic height |
| `0x420` | an explicit font size; zero uses the style's size |
| `0x421` | extra line spacing |

The text color is the palette color times the tint times any animation tint. Storage is RGBA, with no
swizzle. Technique 175, `cui_font_complex`, draws the glyphs. Its pixel shader takes alpha from the
glyph mask times the color's W.

When `0x40A` has no override, the style row's byte `+17` supplies the case mode. Case conversion
outside ASCII uses the game's own glyph mappings, not standard Unicode casing.

### Fonts

Font files are embedded in packages as OpenType (`OTTO`) data, package type 24. Type 24 alone does
not mean a font; other data uses it too. A font manifest lists headers. A header holds the data tag,
a filename and a byte length. The loader allows at most 16 MiB per file.

The screen's font set holds thirteen language blocks. The client picks the current language and
falls back to the first block when its style is missing. A style row (128 bytes) picks a font set of
up to eight fonts, in authored order, and a default size. For example, the English waiting text uses
`NHaasGroteskTXPro-55Rg.otf` at 22 pixels. The palette rows sit in the font set too, in four ranges;
the normal range is first.

### Line layout

The Latin line builder advances one UTF-16 code unit at a time. It does no OpenType ligature or GPOS
substitution. It applies legacy pair kerning. Below 25 pixels per em the kerning is also scaled by
the pixel size over 25. Kerning rounds to whole pixels, and glyph advances round to whole pixels with
halves away from zero.

The builder breaks after a glyph with no ink, except U+00A0, U+202F and U+2060. It also breaks at
hyphens and soft hyphens, and a newline ends the line. On overflow it moves the glyphs after the last
break to the next line. With no break point, it splits before the glyph that overflows. Trailing
empty glyphs are dropped.

The first baseline is one em below the origin. Each next baseline adds the tallest font-size height
in the line before and the line spacing. Automatic height measures the text within `0x403` and
`0x404`. CJK text takes a separate path.

### Bitmaps

`c_bitmap_widget`'s `0x600` sets its bitmap asset. `0x601` and `0x602` pick a group and a frame.
Animation offsets add to both. A bitmap asset (class `0x80804A69`) holds groups of frames, and each
frame is a texture tag. A second layout with its own classes, marked by root byte `+8` set to 1,
holds the same shape.
`c_icon_widget` picks its group with `0x606` and its frame with `0x607`. A group index past the
bitmap's group count draws nothing.

A bitmap reference has two legal states: `0xFFFFFFFF` for none, or a live handle. Any other value
passes the "is set" test and resolves to an unallocated descriptor, which hangs the client.

## Building and running a screen

### Construction

The client builds a hierarchy's widgets in order: imports first, then the resource's own name and
type arrays together. Each widget gets its name and a sequential index. Parent linking then skips the
first hierarchy row and reads `{parent, id}` from every other row. A parent that is negative as a
signed 16-bit value, or not below the allocated count, destroys that node. `0x7FFF` is always out of
range. Children are linked in stored row order, not id order.

Stored properties and binding endpoints are checked against the node slots before use. A binding
needs both endpoints to resolve.

### Screens at run time

A single screen manager holds two layers. Each layer is a linked list of open screens. The draw
walks layer 0, then layer 1, each from head to tail. What the two layers mean is unverified.

A screen is inserted before the first screen with a higher priority. A stable sort then moves
screens with flag bit `0x10` after the others. Each layer keeps a top active screen: the last screen
in the list whose flag bit `0x2` is clear and whose widget state bit `0x4` is set. Whether that is
the input focus is unverified. A screen with widget state bit `0x8000` is destroyed on the next layer
update.

Every widget starts with the same head:

| offset | field |
|---|---|
| `+16` | type descriptor |
| `+24` | hierarchy tag |
| `+28` | 16-bit node index |
| `+36` | name hash |
| `+48` | parent |
| `+56` | sibling link |
| `+72` | child list head |

So a widget's hierarchy tag and node index match the package's hierarchy and node id. A widget's
float slots 1 to 4 are its parent-local X, Y, width and height. Slot 6 is its visibility, set by
`0x201`. Slots 8 and 9 are a bitmap's group and frame. An animation can add an offset to any slot.

A text widget picks its text from one of several sources. One is UTF-16 text, up to 1024 units.
Another is UTF-8 text, decoded into 1024 units, with bad sequences shown as U+25A1.

## Examples from the HUD

### Waiting for Other Players

The label `Waiting for Other Players` sits in a HUD resource shared by the PvE, PvP and social HUDs.
Its frame's visibility comes from one inverted binding: the frame shows when a source node's
"ready" property is false. That property is `local_ready && gameplay_state != 6`. So the label means
the client's own HUD-ready test is false. It is not a count of other players.

`local_ready` needs two local state transitions to finish, and the activity lifetime state not to be
6, 7, 8 or 10. `gameplay_state` comes from one gameplay switch, key `0xB3C1251B`. Payload
`0xDC9B0994` selects state 6 and forces the label on. The label clears when the host replays the
client's exact activity-selection descriptor in activity message 1.

### The waypoint presentation

The in-world waypoint presentation is `c_cui_thud_waypoint_container`. It receives a finished marker
record, with screen position, heading and distance, and does not compute a route.
[Activities and destinations](/docs/destiny-2/activities-and-destinations/#waypoints-in-the-world)
says where the marker comes from.

## Open questions

- The meaning of most selectors and of the slot element codes.
- The three object type ids.
- The UI name hash routine, which would name the 251 view hashes.
- Why every screen is stored twice.
- Which container rules produce the final rectangle.
- What selector `0x202` does, and which widget state bit keeps a widget out of the draw.
- What the two screen layers mean, and how a nested hierarchy joins a screen's tree.

## Related pages

- [Behaviors](/docs/destiny-2/behaviors/#ui-logic) -- node bindings and the investment expression
  component.
- [Rendering](/docs/destiny-2/rendering/) -- the renderer the UI draws through.
- [Packages](/docs/destiny-2/packages/) -- how the UI blobs are stored.
- [Edit CUI screens](/docs/sunrise-studio/cui/) -- editing these screens in Sunrise Studio.
