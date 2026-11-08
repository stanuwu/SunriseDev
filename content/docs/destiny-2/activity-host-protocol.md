---
title: "The Activity Host protocol"
date: 2026-11-08
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

Give every activity session its own id. With one id for several sessions, the first established
client takes every later `join_result`, and the joining client waits forever. The id also needs the
shape of the account's other ids: the account half in the high 32 bits, class `0x0020` next, then an
index, for example `0x9EAA300100200001`. A bare counter such as 1 is dropped in silence. Which client
check drops it is unverified.

`payload_len` must equal the bytes that follow. The client never compares the two. A larger value
copies stale buffer bytes, and a value of `0xFFFFFF70` or more crashes the client.

A message-5 body must also fit the simulation queue's per-tick budget. The soft limit is 471,859
bytes, shared with every other event in that tick. A body that does not fit is refused, and the
client then ignores message 5 for the rest of the session.

### Client to host, service 8

```c
struct ActivityNotification {    /* 13 bytes + payload, big-endian */
    uint8_t  discriminator;      /* +0x00  1; 2 is legal and takes a different arm */
    uint32_t msg_type;           /* +0x01  activity message id */
    uint32_t payload_len;        /* +0x05  bytes that follow */
    uint32_t peer_heard_mask;    /* +0x09  one bit per peer heard recently; not a session id */
    uint8_t  payload[];          /* +0x0D  bit-packed body */
};
```

This header follows the 14-byte inner header. The payload starts 21 bytes into the service 8 body:
8 bytes of account handle, then 13 bytes of this header.

`peer_heard_mask` sets a bit for each peer heard within the window `join_result` field 8 gives. With
that window at 0 the mask is always 0.

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

The decoder fails only when it reads past the end of the body. A body with unread bits or a trailing
byte decodes fine. A host that refuses such a body is stricter than the client's own codec.

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
| 1 | `global_activity_state` | H->C | the activity state block, 146 bytes: bubble count, per-bubble slice-set states, the selection descriptor (below) |
| 2 | `world_globals_state` | H->C | 33 bits: a bool, then the simulation tick period in ms; a positive period runs the activity clock |
| 3 | `join_request` | C->H | a correlation nonce, the activity host id, member identity, player state |
| 4 | `join_result` | H->C | result code, request echo, clock base, initial replication epoch, keepalive interval |
| 5 | `sensor_auth_update` | H->C | the client roster and every slot's Auth state (below) |
| 6 | `sensor_sense_update` | C->H | Sense state the client measured for its slots (below) |
| 7 | `sensor_message` | H->C | a body passed to the method the target component bound at spawn; cannot create an entity |
| 8 | `request_activity_host` | local | never on the wire; the transport turns it into bdLobby service 6 |
| 10 | `start_activity_host_response` | local | made inside the client from bdLobby service 7 |
| 12 | `replicate_membership` | H->C | activity membership, 3,696 bytes; needed before a slot grant can apply |
| 15 | `peer_leave_request` | C->H | 20 bytes: the player is leaving, with a reason hash (below) |
| 16 | `activity_client_keepalive_request` | C->H | one byte, no schema; sent when the client has sent nothing for the keepalive interval |
| 19 | `incident` | both | a gameplay event: a definition index, target indices and a payload (below) |
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
- **The link times out after 20.5 s of silence.** The client ends the activity with
  `error_host_crashed` when no bytes arrive on the Activity Host link for 20,000 + 500 ms. Any
  well-formed frame resets the clock. No particular message is needed.
- **All activity clients share one sensor heap.** It is 870,400 bytes for the whole process. Every
  object the roster registers takes a sync record from it, and the same object on two links pays
  twice. Publish a bubble's objects only on the link that hosts that bubble. An exhausted heap
  corrupts memory and can crash the client.

### Values that crash the client

The client trusts these fields. A host must clamp them.

