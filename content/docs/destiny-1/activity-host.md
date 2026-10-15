---
title: "The Activity Host"
date: 2026-10-15
description: "How Destiny 1 splits a mission between the Activity Host, the physics peer and the clients, and what the client's own code shows about joining, leases and authority."
weight: 40
---
In Destiny 1 a light server process, the Activity Host, runs the mission script. It decides mission
progress from small facts the clients report. It does not simulate the world. Simulation runs on the
players' consoles: one console is the physics peer, and every console runs its own actors, movement
and combat.

Two sources describe this. Bungie's own talk gives the design. The PS4 client's code confirms the
parts on this page that name a message or a state.

## Bungie's design

Justin Truman described the design in *Shared World Shooter: Destiny's Networked Mission
Architecture* at [GDC 2015](https://www.gdcvault.com/play/1022246/Shared-World-Shooter-Destiny-s).

| topic | what the talk says |
|---|---|
| roles | a player's session spans the client, the activity, the bubble and services, not one game server |
| the Activity Host | a light process that runs a stripped mission script |
| private and public | private missions and the public world have different topology and lifetime |
| mission state | small, driven by sensors, atomic and persistent |
| messages | clients publish Sense data and receive authoritative Auth data |
| encounters | a squad encounter advances on sensed facts, script decisions and state updates |
| late join | a joining client is rebuilt from the authoritative mission state |
| ownership | mission-owned and public-bubble-owned state sit side by side, with explicit owners |
| trust | mission-critical decisions made only on a client open the game to exploits |
| sensors | a sensor API is the boundary between simulation and mission logic |
| physics | a separate concern from the mission loop |

The talk's figures, such as the 10 Hz rate and the memory budgets, are about Destiny 1 only.

In Destiny 1 the physics host ran on a player's console. Bungie moved it into its data centers for
Destiny 2, beside the Mission Host
([This Week at Bungie, 25 May 2017](https://www.bungie.net/7/en/News/article/45919/undefined)).

## Activity messages

The client's activity message enum has 49 entries. It differs from Destiny 2's from index 11 on.

The lease and authority messages, from the client's own name table:

| id | message |
|---:|---|
| 19 | `allocate_entity_indices` |
| 20 | `free_entity_indices` |
| 23 | `claim_authority_over_abandoned_entity_slots` |
| 24 | `purge_abandoned_entity_slots` |
| 25 | `abandon_entity_slots` |
| 27 | `reset_entity_slot_authority_mask` |
| 29 | `query_entity_slot_authority_mask` |
| 30 | `query_entity_slot_authority_mask_per_bubble_response` |
| 31 | `query_entity_slot_authority_mask_response` |
| 32 | `abdicate_authority` |
| 38 | `script_state` |
| 39 | `script_event` |
| 42 | `advance_replication_epoch` |

The client reads and discards the bodies of `script_state` and `script_event`.

These ids are Destiny 1's. Destiny 2 moved several of them; see
[The build: Differences from Destiny 1](/docs/destiny-2/the-build/#differences-from-destiny-1).

## Joining an activity

**The client joins the Activity Host first, then the physics peer.**

1. The Activity Client sends the join to the Activity Host and waits for the answer.
2. It waits for its entity indices.
3. Only then does it report itself ready to create objects.
4. The world controller state `c_world_controller_state_activity_physics_join_handler` waits for the
   physics session, reconciles six peer slots, and moves on once the join is complete. It starts
   with a retry budget of 150.

That join state calls no Havok, actor, navigation or combat code. It only connects.

## Leases and authority

**The Activity Host hands out leases and authority. The physics peer owns the simulation.**

- The Activity Host assigns entity index leases and authority masks.
- The physics peer owns the chosen entity records and produces the simulation events.
- Each console still produces and consumes its own actor, movement and combat state.

The client's simulation queue names two authority payloads, `entity_claim_authority` and
`entity_authority_change`. Its error path routes an event to an "authority machine".

How the client applies them:

| message | what the client does |
|---|---|
| entity index allocation | matches one 64-bit activity session across three Activity Client contexts and applies it there |
| replication epoch | updates the matching Activity Client, then tells the local world separately |
| authority claim, authority change, entity handoff | all reach one peer mirror |

The peer mirror expands a 640-slot mask and resolves each occupied entity. It then creates missing
mirror state or updates it, based on the current authority. A handoff changes the owner first, then
runs both mirror phases for every listed entity.

**This is a reconcile and mirror contract.** The reset has an explicit acknowledgement. The query
has per-bubble and total answers. Allocation and epoch are keyed by session. None of these paths
runs a physics step on a server.

## Squads

The Activity Host writes squad state that the client applies to each squad member.

- The type-1 squad value schema is `0x8080071E`, `0x7C` bytes.
- When the state first arrives, the client reads bytes `+0x41`, `+0x42` and `+0x43`, calls a
  per-member function with all three for every live member, and caches them in the squad.
- On each update it compares the three bytes with the cache and repeats the call when they change.
- A separate dword at `+0x64` marks every member dirty when it changes.

**What the three bytes mean is unknown.** The per-member function calls a callback that lives in
package data, and no implementation of it was recovered. Their client default is `(0, 0, 0)`, the
same for every squad. The packages of 126 worlds hold no per-squad authored values for this state.
So 0 has no proved meaning such as passive or aggressive.

The client class `c_squad_sensor_authority_change_observer` keeps squad sensor bindings in step
with authority. It checks the current authority and reconciles or clears the bindings.

## Open questions

- The bit layouts of the authority mask and query messages.
- The timer and storage behind the acknowledgement retries.
- How the client picks the authority machine for an outgoing event.
- Whether a late join resends the full mask, or only the allocation and the epoch.
- What writes squad bytes `+0x41` to `+0x43` on a retail Activity Host, and what they do.
