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
