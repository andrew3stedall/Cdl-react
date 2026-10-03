# League Table and Table Movement

## Purpose

Define live/provisional/official table snapshots, table movement, colour states, and standings calculation.

## Status

Primary table reads now distinguish official finalised results from current live/provisional results through `/league/table?mode=official|live`; the default is official. Legacy snapshots are accepted only when explicitly keyed as fresh official snapshots for the latest completed gameweek. Stored bonus awards contribute to table points. Criteria for calculating automatic awards remain unresolved and must come from an approved league rule or authoritative legacy evidence.

## Business Rules

- League table is derived from fixture results, bonus awards, and configured scoring rules.
- Table points: 3 for win, 1 for draw, plus automatic bonus points.
- Live/provisional/official tables should be available through a view toggle. The API currently exposes official and live modes; a separate provisional mode awaits a stable source-state definition.
- Default table view depends on gameweek state.
- Position movement should be displayed with colour.
- Official table is based on finalised results only.

## Target Architecture

```text
league_table_snapshots
league_table_snapshot_rows
fixture_results
fixture_bonus_awards
```

Snapshot statuses:

```text
live
provisional
official
```

## API Requirements

- Calculate live table from current score snapshots.
- Calculate official table from final results.
- Get table snapshot for status/gameweek.
- Include movement from previous official table.

## React Requirements

- Table view toggle: Live, Provisional, Official.
- Colour-coded movement up/down/unchanged.
- Projected qualification/danger zone colour states.
- Table row drill-down.

## Data Access Requirements

- Store table snapshots and rows for reproducibility.
- Do not manually edit table rows as source of truth.
- Tie-break sorting should be configured and testable.

## Acceptance Criteria

- Live table can change during gameweek.
- Official table remains stable after finalisation.
- Position movement is visible and colour-coded.
