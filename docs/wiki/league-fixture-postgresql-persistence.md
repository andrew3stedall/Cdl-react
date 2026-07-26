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

## Runtime status

`CDL_REPOSITORY_MODE=postgres` now builds `PostgreSQLLeagueRepository` through
the repository factory. The primary league endpoints read fixture identity from
`cdl_fixtures`, score/outcome state from `fixture_results`, and bonus/chip
context from `fixture_scoring_snapshots`.

The deterministic seed is explicitly marked synthetic in stored payloads and is
idempotent. It exists to exercise the release path before real historical
exports are available; it is not evidence of real CDL history.

The PostgreSQL workflow starts from migrated tables, loads the synthetic fixture
contract, creates a fresh repository instance, and verifies:

- current fixture separation;
- started fixture detail and persisted score context;
- pending fixture detail rejection;
- calculated standings; and
- rows in all three runtime read tables.

League table snapshots, knockout matches, and head-to-head records are migrated
but are not yet the runtime source. Those are the next #67 increment.
