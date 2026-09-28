---
title: "Network stack"
date: 2026-09-28
description: "The client's network protocols, the bdLobby service registry and the peer transport."
weight: 60
---
The client speaks seven network protocols. All live services are Demonware, over IPv4 only. There
is no bungie.net REST API in this build. Web-service calls travel over bdLobby instead.

Demonware class names such as `bdSocketRouter`, bdLobby class names, and peer message names such as
`membership-update` are the game's own. Other names are descriptive, not the game's.

## The protocols

| protocol | transport | role |
|---|---|---|
| SignOn | HTTPS POST, libcurl on Schannel, pinned TLS | bootstrap: returns a session token and the BAP server address |
| bdLobby BAP | TCP, big-endian framing | login, storage, matchmaking, and the Activity Host link |
| engine peer transport | UDP through Demonware bdNet, or Steam Datagram Relay | peer sessions and gameplay replication |
| STUN, NAT traversal, QoS | UDP | find the public address, open NAT, probe a host before joining |
| DNS | c-ares, UDP then TCP | name resolution; curl's only resolver |
| gameplay replication | the upper layer of the peer transport | simulation objects and their fields |
| UPnP / SSDP | UDP multicast plus plain HTTP | NAT port mapping |

A telemetry HTTP path also exists. It fails soft and does not block play.

The engine's socket layer has a `kind` on every socket. It decides the path a datagram takes.

| kind | path |
|---:|---|
| 0 | Demonware bdNet: `bdSocketRouter`, then a DTLS-style association, then Winsock |
| 1, 2, 3, 5 | plain engine UDP |
| 4 | TCP; only the BAP connection uses it |
| 6, 7 | Steam Datagram Relay |

## SignOn

SignOn is one HTTPS POST. The request body is protobuf and carries a Steam session ticket. The build
number and platform are in the query string.

The response is protobuf, decoded by the same nanopb runtime bdLobby uses. Field 1 selects the
outcome.

| field 1 | outcome |
|---:|---|
| 0 | success |
| 1 | queued |
| 2 | error with a numeric code |
| 3 | denied, user action required |
| 4 | throttled, retry later |

A success body carries an opaque session token, the BAP server's IPv4 address and port, material for
the secure channel, and up to eight feature names. The feature list is the only source of feature
flags, so every named feature is off unless SignOn names it. Details of the token and channel setup
are on [From launch to orbit](/docs/sunrise/boot-and-sign-in/).

## bdLobby BAP

BAP is a TCP link to one server. The client opens it after SignOn. It later opens a second BAP link
per activity, to an address the server chooses.

### The frame

Every frame starts with a 6-byte outer header. All integers are big-endian.

```c
struct BapOuterHeader {         /* 6 bytes */
    uint8_t  magic;             /* +0x00  1 */
    uint8_t  frame_type;        /* +0x01  0 or 2 plaintext, 1 encrypted */
    uint32_t length;            /* +0x02  bytes after this header */
};
```

An encrypted frame (type 1) then carries a 16-byte tag and AES-128-GCM ciphertext. `length` counts
the tag. A plaintext frame carries the inner message directly.

The inner message starts with a header whose size depends on the service.

```c
struct BapInnerHeader {         /* 6, 8 or 14 bytes */
    uint16_t service_id;        /* +0x00  must be below 308 */
    uint32_t task_id;           /* +0x02  a response echoes the request's value */
    uint16_t status;            /* +0x06  responses only; must be 200 */
};
```

| header | used by |
|---:|---|
| 6 bytes | requests and pushes |
| 8 bytes | responses: adds the status |
| 14 bytes | service 8 only: adds an 8-byte account handle after the task id |

TCP gives reliability, so BAP has no sequence or acknowledgement of its own. One unanswered request
jams the link, so every request needs its response, with a body its decoder accepts. An empty body
is not a neutral answer.

Sunrise parses and builds frames in `src/middleware/bap/frame.h` and `bap_frame.cpp`.

### The service registry

The client registers 71 services. Each is a singleton with a fixed id and a body codec. Ids 308 and
above are dropped at the header, so no newer service can reach this build.

