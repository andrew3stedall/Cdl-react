# Feature: Legacy Migration Feature Index

## Purpose

Maintain the authoritative migration index that maps legacy Castle Draft League screens, JavaScript modules, PHP endpoints, data dependencies, and behavioural risks to active modern feature documents.

This feature is intentionally planning-focused. It does not move implementation feature documents to completed; it keeps the migration map current while the legacy application is still being re-reviewed.

## Status

Active migration index. Major reviewed legacy screens are mapped to active feature documents; unresolved endpoint, database, dashboard, and FDR re-review work remains pending.

## Source of Truth

- Issue: #11
- Agent workflow: Agent 10 - Migration Index
- Feature document: `docs/features/active/legacy-migration-feature-index.md`
- Coordination document: `docs/features/active/parallel-development-coordination.md`

## Current Migration Coverage Status

| Area | Legacy source | Active feature document | Modern route/API coverage | Status | Migration risk |
| --- | --- | --- | --- | --- | --- |
| Authentication and session | `index.php`, login form handlers, PHP session state | `docs/features/active/authentication-and-session-management.md` | `/api/login`, `/api/session`, `/api/logout`, protected shell guard | Implemented foundation | Production user/session persistence remains pending. |
| Application shell and navigation | Static page links, Skel panels, template-era layout, shared CSS | `docs/features/active/application-shell-navigation-and-presets.md` | Shared React shell, route-aware navigation, visual presets, preference API | Implemented foundation | Legacy responsive edge cases still need browser comparison during migration. |
| Squad management, scouting, interests, transfers | `index.html`, squad tables, scouting controls, transfer/trade UI scripts | `docs/features/active/squad-management-scouting-and-transfers.md` | `/squad-management`, `/api/squad`, `/api/scouting`, `/api/interests`, `/api/trades` | Implemented foundation | Persistent squad, interest, and trade storage still pending. |
| Team selection and chips | `myTeam.html`, lineup controls, bench/reserve state, chip controls | `docs/features/active/team-selection-and-chip-management.md` | `/team-selection`, `/api/team-selection`, lineup and chip endpoints | Implemented foundation | Persistent lineup/chip storage and full legacy rule parity still pending. |
| League fixtures and table | `fixtures.html`, fixture tables, result/detail widgets | `docs/features/active/league-fixtures-and-table.md` | `/league`, `/api/league/*` | Implemented foundation | Legacy fixture/result storage and complete season edge cases still pending. |
| Rules knowledge base | `rules.html`, rule copy, static anchors | `docs/features/active/rules-knowledge-base.md` | `/rules`, `/api/rules/*` | Implemented foundation | Rule admin editing and full historic rule versioning still pending. |
| Analytics dashboard | `dashboard.html`, D3 charts, dashboard JavaScript, SQL-backed responses | `docs/features/active/analytics-dashboard.md` | `/dashboard`, `/api/dashboard/config`, widget query/drilldown endpoints, filter and catalog endpoints | Implemented foundation | Sample-backed dashboard definitions and legacy aggregate query migration remain pending. |
| Fixture difficulty ratings | `FDR.html`, FDR grid, colour scale scripts, difficulty data responses | `docs/features/active/fixture-difficulty-ratings.md` | `/fdr`, `/api/fdr`, `/api/fdr/attack`, `/api/fdr/defence`, `/api/fdr/scales` | Implemented foundation | Sample-backed FDR ratings remain pending migration to legacy calculations or stable views. |
| Backend API and data platform | PHP endpoints, SQL-backed responses, shared database views | `docs/features/active/backend-api-data-platform.md` | FastAPI service/repository foundations | Partially implemented | Persistent repositories and legacy schema migration remain pending. |

## Reviewed Legacy Entry Points

Reviewed legacy entry points currently tracked by this index:

- `index.php` for unauthenticated login and PHP session establishment.
- `index.html` for squad management, scouting, interests, transfer/trade actions, and shared player detail behaviour.
- `myTeam.html` for lineup selection, captaincy, bench/reserves, and chip state.
- `fixtures.html` for league fixtures, results, standings, fixture detail, knockout context, and head-to-head context.
- `rules.html` for league rules, rule copy, and rule anchors.
- `dashboard.html` for analytics dashboards and D3-driven visualisations.
- `FDR.html` for fixture difficulty ratings and colour-scale grid behaviour.
- `assets/js/` modules using jQuery, D3, Skel panels, browser-local state, PHP endpoint calls, and DOM-driven validation.
- PHP endpoint families for authentication, squads, scouting, team selection, league fixtures, rules, dashboard metrics, FDR data, preferences, and persistence.

## Feature Document Coverage Matrix

