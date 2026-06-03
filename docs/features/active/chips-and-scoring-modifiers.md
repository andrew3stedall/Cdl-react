# Chips and Scoring Modifiers

## Purpose

Define chip ownership, activation, locking, scoring effects, and explainable chip impact.

## Status

Checkpoint 2 complete.

## Business Rules

- One chip per team per gameweek.
- Chip locks at FPL deadline with lineup.
- Triple Captain: captain scores 3x instead of 2x.
- Dual Captain: captain and vice captain both score 2x.
- Auto Captain: highest scorer from scoring lineup gets captain multiplier.
- Bench Boost: bench players score; reserves excluded.
- Best XI: uses best 11 from starters plus bench, ignoring position constraints; reserves excluded.
- Chip impact should show whether the chip was wasted, points delta, fixture outcome impact, and league-points impact.

## Target Architecture

```text
chip_types
season_team_chips
chip_activations
chip_score_impacts
fixture_player_scores
```

## API Requirements

- List available/used chips.
- Activate chip for lineup before deadline.
- Cancel active chip before deadline.
- Lock chip at deadline.
- Calculate chip impact during scoring.
- Return chip explanation in fixture detail.

## React Requirements

- Chip selector on team selection page.
- Chip state display.
- Fixture detail impact explanation.
- Wasted/not wasted indicator.

## Data Access Requirements

- Store chip activation tied to lineup and gameweek.
- Store scoring impact with base score, modified score, delta, and outcome effect.

## Acceptance Criteria

- More than one chip cannot be active in one gameweek.
- Reserves are excluded from Bench Boost and Best XI.
- Fixture detail can explain exact chip impact.