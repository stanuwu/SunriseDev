---
title: "The Activity Host protocol"
date: 2026-09-28
description: "How the client talks to the Activity Host: the envelope, the message ids, slots, and the Auth and Sense tables."
weight: 50
---
The Activity Host is the authority for one running activity. It owns what exists, who owns it, and
what state each authored object is in. The client talks to it over a second bdLobby (BAP)
connection, using 59 numbered activity messages.

Message names such as `join_result` and slot type names such as `objective_sensor` are the game's
own. Function and field names are descriptive, not the game's.

## Two kinds of authority

The game splits its world between two systems.

| system | what it owns | transport |
|---|---|---|
| peer simulation | moving objects: bipeds, projectiles, damage, entity fields | engine peer transport over Demonware bdNet (UDP) |
| Activity Host | activity state: lifetime, objectives, squads, timers, HUD, scenes, devices | a second bdLobby BAP link (TCP) |

The peer side replicates simulation objects between machines. The Activity Host does not simulate.
It publishes authored state to "slots" on placed objects, and the client's own simulation acts on
it. The client reports back what it measured.

Three facts matter for a server.

- The activity and destination catalog is inside the client. No content server is needed.
- The local player's own biped is built by a local per-frame call. It needs no peer and no message.
- The Activity Host link is a plain bdLobby connection. The server chooses its address, so the
  whole route into an activity runs on a stack a server already speaks.

## The route into an activity

The client asks for a host, connects to it, and joins. Each step waits for the one before. C is the
client and S is the server.

| step | link | direction | message |
|---:|---|---|---|
| 1 | primary | C->S | bdLobby service 16, 8 bytes: the activity host id it wants |
| 2 | primary | S->C | bdLobby service 17, 16 bytes: echo of that id, IPv4 address and port |
| 3 | -- | -- | the client opens a second BAP connection to that address |
| 4 | second | C->S | bdLobby service 6, 7,719 bytes: a protobuf naming the destination |
| 5 | second | S->C | bdLobby service 7, 137 bytes: a non-zero session id |
| 6 | -- | -- | the client turns service 7 into activity message 10 inside itself |
| 7 | second | C->S | activity message 3 `join_request` |
| 8 | second | S->C | activity message 4 `join_result`, then message 0 `entity_slots_allocated` |

After step 8 the host sends message 1 `global_activity_state`, message 12 `replicate_membership`,
and message 5 `sensor_auth_update` as its state changes.

Field 1 of the step 4 protobuf is the client's own encoded activity-selection request. It carries
the activity, the arrival bubble, the spawn set and the package name. No separate web-service
request is sent for this hop.

## The activity envelope

Activity messages ride inside two bdLobby services.

| service | name | direction | inner header |
|---:|---|---|---|
| 8 | `c->ah not` | client to host | 14 bytes: service id, task id, 8-byte account handle |
| 9 | `b->c not` | host to client | 6 bytes: service id, sequence |

Service 9 is a push, so no request matches it. Its sequence has no reader. Send zero.

### Host to client, service 9

```c
struct ActivityPush {            /* 17 bytes + payload, big-endian */
    uint8_t  discriminator;      /* +0x00  must be 1 */
    uint64_t session_id;         /* +0x01  routes to an activity client slot */
    uint32_t msg_type;           /* +0x09  0 to 58 */
    uint32_t payload_len;        /* +0x0D  must equal the bytes that follow */
    uint8_t  payload[];          /* +0x11  bit-packed body */
};
```

`session_id` is a lookup key, not a free field. The client keeps up to three activity clients. It
scans them for the one whose stored id matches. On no match the router returns success and drops
the message. Nothing is logged.

Two routing arms exist.

| arm | taken when | id compared against |
|---|---|---|
| pre-join | message 4, after `join_request` is sent and before the join | the id in `join_request` field 1 |
| established | after the client accepts a `join_result` | the id `join_result` stored |

Message 4 is the only message the pre-join arm routes. It also sets the id every later push must
carry.

