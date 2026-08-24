# Application Shell, Navigation, and Visual Presets

## Purpose

The authenticated shell keeps global navigation deliberately small and reveals specialist tools only in the context where they are useful.

## Information architecture

The desktop sidebar and mobile bottom navigation expose four primary destinations:

- **Home** — dashboard and current gameweek performance.
- **Squad** — roster management, lineup, bench, captaincy, and chips.
- **Market** — player discovery, draw interests, and trade activity.
- **League** — fixtures, standings, knockout, and head-to-head records.

Contextual navigation appears beneath the header after a primary destination is selected:

- League: **Overview**, **Fixtures**, **Table**, **Knockout**, **Head-to-head**.

Market uses one page-level tab control for **Discovery**, **Interests**, and **Trades**;
fixture difficulty remains directly addressable at `/fdr` without occupying the Market
workflow.

Rules are a support utility rather than a permanent primary destination.

## Shell behaviour

`AppShell` provides:

- A compact sticky desktop sidebar with four primary items.
- A compact Managers Desk profile-image menu with Account and Sign out actions.
- A compact sticky header showing the current section and page rather than the generic “Application Shell” heading.
- A desktop account menu containing the authenticated identity, Account, and Sign out actions.
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

The account route is a compact summary of the current identity, workspace appearance, FDR colour scale, and attacking orientation. Detailed controls are available through the SPA subroutes `/account/appearance`, `/account/fdr`, and `/account/orientation`. Preferences continue to use `GET /api/me/preferences` and `PUT /api/me/preferences`, with the documented local-storage fallback.

Passkey setup is shown only when the authenticated user has no registered device credential. The account summary does not expose the manager role or account ID.

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
