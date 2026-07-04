# GitHub Codespaces Preview

Use Codespaces when you want to interact with the CDL React app from GitHub without installing Python, Node, uv, or npm dependencies on your own machine.

## Open a Codespace

1. Open the repository in GitHub.
2. Select **Code**.
3. Select the **Codespaces** tab.
4. Select **Create codespace on main**.
5. Wait for the devcontainer setup to finish.

The devcontainer installs Python 3.12, Node 22, GitHub CLI, uv, backend dependencies, and frontend dependencies.

## Start the backend

Open a terminal in Codespaces and run:

```bash
uv run uvicorn cdl_api.app:app --host 0.0.0.0 --port 8000 --reload
```

The API is forwarded on port `8000`.

## Start the frontend

Open a second terminal and run:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

The frontend is forwarded on port `5173`. Codespaces should show an **Open in Browser** prompt for the frontend port.

## View the app

Open the forwarded `5173` URL. Try these routes:

- `/`
- `/league`
- `/dashboard`
- `/fdr`
- `/squad-management`
- `/team-selection`

## Repository mode

By default, the app uses in-memory/sample data. Do not switch Codespaces to PostgreSQL mode unless you deliberately configure a database URL.

## Stop costs

Codespaces usage is metered. When you finish previewing the app, stop or delete the Codespace from the Codespaces page.
