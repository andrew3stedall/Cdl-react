# Knockout Brackets and Tiebreakers

## Purpose

Define knockout brackets, legs, aggregate scoring, playoff structure, and most-goals tiebreaker.

## Status

Historical knockout persistence exists. Once every real regular-season fixture through GW35 is finalised, the repository stores deterministic 1v4/2v3 semi-final seeds and the bottom-two final in the existing knockout payload table. Missing scheduled legs are materialized as real pending CDL fixtures; existing fixtures attach by team pairing, round label, and gameweek. Settled legs use frozen fixture results and scoring-lineup-goal snapshots only. The top-four final and third-place playoff are stored only after both semi-final winners are decided. Aggregate ties use scoring-lineup goals; if both remain level the tie stays unresolved with no winner or progression. The 5th/6th bracket and a second-level rule for aggregate-and-goals ties remain unresolved and are explicitly surfaced.

## Business Rules

- Knockout phase runs GW36-GW38 by default.
- Top 4 have two-leg semi-finals, then final and 3rd/4th playoff.
- Bottom 2 have a bye in GW36, then a two-leg final.
- The top-four final and third-place playoff are single-match ties; the documented semi-finals and bottom-two final use two legs.
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
- Persist known seeds and winner progression only after the official GW35 regular-season cutoff is complete.

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
