# Changelog

## Unreleased

- Reworked League fixtures into five chronological seven-gameweek rounds with a
  horizontal carousel, a focused live/current gameweek, and compact in-round
  gameweek browsing for upcoming and past results.
- Added historical fixture squad detail from locked lineups and cached
  gameweek points, including starters, substitutes, reserves, and captain
  markers.
- Extracted reusable fixture pitch and roster parents, separated each Starting
  XI into its own contained pitch panel, equalised lineup spacing, enforced
  goalkeeper-first bench ordering, and removed opponent XI prediction UI.
- Corrected fixture pitch card containment by restoring the standard Squad
  player wrapper around each reusable `PlayerCard`.
- Added a Tauri 2 Android shell and reproducible debug APK workflow around the existing React frontend.
- Kept the existing FastAPI/PostgreSQL Cloud Run service as the backend; staging APK builds open the deployed staging app to preserve same-origin cookie authentication.
- Match points-against labels to their attacking/defensive bar colours, keep them clear of the bars, and use the result-track colour for empty chart slots.
- Reworked the account page into a compact summary with navigable appearance, FDR colour, and attacking-orientation settings subpages.
- Added an opt-out device motion shortcut that opens Account after two deliberate forward-and-back shakes from any app page.
- Increased the shake shortcut sensitivity so moderate forward-and-back movements are sufficient.
- Hide device sign-in setup after a passkey is registered and remove manager role, account ID, and dedicated account-action content from the page.
- Added 30-day PostgreSQL-backed application sessions with secure persistent cookies.
- Added WebAuthn passkey registration and sign-in for device Face ID, fingerprint, or PIN unlock.
- Added configurable Sign in with Apple support while retaining the allowlisted Google flow.

## 2026-08-22 - Finish player profile drawer spacing

### Fixed

- Kept the player-profile action bar in the drawer layout so it cannot cover the final chart card.
- Made grouped opposition bars thinner, separated, and left/right aligned within each fixture group.
- Kept attacking and defensive value labels inside their matching bar colours with compact sizing.

## 2026-08-22 - Complete player profile chart details

### Fixed

- Reserved the full fixed action-bar clearance in the player profile drawer so the final content can be scrolled into view.
- Added official FPL yellow-card and red-card history icons to the form chart.
- Added attacking and defensive value labels to each opposition points-against bar and kept its vertical scale at a minimum of 0–80 points.

## 2026-08-14 - Consolidate the Squad workspace read path

### Changed

- Replaced the Squad page's six-request initial load with a combined Squad
  workspace read plus the independent team-selection read.
- Deferred scouting-player and available-rights requests until their UI
  surfaces are opened.
- Reused the PostgreSQL player snapshot during a request so summary and
  attention reads do not repeat the full player/fixture query.
- Added a structured proposed-trade count to the notifications response so
  the Squad page no longer fetches the full trade list just to render its
  attention banner.

### Validation

- Added API and browser regression coverage for the workspace contract,
  request reduction, and lazy secondary data loading.

## 2026-08-13 - Make the app installable on Android

- Added an Android-installable web app manifest with standalone display mode,
  theme metadata, relative paths for root and GitHub Pages deployments, and
  maskable app icons.
- Added a production-only service worker that caches the app shell while
  deliberately bypassing API routes so league data is not served from a stale
  cache.
- Added mobile viewport and dynamic-height handling for standalone app windows.

## 2026-08-10 - Refresh the League competition workspace

- Reworked the League route into an overview-first competition workspace with
  focused Fixtures, Table, Knockout, and Head-to-head views.
- Added responsive fixture cards, status filtering, started-fixture detail
  drawers, table-source messaging, and explicit loading/error/empty states.
- Kept legacy migration operations outside the manager-facing League surface;
  ambiguous history remains governed by archive-only migration rules.

## 2026-08-10 - Refresh Market discovery workspace

### Added

- Added the modern Market page at `/scouting` with focused Discovery, Interests and Trades views.
- Added contextual Market navigation for Interests and Trades while retaining Fixture Difficulty as a Market-context tool.
- Added official-data player evidence, availability and next-fixture context with responsive player rows and detail drawer actions.

### Changed

- Replaced the legacy combined scouting/squad presentation with an acquisition-focused Market workflow.
- Removed the page-local mobile navigation so the global shell remains the single navigation source.
- Updated screenshot and browser journey contracts to exercise Market discovery and Interest persistence.

### Deliberate gaps

- Watchlist bookmarks, ranked Interest reordering, advanced threshold filters and full Trade Builder actions remain separate follow-up work.

## 2026-08-09 - Correct player availability flags

### Fixed

- Interpreted the official FPL `a` status as available rather than as an issue on Managers Desk and Squad.
- Removed positive availability markers from fit players; only reduced chances, injuries, suspensions and other actionable statuses are marked.
- Centralised availability interpretation so the dashboard count, list filter, pitch markers and player drawer use the same contract.

### Changed

- Added restrained warning/critical availability markers with percentage and status details available on hover and in the player drawer.

### Validation

- Added regression coverage for raw FPL available statuses, 100%/unknown chances, reduced chances, doubtful players and severe statuses.

## 2026-08-09 - Complete Squad API wiring and official FPL shirt assets

### Added

- Added next-opponent, home/away, kickoff and FDR enrichment from the persisted official FPL fixture cache.
- Added canonical Squad changes and notifications endpoints, including atomic temporary-right add/remove submission.