`payload_len` is capped at `0x7D800` bytes. A body that decodes into the simulation queue has a
tighter limit: the queue's per-tick budget of `0x80000` bytes, shared with every other event.

### Client to host, service 8

```c
struct ActivityNotification {    /* 13 bytes + payload, big-endian */
    uint8_t  discriminator;      /* +0x00  1; 2 is legal and takes a different arm */
    uint32_t msg_type;           /* +0x01  activity message id */
    uint32_t payload_len;        /* +0x05  bytes that follow */
    uint32_t session_id;         /* +0x09  the client sends 0 */
    uint8_t  payload[];          /* +0x0D  bit-packed body */
};
```

This header follows the 14-byte inner header. The payload starts 21 bytes into the service 8 body:
8 bytes of account handle, then 13 bytes of this header.

### Body encoding

Every activity body is a Bungie tag-reflection bitstream. The same codec writes the Investment
storage blob.

- Bits are packed most significant bit first. Nothing is byte-aligned.
- A field is written as `value + bias` in `width` bits. The reader subtracts the bias.
- An all-zero field decodes to minus the bias, not to zero. A byte with bias 128 needs raw `0x80`
  to mean 0.
- A field with a presence flag is preceded by one bit. 0 omits the value.
- A field without a presence flag is always on the wire. Skipping it shifts every later field.

A handler that fails to decode drops the message before its consumer runs. Nothing reports it.

## Message ids

The client carries all 59 names, ids 0 to 58, in an ordered table. The ids fall into three
overlapping sets.

| set | count | meaning |
|---|---:|---|
| inbound handler | 21 | the client acts on these when the host sends them |
| client sender | 30 | the client can send these |
| name only | 9 | no sender, no handler, no body schema |

An id with no inbound handler is logged as an unknown message type and dropped. The envelope must
still be valid.

### The main messages

H is the host and C is the client.

| id | name | direction | what it carries |
|---:|---|---|---|
| 0 | `entity_slots_allocated` | H->C | a 1,024-byte mask, one bit per entity slot (8,192); ORed into the client's lease |
| 1 | `global_activity_state` | H->C | the activity descriptor, 146 bytes; the client reads the activity name from it |
| 2 | `world_globals_state` | H->C | enables the activity clock; only the first 64 bits are posted |
| 3 | `join_request` | C->H | a correlation nonce, the activity host id, member identity, player state |
| 4 | `join_result` | H->C | result code, request echo, clock base, initial replication epoch, keepalive interval |
| 5 | `sensor_auth_update` | H->C | the client roster and every slot's Auth state (below) |
| 6 | `sensor_sense_update` | C->H | Sense state the client measured for its slots (below) |
| 7 | `sensor_message` | H->C | writes to an entity the client already holds; cannot create one |
| 8 | `request_activity_host` | local | never on the wire; the transport turns it into bdLobby service 6 |
| 10 | `start_activity_host_response` | local | made inside the client from bdLobby service 7 |
| 12 | `replicate_membership` | H->C | activity membership, 3,696 bytes; needed before a slot grant can apply |
| 15 | `peer_leave_request` | C->H | the player is leaving, with a reason hash |
| 16 | `activity_client_keepalive_request` | C->H | one byte, no schema |
| 19 | `incident` | both | a gameplay event: a definition index, target indices and a payload |
| 20 | `allocate_entity_indices` | C->H | asks for more entity slots; answered with message 0 |
| 21 | `free_entity_indices` | C->H | returns slots |
| 22 | `client_authoritative_data_update` | C->H | client-owned state, including the region it reports |
| 23 | `client_identity_update` | C->H | the member identity record |
| 24, 25 | `claim_authority_over_abandoned_entity_slots`, `purge_abandoned_entity_slots` | H->C | 1,024-byte per-bubble authority masks |
| 28, 29 | `reset_entity_slot_authority_mask`, `..._acknowledgement` | H->C, C->H | a 32-bit token; the client rebuilds its mask and echoes the token |
| 30, 31, 32 | `query_entity_slot_authority_mask` and two responses | H->C, C->H | a 32-bit token; the client answers with per-bubble masks, then the full mask |
| 33 | `abdicate_authority` | C->H | the client gives up authority over a bubble |
| 37 | `connectivity_failure` | both | records one peer key; diagnostic only |
| 38 | `membership_acknowledgement` | C->H | not described here |
| 39 | `send_client_heartbeat` | C->H | not described here |
| 40, 41 | `script_state`, `script_event` | H->C | decoded and discarded in this build |
| 44 | `advance_replication_epoch` | H->C | an 8-bit epoch and one abort bit |
| 45 | `reservations_failed` | H->C | a count and 64-bit keys; stops the client waiting on reservations |
| 47 | `connection_quality_report` | C->H | not described here |
| 52 | `patch_epoch` | C->H | 16 bytes, once a second |
| 54 | `bubble host state update` | H->C | a 32-row status table; only the debug overlay reads it |
| 56, 57 | `perf_request_kill`, `perf_request_reflect` | H->C | decoded and discarded |