| field | safe range | what a bad value does |
|---|---|---|
| type-17 lifetime state | -1 to 10 | 11 to 14 jump through a 12-entry table with no bound check |
| any array count lane, for example the type-17 switch list or type-8 counts | at most the array's size | writes past the end of the array |
| message 54 row count | 0 to 32 | writes past the 32-row table |
| message 19 compressed target selector | leave its presence bit clear | can write past a 64-entry target vector |
| type-68 element index (field 1) | within the authored directive's sub-array | an unbounded signed array index |
| type-68 directive hash (field 0) | a directive the target component authors | reads through a null pointer |
| slot index in a squad bind, or in the 129 type-53 references | the named group's real slot count | reads up to 1.3 MB out of bounds |
| a changed type-38 Auth value | only on a slot whose authored reference resolves | otherwise writes near a null pointer |
| `payload_len` in the service 9 header | the real body length | `0xFFFFFF70` and up crash at once |

### `join_result`, message 4

The level-0 record has 18 fields and no presence bits, so every offset is fixed. The minimum body is
6,053 bits, which pads to 757 bytes.

| field | wire bit | width | meaning |
|---:|---:|---:|---|
| 0 | 0 | 570 | the whole `join_request` record; bits 0 to 95 are its nonce and host id |
| 1 | 570 | 3 | result, bias 1; only logical 0 accepts |
| 2 | 573 | 1,024 | host session id as a string, element bias 128 |
| 3 | 1,597 | 32 | host process id; printed only |
| 4 | 1,629 | 32 | host return code, bias `0x80000000`; printed only |
| 5 | 1,661 | 32 | host handoff nonce; telemetry only |
| 6 | 1,693 | 64 | activity clock base, in ticks |
| 7 | 1,757 | 8 | initial replication epoch |
| 8 | 1,765 | 16 | peer-heard window, ms |
| 9 | 1,781 | 16 | keepalive interval, ms |
| 17 | 4,005 | 2,048 | active workspace name, element bias 128 |

Field 9 sets how long the client waits before it sends a message-16 keepalive. At 0 the client
sends one on every tick, about 144 a second. Any value above 1,000 ms silences them, because the
client sends message 52 every second anyway. Field 6 counts 673,200 ticks per second; 0 starts a new
activity at zero.

An accepted `join_result` carries three correlations: the envelope's session id, the nonce in
bits 0 to 31, and the host id in bits 32 to 95. The host id becomes the id every later push must
use. Leaving it zero makes the router drop everything after.

The client's status line prints `Status:IEXGM`. `E` is set by an accepted message 4, `G` by
message 1, and `M` by message 12.

### `global_activity_state`, message 1

The body is 146 bytes, 1,161 bits, four nested levels. Every field without a presence bit is on the
wire, and the bias rule applies to each.

| wire bits | field | rule |
|---|---|---|
| 67 to 98 | bubble count | 32 bits, bias `0x80000000`; must equal the scenario tag's bubble count |
| 99 to 610 | slice-set state per bubble | 64 bytes, bias 128; `0x80` adds the bubble, `0x7F` skips it |
| 733 | activity name presence | clear means absent, not empty |
| 734 to 1053 | activity name | 40 characters, bias 128; a zero is `0x80` |

The client copies the whole 1,608-byte decoded block over its own copy, with no comparison and no
revision. A re-sent message 1 is applied in full. Readers poll the block. Nothing signals a change.

Most of the block is the client's own activity-selection descriptor, the one it sent in the
Investment PUT that started the route. The host should replay that descriptor exactly. Rebuilding it
from known fields is not equivalent. A rebuilt descriptor leaves the `Waiting for Other Players`
overlay up. The exact replay clears it.

Two more fields matter. One is a list of up to 50 gameplay switches. The other is an activity time
base: the client adds its local elapsed clock, divides by a period and keeps the fraction. Every
member must get the same value, or their phases drift apart.

Message 1 does not carry the activity lifetime state. That comes from the type-17 slot.

### `world_globals_state`, message 2

The body is `{bool flag, real32 tick_ms}`, 33 bits. The float is the simulation tick period in
milliseconds. A positive value lets the activity clock accumulate; zero or negative freezes it. The
scoreboard also divides some stats by `1000 / tick_ms`, the ticks per second. So send the client's
own default, `1000 / 30`. Do not send NaN: two readers test it with different comparisons, and one
clock would run while the other froze. No reader of the bool is known.

### `incident`, message 19

An incident is a replicated gameplay event, not telemetry. The body has five fields, no presence
bits and no biases. The minimum body is 29 bits.

