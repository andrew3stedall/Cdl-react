# Feature: League Fixtures and Table

## Purpose

Plan the modern replacement for the legacy League screen, including Castle Draft League fixtures, next fixtures, standings, knockout data, head-to-head views, and fixture detail interactions.

## Status

PostgreSQL fixture/result/scoring reads, persisted league-table snapshots,
knockout records, and head-to-head records are implemented for the primary
league API. EPL scoring context, full parity, and complete season edge cases
remain pending.

## Legacy Inventory

- `fixtures.html` renders League navigation, CDL table, gameweek fixtures, next fixtures, and all fixtures.
- `assets/js/fixtures.js` loads `getFixtureResultData.php` and consumes `fixtures_cdl`, `fixtures_cdl_next`, `table_cdl`, `table_cdl_round`, `all`, `knockout`, and `head_to_head` data.
- Rows can open fixture details when a fixture has started.

## Current Behaviour

Users enter a single League workspace. The header provides a Fixtures/Table
toggle and notifications; fixture rows are grouped by current and upcoming
gameweek instead of being split across a contextual navigation menu.

## Business Rules

- Current fixtures appear first, followed by upcoming gameweeks.
- Fixture rows are compact and open a state-aware drawer.
- Started fixtures can expose detail views.
- Bonus points, chips, win, draw, and fixture ownership states affect display.
- Knockout and table-round data must be preserved.

## Risks

- Fixture result and table calculations may live inside PHP or SQL.
- Head-to-head and knockout structures need schema confirmation.
- Legacy display uses D3-generated tables and class-driven styling.

## Target Architecture

- React league route with fixtures, standings, knockout, and detail panels.
- Python `FixtureService`, `LeagueTableService`, and `HeadToHeadService` classes.
- Pydantic models for fixtures, teams, table rows, knockout rounds, and detail responses.
- Repository classes for fixtures, results, teams, table snapshots, and gameweeks.

## API Requirements

- `GET /api/league/fixtures/current`
- `GET /api/league/fixtures/next`
- `GET /api/league/fixtures`
- `GET /api/league/fixtures/{fixture_id}`
- `GET /api/league/table`
- `GET /api/league/knockout`
- `GET /api/league/head-to-head`

## React Requirements

- Current and upcoming gameweek fixture sections.
- Upcoming squad preview, live fixture detail, and finished fixture detail.
- League standings.
- Fixture detail drawer.

## UI Requirements

- Use shadcn/ui tables, cards, badges, dialogs, tabs, and filters.
- Visual presets must support compact league-table mode.
- Bonus point, chip, win, draw, started, and pending states must use documented badge variants.

## Data Access Requirements

- Table calculations should be explicit in service classes or documented database views.
- Fixture queries must be parameterized.
- API responses must avoid leaking raw SQL-derived implementation details.
- `CDL_REPOSITORY_MODE=postgres` must read fixture identity, result, and scoring
  payloads from migration `0006` tables without falling back to the in-memory
  repository.
- PostgreSQL standings must come from `league_table_snapshots`; a missing
  snapshot is an explicit release-path error, not a fixture-calculation fallback.
- PostgreSQL knockout context must come from `knockout_matches`; missing rows or
  broken fixture links are explicit release-path errors.
- PostgreSQL matchup context must come from `head_to_head_records`; missing rows
  are an explicit release-path error.

## Acceptance Criteria

- Users can view current, next, and all CDL fixtures.
- Users can view league standings.
- Users can open fixture details for started fixtures.
- Knockout and head-to-head data are accessible where available.

## Test Requirements

- Unit tests for fixture and table services.
- Integration tests for fixture and table endpoints.
- React tests for fixture list rendering and detail interactions.
- Characterisation tests for legacy `getFixtureResultData.php` response shape.
- A clean migrated PostgreSQL test for started and pending fixture behaviour.
- A clean migrated PostgreSQL test proving the standings response identifies its
  persisted snapshot source.
- A clean migrated PostgreSQL test proving knockout rounds and fixture linkage.
- A clean migrated PostgreSQL test proving head-to-head scores and team identity.

## Documentation Requirements

- Wiki page for fixture model, table rules, API syntax, examples, and migration notes.

## Changelog Requirements

- Add implementation changelog entry when built.
