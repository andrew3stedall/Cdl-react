# Transfers, Loans, and Negotiations

## Purpose

Define in-app trade/loan negotiation, offer counters, party agreement, commissioner approval, loan lifecycle, and squad effects.

## Status

Checkpoint 3 complete.

## Business Rules

- Negotiations happen in app through structured offers and counters.
- Both parties must agree before approval.
- Commissioner approval is required before actioning a transfer or loan.
- Commissioner-involved transfers require vice commissioner approval.
- Incoming players auto-add if outgoing players create enough squad space.
- If not enough space, incoming players sit in available pool until activated.
- Loans have minimum duration, default 4 gameweeks.
- Loaned-out players count against lending team squad cap.
- Loan players automatically return to original squad.
- Loans can be extended or made permanent.

## Target Architecture

```text
trade_negotiations
trade_negotiation_participants
trade_negotiation_offers
trade_negotiation_offer_items
trade_negotiation_events
transfers
transfer_items
loans
approval_requests
```

## API Requirements

- Create negotiation.
- Submit offer.
- Counter offer.
- Agree offer.
- Submit for approval.
- Approve/reject.
- Action approved transfer/loan.
- Extend loan.
- Convert loan to permanent.
- Return loan automatically.

## React Requirements

- Negotiation thread with structured offers/counters.
- Private visibility to involved managers.
- Transfer summary before agreement.
- Approval state indicators.
- Loan detail view with return/extension/permanent conversion.

## Data Access Requirements

- Negotiation data is private to participants.
- Approved movement creates squad/player-right changes in a transaction.
- Loan return creates explicit events and squad changes.

## Acceptance Criteria

- Agreed transfer cannot affect squads until approved.
- Commissioner cannot self-approve.
- Loan return happens automatically and is auditable.

## Implemented trade agreement and approval contract

- `POST /api/trades` creates a private proposal for the participating managers.
- `PUT /api/trades/{trade_id}` with `accepted` records the receiving manager's agreement; it does not move ownership.
- `POST /api/trades/{trade_id}/approve` accepts `{ "decision": "approved" | "rejected", "note": "..." }` from the required league approver after party agreement.
- Trade responses expose `approval_status`, `required_approver_role`, `approved_by`, and `executed_at`.
- `GET /api/trades/approvals` returns pending agreements the signed-in eligible league approver may act on, including trades between other managers. Manager `GET /api/trades` remains participant-scoped.
- `GET /api/trades/{trade_id}/audit` returns the immutable trade audit events to participating managers or an eligible league approver. Other users receive not found.
- Commissioner-involved trades route to the vice commissioner. A trade participant cannot approve their own movement.
- Approval, ownership end/start records, audit events, and unlocked future-lineup repair commit in one transaction. A rejected or stale trade changes no ownership.

The existing `accepted` trade status remains the two-party agreement state for compatibility. Execution is represented by approved `approval_status` plus `executed_at`, preventing accepted proposals from silently changing ownership.

## Implemented ranked free-agency draw contract

- Commissioners create and open scheduled draws, then lock and process them after the preference window closes and before that gameweek's FPL deadline.
- Managers save an ordered private preference list with `PUT /api/free-agency/draws/{draw_id}/preferences` (`{ "player_ids": [...] }`). GET returns only that manager's `{ player_id, rank }` rows.
- Draw processing persists a randomized order once, awards each still-available player to the first team that ranked them, and stores one result per team. Reprocessing a completed draw returns the persisted draw unchanged.
- `GET /api/free-agency/draws` returns the season's draw list, including status, windows, and order after processing. `GET /api/free-agency/draws/{draw_id}/results` returns public awards plus only the caller's preferences and result.
- An awarded player is immediately added to the squad when the team has a compatible slot and remains within the 20-player and position limits. Otherwise, the team receives a temporary claim through the gameweek deadline. Future unlocked lineups are repaired in the same transaction as auto-additions.

## Persistent loan contract

- `POST /api/loans` creates a private proposal for a player currently owned by the signed-in manager's team and a team in the same league. A proposal does not change ownership.
- `PUT /api/loans/{loan_id}` accepts `agreed`, `rejected`, or proposer-only `cancelled`. Agreement by the borrower submits the loan for commissioner approval; a loan participant cannot approve it.
- `GET /api/loans/approvals` lists agreements visible to the required non-participant commissioner or vice commissioner. `POST /api/loans/{loan_id}/approve` records approval or rejection.
- Approval moves the active ownership record to the borrower, stores the original lender slot, preserves the lender's cap count, checks the borrower's 20-player and position limits, and repairs future unlocked lineups in the same transaction.
- Duration defaults to and cannot be shorter than four gameweeks. It starts at the next upcoming FPL gameweek and is clamped to the season's remaining gameweeks. Return is due after the due gameweek finishes. Successful FPL cache refresh runs the durable return processor; `GET /api/loans` also retries it. Each return moves ownership back and adds an audit event transactionally, so retries are idempotent.
- `GET /api/loans` and `GET /api/loans/{loan_id}/events` are scoped to the signed-in manager's team. Proposal, party decision, approval, start, and return are persisted in PostgreSQL.

Loan extension and permanent conversion remain unimplemented. The active rules contain no extension limit, extension approval workflow, conversion price or valuation date, or conversion rights/lineup semantics. Those terms must be specified before either operation can safely mutate ownership.
