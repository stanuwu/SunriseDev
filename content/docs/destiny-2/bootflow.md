---
title: "Bootflow"
date: 2026-09-28
description: "The client's boot state machine: its 79 steps, how a step runs, and how it fails."
weight: 70
---

The bootflow is the client's boot state machine. It takes the game from the first frame to a
player standing in the world. It has 79 named steps. Each step waits on something, then asks the
machine to move on.

Step names are the game's own strings. Function and field names are descriptive labels. For what
Sunrise answers at each step, see [From launch to orbit](/docs/sunrise/boot-and-sign-in/).

## The step table

The step names sit in one table of 79 string pointers, indexes 0 to 78, ended by a null. The
table lists the boot sequence in order.

The table looks like several name lists joined together. The split below is not verified:

| indexes | group |
|---|---|
| 0 to 49 | bootflow, setup, activity and bubble-host steps |
| 50 to 57 | transitioning states |
| 58 to 70 | error states |
| 71 to 78 | Activity Host state names, not bootflow steps |

No known code uses a step index above 39.

### Main steps, start to in-world

These are the steps a boot passes through on the way to the world. "Waits on" is what holds the
step before it hands off. "Not read" means the name and its place are known, but what the step
waits on is not.

| # | name | waits on |
|---:|---|---|
| 0 | `pregame` | not read |
| 1 | `bootflow:media_check` | not read |
| 2 | `bootflow:bootload` | not read |
| 3 | `bootflow:start` | not read |
| 4 | `bootflow:platform_signin` | not read |
| 5 | `bootflow:platform_account_warnings` | not read |
| 6 | `bootflow:enumerate_content_rights` | not read |
| 7 | `bootflow:account_signin` | not read in detail |
| 16 | `bootflow:content_check` | installed content; one DLC wait fails after 2 s |
| 21 | `bootflow:package_registration` | not read |
| 22 | `bootflow:bap_signin` | 19 tasks; two are package loads (patchable bootstrap, investment globals) |
| 23 | `bootflow:investment_signin` | six tasks; the last waits for the account's investment data |
| 24 | `bootflow:profile_setup` | the player clicking through the startup settings screens |
| 25 | `bootflow:prepare_for_orbit` | a slice-set load, a status, then two network port checks |
| 26 | `bootflow:rejoin_activity` | nothing remote; its first state comes from the profile data |
| 27 | `character:signin` | character select or creation, and the chosen character's data |
| 28 | `cleanup` | its own teardown tasks |
| 29 | `setup:orbit` | its handoff conditions; picks the destination on entry |
| 30 | `setup:activity_session_creation` | the activity session and the matchmaking config reply |
| 31 | `setup:matchmaking` | the matchmaking composition check |
| 32 | `setup:activity_host_setup` | not read |
| 33 | `setup:prologue_intro_loading` | the activity package load and the activity's name |
| 34 | `setup:orbit_outro` | not read |
| 35 | `setup:activity_world_transition` | the world change; needs the bubble count and slice sets |
| 36 | `activity:initial_slice_set_loading` | eleven tasks: loading screen, slice-set load, region data |
| 37 | `activity:physics_join` | a travel cinematic, if one is armed; capped at 15 s |
| 38 | `activity:in_world` | nothing; the player is in the world |
| 39 | `activity:watch_video` | not read |

Measured boots go 7 -> 16 -> 21. It skips steps 8 to 15 and 17 to 20. Those are account, content
and queue gates: `entitlement_warning`, `sms_validation`, `free_license_limit_exceeded`,
`excessive_mtx_debt`, `eula`, `upsell`, `email`, `confirm_account_transfer`, `content_install`,
`insufficient_content_space`, `illegal_dlc_media` and `queuing`.

Steps 40 to 49 are the `bubble_host:*` steps. From the names, they run when this client hosts a
bubble. That is not verified.

For the activity steps from 29 on, see
[Activities and destinations](/docs/destiny-2/activities-and-destinations/).

### Step 28 in a failure

Step 28 `cleanup` is where almost every failure sends the machine. Of the 69 places that raise a
failure, 61 name step 28. So "step 28" in a failure says almost nothing about where it happened.
The reason code carries that.

## How a step is described

A step has two parts: a descriptor and a step object.

The descriptor is a table of handler pointers in read-only data. It is 9 or 14 slots long.
Unused slots point at an empty stub.

