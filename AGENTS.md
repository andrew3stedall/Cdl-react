# CDL React — Codex Operating Instructions

## Project Context

This repository is the modern CDL React rebuild: a React web application with a Python API backend for Castle Draft League.

Castle Draft League is a draft-style fantasy football league application built around private leagues, live drafts, squad management, weekly team selection, head-to-head fixtures, chips, scoring, tables, knockouts, history, and migration from legacy behaviour.

This is not the legacy Castle Draft League repository and must not be treated as a direct copy exercise. The legacy app is a behavioural reference only. Use it to understand domain behaviour and useful UX patterns, but do not rebuild this repo as a like-for-like legacy clone.

Imported planning and execution skills are reusable operating instructions only. Castle legacy assumptions, Supabase assumptions, PSTD assumptions, email extraction assumptions, Rust assumptions, CLI archive-processing assumptions, and Snowflake assumptions do not apply unless explicitly requested.

## Repository Purpose

Planning and implementation must stay grounded in the repository docs, active feature documents, ADRs, GitHub issues, PRs, and current FastAPI/React code.

Primary documentation sources:

- Active feature documents: `docs/features/active/`.
- Wiki summaries: `docs/wiki/`.
- ADRs: `docs/architecture/`.
- Release notes: `docs/releases/`.
- Changelog: `CHANGELOG.md`.
- Milestone delivery workflow: `docs/milestone-delivery-workflow.md`.

## Operating Model

This repository uses a Codex Delivery Council model with two lanes:

1. Planning lane: turn product intent into milestones, epics, issues, docs, risks, and acceptance criteria.
2. Execution lane: build approved milestones or epics on scoped branches.

The current operating path is phone-first:

- The user prompts from ChatGPT on mobile.
- The assistant uses the GitHub connector to read and update repo artefacts.
- Planning, docs, issues, branches, and PRs are created through GitHub.
- Local testing may be deferred until the user has Codex running on a laptop.
- Repo-scoped skills live under `.agents/skills/` for future Codex runtimes and as reusable instructions.

## Current Mode

Mode: `milestone-execution`.

Allowed:

- Read product requirements, active feature documents, ADRs, issues, PRs, and code before planning or implementation.
- Convert product ideas into epics, milestones, GitHub issues, acceptance criteria, dependencies, risks, and documentation requirements.
- Build an approved milestone or epic without requiring a new prompt for every issue.
- Follow the ordered issue list defined by the milestone or epic.
- Use milestone or epic branches.
- Update application code within the approved milestone or epic scope.
- Add or update tests where practical.
- Document tests that were not run locally.
- Update docs and open PRs.
- For approved milestone implementation requests, raise or update the milestone PR, check mergeability/status, squash merge when mergeable, update/close relevant issues, and report the next recommended work item.
- For non-milestone work, merge only when the user explicitly asks or the requested task clearly includes merging.

Not allowed:

- Direct commits to `main` unless explicitly requested.
- Unrelated broad refactors.
- Rebuilding the app from scratch.
- Creating product scope from memory when active docs or issues exist.
- Changing GCP billing, Cloud SQL, Cloud Run, Secret Manager, IAM, production secrets, deployment targets, database schema, migrations, authentication, or access-control behaviour unless explicitly approved.
- Claiming tests passed when they were not run.
- Creating broad architecture without an ADR.
- Merging a PR that GitHub reports as not mergeable, has failing required checks, has unresolved reviews, or exceeds the approved milestone scope.

## Skills

Use `.agents/skills/README.md` as the skills index.

Core skills:

- `.agents/skills/planning-council/SKILL.md`
- `.agents/skills/issue-writer/SKILL.md`
- `.agents/skills/docs-writer/SKILL.md`
- `.agents/skills/github-planning-loop/SKILL.md`

Execution skills:

- `.agents/skills/execution/milestone-executor/SKILL.md`
- `.agents/skills/execution/epic-workforce/SKILL.md`
- `.agents/skills/execution/worker/SKILL.md`
- `.agents/skills/execution/milestone-branch-manager/SKILL.md`
- `.agents/skills/execution/deferred-testing/SKILL.md`

Agent roster:

- `.agents/agents.md`

## Planning Role Sequence

