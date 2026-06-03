# Fixture Scoring Snapshots and Finalisation

## Purpose

Define live/provisional/final fixture scoring, player-level score storage, source traceability, and commissioner corrections.

## Status

Checkpoint 2 complete.

## Business Rules

- Fixture schedule, score snapshots, and final results are separate.
- Live/provisional scores can change as FPL data changes.
- Final results freeze a selected score snapshot.
- Official history should not drift due to later FPL refetches.
- System finalises results when FPL data is checked and CDL scoring completes.
- Commissioner can override with audited correction.
- Bonus points are automatic.

## Target Architecture

```text
cdl_fixtures
fixture_score_snapshots
fixture_player_scores
fixture_bonus_awards
fixture_results
fixture_result_corrections
chip_score_impacts
lineup_substitutions
```

## API Requirements

- Calculate fixture score snapshot.
- Get fixture detail with player scores.
- Recalculate from latest FPL data.
- Finalise result.
- Apply commissioner correction.
- Get scoring audit trail.

## React Requirements

- Fixture detail score breakdown.
- Live/provisional/final status display.
- Player-level point explanation.
- Commissioner controls for refresh, recalc, finalise, correct.

## Data Access Requirements

- Store FPL source fetch log/hash on score snapshot.
- Store base FPL points and final CDL points per player.
- Store scoring version.
- Corrections append records, not silent overwrite.

## Acceptance Criteria

- A final fixture result can be explained without refetching FPL.
- Recalculation before finalisation creates new snapshot when source changes.
- Commissioner correction preserves previous and corrected values.