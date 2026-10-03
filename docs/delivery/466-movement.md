# #466 movement lane delivery

This document tracks the roster, trade, acquisition, and planned-domain work owned by the movement lane.

## Implemented in the movement backend

- **#490 squad validation**: projected positional limits now use only players owned by the manager's own team. `list_squad_players()` intentionally includes all teams for league views, so using it unfiltered caused legal replacement actions to count rivals' players against the manager. A service regression test covers a valid defender-for-defender swap while the rival squad exceeds that position limit.
- **#495 trade approval foundation**: proposal acceptance now marks approval pending without changing ownership. A separate authenticated approval endpoint routes through league roles; PostgreSQL applies ownership history, audit, and future unlocked lineup repair in one transaction. Execution rechecks asset composition, current ownership, slot availability, and roster caps before committing. The manager trade list remains participant-scoped; the approver queue is separate.
- **#520 ranked free-agency draw**: scheduled/open/locked/processed windows, private ordered manager preferences, a persisted random order, public awards, per-manager results, temporary claim rights, and transaction-safe idempotent processing are implemented. Processing serializes on the season row, observes the configured FPL deadline, and repairs future unlocked lineups for acquisitions with a compatible slot. The frontend commissioner controls for create/open/lock/process remain in progress.
- **#524 approval/audit backend foundation**: `GET /api/trades/approvals` returns pending agreements for which the authenticated non-participant has the required league role. `GET /api/trades/{trade_id}/audit` exposes append-only proposal, agreement, and approval events only to participants and eligible approvers. Replays of an approved trade revalidate role and participant status before returning trade details. Frontend approval queue integration remains in progress.

## Validation evidence

Local focused validation passes Ruff and 27 backend tests; 4 tests that require the migrated PostgreSQL CI service are skipped in the local environment. PostgreSQL-gated tests cover trade transaction rollback and ownership visibility through squad summary/team selection, and draw preference privacy, persisted results/rights, and repeat processing. CI execution is still required to verify those database-backed cases.

## Parked decisions

- **#521 draft**: existing draft picks have no agreed snake/linear order, clock duration, pause policy, or timeout selection rule. Implementing a timer/auto-pick now would make irreversible picks under a guessed policy.
- **#522 league/season setup**: the create flow has no decision for manager assignment timing (invite acceptance versus commissioner assignment), draft-team count, or season activation/deactivation behavior. Existing tables do not define those lifecycle transitions.
- **#523 rules publication**: the rules service does not yet provide immutable rule-set versions with effective gameweek/date intervals. Loan limits, trade windows, roster limits, and conversion rules need those effective-dated values before enforcement can be authoritative.
- **#524 general correction workflow**: current audit reads cover trade history only. The correction product policy has not specified allowed target records/fields, the required before/after payload, how an approved correction recomputes dependent scoring or draft state, who may request/approve it, and how competing approvals are handled. The generic correction forms and admin-action schema remain blocked until those decisions are supplied.
- **#525 loans and returns**: the policy has not chosen minimum term, extension count, permanent-conversion timing/fee, return eligibility, or whether returning players may play immediately. These values must be supplied as versioned league rules before loan execution is safe.
- **#533 ownership history**: history reads need a canonical season/team/player identity and correction semantics across draft, draw, trade, free-agent, and loan sources. Mutations here retain ownership end/start rows; a cross-source history endpoint needs the canonical event projection and correction policy.

Migration work for persistent trade approval/execution and ranked draws uses `0030_movement_workflows.py` after `0029_targeted_league_invites`, as assigned by the milestone coordinator. No cloud or GitHub mutations are part of this lane.
