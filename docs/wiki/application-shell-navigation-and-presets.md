# Application Shell, Navigation, and Visual Presets

## Purpose

The authenticated shell keeps global navigation deliberately small and reveals specialist tools only in the context where they are useful.

## Information architecture

The desktop sidebar and mobile bottom navigation expose four primary destinations:

- **Overview** — dashboard and current gameweek performance.
- **Squad** — roster management, scouting, and fixture difficulty.
- **Team** — lineup, bench, captaincy, and chips.
- **League** — fixtures, standings, knockout, and head-to-head records.

Contextual navigation appears beneath the header after a primary destination is selected:

- Squad: **My squad**, **Scouting**, **Fixture difficulty**.
- League: **Overview**, **Fixtures**, **Table**, **Knockout**, **Head-to-head**.

Rules are a support utility rather than a permanent primary destination.

## Shell behaviour

`AppShell` provides:

- A compact sticky desktop sidebar with four primary items.
- A mobile-only account section on Managers Desk with appearance, profile and preferences, refresh, and sign-out controls.
- A compact sticky header showing the current section and page rather than the generic “Application Shell” heading.
- A desktop account menu containing the authenticated identity, visual preset, manual refresh count, and sign-out action.
- A horizontally scrollable contextual navigation row that does not duplicate every subroute in the global sidebar.
- A persistent bottom navigation bar for mobile global destinations.

## Navigation configuration

Navigation is configured in `frontend/src/navigation.ts` through:

- `primaryNavigationItems`
- `contextualNavigationSections`
- `utilityNavigationItems`

`getContextNavigation` attaches specialist routes to the correct primary destination. `getActiveContextItem` selects the most specific nested route, preventing the League overview item from remaining active on `/league/table` or another deeper route.

The root route is treated as the Overview alias and authenticated sign-in redirects to `/dashboard`.

## Visual presets

Presets remain configured in `frontend/src/theme-presets.ts`:

- `classic`
- `dark`
- `compact`

The preset selector has moved from the global action row into the desktop account menu and the mobile Managers Desk account section. Preferences continue to use `GET /api/me/preferences` and `PUT /api/me/preferences`, with the documented local-storage fallback.

## Accessibility and responsive behaviour

- Primary, contextual, and support navigation use separate labelled landmarks.
- Active routes expose `aria-current="page"`.
- Mobile global navigation is a labelled bottom navigation landmark.
- Navigation links and account actions retain minimum touch-target sizing.
- Contextual navigation scrolls within its own region instead of expanding the document width.
- The mobile account section exposes labelled account actions and an expandable profile summary.

## Validation

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
node ../scripts/test-app-interactions.mjs
```
