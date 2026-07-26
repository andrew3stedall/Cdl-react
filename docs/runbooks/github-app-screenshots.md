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

Before capturing images, the workflow exercises two primary journeys in Chromium at the mobile viewport.

### Team selection

1. Open `/team-selection` and confirm the initial loaded status.
2. Move Alex Keeper from the starting lineup to the bench.
3. Attempt to save and confirm the invalid-lineup feedback.
4. Restore Alex Keeper to the starting lineup.
5. Save again and confirm the validated-success feedback.

### Squad management

1. Open `/squad-management` and confirm the squad-loaded status.
2. Search for Casey Midfielder and add the player to interests.
3. Confirm the interest list and open the player's detail dialog.
4. Verify the player summary, then close the dialog.
5. Propose a sample trade and confirm its Trade Window rules link.

These journeys verify that rendered controls, React state transitions, validation feedback, dialogs, links, and accessible labels work together in a real browser. They remain deterministic frontend checks; they do not yet prove API persistence.

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
