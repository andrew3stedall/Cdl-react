# Changelog

## Unreleased

- Replaced the League fixtures and gameweek pickers with shadcn-style Embla
  carousels: rounds move horizontally without looping, gameweeks move vertically
  without looping, and each slide fades with opacity while keeping every fixture
  in the selected gameweek visible.
- Widened the round slides while tightening the spacing between them and added
  one filled-or-hollow navigation dot per round below the carousel.
- Added matching terminal insets so the first and last rounds centre on the
  same focal line when selected.
- Increased the round slide width again after adding terminal insets so the
  centred edge slides retain the intended wider card treatment.
- Tightened the horizontal space between round cards so more of the adjacent
  round remains visible at the viewport edge.
- Added a small slide overlap to bring adjacent round cards closer together
  without changing their width or terminal centering.
- Increased the slide overlap to 0.4rem per side for a more visible adjacent
  round peek.
- Smoothed the nested gameweek carousel with a longer settle duration, centred
  its slides so adjacent weeks peek above and below, and added horizontal
  per-round gameweek navigation dots.
- Corrected gameweek tweening to map each slide directly to its Embla snap and
  kept the selected navigation dot tied to the same in-round gameweek index.
- Stabilized nested gameweek initialization and scroll synchronization so the
  selected card, its transform, and its in-round navigation dot stay aligned.
- Kept the vertical Embla track at the viewport height so the first gameweek
  remains in view instead of being translated below the clipped carousel.
- Opened each round on its first gameweek so the initial card starts centered
  at full focus and can be scrolled forward through the round.
- Nested each round's gameweek carousel inside its round slide, preserved the
  relative gameweek index between rounds, and moved compact navigation controls
  onto the carousel rails.
- Split League fixture rendering into reusable round, gameweek, and fixture
  components without changing fixture drawer or scoring behaviour.
- Reworked League fixtures into five chronological seven-gameweek rounds with a
  horizontal carousel, a focused live/current gameweek, and compact in-round
  gameweek browsing for upcoming and past results.
- Added historical fixture squad detail from locked lineups and cached
  gameweek points, including starters, substitutes, reserves, and captain
  markers.
- Extracted reusable fixture pitch and roster parents, separated each Starting
  XI into its own contained pitch panel, equalised lineup spacing, enforced
  goalkeeper-first bench ordering, and removed opponent XI prediction UI.
- Corrected fixture pitch card containment by restoring the standard Squad
  player wrapper around each reusable `PlayerCard`.
- Reused the fixture pitch, substitute, and reserve structure for completed
  gameweeks, showing gameweek points with the Squad form-dot treatment and
  revealing current-gameweek points only after each player's fixture kickoff.
- Added a Tauri 2 Android shell and reproducible debug APK workflow around the existing React frontend.
- Kept the existing FastAPI/PostgreSQL Cloud Run service as the backend; staging APK builds open the deployed staging app to preserve same-origin cookie authentication.
- Match points-against labels to their attacking/defensive bar colours, keep them clear of the bars, and use the result-track colour for empty chart slots.
- Reworked the account page into a compact summary with navigable appearance, FDR colour, and attacking-orientation settings subpages.
- Added an opt-out device motion shortcut that opens Account after two deliberate forward-and-back shakes from any app page.
- Increased the shake shortcut sensitivity so moderate forward-and-back movements are sufficient.
- Hide device sign-in setup after a passkey is registered and remove manager role, account ID, and dedicated account-action content from the page.
- Added 30-day PostgreSQL-backed application sessions with secure persistent cookies.
- Added WebAuthn passkey registration and sign-in for device Face ID, fingerprint, or PIN unlock.
- Added configurable Sign in with Apple support while retaining the allowlisted Google flow.

## 2026-08-22 - Finish player profile drawer spacing

### Fixed

- Kept the player-profile action bar in the drawer layout so it cannot cover the final chart card.
- Made grouped opposition bars thinner, separated, and left/right aligned within each fixture group.
- Kept attacking and defensive value labels inside their matching bar colours with compact sizing.

