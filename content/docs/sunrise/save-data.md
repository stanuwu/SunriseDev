---
title: "Accounts, characters and saves"
date: 2026-09-28
description: "How Sunrise stores the player's account and sends it to the game over the BAP link."
weight: 40
---
Sunrise keeps one account in a local SQLite database. Every answer about the player is read from
that database, turned into the game's own data layout and sent over the BAP link. Every change the
player makes is written to the database before the game is told it succeeded.

The BAP link itself is in [From launch to orbit](/docs/sunrise/boot-and-sign-in/). The layout of
the data inside the game is in [Items, characters and inventory](/docs/destiny-2/investment-data/).

## The local database

The database is one file, `Sunrise\data\investment.sqlite3`, in the folder that holds the Sunrise
DLL. The code is in `src/state/investment/`.

- On first start Sunrise creates the file. It writes the schema and the default rows. Both are
  built into the DLL as resources (`resources/database/`).
- The defaults hold one account with three level-50 characters: a Hunter, a Titan and a Warlock.
- On a later start Sunrise checks the schema version. Version 1 is upgraded to version 2 in place.
  Any other version, or a file from another program, is refused.
- Every write runs inside a SQLite savepoint. A failed write rolls back and leaves no partial rows.
- Writes are synchronous (`PRAGMA synchronous=FULL`). No unsaved copy is held in memory.

The file is plain SQLite. Back it up before you edit it by hand.

### Tables

| table | what it holds |
|---|---|
| `account` | the account SOID and whether profile setup is done |
| `characters` | one row per slot 0 to 2: SOID, race, gender, class, level, title, last orbit destination |
| `items` | character items; location 0 is equipped (17 slots), location 1 is inventory (135 rows) |
| `sockets` | the plug in each socket lane of an item |
| `profile_items` | account-wide currencies and materials, up to 701 rows |
| `character_stacks` | per-character materials that have no instance |
| `unlocks` | flag, objective and progression banks, per account or per character |
| `family5` | account-wide unlock and value overrides |
| `entitlements` | owned content, sent in the SignOn reply |
| `dismantle_rewards` | what dismantling gear pays out |
| `pending_rewards` | rewards earned but not yet granted |
| `bootstrap` | one-time setup steps already done |
| `account_*` | game settings: controls, audio, display, interface, social, key bindings |

The `account_*` tables come from a second schema file, `account_settings_schema.sql`.

## The account model

In memory the account is one `AccountState` value (`src/state/account/account_state.h`). It is read
from the database each time it is needed. There is no separate cached copy.

```c
/* Simplified from src/state/account/account_state.h. */
struct AccountState {
    uint64_t       primarySoid;          /* the account's object id */
    ProfileItem    profileItems[];       /* currencies and materials */
    CharacterState characters[3];        /* slots 0 to 2 */
    bool           profileSetupCompleted;
    AccountSettings settings;            /* controls, audio, display, ... */
};

struct CharacterState {
    uint64_t soid;                       /* primarySoid + 1 + slot */
    bool     selected;                   /* session only */
    uint8_t  race, gender, characterClass, level;
    uint16_t currentActivityIndex;       /* session only */
    uint16_t equippedTitleRecordIndex;
    uint64_t signInSeconds;              /* session only */
    Equipment equipment;                 /* equipped items by slot */
    CharacterItems inventory;            /* unequipped items */
    CharacterStacks stacks;              /* non-instanced materials */
};
```

Every object the game tracks has a 64-bit id, a SOID. The account has one, each character has one,
and each item instance has one. In the defaults, and after Sunrise adopts a new account SOID, the
character SOIDs are the account SOID plus 1, 2 and 3.

### Which account SOID is used

The game names the account in its first request, ws opcode 503.

- If that request carries a nonzero account id, Sunrise adopts it. It stores it as the new account
  SOID and moves the character SOIDs with it.
- If the id is zero, Sunrise answers with the SOID already in the database.

This is in `src/server/web_service/web_service_runtime.cpp` and `set_primary_soid` in
`src/state/runtime/state_account_runtime.cpp`.

## How the data reaches the client

There are three paths. All of them run over the encrypted BAP link.

| path | carries | when |
|---|---|---|
| ws opcode 503 reply | the account SOID, the server clock, the family 5 object | once, during `investment_signin` |
| service 123 push | queuez family snapshots and updates | after a subscribe, and after every change |
| ws reply status | the family 4 version a change will publish | in the reply to each action |

### ws opcode 503: the account bootstrap

