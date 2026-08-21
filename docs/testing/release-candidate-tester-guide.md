# Release-candidate tester guide

This guide covers repository-safe testing with deterministic synthetic data. It does **not** represent live staging, real historical exports, production identity, or real customer data.

## Evidence boundary

Use this guide only when the same commit has green `CI`, `Backend PostgreSQL`, and `App Screenshots` workflows. Browser journeys use deterministic API test doubles; PostgreSQL persistence is proved separately by clean migrated-database tests. Live browser-to-PostgreSQL behaviour remains a staging gate.

## Deterministic browser account

The browser suite uses this synthetic manager identity:

- Email: `manager@example.com`
- Password: `browser-login-secret`
- Display name: `Browser Manager`
- Role: `manager`

These credentials exist only in the deterministic browser test contract. They must not be configured as staging or production credentials.

## Deterministic data landmarks

- Manager team: `Castle FC`
- Comparison team: `River Rangers`
- EPL teams: `Arsenal` and `Manchester City`
- Current browser fixture: `Castle FC` vs `River Rangers`
- Representative players: `Alex Keeper`, `Ben Defender`, `Casey Midfielder`, `Riley Forward`, and `Morgan Reserve`

## Supported test scenarios

| Scenario | Expected behaviour | Evidence boundary |
| --- | --- | --- |
| Authentication | Valid synthetic credentials open the protected application; invalid credentials show `Invalid email or password.`; logout and session expiry return to an unauthenticated state. | Deterministic browser contract only until staging identity is proven. |
| League navigation | League overview, fixture details, standings and historical views render representative deterministic data at desktop and mobile widths. | PostgreSQL domain persistence is tested separately; real historical-export compatibility is unproven. |
| Dashboard and FDR | Dashboard filtering, drill-down interaction, empty output and FDR filtering render without silent sample fallback. | Persisted dashboard/FDR contracts are covered independently by backend PostgreSQL tests. |
| Squad interests | Adding `Casey Midfielder` shows success, survives reload, and a duplicate attempt shows `Interest already exists.` without changing stored state. | Browser uses an API test double; clean PostgreSQL tests prove the persisted mutation separately. |
| Trade proposal | A valid proposal shows `Trade proposal created.`, survives reload, and a duplicate or invalid proposal returns explicit feedback without changing state. | Counterparty acceptance/rejection authorization is API/PostgreSQL-tested but not exposed as a focused UI control journey. |
| Team selection | List view has no player movement dropdowns; selecting a player opens the full profile as a full-screen layer over navigation with visible squad-management actions and the Squad shirt token, only formation-valid substitutions are offered, a numbered bench slot can be chosen, and a valid profile action shows `Alex Keeper moved to the bench.`; lineup and wildcard state survive reload. | Live browser-to-PostgreSQL integration remains a staging gate. |
| Fixture lock | Lineup, chip and save controls are disabled after the deterministic fixture lock activates. | Lock behaviour is covered at mobile and desktop widths. |
| Accessibility and responsiveness | Keyboard navigation, labels, focus behaviour, touch targets and automated accessibility checks run in the screenshot workflow at representative mobile and desktop widths. | Final product/design acceptance remains user-owned. |

## Known empty, error and unsupported states

- Dashboard drill-down may return an explicit empty result when no persisted fact contract exists; this is not a silent fallback.
- Duplicate squad-interest and trade requests return explicit validation and preserve prior state.
- Unauthorized or stale trade transitions return explicit errors and preserve the accepted or proposed PostgreSQL state.
- Counterparty trade acceptance and rejection are not currently exposed in the product UI.
- Rules/preferences and several modernisation endpoints are not yet confirmed as release-critical product workflows.
- Real historical exports are unavailable; all import evidence is deterministic and synthetic.
- Live staging identity, browser-to-PostgreSQL persistence, database readiness, deployment smoke tests, backup/restore and rollback remain owned by the staging sequence.

## Reproduce the evidence

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

For clean PostgreSQL evidence, configure the `CDL_DATABASE_URL` contract used by `.github/workflows/backend-postgres.yml`, run `uv run alembic upgrade head`, then run that workflow's focused tests. For browser evidence, use `.github/workflows/app-screenshots.yml`; do not substitute ad hoc credentials or claim the deterministic mocks are live staging.

## Feedback instructions

When reporting a defect, record:

1. Commit SHA and workflow run.
2. Browser and viewport.
3. Route and synthetic account/data used.
4. Exact steps and expected result.
5. Actual result, screenshot and console/network error where relevant.
6. Whether the failure occurred in the browser test double, clean PostgreSQL test, or live staging.

Do not include secrets, private exports, customer data, access tokens or database credentials in screenshots, logs or GitHub comments.
