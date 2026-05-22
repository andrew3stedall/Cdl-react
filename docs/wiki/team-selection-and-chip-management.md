# Team Selection and Chip Management

## Purpose

Issue #6 adds the modern Team Selection route for lineup editing, chip lifecycle management, bench and reserves, fixture summaries, and validation feedback.

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

`/team-selection` renders inside the shared application shell and includes:

- Chip selector cards with state indicators.
- Starter pitch-style lineup panel.
- Bench and reserves panels.
- Accessible select controls for player movement.
- Save-lineup validation feedback.
- Fixture and table summary cards.
- Links to `/rules#chip-usage` and `/rules#lineup-validation`.

## Data Access

The implementation uses an in-memory repository behind service boundaries. Persistent lineup and chip storage remain future migration work.

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