## 2026-08-22 - Complete player profile chart details

### Fixed

- Reserved the full fixed action-bar clearance in the player profile drawer so the final content can be scrolled into view.
- Added official FPL yellow-card and red-card history icons to the form chart.
- Added attacking and defensive value labels to each opposition points-against bar and kept its vertical scale at a minimum of 0–80 points.

## 2026-08-14 - Consolidate the Squad workspace read path

### Changed

- Replaced the Squad page's six-request initial load with a combined Squad
  workspace read plus the independent team-selection read.
- Deferred scouting-player and available-rights requests until their UI
  surfaces are opened.
- Reused the PostgreSQL player snapshot during a request so summary and
  attention reads do not repeat the full player/fixture query.
- Added a structured proposed-trade count to the notifications response so
  the Squad page no longer fetches the full trade list just to render its
  attention banner.

### Validation

- Added API and browser regression coverage for the workspace contract,
  request reduction, and lazy secondary data loading.

## 2026-08-13 - Make the app installable on Android

- Added an Android-installable web app manifest with standalone display mode,
  theme metadata, relative paths for root and GitHub Pages deployments, and
  maskable app icons.
- Added a production-only service worker that caches the app shell while
  deliberately bypassing API routes so league data is not served from a stale
  cache.
- Added mobile viewport and dynamic-height handling for standalone app windows.

## 2026-08-10 - Refresh the League competition workspace

- Reworked the League route into an overview-first competition workspace with
  focused Fixtures, Table, Knockout, and Head-to-head views.
- Added responsive fixture cards, status filtering, started-fixture detail
  drawers, table-source messaging, and explicit loading/error/empty states.
- Kept legacy migration operations outside the manager-facing League surface;
  ambiguous history remains governed by archive-only migration rules.

## 2026-08-10 - Refresh Market discovery workspace

### Added

- Added the modern Market page at `/scouting` with focused Discovery, Interests and Trades views.
- Added contextual Market navigation for Interests and Trades while retaining Fixture Difficulty as a Market-context tool.
- Added official-data player evidence, availability and next-fixture context with responsive player rows and detail drawer actions.

### Changed

- Replaced the legacy combined scouting/squad presentation with an acquisition-focused Market workflow.
- Removed the page-local mobile navigation so the global shell remains the single navigation source.
- Updated screenshot and browser journey contracts to exercise Market discovery and Interest persistence.

### Deliberate gaps

- Watchlist bookmarks, ranked Interest reordering, advanced threshold filters and full Trade Builder actions remain separate follow-up work.

## 2026-08-09 - Correct player availability flags

### Fixed

- Interpreted the official FPL `a` status as available rather than as an issue on Managers Desk and Squad.
- Removed positive availability markers from fit players; only reduced chances, injuries, suspensions and other actionable statuses are marked.
- Centralised availability interpretation so the dashboard count, list filter, pitch markers and player drawer use the same contract.

### Changed

- Added restrained warning/critical availability markers with percentage and status details available on hover and in the player drawer.

### Validation

- Added regression coverage for raw FPL available statuses, 100%/unknown chances, reduced chances, doubtful players and severe statuses.

## 2026-08-09 - Complete Squad API wiring and official FPL shirt assets

### Added

- Added next-opponent, home/away, kickoff and FDR enrichment from the persisted official FPL fixture cache.
- Added canonical Squad changes and notifications endpoints, including atomic temporary-right add/remove submission.
- Added a typed Squad API client for summary, scouting, trades, changes, notifications and cached FPL player history.
- Added the official current FPL shirt artwork mapping for all 20 2026/27 clubs, with the existing local SVGs retained as fallbacks.
- Extended browser interaction fixtures to cover squad changes, notifications and player-history API calls.

### Changed

- Wired the canonical Squad profile drawer to official FPL history and upcoming fixtures.
- Wired Trade submission to `POST /api/trades` and validated the selected manager/team on the backend.
- Replaced silent API fallbacks and visible endpoint placeholders with explicit states and source-backed values.
- Added real availability and next-fixture filters to List view.

