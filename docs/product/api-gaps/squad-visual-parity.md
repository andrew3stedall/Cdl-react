# Squad visual-parity API gaps

## Purpose

The Squad UI uses persistent APIs and the official FPL cache for data-backed interactions. This document records the remaining model-dependent work rather than masking it with synthetic values.

## Current real data used

The page currently uses existing authenticated endpoints for:

- `/api/squad/summary` — roster, ownership status, total points, form, value and manager/gameweek context;
- `/api/scouting/players` — comparison and trade target discovery;
- `/api/trades` — pending trade awareness;
- `/api/team-selection` — persisted lineup slots, captaincy and bench placement used for Pitch view.
- `/api/squad/changes` — active temporary rights and atomic add/remove submission;
- `/api/squad/notifications` — derived trade and availability alerts;
- `/api/fpl/players/{id}/history` — cached official FPL history and upcoming fixtures.

## Missing contracts shown as placeholders

### Player analytics

The current summary/scouting contract now supplies:

- expected goals (`xG`) and expected assists (`xA`);
- next opponent, home/away label, kickoff and FDR;
- player availability/injury state and chance of playing next round.

Still requiring a defined source or calculation:

- availability/return-date history;
- projection over an agreed horizon;
- positional scarcity;
- league demand / trade-interest signal.

### Squad summary analytics

Add support for:

- aggregate squad xG;
- aggregate squad xA;
- squad/league ranking for total points and other summary metrics if ranking remains useful after usability review.

The page does not show aggregate xG/xA cards until an aggregate contract exists. No values are fabricated.

### Draw rights and atomic squad changes

The current manager workflow reads active rights and submits the complete set of draw additions and squad releases atomically. Future work is to add a durable squad-action/audit projection and explicit right expiry notifications.

### Trade-value guidance

The generated design includes a simple trade-value guidance area. Do not produce `Favourable`, `Even`, `Unfavourable`, `Fair Value`, or equivalent ratings until an endpoint/model supplies the required evidence. The intended inputs are:

- projection;
- recent form;
- positional scarcity;
- league demand;
- relevant injury/availability context.

The current drawer shows real official-FPL value, points, form and selected-by evidence without pretending those inputs constitute a trade rating.

### Full player profile

The quick drawer now loads the cached official FPL history and upcoming fixture run. A complete profile contract still needs:

- fixture run;
- historical xG/xA and performance series;
- injury/availability history;
- projections;
- ownership/trade/draw context;
- positional comparisons.

### Advanced squad filters

The List view filters real loaded availability and next-fixture difficulty fields. More advanced projection/scarcity filters remain out of scope until those calculations exist.

### Notifications

The notification icon now reads derived pending-trade and reduced-availability alerts. Persistent read/unread state and the wider activity feed remain future work.

## Rule

When any of these endpoints are implemented, replace the corresponding placeholder; do not add synthetic production values merely to make the UI look populated.