In message 0, slot `i` is byte `i/8`, bit `1 << (i%8)`.

The nine name-only ids are 9, 17, 35, 36, 42, 51, 53, 55 and 58. Id 17 is named
`activity_client_keepalive_response`, but the client has no handler for it. The keepalive interval
comes from `join_result` instead.

### Hazards for a host

- **Message 44's abort bit is permanent.** A set abort bit, or a consumer failure on messages 24, 25,
  28 or 30, sets a sticky give-up flag. While it is set, message 5 is ignored for the rest of the
  session.
- **Message 44's epoch must be the previous epoch plus one.** A repeat or a skip ends the client
  with `incorrect epoch sequence`. Never retry it.
- **Message 0 is OR-only.** A later message 0 cannot clear a bit. Send it to answer a join or a
  message 20, not on a timer.
- **Message 12 is applied without checks.** A wrong body is accepted in silence, and one wrong byte
  can remove the local player from the activity.

### `join_result`, message 4

The level-0 record has 18 fields and no presence bits, so every offset is fixed. The minimum body is
6,053 bits, which pads to 757 bytes.

| field | wire bit | width | meaning |
|---:|---:|---:|---|
| 0 | 0 | 570 | the whole `join_request` record; bits 0 to 95 are its nonce and host id |
| 1 | 570 | 3 | result, bias 1; only logical 0 accepts |
| 2 | 573 | 1,024 | host session id as a string, element bias 128 |
| 6 | 1,693 | 64 | activity clock base, in ticks |
| 7 | 1,757 | 8 | initial replication epoch |
| 8 | 1,765 | 16 | peer-heard window, ms |
| 9 | 1,781 | 16 | keepalive interval, ms |
| 17 | 4,005 | 2,048 | active workspace name, element bias 128 |

An accepted `join_result` carries three correlations: the envelope's session id, the nonce in
bits 0 to 31, and the host id in bits 32 to 95. The host id becomes the id every later push must
use. Leaving it zero makes the router drop everything after.

The client's status line prints `Status:IEXGM`. `E` is set by an accepted message 4, `G` by
message 1, and `M` by message 12.

## Slots

A slot is one authored place where the host can publish state. Each placed object in a scenario
declares a slot table. A slot is named by three values.

```c
struct ClientRef {              /* 8 bytes in memory, 55 bits on the wire */
    uint32_t registry_key;      /* +0x00  32 bits, bias 0; the object's key */
    int8_t   slot_type;         /* +0x04  7 bits, bias 1 */
    uint8_t  pad;               /* +0x05 */
    int16_t  slot_index;        /* +0x06  16 bits, bias 32768 */
};
```

The empty key is `0x811C9DC5`, the FNV-1 offset basis. A type or index that decodes to `-1` makes
the resolver refuse the reference.

### Slot types

The slot type says what the slot does. Each type has a component class on the client, and up to two
schemas.