| field | wire form |
|---:|---|
| 0 | 13 bits: an index into the global SObject definition table |
| 1 | 5-bit count, then that many 13-bit extra target indices, at most 25 |
| 2 | 1 bit; when set, a compressed target selector replaces the explicit list |
| 3 | 1 bit gating two 32-bit words that nothing reads |
| 4 | 9-bit length, then that many payload bytes, at most 500 |

The definition table is package content with 7763 rows, sorted by an FNV-1 name hash. Its index
space is global, not per activity. Each row has a signed type code at `+36`, -1 to 48, and the type
code picks the payload schema. Three rows, 795, 4690 and 5375, have type code -1 and crash the
client if named. The client does not bound-check field 0.

With the selector bit clear, the targets are `[field 0, field 1...]`. The payload is decoded with
the schema the type code selects, so a payload must match the definition it names. Message 19 has no
acknowledgement.

### `peer_leave_request`, message 15

The client sends message 15 when it releases an activity slot that is joined and still linked. It
then waits in `shutting_down` until its own timer runs out. No host message ends that wait.

The body is 20 bytes. The reason hash sits at `+16`. It comes from the same table as the bootflow
reason values, so reason 0 is `0x03CFBB27`. The fields at `+4` and `+8` have no known meaning.

The leave is a report, and the host answers with the state change it implies: one message 5 on that
link that removes the client's roster. That message keeps every key and state byte in the roster
array, clears the presence bit of every key that client registered, and sets the roster enable bit.
It carries no Auth bodies and no grant. The client then retires each key cleanly. Send no later
roster on that link.

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

39 slot types carry an Auth schema. Their names are the engine's own. The record size is the
reflection struct size. The wire bits are the smallest legal body (every presence bit 0, every array
empty) and the largest (every presence bit 1, every array full).

| type | name | Auth size | wire bits (min to max) |
|---:|---|---:|---|
| 1 | `squad_sensor` | 196 B | 24 to 1,313 |
| 2 | `combatant_sensor` | 2,392 B | 11 to 8,228 |
| 3 | `objective_sensor` | 28 B | 2 to 225 |
| 4 | `object_sensor` | 368 B | 252 to 525 |
| 5 | `sequence_sensor` | 1,072 B | 7,359 |
| 6 | `cinematic_sensor` | 224 B | 263 to 1,671 |
| 8 | `hud_sensor` | 464 B | 35 to 3,582 |
| 11 | `music_sensor` | 1,048 B | 7,223 |
| 13 | `player_spasaha_sensor` | 760 B | 128 to 4,800 |
| 16 | `scoreboard_sensor` | 5,904 B | 7 to 47,054 |
| 17 | `activity_lifetime_sensor` | 1,300 B | 423 to 2,265 |
| 18 | `activity_timer_sensor` | 64 B | 386 |
| 19 | `player_navigation_sensor` | 7,308 B | 62 to 53,150 |
| 20 | `damage_component_sensor` | 12 B | 87 |
| 21 | `distance_sensor` | 276 B | 98 to 1,868 |
| 23 | `device_sensor` | 24 B | 147 |
| 24 | `channel_sensor` | 52 B | 3 to 387 |
| 25 | `look_trigger_sensor` | 16 B | 65 to 129 |
| 26 | `hop_on_sensor` | 112 B | 186 to 276 |
| 29 | `object_monitor_sensor` | 12 B | 87 |
| 30 | `player_monitor_sensor` | 12 B | 87 |
| 31 | `player_trigger_sensor` | 24 B | 129 |
| 32 | `toggle_sensor` | 12 B | 57 |
| 34 | `object_filter_sensor` | 400 B | 4 to 732 |
| 35 | `activity_hard_wipe_globals_sensor` | 64 B | 359 |
| 36 | `loot_sensor` | 16 B | 88 |
| 37 | `map_generator_sensor` | 1,460 B | 1,750 to 11,350 |
| 38 | `task_sensor` | 4 B | 32 |
| 39 | `passenger_sensor` | 12 B | 86 |
| 40 | `target_sensor` | 8 B | 55 |
| 41 | `new_user_experience_sensor` | 2,120 B | 12 to 9,948 |
| 42 | `performance_sensor` | 48 B | 2 to 357 |
| 43 | `scene_sensor` | 212 B | 74 to 1,538 |
| 53 | `dialog_sensor` | 4,104 B | 19,767 to 27,959 |
| 65 | `ghost_link_sensor` | 12 B | 65 |
| 67 | `team_side_sensor` | 136 B | 1,057 |
| 68 | `directive_sensor` | 768 B | 4,802 |
| 70 | `encounter_engagement_sensor` | 208 B | 23 to 1,496 |
| 71 | `public_event_sensor` | 24 B | 183 |

