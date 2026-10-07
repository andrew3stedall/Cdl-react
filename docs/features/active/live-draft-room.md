# Live Draft Room

## Purpose

Define the live sequential draft workflow, draft order modes, pick clock, preselection queues, autopick behaviour, and commissioner controls.

## Status

Persistent PostgreSQL draft API and standalone room page are implemented and the FastAPI router is mounted at `/api/live-draft`. The configured active season is already drafted. An authenticated availability read now hides commissioner setup controls and explains the active-squad block before a create attempt; the transactional create guard remains authoritative. Starting a room for the next season is targeted for 1 August 2027 and depends on league/season context and setup support in #522; until that work is delivered, the active-season ownership guard remains in place.

## Business Rules

- Draft is live and sequential.
- Draft order supports random repeated, snake, and manual modes.
- Draft picks create active squad assignments immediately.
- The draft can only be marked complete after every scheduled pick has created an assignment. A new room is rejected when the configured season already has active squad ownerships.
- The configured draft fills all 20 roster slots. During the draft, picks must respect the seeded position limits: GKP 2–3, DEF 4–10, MID 5–10, FWD 2–4. Picks/autopick are rejected if the remaining player pool could no longer satisfy every team's position minima.
- Commissioner can enable or disable pick clock.
- Pick time limit is configurable.
- Pick duration is tracked.
- Timeout autopick can use manager preselection queue, then fallback strategy.
- Default fallback strategy is highest FPL cost available.
- Managers can maintain preselection queues between turns.
- Preselection ordering mode is configurable.
- Commissioner can pick on behalf of manager; action is public and audited.
- Draft order, room state, picks, pick clock, queue, and activity persist in PostgreSQL. Pick transactions lock the season then room, enforce one pick per player and turn, carry an idempotency key, and create the squad ownership in the same transaction.
- Pausing stores the remaining clock duration; resuming continues the same turn with that remaining duration.
- Timeout auto-pick uses the on-clock team's ranked queue before highest current FPL cost, then player ID for deterministic ties.
- A room refresh after a deadline expires applies the timeout pick transactionally, so the configured timeout does not depend on an administrator clicking an action. Concurrent refreshes share a deadline/pick idempotency key.

## Target Architecture

```text
drafts
draft_picks
draft_events
draft_preselection_settings
draft_preselection_queue
admin_actions
```

`draft_picks.pick_source` values:

```text
manager_manual
manager_preselection_auto
system_timeout_auto
commissioner_on_behalf
commissioner_correction
```

## API Requirements

- Generate draft order.
- Start/pause/resume/complete draft.
- Get draft room state.
- Make pick.
- Auto-pick on timeout.
- Manage preselection queue.
- Commissioner pick on behalf.
- Correct pick with audit.

## React Requirements

- Draft room with current pick, player pool, draft board, team squads, and pick history.
- Clock display when enabled.
- Preselection queue management.
- Auto-select toggle.
- Commissioner controls.
- Public activity feed for draft events.
- The standalone `DraftWorkspacePage.tsx` supports setup, mode/clock configuration, current pick, player pool, queue maintenance, manager picks, commissioner controls, activity, and draft board, and polls the persisted room after reconnect.

## Data Access Requirements

- Enforce only current on-clock manager can pick unless commissioner-on-behalf.
- Enforce player cannot be drafted twice in a league season.
- Track `clock_started_at`, `clock_deadline_at`, and `seconds_taken`.
- Room creation is bound to the currently configured league and season. It refuses to create a room if that season already has active ownerships, preventing existing squads from being overwritten. Active-season selection/setup remains a dependency of #522.
- Trade, draw, loan, and other ownership writes are blocked for the season while its draft is in setup, active, or paused state. They resume when that draft is complete.
- Commissioner corrections require a reason, release the original active assignment, replace the pick in its roster slot, and append a public correction event with both player IDs and the reason.
- Commissioner corrections are available only while the draft is active or paused and no lineup for the season has locked. Completed or lineup-locked draft history cannot be changed.

The implemented API routes are `GET /live-draft`, `GET /live-draft/teams`, `POST /live-draft`, `POST /live-draft/control/{action}`, `PUT /live-draft/queue`, `POST /live-draft/pick`, `POST /live-draft/auto-pick`, `POST /live-draft/commissioner-pick/{team_id}`, and `POST /live-draft/correction/{pick_number}`. The screen polls persisted state every five seconds; room reads execute an expired timeout pick transactionally.

## Acceptance Criteria

- Draft can run with or without clock.
- Timeout selects from preselection queue when available.
- Commissioner-on-behalf pick is visibly marked and audited.
