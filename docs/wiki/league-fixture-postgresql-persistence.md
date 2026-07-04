# League fixture PostgreSQL persistence

Issue #67 adds the PostgreSQL schema foundation for CDL fixtures, EPL fixtures, scoring results, scoring snapshots, league table snapshots, knockout matches, and head-to-head records.

## Scope

- `cdl_fixtures` stores Castle Draft League fixture identity, teams, gameweek, status, round, and current/next markers.
- `epl_fixtures` stores source Premier League fixture context for scoring and fixture-lock workflows.
- `fixture_results` stores completed fixture scores and outcomes.
- `fixture_scoring_snapshots` stores per-team scoring totals, bonus points, chip context, and calculation timestamps.
- `league_table_snapshots` stores gameweek-level table outputs.
- `knockout_matches` stores knockout bracket fixture links and winners.
- `head_to_head_records` stores persisted matchup summaries.

Migration `0006_league_fixture_scoring_persistence` follows `0005_team_selection_persistence`.