The game sends 503 once, on the main link, during boot step 23. The reply is built in
`src/middleware/web_service/messages/opcode503_codec.cpp`. In order, it holds:

1. the status pair: code 0, and value -1, which means "no family 4 version to wait for"
2. the account SOID, 64 bits
3. two 32-bit fields that nothing reads; Sunrise sends 0
4. the family 5 object: a fixed sentinel SOID, the server clock, and the override lists from the
   `family5` table

The clock always moves forward, even for two requests in the same second. The client ignores a
family 5 update whose clock is not newer.

### Replicated families: queuez

The queuez service is a replicated object store. The client holds a copy of each family it subscribed to. The
server keeps it current with pushes on service 123. There is no "get everything" request.

A family is identified by its type and a root SOID. Sunrise builds these types:

| type | what Sunrise sends | builder |
|---:|---|---|
| 0 | the banner pair for one character | `push/snapshot/banner_snapshot.cpp` |
| 2 | the social roster member record | `push/snapshot/social_roster_snapshot.cpp` |
| 3 | the character roster; its count picks selection or creation | `push/snapshot/roster_snapshot.cpp` |
| 4 | the account object, the selected character object, one object per item | `push/snapshot/family4_snapshot_preparer.cpp` |
| 5 | the global override object | `push/queuez/queuez_family5_push.cpp` |

Paths are under `src/server/bap/encrypted/`. Any other family gets an empty full snapshot. An empty
snapshot still moves the client's record to "synced".

The client subscribes in two ways:

- **Service 12.** The body is 9 bytes: a `u8` family type, then the `u64` root SOID. Sunrise
  answers with an empty service 13, then pushes the first snapshot on service 123.
- **ws opcode 206.** The body is bit-packed: 4 bits of family type plus 1, then 64 bits of root
  SOID. The client uses it for family 3. Sunrise puts the first snapshot in the first trailer blob
  of the 206 reply. If family 4 is not yet live on that link, Sunrise then pushes the family 4
  snapshot and the banner pair on service 123. It sends family 4 once more 400 ms later.

Both paths end in `append_queuez_notification` in `push/queuez/queuez_subscription.cpp`.

### The service 123 body

The body is big-endian and has no padding. It is encoded by
`src/middleware/queuez/queuez_update.cpp`.

```c
#pragma pack(push, 1)
struct QueuezUpdate {            /* the service 123 body */
    uint32_t family_count;       /* +0x00, never 0 */
    /* family_count QueuezFamily records follow */
};

struct QueuezFamily {            /* 21 bytes */
    uint32_t family_type;        /* +0x00 */
    uint64_t family_root_soid;   /* +0x04 */
    int32_t  version;            /* +0x0C, -1 is refused */
    uint8_t  flags;              /* +0x10, bit 0 = full snapshot */
    uint32_t object_count;       /* +0x11, 0 is legal */
    /* object_count QueuezObject records follow */
};

struct QueuezObject {            /* 20 bytes, then the payload */
    uint32_t object_id;          /* +0x00, a definition id, not a slot */
    uint64_t object_version;     /* +0x04, the object's SOID for family 4 */
    uint32_t payload_len;        /* +0x0C, 0 = delete this object */
    uint32_t encoding;           /* +0x10, see below */
    /* payload_len bytes */
};
#pragma pack(pop)
```

| `encoding` | meaning | Sunrise uses it for |
|---:|---|---|
| 0 | none; goes with a delete | -- |
| 1 | tag reflection, a bit-packed schema walk | family 5, and some small updates |
| 2 | binary diff | not used |
| 3 | raw bytes, starting with the object version | not used |
| 4 | Oodle-compressed image | the family 4 objects |

Rules:

- The first update to a family must set flag bit 0, full snapshot. The client refuses it otherwise.
- A full snapshot replaces the family. Objects it does not name are deleted.
- After the first snapshot, each change goes out at the next version. Sunrise tracks the version it
  last sent on each connection.
- Sunrise caps one notification at 64 KiB and one object payload at 96,280 bytes.

### Family 4: the account itself

Family 4 is what boot step 23 waits for. Its root SOID is the account SOID from the 503 reply.

| object | size before compression | holds |
|---|---:|---|
| account | 96,280 bytes | roster, profile inventory, progressions, flags, settings, key bindings |
| selected character | 46,928 bytes | the character's equipment, inventory and state; only after a pick |
| item instance | 416 bytes each | one per owned item, including profile items the game can act on |