| schema | direction | carried by |
|---|---|---|
| Auth | host to client: what the host decided | message 5 |
| Sense | client to host: what the client measured | message 6 |

A schema of `-1` means the slot has no such state. The client names the three buffers it keeps per
slot: `m_last_received_auth_state`, `m_last_extracted_sense_state` and
`m_last_received_sense_state`.

39 slot types carry an Auth schema. Their names are the engine's own. Examples:

| type | name | Auth size | wire bits (min to max) |
|---:|---|---:|---|
| 1 | `squad_sensor` | 196 B | 24 to 1,313 |
| 2 | `combatant_sensor` | 2,392 B | 11 to 8,228 |
| 3 | `objective_sensor` | 28 B | 2 to 225 |
| 8 | `hud_sensor` | 464 B | 35 to 3,582 |
| 13 | `player_spasaha_sensor` | 760 B | 128 to 4,800 |
| 16 | `scoreboard_sensor` | 5,904 B | 7 to 47,054 |
| 17 | `activity_lifetime_sensor` | 1,300 B | 423 to 2,265 |
| 18 | `activity_timer_sensor` | 64 B | 386 |
| 23 | `device_sensor` | 24 B | 147 |
| 24 | `channel_sensor` | 52 B | 3 to 387 |
| 38 | `task_sensor` | 4 B | 32 |
| 43 | `scene_sensor` | 212 B | 74 to 1,538 |
| 67 | `team_side_sensor` | 136 B | 1,057 |
| 68 | `directive_sensor` | 768 B | 4,802 |

The maximum comes from the schema. Whether the client accepts a body that large is not verified.

Twelve slot types (12, 44, 45, 46, 47, 48, 54, 60, 61, 64, 69 and 72) never have a descriptor, so
they never appear in message 5.

## How an Auth table is encoded

Each schema is a list of 40-byte field descriptors. A descriptor gives the struct offset, a type
code, a presence flag, a nested schema handle, a bias and a width.

```c
struct FieldDescriptor {        /* 40 bytes */
    int32_t  value_advance;     /* +0x00  struct offset step */
    int32_t  second_advance;    /* +0x04 */
    int32_t  flag_bit_index;    /* +0x08  slot in the presence bitmap, not a stream offset */
    int32_t  fourth_counter;    /* +0x0C */
    uint8_t  type_code;         /* +0x10  selects the read and write handler */
    uint8_t  has_presence_bit;  /* +0x11  1: one bit precedes the value */
    uint8_t  pad[2];            /* +0x12 */
    int32_t  sub_handle;        /* +0x14  nested schema, for type code 1 */
    int32_t  params[4];         /* +0x18  { bias, width, ... } for integers */
};
```

The walker reads a presence bit first when the descriptor has one, even for a nested field. Then it
dispatches on the type code.

| code | type | wire form |
|---:|---|---|
| 1 | nested record | the child's fields, in order |
| 2 | bool | 1 bit |
| 3, 7 | int8, uint8 | `width` bits, biased |
| 4, 8 | int16, uint16 | `width` bits, biased |
| 5, 9 | int32, uint32 | `width` bits, biased |
| 6, 10 | int64, uint64 | `width` bits, biased |
| 11 | real32 | quantized to `params[2]` bits over a float range, or raw 32 bits |
| 13 | position | three raw float32, 96 bits; the descriptor has no width |
| 23 | nullable u32 | 1 bit, then 32 bits when present |
| 34 | schema id, then body | a nullable 32-bit schema id, then a body of the schema it names |
| 38 | keyed lane | two 6-bit selectors, then one body from a 10-entry table and one from a 3-entry table |
| 41 | dynamic schema value | 1 bit, a 32-bit handle, then a body of that handle's schema |

Codes 13, 34 and 38 carry no width in the descriptor. A walker that reads the width field counts
them as zero bits and comes out short.

An array field has a count first. The count's width can be wider than the array. The client does not
clamp it, so an encoder must.

