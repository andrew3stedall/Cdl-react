# Application Shell, Navigation, and Visual Presets

## Purpose

The application shell replaces repeated legacy headers, mobile panels, reload links, and global layout scripts with one React shell for authenticated Castle Draft League screens.

## Shell Layout

`AppShell` provides:

- Desktop sidebar navigation.
- Mobile drawer navigation using a sheet-style primitive.
- Shared header actions for reload, scouting, preset selection, and sign out.
- Authenticated session summary.
- Shared feature content region for modern modules.

## Navigation Syntax

Navigation is configured in `frontend/src/navigation.ts`.

```ts
export const primaryNavigationItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    featureKey: 'dashboard',
  },
];
```

Routes use `isRouteActive(currentPath, item.href)` so nested feature paths inherit the parent active state.

## Visual Preset Syntax

Presets are configured in `frontend/src/theme-presets.ts` and must include:

- `name`
- `label`
- `isDefault`
- colour tokens
- density
- radius
- typography scale
- chart palette hooks

Supported presets:

- `classic`
- `dark`
- `compact`

## Preference API

The shell coordinates with the backend preference contract through:

```http
GET /api/me/preferences
PUT /api/me/preferences
```

Example response:

```json
{
  "theme_preset": "classic"
}
```

The React preference client first attempts the API. If the endpoint is unavailable, it falls back to documented local storage using `cdl-theme-preset` so shell behaviour remains usable during parallel backend work.

## Cross-Feature Behaviour

- Authenticated shell content is guarded by the auth/session helpers from issue #2.
- Rules content from issue #8 is rendered inside the shared shell so the rules surface inherits navigation and preset behaviour.
- Scouting remains globally accessible from the shell header and supported navigation entries.
- The visual preset is applied through CSS variables so dense tables, charts, and forms can consume shared tokens rather than hard-code styling.
- The preference API is intentionally narrow to avoid conflicting with broader backend platform contracts from issue #4.

## Testing

Coverage added for issue #3:

- Unit tests for navigation configuration and active route matching.
- React integration tests for authenticated shell rendering, mobile drawer behaviour, active route changes, preset persistence, and unauthenticated shell blocking.
- Backend integration tests for preference API round trip.
- Service tests for preference defaults, persistence, and unsupported preset fallback.

## Validation Commands

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
```

The feature document remains in `docs/features/active/` until validation passes in CI.