The maximum comes from the schema. Whether the client accepts a body that large is unverified.
No table here is verified field by field against a live client.

Most types copy the decoded record to component offset `+384`. Types 13, 23, 25, 31, 36, 41 and 65
land elsewhere, and types 3, 39 and 43 write no contiguous copy. The record size equals the byte
count the applier copies on 36 of the 39 types.

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

- Code 13 is stored as a float4 with W = 1.0.
- Code 34 is a finite union of 13 compact predicate schemas, `0x80809571` to `0x8080957D`. Each body
  is a biased i8 mode plus at most a u32, an i32, a bool or a ClientRef. One of the 13 has no
  handler. The selector costs 1 bit when absent and 33 when present. Types 4, 26 and 34 carry code
  34 fields. This union is separate from the 21 object filters the behavior VM uses.
- Code 38 is a finite union too. Its first table has body widths 63, 32, 32, 64, 0, 6, 33, 64, 63
  and 162 bits, its second 0, 0 and 11. One lane costs 6 to 179 bits.

An array field has a count first. The count's width can be wider than the array. The client does not
clamp it, so an encoder must.

Two sub-records appear in many tables.

- The ClientRef above, 55 bits. One Auth body uses it to name another slot.
- A clock window, 353 bits: `{bool running, u64 minimum, u64 maximum, u64 value_at_epoch,
  u64 remaining_at_epoch, u64 epoch, real32 rate}`. Types 18 and 35 carry it. It is one evolving
  timer. `running` false freezes the values. The rate is signed and applies after the epoch; zero
  pauses the timer. The constructor seeds the maximum with 365 days. A zeroed clock is not a
  neutral stand-in for an authored one. So without a real timer, a reset-only body is the safe value.
  The field names are descriptive. The timer behavior is assumed to match the game's
  `c_activity_timer_client_interface`.

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

The hardwipe token is checked only when the SignOn response names the `use_hardwipe_tokens` feature.
Every feature is off unless SignOn names it.

### The bubble-authority block

When `bubble_block` is 1, 65 authority bits follow, one per bubble 0 to 64, then the block itself.
The block opens with a root presence bit and is read as a delta.

```c
/* Bubble-authority block, after the 65 authority bits */
bit   root_present = 1;
bit   header_present;          /* an i32 header, bias -2^31; no reader known; send 0 */
/* 65 elements, bubble 0 first, bubble 64 last */
bit   host_token_present;      /* a u8[8] compared with a simulation record; send 0 */
bit   grant_present;           /* 1 to grant this bubble */
u16   grant_token;             /* only when grant_present */
bit   revoke;                  /* no presence bit; always on the wire */
```

An element that grants nothing costs 3 bits. A granting element costs 19.

The grant is a change, not a value. The client compares the wire token with its own mirror, which
starts at zero, and grants on a difference. The mirror takes the new token on every send of the
block, whether or not anything applied. So set the authority bit and change the token in the same
message. A token sent with the bit clear is spent. After token `0xFFFF`, the next grant uses 1.
Do not change the token to renew a grant the client already holds: a changed token marks the bubble
unseeded and holds back Auth until the next commit.

Bubble 64 is always applied. The per-bubble arm for bubbles 0 to 63 is gated on a flag that is 0 in
this build and that no message sets.

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
bit   sense_present;           /* only when the slot has a Sense schema; 1 overwrites the client's Sense */
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

A region change has one more rule. The client reports the transition in message 22, sweeps its
roster, and then asks for a new one. Send no message 5 between that report and the request, and
answer the request in full. A roster applied while no slice set is current registers nothing, and
its rows outlive their objects.

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

The lifetime state is read at 28 call sites. These effects were seen on a live client:

| state | effect |
|---:|---|
| 1, 2 | HUD hidden |
| 3 | the live case; clears the player's awaiting-spawn bit |
| 4 | loading presentation shown |
| 5 | HUD and view restored, like 3 |
| 6 | one activity-complete presentation |
| 7 | screen blurred, movement blocked; 3 or 5 clears it |
| 8 | client returns to orbit |
| 9 | section-complete presentation |
| 10 | HUD and view restored, like 3 |

Only some of these effects are traced in the code. None of them are the game's names for the
states. Two client checks disagree on the set: the player spawn gate accepts 3, 6 and 10, and a
second predicate accepts 6, 7, 8 and 10. States 11 to 14 crash the client, so send -1 to 10 only.

The other fields:

- `current_bubble` is a bubble index, not a slice-set index. Derive it as the selected region
  divided by 8. 16 client functions compare it with the bubble the player stands in, and that test
  is false unless the type-35 slot's first Auth field is set.
- `join_flag_inverted` is the one field whose absent value is 1. Sent as 0, it raises bit 3 of the
  join-policy flags, and the character data then carries that bit back to the server.
- `cycle_phase` matters only while `cycle_override_on` is 1. Keep the override off unless the host
  owns an authored phase.

Encoding traps:

- The state has bias 1, so state 3 goes on the wire as 4.
- Four int32 fields have bias `-2^31`. Zero bits there decode to `INT32_MIN`.
- Turn the spawn-point pairs off with index `0` on the wire and hash `0x811C9DC5`. This is the one
  place where emitting the bias is wrong.
- Only the first registered type-17 slot is read. Send the same body to every type-17 slot in the
  roster.

