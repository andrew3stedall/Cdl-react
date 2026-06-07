# Feature: Production Backend Database and GCP Infrastructure

## Purpose

Define the production database, managed GCP infrastructure, implementation sequence, and follow-up issue plan needed to move Castle Draft League from foundation/sample-backed data to persistent production-ready hosting.

This is a planning and coordination feature for issue #58. It deliberately stops before provisioning resources or replacing repositories.

## Status

Planning decision record. No production database, GCP resource, deployment pipeline, or real legacy data migration is implemented by this document.

## Release Target

Production-readiness planning milestone before the first real-user production deployment.

## Source of Truth

- Issue: #58
- Feature document: `docs/features/active/production-backend-database-and-gcp-infrastructure.md`
- Wiki page: `docs/wiki/production-backend-database-and-gcp-infrastructure.md`
- Related platform document: `docs/features/active/backend-api-data-platform.md`
- Related migration index: `docs/features/active/legacy-migration-feature-index.md`

## Decision Summary

| Area | Decision | Rationale | Deferred alternatives |
| --- | --- | --- | --- |
| Primary database | Cloud SQL for PostgreSQL | Relational integrity, joins, transactions, migrations, backup/restore, local Docker parity, and broad FastAPI tooling support fit CDL's league, squad, scoring, and audit data. | AlloyDB, Spanner, Firestore, BigQuery-first storage. |
| Local database | PostgreSQL in Docker Compose or an equivalent local service | Keeps local development close to production while allowing isolated developer resets and seed data. | SQLite-only local storage. |
| Test database | Ephemeral PostgreSQL service in CI | Repository and migration tests must run against PostgreSQL-specific constraints and transactions before deployment. | Pure mocks or in-memory repository-only tests. |
| Migration tooling | Alembic-managed schema migrations with explicit forward migrations and reviewed data migrations | Fits the Python/FastAPI stack, supports versioned schema changes, and creates an auditable release gate. | Manual SQL changes without versioning. |
| Backend hosting | Cloud Run service for the FastAPI container | Scales down for low usage, can cap maximum instances for cost and database protection, and supports managed HTTPS and revision-based deploys. | GKE, Compute Engine, App Engine. |
| Frontend hosting | Static React build on Firebase Hosting or Cloud Storage plus Cloud CDN | Keeps the frontend independent from backend scaling and supports low-cost static delivery. Firebase Hosting is preferred if preview channels are useful. | Serving frontend through FastAPI. |
| Secrets | Secret Manager | Database URLs, session secrets, API credentials, and migration secrets must not live in source or plain environment files. | Repository secrets as the only runtime secret store. |
| Infrastructure as code | Terraform/OpenTofu-style declarative configuration | Required for repeatable staging/production environments and reviewable changes. | Console-only manual configuration. |
| Initial environments | Local, preview, staging, production | Local and preview protect feature velocity; staging/prod separation is required before real users or real legacy data. | One shared production database for every non-local environment. |
| First production footprint | One small Cloud SQL PostgreSQL production instance, one staging instance or staging database, Cloud Run backend with low max instances, static frontend hosting, Secret Manager, logging, basic alerts | Minimises cost while keeping isolation, backups, rollback, and operational checks explicit. | Multi-region active-active or analytics warehouse in the first version. |

## Legacy Inventory

The current migration index shows that major reviewed legacy screens already map to active modern feature documents, but the database and production persistence work remains open across those domains:

- Authentication and session workflows from `index.php`, `signin.js`, `checkSession.js`, and `logout.php`.
- Squad, scouting, interests, transfers, and trade workflows from `index.html` and PHP endpoint families.
- Team selection, lineup, captaincy, bench/reserve, and chip workflows from `myTeam.html`.
- Fixture, result, standings, knockout, and head-to-head workflows from `fixtures.html`.
- Rule copy and future rule-versioning gaps from `rules.html`.
- Dashboard and FDR calculations that may depend on legacy SQL views or JavaScript transforms.
- PHP endpoint and SQL-backed response shapes that must be fixture-captured before replacement.

## Current Behaviour

- Backend foundations use FastAPI, Pydantic contracts, service classes, and repository boundaries.
- Authentication currently uses in-memory user and session repositories with development credentials.
- Squad and team-selection data currently come from in-memory repositories with sample players, teams, fixtures, lineups, and chip state.
- Dashboard and FDR have modern route/API foundations, but remain sample-backed until stable production calculations or legacy-backed views are migrated.
- Feature documents remain active until release validation and legacy migration coverage are complete.