```c
struct BootStepDescriptor {          /* 0x48 or 0x70 bytes */
    void (*destroy)(void *step);     /* +0x00  slot 0 */
    void (*construct)(void *step);   /* +0x08  slot 1 */
    void (*unused)(void);            /* +0x10  slot 2, empty stub */
    void (*enter)(void *step);       /* +0x18  slot 3 */
    void (*exit)(void *step);        /* +0x20  slot 4, or empty stub */
    int  (*can_advance)(void *step); /* +0x28  slot 5, same in every step */
    void (*update)(void *step);      /* +0x30  slot 6 */
    void *filler[2];                 /* +0x38  slots 7 and 8 */
    /* longer descriptors carry more slots */
};
```

Slot 5 is `CanAdvance`, the same function in every step. It checks the step's blocker bits.
Slot 6 is the step's own `Update`, which runs each frame.

A step's descriptor cannot be found by a fixed stride from its neighbor. The only sound source is
the manager's constructor, which assigns each step its descriptor.

### The step object

All steps live inline in one manager object of about 20 KB. Each step object starts with its
descriptor pointer.

```c
struct BootStep {                    /* size varies per step */
    const BootStepDescriptor *desc;  /* +0x00 */
    uint64_t blocker_mask;           /* +0x08  bits CanAdvance checks */
    uint8_t  pad[0x20];
    void    *wait_object;            /* +0x30  task block or event listener */
    /* step-specific fields follow */
};
```

The object at `+0x30` depends on how the step waits:

- A task-driven step (22, 23, 28) holds a task block. Steps 30 to 38 run the same task engine.
  Step 38 keeps its block at `+0x40`.
- An event-driven step (24, 27) holds a listener. The step posts a UI screen, the screen raises an
  event, and the listener moves the step's own state.

### The task block

A task-driven step runs up to 8 tasks. Four bit masks track them.

```c
struct BootTaskEntry {               /* 32 bytes */
    uint8_t prereq_mask;             /* tasks that must finish first; word before the entry */
    void  (*start)(void);
    int   (*poll)(struct TaskStatus *s); /* 3 = done, 1 = keep polling */
    void  (*on_step)(void *step);
};

struct TaskStatus {                  /* 16 bytes, built on the stack per call */
    int32_t state;                   /* +0x00  0 new, 1 started, 2 failed, 3 done */
    int64_t elapsed_ms;              /* +0x08 */
};

struct BootTaskBlock {
    void         *vtable;            /* +0x000 */
    BootTaskEntry tasks[8];          /* about +0x008; exact start not verified */
    uint64_t      requested;         /* +0x108 */
    uint64_t      started;           /* +0x110 */
    uint64_t      failed;            /* +0x118 */
    uint64_t      completed;         /* +0x120 */
    uint64_t      time[8];           /* +0x128  start time, then duration */
};
```

A step is done when `requested == completed`. So `requested ^ completed` is the set of tasks still
holding it.

The client logs each finished task, for example
`world_controller:task_manager: Completed task 'ENUM(2)' after '909ms'.` Task names print as
`ENUM(n)` because the build has no task name table.

## Current step and goal step

The manager holds two step numbers:

| field | meaning |
|---|---|
| current step | the step running now |
| goal step | the step the machine is heading for |

The machine walks from the current step toward the goal. A step does not have to name its
successor. If the goal is past it and `CanAdvance` passes, the machine walks on.

Fireteam and posse sessions also carry their own goal step. A goal change is refused while a group
host is behind the local step, or while a fireteam join is in progress.

### The step loop

The loop below is a model built from the known parts. The manager's own tick function is not
verified.

```c
void BootFlow_Tick(BootFlowManager *mgr)
{
    BootStep *step = mgr->steps[mgr->current];

    step->desc->update(step);                 /* may raise a goal change */

    if (mgr->goal == mgr->current)
        return;                               /* nothing to do */

    if (!step->desc->can_advance(step))
        return;                               /* a blocker holds the step */

    int next = BootFlow_NextStepToward(mgr->current, mgr->goal);
    step->desc->exit(step);
    mgr->current = next;
    step = mgr->steps[next];
    step->desc->enter(step);
    log("state_manager: Entering state '%s' for reason '%s'.",
        BootFlow_GetStepName(next), BootFlow_GetReasonName(mgr->goal_reason));
}
```

