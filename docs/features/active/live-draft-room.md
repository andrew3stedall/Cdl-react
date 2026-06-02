# Live Draft Room

## Purpose

Define the live sequential draft workflow, draft order modes, pick clock, preselection queues, autopick behaviour, and commissioner controls.

## Status

Checkpoint 1 complete.

## Business Rules

- Draft is live and sequential.
- Draft order supports random repeated, snake, and manual modes.
- Draft picks create active squad assignments immediately.
- Commissioner can enable or disable pick clock.
- Pick time limit is configurable.
- Pick duration is tracked.
- Timeout autopick can use manager preselection queue, then fallback strategy.
- Default fallback strategy is highest FPL cost available.
- Managers can maintain preselection queues between turns.
- Preselection ordering mode is configurable.
- Commissioner can pick on behalf of manager; action is public and audited.

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

## Data Access Requirements

- Enforce only current on-clock manager can pick unless commissioner-on-behalf.
- Enforce player cannot be drafted twice in a league season.
- Track `clock_started_at`, `clock_deadline_at`, and `seconds_taken`.

## Acceptance Criteria

- Draft can run with or without clock.
- Timeout selects from preselection queue when available.
- Commissioner-on-behalf pick is visibly marked and audited.
