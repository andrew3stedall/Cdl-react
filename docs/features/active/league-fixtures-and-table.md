# Feature: League Fixtures and Table

## Purpose

Plan the modern replacement for the legacy League screen, including Castle Draft League fixtures, next fixtures, standings, knockout data, head-to-head views, and fixture detail interactions.

## Status

PostgreSQL fixture/result/scoring reads, persisted league-table snapshots,
knockout records, and head-to-head records are implemented for the primary
league API and are discoverable through the League route views. EPL scoring
context, full parity, and complete season edge cases remain pending.

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