### Validation

- Added coverage for the official FPL asset URL used by the Squad surface and kept lineup/substitution regression coverage green.

## 2026-08-04 - Serve the staged snake draft through application APIs

### Fixed

- Replaced the Squad Management page's hard-coded player list with the PostgreSQL-backed squad
  summary and scouting API responses.
- Made PostgreSQL team selection read Exeter Gently's 20 active ownerships for the staged
  2026/27 season instead of the five-player in-memory demo roster.
- Scoped league and dashboard reads to the eight teams in the staged CDL season, hiding unrelated
  legacy synthetic fixtures, scores and dashboard points while no current results exist.
- Removed request-time repository seeding so ordinary API and session requests are read-only and
  cannot recreate demo data or open avoidable Cloud SQL connections.

### Validation

- Added regression coverage for the 20-player staged team-selection roster, active-team dashboard
  filters, empty pre-season standings and removal of the obsolete sample trade action.

## 2026-08-02 - Add allowlisted Google sign-in for staging

### Added

- Added an official Google Identity Services sign-in path that verifies Google ID tokens on the
  API and permits only the configured exact email allowlist.
- Reused the existing PostgreSQL user and session tables so Cloud Run instances share the same
  secure application session without storing Google access or refresh tokens.
- Added Terraform-managed Secret Manager containers for the OAuth client ID and email allowlist.
- Added a reviewed, plan-manifest-bound enable switch so Cloud Run does not reference those
  secrets until their first versions exist.

### Security

- Bound Google credentials to the exact configured OAuth client audience, required a
  Google-verified email, and required a same-origin custom request header.
- Kept the shared staging password only as a temporary fallback and left production identity,
  IAM and real-data access out of scope.

## 2026-08-02 - Add phone-browser staging access boundary

### Added

- Added a staging-only global session boundary for all non-authentication API routes and API
  schema routes while keeping the React login bootstrap and health check reachable.
- Added an explicit `application-login` runtime access model to the reviewed Terraform plan
  and apply workflows, including exact manifest, approval phrase, IAM, and live-policy checks.

### Security

- Limited the public-plan exception to `allUsers` with `roles/run.invoker` on the single
  Terraform-managed staging Cloud Run service; all other public IAM remains fail-closed.
- Switched the shared staging password check to constant-time comparison and documented that
  this synthetic-data review control is not a production identity system.
- Made staging startup fail closed when the known development login secret has not been
  replaced by the configured Secret Manager value.

### Validation

- Added API boundary, exact public-IAM exception, plan-manifest, and workflow contract tests.

## 2026-08-02 - Fix staging database job image verification

### Fixed

- Read the configured container image from the Cloud Run v1 job structure
  returned by `gcloud run jobs describe` instead of an empty v2-style path.
- Restricted execution to immutable digests from the expected staging project
  and `cdl-react-backend/cdl-react-app` repository.

### Validation

- Added regression coverage for the correct nested image field, expected
  repository boundary and rejection of the previous incorrect field path.
- Recorded migration workflow run `30738978829` as the fail-closed evidence;
  the migration was not executed and the staging database was unchanged.

## 2026-08-02 - Fix Cloud SQL credential role rotation

### Fixed

- Stopped requesting explicit restricted PostgreSQL attribute changes that the
  Cloud SQL managed administrator is not permitted to perform.
- Retained fail-closed catalog verification that `cdl_app` is not a superuser,
  database or role creator, replication role, row-security bypass role, or
  member of `cloudsqlsuperuser` before writing a Secret Manager version.

### Validation

- Added regression coverage ensuring the password rotation statement does not
  attempt prohibited attribute changes while all restricted flags remain
  explicitly verified.
- Recorded credential workflow run `30728564359` as the live failure evidence;
  it proved Cloud SQL connectivity but failed before creating a secret version.

## 2026-08-01 - Distinguish actionable from refresh-only Terraform drift

