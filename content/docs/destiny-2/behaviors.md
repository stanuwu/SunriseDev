---
title: "Behaviors"
date: 2026-11-08
description: "The compiled logic in the packages: object behaviors on entities, perk programs, unlock expressions and UI bindings. How each runs, and how to decompile and recompile it."
weight: 38
---
Content logic in the packages is compiled data, and native code runs it. No script interpreter for
content is known in the client. Four kinds carry the logic of entities, perks and screens:

| kind | root | installed | runs when |
|---|---|---|---|
| [object behavior](#object-behaviors) | class `0x8080941E` | 1,518 roots in 102 packages | the owning object's update reaches it |
| [perk program](#perk-programs) | class `0x808040B5`, 208 bytes | 1,691 | the perk receives an event |
| [unlock expression](#unlock-expressions) | expression records | inline in records, plus 6,541 shared rows | code or the UI reads a gate |
| [UI binding](#ui-logic) | class `0x808046D8`, 56 bytes | 19,587 | the UI updates |

Object behaviors and perk programs share one small expression bytecode,
[the expression VM](#the-expression-vm). Unlock expressions have their own stack machine. UI
bindings are plain data rows.

Other compiled data has its own page:

- Material programs (TFX) are on [Rendering](/docs/destiny-2/rendering/). They share opcode numbers
  with the expression VM but run on a larger interpreter.
- Particle emitter programs are on
  [Effects and particles](/docs/destiny-2/effects-and-particles/#emitter-programs).
- Actor commands are on [Actors and AI](/docs/destiny-2/actors-and-ai/#command-records), and
  the compact behavior programs actors and scenes run are on
  [Actors and AI](/docs/destiny-2/actors-and-ai/#actor-behavior-programs).

Two things look like programs and are not. The class `0x80800000` entries are class records, not
scripts; see
[Schema handles](/docs/destiny-2/tags-and-definitions/#schema-handles). And the packages hold no Lua
chunks. Destiny 1's Lua-style chunk format does not occur.

Container rules shared by all four, such as typed arrays, are on
[Packages](/docs/destiny-2/packages/#typed-arrays).

## The expression VM

A small stack machine over `float4` values. Object behavior conditions, counters and channel writes
use it, and so do perk value expressions and entity value providers.

### The record

An expression sits inside a wrapper that lists its inputs:

```c
struct ExpressionWrapper {        /* class 0x80809419, 64 bytes */
    uint64_t input_count;         /* +0x00 */
    int64_t  inputs_rel;          /* +0x08  rows {u8 selector; u8 pad[3]; u32 channel hash} */
    Expression expression;        /* +0x10 */
};

struct Expression {               /* 48 bytes */
    uint64_t code_count;          /* +0x00 */
    int64_t  code_rel;            /* +0x08  bytecode, 1-byte elements */
    uint64_t constant_count;      /* +0x10 */
    int64_t  constants_rel;       /* +0x18  float4 constants, 16 bytes each */
    uint64_t input_count_copy;    /* +0x20  the wrapper's input count, in installed behaviors */
    uint32_t active;              /* +0x28  1 for a non-empty program, 0 for an empty one */
    int32_t  native_override;     /* +0x2C  0 runs the bytecode */
};
```

A nonzero `native_override` selects a native evaluator instead of the bytecode. Every installed
program holds 0.

An input row's selector picks the object to read. For object behaviors, 0 is the current target, 1
the context's primary object and any other value its secondary object. The channel hash names a
`float4` channel on that object. Perk expressions read different inputs; see
[Perk programs](#perk-programs).

### Opcodes

| opcode | width | effect |
|---:|---:|---|
| `01` | 1 | add |
| `02` | 1 | subtract |
| `03` | 1 | multiply |
| `08` | 1 | minimum |
| `09` | 1 | maximum |
| `0C` | 1 | merge two vectors |
| `12` | 1 | multiply-add: `a * b + c` |
| `13` | 1 | clamp: `clamp(a, b, c)` |
| `22 xx` | 2 | permute lanes; `xx` packs four 2-bit lane selectors |
| `34 xx` | 2 | push constant `xx` |
| `3C xx` | 2 | push input `xx` |
| `3D xx` | 2 | push from a second input array |
| `3E xx` | 2 | pop into output `xx` |

Arithmetic works on all four lanes at once. The interpreter refuses an opcode above `0x3E`. The
table lists the opcodes installed behaviors use; value providers use more of the cases. There is no
return opcode: the program ends at the end of its bytecode. Callers turn a NaN or infinite result
into zero.

The installed object behaviors hold 1,380 expressions. The 1,351 non-empty ones are 4 to 19 bytes
long, and there are only 22 distinct byte strings. Examples:

```text
x + 1              3C 00 34 00 01 3E 00
x * 100            3C 00 34 00 03 3E 00
a * 45 + b         3C 00 34 00 3C 01 12 3E 00
clamp(a - b, c, d) 3C 00 3C 01 02 3C 02 3C 03 13 3E 00
```

## Object behaviors

Objects in activities and destinations carry behavior programs. A program runs on the client, with
no server or wire trigger. The object's own per-frame update starts it once the object exists.

Behavior is object-scoped. There is no behavior field on an activity itself. It is always on a
placed object inside the activity or destination. Each root belongs to an object class
(`0x80809C0F`) through a component config (`0x80809C36`).

| roots | package family | content |
|---:|---|---|
| 853 | `w64_activities` | strikes, dungeons, arenas, forges, modifiers |
| 352 | `w64_raids` | raid encounter mechanics |
| 125 | `w64_sandbox` | abilities, weapons, talents, status effects |
| 102 | `w64_environments` | destination environment behaviors |
| 33 | `w64_globals` | shared |

They are the client half of a mechanic: animation, effects, local status, conditions and local
spawns. The encounter sequence is host policy and is not in these programs.

### The program tree

| class | size | role |
|---|---:|---|
| `0x8080941E` | 24 | root; element array at `+0x08` |
| `0x8080941F` | 16 | element array wrapper |
| `0x80809420` | 16 | element: name hash, then a relative pointer to a node at `+0x08` |
| `0x80809422` | -- | common node base |

Each node's class word sits 4 bytes before its payload. A node that has children holds its own root
records, so the tree nests.

### How a program starts

Components do not post a "run behavior" message. The engine calls a fixed method slot on the
component class. Each class has a table of 16-byte records:

```c
struct ClassMessageRecord {  /* 16 bytes */
    void    *handler;        /* +0x00 */
    uint32_t msg_id;         /* +0x08  hash; not compared on dispatch */
    uint16_t argc;           /* +0x0C */
    uint16_t flags;          /* +0x0E */
};
```

A bound method is `{class, slot index, target}`. Dispatch reads `table[slot]`. The message id is
never compared, so one table can hold the same id twice.

Two ids are known: `0x67774671` is construct and `0x3088896A` is destruct.

```c
void Object_Update(Object *o)
{
    /* bound methods set from the authored definition at construct */
    for (BoundMethod *m : o->update_methods) {
        ClassMessageRecord *r = &class_table(m->cls)[m->slot];
        r->handler(resolve(m->target));
    }
}

/* One submitter: a timeline behavior */
void TimelineBehavior_Update(Component *c)
{
    float t = now() - c->start_time;               /* stamped at construct */
    for (Threshold *th : c->def->thresholds)
        if (crossed(th, t))
            BehaviorRoot_Execute(th->root, c);
}
```

Which slot submits depends on the component subtype. Of 30 subtypes in the shipped programs, 13
submit, 16 are passive config holders, and 1 is unverified. A program on a passive subtype never
runs through that path.

A program also runs when a state variable changes. A state-variable commit runs every program row
whose value range contains the new value.

### What stops a program running

| stage | what refuses |
|---|---|
| spawn | the object was never spawned |
| construct | a component fails and the whole object is dropped |
| submit | the component subtype has no submitting slot |
| condition | the condition's input channel has no producer |
| interaction | the interaction eligibility check refuses |

### Inputs are object-local channels

A condition reads a named `float4` channel on an object, found by name hash. Global gameplay
switches do not feed these channels. The known server route is the `combatant_sensor` slot's Auth
body. It carries up to 16 `{channel hash, float}` rows, and the client writes them into the actor's
channels.
See [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/#type-2-combatant_sensor).

### The source text

The packages ship the designer's source text beside the node that uses it. 986 of the 1,518
programs carry some:

```text
light_mote_value > 9
dark_mote_value + 1
taken_cleanse_available == 1
```

The client never reads this text. It runs the compiled expression next to it.

Each identifier in the text hashes, with 32-bit FNV-1, to the variable id the program uses.
`dark_mote_value` hashes to `0xFD8B2877`, the target hash of the assignment that writes it. The
identifiers in all source strings name 227 of the 270 distinct variable ids.

A program that writes a variable another program reads can start it. 21 variables have a writer
and a different reader. The match is by name only, so two objects that use the same variable name
cannot be told apart.

### Node types

The engine registers 27 node types. The names are the game's own.

| node | class | what it does |
|---|---|---|
| `add_hop_on` | `0x80804E41` | creates one object per target from a spawn entry |
| `channel_link` | `0x80802DA6` | links two objects and attaches them at named nodes |
| `counter` | `0x80804E40` | writes a clamped integer; runs programs whose range covers the new value |
| `defer` | `0x80804E3F` | runs its children with the same context |
| `exit_seat` | `0x80802A6E` | queues a seat-exit record on linked objects |
| `external` | `0x80804E3E` | runs another object's element list |
| `filter` | `0x80804E3D` | splits targets into pass and fail sets by its conditions |
| `global` | `0x80804E3C` | builds a target list from all players and/or all actors |
| `incident` | `0x80804E3B` | posts an incident |
| `investment_unlock_flag` | `0x80804E39` | branches on an account unlock flag |
| `kill` | `0x80804E3A` | destroys the target |
| `navpoint` | `0x80804E38` | posts a navpoint record |
| `player_custom_interaction` | `0x80804E35` | submits action kind 70 per target |
| `player_custom_interaction_extended` | `0x80802A66` | the same, with a candidate list |
| `redirect` | `0x80804E31` | rebinds the context, then runs children |
| `relative_teleportation` | `0x80802907` | moves an object by a relative transform |
| `remove_hop_on` | `0x80804E30` | attaches a pooled record; name unverified |
| `resource` | `0x80804E27` | queues a resource change |
| `search` | `0x80804E23` | spatial query; feeds found objects to children |
| `select` | `0x80804E1C` | scores and sorts targets; top n run one branch, the rest another |
| `spawn` | `0x80804E19` | spawns one object per target |
| `spawn_projectile` | `0x80804E17` | spawns, aimed at a second object |
| `spawn_random` | `0x80802DA7` | spawns at a random, checked position |
| `storage_channel` | `0x80802A6F` | writes an expression result into a named channel |
| `target` | `0x80804E10` | adds, removes, clears or iterates a target roster of at most 16 |
| `timer` | `0x80804E0F` | creates a keyed pooled record; name assumed |
| `town_presence` | `0x80804E0E` | writes one byte into a per-player structure |

Action kind 70 and the other action kinds are on
[Actors and AI](/docs/destiny-2/actors-and-ai/#action-kinds).

`counter` and `storage_channel` hold a target hash at `+0x00`, a relative pointer to their source
text at `+0x08` and an expression wrapper at `+0x10`. `filter` is 104 bytes: its conditions at
`+0x08`, the pass branch's root at `+0x28` and the fail branch's root at `+0x48`.

`target` holds a resource name hash and a relative pointer to one of four arms. The arm's class word
sits 4 bytes before it:

| arm | class | what it does |
|---|---|---|
| add | `0x80804E15` | adds the context's object to the roster and runs the join program |
| remove | `0x80804E14` | removes it and runs the leave program |
| clear | `0x80804E13` | runs the leave program for all members, then empties the roster |
| for-each | `0x80804E12` | runs an inline program over every member |

### Dispatch

Each registry row carries a flag. With the flag set, the dispatcher first drops targets whose
object slot is not allocated, caps the list at 32, and passes the result. Eight types manage their
own targets and take the raw list: `external`, `filter`, `global`, `incident`, `redirect`,
`relative_teleportation`, `search` and `select`.

```c
void BehaviorNode_Dispatch(NodeType *t, void *payload, Context *ctx)
{
    if (!t->prefilter)
        return t->invoke(payload, ctx);

    Context c = *ctx;
    c.count = 0;
    for (uint32_t id : ctx->ids)
        if (SObject_SlotAllocated(id) && c.count < 32)
            c.ids[c.count++] = id;
    t->invoke(payload, &c);
}
```

### Object filters

The `filter` node holds a list of conditions. There are 21 condition types: 19 leaf filters and two
that nest.

| filter | filter | filter |
|---|---|---|
| `activity_flag` | `dead` | `object_label` |
| `actor` | `distance` | `object_type` |
| `airborne` | `faction` | `player` |
| `channel` | `faction_relationship` | `resource` |
| `has_parent` | `hop_on` | `same_object` |
| `damage_owner` | `line_of_sight` | `scoreboard_stat` |
| `team_side` | `composite` | `external` |

`channel` is verified. The other leaf names are assumed, from registration order. Six of them
match what their code does.

`composite` holds a nested list, which is how AND and OR trees nest. `external` evaluates another
object's list.

```c
struct PredicateList {
    uint8_t  mode;         /* +0x00  0 = AND, 1 = OR */
    uint8_t  pad[7];
    uint64_t count;        /* +0x08 */
    int64_t  elems_rel;    /* +0x10  self-relative, 16-byte elements */
};

bool ObjectFilter_EvaluateList(PredicateList *l, Context *ctx)
{
    if (l->count == 0)
        return true;       /* an empty list is true */
    for (uint64_t i = 0; i < l->count; i++) {
        bool r = evaluate(element(l, i), ctx);
        if (l->mode == 0 && !r) return false;
        if (l->mode == 1 &&  r) return true;
    }
    return l->mode == 0;
}
```

The `channel` filter (class `0x80804D7D`, 144 bytes) compares two expressions:

```c
struct ChannelFilter {              /* 144 bytes */
    int64_t           source_rel;   /* +0x00  the source text */
    ExpressionWrapper lhs;          /* +0x08 */
    ExpressionWrapper rhs;          /* +0x48 */
    uint8_t           mode;         /* +0x88 */
};
```

It compares the X lane of each result:

| mode | test |
|---:|---|
| 0 | `abs(lhs - rhs) < 0.001` |
| 1 | `abs(lhs - rhs) >= 0.001` |
| 2 | `lhs <= rhs` |
| 3 | `lhs >= rhs` |
| 4 | `lhs < rhs` |
| 5 | `lhs > rhs` |

## Perk programs

A perk program (class `0x808040B5`, 208 bytes) is a graph of native operations. Each condition and
effect is fixed native code. The program picks the operations, sets their inputs and puts them in
phases. Its arrays define phases, not free execution edges. How a perk reaches its program is on
[Weapons and perks](/docs/destiny-2/weapons-and-perks/#sandbox-perks).

| root offset | content | row class |
|---|---|---|
| 16 | feedback rows: what shows in the HUD buff tray | `0x80804083` |
| 32 | activation conditions | `0x808040BA` |
| 56 | effects while active | `0x808040AC` |
| 72 | deactivation conditions | `0x808040BA` |
| 88 | conditions for leaving cooldown | `0x808040BA` |
| 104 | stack-specific phase records | -- |
| 128 | an optional object-property hash for the perk counter | -- |
| 136, 144, 152 | activation, deactivation and cooldown event masks | -- |
| 160 | bit i set when root effect i is opcode 32 | -- |
| 184 | a native context selector byte | -- |
| 200 | the highest stack-branch index, -1 for none | -- |

Each phase array holds 8-byte relative pointers. Each points at a payload whose class word sits 4
bytes before it.

A condition starts with a probability float, a stat-override byte, an event opcode at `+5`, a "has
state" byte at `+6` and a condition index at `+7`, unique within the program. State records are
handed out in array order, only to conditions with `+6` set, so a wrong `+6` shifts every later
condition's record. A phase's event mask must hold the opcode bit of every condition in that phase,
or the client refuses the event. An opcode 35 condition also needs its inner condition's bit, and an
opcode 26 counter needs the bit of every row. All 1,691 installed programs satisfy this.

An effect starts with its opcode byte. Byte `+1` is set exactly when the opcode allocates a 64-byte
effect state. As with conditions, a wrong `+1` shifts every later effect's state. Several opcodes
are decoded:

| effect | what it does |
|---:|---|
| 1, 2, 3 | spawn an object, once or driven by an expression |
| 5 | spawn orbs |
| 8 | add ability energy to a slot (grenade, super, melee, class ability; the slot order is assumed) |
| 10 | write an object property: set, add, subtract or multiply, with optional restore |
| 11 | modify ammo drops per category: interval, chance and repeat chance |
| 13 | drop ammo |
| 14 to 16 | add or refill ammo |
| 32 | extend timers |
| 40 | a damage multiplier, filtered by element and labels |
| 42 | add to or set the perk counter |
| 48 | names an object behavior root (class `0x8080941E`); that it runs the root is assumed |

Every installed condition and effect kind has a decoded layout. The meaning of many is known only
from field names.

| condition | event |
|---:|---|
| 0 | always true |
| 1 | a timer, duration at `+8`, at least 0.0001 s |
| 2 | a kill, with victim and damage filters |
| 3 | kill credit |
| 4 | damage dealt |
| 5 | the owner is damaged |
| 6 | ammo picked up |
| 13 to 18 | counter tick, item equipped, unequipped, readied, stowed and item event |
| 19 | reload |
| 20, 35 | while a state property is in a range; 35 also gates an inner condition |
| 21 | another player killed |
| 26 | a counter over other conditions |
| 27 | a shot resolved |
| 31 | all of several condition groups |
| 42 | a finisher |

Opcode 20 and 35 conditions name a property by FNV-1 hash. Ten names are known:
`super_active`, `is_thermal`, `is_arc`, `is_void`, `reloading`, `nearby_enemy_count`,
`melee_energy`, `equipped_item_magazine_fraction`, `is_guarding_with_sword` and
`melee_overcharge_state`.

### Perk expressions

Effects such as 2, 8, 10, 16 and 53 hold a 48-byte expression in the
[expression VM](#the-expression-vm) format, with no input wrapper. An input selector byte in the
effect picks what the expression reads. Selector 0 is the perk counter. Selectors 1 (missing
rounds), 2 (rounds in the magazine) and 11 (a value of the target) are assumed.

A constant needs one float4 constant and the bytecode `34 00 3E 00`.

### Label filters

Damage labels are bits in a 306-label table, with 22 named label groups. A label set holds four
arrays of labels. Each array's mask is the OR of its labels and groups. The set compiles into one of
two filter kinds:

| kind | masks |
|---:|---|
| 0 | any-of and none-of; used when arrays 1 and 3 are empty |
| 1 | any-of, all-of, none-of and not-all-of |
| `0xFF` | no filter; all four arrays are empty |

Label 9 is `precision`. Named label groups include `weapon`, `vehicle`, `biped`, `grenade`,
`melee`, `super`, `ability`, `player`, `ammo` and `turret`.

### The perk lifecycle

A perk enters state 0 when it is granted. An activation event passes when its phase mask admits it
and the conditions pass. The effects then activate. Deactivation removes the active effects and
evaluates cooldown. An empty cooldown phase returns the perk to state 0, which re-creates an
activation timer when the program has one. So a timer program repeats.

A perk with an always-true activation and no deactivation conditions stays active until it is
removed. Removal still runs each effect's deactivation.

### HUD buff feedback

A perk shows in the HUD buff tray only through a feedback row. Effects alone never reach it. A
status row holds a phase mask, a status hash, a priority, two stack display floats, a counter
selector and a timer flag. The status hash keys both an icon library and the label text:
`0xF2ED5B38` is "Ammo Finder". The status component keeps at most four entries, by priority, merging
equal hashes. That this component is the drawn tray is assumed.

A row shows by perk state: state 0 needs mask bit `0x01`, state 1 `0x06`, state 2 `0x08`, and bit
`0x10` always shows.

### Ammo-drop modifiers

Effect 11 adds and removes the same floats for Primary, Special and Heavy ammo: an interval
reduction, a chance-scale bonus and a repeat chance. The drop logic applies the interval factor
`(1 - reduction)` and the chance factor `(1 + bonus)`. These change drop generation. They never
fill a weapon's magazine.

## Unlock expressions

Much of what the client shows is gated by unlock expressions over flags and values. The flags and
values themselves are on
[Items, characters and inventory](/docs/destiny-2/investment-data/#unlock-flags-and-the-evaluator).

An expression record is `{u32 count; ...; i64 offset}`. Its instructions are 8 bytes each: the
opcode byte at `+0` and the operand at `+4`. Opcodes 1, 10 and 12 read the operand as a u16, and
opcode 11 reads it as a u32. The evaluator is a stack machine over 32-bit integers. `a` is the value
pushed first and `b` the top.

| opcode | meaning | opcode | meaning |
|---:|---|---:|---|
| 1 | push a flag | 15 | `a < b` |
| 2 | NOT | 16 | `a <= b` |
| 3 | OR | 17 | `a + b` |
| 4 | AND | 18 | `a - b` |
| 5 | NOR | 19 | `a * b` |
| 6, 9 | not equal | 20 | `a / b` |
| 7 | NAND | 21 | `a % b` |
| 8 | equal | 22 | negate |
| 10 | push a value | 23 | FNV-1a of the value |
| 11 | push a constant | 24 | FNV-1a of `b`, seeded with `a` |
| 12 | evaluate a shared-pool row | 25, 26, 27 | `&`, `\|`, `^` |
| 13 | `a > b` | 28 | bitwise NOT |
| 14 | `a >= b` | | |

- Opcodes 2, 22, 23 and 28 replace the top value. Opcodes 3 to 9, 13 to 21 and 24 to 27 pop `b`.
- Comparisons, division and remainder are signed. A zero divisor pushes 0.
- Nothing guards `INT_MIN / -1`, so that pair crashes the client.
- Both hashes take the value's four bytes in big-endian order. Opcode 23 starts from `0x811C9DC5`.
- The evaluator skips any opcode outside 1 to 28.

```c
int32_t unlock_run(const EvalState *s, const ExprRecord *e)
{
    int32_t stack[256];
    int sp = 0;
    const Instr *ins = expr_instructions(e);
    for (uint32_t i = 0; i < e->count; i++) {
        int op = ins[i].op;
        int arity = op_arity(op);            /* push 0, unary 1, binary 2, unknown -1 */
        if (arity < 0)
            continue;                        /* unknown opcode: skipped */
        if (sp < arity || (arity == 0 && sp == 256))
            continue;                        /* reported as an error and skipped */
        switch (op) {
        case 1:  stack[sp++] = s->flags[(int16_t)ins[i].operand] == 2; break;
        case 10: stack[sp++] = s->values[(int16_t)ins[i].operand];     break;
        case 11: stack[sp++] = ins[i].operand32;                       break;
        case 12: stack[sp++] = pool_eval(s, ins[i].operand);           break; /* raw result */
        case 2: case 22: case 23: case 28:
            stack[sp - 1] = unary_op(op, stack[sp - 1]);
            break;
        default: sp--; stack[sp - 1] = binary_op(op, stack[sp - 1], stack[sp]); break;
        }
    }
    return sp == 1 ? stack[0] : 0;
}

bool unlock_eval(const EvalState *s, const ExprRecord *e)
{
    if (!e || e->count == 0)
        return true;                         /* callers treat "no expression" as a pass */
    return unlock_run(s, e) != 0;
}
```

The shared pool holds numeric helpers, not only gates. It has 6,541 rows of 24 bytes: a name hash
at `+0` and an expression at `+8`. Opcode 12 pushes the pooled row's number, and the enclosing
expression decides what it means.

## UI logic

Screens hold no program code. Their logic is node bindings and, for account state, one component
that publishes an unlock expression. The widget tables the bindings sit in are on
[The UI format](/docs/destiny-2/ui-format/#widget-tables).

### Node bindings

A node binding reads one node's property and writes another's.

```c
struct UiNodeBinding {             /* class 0x808046D8, 56 bytes */
    uint16_t node_a, node_a_copy;  /* +0x00  source node id */
    uint32_t pad0;
    int64_t  slot_a_rel;           /* +0x08  self-relative, to a slot */
    uint64_t selector_a;           /* +0x10 */
    uint16_t node_b, node_b_copy;  /* +0x18  destination node id */
    uint32_t pad1;
    int64_t  slot_b_rel;           /* +0x20 */
    uint64_t selector_b;           /* +0x28 */
    int64_t  transform_rel;        /* +0x30  self-relative; 0 copies the value unchanged */
};
```

Node ids in a binding are local to the resource. When a hierarchy imports a resource at a nonzero
start, the screen's node id is the local id plus that start. Local node 0 of an import is its
placeholder in the parent.

The optional transform turns the value on the way through. 1,682 of the 19,587 installed bindings
have one. Its class word sits 4 bytes before it:

| class | kind | record |
|---|---|---|
| `0x808046E0` | 0, not | no operand |
| `0x808046DC` | 1, compare integer | code at `+1`, operand at `+4` |
| `0x808046DB` | 2, compare float | same |
| `0x808046DA` | 3, compare hash | same |

The compare codes are `==`, `!=`, `<`, `<=`, `>=` and `>`, numbered 0 to 5, with the source value on
the left. That the integer and float kinds use the same table is assumed.

A value crosses types through ordinary conversions. Int to float is numeric, so values past 24 bits
can round. Int to bool tests nonzero.

### Investment expression results

`cui::c_investment_unlock_expression_component` exposes one shared-pool
[unlock expression's](#unlock-expressions) integer result to the UI:

| selector | value |
|---|---|
| 0 | the expression's name hash, writable |
| 1 | the integer result |
| 2 | whether a non-empty expression was found |

Selector 1 holds the raw integer, not a bool. A binding then converts it. The result refreshes when
the account's family-4 objects reach a new version.

## Decompiling

Every kind can be read without running it. A reader needs the
[typed array rules](/docs/destiny-2/packages/#typed-arrays) and three more:

- A payload's class word sits 4 bytes before it. Dispatch on that word, as the game does.
- Pointers inside a tag are relative to the field that holds them. 0 means none.
- Two pointers can share one payload. Visit each offset once.

Expressions decompile by running the stack on text instead of numbers. Each push becomes a name or
a number, and each operation joins its operands:

```text
3C 00 34 00 3C 01 12 3E 00
push input 0         -> x
push constant 0      -> x, 45
push input 1         -> x, 45, y
multiply-add         -> (x * 45 + y)
pop into output 0    -> output = x * 45 + y
```

A program is well formed when the stack holds nothing extra at the end and output 0 was written.
Every installed behavior expression meets that, and every operand index is in range.

Names come from the shipped source text. Hash each identifier in a program's source strings with
FNV-1 and match the hash to the program's channel and variable ids. Ids that no source string spells
stay as hashes.

Unlock expressions decompile the same way into infix, with opcode 12 rows expanded from the shared
pool. UI bindings need no decompiling: each row reads as "node A's property, through the transform,
into node B's property".

Sunrise writes the decoded behavior tables into its generated SDK as
[`sunrise/behaviors.lua`](/docs/mission-scripting/generated-sdk/#sunrisebehaviorslua). In game, the
Sunrise menu's Behaviors page lists the compiled roots; see
[Finding things](/docs/mission-scripting/finding-things/).

## Recompiling

Writing a program back follows from the format:

- **Write the bytecode, not the text.** The client runs the compiled expression. A changed source
  string changes nothing.
- **Keep the native operations.** Perk conditions and effects, behavior nodes and filters are
  native code. A program only chooses them, sets their inputs and orders them.
- **Append instead of moving.** Existing relative pointers stay valid when nothing moves. Write new
  payloads and arrays at the end of the tag and point at them. A perk program and a UI hierarchy
  store their own size at `+0x00`; update it.
- **Keep the counters in step.** A perk needs a unique `+7` per condition, the `+6` and `+1` bytes
  that match their opcodes, and phase masks that hold every condition's opcode bit. A wrong value
  shifts every later state record.
- **Close the expression.** Emit postfix: an input is `3C n`, a constant is `34 n`, and each
  operation follows its operands. End with `3E 00`. Keep `native_override` at 0.

A label filter is rebuilt from its label rows. All 1,005 installed compiled filters rebuild byte for
byte this way. An unlock expression compiles from infix to the 8-byte postfix form. A new value slot
also needs a descriptor; see
[Value slots need a descriptor](/docs/destiny-2/investment-data/#value-slots-need-a-descriptor).

Sunrise Studio decompiles object behaviors into a read-only graph. It decompiles and recompiles
perk programs; see [Edit perk behavior](/docs/sunrise-studio/perk-behavior/).

## Open questions

- The submitting slot of one behavior subtype whose handlers are not analyzed.
- The engine names of 18 of the 19 leaf filters.
- The meaning of most perk effect and condition opcodes not listed here.
- What the perk program root bytes `+204` and `+205` do. No reader is known.
- The 43 variable ids no source string names.

## Related pages

- [Actors and AI](/docs/destiny-2/actors-and-ai/) -- the objects these programs run on.
- [Weapons and perks](/docs/destiny-2/weapons-and-perks/) -- how a perk reaches its program.
- [The UI format](/docs/destiny-2/ui-format/) -- the screens bindings live in.
- [Edit perk behavior](/docs/sunrise-studio/perk-behavior/) -- editing perk programs in Sunrise
  Studio.