## Business Rules

- Production data must be transactional where squad rights, trades, lineups, chip usage, scoring, fixture state, and audit records can conflict.
- Route handlers must not embed raw SQL.
- Service classes must own domain validation; repositories must own persistence details.
- Every production repository must have tests covering happy paths, validation failures, transaction boundaries, and missing-record behaviour.
- Migrations must be reversible by restore procedure, even when Alembic downgrade is not safe for data migrations.
- Real legacy import must be repeatable, auditable, reviewable, and non-destructive until explicitly approved.
- Production secrets must be rotated outside source control.
- Production deploys must preserve a runnable app after every phase.

## Dependencies On Other Active Features

| Active feature | Dependency |
| --- | --- |
| `backend-api-data-platform.md` | Owns repository/service conventions, API grouping, Pydantic contracts, and persistence replacement standards. |
| `authentication-and-session-management.md` | First production persistence target for users, password/session state, cookies, expiry, and logout invalidation. |
| `application-shell-navigation-and-presets.md` | Needs stable session and user-preference persistence before real users. |
| `squad-management-scouting-and-transfers.md` | Needs persistent squads, player rights, interests, transfer proposals, trades, and audit records. |
| `team-selection-and-chip-management.md` | Needs persistent lineups, chips, fixture lock status, captaincy, bench/reserve order, and validation snapshots. |
| `league-fixtures-and-table.md` | Needs persistent fixtures, results, standings snapshots, knockouts, and scoring state. |
| `analytics-dashboard.md` | Needs production-safe aggregate models, dashboard definitions, and query performance boundaries. |
| `fixture-difficulty-ratings.md` | Needs stable FDR calculation ownership or migrated database views. |
| `legacy-migration-feature-index.md` | Owns legacy behaviour mapping and must stay aligned with import/backfill work. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy SQL views contain business rules not captured in feature documents. | Persistent repositories could reproduce the wrong results. | Capture legacy fixtures and query notes before replacing each domain. |
| Cloud SQL connection counts are exceeded by Cloud Run autoscaling. | Production outage or elevated latency. | Start with conservative Cloud Run max instances, use SQLAlchemy pooling controls, and add database connection metrics. |
| Staging and production share state accidentally. | Test data could corrupt real user data. | Use separate projects or separate instances/databases with explicit service accounts and Secret Manager entries. |
| Schema is too broad for the first release. | Planning stalls implementation. | Start with auth/session/preferences plus one vertical domain, then migrate feature areas in waves. |
| Legacy import is treated as a one-shot script. | Data fixes become hard to review or replay. | Use repeatable import jobs, mapping tables, review queues, idempotency keys, and archive records. |
| Backup exists but restore is untested. | False confidence before onboarding real users. | Require a staging restore drill and documented RTO/RPO before go-live. |
| Secrets leak into logs or frontend build output. | Security incident. | Centralise runtime secrets in Secret Manager and keep frontend config public-only. |

## Target Architecture

### Runtime topology

```text
Browser
  -> Static React hosting/CDN
  -> FastAPI backend on Cloud Run
  -> Cloud SQL for PostgreSQL
  -> Secret Manager for runtime credentials
  -> Cloud Logging/Monitoring/Error Reporting
```

### Backend application boundaries

- `cdl_api.app` owns FastAPI setup, routers, middleware, CORS, health checks, and dependency injection.
- Services own validation, orchestration, and transaction intent.
- Repositories own SQLAlchemy/Alembic persistence models and queries.
- Contracts remain Pydantic request/response models consumed by API tests and frontend clients.
- Migrations live under a dedicated migration directory and are applied during controlled deployment steps, not implicitly during request handling.

### Connectivity model

- Cloud Run connects to Cloud SQL using Cloud SQL-supported connectivity, with private connectivity preferred for production once the VPC footprint is defined.
- Staging and production use separate connection strings and service accounts.
- Local development uses local PostgreSQL and `.env`/developer secrets that never become production credentials.
- CI uses ephemeral PostgreSQL with migrations applied before repository tests.

## Database Requirements

### Initial schema domains