| id | name (enum or class) | direction | body |
|---:|---|---|---|
| 6 | `c->ah mgr req` | C->S | 7,719 bytes: discriminator 3, length, protobuf naming the destination |
| 7 | `c->ah mgr rsp` | S->C | 137 bytes: discriminator 2, a non-zero u64 session id, 128 opaque bytes |
| 8 | `c->ah not` | C->S | an activity message to the Activity Host |
| 9 | `b->c not` | S->C | an activity message from the Activity Host |
| 10, 11 | `c->ws req`, `c->ws rsp` | both | the web-service RPC envelope |
| 12, 13 | subscribe request, response | both | 9 bytes in, empty body back |
| 16, 17 | `c->b_ahp req`, `rsp` | both | 8 bytes in (host id), 16 bytes back (id, IPv4, reserved, port) |
| 19 | `client_config_response` | S->C | protobuf |
| 21, 22 | purchased offers | both | request is send-only; the response is protobuf |
| 23, 24 | account id translation | both | 12 bytes in; a bit-packed list back |
| 25, 26 | secure hello | both | SignOn token in; 84-byte channel setup back |
| 28 | `server_challenge_request` | S->C | protobuf inside an authenticated envelope; meaning unknown |
| 30, 31 | channel start | both | 128 bytes back, not inspected |
| 32, 33 | user message | both | protobuf back |
| 42, 43 | matchmaking | both | protobuf; request field 2 picks one of eight kinds |
| 47 | NAT punch relay intro | S->C | protobuf |
| 110, 112 | web service, server role | both | same envelope as 10 and 11 |
| 121, 122 | queuez register | both | 4 bytes in, empty body back |
| 123 | `qz->c update not` | S->C | replicated object store updates |
| 124 | `qz->c sub lost not` | S->C | 14 bytes |
| 250, 251 | echo | both | a u32 in, empty body back; the keepalive |
| 302, 303 | relay client registration | both | protobuf in, empty body back |
| 304, 305 | Steam certificate signing | both | protobuf |

The full list is ids 6 to 51, then 100, 102, 110, 112, 121 to 124, 150, 151, 153, 160 to 162, 171,
250, 251 and 300 to 307. Ids 36 to 41 and 48 to 51 have no enum name and print as `UNKNOWN`. Sunrise
keeps its own catalog in `src/middleware/bap/service_catalog.h`.

The body codec takes one of four shapes.

| shape | services | what it does |
|---|---|---|
| send-only | 18, 21, 23, 32, 34, 36, 38, 40, 46, 171 | the client cannot parse a reply on this id; never send one |
| empty body | 13, 15, 122, 251, 303 | accepts any body and reads nothing |
| nanopb protobuf | 26 services | decodes against a `pb_field_t[]` schema |
| hand-written | the rest | fixed-length or bit-packed readers |

Nineteen services have a fixed body length, and each rejects any other size.

### Pushes

A server-initiated message is a push. The client accepts pushes on exactly 15 ids: 6, 8, 9, 20, 27,
28, 47, 51, 100, 123, 124, 150, 160, 161 and 301.

- Ids 6 and 161 have no handler behind them. A push that decodes on either id crashes the client.
- An id outside the 15 is a null call, not an ignored message.
- That leaves 13 usable ids. Twelve of them do real work.

## Protobuf in the client

All protobuf decoding goes through one embedded copy of nanopb. It is decode-only. A separate
hand-written encoder walks the same schema tables to write the few protobuf messages the client
sends.

| decoded roots | count |
|---|---:|
| bdLobby services, schema on the service object | 16 |
| bdLobby services, schema inside the decoder | 8 |
| SignOn response | 1 |
| session membership, inside peer message 30 | 1 |
| content manifest | 1 |
| services 28 and 29, inside an authenticated envelope | 2 |
| **total** | **29** |

The client also encodes seven bdLobby request roots it never decodes. The bdLobby protobuf surface
is 33 roots: 26 decoded and 7 encoded.

A nanopb field descriptor is 32 bytes.

```c
struct PbField {                /* 32 bytes; tag 0 ends the array */
    uint32_t tag;               /* +0x00  field number */
    uint32_t flags;             /* +0x04  low 4 bits: LTYPE; next 4 bits: HTYPE */
    uint8_t  data_offset;       /* +0x08  step after the previous field */
    int8_t   size_offset;       /* +0x09  has-bit address, relative to the value */
    uint8_t  pad[2];
    uint32_t data_size;         /* +0x0C  one element's size */
    uint32_t array_size;        /* +0x10  capacity, for arrays */
    uint32_t pad2;
    const void *submsg;         /* +0x18  child schema, or a callback */
};
```

LTYPE is varint, svarint, fixed32, fixed64, bytes, string or submessage. HTYPE is required,
optional, array or callback. Three rules matter to a server.

