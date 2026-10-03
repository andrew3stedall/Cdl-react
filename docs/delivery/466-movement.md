# #466 movement lane delivery

This document tracks the roster, trade, acquisition, and planned-domain work owned by the movement lane.

## Completed

- **#490 squad validation**: projected positional limits now use only players owned by the manager's own team. `list_squad_players()` intentionally includes all teams for league views, so using it unfiltered caused legal replacement actions to count rivals' players against the manager. A service regression test covers a valid defender-for-defender swap while the rival squad exceeds that position limit.
- **#495 trade approval foundation**: proposal acceptance now marks approval pending without changing ownership. A separate authenticated approval endpoint routes through league roles; PostgreSQL applies ownership history, audit, and future unlocked lineup repair in one transaction. Execution rechecks asset composition, current ownership, slot availability, and roster caps before committing. The manager trade list remains participant-scoped; the approver queue is separate.
- **#524 approval/audit queue foundation**: `GET /api/trades/approvals` returns pending agreements for which the authenticated non-participant has the required league role. `GET /api/trades/{trade_id}/audit` exposes append-only events only to participants and eligible approvers. Replays of an approved trade revalidate role and participant status before returning trade details.

## In progress

- **#520 ranked free-agency draw**: persist scheduled/open/locked/processed windows, private ordered manager preferences, a randomized order, public awards, per-manager results, temporary claim rights, and idempotent transaction processing. Players auto-add only when squad limits and a compatible slot allow it; future unlocked lineups repair in the same transaction.

## Parked decisions

- **#521 draft**: existing draft picks have no agreed snake/linear order, clock duration, pause policy, or timeout selection rule. Implementing a timer/auto-pick now would make irreversible picks under a guessed policy.
- **#522 league/season setup**: the create flow has no decision for manager assignment timing (invite acceptance versus commissioner assignment), draft-team count, or season activation/deactivation behavior. Existing tables do not define those lifecycle transitions.
- **#523 rules publication**: the rules service does not yet provide immutable rule-set versions with effective gameweek/date intervals. Loan limits, trade windows, roster limits, and conversion rules need those effective-dated values before enforcement can be authoritative.
- **#525 loans and returns**: the policy has not chosen minimum term, extension count, permanent-conversion timing/fee, return eligibility, or whether returning players may play immediately. These values must be supplied as versioned league rules before loan execution is safe.
- **#533 ownership history**: history reads need a canonical season/team/player identity and correction semantics across draft, draw, trade, free-agent, and loan sources. Mutations here retain ownership end/start rows; a cross-source history endpoint needs the canonical event projection and correction policy.

Migration work for persistent trade approval/execution and ranked draws uses `0030_movement_workflows.py` after `0029_targeted_league_invites`, as assigned by the milestone coordinator. No cloud or GitHub mutations are part of this lane.
