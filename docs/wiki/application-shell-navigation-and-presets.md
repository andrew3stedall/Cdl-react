# Application Shell, Navigation, and Visual Presets

## Purpose

The authenticated shell keeps global navigation deliberately small and reveals specialist tools only in the context where they are useful.

## Information architecture

The desktop sidebar and mobile bottom navigation expose four primary destinations:

- **Desk** — urgency-led manager actions and current gameweek context.
- **Squad** — season-long squad health, lineup, bench, captaincy, and chips.
- **Market** — player discovery, draw Interests, and trade activity.
- **League** — fixtures, standings, knockout, and head-to-head records.

Contextual navigation appears beneath the header after a primary destination is selected:

- Market: **Discovery**, **Interests**, **Trades**, **Fixture difficulty**.
- League: **Overview**, **Fixtures**, **Table**, **Knockout**, **Head-to-head**.

Rules are a support utility rather than a permanent primary destination.

Profile & preferences is an authenticated account utility. It is available from the desktop account menu, the mobile Managers Desk account section, and support navigation.

## Shell behaviour

The authenticated shell and Managers Desk provide:

- A compact sticky desktop sidebar with four primary items.
- A mobile Managers Desk account section with appearance, refresh, profile, and sign-out controls.
- A compact sticky header showing the current section and page rather than the generic “Application Shell” heading.
- A desktop account menu containing the authenticated identity, visual preset, manual refresh count, and sign-out action.
- A Profile & preferences route with account identity, appearance selection, save feedback, and sign-out.
- A horizontally scrollable contextual navigation row that does not duplicate every subroute in the global sidebar.
- A persistent bottom navigation drawer for mobile primary destinations.

## Navigation configuration

Navigation is configured in `frontend/src/navigation.ts` through:

- `primaryNavigationItems`
- `contextualNavigationSections`
- `utilityNavigationItems`

`getContextNavigation` attaches specialist routes to the correct primary destination. `getActiveContextItem` selects the most specific nested route, preventing the League overview item from remaining active on `/league/table` or another deeper route.

The root route is the canonical Desk landing page. `/dashboard` remains an analytics compatibility route, and `/squad-management` / `/team-selection` remain aliases for the unified Squad workspace.

## Visual presets

Presets remain configured in `frontend/src/theme-presets.ts`:

- `teal-light`
- `teal-dark`
- `teal-light-compact`
- `teal-dark-compact`

All presets use the same restrained Teal semantic token system. Light/dark mode and density are explicit preset choices, while shared surfaces use shadcn-style Card, Button, Select, and Popover guidance. The global system intentionally avoids shadows, glows, gradients, and coloured information highlighting. Preferences continue to use `GET /api/me/preferences` and `PUT /api/me/preferences`, with legacy names normalized in the frontend and the documented local-storage fallback.

## Accessibility and responsive behaviour

- Primary, contextual, and support navigation use separate labelled landmarks.
- Active routes expose `aria-current="page"`.
- Mobile primary navigation remains available in the persistent bottom navigation drawer.
- Navigation links and account actions retain minimum touch-target sizing.
- Contextual navigation scrolls within its own region instead of expanding the document width.
- The mobile Managers Desk account section keeps account actions within the page flow and within reach of the bottom navigation.

## Validation

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
npm run typecheck
node ../scripts/test-app-interactions.mjs
```
