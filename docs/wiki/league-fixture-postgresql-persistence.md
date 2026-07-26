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

Its fixture/result parity matrix covers a pending fixture with no score, a
started home win, a completed away win, and a completed draw. These cases are
read back through the same PostgreSQL repository and league API contract used
by the release runtime.

The league table endpoint reads the newest persisted
`league_table_snapshots` payload in PostgreSQL mode. An absent snapshot raises a
repository error rather than silently recalculating from fixtures. Memory mode
retains service-calculated standings for local previews.

The knockout endpoint reads `knockout_matches` and resolves each persisted
fixture link through the PostgreSQL fixture repository. Missing knockout rows or
broken fixture links raise an explicit repository error instead of deriving the
bracket from fixture labels. Memory mode retains fixture-derived knockout
context for local previews.

The head-to-head endpoint reads `head_to_head_records` in PostgreSQL mode.
Missing rows raise an explicit repository error instead of recalculating
matchups from fixture results. Memory mode retains fixture-derived matchup
records for local previews.

Started fixture scores now resolve their persisted `epl_fixture_ids` from
`fixture_scoring_snapshots` through `epl_fixtures`. The fixture API returns that
typed EPL provenance alongside the score. A broken persisted link raises an
explicit repository error instead of silently dropping scoring context.

The PostgreSQL workflow starts from migrated tables, loads the synthetic fixture
table, knockout, and head-to-head contracts, creates a fresh repository
instance, and verifies:

- current fixture separation;
- pending, started home-win, completed away-win, and completed draw parity;
- started fixture detail and persisted score context;
- pending fixture detail rejection;
- persisted standings with an explicit snapshot source; and
- persisted knockout rounds and fixture linkage; and
- persisted head-to-head scores and team identities; and
- EPL scoring provenance linked to the started CDL fixture; and
- rows in all seven runtime read tables.

All EPL rows in this proof are explicitly marked synthetic. They exercise the
versioned runtime contract without claiming to represent real FPL history.