Use this role order for planning work:

1. Executive Sponsor.
2. Product.
3. Requirements / Business Analyst.
4. UX.
5. Metrics.
6. Data.
7. Platform.
8. Developer Feasibility.
9. Full-Stack Developer.
10. Docs Writer.
11. Integration.
12. Reviewer.

## Feature Document Lifecycle

Use this lifecycle for every feature unless the active milestone or release plan says otherwise:

```text
docs/features/active/feature-name.md
  -> implement from feature document
  -> validate feature and cross-feature impact
  -> docs/features/completed/{major|minor}/vX.Y.Z/feature-name.md
  -> docs/releases/vX.Y.Z.md
```

Do not move active feature documents to completed folders ad hoc. Completed movement should be coordinated in a release-management pass when shared contracts, release notes, changelog, and validation evidence are aligned.

## Parallel agent coordination

Multiple agents may work in parallel when each agent owns a separate feature document. Parallel work must follow these rules:

- One feature document is the source of truth for one feature branch or task.
- Shared API contracts, models, routes, theme tokens, and components are integration points.
- Each feature must document dependencies on other active features.
- Testing must include the feature's own tests and relevant cross-feature integration tests.
- Agents must avoid incompatible shared-contract changes unless affected feature documents are updated together.
- Shared contract changes must be coordinated through the current backend/platform owner and reflected in affected feature docs before implementation proceeds.

## Execution Workflow

When the user asks to implement a milestone, treat that as approval to complete the full milestone delivery loop.

1. Start from an approved milestone or epic.
2. Confirm the ordered issue list from GitHub issues and docs.
3. Create or use a milestone branch.
4. Implement the issue set in milestone order.
5. Keep unrelated changes out.
6. Add or update tests where practical.
7. Record tests that could not be run.
8. Update docs and changelog.
9. Open or update a milestone PR.
10. Check PR mergeability and available CI/status information.
11. Squash merge the milestone PR when it is mergeable and within scope.
12. Update or close relevant issues and milestone trackers where appropriate.
13. Report the merge result, deferred validation, known follow-up work, and the next recommended milestone or issue.

For implementation work that is not an approved milestone or epic, raise a PR and wait for an explicit merge instruction unless the user clearly asked for the change to be merged.

## Milestone Merge Rules

- Use squash merge for completed milestone PRs unless the user explicitly instructs otherwise.
- Do not merge if GitHub reports the PR is not mergeable.
- Do not merge if required checks are failing or unavailable in a way that requires user review.
- Do not merge if the work exceeded the approved milestone scope.
- Do not merge if unresolved product decisions remain.
- Do not merge if the work requires unapproved database schema, migrations, auth, GCP, billing, IAM, secrets, or deployment changes.
- After merge, state what was merged, what issues were updated or closed, what tests/checks were run or deferred, and what is next.

## Planning Rules

- Work from repository evidence and explicit user instructions.
- Inspect relevant docs and code before planning or implementation.
- Do not invent test, build, lint, typecheck, deployment, or infrastructure commands when they are unknown.
- Every planned issue must include scope, out-of-scope items, acceptance criteria, dependencies, risks, and documentation requirements.
- Prefer small, dependency-aware issues within coherent milestones.
- Mark work as on hold if product intent, data access, operating model, or acceptance criteria are missing.
- CDL React-specific rules in this file override imported generic skill guidance.

## Safety Rules

- Do not delete, rename, or move files unless specifically instructed.
- Do not run broad automated fixes such as `npm audit fix`, `npm audit fix --force`, `--force`, or `--legacy-peer-deps` unless explicitly approved.
- Do not install new dependencies without explaining why they are needed.
- Do not rewrite large parts of the app when a targeted fix is possible.
- Do not change database schema, migrations, auth configuration, secrets, GCP resources, deployment workflows, or IAM unless explicitly instructed.
- Before making changes, inspect the relevant files and explain the intended approach.
- Prefer small, reviewable changes.
- Keep existing user-facing behaviour unless the task specifically asks to change it.

## Current Stack

Backend:

- Python 3.12.
- FastAPI.
- Pydantic and pydantic-settings.
- uv.
- SQLAlchemy.
- Alembic.
- PostgreSQL / psycopg.
- Ruff.
- pytest.

