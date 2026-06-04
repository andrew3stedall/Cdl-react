# Knockout Brackets and Tiebreakers

## Purpose

Define knockout brackets, legs, aggregate scoring, playoff structure, and most-goals tiebreaker.

## Status

Checkpoint 4 complete.

## Business Rules

- Knockout phase runs GW36-GW38 by default.
- Top 4 have two-leg semi-finals, then final and 3rd/4th playoff.
- Bottom 2 have a bye in GW36, then a two-leg final.
- 5th and 6th have similar playoff/final mechanics.
- Knockout ties can have multiple legs.
- Tiebreaker is most goals.
- Most goals counts goals scored by scoring lineup players only.
- Knockout view should be bracket/flowchart style.

## Target Architecture

```text
knockout_brackets
knockout_ties
knockout_legs
knockout_tie_scores
knockout_tie_breakers
cdl_fixtures
fixture_player_scores
```

## API Requirements

- Generate knockout brackets from final standings.
- Get bracket view.
- Get tie/leg detail.
- Calculate aggregate score.
- Calculate most-goals tiebreaker.
- Finalise tie winner.

## React Requirements

- Flowchart/bracket display.
- Leg cards with score/status.
- Aggregate score display.
- Tiebreaker explanation.
- Winner path display.

## Data Access Requirements

- Tie score calculation derives from leg fixture results.
- Tiebreaker derives from goals scored by scoring lineup players.
- Preserve tie/leg result history.

## Acceptance Criteria

- Two-leg ties aggregate correctly.
- Most-goals tiebreaker can be explained from stored player scores.
- Bracket view supports top/middle/bottom playoff paths.
