# Feature: Application Shell, Navigation, and Visual Presets

## Purpose

Replace repeated legacy static headers, off-canvas panels, reload links, and global CSS-driven layout with a modern React application shell using shadcn/ui and configurable visual presets.

## Status

Implemented. The global shell, teal token system, authenticated profile route, and per-user appearance persistence are in place.

## Legacy Inventory

- Legacy pages repeat `headerMain` navigation with links for Squad Management, Team Selection, League, Rules, Dashboard, FDR, Scouting, Sign Out, and Reload.
- Pages rely on jQuery, Skel panels, `util.js`, `refreshPage.js`, and `assets/css/main.css`.
- Mobile panel behaviour is created imperatively in page-specific JavaScript.

## Current Behaviour

The application provides responsive shared navigation, manual reload, route-aware active state, an authenticated profile/preferences route, and account actions for profile access and sign out.

## Business Rules

- Authenticated users must access the same core navigation across the application.
- Active feature state must be visible.
- Scouting must be available from supported feature areas.
- Sign out must remain globally accessible.
- Users must be able to reach their profile and appearance preferences from the account controls.

## Risks

- Legacy layout behaviour may be encoded in global CSS and Skel panel configuration.
- Existing mobile interactions need regression testing.
- Visual identity must be preserved while enabling modern presets.

## Target Architecture

- React `AppShell` with route-aware navigation.
- shadcn/ui-inspired sidebar, sheet, card, button, select, navigation menu, and popover primitives.
- Theme preset provider for user-selectable look and feel.
- Python API endpoint for persisted user preferences if visual presets are saved server-side.
- Shared semantic tokens keep Teal as the primary colour in light and dark modes.

## API Requirements

- `GET /api/me/preferences`
- `PUT /api/me/preferences`
- Optional `GET /api/navigation` if menu items become role-driven.

## React Requirements

- Responsive app shell.
- Route-aware active state.
- Mobile navigation drawer.
- Theme preset selector.
- Shared reload or data refresh command where needed.

## UI Requirements

- shadcn/ui is mandatory for shell primitives unless an exception is documented.
- Presets must include Teal light/dark options and comfortable/compact density variants.
- Presets must define colour tokens, density, radius, typography scale, and chart palette hooks.
- Surfaces must avoid gradients, shadows, glows, and information-heavy colour highlighting.

## Data Access Requirements

- User preference repository if preferences are persisted.
- No client-side hard-coded user preference storage without documented fallback.

## Acceptance Criteria

- Users can navigate all modernised modules from a shared shell.
- Users can select a visual preset and see it applied consistently.
- Users can open Profile & preferences, inspect their authenticated account, change appearance, and sign out.
- Shell works on mobile and desktop.
- Active route state is clear.

## Test Requirements

- Unit tests for route and menu configuration.
- React integration tests for navigation and preset selection.
- Accessibility tests for keyboard navigation and drawer behaviour.
- Integration coverage for profile routing and preference persistence.

## Documentation Requirements

- Wiki page for shell layout, preset syntax, and example configuration.

## Changelog Requirements

- Add implementation changelog entry when the shell is built.
