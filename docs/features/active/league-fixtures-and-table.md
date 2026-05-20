# Feature: League Fixtures and Table

## Purpose

Plan the modern replacement for the legacy League screen, including Castle Draft League fixtures, next fixtures, standings, knockout data, head-to-head views, and fixture detail interactions.

## Legacy Inventory

- `fixtures.html` renders League navigation, CDL table, gameweek fixtures, next fixtures, and all fixtures.
- `assets/js/fixtures.js` loads `getFixtureResultData.php` and consumes `fixtures_cdl`, `fixtures_cdl_next`, `table_cdl`, `table_cdl_round`, `all`, `knockout`, and `head_to_head` data.
- Rows can open fixture details when a fixture has started.

## Current Behaviour

Users view current and upcoming CDL fixtures, league table, all fixtures, knockout context, and head-to-head data.

## Business Rules

- Current fixtures and next fixtures are separated.
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

- Current gameweek fixture table.
- Upcoming fixture table.
- League standings.
- All fixtures browser.
- Fixture detail dialog or route.
- Knockout and head-to-head sections.

## UI Requirements

- Use shadcn/ui tables, cards, badges, dialogs, tabs, and filters.
- Visual presets must support compact league-table mode.
- Bonus point, chip, win, draw, started, and pending states must use documented badge variants.

## Data Access Requirements

- Table calculations should be explicit in service classes or documented database views.
- Fixture queries must be parameterized.
- API responses must avoid leaking raw SQL-derived implementation details.

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

## Documentation Requirements

- Wiki page for fixture model, table rules, API syntax, examples, and migration notes.

## Changelog Requirements

- Add implementation changelog entry when built.
