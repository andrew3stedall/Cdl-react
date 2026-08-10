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

Before capturing images, the workflow exercises eight primary journeys in Chromium. Team selection, the protected session boundary, application-shell navigation, dashboard, dashboard recovery, and FDR run at both mobile and desktop widths; squad management runs at mobile width.

### Login

1. Open the protected Team Selection route without a session.
2. Confirm the Castle Draft League branding and labelled email and password fields render while authenticated navigation and protected controls remain hidden.
3. Submit invalid credentials and confirm the generic error does not reveal whether the email exists.
4. Submit the deterministic valid credentials through `POST /api/auth/login`.
5. Confirm the authenticated shell and Dashboard replace the credential form.
6. Sign out and confirm the branded login surface returns.
7. Repeat at mobile and desktop widths.

The login journey uses test-only credentials in the browser fixture. It verifies the existing API contract without storing a real credential or requiring GCP.

### Protected session boundary

1. Open the protected `/team-selection` route with the session endpoint returning an unauthenticated state.
2. Confirm the sign-in boundary renders while the authenticated shell remains hidden.
3. Confirm team-selection controls are not exposed.
4. Start authenticated, expire the deterministic session, and select Reload to revalidate it.
5. Confirm the shell and protected controls are withdrawn.
6. Restore the session response, select Retry session, and confirm the shell recovers.
7. Select Sign out, verify `POST /api/auth/logout`, and confirm the protected UI is withdrawn again.
8. Repeat at mobile and desktop widths before running the remaining journeys.

The normal runtime maps the backend's snake-case `/api/auth/session` contract into React session state; it no longer assumes a demo manager is authenticated. Reload revalidates the session, Retry session provides recovery after reauthentication, and Sign out calls `/api/auth/logout`. The explicit demo identity is limited to `VITE_STATIC_PREVIEW` builds.

### Application shell and league navigation

1. Open `/rules` and, on mobile, open the navigation sheet and verify its expanded state.
2. Navigate to `/league`, wait for deterministic standings data, and verify the active route and URL.
3. On mobile, confirm the navigation sheet closes after selection and can be reopened.
4. Navigate to `/dashboard` and verify its route and heading.
5. Use browser Back and confirm both the URL and rendered League page return.

### Team selection

1. Open `/team-selection` against the unlocked API fixtures and confirm both `/api/team-selection` and `/api/team-selection/fixtures-summary` are requested.
2. Confirm the CDL and EPL fixtures and table names render from the summary response.
3. Move Alex Keeper from the starting lineup to the bench.
4. Attempt to save and confirm the invalid-lineup feedback.
5. Restore Alex Keeper to the starting lineup.
6. Swap Ben Defender and Riley Forward while preserving a valid lineup, then save through `PUT /api/team-selection/lineup`.
7. Activate Wildcard through the chip API and confirm success feedback.
8. Reload the page and verify the saved slots and active chip are restored by the subsequent GET response.
9. Run this persistence journey at mobile and desktop widths.
10. Repeat at both widths with the API returning a fixture lock.
11. Confirm the lock reason renders in a labelled view-only notice and every lineup, chip, and save control is disabled.

### Market

1. Open `/scouting` and confirm the Market data status.
2. Confirm the single Market section navigation contains Discovery, Interests and Trades.
3. Search for Casey Midfielder and add the player to interests.
4. Confirm the interest list and open the player's detail dialog.
5. Verify the player summary, then close the dialog.
6. Open Trades and confirm proposed trade activity has its own focused view.

### Dashboard

1. Open `/dashboard` and wait for deterministic widget data.
2. Change the Team filter to Castle FC and verify the refreshed chart value.
3. Open the chart-point drill-down and verify its player row.
4. Close the drill-down and confirm it is removed.

### Dashboard recovery

1. Open `/dashboard` with the first deterministic widget request deliberately held open and confirm `Loading dashboard data` is exposed as a status message.
2. Release the request and confirm the initial chart renders.
3. Configure the next widget request to return an explicit synthetic backend failure.
4. Change the Team filter to River Rangers and confirm the API failure renders as an alert with a `Retry dashboard` control.
5. Confirm the River Rangers selection remains visible while the dashboard is in the error state.
6. Retry the dashboard, confirm the request recovers with River Rangers data, and verify the selected filter remains unchanged.
7. Repeat at mobile and desktop widths.

### Fixture difficulty ratings

1. Open `/fdr` and wait for the attack and defence views.
2. Change the Team filter to River Rangers.
3. Verify the browser sends the selected team in the API query.
4. Confirm both the filtered row and opponent fixture render.

These journeys verify that the session boundary, rendered controls, React state transitions, browser history, request contracts, loading and failure feedback, retry recovery, dialogs, links, and accessible labels work together in a real browser. They remain deterministic frontend checks; the team-selection and dashboard-recovery journeys exercise browser-to-API contracts, but mocked responses do not prove PostgreSQL persistence.

## Captured routes

- `/login` in an unauthenticated browser context with deterministic Google Identity Services rendering
- `/`
- `/league`
- `/dashboard`
- `/fdr`
- `/scouting`
- `/squad-management`
- `/team-selection`

## Viewports

Every route is captured at three named breakpoints:

| Name | Viewport | Purpose |
| --- | --- | --- |
| `mobile` | 390 × 844 at 2× scale | Common phone layout and touch-oriented navigation |
| `tablet` | 768 × 1024 | Intermediate responsive behaviour |
| `desktop` | 1440 × 900 | Primary desktop information hierarchy |

The artifact groups PNG files into `mobile/`, `tablet/`, and `desktop/` directories. This produces 21 screenshots per run.

## Automated layout and accessibility checks

Before each screenshot is written, the capture script verifies that:

- the route renders a `main` landmark;
- the document does not have horizontal overflow at the selected viewport;
- web fonts have finished loading;
- axe-core reports no WCAG 2.0/2.1 A or AA violations with serious or critical impact; and
- pressing Tab reaches a visible, named element that matches `:focus-visible`.

The checks run for every route at mobile, tablet, and desktop widths. A failure identifies the route, viewport, rule, and affected target where available. This automated gate does not replace manual screen-reader, complete keyboard-journey, contrast judgment, touch-target, or reduced-motion testing.

## Scope and data

The workflow runs the Vite frontend locally inside GitHub Actions. API calls are fulfilled with deterministic representative fixtures inside the browser scripts, so this does not require GCP, Cloud SQL, staging infrastructure, production infrastructure, historical exports, or secrets.

The images and browser journeys prove that routes render and recover consistently against the synthetic fixture contract. They do not prove live API integration or PostgreSQL persistence.

## Output

The workflow uploads PNG files as a GitHub Actions artifact named `app-screenshots`.