| Domain | Initial entities | Current source/owner | First persistence wave |
| --- | --- | --- | --- |
| Identity and auth | users, credentials, roles, sessions, refresh tokens, login audit | Auth feature | Wave 1 |
| Preferences | user theme preset, density/layout preferences, preference audit | Application shell | Wave 1 |
| League structure | leagues, seasons, draft teams, managers, memberships, permissions | Backend platform / league fixtures | Wave 2 |
| FPL reference cache | EPL teams, FPL players, positions, prices, availability, freshness metadata | Squad, FDR, dashboard | Wave 2 |
| Squad rights | squad ownership, player rights, roster slots, loans, draft picks | Squad management | Wave 3 |
| Transfers and trades | interests, free-agent claims, transfer proposals, trade proposals, approvals, rejection reasons | Squad management | Wave 3 |
| Team selection | lineup slots, captaincy, vice captaincy, bench/reserve order, chips, lock status | Team selection | Wave 4 |
| Fixtures and scoring | CDL fixtures, EPL fixtures, results, scoring snapshots, standings, knockout rounds | League fixtures / team selection | Wave 5 |
| Rules and policy | rule categories, stable rule anchors, rule versions, admin-edit history | Rules knowledge base | Wave 5 or later |
| Dashboard and FDR | dashboard definitions, metric catalog, aggregate snapshots, FDR ratings, calculation inputs | Dashboard / FDR | Wave 6 |
| Notifications and activity | activity feed, notifications, approvals, delivery status | Backend platform until a dedicated feature exists | Later wave |
| Audit and admin | audit events, admin actions, permission changes, operational review notes | Backend platform | Cross-cutting |
| Legacy migration | legacy IDs, import batches, mapping tables, review items, archived source payloads | Legacy migration index | Cross-cutting |

### Migration tooling

- Add Alembic configuration under the backend project.
- Require `uv run alembic upgrade head` or an equivalent project command in local, CI, staging, and production release flows.
- Keep schema migrations separate from heavy data import/backfill jobs.
- Add migration smoke tests that create an empty database, apply all migrations, and validate core tables/indexes exist.
- Add data migration tests for idempotency and mapping conflicts once legacy imports start.

### Seed/demo data

- Keep deterministic demo seed data for local development and preview environments.
- Do not load demo data into production unless behind an explicit one-time bootstrap command.
- Keep seed records small, stable, and aligned with current frontend/API contract tests.

### Backup, restore, retention, and PITR

- Enable automated backups and point-in-time recovery for production Cloud SQL before onboarding real users.
- Keep staging backups enabled once staging contains representative import data.
- Define initial retention after cost review; minimum expectation is enough coverage to recover from accidental writes discovered after the next operational check.
- Require a staging restore drill before go-live.
- Document who can restore, what data may be overwritten, and how rollback is communicated.

### Local and CI database strategy

- Local: Docker Compose PostgreSQL with reset, migrate, and seed commands.
- CI: ephemeral PostgreSQL service, migration smoke test, repository tests, and API integration tests.
- Test data must isolate test cases and avoid relying on execution order.

## GCP Infrastructure Requirements

### Environment layout

| Environment | Purpose | Database | Backend | Frontend |
| --- | --- | --- | --- | --- |
| Local | Developer work and tests | Local PostgreSQL | `uv run uvicorn ... --reload` | Local Vite dev server |
| Preview | PR/review validation | Shared preview DB or seeded ephemeral DB after risk review | Cloud Run preview service or local CI only at first | Firebase preview channel or build artifact |
| Staging | Production rehearsal | Separate Cloud SQL staging instance or database | Cloud Run staging service | Static staging host |
| Production | Real users | Separate Cloud SQL production instance | Cloud Run production service | Static production host/CDN |

### Deployment pipeline

- GitHub Actions runs backend lint, format, tests, migration smoke tests, frontend lint, frontend tests, and frontend build.
- Staging deploy requires main-branch merge or a protected manual approval.
- Production deploy requires passing staging checks, migration plan review, and rollback note.
- Migrations run as a controlled job before or during deploy, not as ad-hoc shell commands.
- Cloud Run revision rollout must keep the previous revision available for rollback.

### Security requirements

