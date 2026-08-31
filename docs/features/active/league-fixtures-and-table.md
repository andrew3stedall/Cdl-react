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

Fixture browsing uses nested carousels: rounds move horizontally without
wrapping from the final round back to the first, and each round component owns
its gameweek carousel, which moves vertically. Each
round, gameweek, and fixture is rendered by its own React component. A gameweek
slide contains its complete fixture list, so fixture rows do not introduce a
second nested scroll area. The selected gameweek index is shared while moving
between rounds, so the second gameweek in one seven-gameweek round opens the
second gameweek in the next round. Adjacent slides fade with an opacity
transition while the selected slide remains fully opaque. Round slides are
widened to keep adjacent rounds partly visible, and filled-or-hollow
navigation dots below the carousel show and select the active round.

Fixture squad review supports both pitch and list presentations through the
same compact pitch/list toggle treatment used on Squad. Pitch remains the
default presentation, while the selected fixture-review view is retained
locally between fixture openings. List view keeps both teams visible side by
side and groups each roster into Starting XI, Substitutes, and Reserves. Past
and started-player rows show gameweek points; future rows show form; current
players whose kick-off has not passed remain unscored.

Selecting a player from a current or previous gameweek opens that player's
scoring breakdown for the selected gameweek, including the existing fantasy
points and scoring-return detail. Only future gameweeks open the read-only full
player profile. The same interaction applies from pitch and list fixture views.

## Business Rules

- Current fixtures appear first, followed by upcoming gameweeks.
- Fixture rows are compact and open a state-aware drawer.
- Started fixtures can expose detail views.
- Fixture squad review can switch between pitch and two-column list views without changing player interaction behaviour.
- Player taps in current and past gameweeks open the selected gameweek's scoring breakdown, regardless of whether the CDL head-to-head fixture itself has started.
- Player taps in future gameweeks open the read-only player profile.
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
- Pitch/list toggle inside fixture squad review using the Squad toggle treatment.
- Two-column fixture list view with Starting XI, Substitutes, and Reserves for both teams.
- Current and past fixture player selections route to gameweek scoring detail; future fixture player selections route to a read-only player profile.
- League standings.
- Fixture detail drawer.
- Non-looping horizontal round carousel and non-looping vertical gameweek carousel.
- One active/inactive navigation dot per round below the round carousel.
- Each round slide contains its own vertical gameweek carousel and preserves
  the relative gameweek index when the horizontal round changes.
- Independent round, gameweek, and fixture components with a complete fixture
  list visible in the selected gameweek slide.

## UI Requirements

- Use shadcn/ui tables, cards, badges, dialogs, tabs, and filters.
- Visual presets must support compact league-table mode.
- Bonus point, chip, win, draw, started, and pending states must use documented badge variants.
- Fixture list rows must stay compact enough for both team columns to remain visible on mobile-width fixture drawers.

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
- Users can switch a fixture squad review between pitch and list views, with both teams remaining visible in list mode.
- Selecting a player from the current or any prior gameweek opens that gameweek's points breakdown rather than the full profile from either fixture view.
- Selecting a player from a future gameweek continues to open the read-only player profile from either fixture view.
- Knockout and head-to-head data are accessible where available.

## Test Requirements

- Unit tests for fixture and table services.
- Integration tests for fixture and table endpoints.
- React tests for fixture list rendering and detail interactions.
- React regression coverage for fixture pitch/list toggling, two-team list rendering, metric state, and list-row player interactions.
- React regression coverage for a current-gameweek CDL fixture that is still pending but must open player scoring detail.
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
