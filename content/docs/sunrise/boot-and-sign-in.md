---
title: "From launch to orbit"
date: 2026-09-28
description: "How the game reaches Sunrise, signs on, opens its BAP link and walks the boot steps to orbit."
weight: 30
---
One boot runs from the first HTTP request to the orbit screen. At each step the game sends a
request, and Sunrise answers it from a known place in the source.

The game's own boot steps are in [Bootflow](/docs/destiny-2/bootflow/). The wire protocols are in
[Network stack](/docs/destiny-2/networking/).

## Summary

1. The game posts a SignOn request. Sunrise answers it inside the game process.
2. The SignOn answer names `127.0.0.1` and a port. The game opens a TCP connection there.
3. The Sunrise BAP listener takes the connection. Services 30 and 25 set up the link.
4. After service 26 every frame is encrypted. The link reaches `_connected`.
5. The game asks for its account over the link. Sunrise answers from its local database.
6. The game walks its boot steps to orbit.

## How the traffic reaches Sunrise

Sunrise is a DLL that runs inside the game. The server runs in the same process, on its own thread.
There are two paths into it.

### HTTP: SignOn

The game sends its HTTP requests through one internal request executor. Sunrise replaces that
executor (`src/client/hooks/network/http/http_descriptor_route.cpp`).

- A POST goes to the server's HTTP consumer (`src/server/http/server_http.cpp`).
- The consumer answers any URL that contains `/SignOn`. It writes the reply straight into the
  game's response buffer. No bytes go on the network.
- Any other route is refused and logged as `ev=http stage=route result=unmapped`. A request that is
  not a POST is refused the same way.
- When the external server setting is on, the executor rewrites the URL host and lets the game's
  own request go out. See [Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/).

### TCP: the BAP link

The BAP link is a real TCP connection. Sunrise runs a listener on the loopback address
(`src/server/transport/bap_listener.cpp`).

- It binds `127.0.0.1` on the BAP port. The default port is 30974. The same setting feeds the
  SignOn reply, so both always agree.
- It holds up to 8 connections at once (`src/client/network/consumer.h`). The main link and each
  Activity Host link take one slot.
- It is nonblocking. The server thread services it in short slices.
- Each connection gets its own session slot (`src/server/bap/bap_route.cpp`). Closing the socket
  clears the slot.

The game's own BAP code does all the client work. Sunrise does not patch the connect. The address
comes from the SignOn reply, as it did on the live service.

## SignOn

SignOn is one HTTPS POST with a protobuf body. The game reports its state and asks for a session.

### The request

Sunrise does not read the request body. It checks only the URL. For reference, the request carries
these fields, among others:

| field | holds |
|---:|---|
| 1 | protocol version, 16 on this build |
| 2 | the platform credential, a Steam ticket on PC |
| 5, 6 | the content version and build strings |
| 15 | the entitlements the client owns |
| 17 | the SKU name |
| 20 | a failure report, only after a failed attempt |
| 22 | the account id, name and country |

### The response

The reply is built in `src/middleware/signon/response.cpp`. Field 1 selects the branch. Sunrise
always sends 0, success.

| field | Sunrise sends |
|---:|---|
| 1 `response_type` | 0, success |
| 2 `success` | the sub-message below |
| 4 `client_config` | id 1, silo 1, and the content configuration blob |
| 5 `silo_id` | 1 |
| 6 `content_build_version` | `"d2legacy"` |
| 8 `capability_flags` | 0 |
| 10 `owned_entitlements` | the entitlement rows from the local database |
| 12 `server_time` | the server clock, Unix seconds |
| 13 `environment` | `"live"` |
| 14 `external_ip` | `127.0.0.1`, the client's own address |

The `success` sub-message:

| field | Sunrise sends |
|---:|---|
| 1 | 16 zero bytes |
| 2, 3 | 16 random bytes each; the client uses them to open the service 26 reply |
| 4 `session_token` | 32 random bytes |
| 5 | the token expiry, Unix seconds |
| 6 `relay_ip` | `127.0.0.1` |
| 7 `relay_port` | the BAP port |
| 12 `extended` | one network id in its field 1 |