`CanAdvance` walks up to 41 blocker bits. Each set bit calls a check. A check returns 0 or 1 to
let the step go. A return of 2 fails the step into cleanup:

```c
int BootFlow_Step_CanAdvance(BootStep *step)
{
    for (int bit = 0; bit < 41; bit++) {
        if (!(step->blocker_mask & (1ull << bit)))
            continue;
        int reason = -1;
        int r = BootFlow_CheckBlocker(step, bit, &reason);
        if (r != 0 && r != 1) {
            BootFlow_ReportFailure(28, reason);   /* goal := cleanup */
            return 0;
        }
    }
    return 1;
}
```

## BootFlow_ReportFailure

`BootFlow_ReportFailure(step, reason)` raises every step change, not only failures. The name is a
label and is too narrow. The function sets the goal step.

```c
int BootFlow_ReportFailure(uint32_t step, uint32_t reason)
{
    char why[256];                                    /* size not read */
    if (!BootFlow_GoalChange_Veto(step, reason, why)) {
        /* refused: log, at most once per 30 s for the same text */
        log("world_controller:state_manager: State '%s' requested for reason '%s', "
            "but we can't: '%s'.", step_name(step), reason_name(reason), why);
        return 0;
    }
    return BootFlow_SetGoalStep(mgr, step, reason);   /* goal := step */
}
```

Two things follow:

- The client logs only when the change is refused. On the normal path it writes the goal and logs
  nothing.
- A thin wrapper passes reason 0. Steps use it to hand off to their successor. Its argument is the
  destination step, not the step that called it.

### Reading a (step, reason) pair

Read `step` as where the client is now heading. Read `reason` as what went wrong. Only the call
site names the actual check.

Reason names are blank in this build. Every reason prints as `unavailable`. Each reason slot does
carry a unique 32-bit value. It may be a hash of the lost name. That is not verified.

The reason numbers seem to come in blocks by subsystem. This grouping is inferred from the sites
that raise each range:

| reasons | apparent owner |
|---|---|
| 3 to 11 | early bootflow |
| 23, 24, 54 to 66 | session and bubble-host lifecycle |
| 121 to 128 | platform sign-in, entitlement and license |
| 130 to 181 | content, account and investment sign-in |
| 273 to 303 | license enumeration and the login queue |
| 335 to 361 | activity and world setup |

## Common failures

Every row here sets the goal to step 28 `cleanup`.

| reason | where | guard |
|---:|---|---|
| 4 | matchmaking | the composition check fails, for example a solo player counted as a "big party" |
| 9 | `setup:orbit` | a join wait passes its time limit |
| 55 | steps 33 and 36 | a task fails; for step 33 often the activity package load |
| 56 | `prepare_for_orbit` | the step's status lands on "failed" |
| 57 | `setup:orbit` | an unnamed local check |
| 124 to 128 | early sign-in | the content or entitlement fetch returns an error; 124 is the default |
| 174 | `investment_signin` | a blocker fires, for example an investment reply that cannot be decoded |
| 175 | `investment_signin` | task 0 runs past about 30 s, or the login-queue sign-in block is set |
| 176 to 180 | `investment_signin` | the login queue's first error, as code + 174 |
| 181, 303 | `investment_signin` | a login-queue latch is set |

Reason 175 has more than one producer. The number alone does not name the site.

Step 23 never fails with a nonzero reason of its own. A pair like `(23, 175)` cannot come from a
direct call.

A step can also hang with no failure at all. Step 26 picks its first state from the account's
profile data on entry. If that data is missing, the step sits in a state its update has no case
for. It does nothing every frame and reports nothing.

## Open questions

- What steps 0 to 7, 21, 32, 34 and 39 wait on.
- Whether the step table is several lists joined, and what steps 40 to 49 do.
- The manager's own tick function.
- Whether the 32-bit reason values are hashes of the lost reason names.

## Related pages

- [From launch to orbit](/docs/sunrise/boot-and-sign-in/) -- what Sunrise answers at each step.
- [Activities and destinations](/docs/destiny-2/activities-and-destinations/) -- steps 29 to 39.
- [The Activity Host protocol](/docs/destiny-2/activity-host-protocol/) -- the messages steps 33 to
  36 wait on.
- [Packages](/docs/destiny-2/packages/) -- the content steps 2, 22 and 33 load.
