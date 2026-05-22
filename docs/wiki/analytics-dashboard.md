# Analytics Dashboard

## Purpose

Issue #9 adds the modern analytics dashboard surface for configured widgets, global filters, allowlisted metrics and dimensions, chart/table rendering, and drill-down detail.

## Source of Truth

- Feature document: `docs/features/active/analytics-dashboard.md`
- Issue: #9
- Coordination:
  - Authenticated application shell routing.
  - Server-side metric and dimension catalog allowlists.
  - Shared gameweek, team, and player summary contracts.
  - Theme preset chart palette hooks and responsive card density.

## API

### Load dashboard configuration

```http
GET /api/dashboard/config
```

Returns dashboard metadata, current gameweek, widget definitions, filters, metrics, and dimensions.

### Query a widget

```http
POST /api/dashboard/widgets/{widget_id}/query
Content-Type: application/json

{
  "filters": [
    { "filter_id": "gameweek", "value": "Gameweek 12" },
    { "filter_id": "cdl_team", "value": "Castle FC" }
  ],
  "limit": 10
}
```

The backend validates filter, metric, and dimension identifiers against the server-side catalog before returning chart series and fallback table rows.

### Drill into a widget point

```http
POST /api/dashboard/widgets/{widget_id}/drilldown
Content-Type: application/json

{
  "point_key": "castle",
  "filters": [
    { "filter_id": "gameweek", "value": "Gameweek 12" }
  ]
}
```

Returns a table-shaped detail response that preserves selected filter context.

### Catalog endpoints

```http
GET /api/dashboard/filters
GET /api/dashboard/metrics
GET /api/dashboard/dimensions
```

These endpoints expose only allowlisted catalog definitions, not raw SQL table names or arbitrary field names.

## UI Behaviour

`/dashboard` renders inside the shared authenticated application shell and includes:

- Global filter controls.
- Responsive widget grid.
- Accessible chart bars with text labels and values.
- Fallback data tables for chart widgets.
- Table widgets.
- Drill-down dialog launched from supported chart points.
- Loading, error, empty, and validation states.

## Data Access

The implementation uses an in-memory dashboard repository behind service boundaries. Persistent dashboard definitions and fact aggregation remain future migration work. Client requests cannot directly select database tables or raw SQL fields.

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