### Fixed

- Kept actionable remote-state drift fail-closed when Terraform proposes managed
  resource changes.
- Allowed provider refresh metadata to remain visible without failing a clean
  no-change plan when Terraform returns detailed exit code `0`.
- Added regression coverage reproducing the staging alert-policy failure from
  apply run `30723444536` and documented the review boundary.

## 2026-07-30 - Add controlled staging database credential bootstrap

### Added

- Added a manual, main-only workflow that creates or rotates the restricted
  `cdl_app` PostgreSQL credential and writes its Unix-socket SQLAlchemy URL
  directly to Secret Manager.
- Added a documented rotation procedure with exact confirmation, staging project
  checks, keyless authentication, Cloud SQL Auth Proxy connectivity, masked
  generated passwords and no secret artifacts or Terraform-state payloads.

### Security

- Explicitly removes `cloudsqlsuperuser` membership and database/role creation,
  replication and row-security bypass capabilities from `cdl_app`.
- Revokes default public database and schema-creation grants while retaining the
  schema creation access required by the current shared migration/runtime role.
- Rotates the temporary `postgres` bootstrap password to a new discarded value
  on every workflow exit path.

### Validation

- Added repository contract coverage for manual gating, the fixed staging
  boundary, restricted PostgreSQL role flags, direct Secret Manager streaming
  and absence of secret-bearing workflow inputs or artifacts.

## 2026-07-30 - Permit staging log-based alert creation

### Changed

- Granted the staging GitHub deploy identity Logs Configuration Writer so Terraform can create Cloud Logging notification rules for log-based alerts.
- Kept the permission staging-only; production deploy roles and the explicit Owner/Editor exclusion remain unchanged.

### Validation

- Extended the bootstrap role contract test to require `roles/logging.configWriter` within the staging module.
- Documented the permission boundary and the log-based alert dependency in the bootstrap runbook.
## 2026-07-27 - Prepare the single-service staging runtime

### Added

- Added a multi-stage container build that packages the React application and FastAPI API in one immutable image.
- Added FastAPI static asset and SPA fallback handling without masking unknown `/api` routes.
- Added Terraform support for PostgreSQL repository mode, Secret Manager environment references and secure staging cookies.
- Narrowed the runtime identity to the database URL and staging login secret containers it consumes.
- Added an ADR defining the one-URL Cloud Run architecture and its separately gated apply, migration, seed and public-access sequence.

### Validation

- Added focused API, frontend-serving, Dockerfile and Terraform contract tests.
- Kept Cloud Run disabled by default and made no GCP apply, secret version, database mutation, deployment or public-access change.

## 2026-07-27 - Add staging observability and cost attribution

### Added

- Added bounded Cloud SQL and conditional Cloud Run alert policies without creating notification recipients.
- Added shared application, environment, management and component labels to chargeable staging resources.
- Added an operator runbook covering alert response, cost-label verification and live-action gates.

### Validation

- Added Terraform contract tests for alert safety, notification boundaries and cost-attribution labels.
- Kept Terraform apply, public access, credentials, billing exports and production changes outside this repository-only step.

## 2026-07-27 - Prove PostgreSQL fixture result parity

### Added

- Expanded deterministic synthetic fixture seeding with completed away-win and draw outcomes.
- Added a four-case parity matrix for pending, started home-win, completed away-win, and completed draw states.

### Validation

- Verified the matrix through the PostgreSQL repository and the existing league fixtures API.
- Extended clean-database row-count assertions for seven persisted CDL fixtures, results, and scoring snapshots.

## 2026-07-27 - Persist EPL fixture scoring context

### Added

- Linked deterministic `epl_fixtures` rows from persisted CDL scoring snapshots.
- Exposed typed EPL fixture provenance through the existing league fixture score contract.
- Added an explicit repository error for broken persisted EPL scoring links.

### Validation

- Added idempotent SQLite coverage for EPL scoring context and broken-link rejection.
- Extended the clean migrated PostgreSQL API journey to verify synthetic EPL provenance and all seven #67 runtime tables.