- A missing required field fails the whole message.
- Strings and byte arrays have fixed capacities. An oversized value is rejected, not cut short.
- A `bytes` slot stores its length in its first 8 bytes. A slot declared as 96 bytes holds 88.

Sunrise's protobuf reader and writer are in `src/middleware/protobuf/`.

## The engine peer transport

The peer transport carries group sessions and gameplay replication between machines. It has three
layers.

| layer | what it is |
|---|---|
| association | a four-packet Demonware handshake, then encrypted records |
| message channel | a bitstream of numbered peer messages, 45 ids |
| upper handlers | replication views, voice, and the group session |

Which path a peer takes is set by byte `+93` of the 128-byte join descriptor, the transport method.
6 and 7 select Steam Datagram Relay. Every other value selects Demonware bdNet.

### The peer address

Many peer messages carry a serialized `bdCommonAddr`. All 86 bytes take part in equality, padding
included.

```c
struct NetAddr {                /* 86 bytes; ports low byte first */
    uint8_t  local_ipv4_0[4];   /* +0x00  first local endpoint, dotted order */
    uint16_t local_port_0;      /* +0x04 */
    uint8_t  local_more[24];    /* +0x06  four more optional 6-byte endpoints */
    uint8_t  public_ipv4[4];    /* +0x1E  observed public endpoint */
    uint16_t public_port;       /* +0x22 */
    uint32_t address_id;        /* +0x24  identity hash of the endpoint */
    uint8_t  nat_type;          /* +0x28  1 open, 2 moderate, 3 strict */
    uint8_t  reserved[44];      /* +0x29  zero */
    uint8_t  transport_method;  /* +0x55  0 to 5 bdNet, 6 and 7 Steam relay */
};
```

### The association handshake

Every bdNet peer connection opens with four packets. Nothing above runs until they complete.

| type | name | direction | size |
|---:|---|---|---:|
| 1 | init | requester -> responder | 18 bytes |
| 2 | init ack | responder -> requester | 52 bytes |
| 3 | cookie echo | requester -> responder | 209 bytes |
| 4 | cookie ack | responder -> requester | 116 bytes |

Every field is a plain byte append. Multi-byte integers go low byte first. There is no length prefix
and no checksum. Types 10 to 13 on the same port belong to NAT traversal.

Every packet opens with the same 8-byte header.

```c
struct AssocHeader {            /* 8 bytes */
    uint8_t  type;              /* +0x00  1 to 4, or 6 for data */
    uint8_t  constant_2;        /* +0x01  2, never read back */
    uint16_t addressed_tag;     /* +0x02  the tag this packet is for */
    uint32_t sequence;          /* +0x04  0 on handshake packets */
};

struct AssocInit {              /* 18 bytes */
    AssocHeader hdr;            /* +0x00  type 1, tag 0 */
    uint16_t requester_tag;     /* +0x08  chosen by the requester */
    uint8_t  security_id[8];    /* +0x0A */
};

struct AssocInitAck {           /* 52 bytes */
    AssocHeader hdr;            /* +0x00  type 2, tag = requester_tag */
    uint32_t free_running;      /* +0x08  stored, never checked */
    uint8_t  cookie[16];        /* +0x0C  the responder's own value */
    uint16_t responder_tag;     /* +0x1C */
    uint16_t responder_tag2;    /* +0x1E  same value again */
    uint16_t requester_tag;     /* +0x20 */
    uint16_t old_responder_tag; /* +0x22  0 on a fresh association */
    uint16_t old_requester_tag; /* +0x24  0 on a fresh association */
    uint8_t  observed_addr[6];  /* +0x26  requester address as the responder saw it */
    uint8_t  security_id[8];    /* +0x2C  copied from the init */
};

struct AssocCookieEcho {        /* 209 bytes */
    AssocHeader hdr;            /* +0x00  type 3, tag = responder_tag */
    AssocInitAck echoed;        /* +0x08  the init ack, unchanged */
    uint8_t  requester_addr[41];/* +0x3C  serialized address claim */
    uint8_t  security_id[8];    /* +0x65 */
    uint8_t  public_key[100];   /* +0x6D  exported ECC public key, zero padded */
};

struct AssocCookieAck {         /* 116 bytes */
    AssocHeader hdr;            /* +0x00  type 4, tag = requester_tag */
    uint8_t  public_key[100];   /* +0x08 */
    uint8_t  security_id[8];    /* +0x6C */
};
```