- Separate service accounts for deploy, backend runtime, migration job, and read-only operational checks.
- Least-privilege IAM for Cloud SQL, Secret Manager, Artifact Registry, Cloud Run, and logging.
- Production cookies use secure flags, same-site policy, explicit expiry, and server-side session invalidation.
- CORS allowlists are environment-specific.
- Public frontend config contains only public API origin and display settings.
- Database users are separated by role: app runtime, migration job, read-only diagnostics.
- No broad public database access.

### Observability and operations

- `/health` remains lightweight and does not require expensive database queries.
- Add a readiness or dependency check for database connectivity in deployment smoke tests.
- Emit structured logs with request IDs and user/session identifiers only when safe.
- Add error reporting for uncaught backend exceptions.
- Add alerts for Cloud Run 5xx rate, latency, Cloud SQL CPU/storage/connection saturation, backup failures, and failed migration jobs.
- Add a go-live checklist covering migrations, secrets, backups, restore drill, smoke tests, and rollback.

### Cost controls

- Start Cloud Run with low CPU/memory, scale-to-zero for staging/preview where acceptable, and explicit maximum instances to protect cost and database connections.
- Start Cloud SQL with the smallest instance that passes staging smoke/load checks.
- Avoid read replicas, multi-region, BigQuery export, and always-on analytics jobs until usage justifies them.
- Review Cloud Logging retention and alert noise before production.

## API Requirements

- Preserve current endpoint contracts while repository implementations change underneath services.
- Add database-backed repository implementations behind dependency injection or repository factories.
- Add API integration tests that run with the production repository implementations against PostgreSQL.
- Add migration/version endpoint or admin-visible build metadata only if needed for operations.
- Keep generated or documented frontend client contracts aligned with Pydantic models.

## React Requirements

- No production secret is embedded in the frontend.
- Frontend runtime config must support environment-specific API origins.
- Existing authenticated shell behaviour must continue while auth/session persistence changes.
- User-facing maintenance or deploy error states should use existing shadcn/ui alert/toast/dialog patterns if introduced.

## UI Requirements

This planning feature does not add UI. Any future UI for admin migration review, backup status, activity feed, or operations must:

- Use shadcn/ui components by default.
- Respect documented theme presets.
- Avoid exposing sensitive operational details to normal managers.
- Include accessibility and route-guard tests.

## Data Access Requirements

- Use repository classes for all database reads and writes.
- Use SQLAlchemy, SQLModel, or an equivalent typed query layer; raw SQL is allowed only inside reviewed repository methods or migration scripts.
- Keep transaction boundaries explicit in service or unit-of-work code.
- Add indexes for foreign keys, lookup keys, status queues, and time-ordered audit queries.
- Use soft-delete or archive tables where historical review matters.
- Store legacy ID mappings in first-class tables rather than comments or one-off scripts.

## Implementation Sequence

1. Approve this architecture and follow-up issue register.
2. Add local PostgreSQL, CI PostgreSQL, Alembic, and migration smoke tests.
3. Add application settings for database URL, connection pooling, environment name, and secret loading.
4. Add production repository interfaces/factories while keeping in-memory repositories available for demos/tests.
5. Persist users, sessions, and preferences.
6. Define and apply league, season, manager, draft-team, and FPL cache schemas.
7. Replace squad, interests, transfers, and trade repositories.
8. Replace team-selection, chip, and fixture-lock repositories.
9. Replace fixture, scoring, standings, knockout, dashboard, and FDR persistence in separate vertical slices.
10. Add legacy import/backfill mapping tables and review workflow.
11. Bootstrap GCP infrastructure with staging first.
12. Provision production database, secrets, Cloud Run backend, and static frontend host.
13. Add staging smoke tests, production smoke tests, monitoring, backups, restore drill, and go-live checklist.

## Draft Milestones and Follow-Up Issues