Rules:

- Fields 1 to 7 of `success` are required. The client refuses the whole reply if one is missing.
- Sunrise makes the random values when it starts (`src/state/runtime/state_runtime.cpp`). They are
  never written to disk.
- The client config blob in field 4 lets the client register its content packages. Its contents
  are not described here.
- A successful SignOn also records the sign-in time. The characters later report it as their last
  daily and weekly reset.

## The BAP link

BAP is the platform link. Every service on it uses the same framing. All integers are big-endian.

### Framing

Each frame is a 6-byte outer header, then an inner header, then the body. The frame type says
whether the rest is plain or encrypted. The codec is `src/middleware/bap/bap_frame.cpp`.

```c
struct BapOuterHeader {        /* 6 bytes */
    uint8_t  magic;            /* +0x00, always 1 */
    uint8_t  frame_type;       /* +0x01, 0 or 2 = plaintext, 1 = encrypted */
    uint32_t length;           /* +0x02, bytes after this header */
};

struct BapRequestHeader {      /* 6 bytes, inside the payload */
    uint16_t service;          /* +0x00, service id */
    uint32_t task;             /* +0x02, correlation id */
};

struct BapResponseHeader {     /* 8 bytes */
    uint16_t service;          /* +0x00, response service id */
    uint32_t task;             /* +0x02, the request's task, echoed */
    uint16_t status;           /* +0x06, must be 200 */
};
```

Rules:

- A request uses the 6-byte header. A reply uses the 8-byte header with status 200. Any other
  status is fatal to the link.
- A reply echoes the request's task id, including 0. The client matches replies to requests by the
  pair (response service, task).
- A server push, such as service 123, uses the 6-byte header and has no status. Sunrise sends task
  0 in it.
- `length` must cover the payload exactly. Sunrise refuses a frame with extra bytes.
- In an encrypted frame the payload is a 16-byte authentication tag, then the ciphertext. The
  ciphertext holds the inner header and the body.

### The handshake

The game drives the link through a fixed state machine. Sunrise only answers.

```c
/* One BAP link, as the game drives it. The comments say what Sunrise answers. */
tcp_connect(signon.relay_ip, signon.relay_port);   /* state 1 _acquiring_server */
set_tcp_nodelay();                                 /* state 2 _connecting */

send(30, nonce_128_bytes);                         /* state 4 _channel_starting */
recv(31);           /* Sunrise echoes the 128 bytes; the client checks only the length */

send(25, { session_token, link_kind });            /* state 5 _authenticating */
recv(26);           /* an 84-byte sealed envelope with this link's frame key */
/* from here on, every frame in both directions is frame type 1 */

send(121); recv(122);                              /* state 6, empty reply */
send(302); recv(303);                              /* state 7, empty reply */
/* states 8 and 9 exchange a Steam relay certificate; they run only on the relay path */

for (;;) {                                         /* state 10 _connected */
    send(250); recv(251);                          /* keepalive */
    /* ... every other request and push ... */
}
```

The two plaintext services are handled in `src/server/bap/plaintext.cpp`.

- **Service 30 -> 31.** Sunrise sends the request body back unchanged. It is always 128 bytes.
- **Service 25 -> 26.** The body echoes the SignOn session token and names the link kind: 1 for
  the main link, 2 for an Activity Host link. Sunrise checks the shape and the token and logs a
  mismatch, but it answers every service 25. A refused hello would leave the link stuck in
  `_authenticating`.

### The secure channel

The channel is encrypted after services 25 and 26.

- The service 26 reply is a sealed envelope. Only a client that holds the SignOn reply can open it.
- The envelope gives the client a frame key for this one connection. Sunrise makes a fresh key and
  nonce for every service 25 (`new_bap_session` in `src/state/runtime/state_runtime.cpp`), so no
  two links share one.
- Frame type 1 uses AES-128-GCM (`src/middleware/secure_channel/encrypted_frame.cpp`). Each
  direction keeps its own counter. A counter moves on only after a frame is complete.
- The tag covers the ciphertext only. The outer header is not covered.

### Services on the encrypted link

