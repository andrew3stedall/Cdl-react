# GitHub Pages Static Preview

Use GitHub Pages when you want a public static preview link for the CDL React frontend.

## What this publishes

The Pages workflow publishes a static Vite build of the frontend. It does not run the FastAPI backend, connect to a database, use GCP, or require secrets.

The static preview uses sample clients for league, dashboard, and FDR data so the key pages can render without API calls.

## One-time GitHub setting

1. Open the repository in GitHub.
2. Go to **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.

## Publish manually

1. Open **Actions**.
2. Select **GitHub Pages**.
3. Select **Run workflow**.
4. Run it from `main`.
5. Open the completed workflow run.
6. Use the Pages URL shown in the `publish` job.

Expected URL shape:

```text
https://andrew3stedall.github.io/Cdl-react/
```

## Routes to review

- `/`
- `/league`
- `/dashboard`
- `/fdr`
- `/squad-management`
- `/team-selection`

Direct links use a `404.html` fallback copied from the built `index.html`, so Pages can reload deep routes.

## Safety notes

- This is public because the repository is public.
- Do not put real user data or secrets into static preview clients.
- Treat this as a demo preview, not production.
