# GitHub App Screenshot Artifacts

The `App Screenshots` workflow provides repeatable visual evidence of the current application without deploying staging or production.

## How to run it

1. Open the repository in GitHub.
2. Go to **Actions**.
3. Select **App Screenshots**.
4. Select **Run workflow**.
5. Open the completed run.
6. Download the `app-screenshots` artifact.

The workflow also runs on pull requests so layout regressions are caught before merge.

## Browser interaction check

Before capturing images, the workflow exercises six primary journeys in Chromium. Team selection and squad management run at the mobile viewport; the protected session boundary, application-shell navigation, dashboard, and FDR run at both mobile and desktop widths.

### Protected session boundary

1. Open the protected `/team-selection` route with the session endpoint returning an unauthenticated state.
2. Confirm the sign-in boundary renders while the authenticated shell remains hidden.
3. Confirm team-selection controls are not exposed.
4. Repeat at mobile and desktop widths before running the authenticated journeys.

The normal runtime resolves `/api/auth/session`; it no longer assumes a demo manager is authenticated. The explicit demo identity is limited to `VITE_STATIC_PREVIEW` builds.

### Application shell and league navigation

1. Open `/rules` and, on mobile, open the navigation sheet and verify its expanded state.
2. Navigate to `/league`, wait for deterministic standings data, and verify the active route and URL.
3. On mobile, confirm the navigation sheet closes after selection and can be reopened.
4. Navigate to `/dashboard` and verify its route and heading.
5. Use browser Back and confirm both the URL and rendered League page return.

### Team selection

1. Open `/team-selection` against the unlocked API fixture and confirm the loaded status.
2. Move Alex Keeper from the starting lineup to the bench.
3. Attempt to save and confirm the invalid-lineup feedback.
4. Restore Alex Keeper to the starting lineup.
5. Save through `PUT /api/team-selection/lineup` and confirm the API-backed success feedback.
6. Repeat at mobile and desktop widths with the API returning a fixture lock.
7. Confirm the lock reason renders in a labelled view-only notice and every lineup, chip, and save control is disabled.

### Squad management

1. Open `/squad-management` and confirm the squad-loaded status.
2. Search for Casey Midfielder and add the player to interests.
3. Confirm the interest list and open the player's detail dialog.
4. Verify the player summary, then close the dialog.
5. Propose a sample trade and confirm its Trade Window rules link.

### Dashboard

1. Open `/dashboard` and wait for deterministic widget data.
2. Change the Team filter to Castle FC and verify the refreshed chart value.
3. Open the chart-point drill-down and verify its player row.
4. Close the drill-down and confirm it is removed.

### Fixture difficulty ratings

1. Open `/fdr` and wait for the attack and defence views.
2. Change the Team filter to River Rangers.
3. Verify the browser sends the selected team in the API query.
4. Confirm both the filtered row and opponent fixture render.

These journeys verify that the session boundary, rendered controls, React state transitions, browser history, request contracts, validation feedback, dialogs, links, and accessible labels work together in a real browser. They remain deterministic frontend checks; the team-selection journey exercises the browser-to-API contract, but mocked responses do not prove PostgreSQL persistence.

## Captured routes

- `/`
- `/league`
- `/dashboard`
- `/fdr`
- `/squad-management`
- `/team-selection`

## Viewports

Every route is captured at three named breakpoints:

| Name | Viewport | Purpose |
| --- | --- | --- |
| `mobile` | 390 × 844 at 2× scale | Common phone layout and touch-oriented navigation |
| `tablet` | 768 × 1024 | Intermediate responsive behaviour |
| `desktop` | 1440 × 900 | Primary desktop information hierarchy |

The artifact groups PNG files into `mobile/`, `tablet/`, and `desktop/` directories. This produces 18 screenshots per run.

## Automated layout and accessibility checks

Before each screenshot is written, the capture script verifies that:

- the route renders a `main` landmark;
- the document does not have horizontal overflow at the selected viewport;
- web fonts have finished loading;
- axe-core reports no WCAG 2.0/2.1 A or AA violations with serious or critical impact; and
- pressing Tab reaches a visible, named element that matches `:focus-visible`.

The checks run for every route at mobile, tablet, and desktop widths. A failure identifies the route, viewport, rule, and affected target where available. This automated gate does not replace manual screen-reader, complete keyboard-journey, contrast judgment, touch-target, or reduced-motion testing.

## Scope and data

The workflow runs the Vite frontend locally inside GitHub Actions. API calls are fulfilled with deterministic representative fixtures inside the screenshot script, so this does not require GCP, Cloud SQL, staging infrastructure, production infrastructure, historical exports, or secrets.

The images prove that routes render consistently against the fixture contract. They do not prove live API integration or PostgreSQL persistence.

## Output

The workflow uploads PNG files as a GitHub Actions artifact named `app-screenshots`.
