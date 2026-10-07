# Domain Test Strategy and Parity Tests

## Purpose

Define scenario-driven testing, service tests, permission tests, time-based tests, migration tests, and legacy behaviour parity tests.

## Status

Checkpoint 5 complete.

## Test Categories

```text
unit tests
service tests
scenario tests
permission tests
time-based tests
migration tests
parity / characterisation tests
```

## Scenario Coverage

Draft:

```text
snake and repeated draft order
timeout autopick
preselection autopick
commissioner pick-on-behalf
pick duration tracking
```

Free agency:

```text
private preferences
deterministic draw processing
temporary rights
expiry at deadline
```

Transfers and loans:

```text
both-party agreement
commissioner approval
vice commissioner approval when commissioner involved
loan return
loan extension
loan-to-permanent conversion
```

Lineups and scoring:

```text
roll-forward lineup
auto-adjusted lineup
captain/vice validation
formation validation
substitutions
chips
fixture finalisation
commissioner correction
```

Knockouts:

```text
two-leg aggregate
most-goals tiebreaker
bracket winner progression
```

## Parity Tests

Use selected historical legacy examples to verify that new domain services either reproduce known behaviour or document intentional differences.

## Acceptance Criteria

- Rule-heavy workflows have service-level tests.
- Critical permissions are tested.
- Time/deadline behaviour is testable with fixed clocks.
- Legacy parity gaps are explicit, not accidental.


## Current release regression gates

The release gate separates evidence by execution layer rather than treating
mocked UI tests as proof of persistence:

- Playwright exercises the current 20-player/five-chip contract in Chromium at
  desktop and mobile sizes, including portrait and landscape. It covers the four
  primary routes, route loading transitions, player drawers, palette sheets,
  commissioner management, invite creation, adaptive/light/dark appearance,
  explicit Market empty/error states, and keyboard modal lifecycle.
- PostgreSQL CI provisions PostgreSQL 16, applies the checked-in Alembic head,
  and exercises two authenticated managers through invite acceptance, team
  isolation, lineup/captain save+reload, chip save+reload, logout/re-auth, and
  assignment revocation.
- Staging rollout evidence is separate again: migration and candidate checks
  must pass before the new Cloud Run revision can receive traffic. A no-op
  authenticated lineup write proves the staged candidate can read, write, and
  reload real persisted manager state without leaving the reviewer team changed.
- Screenshot capture remains manual. The release browser gate does not
  re-enable automatic screenshot collection; the existing screenshot workflow
  retains its deterministic accessibility checks.

Real-device passkey verification belongs to the passkey workstream (#472), and
backup/restore/rollback drills remain production-readiness evidence under
#70/#71/#78 rather than prerequisites invented for the browser/PostgreSQL
regression issue.


## Validation commands and evidence — 7 October 2026

Evidence is intentionally separated by execution layer:

```bash
# Component/jsdom evidence; API boundaries may be mocked.
cd frontend
npm run test

# Current-contract Chromium interaction/layout evidence.
cd frontend
npm run test:browser

# Real PostgreSQL 16 release-path evidence after Alembic upgrade.
CDL_DATABASE_URL=postgresql+psycopg://cdl@localhost:5432/cdl uv run alembic upgrade head
CDL_DATABASE_URL=postgresql+psycopg://cdl@localhost:5432/cdl \
  uv run pytest tests/test_postgres_release_journeys.py

# Manual visual/axe evidence only; the App Screenshots workflow remains workflow_dispatch.
node scripts/capture-app-screenshots.mjs
```

The final #572 head passed CI run 37606293995 and PostgreSQL run 37606294104.
The merged staging rollout 37606580536 then applied migrations, warmed a
zero-traffic candidate, completed the authenticated candidate read/write/reload
smoke, and promoted only after that smoke passed.

The manual screenshot/axe harness is not treated as PostgreSQL or deployed
integration evidence. It uses deterministic mocked API data, but now matches
the current 20-player/five-chip contract and covers mobile portrait/landscape,
desktop/tablet, light/dark/adaptive appearance, and commissioner management.
It remains manually dispatched; CI syntax-checks and contract-checks the
harness without automatically collecting screenshots.