Two sub-records appear in many tables.

- The ClientRef above, 55 bits. One Auth body uses it to name another slot.
- A clock window, 353 bits: `{bool running, u64 minimum, u64 maximum, u64 value_at_epoch,
  u64 remaining_at_epoch, u64 epoch, real32 rate}`. Types 18 and 35 carry it.

## Message 5: Auth, and the client roster

Message 5 does two jobs. It tells the client which objects are active (the roster), and it carries
the Auth state for their slots. There is no extra header. The payload is one bitstream.

```c
/* Message 5 body, in wire order. Widths in bits. */
u8        hardwipe_token;      /*   8  checked only if the SignOn feature list enables it */
u64       patch_epoch[2];      /* 128  echo the client's own message 52 */
bit       bubble_block;        /*   1  0 skips the bubble-authority block */
/* ...bubble-authority block, present only when bubble_block is 1... */
u64       token;               /*  64  stored, not validated */
bit       roster_enable;       /*   1  must be 1 */
delta     roster;              /*      group keys, per-key revisions, per-bubble rows */
loop      entity_groups;       /*      see below */
bit       singleton_gate;      /*   1  0 ends the message */
```

The patch epoch must match what the client sends in message 52. On a mismatch the bits are still
read, but the roster change and the object loop are both skipped. It looks like success.

Each entity group, then each object in it:

```c
/* One entity group */
bit   group_present = 1;
u32   group_key;               /* a registry key; 0x811C9DC5 skips the whole group */
u32   filler;                  /* read and discarded */
/* One object block, repeated */
bit   object_present = 1;
ClientRef ref;                 /* 55 bits */
u32   remainder_bits;          /* length of everything below, for skipping */
bit   reset;                   /* only when the slot has an Auth schema; 1 on a first send */
bit   auth_root;               /* only with reset: 1 = a body follows */
...   auth_body;               /* the slot type's Auth fields */
bit   sense_present;           /* only when the slot has a Sense schema; send 0 */
/* ... */
bit   object_present = 0;      /* ends this group's objects */
/* ... */
bit   group_present = 0;       /* ends the groups */
```

The client reads the Auth and Sense schema from its own record for the slot, not from the wire. So
an encoder must know, per slot, whether each schema exists. A wrong guess shifts every later bit in
the message.

The 32-bit remainder lets the client skip a block. It skips when the reference does not resolve, or
when the object belongs to a bubble other than the current one.

### How the client applies an Auth body

```c
void on_sensor_auth_update(Body *b) {
    read_prefix(b);                      /* token, epoch, bubble block, latch */
    if (!epoch_matches(b)) return;       /* silent: nothing below runs */
    apply_roster_delta(b);               /* register or retire groups */

    while (read_bit(b)) {                /* entity groups */
        u32 key = read_u32(b); read_u32(b);
        while (read_bit(b)) {            /* objects */
            ClientRef ref = read_ref(b);
            u32 len = read_u32(b);
            Record *r = resolve(ref);
            if (!r || (r->bubble != current_bubble && r->bubble <= 63)) {
                skip_bits(b, len);       /* silent */
                continue;
            }
            if (r->auth_schema != -1) {
                if (read_bit(b))         /* reset */
                    reset_to_schema_defaults(r->last_received_auth);
                if (read_bit(b))         /* root */
                    decode_delta(b, r->auth_schema, r->last_received_auth);
            }
            if (r->sense_schema != -1 && read_bit(b))
                decode_sense_override(b, r);
            r->dirty = 1;
            r->seeded = 1;
        }
    }

    if (all_records_in_bubble_seeded())  /* one missing object blocks all */
        for (Record *r : dirty_records())
            r->component->apply_auth(r->last_received_auth);  /* per-type applier */
}
```

Three rules follow.

- **Reset-only is a publication.** `reset = 1, root = 0` installs the schema's defaults. It
  overwrites any body sent earlier. So every message 5 must repeat every Auth body the host still
  holds.