## 2026-06-11 - Add core league and FPL cache schema

### Added

- Added issue #64 PostgreSQL schema for leagues, seasons, draft teams, managers, memberships, permissions, EPL teams, FPL positions, FPL players, values, availability, and cache freshness.
- Added append-only `0003_core_league_fpl_cache` migration after the #63 auth/session/preference migration.
- Added PostgreSQL metadata for the core league and FPL cache table set.
- Added wiki documentation for the #64 schema and handoff.

### Validation

- Added tests for the expected table set and migration dependency on `0002_auth_preferences`.

## 2026-06-10 - Persist auth sessions and user preferences

### Added

- Added issue #63 PostgreSQL persistence for users, sessions, and user preferences.
- Added an append-only `0002_auth_preferences` migration after the #61 baseline migration.
- Added PostgreSQL-backed auth/session and preference repositories.
- Wired `postgres` repository mode through the repository factory while preserving default `memory` mode.
- Added wiki documentation for auth/session/preference tables, repository modes, and the #64 handoff.

### Validation

- Added tests for PostgreSQL identity/session repositories and documentation coverage for the migration, factory handoff, and GCP gate.

## 2026-06-10 - Add backend database settings and repository factory

### Added

- Added issue #62 backend database settings for repository mode, database URL, pool size, max overflow, and environment naming.
- Added a repository factory and `RepositoryBundle` to centralise backend repository construction.
- Routed auth service construction through the repository factory while preserving current in-memory API behaviour.
- Added wiki documentation for repository modes, environment variables, and the #63 handoff.

### Validation

- Added tests for database settings, memory repository construction, guarded PostgreSQL mode, and documentation handoff coverage.

## 2026-06-07 - Add production persistence ADR

### Added

- Added the issue #60 production persistence architecture decision record.
- Confirmed Cloud SQL for PostgreSQL, Alembic-managed migrations, local/CI PostgreSQL, and a settings-driven repository factory as the first production persistence path.
- Documented deferred database alternatives and the dependency handoff to #61 and #62.
- Updated the production database/GCP wiki with the ADR path and the #78 GCP bootstrap gate.

### Validation

- Added documentation tests for the issue #60 feature document, production persistence ADR, deferred alternatives, wiki ADR link, and GCP gate.

## 2026-06-07 - Plan production backend database and GCP infrastructure

### Added

- Added a production database and GCP infrastructure planning feature document for issue #58.
- Selected Cloud SQL for PostgreSQL, Alembic migrations, Cloud Run backend hosting, static React hosting, Secret Manager, declarative infrastructure, and local/preview/staging/production environments.
- Mapped production schema domains to current active feature documents and persistence implementation waves.
- Added a draft follow-up issue register for database foundation, repository persistence, legacy import/backfill, GCP bootstrap, and production go-live readiness.
- Added wiki documentation summarising the production infrastructure decisions and operational gates.

### Validation

- Added documentation tests that verify the selected platform decisions, environment strategy, schema domains, follow-up issue register, and wiki operational gates remain visible.
- Kept `docs/features/active/production-backend-database-and-gcp-infrastructure.md` active until the planning issue is accepted and follow-up implementation issues are created or linked.

## 2026-05-23 - Refresh parallel development coordination

### Changed

- Updated the parallel development coordination source document with issue mappings for Agent 01 through Agent 10.
- Added current foundation status for each active feature workflow.
- Added a shared contract register covering session, API error, route, theme preset, shared model, and legacy migration ownership.
- Added release coordination rules for keeping active feature documents aligned until a deliberate release-management pass.
- Added wiki documentation for parallel development coordination guardrails.

### Validation

- Added documentation tests for workflow issue mappings, shared contract ownership, cross-feature matrix coverage, coordination wiki content, and repository operating-doc references.
- Kept `docs/features/active/parallel-development-coordination.md` active until release coordination is complete.

## 2026-05-23 - Refresh legacy migration feature index