Frontend:

- React.
- TypeScript.
- Vite.
- Vitest.
- ESLint.
- shadcn/ui is the preferred component and styling foundation where installed or intentionally added.
- Theme presets should stay configurable rather than hard-coded.
- lucide-react.
- class-variance-authority, clsx, and tailwind-merge.

Planned/production infrastructure context:

- Cloud SQL for PostgreSQL is the accepted first production persistence target.
- Staging and production GCP bootstrap must stay gated until Andrew confirms manual bootstrap steps are complete.
- Keep `memory` repository mode available while PostgreSQL-backed repositories are introduced incrementally.

## Architecture Preferences

- Prefer object-oriented programming for backend domain logic, services, repositories, adapters, and migration utilities.
- Keep React components focused on view behaviour.
- Use shadcn/ui components by default before custom UI components when the dependency is available or explicitly added.
- Keep visual styling configurable through documented presets rather than hard-coded one-off styles.
- Do not put raw SQL in route handlers or UI code.
- Use parameterized queries, repositories, query builders, or ORM models.
- Keep SQL out of route handlers.
- Keep route handlers thin; services own orchestration and validation; repositories own persistence.
- Document API contracts before implementation.

## UI / UX Standards

- Use the modern CDL React design direction rather than recreating the legacy UI exactly.
- Treat the Castle Manager's Desk pattern as the preferred experience direction for mobile-first, urgency-ranked action surfaces.
- Prefer short CTAs, clear hierarchy, dense but readable cards, and responsive layouts.
- Every major screen should handle loading, empty, error, and success states.
- Preserve accessibility basics: semantic HTML, labelled controls, visible focus states, and sufficient contrast.

## Data and Persistence Rules

- Cloud SQL for PostgreSQL is the accepted first managed production database service.
- Use PostgreSQL locally and in CI when implementing production persistence.
- Use Alembic-managed migrations for schema versioning.
- Keep repository selection settings-driven so `memory` mode remains available during incremental migration.
- Historical import jobs must stay separate from schema migrations.
- Do not proceed to GCP staging or production changes until the documented manual bootstrap gates are satisfied.

## Validation Baseline

Backend commands:

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Run the backend locally with:

```bash
uv run uvicorn cdl_api.app:app --reload
```

Frontend commands:

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
npm run typecheck
```

If a command cannot be run from the current environment, state that clearly and do not claim it passed.

## Review Checklist

Before finalising work, check:

- Scope matches the issue or milestone.
- Backend route/service/repository boundaries are preserved.
- Pydantic contracts remain compatible.
- Database migrations are append-only and explicit when approved.
- Repository mode behaviour remains compatible.
- Frontend routes and API clients are aligned.
- Loading, empty, error, and success states remain usable.
- Lint, typecheck, build, and test status is reported accurately.
- Docs and changelog are updated.

## Pull Request Standard

Every PR must include:

- Purpose.
- Scope.
- Files changed.
- Tests or validation performed.
- Tests or validation deferred.
- Documentation updated.
- Data impact.
- Operational impact.
- Follow-up work.
- For milestone PRs, covered issue checklist, merge readiness, and the next recommended milestone or issue.

## Documentation Standard

Every meaningful planning or execution change must update docs. Use audience-specific folders under `docs/` rather than placing all notes in one file.

Keep these sources aligned:

- Active feature documents under `docs/features/active/`.
- Wiki summaries under `docs/wiki/`.
- ADRs under `docs/architecture/`.
- Release notes under `docs/releases/`.
- `CHANGELOG.md`.

## CDL Domain Notes

Be especially careful with:

- Authentication and session handling.
- League creation, joining, membership, roles, and permissions.
- Draft setup and live draft behaviour.
- Squad ownership, transfers, loans, trades, waivers/free agents, and commissioner approvals.
- Weekly lineup locks, captaincy, vice-captaincy, chips, bench, and reserves.
- Fixture generation, scoring, tables, knockouts, and playoff history.
- FPL reference data, sync cadence, and cache freshness.
- Dashboard, FDR, and production calculation ownership.
- Historical import and legacy migration mapping.

These areas can have hidden business rules. Do not simplify or refactor them without first understanding the full flow.
