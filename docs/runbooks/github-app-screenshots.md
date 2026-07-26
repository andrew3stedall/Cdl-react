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

Before capturing images, the workflow exercises one primary team-selection journey in Chromium at the mobile viewport:

1. Open `/team-selection` and confirm the initial loaded status.
2. Move Alex Keeper from the starting lineup to the bench.
3. Attempt to save and confirm the invalid-lineup feedback.
4. Restore Alex Keeper to the starting lineup.
5. Save again and confirm the validated-success feedback.

This verifies that rendered controls, React state transitions, validation feedback, and accessible labels work together in a real browser. It remains a deterministic frontend check; it does not yet prove API persistence.

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

## Automated layout checks

Before each screenshot is written, the capture script verifies that:

- the route renders a `main` landmark;
- the document does not have horizontal overflow at the selected viewport; and
- web fonts have finished loading.

A failed check fails the workflow and identifies the route and viewport. These checks are deliberately narrow: they catch structural responsive regressions but do not replace manual design review, keyboard testing, or semantic accessibility testing.

## Scope and data

The workflow runs the Vite frontend locally inside GitHub Actions. API calls are fulfilled with deterministic representative fixtures inside the screenshot script, so this does not require GCP, Cloud SQL, staging infrastructure, production infrastructure, historical exports, or secrets.

The images prove that routes render consistently against the fixture contract. They do not prove live API integration or PostgreSQL persistence.

## Output

The workflow uploads PNG files as a GitHub Actions artifact named `app-screenshots`.