### Changed

- Updated the legacy migration feature index to mark Analytics Dashboard and Fixture Difficulty Ratings as implemented foundations instead of unimplemented planning gaps.
- Added latest re-review notes for Dashboard and FDR route/API coverage while retaining sample-backed data and calculation migration gaps.
- Added a migration risk covering divergence between sample-backed Dashboard/FDR repositories and production legacy calculations.
- Refreshed the legacy migration index wiki to match current route/API coverage.

### Validation

- Extended documentation tests to verify Dashboard and FDR are no longer marked as unimplemented in the active migration index.
- Extended documentation tests to verify the wiki reflects the current Dashboard/FDR migration status.
- Kept `docs/features/active/legacy-migration-feature-index.md` active until legacy migration coverage is complete.

## 2026-05-23 - Implement fixture difficulty ratings

### Added

- Added FDR contracts for attack/defence views, team rows, fixture cells, filters, rating bands, and accessible rating scale tokens.
- Added in-memory FDR repository and `FixtureDifficultyService` for attack and defence retrieval, team/gameweek filtering, average rating calculation, and rating scale exposure.
- Added API routes for `GET /api/fdr`, `GET /api/fdr/attack`, `GET /api/fdr/defence`, and `GET /api/fdr/scales`.
- Added `/fdr` React route inside the shared shell with team and gameweek filters, attack and defence dense tables, sticky team columns, responsive horizontal scrolling, and rating legend.
- Added wiki documentation for FDR calculation ownership, API syntax, rating scale examples, and theme preset integration.

### Validation

- Added backend service tests for combined responses, team/gameweek filters, sorted average ratings, and accessible scale tokens.
- Added backend API integration tests for combined FDR, attack/defence filters, and rating scale endpoints.
- Added frontend tests for FDR rendering, filter re-query behaviour, token-driven rating classes, and shell/session route behaviour.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-23 - Implement analytics dashboard

### Added

- Added analytics dashboard contracts for dashboard config, metrics, dimensions, filters, widget definitions, widget query requests, chart series, table rows, and drill-down responses.
- Added in-memory dashboard repository and service boundaries for metric catalog validation, widget configuration, filtered aggregations, and drill-down rows.
- Added API routes for `GET /api/dashboard/config`, `POST /api/dashboard/widgets/{widget_id}/query`, `POST /api/dashboard/widgets/{widget_id}/drilldown`, `GET /api/dashboard/filters`, `GET /api/dashboard/metrics`, and `GET /api/dashboard/dimensions`.
- Added `/dashboard` React route inside the shared shell with global filters, responsive widget grid, accessible chart bars, fallback tables, and drill-down dialog.
- Added wiki documentation for dashboard configuration syntax, catalog allowlists, query examples, and UI behaviour.

### Validation

- Added backend service tests for catalog/config exposure, filtered widget queries, filter validation, and drill-down context.
- Added backend API integration tests for config/catalog endpoints, widget query validation, drill-down rows, and missing-widget errors.
- Added frontend tests for dashboard rendering, filter re-query behaviour, drill-down flows, and shell/session route behaviour.

## 2026-05-22 - Maintain legacy migration feature index

### Added

- Expanded the legacy migration feature index with a current coverage matrix for reviewed legacy screens, active feature documents, modern route/API coverage, implementation status, and migration risks.
- Added missing-feature candidate tracking for commissioner administration, notifications, import/export tooling, and additional reports discovered during future legacy re-review.
- Added a migration risk register covering undocumented PHP endpoint shapes, JavaScript-encoded business logic, rule-copy drift, browser-local state, and database-view coupling.
- Added legacy migration index wiki documentation.

### Validation

- Added documentation tests that verify reviewed legacy entry points remain listed.
- Added documentation tests that verify all major active feature documents remain mapped.
- Added documentation tests that verify missing-feature candidates and migration risks remain tracked.
- Kept `docs/features/active/legacy-migration-feature-index.md` active until legacy migration coverage is complete.