The service table is `src/server/bap/encrypted/routing/bap_service_routing.cpp`. The main services:

| request -> reply | what it is | Sunrise answers |
|---|---|---|
| 10 -> 11 | web service RPC | see [Accounts, characters and saves](/docs/sunrise/save-data/) |
| 110 -> 112 | web service RPC, server role | same codec as 10 |
| 12 -> 13 | subscribe to a queuez family | empty reply, then the family's first snapshot on 123 |
| 14 -> 15 | unsubscribe | empty reply |
| 6 -> 7 | ask for an Activity Host | see [The Activity Host](/docs/sunrise/activity-host/) |
| 16 -> 17 | ask where an Activity Host lives | the same loopback address and port |
| 8 | message to the Activity Host | no reply; answers go out as pushes on 9 |
| 23 -> 24 | translate an id to a SOID | the account SOID, or a session id on an Activity Host link |
| 121 -> 122, 302 -> 303 | link setup | empty reply |
| 250 -> 251 | keepalive | empty reply |

Server pushes have no request:

| push | carries |
|---:|---|
| 9 | one message from the Activity Host |
| 123 | one or more queuez family updates |

Rules:

- Every request that has a response service gets an answer. A body that fails to decode is still
  answered, with an empty body. The client matches only the head of its pending queue, so one
  unanswered request blocks every later reply.
- A service Sunrise does not know gets no reply and no error. An error would drop the link.

## From sign-in to orbit

The boot is a ladder of numbered steps. Most of them run inside the client. This table lists the
steps between package registration and orbit, and what each one needs from Sunrise. SignOn has
already run when these steps start.

| # | step | waits for | Sunrise answers |
|---:|---|---|---|
| 21 | `package_registration` | the content packages to register | the content configuration in the SignOn reply |
| 22 | `bap_signin` | the BAP link to reach state 10 `_connected` | services 30, 25, 121 and 302 |
| 23 | `investment_signin` | the ws opcode 503 reply, then a family 4 snapshot keyed by the account SOID | the 503 reply and the family 4 push |
| 24 | `profile_setup` | the settings screens and a selected character | nothing; the screens are local |
| 25 | `prepare_for_orbit` | a slice-set load and local port setup | nothing |
| 26 | `rejoin_activity` | account data, read when the step starts | nothing new; it reads the family 4 data |
| 27 | `character:signin` | the family 3 roster, then the character pick | the ws opcode 206 answer and the ws opcode 504 reply |
| 29 | `setup:orbit` | the fireteam goal; it hands on to activity setup | the Activity Host services |

Notes on the steps that need the server:

- **Step 23.** The client sends one request here, ws opcode 503. The step clears when the client
  holds a family 4 object keyed by the SOID in that reply. Both answers are described in
  [Accounts, characters and saves](/docs/sunrise/save-data/).
- **Step 26.** If the account data is absent when this step starts, the step does nothing and
  reports no error.
- **Step 27.** The family 3 roster object holds the character count. A count of zero sends the
  client to character creation instead of character selection.
- **Step 29.** This is not the end. It hands on to `setup:activity_session_creation`, which starts
  the flow in [The Activity Host](/docs/sunrise/activity-host/).

Step 28 `cleanup` is not in the table. Most failures are reported there. It is not a step on the
way to orbit.

## Where to look when a boot stops

| symptom | look for |
|---|---|
| SignOn never answered | `ev=http method=post route=signon` lines |
| stuck in `bap_signin` | `ev=transport stage=accept` and `ev=bap svc=25` lines |
| link drops right after connect | `ev=bap svc=none stage=decrypt result=fail` |
| stuck in `investment_signin` | `ev=queuez` lines, most of all `stage=snapshot result=empty family=4` |
| all slots taken | `ev=transport stage=accept result=full` |

Log locations and levels are in [Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/).

## Open questions

- Which boot step sends SignOn is not verified.

## Related pages

- [How Sunrise is built](/docs/sunrise/architecture/) shows the overall layout of the DLL.
- [Accounts, characters and saves](/docs/sunrise/save-data/) covers the account answers.
- [The Activity Host](/docs/sunrise/activity-host/) covers what happens after orbit.
