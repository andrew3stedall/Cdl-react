# Team Selection and Chip Management

## Purpose

Issue #6 adds the lineup and chip controls that now live in the canonical Squad workspace. The old Team Selection route remains an alias for compatibility; it does not render a second panel.

## Source of Truth

- Feature document: `docs/features/active/team-selection-and-chip-management.md`
- Issue: #6
- Coordination:
  - Auth/session protected shell routes.
  - Shared player and team contracts from Squad Management.
  - League fixture summaries from League Fixtures.
  - Rule deep links from the rules knowledge base.

## API

### Load team selection

```http
GET /api/team-selection
```

Returns manager team, gameweek, lineup rows, chips, and validation messages.

The gameweek includes `deadline_at` when the schedule source provides it. The UI uses this value for the next-deadline date and countdown.

### Update lineup

```http
PUT /api/team-selection/lineup
Content-Type: application/json

{
  "players": [
    {
      "player_id": "player-1",
      "slot": "starter",
      "slot_order": 1,
      "is_captain": false,
      "is_vice_captain": false
    }
  ]
}
```

The request must include every selectable player. Server validation enforces starter, bench, reserve, captain, and vice-captain constraints.

### Toggle chip

```http
PUT /api/team-selection/chips/{chip_id}
Content-Type: application/json

{
  "active": true
}
```

Only one unused chip can be active at a time. Used chips cannot be activated.

### Fixture summary

```http
GET /api/team-selection/fixtures-summary
```

Returns CDL fixtures, EPL fixtures, CDL table summary, and EPL table summary.

## Validation Rules

- `lineup-validation`: lineup must include the expected starters, bench, reserves, and selectable players.
- `captaincy`: lineup must include exactly one captain and one vice-captain.
- `chip-usage`: only one unused chip can be active at a time; used chips cannot be reactivated.

## UI Behaviour

`/squad`, `/team-selection`, and `/squad-management` resolve to the same Squad workspace and include:

- An icon-only pitch/list switch at the top right.
- A compact next-deadline date and countdown.
- Inline chip icon buttons: available, active, and used states are visually distinct; active chips carry a dot.
- Starter pitch-style lineup panel.
- Split Starting XI, Bench, and Reserves list tables.
- Accessible select controls for player movement.
- Save-lineup validation feedback.
- Fixture/table presentation is deferred to the fixtures slice; the API contract remains available.

## Data Access

The implementation uses the configured team-selection repository behind service boundaries. The in-memory repository supplies a deterministic deadline for development; PostgreSQL mode reads the next cached FPL deadline when available and falls back to the repository default.

## Validation

Expected validation commands:

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
```

The active feature document remains in `docs/features/active/` until validation passes.
