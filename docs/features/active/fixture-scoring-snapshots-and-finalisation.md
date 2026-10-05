# Fixture Scoring Snapshots and Finalisation

## Purpose

Define live/provisional/final fixture scoring, player-level score storage, source traceability, and commissioner corrections.

## Status

Settlement stores immutable source hash/fetch time and per-player base points, multiplier, final points, inclusion, and scoring reason. Completed fixture detail reads those frozen values before current event-live cache data. Finalisation waits for a verified successful event refresh; a newer recorded event refresh failure keeps results provisional until retry. Legacy frozen snapshots without explanation rows retain their frozen totals, with a reduced legacy explanation.

## Business Rules

- Fixture schedule, score snapshots, and final results are separate.
- Live/provisional scores can change as FPL data changes.
- Final results freeze a selected score snapshot.
- Official history should not drift due to later FPL refetches.
- System finalises results only after FPL data is checked, a successful event-live source is verified, and CDL scoring completes.
- The scheduled official FPL refresh settles each pending CDL fixture from the checked
  `event-live` payload and stores its response hash with the frozen result.
- Final settlement applies automatic substitutions for zero-minute starters using
  playing bench players in bench order, subject to goalkeeper and formation rules.
- The frozen snapshot stores the applied substitutions so historical fixture detail
  remains explainable without recalculating the lineup.
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


## Verification — 6 October 2026

PR [#550](https://github.com/andrew3stedall/Cdl-react/pull/550) is merged as 65f254b. A finished and data-checked bootstrap event now requires a separately persisted event-live-final:<gameweek> source before official settlement. A failed final refresh records the per-event fetch failure, leaves the ordinary cached event payload non-authoritative, and records final_event_live_unverified on the provisional fixture result. A successful retry is idempotent and records the verified response hash and fetch timestamp.

Regression coverage is in [test_fpl_data_ingestion.py](../../../tests/test_fpl_data_ingestion.py) and [test_fpl_settlement.py](../../../tests/test_fpl_settlement.py). PostgreSQL release-path validation passed in [run 37369127085](https://github.com/andrew3stedall/Cdl-react/actions/runs/37369127085); the final CI/staging runs for the merged change were queued at record time.
