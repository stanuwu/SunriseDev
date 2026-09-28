---
title: "The Activity Host"
date: 2026-09-28
description: "How Sunrise loads the client into a destination and serves the activity link after that."
weight: 50
---
The Activity Host is the part of the Sunrise server that runs one activity. An activity is a
destination, a mission, a strike or a raid. The host talks to the client over its own BAP link with
activity messages. It answers the client's requests, takes the client's reports, and sends the world
state it owns.

The code lives in three places:

| directory | what it holds |
|---|---|
| `src/server/bap/encrypted/` | the BAP services, the activity message route and every push |
| `src/server/activity/` | the host runtime: client reports in, events out, retained Auth state |
| `src/state/activity/` | the session records: allocation, membership, entity slots |

The message ids on this page are the ones build 86657 uses. The slot types and the Auth and Sense
tables are on [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/). The BAP framing
and the secure channel are on [Network stack](/docs/destiny-2/networking/).

## What the host does

| job | how |
|---|---|
| tell the client where the host is | answers service 16 with service 17 |
| create an activity session | answers service 6 with service 7 |
| let the client join | answers message 3 with the join burst |
| hand out entity indices | answers message 20 with a message 0 grant |
| keep the member table | sends message 12 when membership changes |
| keep the world state | sends message 5, the retained Auth state |
| take client reports | message 6 Sense, message 19 incidents, message 22 client state, and others |
| run mission scripts | turns reports into events, and script requests into message 5 or 19 |

## Loading into a destination

The client uses two BAP links. The first is the lobby link it opened at sign-in. The second is the
activity link. Sunrise serves both from the same listener.

### The steps

| step | link | client sends | Sunrise answers |
|---:|---|---|---|
| 1 | lobby | service 16, "where is this activity host?" | service 17 with the host address and port |
| 2 | activity | a new BAP connection, hello and secure channel | the same handshake as the lobby link |
| 3 | activity | service 6, the host request, naming the destination | service 7 with a new session id |
| 4 | activity | message 3 `join_request` | the join burst: messages 4, 0, 1, 2, 54, then 12 |
| 5 | activity | message 52, its replication epoch | the first message 5, when a roster is owed |

After step 5 the link is steady. The client sends reports and requests. The host answers them and
pushes its own changes.

### Service 16 and 17

Service 16 names an activity host id. Sunrise echoes the id and gives the address of its own BAP
listener. That is the loopback address and the configured BAP port, so the client connects back to
the same process. See `src/middleware/bap/activity_host/activity_host_response.cpp`.

```c
struct Service16Request {         /* 8 bytes, big-endian */
    uint64_t activityHostId;      /* +0x00 */
};

struct Service17Response {        /* 16 bytes, big-endian */
    uint64_t activityHostId;      /* +0x00  echo of the request */
    uint32_t ipv4Address;         /* +0x08  never 0 */
    uint16_t neutral;             /* +0x0C  always 0 */
    uint16_t port;                /* +0x0E  never 0 */
};
```

The client refuses a body of any other size.

### Service 6 and 7

Service 6 carries the client's destination pick. Sunrise reads the destination out of it, prepares
a session in State, and answers. A malformed request still gets an answer: Sunrise falls back to a
default selection, because a missing reply would stall the client's request queue. See
`src/server/bap/encrypted/activity_host_manager/activity_host_manager_route.cpp`.

```c
struct Service7Response {         /* 137 bytes */
    uint8_t  discriminator;       /* +0x00  always 2 */
    uint64_t sessionId;           /* +0x01  big-endian, never 0 */
    uint8_t  activityData[128];   /* +0x09  Sunrise sends zeros */
};
```

The client turns this reply into message 10 inside its own process. Message 10 never crosses the
wire. The session is committed together with the reply, and the link that asked is bound to it.

### The join burst

The join request names the session and a correlation value. Sunrise answers with one burst, built
all at once in `src/server/bap/encrypted/push/activity/activity_message_push.cpp`. If one message in
it cannot be built, none of them is sent.

| order | message | name | carries |
|---:|---:|---|---|
| 1 | 4 | `join_result` | correlation value, session id, 2000 ms keepalive hint, 5000 ms peer-heard window |
| 2 | 0 | entity slots | a 1024-byte mask of the entity indices this client may use |
| 3 | 1 | `global_activity_state` | the activity descriptor the loading steps read |
| 4 | 2 | world globals state | the world globals |
| 5 | 54 | bubble host state | an empty host table |
| 6 | 12 | `replicate_membership` | the member table, when it is ready |

