# Feature: Parallel Development Coordination

## Purpose

Coordinate parallel development across all active feature documents while preserving shared API contracts, session behaviour, shadcn/ui theme presets, and cross-feature integration testing.

## Status

Active coordination document.

## Release Target

Initial modern application planning release.

## Agent Workflow Assignments

Each feature must be developed through a separate agent workflow:

| Agent Workflow | Feature Document | Primary Scope |
| --- | --- | --- |
| Agent 01 - Authentication | `docs/features/active/authentication-and-session-management.md` | Login, session, logout, protected routes |
| Agent 02 - Application Shell | `docs/features/active/application-shell-navigation-and-presets.md` | App shell, navigation, visual presets |
| Agent 03 - Backend Platform | `docs/features/active/backend-api-data-platform.md` | Python API, Pydantic, repositories, shared contracts |
| Agent 04 - Squad Management | `docs/features/active/squad-management-scouting-and-transfers.md` | Squad, scouting, interests, trades |
| Agent 05 - Team Selection | `docs/features/active/team-selection-and-chip-management.md` | Team lineup, chips, bench, reserves |
| Agent 06 - League Fixtures | `docs/features/active/league-fixtures-and-table.md` | Fixtures, tables, knockout, head-to-head |
| Agent 07 - Rules | `docs/features/active/rules-knowledge-base.md` | Structured rules, search, rule references |
| Agent 08 - Dashboard | `docs/features/active/analytics-dashboard.md` | Analytics widgets, filters, drill-downs |
| Agent 09 - FDR | `docs/features/active/fixture-difficulty-ratings.md` | Fixture difficulty ratings, scales, tables |
| Agent 10 - Migration Index | `docs/features/active/legacy-migration-feature-index.md` | Legacy coverage tracking and missing-feature discovery |

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

| Feature | Required Cross-Feature Tests |
| --- | --- |
| Authentication | Protected shell route, authenticated API client, logout clears feature data |
| Application Shell | Authenticated navigation, theme preset persistence, route access across all feature routes |
| Backend Platform | Contract tests for every domain API and shared error responses |
| Squad Management | Authenticated API calls, shell navigation, rules references, shared player models |
| Team Selection | Authenticated API calls, league fixture summaries, rules references, shared player models |
| League Fixtures | Shell navigation, shared team models, fixture references used by team selection and FDR |
| Rules | Deep links from squad, team selection, trades, and chip validation errors |
| Dashboard | Shared metric catalog, chart palette tokens, authenticated API calls |
| FDR | Shared fixture/team models, chart palette tokens, dashboard compatibility |
| Migration Index | Confirms newly discovered legacy modules produce or update active feature documents |

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
- Changelog records the planning kickoff.
