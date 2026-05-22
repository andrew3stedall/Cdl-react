# Squad Management, Scouting, and Transfers

## Purpose

Issue #5 adds an authenticated squad management workspace for squad summary, player scouting, interests, proposed trades, and shared player detail.

## Source of Truth

- Feature document: `docs/features/active/squad-management-scouting-and-transfers.md`
- Issue: #5
- Coordination:
  - Authentication/session from issue #2.
  - Application shell/navigation/presets from issue #3.
  - Backend service/repository boundaries from issue #4.
  - Rule deep links from the rules knowledge base.
  - League route work from issue #7 is preserved in `App.tsx`.

## API

### Squad summary

```http
GET /api/squad/summary
```

### Scouting

```http
GET /api/scouting/players?q=casey&position=MID&metric=form
```

Supported filters:

- `q`
- `position`: `GKP`, `DEF`, `MID`, `FWD`
- `draft_team_id`
- `epl_team_id`
- `metric`: `total_points`, `form`, `value`

### Interests

```http
POST /api/interests
Content-Type: application/json

{
  "player_id": "player-3",
  "note": "Scout"
}
```

```http
DELETE /api/interests/{interest_id}
```

### Trades

```http
GET /api/trades
```

```http
POST /api/trades
Content-Type: application/json

{
  "offered_to_team_id": "team-rival",
  "offered_player_ids": ["player-1"],
  "requested_player_ids": ["player-4"]
}
```

```http
PUT /api/trades/{trade_id}
Content-Type: application/json

{
  "status": "accepted"
}
```

## Validation Rules

- Interest validation errors for players already in the manager squad reference `squad-size`.
- Trade proposals include `/rules#trade-window` so the UI can deep-link validation context.

## UI

`/squad-management` renders inside the shared application shell and includes:

- Squad summary cards.
- Dense current squad and scouting tables.
- Scouting search.
- Interest creation.
- Proposed trade action and rule link.
- Shared player detail dialog.
- Compact visual preset compatibility via `data-density`.

## Data Access

The current implementation uses in-memory repositories behind explicit service and repository boundaries. Persistent data access remains a later migration task.

## Validation

Expected validation commands:

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
```

The active feature document remains in `docs/features/active/` until CI validation passes.