- **Apply is all or nothing per bubble.** One registered object with no block keeps every Auth body
  in that bubble from applying.
- **The applier sees the whole record.** Most types copy the record to a fixed component offset
  (usually `+384`). Seven types land elsewhere, and types 3, 39 and 43 scatter it.

## Message 6: Sense

The client sends message 6 when a slot's measured state changes. The body, as Sunrise decodes it:

```c
u64   patch_epoch[2];          /* 128  same value as message 52 */
bit   literal_zero;            /*   1  0 */
bit   root;                    /*   1  Sunrise decodes only the 0 form */
/* One group, repeated */
bit   group_present = 1;
u32   group_key;
u32   group_bits;              /* length of this group's substream */
/*   One object, repeated */
bit   object_present = 1;
ClientRef ref;                 /* its key equals group_key */
...   sense_body;              /* the slot type's Sense fields */
u32   counter;                 /* the client's per-slot counter, plus one */
/*   ... */
bit   object_present = 0;
/* ... */
bit   group_present = 0;
bit   tail = 0;                /* then zero padding to a byte */
```

The trailing counter belongs to the client. It starts at 0, and each message 6 sends the stored value
plus one. A host may overwrite it through message 5's Sense block. The next report then continues
from the written value. The client never compares it to anything.

## Key slot types

### Type 3, `objective_sensor`

The objective and task director. It hands an objective's tasks to squads under authored limits, and
it counts completions itself.

```c
struct ObjectiveAuth {          /* 28 bytes; 225 bits when every field is present */
    int8_t  objective[24];      /* +0x00  7 bits each, each with a presence bit */
    int32_t generation;         /* +0x18  31 bits, with a presence bit */
};
```

The array itself also has one presence bit. A full body is `1 + 24 x (1 + 7) + 1 + 31 = 225` bits.

- **The 24 bytes carry no meaning to the client.** The applier compares each one with its stored
  copy. A difference resets that objective's task counters. Nothing switches on the value.
- **There is no "leave alone" encoding.** A clear presence bit hands the applier a zero. To keep an
  objective, re-send its current byte.
- **The int32 is a reset generation.** A change clears the objective's latch bits.
- **Progress is computed by the client.** A task counter rises when an actor dies, and it goes back
  to the host through Sense. No Auth field sets progress.

### Type 17, `activity_lifetime_sensor`

The activity's lifetime. It has 20 fields and no presence bits, so a host sends all of it or none.
The minimum body is 423 bits.

```c
struct ActivityLifetimeAuth {   /* 1,300 bytes */
    int8_t   state;             /* +0x000  4 bits, bias 1 */
    int8_t   quality_bypass;    /* +0x001  3 bits, bias 1; 4 skips the network-quality check */
    uint8_t  join_flag_inverted;/* +0x002  1 bit; 0 raises join-policy bit 3 */
    uint8_t  pad0;
    int32_t  marker_revision;   /* +0x004  a change rebuilds the directive markers */
    uint32_t spawn_entry_hash;  /* +0x008  selects an authored spawn entry by name hash */
    int32_t  current_bubble;    /* +0x00C  the bubble the activity treats as current */
    uint8_t  switches[1204];    /* +0x010  count (6 bits) + up to 50 gameplay switches */
    int32_t  unused_1220;       /* +0x4C4  decoded, never read */
    int32_t  spawn_override[6]; /* +0x4C8  three {index, hash} spawn-point pairs */
    uint8_t  cycle_override_on; /* +0x4E0  1 bit */
    uint8_t  pad1[3];
    uint32_t cycle_phase;       /* +0x4E4  a phase in [0, 1); read only when the override is on */
    int32_t  selection_id;      /* +0x4E8  0 to 63 installs a record; -1 clears it */
    ClientRef selection_target; /* +0x4EC */
    uint32_t selection_arg;     /* +0x4F4 */
    uint8_t  definition_refs[28]; /* +0x4F8 */
};
```

The lifetime state is read at 28 call sites. Known effects:

| state | effect |
|---:|---|
| 3 | the live case; clears the player's awaiting-spawn bit |
| 4 | loading presentation shown |
| 6 | one activity-complete presentation |
| 7 | screen blurred, movement blocked; 3 or 5 clears it |
| 8 | client returns to orbit |
| 9 | section-complete presentation |

Some of these effects are not verified in the code. None of them are the game's names for the
states. The rest of the enum is unknown.

Encoding traps:

- The state has bias 1, so state 3 goes on the wire as 4.
- Four int32 fields have bias `-2^31`. Zero bits there decode to `INT32_MIN`.
- Turn the spawn-point pairs off with index `0` on the wire and hash `0x811C9DC5`. This is the one
  place where emitting the bias is wrong.
- Only the first registered type-17 slot is read. Send the same body to every type-17 slot in the
  roster.

### Type 1, `squad_sensor`

A request for an authored squad. The client already holds the spawner, the member candidates and
the spawn points in its packages. The host names the slot and sets the request fields. The client's
own spawner then creates the actors.

The Auth record is 196 bytes with 21 fields. It includes slot references, count-plus-array groups,
a positive 31-bit spawn generation, an `active` field (2 bits, bias 1) and a `mode` field (3 bits,
bias 1).

Two behaviors matter.

- On the first apply the client seeds part of the component from the last received Sense, not from
  the Auth.
- The squad reports its own alive count through Sense. A host learns about deaths that way.

### Type 2, `combatant_sensor`

Actor lifecycle for one combatant. It does not select an AI profile.

| field | shape | what the client does |
|---|---|---|
| `.0` | optional i32 | spawn-edge revision; a change runs the activate or destroy edge |
| `.1` | 2 bits, bias 1 | nonzero keeps the actor active; zero tears it down |
| `.2` | 3 bits, bias 1 | actor ownership |
| `.3` | bool | master enable |
| `.4` | 68 bytes | eight keyed result lanes, each `{key, generation}`, and a result mask |
| `.5` | optional 180 bytes | actor control: flags, temperaments, a one-time placement, 16 channel values |
| `.6` | optional 2,064 bytes | a 32-step client-side action program |
| `.7` | optional 72 bytes | eight referenced slots and a registration generation |

Message 5's apply runs only three parts: the spawn edge, a generation, and the keyed lanes. The
actor-control block applies later, when the actor attaches or when the retained state is restored.

The Sense record is 88 bytes. It reports the accepted revisions, the action program's progress, and
two damage-pool fractions in `[0, 1]`. The fractions carry no attacker and no cause.

## Where to read the code

| subject | file |
|---|---|
| service 9 envelope | `src/middleware/bap/activity_message/activity_message_notification_encoder.cpp` |
| message 5 structure | `src/middleware/bap/activity_message/sensor_auth_update.h` |
| Auth bodies by slot type | `src/middleware/bap/activity_message/scriptable_auth_body.h` |
| type 1 and type 2 bodies | `src/middleware/bap/activity_message/squad_auth_body.h`, `combatant_auth.h` |
| message 6 | `src/middleware/bap/activity_message/sense_update.h`, `activity_sense_update_decoder.cpp` |
| schema tables | `src/middleware/bap/activity_message/wire_schema/` |
| host pushes | `src/server/bap/encrypted/push/activity/` |

The source is at [github.com/stanuwu/Sunrise](https://github.com/stanuwu/Sunrise).

## Open questions

- The full lifetime state enum. States 0, 1, 2 and 5 have no known effect.
- Six unnamed `join_result` fields (10 to 13, 15, 16), and the meaning of field 14.
- What reads the global selection record that type 17 fields `.16` to `.18` write.
- The meaning of each type 1 `squad_sensor` Auth field.
- Bodies for the nine name-only ids. None exists in this build.
- Most Auth tables on this page are not verified against a live client.

## Related pages

- [The Activity Host](/docs/sunrise/activity-host/)
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/)
- [Network stack](/docs/destiny-2/networking/)
