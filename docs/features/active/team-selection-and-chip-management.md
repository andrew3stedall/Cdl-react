# Feature: Team Selection and Chip Management

## Purpose

Plan the modern replacement for the legacy Team Selection screen, with lineup selection and chip controls owned by the existing Squad workspace.

## Status

Implemented in the canonical Squad workspace. Fixture/table presentation is intentionally deferred to the fixtures slice; lineup and chip mutations use the existing API contracts.

## Legacy Inventory

- `myTeam.html` renders Team Selection with sections for chips, team pitch, bench, reserves, Castle Draft League fixtures/table, and Premier League fixtures/table.
- `assets/js/myTeam.js` loads `getTeamSelectionData.php` and consumes fixtures, players, chips, CDL table, and EPL table.
- Chip state is toggled in JavaScript and drives active, used, and available display states.

## Current Behaviour

Managers view their selected team, bench, reserves, next deadline, and compact chip controls in Squad. The pitch/list switch is icon-only, the list is split into Starting XI/Bench/Reserves tables, and players can be moved and saved without leaving Squad. Available chips are actionable, active chips show a dot, and used chips remain visibly unavailable. Fixtures and tables remain available through the API but are not duplicated into this workspace yet.

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

- Canonical `/squad` workspace with `/team-selection` and `/squad-management` compatibility aliases.
- Stateful lineup editor shared by the pitch and list views.
- Python `TeamSelectionService`, `ChipService`, and `FixtureSummaryService` classes.
- Pydantic models for lineup, player slot, chip state, fixture summary, and validation response.
- Repositories for players, squads, chips, fixtures, tables, and gameweeks.

## API Requirements

- `GET /api/team-selection`
- `PUT /api/team-selection/lineup`
- `PUT /api/team-selection/chips/{chip_id}`
- `GET /api/team-selection/fixtures-summary`

## React Requirements

- Team pitch and compact list layouts.
- Bench and reserves sections with movement controls.
- Icon-only chip toggles with available, active, and used states.
- Next deadline date and countdown context.
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
- Managers can see the next deadline and make lineup/chip changes from Squad.
- The old standalone team-selection panel is not rendered below Squad.
- Fixture/table rendering is tracked for the next fixtures slice rather than duplicated here.

## Test Requirements

- Unit tests for lineup and chip validation services.
- Integration tests for team selection load and update flows.
- React tests for chip toggling, invalid state display, and lineup rendering.
- Characterisation tests for legacy `getTeamSelectionData.php` response shape.

## Documentation Requirements

- Wiki page for team selection rules, chip lifecycle, API syntax, and examples.

## Changelog Requirements

- Add implementation changelog entry when built.
