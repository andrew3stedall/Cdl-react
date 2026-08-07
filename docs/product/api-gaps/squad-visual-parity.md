# Squad visual-parity API gaps

## Purpose

The Squad UI deliberately renders placeholders rather than synthetic values when a generated-design element is not backed by a persistent manager API. This document is the implementation backlog for replacing those placeholders with real data.

## Current real data used

The page currently uses existing authenticated endpoints for:

- `/api/squad/summary` — roster, ownership status, total points, form, value and manager/gameweek context;
- `/api/scouting/players` — comparison and trade target discovery;
- `/api/trades` — pending trade awareness;
- `/api/team-selection` — persisted lineup slots, captaincy and bench placement used for Pitch view.

## Missing contracts shown as placeholders

### Player analytics

Add persistent fields or a dedicated player-analytics endpoint for:

- expected goals (`xG`);
- expected assists (`xA`);
- next opponent and home/away label;
- player availability/injury state;
- chance of playing next round;
- availability/return-date history;
- projection over an agreed horizon;
- positional scarcity;
- league demand / trade-interest signal.

The frontend already accepts optional `xg`, `xa`, `expected_goals`, `expected_assists`, `next_opponent`, `availability`, and `chance_of_playing_next_round` fields so a later contract can replace placeholders without another visual redesign.

### Squad summary analytics

Add support for:

- aggregate squad xG;
- aggregate squad xA;
- squad/league ranking for total points and other summary metrics if ranking remains useful after usability review.

Until available, the xG/xA summary cards display `—` with an `API needed` label. No values are fabricated.

### Draw rights and atomic squad changes

The persistent manager workflow still needs:

- draw-won temporary player rights for the current manager;
- expiry/state for those rights;
- an atomic mutation that applies the complete set of draw additions and squad releases together;
- validation errors suitable for the confirmation sheet.

Until this exists, **Available to Add** displays an API placeholder and removals remain staged client-side only.

### Trade-value guidance

The generated design includes a simple trade-value guidance area. Do not produce `Favourable`, `Even`, `Unfavourable`, `Fair Value`, or equivalent ratings until an endpoint/model supplies the required evidence. The intended inputs are:

- projection;
- recent form;
- positional scarcity;
- league demand;
- relevant injury/availability context.

The current drawer therefore labels this area `API needed` and only shows real form/points evidence.

### Full player profile

The quick drawer can open the profile presentation, but a complete profile contract still needs:

- fixture run;
- historical xG/xA and performance series;
- injury/availability history;
- projections;
- ownership/trade/draw context;
- positional comparisons.

### Advanced squad filters

The List view exposes an advanced-filter control for visual parity. Availability and fixture-aware filters remain placeholders until those fields are available in the Squad analytics contract.

### Notifications

The generated visual target includes a notification icon. It is currently presentation-only. A future notification/action-centre contract should determine unread state and actionable items before this becomes interactive.

## Rule

When any of these endpoints are implemented, replace the corresponding placeholder; do not add synthetic production values merely to make the UI look populated.
