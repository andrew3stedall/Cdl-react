# #466 movement lane delivery

This document tracks the roster, trade, acquisition, and planned-domain work owned by the movement lane.

## Completed

- **#490 squad validation**: projected positional limits now use only players owned by the manager's own team. `list_squad_players()` intentionally includes all teams for league views, so using it unfiltered caused legal replacement actions to count rivals' players against the manager. A service regression test covers a valid defender-for-defender swap while the rival squad exceeds that position limit.
- **#495 trade approval foundation**: proposal acceptance now marks approval pending without changing ownership. A separate authenticated approval endpoint routes through league roles; PostgreSQL applies ownership history, audit, and future unlocked lineup repair in one transaction. The approval fields remain additive to the existing response and accepted status.

## In progress

- **#520 free-agency draw**: replace flat interests as the draw submission with private ordered preferences, deterministic processing, public awards, and idempotent persisted results/temporary rights.

## Parked decisions

- Loan minimum/extension/permanent-conversion rules and return timing need explicit versioned league-rule fields before their service can safely enforce them (**#525**).
- Draft order modes, clock semantics, manager queue visibility and timeout tie-breaking require a configured draft lifecycle contract; existing draft endpoints are staging examples (**#521**).
- League/season setup and effective rule version publication require coordinated ownership of membership and versioned-config schemas (**#522–#524**).
- Ownership history needs stable season/team assignment and correction semantics across draft, draw, trade, free-agent, and loan sources (**#533**). The movement lane will preserve historical records in implemented transactions; the read API remains blocked on that unified identity contract.

Migration work for persistent trade approval/execution and ranked draws uses `0030_movement_workflows.py` after `0029_targeted_league_invites`, as assigned by the milestone coordinator. No cloud or GitHub mutations are part of this lane.