The security id routes every packet. The socket router keys its association table on it. A packet
whose id matches nothing is dropped before any association sees it, and nothing is logged. The
requester chooses the id, and every reply repeats it.

The key exchange is ECDH on the curve secp224r1, using LibTomCrypt. Each side exports its public key
in the cookie echo or cookie ack. The association then derives its record keys.

After the handshake, data travels in type-6 records.

```c
struct AssocData {              /* 18 bytes + ciphertext */
    AssocHeader hdr;            /* +0x00  type 6; sequence at +0x04 */
    uint8_t  mac[8];            /* +0x08  truncated MAC */
    uint16_t plain_len;         /* +0x10 */
    uint8_t  ciphertext[];      /* +0x12  rounded up to the cipher block */
};
```

Records use AES-128 in CBC mode. Each record is an independent CBC run. The MAC covers the header
and everything from the length on, truncated to 8 bytes. A 32-slot sliding window rejects replays.

Sunrise implements this layer in `src/middleware/gameplay/dtls/`.

The engine also has its own separate association layer, with a 3-bit opcode set (connect request,
key-exchange offer, key-exchange response, reject, keepalive). The join descriptor cannot select it.
Its opcode-0 body is unknown.

### The peer message channel

One UDP payload carries a chain of peer messages in one bitstream, most significant bit first.

```c
/* Peer message chain, widths in bits */
bit  packet_marker;            /* 1   written once per packet */
/* repeated: */
bit  more;                     /* 1   1 = a message follows, 0 = end */
u6   message_id;               /* 6   0 to 44 */
u18  struct_size;              /* 18  the id's fixed struct size, not the bits used */
...  payload;                  /*     the id's own writer */
```

`struct_size` is a constant per id. The receiver uses it only to size a scratch buffer, and it drops
a message whose declared size does not match the table. A reader failure ends the whole chain.

There are two paths.

| path | carries | framing |
|---|---|---|
| out of band | connect and join negotiation: ids 0, 4, 5, 6, 7, 9, 10, 11, 13, 14, 16, 27, 28, 29, 42 | a 16-bit length, then the chain |
| reliable connection | everything in a session: 12, 26, 30, 31, 34, 37, and more | an established datagram with ACKs and two fragment queues |

An established datagram opens with a 0 bit, a fragmentation bit, and the connection sequence modulo
4. Then come the handlers in a fixed order: the connection ACK, reliable queue A (32-byte fragments),
reliable queue B (6-byte fragments), and then external handlers such as voice. A datagram over the
address limit (1,228 bytes on direct IPv4) is split into at most eight pieces.

The receiver accepts a packet sequence at most 128 ahead of its window. A sender further ahead is
read as a whole ring behind, and the connection never recovers.

### Peer message ids

The channel has 45 ids, 0 to 44.

| id | name | carries |
|---:|---|---|
| 0, 1 | `ping`, `pong` | a 16-bit sequence and a 64-bit timestamp, echoed |
| 2, 3 | `broadcast-search`, `broadcast-reply` | LAN discovery; id 3 has no dispatcher in this build |
| 5 | `connect-request` | channel id, initial sequence, requester address |
| 6 | `connect-response` | echoes the request, adds the responder's channel id, sequence and address |
| 7 | `connect-refuse` | echoes the request, a 3-bit reason |
| 8 | `connect-establish` | the first reliable message on a connection |
| 9 | `connect-closed` | both channel ids, a 5-bit reason |
| 10 | `join-request` | protocol version, build bounds, group session id, join id, joining peers and members |
| 11 | `peer-connect` | protocol version, machine id, group session id |
| 12 | `join-complete` | group session id, join id, membership revision |
| 14 | `join-refuse` | group session id, join id, one of 30 named reasons |
| 15, 16 | `leave-session`, `leave-acknowledge` | the group session id |
| 17, 18 | `session-disband`, `session-boot` | session id, machine id, reason |
| 19 to 25 | host handoff, transition, re-establish, decline | host migration |
| 26 | `peer-establish` | the joining peer's own session is up |
| 27, 28 | `election`, `election-refuse` | host election with candidate addresses and reachability masks |
| 29 | `time-synchronize` | a four-timestamp clock exchange |
| 30 | `membership-update` | the member and player tables (below) |
| 31 | `peer-properties` | one peer's 304-byte property row |
| 32, 33 | `delegate-leadership`, `boot-machine` | leadership change, removal |
| 34 to 37 | `player-add`, `player-refuse`, `player-remove`, `player-properties` | player rows and their 232-byte profile |
| 38, 39 | `parameters-update`, `parameters-request` | group-session parameters |
| 40 | `view-establishment` | opens a replication view in six ordered stages |
| 41 | `voice-chat-user-registration` | 16 bytes; no producer in this build |
| 42 | `mayday` | a failed state change, 9 bits, bias 1 |
| 43, 44 | `test`, `test_force_host_machine_name` | test controls; never send |

