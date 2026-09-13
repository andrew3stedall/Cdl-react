# Changelog

## Unreleased

- Replaced the plain initial session-checking card with a full-screen,
  default-teal Castle Draft League splash screen with a white CDL logo and a
  clear retry state when session verification is unavailable.

- Refined the League fixture carousel by removing the redundant primary-fixture
  gameweek label, matching its padding to supporting fixtures, applying the
  restrained Desk-style highlight, and aligning gameweek dots with the round
  heading.

- Fixed player profile fixture detail sheets so the fixed mobile navigation no
  longer covers their content and touch scrolling stays inside the sheet.

- Expanded the protected staging reviewer workflow to three accounts and mapped the third reviewer to Bayer Neverlusen in the synthetic staging draft seed.

- Replaced the League fixtures and gameweek pickers with shadcn-style Embla
  carousels: rounds move horizontally without looping, gameweeks move vertically
  without looping, and each slide fades with opacity while keeping every fixture
  in the selected gameweek visible.
- Widened the round slides while tightening the spacing between them and added
  one filled-or-hollow navigation dot per round below the carousel.
- Added matching terminal insets so the first and last rounds centre on the
  same focal line when selected.
- Increased the round slide width again after adding terminal insets so the
  centred edge slides retain the intended wider card treatment.
- Tightened the horizontal space between round cards so more of the adjacent
  round remains visible at the viewport edge.
- Added a small slide overlap to bring adjacent round cards closer together
  without changing their width or terminal centering.
- Increased the slide overlap to 0.4rem per side for a more visible adjacent
  round peek.
- Smoothed the nested gameweek carousel with a longer settle duration, centred
  its slides so adjacent weeks peek above and below, and added horizontal
  per-round gameweek navigation dots.
- Corrected gameweek tweening to map each slide directly to its Embla snap and
  kept the selected navigation dot tied to the same in-round gameweek index.
- Stabilized nested gameweek initialization and scroll synchronization so the
  selected card, its transform, and its in-round navigation dot stay aligned.
- Kept the vertical Embla track at the viewport height so the first gameweek
  remains in view instead of being translated below the clipped carousel.
- Opened each round on its first gameweek so the initial card starts centered
  at full focus and can be scrolled forward through the round.
- Nested each round's gameweek carousel inside its round slide, preserved the
  relative gameweek index between rounds, and moved compact navigation controls
  onto the carousel rails.
- Split League fixture rendering into reusable round, gameweek, and fixture
  components without changing fixture drawer or scoring behaviour.
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
- Reused the fixture pitch, substitute, and reserve structure for completed
  gameweeks, showing gameweek points with the Squad form-dot treatment and
  revealing current-gameweek points only after each player's fixture kickoff.
- Changed League player taps so current and previous gameweeks open that
  gameweek's scoring breakdown, while future gameweeks keep the read-only
  player profile.
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
- Added a typed Squad API client for summary, scouting, trades, changes, notifications and cached FPL player history.
- Added the official current FPL shirt artwork mapping for all 20 2026/27 clubs, with the existing local SVGs retained as fallbacks.
- Extended browser interaction fixtures to cover squad changes, notifications and player-history API calls.

### Changed

- Wired the canonical Squad profile drawer to official FPL history and upcoming fixtures.
- Wired Trade submission to `POST /api/trades` and validated the selected manager/team on the backend.
- Replaced silent API fallbacks and visible endpoint placeholders with explicit states and source-backed values.
- Added real availability and next-fixture filters to List view.

### Validation

- Added coverage for the official FPL asset URL used by the Squad surface and kept lineup/substitution regression coverage green.

## 2026-08-04 - Serve the staged snake draft through application APIs

### Fixed

- Replaced the Squad Management page's hard-coded player list with the PostgreSQL-backed squad
  summary and scouting API responses.
- Made PostgreSQL team selection read Exeter Gently's 20 active ownerships for the staged
  2026/27 season instead of the five-player in-memory demo roster.
- Scoped league and dashboard reads to the eight teams in the staged CDL season, hiding unrelated
  legacy synthetic fixtures, scores and dashboard points while no current results exist.
- Removed request-time repository seeding so ordinary API and session requests are read-only and
  cannot recreate demo data or open avoidable Cloud SQL connections.

### Validation

- Added regression coverage for the 20-player staged team-selection roster, active-team dashboard
  filters, empty pre-season standings and removal of the obsolete sample trade action.

## 2026-08-02 - Add allowlisted Google sign-in for staging

### Added

- Added an official Google Identity Services sign-in path that verifies Google ID tokens on the
  API and permits only the configured exact email allowlist.
- Reused the existing PostgreSQL user and session tables so Cloud Run instances share the same
  secure application session without storing Google access or refresh tokens.
- Added Terraform-managed Secret Manager containers for the OAuth client ID and email allowlist.
- Added a reviewed, plan-manifest-bound enable switch so Cloud Run does not reference those
  secrets until their first versions exist.

### Security

- Bound Google credentials to the exact configured OAuth client audience, required a
  Google-verified email, and required a same-origin custom request header.
- Kept the shared staging password only as a temporary fallback and left production identity,
  IAM and real-data access out of scope.

## 2026-08-02 - Add phone-browser staging access boundary

### Added

- Added a staging-only global session boundary for all non-authentication API routes and API
  schema routes while keeping the React login bootstrap and health check reachable.
- Added an explicit `application-login` runtime access model to the reviewed Terraform plan
  and apply workflows, including exact manifest, approval phrase, IAM, and live-policy checks.

### Security

- Limited the public-plan exception to `allUsers` with `roles/run.invoker` on the single
  Terraform-managed staging Cloud Run service; all other public IAM remains fail-closed.
- Switched the shared staging password check to constant-time comparison and documented that
  this synthetic-data review control is not a production identity system.
- Made staging startup fail closed when the known development login secret has not been
  replaced by the configured Secret Manager value.

### Validation

- Added API boundary, exact public-IAM exception, plan-manifest, and workflow contract tests.

## 2026-08-02 - Fix staging database job image verification

### Fixed

- Read the configured container image from the Cloud Run v1 job structure
  returned by `gcloud run jobs describe` instead of an empty v2-style path.
- Restricted execution to immutable digests from the expected staging project
  and `cdl-react-backend/cdl-react-app` repository.

### Validation

- Added regression coverage for the correct nested image field, expected
  repository boundary and rejection of the previous incorrect field path.
- Recorded migration workflow run `30738978829` as the fail-closed evidence;
