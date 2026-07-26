# 2026-07-26 — Multi-viewport App Screenshots

## Summary

Expanded the repository-safe application screenshot workflow from a single mobile viewport to mobile, tablet, and desktop evidence.

## Added

- Named 390 × 844 mobile, 768 × 1024 tablet, and 1440 × 900 desktop captures.
- Route-by-viewport artifact directories containing 18 screenshots per run.
- Automated checks for a `main` landmark and horizontal overflow before each screenshot.
- Font readiness waiting to reduce inconsistent captures.
- Documentation contract coverage for the viewport and layout-safety requirements.
- Keyboard-focusable horizontal-scroll regions for league tables on narrow screens.
- Compact two-line player rows for team selection on mobile and tablet layouts.
- Chromium interaction coverage for invalid and restored-valid team-selection saves.
- Chromium interaction coverage for squad search, interests, player detail, and trade proposal rules.
- Axe-core gates for serious and critical WCAG 2.0/2.1 A/AA violations across every captured route and viewport.
- Keyboard focus checks that require the first Tab target to be visible, named, and matched by `:focus-visible`.
- Mobile and desktop Chromium journeys for dashboard filtering/drill-down and FDR team filtering.
- Mobile and desktop application-shell navigation coverage, including the mobile sheet, active-route state, URL changes, and browser Back.
- Mobile and desktop protected-route coverage driven by authenticated and unauthenticated `/api/auth/session` responses.
- Primary team-selection API fixture-lock reporting and mutation enforcement backed by the PostgreSQL lock table.
- API-backed React team-selection loading, saves, chip updates, and locked view-only rendering.
- Mobile and desktop browser coverage proving locked lineup, chip, and save controls cannot be used.
- API-backed CDL/EPL fixture and table summaries replacing React placeholder copy.

## Validation finding

The first multi-viewport run detected a real document-level overflow on `/league` at 390 px. League fixture and standings tables now retain their columns inside labelled, focusable scroll regions instead of widening the document.

The subsequent artifact review found that team-selection player rows stacked all four table cells vertically below 900 px, making the mobile page unnecessarily long and difficult to scan. The responsive row now keeps the player and movement control together, with position and team metadata on a compact second line; semantic table roles and column headers remain available to assistive technology.

The first axe-core run found that the dashboard chart used `role="img"` while containing drill-down buttons. The chart is now a labelled interactive group, so assistive technology can reach its controls.

The next scan found that the two horizontally scrollable FDR tables could not receive keyboard focus. Both are now labelled regions in the tab order with a visible focus treatment.

The desktop scan then found insufficient contrast for the active navigation item's secondary text. Interactive navigation states now use a darker secondary colour against the selected background.

The shell navigation journey then found that browser Back changed the URL without changing the rendered route. The app now listens for `popstate`, synchronises the rendered path with browser history, and closes the mobile navigation sheet on history traversal.

The session-boundary audit then found that the normal runtime implicitly authenticated a hard-coded demo manager. The app now resolves `/api/auth/session`, shows a loading boundary while that request is pending, and withholds protected routes and navigation when unauthenticated. The demo identity is now explicit and limited to static-preview builds.

The fixture-lock trace found that PostgreSQL stored lock records but the primary team-selection service did not read or enforce them. The API now exposes lock metadata and rejects lineup and chip mutations with a structured `409 conflict` before persistence. The React page now consumes that contract, shows the backend lock reason, and disables every mutation control. Mobile and desktop browser journeys prove the locked view-only boundary.

The fixture-summary trace then found that the API already exposed CDL/EPL fixture and table context while React still displayed hard-coded names. The page now requests `/api/team-selection/fixtures-summary`, maps its contract, and renders the returned fixtures and tables; browser coverage verifies both the request and distinctive response content.

## Browser interaction evidence

The same repository-safe workflow now moves a starter to the bench, confirms invalid-lineup feedback, restores the starter, saves through the mocked API contract, and confirms successful validation through the rendered controls in Chromium. Separate mobile and desktop journeys return a fixture lock and verify the reason, view-only notice, and disabled lineup, chip, and save controls.

It also searches for a squad target, adds the player to interests, verifies the player-detail dialog, creates a sample trade proposal, and checks the Trade Window rules link.

Session-boundary coverage now proves that an unauthenticated response keeps the shell and protected team-selection controls hidden at mobile and desktop widths. The remaining authenticated journeys prove successful session bootstrap.

Application-shell coverage now opens and closes the mobile navigation sheet, navigates between Rules, League, and Dashboard, verifies active-route and URL state, and confirms browser Back restores the rendered League page at mobile and desktop widths.

Dashboard coverage now changes the team filter, verifies refreshed chart data, opens the drill-down, checks its player row, and closes it. FDR coverage sends a team-filter query and verifies the filtered row and fixture at both mobile and desktop widths.

## Scope

The workflow continues to use deterministic mocked API fixtures. It does not deploy infrastructure, use secrets, require historical exports, or prove live PostgreSQL integration.

## Related work

- Issue #96: Finalise implementation, design and testing readiness.
