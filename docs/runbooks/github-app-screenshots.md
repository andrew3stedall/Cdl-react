# GitHub App Screenshot Artifacts

The `App Screenshots` workflow lets you see the current app UI from GitHub without deploying staging or production.

## How to run it

1. Open the repository in GitHub.
2. Go to **Actions**.
3. Select **App Screenshots**.
4. Select **Run workflow**.
5. Open the completed run.
6. Download the `app-screenshots` artifact.

## Captured routes

- `/`
- `/league`
- `/dashboard`
- `/fdr`
- `/squad-management`
- `/team-selection`

## Scope

The workflow uses the Vite frontend locally inside GitHub Actions and captures mobile-sized screenshots. API calls are mocked inside the screenshot script so this does not require GCP, Cloud SQL, staging infrastructure, production infrastructure, or secrets.

## Output

The workflow uploads PNG files as a GitHub Actions artifact named `app-screenshots`.