| Draft issue | Scope | Acceptance gate |
| --- | --- | --- |
| Database architecture decision record | Finalise Cloud SQL PostgreSQL, migration tooling, local/CI DB approach, and repository factory pattern. | Decision recorded, risks accepted, follow-up implementation issues linked. |
| Local and CI PostgreSQL foundation | Add Docker Compose/local commands, CI PostgreSQL, Alembic baseline, migration smoke test. | `uv run pytest` includes migration/repository smoke coverage against PostgreSQL. |
| Backend database settings and repository factory | Add typed settings, database engine/session lifecycle, dependency injection, and test overrides. | API tests can run against either in-memory or PostgreSQL repositories. |
| Auth/session/preference persistence | Replace in-memory auth/session/preference stores. | Login, session, logout, and preference tests pass against PostgreSQL. |
| Core league and FPL cache schema | Add leagues, seasons, teams, managers, FPL players/teams, freshness metadata. | Seed data and contract tests cover current shell/squad/league consumers. |
| Squad, transfers, and trades persistence | Persist squad rights, interests, transfer state, trade proposals, approvals, and audit. | Squad management API tests pass against PostgreSQL and preserve current contract shapes. |
| Team-selection and chip persistence | Persist lineups, captaincy, chip state, fixture locks, and validation snapshots. | Team-selection API tests pass against PostgreSQL and cover invalid updates. |
| Fixture, scoring, table, and knockout persistence | Persist fixtures, results, scoring snapshots, standings, knockout, and head-to-head context. | League API tests pass against PostgreSQL with deterministic fixture data. |
| Dashboard and FDR production data | Replace sample-backed dashboard/FDR data with migrated calculations, snapshots, or reviewed views. | Dashboard and FDR tests cover production-backed calculations and legacy fixture parity. |
| Legacy import and backfill tooling | Add import batches, mapping tables, archived payloads, review items, idempotent jobs. | Re-running imports is safe and produces reviewable conflict reports. |
| GCP infrastructure bootstrap | Add IaC for projects/environments, Artifact Registry, Cloud Run, Cloud SQL, Secret Manager, IAM, logging. | Staging can deploy from GitHub with least-privilege secrets and smoke checks. |
| Production deployment and go-live checklist | Add production deploy, backup/PITR, restore drill, alerts, smoke tests, rollback plan. | Go-live checklist passes before real users are onboarded. |

## Acceptance Criteria

- Cloud SQL for PostgreSQL is selected as the first production database service.
- Cloud Run is selected as the first backend hosting service.
- Static React hosting through Firebase Hosting or Cloud Storage plus Cloud CDN is selected for the frontend.
- Local, preview, staging, and production environments are defined.
- Initial schema domains are mapped to current active feature documents and repository replacement waves.
- Migration, seed, backup, restore, PITR, local development, and CI test database expectations are documented.
- Secrets, IAM, CORS, cookie/session security, deployment, monitoring, and cost controls are documented.
- Draft follow-up issues and milestones are listed with acceptance gates.
- This issue remains planning-only and does not provision GCP resources or replace repositories.

## Test Requirements

- Add documentation tests that verify the selected database, backend hosting, frontend hosting, secrets manager, migration tooling, and environment strategy remain documented.
- Add documentation tests that verify schema domains and follow-up issue drafts remain visible.
- Future implementation issues must add unit tests, repository tests, API integration tests, frontend tests where applicable, migration smoke tests, lint/format checks, and build validation.

## Cross-Feature Test Requirements

- Auth/session persistence changes must run protected-shell and preference tests.
- Squad/trade persistence changes must run rules-link and player-detail tests.
- Team-selection persistence changes must run league fixture summary and rule validation tests.
- Fixture/scoring persistence changes must run dashboard/FDR affected tests if aggregate data changes.
- Legacy import changes must run migration index documentation tests.

## Documentation Requirements

- Keep this feature document active until the production database and GCP implementation plan is split into accepted follow-up issues.
- Keep `docs/wiki/production-backend-database-and-gcp-infrastructure.md` aligned with any material architecture decision changes.
- Update affected active feature documents when persistence sequencing or ownership changes.
- Add release notes only when implementation work is completed, not for this planning pass alone unless the release process requires planning records.

## Changelog Requirements

Record this planning pass and documentation test coverage in `CHANGELOG.md`.

## Completion Checklist

- [x] Production database service selected.
- [x] GCP backend/frontend hosting pattern selected.
- [x] Environment strategy documented.
- [x] Schema domains mapped to active features.
- [x] Migration, local, CI, backup, restore, secrets, and monitoring requirements documented.
- [x] Follow-up issue register drafted.
- [x] Wiki documentation added.
- [x] Documentation tests added.
- [x] Changelog updated.
- [ ] Follow-up implementation issues opened or linked after plan review.
- [ ] Planning issue closed after merge or explicit acceptance.
