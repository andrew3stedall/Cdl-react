# Feature: Team Selection and Chip Management

## Purpose

Plan the modern replacement for the legacy Team Selection screen, including lineup selection, chips, bench, reserves, CDL fixtures, EPL fixtures, and tables.

## Legacy Inventory

- `myTeam.html` renders Team Selection with sections for chips, team pitch, bench, reserves, Castle Draft League fixtures/table, and Premier League fixtures/table.
- `assets/js/myTeam.js` loads `getTeamSelectionData.php` and consumes fixtures, players, chips, CDL table, and EPL table.
- Chip state is toggled in JavaScript and drives active, used, and available display states.

## Current Behaviour

Managers view their selected team, bench, reserves, chips, league fixtures, and EPL fixtures. Chips can be toggled when available and not used.

## Business Rules

- Team selection depends on current gameweek state.
- Chips have active, used, and available states.
- Only one unused chip can be active at a time.
- Team, bench, and reserve constraints must be enforced server-side.

## Risks

- Formation and substitution rules may be hidden in JavaScript or backend responses.
- Chip rules need confirmation against league rules.
- Drag/drop or pitch-style placement may have implicit ordering behaviour.

## Target Architecture

- React team selection route with stateful lineup editor.
- Python `TeamSelectionService`, `ChipService`, and `FixtureSummaryService` classes.
- Pydantic models for lineup, player slot, chip state, fixture summary, and validation response.
- Repositories for players, squads, chips, fixtures, tables, and gameweeks.

## API Requirements

- `GET /api/team-selection`
- `PUT /api/team-selection/lineup`
- `PUT /api/team-selection/chips/{chip_id}`
- `GET /api/team-selection/fixtures-summary`

## React Requirements

- Team pitch or equivalent lineup layout.
- Bench and reserves panels.
- Chip selector with state indicators.
- CDL and EPL fixture/table panels.
- Validation messages for invalid lineup states.

## UI Requirements

- Use shadcn/ui cards, tabs, badges, buttons, dialogs, sheets, and tooltips.
- Visual presets must define pitch density, badge styles, and table density.
- Accessibility support is required for chip toggles and player movement.

## Data Access Requirements

- Persist lineup and chip changes through API calls.
- Validate changes in service classes before repository writes.
- Avoid client-only business rule enforcement.

## Acceptance Criteria

- Managers can view current team selection data.
- Managers can update lineup and chip selection through typed API calls.
- Invalid team or chip states are rejected with clear errors.
- Fixtures and tables are visible alongside team selection.

## Test Requirements

- Unit tests for lineup and chip validation services.
- Integration tests for team selection load and update flows.
- React tests for chip toggling, invalid state display, and lineup rendering.
- Characterisation tests for legacy `getTeamSelectionData.php` response shape.

## Documentation Requirements

- Wiki page for team selection rules, chip lifecycle, API syntax, and examples.

## Changelog Requirements

- Add implementation changelog entry when built.
