# Feature: Fixture Difficulty Ratings

## Purpose

Plan the modern replacement for the legacy FDR screen, including attack and defence fixture difficulty views, filters, colour scales, and responsive tables.

## Status

Implemented foundation. Persistent FDR data source, rating-calculation parity, and full responsive table coverage remain pending.

## Legacy Inventory

- `FDR.html` renders the Fixture Difficulty Ratings page with filters and widgets containers.
- `assets/js/fdr.js` loads `getFdrData.php`, groups data by team and event, and renders attack and defence FDR tables using D3.
- Legacy code defines inline colour scales for difficulty text and cell fill colours.

## Current Behaviour

Users view team-by-gameweek fixture difficulty ratings for attack and defence contexts.

## Business Rules

- FDR data is grouped by team and gameweek event.
- Attack and defence views must remain separate.
- Difficulty ratings drive colour and text contrast.
- Fixture abbreviations and gameweek numbers must remain readable in dense tables.

## Risks

- Colour scales are currently hard-coded in JavaScript.
- FDR calculation source is not visible from sampled files.
- Dense table layout may be difficult on mobile.

## Target Architecture

- React FDR route with attack and defence sections.
- Python `FixtureDifficultyService` class for FDR retrieval and calculation rules.
- Pydantic models for FDR row, fixture cell, team grouping, and rating scale.
- Repository classes for FDR data, fixtures, teams, and gameweeks.

## API Requirements

- `GET /api/fdr`
- `GET /api/fdr/attack`
- `GET /api/fdr/defence`
- Optional `GET /api/fdr/scales` for configurable rating palettes.

## React Requirements

- Attack FDR table.
- Defence FDR table.
- Filter drawer or panel.
- Sticky team column.
- Responsive mobile view for dense data.
- Legend for rating colours.

## UI Requirements

- Use shadcn/ui cards, table, tabs, sheet, select, badge, and tooltip components.
- Visual presets must define FDR colour palettes with accessible contrast.
- Difficulty colour scales must be theme-token driven rather than hard-coded in component logic.

## Data Access Requirements

- FDR calculations must be documented and owned by backend services or stable database views.
- API responses must include rating values and display metadata separately.
- Queries must be parameterized by season, gameweek range, team, and view type where applicable.

## Acceptance Criteria

- Users can view attack and defence FDR tables.
- Users can understand rating values through a legend.
- Colour output meets accessibility expectations.
- FDR data can be filtered without direct SQL exposure.

## Test Requirements

- Unit tests for FDR service and rating scale mapping.
- Integration tests for FDR endpoints.
- React tests for table rendering, filter behaviour, and legend display.
- Visual preset tests for accessible contrast assumptions.

## Documentation Requirements

- Wiki page for FDR calculation, API syntax, rating scale examples, and theme preset integration.

## Changelog Requirements

- Add implementation changelog entry when built.