| Feature document | Legacy behaviours that must remain mapped | Required validation coverage |
| --- | --- | --- |
| `docs/features/active/authentication-and-session-management.md` | Login, logout, session lookup, protected-route gating, anonymous session state. | Service tests, API tests, frontend protected-route tests, shell blocking tests. |
| `docs/features/active/application-shell-navigation-and-presets.md` | Shared navigation, responsive drawer/panel behaviour, active route state, visual density/presets. | Navigation unit tests, shell integration tests, preset persistence tests, unauthenticated blocking tests. |
| `docs/features/active/squad-management-scouting-and-transfers.md` | Current squad, player detail, scouting filters, interests, proposed trades, validation rule links. | Backend service/API tests, frontend interaction tests, rule deep-link tests, shell/session tests. |
| `docs/features/active/team-selection-and-chip-management.md` | Starters, bench, reserves, captaincy, chip lifecycle, fixture/table summaries, server validation. | Backend service/API tests, frontend lineup/chip tests, invalid lineup tests, shell/session tests. |
| `docs/features/active/league-fixtures-and-table.md` | Current/next fixtures, fixture detail, standings, knockout context, head-to-head context. | Backend service/API tests, route rendering tests, fixture status edge-case tests. |
| `docs/features/active/rules-knowledge-base.md` | Static rules copy, stable anchors, categories, search, cross-feature rule references. | Contract tests, API tests, search tests, deep-link tests, authenticated/unauthenticated route tests. |
| `docs/features/active/analytics-dashboard.md` | Dashboard chart metrics, D3 rendering, metric filters, historical comparisons, widget query and drilldown response shapes. | Service tests, API integration tests, frontend dashboard interaction tests, accessibility tests, visual regression-ready DOM tests. |
| `docs/features/active/fixture-difficulty-ratings.md` | FDR grid, attack/defence difficulty scoring, colour bands, fixture horizon, filtering, team/opponent context. | Difficulty service tests, API tests, colour-band tests, responsive grid tests, empty-state tests. |
| `docs/features/active/backend-api-data-platform.md` | PHP endpoints, repository boundaries, shared contracts, persistence, legacy SQL/view migration. | Contract tests, repository tests, API integration tests, data migration fixtures, backward-compatible response tests. |

## Latest Re-Review Updates

- Dashboard legacy behaviours are now mapped to implemented `/dashboard` UI and `/api/dashboard/*` contracts, while SQL-backed metric persistence remains a backend data-platform gap.
- FDR legacy behaviours are now mapped to implemented `/fdr` UI and `/api/fdr*` contracts, while production calculation ownership and stable database views remain migration gaps.
- No newly reviewed legacy module currently requires a new active feature document beyond the existing missing-feature candidates below.

## Missing Feature Document Assessment

No missing feature document is currently identified for the major reviewed legacy screens. The following behaviours remain under active re-review and must create new active feature documents if they expand beyond the current mapped feature boundaries:

| Discovery candidate | Current mapped document | Decision rule |
| --- | --- | --- |
| Commissioner-only administration screens or endpoints | `docs/features/active/backend-api-data-platform.md` until concrete UI workflows are confirmed | Create `docs/features/active/commissioner-administration.md` if separate admin UI workflows are discovered. |
| Notification, email, or reminder flows | `docs/features/active/backend-api-data-platform.md` until confirmed | Create a dedicated notifications feature if legacy code contains user-facing notification state. |
| Import/export, backups, or manual data repair tools | `docs/features/active/backend-api-data-platform.md` until confirmed | Create a migration/admin feature if tooling is user-facing or operationally required. |
| Additional visual reports outside `dashboard.html` and `FDR.html` | `docs/features/active/analytics-dashboard.md` until confirmed | Create a separate report feature if report interactions, data contracts, or routes are distinct. |

## Coordination Requirements

- Coordinate missing backend endpoint discoveries with Agent 03 / backend API data platform work.
- Coordinate missing UI behaviours with the affected feature owner before changing implementation scope.
- Add newly discovered legacy modules to this index and either map them to an active feature document or create a new `docs/features/active/` document.
- Keep implemented feature documents in `docs/features/active/` until release validation and legacy migration coverage are complete.
- Do not move this feature document to completed while unresolved legacy endpoint, database, dashboard, or FDR re-review work remains.

## Migration Risk Register

| Risk | Affected feature documents | Required follow-up |
| --- | --- | --- |
| Legacy PHP endpoints may return undocumented shapes. | Backend API data platform, Squad, Team Selection, League, Dashboard, FDR | Capture endpoint fixtures before replacing PHP/data access. |
| D3 dashboard/FDR visualisations may encode business logic in JavaScript. | Analytics Dashboard, Fixture Difficulty Ratings | Re-review JavaScript transforms and promote calculations into tested services. |
| Static rule copy may conflict with runtime validation. | Rules Knowledge Base, Squad, Team Selection, League | Cross-link validation errors to stable rule IDs and add tests for rule references. |
| Browser-local state may affect legacy UI flows. | Shell, Squad, Team Selection, Dashboard, FDR | Identify local/session storage keys and model persistence intentionally. |
| Database views may combine business rules and presentation logic. | Backend API data platform plus all data-consuming features | Add repository fixtures and migration notes before persistent storage work. |
| Sample-backed dashboard and FDR repositories may diverge from production legacy calculations. | Analytics Dashboard, Fixture Difficulty Ratings, Backend API data platform | Capture legacy fixtures, query examples, and calculation notes before persistent storage replacement. |

## Acceptance Criteria

- Every major reviewed legacy screen is mapped to an active feature document.
- Each active feature document has explicit validation/test requirements for mapped legacy behaviours.
- Newly discovered legacy behaviours are either mapped to an active feature or recorded as a feature-document gap.
- Migration risks are visible for affected workflows.
- Changelog and release notes record significant planning/index updates.
- This document remains active until legacy migration coverage is complete.

## Test Requirements

- Add automated documentation tests that verify the index contains the reviewed legacy entry points.
- Add automated documentation tests that verify every major active feature document path is listed in the coverage matrix.
- Add automated documentation tests that verify dashboard and FDR are no longer marked as unimplemented in this index.
- Add automated documentation tests that verify unmapped discovery candidates and migration risks are tracked.
- Continue running standard backend and frontend CI because documentation index changes can still affect release and project checks.

## Documentation Requirements

- Update `docs/wiki/legacy-migration-feature-index.md` whenever this active index changes materially.
- Update affected feature documents when a legacy behaviour changes implementation scope.
- Keep this document as the source of truth for migration coverage until the legacy repository review is complete.

## Changelog Requirements

Record this planning pass and any significant mapping changes in `CHANGELOG.md`.