Message 4 must come first. The client routes no other activity message before its join is accepted.

There are two kinds of join:

- **Private.** The link sent service 6 itself, so it already owns the session. The burst carries a
  member table seeded from the join.
- **Public.** The join names a session that belongs to a shared region's host. The link binds to
  that session instead. The burst carries the member table of the player's own private session,
  read but not changed.

### A destination load in pseudocode

```c
/* Server side of one destination load. */
on_service16(req):                          /* lobby link */
    reply_service17(req.activityHostId, listener_address, listener_port);

on_service6(link, req):                     /* activity link */
    dest    = read_destination(req);        /* default selection if unreadable */
    session = prepare_session(dest);
    reply_service7(session.id);             /* always answered */
    commit(session);
    bind(link, session);

on_msg3_join(link, join):
    if (join.sessionId == link.session.id)           mode = PRIVATE;
    else if (is_public_host_session(join.sessionId)) mode = PUBLIC;
    else { report("prepare"); return; }     /* dropped, frame still accepted */
    grant = lease_entity_slots(join);
    burst = { msg4(join.correlation), msg0(grant),
              msg1(), msg2(), msg54(),
              msg12_if_ready() };
    send_all_or_nothing(link, burst);

on_msg52_epoch(link, epoch):
    if (link.roster_owed)
        send(link, msg5(epoch));            /* the first Auth state */
```

## Answer what was asked

The host follows one rule: a server answers what it was asked.

1. Every client message is a request or a report. A request gets its whole answer. A report gets
   the state change it implies.
2. The host pushes only on an event or a change it owns. If no client message and no host change
   caused a push, the push is wrong.
3. A request is never answered in part. An earlier send is not an answer to a snapshot request,
   because the client may have dropped what it held.
4. Server state is world state: what exists, who owns it, what changed. A flag that tracks what the
   client asked for before is a defect.

### What each client message gets

The route table in `src/middleware/bap/activity_message/wire_schema/activity_communication_route_data.inc`
maps each message id to its handler. The handlers are in
`src/server/bap/encrypted/activity_message/`.

| message | name | kind | what the host does |
|---:|---|---|---|
| 3 | `join_request` | request | sends the join burst |
| 18 | state refresh | request | sends the whole snapshot: messages 1, 2, 12 (private link), then 5 |
| 11 | `start_new_activity` | request | the same snapshot if a server setting enables it; else recorded only |
| 20 | entity slot request | request | grants free slots with message 0 |
| 21 | entity slots | report | releases the returned slots; no reply |
| 22 | client authoritative data | report | commits region, spawn and teleport state; see below |
| 23 | client identity | report | commits the identity; sends message 12 on a private link |
| 38 | membership acknowledgement | report | records the acknowledged revision; no reply |
| 52 | patch epoch | report | sends message 5 if a roster is owed for that epoch |
| 15 | peer leave | report | sends the message 5 leave delta |
| 6 | `sensor_sense_update` | report | decoded and passed to the host runtime |
| 19 | incident | report | decoded and passed to the host runtime |
| 16 | keepalive request | report | recorded only |

On a private link, message 22 also sends message 12 if membership changed, and message 5 if the
region moved.

A message from a link that does not own its session is recorded and dropped. So is a message whose
body cannot be staged. The frame itself is still accepted. A refused frame would stall the client's
request queue.

### What the host pushes on its own

The host pushes when its own state changes. In
`src/server/bap/encrypted/push/activity/activity_keepalive_push.cpp` these are:

- a new committed Auth state revision
- a script request waiting to be sent
- an entity retirement that is due
- the answer to the client's arrival report, once the client is in the world
- a move of the client into another region, which changes the advertised host
- a host teleport the host armed
- an authority reset or an authority query the host started

The transport checks for these on its 50 ms poll. While a host output such as a script request is
pending, it checks on every pass instead, so a request does not wait out the interval.

### Timed sends that remain

The link also has a keepalive every 2 seconds. It carries message 1, a small global state, and
message 44 when a replication epoch is waiting. It carries message 12 only when the table changed,
the client moved region, or the client has not acknowledged the current revision yet. A membership
body held back for a missing host record is retried after 250 ms. So is an incident whose send
failed.

## Client reports come in

A report takes this path:

```c
/* One service-8 body on the activity link. */
req = parse_envelope(body);                  /* session id, message id, length, peer mask */
if (!owns_session(link, req)) { record(req, UNOWNED); return; }
route = route_table[req.messageId];
switch (route.adapter) {
case SENSE:        decode_sense(req, link.last_msg5_identity_map);
                   host_submit_sense(...);      break;
case INCIDENT:     decode_incident(req);
                   host_submit_incident(...);   break;
case CLIENT_STATE: stage_membership(req);       /* message 22 */
                   /* submitted to the host only after the commit */
                   break;
default:           prepare_or_frame(req);       break;
}
```

Three rules apply:

- **Sense is decoded against what the host sent.** A Sense report names slots by the identity map
  of the last complete message 5 on the same link. See `activity_message_framing.cpp`.
- **Message 22 counts only after it commits.** The host sees the committed after-image of the
  client state, not the raw report. See `submit_committed_client_state` in
  `src/server/bap/encrypted/encrypted_runtime.cpp`.
- **Order is kept.** Reports enter the host queue in the order the client sent them.

The host runtime turns each accepted report into one or more events. A Sense report can raise a
trigger, squad, object, device or objective event, for example. A message 22 can raise a region
change. The event list is in [How a script runs](/docs/mission-scripting/program-model/).

The client envelope on service 8 and the host envelope on service 9:

```c
struct ActivityRequestEnvelope {      /* service 8, big-endian */
    uint64_t sessionId;               /* +0x00 */
    uint8_t  discriminator;           /* +0x08  1, or 2 without the peer mask */
    uint32_t messageId;               /* +0x09 */
    uint32_t payloadLength;           /* +0x0D */
    uint32_t peerHeardMask;           /* +0x11  absent when discriminator is 2 */
    /* payload follows */
};

struct ActivityNotificationEnvelope { /* service 9, big-endian */
    uint8_t  discriminator;           /* +0x00  always 1 */
    uint64_t sessionId;               /* +0x01 */
    uint32_t messageId;               /* +0x09  0 to 58 */
    uint32_t payloadLength;           /* +0x0D */
    /* payload follows */
};
```

## Auth state goes out

Message 5 carries the host's Auth state. It is retained state, not a stream of commands. The host
keeps the latest delivered Auth body for every slot of the activity, and builds each message 5 from
that retained set.

Message 5 carries:

- the replication epoch the client reported in message 52
- the roster groups and their seed blocks
- per-bubble authority
- the activity lifetime state
- the Auth bodies that scripts and the host changed

The first message 5 needs the epoch from message 52. Before that, no roster can be built.

A script request becomes one Auth body in the host's output slot for that activity. Requests that
commit together go out in one push. When the push reaches the transport queue, the request is
reported as `transport_staged`. The client sends no acknowledgement for an Auth body, so that is the
strongest outcome the host can prove. Where the slot reports back, a later Sense report shows what
the client applied.

The host can also send an incident, message 19, through the same output slot.

## Where mission scripts plug in

The server runs one service slice at a time on its own thread. Each slice runs four stages in a
fixed order, in `src/server/runtime/server_runtime.cpp`:

| order | stage | what it does |
|---:|---|---|
| 1 | transport | reads client frames and stages answers and pushes |
| 2 | host | applies queued reports and turns them into events |
| 3 | mission | runs script callbacks on new events and timers |
| 4 | gameplay | the gameplay services |

The loop from a report to a request:

```c
/* One report, one event, one request. */
transport:  msg6 arrives -> host_submit_sense(report);
host:       events = reduce(report);             /* e.g. trigger_entered */
            mission_inputs.append(events);
mission:    for (e in mission_inputs_after(cursor))
                call(program.on_event_<kind>, e); /* may make requests */
            commit(requests);                     /* one Auth body each */
transport:  if (host_output_pending())
                send(link, msg5(retained_auth));  /* next pump */
            report(effect_result, TRANSPORT_STAGED);
```

The script never sees packet bytes. It sees typed events, and it asks for typed changes. The
mission runtime is in `src/server/activity/mission/`. How to write a script is in
[Mission Scripting](/docs/mission-scripting/).

## Related pages

- [How Sunrise is built](/docs/sunrise/architecture/)
- [From launch to orbit](/docs/sunrise/boot-and-sign-in/)
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/)
- [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/)
- [Client hooks](/docs/sunrise/client-hooks/)
