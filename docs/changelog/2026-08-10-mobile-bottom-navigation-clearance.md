# Mobile bottom navigation clearance — 2026-08-10

## User-facing change

- Reserved the full fixed bottom-navigation height, including the device safe-area inset, at the end of every authenticated mobile page.
- Kept the navigation bar and page clearance on one shared sizing contract so the last content row is not hidden behind the drawer.
- Corrected the navigation bar's horizontal safe-area padding for notched devices.

## Validation

- Mobile browser interaction coverage checks the navigation geometry and content clearance on the Managers Desk, League, Dashboard, FDR, Market, Squad, and Team Selection routes.
- Frontend lint, typecheck, build, and focused shell/navigation tests passed.
