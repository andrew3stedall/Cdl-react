# Feature: Squad Management, Scouting, and Transfers

## Purpose

Plan the modern replacement for the legacy Squad Management screen, including player scouting, squad overview, interests, proposed trades, and transfer workflows.

## Legacy Inventory

- `index.html` is the authenticated Squad Management page.
- The page contains scouting filters for global, position, draft team, EPL team, player search, and metric.
- The page contains side panels for Trades/Interests and Scouting.
- `assets/js/main.js` loads `getInitialSquadData.php` and consumes current gameweek, draft teams, EPL teams, current players, interest players, and trades.

## Current Behaviour

Managers view squad totals, inspect players, filter scouting lists, register interests, review interest players, and manage proposed trades.

## Business Rules

- Squads have player count constraints.
- Players can be filtered by team, position, search text, and metric.
- Interest and trade lists are tied to current gameweek and manager state.
- Trade and transfer rules must align with the rules feature document.

## Risks

- Transfer logic may be distributed across JavaScript, PHP endpoints, and database state.
- Interest and trade workflows may have hidden commissioner approval states.
- Player metrics must be validated against existing calculations.

## Target Architecture

- React route for squad management.
- shadcn/ui cards, tabs, sheets, tables, command search, badges, dialogs, and forms.
- Python service classes for squad, scouting, interest, and trade workflows.
- Pydantic models for players, filters, interests, trades, squad summaries, and validation errors.
- Repository classes for squads, players, teams, interests, trades, and gameweeks.

## API Requirements

- `GET /api/squad/summary`
- `GET /api/scouting/players`
- `POST /api/interests`
- `DELETE /api/interests/{interest_id}`
- `GET /api/trades`
- `POST /api/trades`
- `PUT /api/trades/{trade_id}`

## React Requirements

- Squad summary panel.
- Player scouting table and filter controls.
- Interest management flow.
- Proposed trades panel.
- Shared player detail dialog.
- Loading, empty, error, and success states.

## UI Requirements

- Use shadcn/ui for filters, sheets, tables, cards, dialogs, and actions.
- Visual presets must support dense data-table mode and standard card mode.
- Player status, ownership, chip, and transfer states must use documented badge variants.

## Data Access Requirements

- Queries must be isolated behind repositories.
- Filter parameters must be explicit and parameterized.
- Service classes must own transfer and trade validation.

## Acceptance Criteria

- Managers can view squad state and player totals.
- Managers can search and filter available players.
- Managers can create and remove interests.
- Managers can view and manage proposed trades.
- All business validation errors are returned through typed API responses.

## Test Requirements

- Unit tests for squad, interest, and trade services.
- Integration tests for scouting filters and trade API flows.
- React tests for filtering, interest creation, and trade actions.
- Characterisation tests against known legacy responses before rewriting.

## Documentation Requirements

- Wiki page documenting squad rules, API syntax, examples, and migration notes.

## Changelog Requirements

- Add implementation changelog entry when built.
