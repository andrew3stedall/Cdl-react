# 2026-08-09 — Unified Squad lineup controls

## Decision

The canonical Squad workspace now owns the current gameweek lineup and chip controls. `/team-selection` and `/squad-management` remain compatibility aliases to the same page; no second player panel is rendered.

## Squad workspace

- Added the next deadline date and a compact countdown above the players.
- Replaced the full-width pitch/list text switch with icon-only controls in the hero.
- Removed the duplicated metrics strip and repeated team acronyms from player rows.
- Added inline chip icon buttons with clear available, active, and used states; active chips show a dot.
- Split list view into Starting XI, Bench, and Reserves tables with movement controls and no horizontal scrolling.
- Added lineup save validation and fixture-lock enforcement to the shared Squad page.

## Data and validation

- Gameweek contracts now carry an optional `deadline_at` value.
- In-memory development data supplies a deterministic deadline; PostgreSQL mode reads the next cached FPL deadline when available.
- Browser and React journeys now cover the unified aliases, list/pitch toggle, lineup moves, save validation, chip state, reload persistence, and locked controls.

## Scope

Fixture and league-table presentation remains a follow-up slice. The existing fixture-summary API contract is retained without duplicating that panel into Squad.
