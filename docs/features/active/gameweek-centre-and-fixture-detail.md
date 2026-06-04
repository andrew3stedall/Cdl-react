# Gameweek Centre and Fixture Detail

## Purpose

Define the main competition hub for current gameweek, fixture detail breakdowns, next deadline visibility, and regular/knockout navigation.

## Status

Checkpoint 4 complete.

## Business Rules

- Gameweek Centre is the main competition hub.
- It must show next FPL deadline and editable gameweek context.
- Fixture detail must explain score totals, player scores, substitutions, chips, bonus points, and FPL source freshness.
- Chip impact should show points delta, wasted status, fixture outcome impact, and league-points impact.
- Tables should be switchable between live/provisional/official.
- Regular season supports this round fixtures, round table, and head-to-head totals across repeated rounds.
- Knockout view uses bracket/flowchart presentation.

## Target Architecture

```text
gameweek_centre_view
fixture_detail_view
live_table_view
knockout_bracket_view
fixture_score_snapshots
fixture_player_scores
chip_score_impacts
lineup_substitutions
```

## API Requirements

- Get current gameweek centre.
- Get this round fixtures.
- Get fixture detail.
- Get manager-vs-manager history.
- Get round table/head-to-head totals.
- Get source freshness metadata.

## React Requirements

- Current gameweek dashboard.
- Next deadline card.
- My fixture summary.
- This round fixtures filter.
- Fixture detail scoring breakdown.
- Live/provisional/official table toggle.
- Knockout flowchart embedding where relevant.

## Data Access Requirements

- Backend read models handle permissions and business rules.
- Frontend renders explanations; it does not calculate official scores.

## Acceptance Criteria

- A manager can understand current fixture score and why it changed.
- The page prevents confusion about which gameweek is editable.
- Regular and knockout views are navigable from same hub.
