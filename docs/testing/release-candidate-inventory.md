# Release-candidate route and evidence inventory

This inventory describes repository-backed release evidence after PR #108. It is deliberately stricter than a feature list: a route is not considered release-ready merely because a router, screen, or table exists.

## Status definitions

- **Proven**: PostgreSQL/runtime wiring and focused automated evidence exist for the stated behaviour.
- **Partial**: the route is implemented, but one or more release states or persistence paths lack focused evidence.
- **Preview only**: behaviour is intentionally memory-backed or synthetic and must not be treated as staging evidence.
- **Externally blocked**: safe repository work is complete, but validation requires unavailable exports, product acceptance, or the separately owned GCP sequence.

## Primary route inventory

| Area | API/router boundary | Runtime status | Browser/state evidence | Genuine remaining gap |
| --- | --- | --- | --- | --- |
| Authentication and session | `auth_router` | **Partial.** Session/login behaviour exists, but staging-mode removal of all development shortcuts is not yet proven against a deployed identity boundary. | Login, invalid credentials, expiry, recovery, logout and unauthenticated protected-route journeys are covered by the browser suite. | Prove staging identity behaviour without development shortcuts. |
| League overview and history | `league_router`, `history_router`, `competition_router` | **Proven for deterministic PostgreSQL data.** Fixture, result, scoring, table, knockout, head-to-head, squad and history persistence paths have clean-database evidence. | Primary league navigation and representative responsive states are covered. | Real historical-export compatibility and product acceptance remain unavailable. |
| Dashboard | `dashboard_router` | **Partial.** Definitions, metric catalog, filters, dimensions and aggregate snapshots are PostgreSQL-backed. Missing persisted data fails explicitly. | Dashboard navigation, filters, drill-down interaction, empty states, responsive layout and accessibility are exercised. | Drill-down returns an explicit empty result in PostgreSQL mode until a persisted fact contract exists; loading/recovery coverage should be made route-specific. |
| Fixture difficulty ratings | `fdr_router` | **Proven for deterministic PostgreSQL data.** Season-scoped ratings, versioned calculation inputs, digest validation, calculation ownership, idempotency and conflicts are covered. | FDR filtering, page rendering and responsive/accessibility behaviour are exercised. | Real source inputs and product acceptance are unavailable. |
| Squad management, transfers and trades | `squad_router`, `movement_router` | **Partial.** Squad-interest list/create/delete routes now require an authenticated manager session. Interest reads and writes use PostgreSQL in PostgreSQL mode, and duplicate interests are rejected before mutation. Trade routes remain outside this focused authorization slice. | A focused mobile and desktop journey proves API-backed creation, reload from server state, duplicate validation, and explicit unauthorized feedback without changing the displayed persisted state. The browser uses a deterministic API test double; PostgreSQL persistence is proved separately by backend CI. | Extend the same authenticated ownership and rejected-write evidence to one release-critical trade mutation; live browser-to-PostgreSQL and staging identity remain separate gates. |
| Team selection | `team_selection_router`, `modernisation_weekly_router` | **Proven for the deterministic browser contract.** Selection loading, lineup validation, lineup persistence, chip mutation, fixture locks and session boundaries have focused automated evidence. | The browser suite proves invalid-lineup feedback, a valid lineup save, lineup and wildcard state surviving reload, and explicit locked-action feedback without a persisted mutation at both mobile and desktop widths. | Live PostgreSQL browser integration and staging identity remain separate gates; captaincy-specific mutation coverage is not isolated as its own journey. |
| Rules and preferences | `rules_router`, `preferences_router` | **Partial.** Routes are mounted and API-tested, but release-critical persistence and error-state expectations are not separately documented. | Representative settings/rules screens are covered where reachable. | Confirm whether these are release-critical; add persistence/error tests only where they affect primary workflows. |
| Modernisation endpoints | `modernisation_router` and the mounted `competition_router`, `history_router`, `movement_router`, and `modernisation_weekly_router` checkpoint boundaries | **Preview only unless consumed by a primary workflow.** Several modules remain excluded from normal Ruff enforcement and should not be treated as release evidence by router presence alone. | Checkpoint tests exist. | Identify which endpoints are still product-facing, then either promote them to supported contracts or remove them from the release-candidate surface. |
| Historical import | service/repository adapters under `historical-import/v1` | **Proven with deterministic synthetic data.** Dry run, canonical digests, mappings, conflicts, archival, review items, idempotent replay, transactional projections and rollback are covered. | Backend integration only; no operator UI is claimed. | Validate a real export adapter when exports become available. |
| Health and static frontend | `/health`, mounted frontend | **Partial.** Process health and static serving exist. | Frontend build and browser loading are covered. | Database readiness, migration-state readiness and persisted-workflow smoke checks belong to the separate staging task. |

## Workflow evidence inventory

| Workflow | Current evidence | Boundary |
| --- | --- | --- |
| `CI` | Ruff lint, Ruff format, backend tests, frontend lint, frontend tests and frontend build. | Does not prove PostgreSQL or browser behaviour by itself. |
| `Backend PostgreSQL` | Applies all Alembic migrations to a clean PostgreSQL service and runs focused release paths for league, dashboard, FDR, authenticated squad interests and historical import. | Local CI database evidence, not live staging evidence. |
| `App Screenshots` | Builds the frontend, runs primary browser interactions plus the focused authenticated squad-interest journey, responsive/accessibility checks, captures screenshots and uploads artifacts. | Uses a deterministic API test double for browser state. It proves frontend request/rejection behaviour, while PostgreSQL persistence is proved separately by backend CI; it is not live staging acceptance. |
| GCP staging workflows | Owned by PR #107 and issues #70/#78. | Excluded from this product inventory iteration. No plan, apply or live verification is claimed here. |

## Reproducible local commands

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
```

For clean PostgreSQL evidence, use the same `CDL_DATABASE_URL` contract as `.github/workflows/backend-postgres.yml`, run `uv run alembic upgrade head`, then execute the workflow's focused PostgreSQL tests. Browser evidence should use the commands and deterministic test server defined by the App Screenshots workflow rather than an ad hoc manual server.

## Release-candidate entry criteria

A candidate can enter product testing when:

1. CI, Backend PostgreSQL and App Screenshots are green on the same commit.
2. No primary route silently falls back from PostgreSQL mode to sample or memory data.
3. Test data is deterministic and explicitly synthetic.
4. Known unsupported states return explicit empty, validation, authorization or error responses.
5. The tester guide identifies the supported workflows and the known limitations above.

## Exit criteria for repository-safe testing

Repository-safe testing is complete when focused evidence covers authentication, league navigation, dashboard/FDR, squad mutations, team selection, validation failures, fixture locks and persistence across reloads at desktop and mobile widths. Live staging, real-export compatibility and final product/design acceptance remain separate gates and must not be inferred from synthetic CI evidence.

## Highest-priority product gaps

1. Authenticated trade-mutation persistence and rejected-write evidence equivalent to the squad-interest path.
2. Staging-mode authentication/session proof without development shortcuts.
3. Route-specific loading, error, authorization and recovery coverage.
4. A concise tester guide tied to deterministic accounts/data and the supported workflow matrix.
5. Real historical-export validation when source files become available.
