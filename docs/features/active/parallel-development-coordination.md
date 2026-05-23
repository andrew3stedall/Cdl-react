# Feature: Parallel Development Coordination

## Purpose

Coordinate parallel development across all active feature documents while preserving shared API contracts, session behaviour, shadcn/ui theme presets, and cross-feature integration testing.

## Status

Active coordination document. The initial Agent 01 through Agent 10 implementation foundations are in place, and this document now acts as the current shared-contract and cross-feature validation register until the active feature documents move through release completion.

## Release Target

Initial modern application planning release.

## Agent Workflow Assignments

Each feature must be developed through a separate agent workflow and tracked by a GitHub issue:

| Agent Workflow | Issue | Feature Document | Primary Scope | Current foundation status |
| --- | ---: | --- | --- | --- |
| Agent 01 - Authentication | #2 | `docs/features/active/authentication-and-session-management.md` | Login, session, logout, protected routes | Implemented foundation |
| Agent 02 - Application Shell | #3 | `docs/features/active/application-shell-navigation-and-presets.md` | App shell, navigation, visual presets | Implemented foundation |
| Agent 03 - Backend Platform | #4 | `docs/features/active/backend-api-data-platform.md` | Python API, Pydantic, repositories, shared contracts | Implemented foundation with persistence gaps |
| Agent 04 - Squad Management | #5 | `docs/features/active/squad-management-scouting-and-transfers.md` | Squad, scouting, interests, trades | Implemented foundation |
| Agent 05 - Team Selection | #6 | `docs/features/active/team-selection-and-chip-management.md` | Team lineup, chips, bench, reserves | Implemented foundation |
| Agent 06 - League Fixtures | #7 | `docs/features/active/league-fixtures-and-table.md` | Fixtures, tables, knockout, head-to-head | Implemented foundation |
| Agent 07 - Rules | #8 | `docs/features/active/rules-knowledge-base.md` | Structured rules, search, rule references | Implemented foundation |
| Agent 08 - Dashboard | #9 | `docs/features/active/analytics-dashboard.md` | Analytics widgets, filters, drill-downs | Implemented foundation |
| Agent 09 - FDR | #10 | `docs/features/active/fixture-difficulty-ratings.md` | Fixture difficulty ratings, scales, tables | Implemented foundation |
| Agent 10 - Migration Index | #11 | `docs/features/active/legacy-migration-feature-index.md` | Legacy coverage tracking and missing-feature discovery | Current index foundation |

## Shared Contract Ownership

Shared contract changes must be coordinated through Agent 03 - Backend Platform and reflected in affected feature documents before implementation proceeds.

Shared contracts include:

- Authentication and session models.
- API error response models.
- Route naming conventions.
- Pydantic request and response models.
- Repository interfaces.
- User preference and theme preset models.
- Shared React API client conventions.

## Current Shared Contract Register

| Contract area | Canonical owner | Current consumers | Coordination rule |
| --- | --- | --- | --- |
| Session model and protected-route behaviour | Agent 01 with Agent 02 integration | All protected React routes and authenticated API clients | Changes must update authentication, shell, and affected feature route tests together. |
| API error shape and Pydantic response conventions | Agent 03 | All backend routers and frontend clients | New domain errors must be represented through shared API tests or feature API tests. |
| Route names and navigation labels | Agent 02 | Squad, Team Selection, League, Rules, Dashboard, FDR | New routes must update shell navigation tests and route-specific shell tests. |
| User preference and theme preset models | Agent 02 with Agent 03 persistence boundary | Shell, Rules, Squad, Team Selection, League, Dashboard, FDR | Token or preset changes must preserve dense table, chart, and FDR colour tests. |
| Shared team, player, fixture, gameweek, metric, and rating models | Agent 03 with feature agents | Squad, Team Selection, League, Dashboard, FDR | Model changes must update every feature document and cross-feature compatibility test. |
| Legacy migration mapping and missing-feature discovery | Agent 10 | All active feature documents | Newly discovered legacy behaviours must map to an active feature or create a new active feature document before implementation. |

## Session Handling Coordination

Agent 01 owns the canonical session contract. All other agents must integrate with that contract for protected routes and authenticated API calls.

Minimum shared session model requirements:

- Authenticated user identity.
- Session validity state.
- Expiry or refresh metadata where applicable.
- Role or permission metadata if required later.
- Standard unauthenticated and forbidden API error responses.

## Theme Preset Coordination

Agent 02 owns the canonical theme preset model. Interface features must use the same preset contract.

Minimum shared theme requirements:

- Default preset name.
- Available preset list.
- Colour tokens.
- Density tokens.
- Radius tokens.
- Typography tokens.
- Chart palette tokens for dashboard and FDR features.

## Cross-Feature Test Matrix

| Feature | Required Cross-Feature Tests | Current coverage evidence |
| --- | --- | --- |
| Authentication | Protected shell route, authenticated API client, logout clears feature data | Auth service/API tests and shell protected-route tests. |
| Application Shell | Authenticated navigation, theme preset persistence, route access across all feature routes | Shell navigation, preference, and route integration tests. |
| Backend Platform | Contract tests for every domain API and shared error responses | Backend API tests across rules, league, squad, team selection, dashboard, and FDR. |
| Squad Management | Authenticated API calls, shell navigation, rules references, shared player models | Squad service/API/frontend tests with rule-link and shell-session coverage. |
| Team Selection | Authenticated API calls, league fixture summaries, rules references, shared player models | Team-selection service/API/frontend tests with fixture summary and validation coverage. |
| League Fixtures | Shell navigation, shared team models, fixture references used by team selection and FDR | League service/API tests and route integration tests. |
| Rules | Deep links from squad, team selection, trades, and chip validation errors | Rules API/search/deep-link tests plus feature validation-link tests. |
| Dashboard | Shared metric catalog, chart palette tokens, authenticated API calls | Dashboard service/API/frontend and shell-session tests. |
| FDR | Shared fixture/team models, chart palette tokens, dashboard compatibility | FDR service/API/frontend and shell-session tests. |
| Migration Index | Confirms newly discovered legacy modules produce or update active feature documents | Migration index documentation tests. |

## Release Documentation Coordination

Release documentation must capture implemented foundations and remaining gaps for every active feature before release completion. Current release coordination requirements:

- `docs/releases/v0.1.0.md` records implemented foundations and known persistence/migration gaps.
- `CHANGELOG.md` records each implementation and planning coordination pass.
- Feature documents remain active until validation and release completion are deliberately performed.
- Completed feature movement must be coordinated as one release-management pass rather than ad hoc movement by individual agents.

## Development Rules

- Do not implement from memory; implement only from the active feature document.
- Keep feature documents updated when implementation decisions change.
- One agent workflow owns one active feature at a time.
- Agents may work in parallel only when shared-contract dependencies are declared.
- Shared contract changes require updates to every affected active feature document.
- Feature completion requires unit tests, integration tests, cross-feature tests, lint, Ruff, build validation, wiki updates, changelog updates, and release documentation.

## Completion Checklist

- GitHub issue exists for each active feature workflow.
- Shared API/session/theme coordination issue exists.
- Cross-feature test matrix is referenced by each implementation workflow.
- Changelog records the planning kickoff and coordination refreshes.
- Documentation tests guard workflow assignment, shared contract ownership, cross-feature test matrix, and release documentation requirements.