## 2026-05-22 - Implement team selection and chip management

### Added

- Added team selection contracts for lineup slots, selectable players, chip states, lineup update requests, chip update requests, fixture summary panels, and validation responses.
- Added in-memory team selection repository and services for lineup validation, chip lifecycle validation, and fixture/table summaries.
- Added API routes for `GET /api/team-selection`, `PUT /api/team-selection/lineup`, `PUT /api/team-selection/chips/{chip_id}`, and `GET /api/team-selection/fixtures-summary`.
- Added `/team-selection` React route inside the shared shell with chip selector cards, starter layout, bench/reserve panels, accessible player movement controls, validation messages, and fixture/table summary cards.
- Added wiki documentation for lineup validation, chip lifecycle, API syntax, and examples.

### Validation

- Added backend service tests for selection load, valid lineup updates, invalid lineup validation, chip activation, used-chip validation, second-active-chip validation, and fixture summaries.
- Added backend API integration tests for selection load, lineup update, lineup validation errors, chip activation/validation, and fixture summary context.
- Added frontend tests for team-selection rendering, chip toggles, invalid lineup feedback, and shell/session route behaviour.

## 2026-05-22 - Implement squad management scouting and transfers

### Added

- Added squad management contracts for player detail, squad summary, scouting filters, interests, and trade proposals.
- Added in-memory squad repository and service layer for squad totals, scouting, interest validation, and trade proposal workflows.
- Added API routes for `GET /api/squad/summary`, `GET /api/scouting/players`, `POST /api/interests`, `DELETE /api/interests/{interest_id}`, `GET /api/trades`, `POST /api/trades`, and `PUT /api/trades/{trade_id}`.
- Added `/squad-management` React route inside the shared shell with summary cards, scouting search, dense tables, interest creation, proposed trade action, and shared player detail dialog.
- Added squad management wiki documentation.

### Validation

- Added backend service tests for squad totals, scouting filters, interest validation, and trade rules links.
- Added backend API integration tests for summary, scouting filters, interest create/delete, validation errors, and trade create/update flow.
- Added frontend tests for squad rendering, scouting filtering, interest creation, trade rule links, and player detail.

## 2026-05-22 - Implement league fixtures and table

### Added

- Added league fixture, table, knockout, and head-to-head backend contracts.
- Added in-memory league repository data for current fixtures, next fixtures, playoff context, and started fixture details.
- Added `FixtureService`, `LeagueTableService`, `KnockoutService`, and `HeadToHeadService` boundaries.
- Added API routes for current fixtures, next fixtures, all fixtures, fixture detail, table, knockout, and head-to-head data under `/api/league`.
- Added a React league route surface inside the authenticated application shell.

### Validation

- Added backend service tests for fixture separation, fixture details, table calculations, knockout context, and head-to-head context.
- Added backend API tests for league fixture, table, knockout, and head-to-head endpoints.
- Added frontend shell tests for authenticated league route rendering.

## 2026-05-22 - Implement application shell navigation and presets

### Added

- Added a responsive React application shell with desktop sidebar navigation, mobile drawer navigation, shared reload action, scouting access, and global sign-out affordance.
- Added route-aware navigation configuration for Squad Management, Team Selection, League, Rules, Dashboard, FDR, and Scouting.
- Added tokenized `classic`, `dark`, and `compact` visual presets with colour, density, radius, typography, and chart palette hooks.
- Added user preference API support for `GET /api/me/preferences` and `PUT /api/me/preferences` with repository and service boundaries.
- Added wiki documentation for shell layout, navigation syntax, visual preset syntax, preference API usage, and cross-feature behaviour.

### Validation

- Added frontend unit tests for navigation configuration.
- Added frontend integration tests for authenticated shell rendering, mobile drawer behaviour, route changes, preset persistence, and unauthenticated shell blocking.
- Added backend integration tests for preference API round trip.
- Added backend service tests for preference defaults, persistence, and unsupported preset fallback.
- Feature document remains under `docs/features/active/` until CI validation passes.
