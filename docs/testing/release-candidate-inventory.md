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
| Dashboard | `dashboard_router` | **Partial.** Definitions, metric catalog, filters, dimensions and aggregate snapshots are PostgreSQL-backed. Missing persisted data fails explicitly. | Dashboard navigation, filters, drill-down interaction, empty states, loading, explicit backend failure, retry recovery, filter preservation, responsive layout and accessibility are exercised at mobile and desktop widths. | Drill-down returns an explicit empty result in PostgreSQL mode until a persisted fact contract exists. Live browser-to-PostgreSQL and staging identity remain separate gates. |
| Fixture difficulty ratings | `fdr_router` | **Proven for deterministic PostgreSQL data.** Season-scoped ratings, versioned calculation inputs, digest validation, calculation ownership, idempotency and conflicts are covered. | FDR filtering, page rendering and responsive/accessibility behaviour are exercised. | Real source inputs and product acceptance are unavailable. |
| Official FPL data ingestion | `fpl_data_router` | **Partial.** Authenticated manager refresh and status endpoints persist official `bootstrap-static` and `fixtures` responses, raw payload hashes, fetch audit evidence, and normalized PostgreSQL cache rows. Invalid upstream payloads fail explicitly rather than falling back to synthetic data. | Focused API and repository tests cover authorization, timeout/shape failures, idempotent persistence, freshness and audit semantics. No browser/operator control is claimed yet. | Schedule or expose controlled refresh execution, ingest `event-live` and player summaries, wire current player metrics and freshness into product routes, and prove live staging execution. |
| Squad management, transfers and trades | `squad_router`, `movement_router` | **Proven for authenticated deterministic PostgreSQL mutations.** Interest and trade creation require an authenticated manager. Trade acceptance or rejection is restricted to the counterparty manager, cancellation is restricted to the proposer, missing trades cause no write, and stale repeated transitions fail without changing the accepted state. | Focused mobile and desktop journeys prove interest and trade creation, reload from server state, rejected duplicate or invalid requests, explicit unauthorized feedback, and unchanged displayed state after rejection. The browser uses a deterministic API test double; PostgreSQL persistence is proved separately by backend CI. | The current UI does not expose counterparty acceptance/rejection controls, so transition authorization has API/PostgreSQL evidence but no focused browser journey. Live browser-to-PostgreSQL and staging identity remain separate gates. |
| Team selection | `team_selection_router`, `modernisation_weekly_router` | **Proven for the deterministic browser contract.** Selection loading, formation-aware context-menu substitutions, numbered bench ordering, lineup persistence, chip mutation, fixture locks and session boundaries have focused automated evidence. | The browser suite proves that list view has no player movement dropdowns, only legal substitution candidates are shown, a numbered bench slot can be chosen, a valid lineup save survives reload, and lineup/chip/substitution controls are disabled when a fixture lock is active. The journey runs at both mobile and desktop widths. | Live PostgreSQL browser integration and staging identity remain separate gates; captaincy-specific mutation coverage is not isolated as its own journey. |
| Squad workspace composite reads | `workspace_router` | **Proven by backend contract tests and Squad page request assertions.** The initial workspace read combines Squad summary and attention data; scouting and temporary rights remain on-demand reads. | The focused frontend test verifies the initial Squad load uses the consolidated workspace and independent team-selection reads without fetching scouting, temporary rights, trades, or notifications separately. | Live staging latency and database-query reduction remain deployment validation gates. |
| Rules | `rules_router` | **Retained product route.** The rules knowledge base is read-only, returns explicit not-found errors, and does not require persistence. | The rules screen remains primary navigation. Existing API coverage exercises list, search and missing-rule behaviour. | Add a focused browser error-state journey only if rules become release-critical for tester acceptance. |
| Preferences | `preferences_router` | **Proven for authenticated API and PostgreSQL persistence.** Reads and writes derive the owner from the authenticated session, anonymous requests fail explicitly, and clean-database evidence proves per-user isolation and persistence across repository reconstruction. | No release-candidate browser journey is claimed because Preferences is not currently promoted in primary navigation. | Decide whether Preferences is product-facing; add a browser journey only if it is promoted into the supported release workflow. Live staging identity remains a separate gate. |
| Modernisation checkpoint endpoints | `modernisation_router` plus checkpoint boundaries in `competition_router`, `history_router`, `movement_router`, and `modernisation_weekly_router` | **Preview only.** The checkpoint screens describe fixture-backed engineering contracts and are not product workflows. They remain directly reachable for engineering reference but are removed from primary navigation and must not count as release evidence. | Checkpoint API/unit tests remain available as contract scaffolding. | Promote only endpoints consumed by supported product routes; otherwise keep them outside the release-candidate navigation surface. |
| Historical import | service/repository adapters under `historical-import/v1` | **Proven with deterministic synthetic data.** Dry run, canonical digests, mappings, conflicts, archival, review items, idempotent replay, transactional projections and rollback are covered. | Backend integration only; no operator UI is claimed. | Validate a real export adapter when exports become available. |
| Health and static frontend | `/health`, mounted frontend | **Partial.** Process health and static serving exist. | Frontend build and browser loading are covered. | Database readiness, migration-state readiness and persisted-workflow smoke checks belong to the separate staging task. |

## Release navigation decision

Primary navigation is limited to product-facing workflows: Desk, Squad, Market and League, with Rules and Fixture Difficulty available contextually. The five `/modernisation/checkpoint-*` screens are engineering previews, not release-candidate destinations. Their direct routes remain available for contract development, but navigation tests prevent them from being presented to testers as supported product features.

## Workflow evidence inventory

| Workflow | Current evidence | Boundary |
| --- | --- | --- |
| `CI` | Ruff lint, Ruff format, backend tests, frontend lint, frontend tests and frontend build. | Does not prove PostgreSQL or browser behaviour by itself. |
| `Backend PostgreSQL` | Applies all Alembic migrations to a clean PostgreSQL service and runs focused release paths for league, dashboard, FDR, authenticated squad interests and trades, authenticated per-user preferences, trade transition authorization/conflicts, and historical import. | Local CI database evidence, not live staging evidence. |
| `App Screenshots` | Builds the frontend, runs primary browser interactions plus focused squad mutation and dashboard recovery journeys, responsive/accessibility checks, captures screenshots and uploads artifacts. | Uses deterministic API test doubles for browser state. It proves frontend request, failure and recovery behaviour, while PostgreSQL persistence is proved separately by backend CI; it is not live staging acceptance. |
| GCP staging workflows | Owned by issue #111 with supporting issues #70/#78. | Excluded from this product inventory iteration. No plan, apply or live verification is claimed here. |

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
5. Testers use `docs/testing/release-candidate-tester-guide.md`, which identifies supported workflows, deterministic credentials/data, known limitations and evidence boundaries.

## Exit criteria for repository-safe testing

Repository-safe testing is complete when focused evidence covers authentication, league navigation, dashboard/FDR, squad mutations, team selection, validation failures, fixture locks and persistence across reloads at desktop and mobile widths. Live staging, real-export compatibility and final product/design acceptance remain separate gates and must not be inferred from synthetic CI evidence.

## Highest-priority product gaps

1. Complete official FPL live-gameweek and player-summary ingestion, then wire current metrics and freshness into product routes.
2. Decide whether counterparty trade transitions need a product UI; add browser evidence only if they are part of the release-candidate workflow.
3. Isolate captaincy-specific mutation and validation coverage only if it remains release-critical after product review.
4. Decide whether Preferences should enter primary navigation; add a browser journey only after that product decision.
5. Real historical-export validation when source files become available.