Clock sync (id 29) computes `offset = ((t2 - t1) + (t3 - t4)) / 2`. The receive time t4 is never on
the wire. A reply is terminal: answering one loops forever.

Sunrise's peer codecs are in `src/middleware/gameplay/peer/` and
`src/middleware/gameplay/group/`.

## Session membership, peer message 30

The group-session host sends `membership-update` to tell members who is in the session. A joining
peer waits for it. The body is one 31,104-byte struct in four regions.

| offset | size | region |
|---:|---:|---|
| `+0` | 8 | host machine id, 64 raw bits |
| `+8` | 5,944 | a nanopb message: the session state |
| `+5952` | 8 | base revision and one copied value |
| `+5960` | 4 | two counts: peer deltas and player deltas |
| `+5968` | 32 x 344 | peer-table deltas |
| `+16976` | 32 x 440 | player-table deltas |
| `+31056` | 40 | four optional tail fields |
| `+31096` | 4 | a hash over the sender's session state |

On the wire the protobuf region is a 13-bit byte length and that many bytes. The rest is bit-packed.
This is the only place the client nests protobuf inside a Bungie bitstream.

A base revision of 0 means a complete snapshot. Otherwise the update is a delta against the revision
the receiver holds.

### Root fields

| tag | type | meaning |
|---:|---|---|
| 1 | u32 | membership revision; 0 means none published yet |
| 2 | u32 | host member index |
| 3 | u32 | host-succession candidate index (not verified) |
| 4 | u32 | member count |
| 5 | u64 | member-slot bitmask; low 32 bits used |
| 6 | repeated | the member table, up to 32 entries |

### The member record

Each protobuf field is copied straight into the receiver's session state at the same offset. So a
wrong value becomes the client's own state.

```c
struct MembershipMember {       /* 184 bytes, nanopb layout */
    bool     has_addr;          /* +0x00 */
    uint64_t addr_len;          /* +0x08  must be 86 */
    uint8_t  addr[88];          /* +0x10  tag 1: the peer's NetAddr */
    bool     has_machine_id;    /* +0x68 */
    uint64_t machine_id_len;    /* +0x70  must be 8 */
    uint8_t  machine_id[8];     /* +0x78  tag 2 */
    bool     has_join_id;       /* +0x80 */
    uint64_t join_id;           /* +0x88  tag 3: the join attempt's id; 0 when empty */
    bool     has_party_id;      /* +0x90 */
    uint64_t party_id;          /* +0x98  tag 8: 0 and all-ones both mean none */
    bool     has_player_count;  /* +0xA0 */
    uint32_t player_count;      /* +0xA4  tag 9 */
    uint64_t player_slot_count; /* +0xA8  tag 10, at most 1 */
    uint32_t player_slot;       /* +0xB0  index into the player table */
    bool     has_leave_pending; /* +0xB4 */
    uint8_t  host_leave_pending;/* +0xB5  tag 11, a bool */
    bool     has_leave_done;    /* +0xB6 */
    uint8_t  host_leave_done;   /* +0xB7  tag 12, a bool */
};
```

Tags 8 and 9 group members into parties for matchmaking. Tags 11 and 12 drive a rejoin after the
host leaves.

The join id (tag 3) is checked first. The receiver finds the entry whose address equals its own. If
that entry's join id is not the one its current join sent, the update is "from a stale join" and is
dropped with no other effect.

### Peer and player deltas

A peer delta names a member index (6 bits), a changed flag, a connection state (4 bits), and
optional connection data. The member states are named in the client:

| value | state | value | state |
|---:|---|---:|---|
| 0 | `_none` | 6 | `_joining` |
| 1 | `_rejoining` | 7 | `_joined` |
| 2 | `_reserved` | 8 | `_waiting` |
| 3 | `_reserved_ambassador` | 9 | `_ready` |
| 4 | `_disconnected` | 10 | `_established` |
| 5 | `_connected` | | |

A player delta names a player slot, an owning member, a player-add counter, and an optional profile.
The profile carries the player's name and the account and character ids. An activity join reads those
ids from this row, so a row without a profile costs the peer its player.