Each object is a byte-exact image of the game's own structure. Sunrise fills it from `AccountState`
(`src/middleware/datagen/family4/`), then compresses it with Oodle. The layouts are described in
[Items, characters and inventory](/docs/destiny-2/investment-data/).

## Inventory actions: the ws RPC

Every player action is a web service call on BAP service 10, answered on service 11. The same
envelope runs on 110 and 112. The codec is `src/middleware/web_service/web_service_envelope.cpp`.

```c
struct WsEnvelope {              /* the service 10 or 11 body */
    uint16_t opcode;             /* +0x00, big-endian */
    uint32_t transaction_id;     /* +0x02, big-endian; the reply echoes it */
    /* +0x06: the payload, bit-packed MSB first, laid out by the opcode's definition */
    /* then two trailer blobs, each: 1 presence bit [, 16-bit length, bytes] */
};
```

The reply echoes the opcode and the transaction id. Most replies then start with a status:

```c
/* The status fields, in order, all bit-packed. */
code  : 5 bits   /* stored as logical code + 1; 0 = success, 1 = refused */
value : 32 bits  /* stored as logical value - INT32_MIN; a family 4 version, or -1 */
flag  : 1 bit    /* only for opcodes 104 and 901 */
```

| shape | bits | example opcodes |
|---|---:|---|
| status only | 5 | 206 |
| status pair | 37 | 402, 403, 404, 504, 701, 903, 1801, 2400 |
| status pair and flag | 38 | 104, 901 |
| no status | 0 | opcodes Sunrise does not know |

Sunrise sets both trailer presence bits to 0, except in the 206 reply.

### The version in the reply

A reply that changes the account names the family 4 version that will carry the change. The client
waits for that version before it treats the action as done.

```c
/* How Sunrise answers one account action, e.g. opcode 403 equip. Simplified. */
begin_database_transaction();
plan = prepare(request);                    /* check the action against the account */
if (!plan.ok) {
    rollback();
    send(reply(code = 1));                  /* refused; nothing changes */
    return;
}
next  = session.family4Version + 1;
reply = reply(code = 0, value = next);
push  = family4_update(plan, next);         /* on service 123 */
if (fits(reply, push) && commit_database_transaction()) {
    send(reply, push);                      /* one socket write */
    session.family4Version = next;
} else {
    rollback();                             /* nothing is sent */
}
```

- The value -1 means there is nothing to wait for. Sunrise sends it in 503 and in any reply that
  changes nothing.
- A refused action gets code 1 in its own shape. An opcode whose own codec fails gets a bare echo
  of the header, so the client's task still completes.

### Opcodes Sunrise acts on

The dispatch is in `src/server/web_service/web_service_runtime.cpp` and
`src/server/bap/encrypted/body/bap_service_body.cpp`.

| opcode | action |
|---:|---|
| 205 | send the family 5 object again |
| 206 | subscribe to a family |
| 402 | dismantle an item |
| 403, 404 | equip, unequip |
| 406 | change item state flags |
| 503 | account bootstrap |
| 504 | pick a character |
| 505 | change character |
| 701 | save game settings |
| 702 | the character write-back the client sends on its own |
| 801 | pick a subclass |
| 901 | buy from a vendor; the seasonal artifact vendor has its own path |
| 903, 1901 | insert a socket plug |
| 904 | pick up a quest |
| 1801 | claim a record |
| 1820 | acquire one item instance |
| 1821 | equip a title |
| 2400 | claim a season pass reward |

Any other opcode gets a correlated reply and no action. The reply uses the status shape Sunrise
has on record for that opcode, or no status at all.

## What persists

| survives a restart | lost at exit |
|---|---|
| the account SOID and profile setup flag | which character is selected |
| characters, their items, sockets and stacks | the activity each character is in |
| currencies and materials | the sign-in time |
| unlocks, objectives and progressions | the SignOn token and every link key |
| family 5 overrides | each connection's queuez versions |
| game settings and key bindings | |
| pending rewards | |

The session-only fields live beside the database, not in it (`Session` in
`src/state/investment/store_internal.h`). After a restart no character is selected until the
player picks one.

## Open questions

- The second family 4 push after ws opcode 206 runs on a fixed 400 ms delay. The client report
  that should trigger it is unknown.

## Related pages

- [How Sunrise is built](/docs/sunrise/architecture/) shows where the state and server layers sit.
- [The Activity Host](/docs/sunrise/activity-host/) covers what happens after orbit.
- [Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/) covers log files and levels.
