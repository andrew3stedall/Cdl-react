# Global Teal design system and profile preferences

Date: 2026-08-09

## Added

- Added an authenticated Profile & preferences route with account details, appearance choices,
  save feedback, and sign-out.
- Added Teal light, Teal dark, and compact density variants as the shared global presets.

## Changed

- Applied shadcn-style semantic surface tokens across the application shell, login, dashboard,
  squad, team selection, fixture difficulty, and supporting pages.
- Removed decorative gradients, shadows, glows, and coloured information highlighting from the
  frontend style system.
- Kept existing preference persistence and local fallback behaviour without adding a database
  migration; legacy preference names resolve to the new Teal presets.

## Validation

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run pytest` — 337 passed, 18 skipped.
- `npm run lint`
- `npm run typecheck`
- `npm run test` — 58 passed.
- `npm run build`
