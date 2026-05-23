# Legacy Migration Feature Index

## Purpose

This page summarises the active legacy migration index used to map reviewed Castle Draft League legacy screens and behaviours to modern feature documents.

Source of truth: `docs/features/active/legacy-migration-feature-index.md`.

## Coverage Snapshot

| Legacy area | Active feature document | Modern coverage | Status |
| --- | --- | --- | --- |
| `index.php` login/session | `authentication-and-session-management.md` | Auth API and protected shell guard | Implemented foundation |
| Static shell/navigation/CSS | `application-shell-navigation-and-presets.md` | Shared shell, navigation, presets | Implemented foundation |
| `index.html` squad/scouting/transfers | `squad-management-scouting-and-transfers.md` | Squad route and squad/scouting/interests/trades APIs | Implemented foundation |
| `myTeam.html` lineup/chips | `team-selection-and-chip-management.md` | Team selection route and lineup/chip APIs | Implemented foundation |
| `fixtures.html` fixtures/table | `league-fixtures-and-table.md` | League route and fixture/table APIs | Implemented foundation |
| `rules.html` rules copy | `rules-knowledge-base.md` | Rules route and API | Implemented foundation |
| `dashboard.html` D3 dashboards | `analytics-dashboard.md` | Dashboard route, widget query/drilldown APIs, filters, metrics, and dimensions | Implemented foundation |
| `FDR.html` fixture difficulty | `fixture-difficulty-ratings.md` | FDR route, combined attack/defence APIs, view-specific APIs, and rating scales | Implemented foundation |
| PHP endpoints and SQL-backed responses | `backend-api-data-platform.md` | FastAPI contracts/services/repositories foundation | Partial foundation |

## Latest Re-Review Updates

- Dashboard and FDR are no longer tracked as unimplemented planning gaps; both now have modern route and API foundations.
- Dashboard remains sample-backed until legacy dashboard definitions and aggregate fact queries are migrated.
- FDR remains sample-backed until legacy FDR calculations or stable database views are migrated.
- No new major legacy module currently requires a new active feature document.

## Open Migration Gaps

No missing feature document is currently identified for the major reviewed screens. New documents should be created if re-review discovers independent commissioner administration, notification, import/export, or additional report workflows.

## Risk Register

- Legacy PHP endpoints may return undocumented shapes.
- D3 dashboard and FDR visualisations may encode business logic in JavaScript.
- Static rule copy may conflict with runtime validation.
- Browser-local state may affect legacy UI flows.
- Database views may combine business rules and presentation logic.
- Sample-backed dashboard and FDR repositories may diverge from production legacy calculations.

## Validation

The repository includes documentation tests that verify:

- Reviewed legacy entry points remain listed.
- Active feature documents remain mapped.
- Dashboard and FDR are no longer marked as unimplemented in the active migration index.
- Missing-feature candidates remain tracked.
- Migration risks remain visible.

## Maintenance Rules

- Keep the active feature document in `docs/features/active/` until migration coverage is complete.
- Add newly discovered legacy modules to the index before implementation scope changes.
- Update affected feature documents when legacy re-review changes their requirements.
- Coordinate backend endpoint discoveries with backend API/data platform work.