### What a bad update costs

The receiver applies the update first and validates after. On most failures it clears its member and
player tables and rebuilds a minimal two-member session. The hash at `+31096` is the last check. It
is a Bob Jenkins lookup3 hash over the receiver's own 28,768-byte session state after applying. A
mismatch ends in `no membership information, forcing disconnect`, and the join retries.

Sunrise builds a replica of the session state to compute this hash, in
`src/middleware/gameplay/group/session_state.h`.

## QoS probe and the session advertisement

Before joining a session found by matchmaking, the client probes it over UDP. An unanswered session
is marked unsuitable and never joined. The probe uses Demonware's `bdQoSProbe`. Both packets are
little-endian and unframed.

```c
struct QosRequest {             /* 18 bytes */
    uint8_t  type;              /* +0x00  40 */
    uint64_t send_time;         /* +0x01  echoed back */
    uint32_t probe_id;          /* +0x09  routes the reply */
    uint32_t security_id;       /* +0x0D  echoed back */
    uint8_t  last_probe;        /* +0x11  1: put the payload in the reply */
};

struct QosReply {               /* 27 bytes + payload */
    uint8_t  type;              /* +0x00  41 */
    uint32_t probe_id;          /* +0x01  from request +0x09 */
    uint64_t send_time;         /* +0x05  from request +0x01 */
    uint8_t  accepted;          /* +0x0D  0 is an explicit refusal */
    uint32_t payload_len;       /* +0x0E  must equal the bytes after +0x1B */
    uint32_t security_id;       /* +0x12  from request +0x0D */
    float    hold_time;         /* +0x16  seconds, subtracted from the round trip */
    uint8_t  has_data;          /* +0x1A */
    uint8_t  payload[];         /* +0x1B  the session advertisement */
};
```

The payload is required. An empty or undecodable one marks the session unsuitable, with a named
reason such as `qos-payload-empty` or `qos-incompatible-versions`.

### The session advertisement

The payload is a 13,184-byte session advertisement, bit-packed. LAN peer message 3 carries the same
block, and both use one decoder. Its header comes first.

| bits | field | rule |
|---:|---|---|
| 64 | session id | from the running session |
| 16 | protocol version | must equal the client's |
| 3 | kind | must be 5 |
| 31 | build high bound, bias -1 | must be at least 86657 |
| 31 | build low bound, bias -1 | must be at most 86657 |
| 2 | payload type | must equal what the tracker expects |

Payload type 1 is a full advertisement: topology kind, host mode, join controls, the 128-byte join
descriptor, five 6-bit slot counts, and an optional extension with up to 32 member rows. Payload type
2 is a 688-byte group-session descriptor. Matchmaking in this build expects type 2.

Every field comes from live session state. A zero block fails the range checks.

## STUN, NAT, UPnP and DNS

- **STUN.** The client walks a 16-entry STUN host table and needs one valid entry. If none is valid it
  falls back, but it then needs at least one local address, or UPnP refuses to start.
- **NAT traversal.** `bdNATTravClient` shares the association port and uses packet types 10 to 13.
- **UPnP.** SSDP discovery, one description GET, and four SOAP actions. A failed mapping falls back
  to a direct or relayed path.
- **DNS.** c-ares runs its own DNS over its own sockets. It sends one IPv4 A query, UDP first, TCP on
  truncation, with retries. curl keeps a 60-second host cache and ignores DNS TTL.

## Gameplay replication

Replication runs on the reliable peer connection. Its model is the simulation object (sobject) plus
network facets and component blocks. Dispatch is computed from reflection data, so there is no
numeric opcode switch on the wire.

A replication view opens through peer message 40 in six ordered stages. At stage 2 the initiator
publishes its scheduler signature. A mismatch logs `view signature mismatch, no replication`. Stages
4 and 5 open provisional and then full replication.

The local player's biped does not need replication. It is built by a local call. Replication is what
other entities need.

## Open questions

- The body of the engine association's opcode 0.
- The meaning of service 28's fields.
- The leaf layout of the 304-byte peer-property block (peer message 31).
- The reason enums of `connect-refuse` and `connect-closed`.
- The exact byte partition of the protected formatter under the engine's direct association.

## Related pages

- [From launch to orbit](/docs/sunrise/boot-and-sign-in/): SignOn and the BAP handshake as Sunrise
  answers them.
- [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/): the activity messages that
  ride bdLobby.
- [Bootflow](/docs/destiny-2/bootflow/): the order in which the client uses these links.