The switch list at `+0x010` starts at wire bit 104 with a 6-bit count. Each entry is the client's
runtime switch record: a 32-bit key, a presence bit, a 32-bit value-class handle, then the value. An
i32 entry costs 97 bits, so one entry makes the body 520 bits. This list merges after the activity's
own switch defaults, so it can override them. The switch table is on
[Items, characters and inventory](/docs/destiny-2/investment-data/#the-gameplay-switch-table).

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
- The squad reports itself through Sense. There is no death event in this build.

The Sense fields a host reads:

| field | width | what it reports |
|---|---:|---|
| `.0` | 31 | echo of the Auth spawn generation |
| `.3` | 6 | members alive now; a fall is the only death signal, with no member identity or cause |
| `.11.1[i]` | 32 each | members ever created in slot `i`; never decreases within one spawn generation |
| `.12[i]` | 7 each | 24 objective-cost values |

So a squad has fully spawned when the created counts add up to the request, even after some members
died. The counters reset on a new spawn generation.

### Type 2, `combatant_sensor`

Actor lifecycle for one combatant. It does not select an AI profile.

| field | shape | what the client does |
|---|---|---|
| `.0` | optional i32 | spawn-edge revision; a change runs the activate or destroy edge |
| `.1` | 2 bits, bias 1 | nonzero keeps the actor active; zero tears it down |
| `.2` | 3 bits, bias 1 | actor ownership; 1 and 3 bind a squad member, 4 hands off or tears down, other values own an actor |
| `.3` | bool | master enable |
| `.4` | 68 bytes | eight keyed result lanes, each `{key, generation}`, and a result mask |
| `.5` | optional 180 bytes | actor control: flags, temperaments, a one-time placement, 16 channel values |
| `.6` | optional 2,064 bytes | a 32-step client-side action program |
| `.7` | optional 72 bytes | eight referenced slots and a registration generation |

Message 5's apply runs only three parts: the spawn edge, a generation, and the keyed lanes. The
actor-control block applies later, when the actor attaches or when the retained state is restored.

The keyed lanes are shared. The host's mask bit wins only when its lane generation is newer than
the one the client accepted. The client can raise a lane's bit on an actor event whose key matches.
So the host presets a lane, and the client can only raise it after that.

The actor-control block:

| field | client use |
|---|---|
| `.5.0` | revision; a change reruns the whole block |
| `.5.1`, `.5.2` | six control-flag bits and six apply-mask bits |
| `.5.3` | a count and up to six temperament ids |
| `.5.4`, `.5.5` | a slot reference and a float index on that object: a one-time placement |
| `.5.6` | a count and up to 16 `{channel hash, float}` rows, written to the actor's object channels |

The placement is staged while the component has no actor, and spent once when one appears. The
transform comes from the referenced object, not from the Auth.

Temperaments select native actor behavior variants. The client merges the six ids with actor,
squad, gameplay-switch and package inputs, then looks each one up in a table the actor's behavior
definition owns. The temperament ids have no known names. The installed packages contain 121
packaged temperament actions, ids 0 to 14 without 13, and every one removes rather than adds.

The action program is up to 32 lanes. Each lane picks one client atom. Several match game class
names:

| selector | atom | payload |
|---:|---|---|
| 0 | snap to a point's transform | ClientRef, u8 |
| 1 | `c_client_sequence_atom_control` | u32 |
| 2 | `c_client_sleep_atom_control`, probable | float |
| 3 | `c_client_move_to_atom_control`, probable | ClientRef, u8, bool |
| 4 | `c_client_trivial_atom_control` | empty |
| 5 | `c_client_control_flag_atom_control` | six bits |
| 6 | `c_client_set_temperament_atom_control` | u32, bool |
| 7 | `c_client_set_channel_atom_control` | u32 hash, float |
| 8 | face a point, keeping position | ClientRef, u8 |
| 9 | `c_client_ability_atom_control` | three u32, ClientRef, two i8 |

A new program generation reruns the program when the master enable is set and an actor exists. A
sequence atom times out after 15 seconds by default.

The Sense record is 88 bytes:

| field | what it reports |
|---|---|
| `.0` | the accepted spawn revision |
| `.1` | an actor spatial query, clamped to 2048 |
| `.2` | a local actor-event generation |
| `.3` | atom progress, the accepted program generation, a 2.5-second cadence counter, an action-busy latch |
| `.4` | the eight accepted lane generations and the result bits |
| `.5` to `.7` | the subscription generation, its active flag and a cadence counter |
| `.8`, `.9` | the primary and secondary damage-pool fractions, 7-bit reals in `[0, 1]` |
| `.10`, `.11` | the actor-suppressed latch and the first-Auth-applied latch |

The fractions carry no attacker, no cause and no hit count. A small hit can leave the 7-bit value
unchanged. With no actor and Auth enabled, both fractions read 1. A new spawn revision resets the
whole Sense image.

### Type 4, `object_sensor`

The Sense reports one placed object: whether it exists and whether it died. Only slots whose
authored descriptor enables authority report at all. The 372 other installed type-4 slots never
send Sense.

| field | width | what it reports |
|---|---:|---|
| `.0` | 32 | the Auth generation the client applied |
| `.1` | 1 | an interaction state; meaning assumed |
| `.2` | 1 | the spawned object exists; goes from 1 to 0 when it dies |
| `.3` | 32 | the spawn entry index that was created |
| `.4` | 64 | a mask of every entry index ever spawned |
| `.5` | 2 + n | a count, then up to three replies to request rows in the Auth |

When the object dies, `.2` drops to 0 and `.0`, `.3` and `.4` keep their values. That is a
per-object death on the wire. An interaction latch and an owner reply come back only when the Auth
carries the matching request row.

### Type 5, `sequence_sensor`

Type 5 has no Sense and posts no incident. Despite its name, it is a spawn policy for one authored
object. A change to its Auth state value destroys the live instance. The value then means 0 destroy,
1 arm, 2 spawn. There is no completion to observe.

### Types 30 and 31, volumes and monitors

An authored volume tracks which players are inside it in an occupancy mask. The mask reaches the
host only through these two slot types:

| type | report |
|---|---|
| 30 `player_monitor_sensor` | Sense `{any, all, count, echo}` on message 6, for the volume or object it references |
| 31 `player_trigger_sensor` | a one-shot incident on message 19 when a player enters; no exit report |

A type-30 monitor on an object also counts players attached to it, for example a mounted player. A
volume with neither slot type is invisible to the host.

### Type 65, `ghost_link_sensor`

The Ghost scan bar. The Auth is 12 bytes:

| field | effect |
|---|---|
| `.0` int32 | a generation; only a value above the stored one acts |
| `.1` bool | true spawns the Ghost and arms the bar; false destroys the Ghost |
| `.2` u32 | the interaction hash reported at the end; `0x811C9DC5` keeps the authored one |

Raise `.0` every time `.1` changes. A change without a higher generation does nothing.

The client runs the bar and reports `{active, fraction, generation}` through Sense. The bar's length
is package data. The bar can stall one frame short of the end. The host finishes it: in one
message-5 object block it sends the Auth unchanged and a Sense override with `active` true, a
fraction above 1.0 and the current generation. A fraction of exactly 1.0 does not finish. The finish
posts one incident per bound player through message 19.

### Type 53, `dialog_sensor`

Type 53 has no Sense, and the client sends no receipt when a line plays. The client queues, orders,
defers and cuts lines itself. A row filtered on a volume waits until the player enters it, then
plays once. Each body replaces every row, so a host that fires one line must resend every waiting
row unchanged.

### Type 67, `team_side_sensor`

The Auth is `{i32 side[32], bool, i32}`. After copying it, the applier walks every pair of the 32
teams and sets or clears one bit in a global 496-bit faction allegiance matrix: allied when the two
side values are equal, hostile otherwise. Entries 17 to 28 of the array are never read: team `k`
in 17 to 28 reads entry `k - 17`.

The matrix answers every allied-or-hostile question in combat, targeting and damage. Sending a
type-67 body replaces the whole matrix, including what package content loaded. The constructor's
identity map is not neutral for it: under that map every team is hostile except twelve alias pairs.
Type 67 appears only in Gambit and Crucible content.

### Type 24, `channel_sensor`

A 3-bit count and up to four rows of `{i32 revision, float target, float blend seconds}`. A row whose
revision differs drives one of the target object's output channels toward the target, clamped to
`[-100, 100]`, over the blend time. The rows follow the object's authored output-channel order.

### Type 37, `map_generator_sensor`

Two 680-byte records and a 100-byte state block, 1,750 bits with no tiles. Four integer fields
replace authored worker values only when they are not -1, and a zero on the wire decodes to
`INT32_MIN`. So a neutral body carries -1 in those four fields, not zeros.

### Type 43, `scene_sensor`

The Auth starts and drives one authored scene: a graph of blocks that talk through named triggers.

| Auth field | effect |
|---|---|
| activation generation | a newer value tears down the scene and starts it again |
| teardown flag | ends the scene when the generation does not advance |
| dependencies | up to 8 slot references the scene needs, for example its squad |
| event keys | up to 32 trigger keys; each key new to the array fires that trigger once |

An event key is the FNV-1 hash of a trigger name, such as `zavala_start`. The scene graph decides
what each trigger is:

| kind | in the graph | the host |
|---|---|---|
| start | the first trigger; the client fires it when the scene starts | never sends it |
| input | blocks wait on it, nothing fires it | sends it to make the scene act |
| output | a block fires it, nothing waits on it | reads it from the Sense |
| internal | blocks fire it and wait on it | leaves it alone |

The Sense echoes the generation, raises a completion latch when the scene reaches its end block, and
lists the keys of the triggers that have fired. Whether an output fired inside the scene always
reaches that list is unverified.

A scene that spawns its own actors needs its type-1 squad in the dependency list. With an empty
list the spawn is refused. The scene then spawns through the squad's type-2 slot, not through
ordinary type-1 placement. Type-1 mode 3 keeps the squad's request without creating members, so
the scene can use it.

A teardown stops the scene's actions and participants and destroys the scene. It does not destroy
its actors. They stay, released to ordinary squad behavior. Completion in the Sense does not prove
that the scene controlled an actor.

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

- The game's names for the lifetime states. State 0 has no known effect, and the others are known
  only by what a live client showed.
- Semantic names for the 12 registered code-34 predicate schemas, and for the temperament ids.
- What the type-18 tail bool and int32 do.
- Six unnamed `join_result` fields (10 to 13, 15, 16), and the meaning of field 14.
- What reads the global selection record that type 17 fields `.16` to `.18` write.
- The meaning of the type 1 `squad_sensor` Auth fields not listed on
  [Actors and AI](/docs/destiny-2/actors-and-ai/#the-auth-body), such as `+0xB0`.
- How long the client waits in `shutting_down` after message 15; the timer value is not readable
  statically.
- Most Auth tables on this page are unverified against a live client.

## Related pages

- [The Activity Host](/docs/sunrise/activity-host/)
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/)
- [Network stack](/docs/destiny-2/networking/)
