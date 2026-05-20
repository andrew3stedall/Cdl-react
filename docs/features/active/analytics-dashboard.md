# Feature: Analytics Dashboard

## Purpose

Plan the modern replacement for the legacy Dashboard screen, including metric widgets, filters, drill-downs, and chart/table visualisations.

## Legacy Inventory

- `dashboard.html` renders a Dashboard page with filter and widget containers.
- `assets/js/dashboard.js` defines dashboard filters and widget configuration in JavaScript.
- Widget configuration references fact and dimension fields, aggregations, sorting, axes, chart types, and display formats.
- The page uses D3, jQuery, Skel panels, and global CSS.

## Current Behaviour

Users view analytics widgets, filter by dimensions such as player, EPL team, home/away, gameweek, CDL team, and open data popups or drill-down popups.

## Business Rules

- Widgets are configured by fact metrics, dimensions, filters, aggregation, sorting, and display format.
- Filters may apply globally or per widget.
- Drill-down behaviour must preserve context from selected data points.

## Risks

- Current widget definitions expose database table and field names directly to frontend code.
- D3 rendering and query construction may be tightly coupled.
- Dashboard flexibility could become unsafe if frontend-driven query definitions are copied directly.

## Target Architecture

- React analytics dashboard route.
- Python `DashboardService`, `WidgetQueryService`, and `MetricCatalogService` classes.
- Pydantic models for dashboard config, widget definition, metric, dimension, filter, query request, and chart data response.
- Repository classes for metrics, dimensions, dashboard definitions, and aggregated fact queries.
- Controlled chart layer using React chart components, D3 primitives only where needed, or a typed chart abstraction.

## API Requirements

- `GET /api/dashboard/config`
- `POST /api/dashboard/widgets/{widget_id}/query`
- `GET /api/dashboard/filters`
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/dimensions`

## React Requirements

- Dashboard filter sidebar.
- Widget grid with responsive layout.
- Chart and table widgets.
- Drill-down dialog.
- Data popup or tooltip equivalent.
- Loading, empty, error, and partial data states.

## UI Requirements

- Use shadcn/ui cards, sheet, select, command, popover, dialog, tabs, and table components.
- Visual presets must define chart palette, density, card radius, and data-table spacing.
- Charts must be accessible through labels, legends, and fallback data tables where practical.

## Data Access Requirements

- Do not expose raw fact table names or SQL fields directly to arbitrary client requests.
- Use a server-side metric catalog and allowlist.
- Parameterize all query filters.
- Separate widget configuration from query execution.

## Acceptance Criteria

- Users can load a dashboard config and see widgets.
- Users can apply global and widget-level filters.
- Users can drill into supported widgets.
- Backend validates metrics, dimensions, filters, and aggregations through allowlisted models.

## Test Requirements

- Unit tests for metric catalog and widget query services.
- Integration tests for dashboard config and widget query endpoints.
- React tests for filters, widget rendering, and drill-down flows.
- Characterisation tests for representative legacy dashboard widgets.

## Documentation Requirements

- Wiki page for dashboard configuration syntax, allowed metrics, examples, and chart behaviour.

## Changelog Requirements

- Add implementation changelog entry when built.
