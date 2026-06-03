# Substitution Engine

## Purpose

Define ordinary bench substitution rules, valid formation constraints, and explanation records for scoring.

## Status

Checkpoint 2 complete.

## Business Rules

- Bench players score only through substitution rules unless Bench Boost or Best XI applies.
- Reserves are ignored for gameweek scoring.
- Substitutions trigger only when a starter plays 0 minutes.
- Bench order determines substitution priority.
- Substitution must preserve a valid formation.
- Valid formations come from league rules.
- Goalkeeper is not a special separate case.
- If a starter plays any minutes, they remain, even with negative score.
- Multiple substitutions are applied one by one in bench order.

## Target Architecture

```text
lineup_substitutions
fixture_player_scores
league_season_rule_versions
```

Substitution reasons:

```text
starter_did_not_play
bench_order
formation_constraint
commissioner_override
```

## API Requirements

- Calculate substitutions for lineup/gameweek.
- Return substitution explanation.
- Persist applied substitutions during score snapshot calculation.
- Support commissioner correction if required.

## React Requirements

- Fixture detail substitution explanation.
- Team selection guidance showing bench order.
- Visual indication when bench player entered scoring lineup.

## Data Access Requirements

- Store starter, substitute, bench order, reason, and formation validity.
- Keep substitution calculation tied to score snapshot/scoring version.

## Acceptance Criteria

- 0-minute starter can be replaced only by bench player that preserves formation.
- Negative-score player who played is not substituted.
- Reserve player never substitutes in.