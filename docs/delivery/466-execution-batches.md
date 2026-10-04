# All 70 audit findings — execution batches

Updated: 4 October 2026 (Australia/Melbourne). Parent [#466](https://github.com/andrew3stedall/Cdl-react/issues/466). This index covers every issue; an item being tackled is not a claim that its acceptance is complete.

## Batch 1 — current candidate

- Player identity and drawer controls render as soon as the player read completes; slower history has its own state (#518).
- Removed only proven unused Squad/League hero selectors; shared PageHero/gutter geometry remains authoritative (#486).
- Optional Profile, colour settings, Rules, invitation and engineering-preview modules load separately; core Desk/Squad/Market/League stay eager (#536). Measured initial compressed assets fall from 210.90 kB to 193.73 kB. This is an asset measurement, not a physical-phone speed result.
- PostgreSQL release journey now checks pre-assignment team read/write denial and invited-member logout/fresh login/revocation (#468/#469). The identity verifier is a controlled stub; the DB is real in CI.
- Existing fixes are being checked against exact issue acceptance before GitHub closure. No broad completion claim follows from green generic tests.

### What to review after the batch is deployed

1. Open a player from Market/Squad and directly through their player page. Their name and close control should appear while history is still loading; chart failure should not hide them.
2. Open Profile/Appearance, colour settings and Rules, then return to the four main pages. Look for working lazy loading and unchanged cached main navigation.
3. Check header/title/bell alignment on a narrow phone and in landscape; Market drawer actions should remain visible. The automated suite keeps its one-pixel invariants.

## Previously deployed fixes explained

| PR | Delivery | In-app review |
| --- | --- | --- |
| [#541](https://github.com/andrew3stedall/Cdl-react/pull/541) | Shared narrow-screen header/title/bell alignment, 200% text behavior, sticky Market drawer actions and rendered modal checks. | Check narrow portrait/landscape headers, zoomed text and drawer buttons. |
| [#542](https://github.com/andrew3stedall/Cdl-react/pull/542) | Validate the new immutable revision, tag/warm it at zero traffic, then require readiness, migrations and health/auth checks before promotion. | Deployment process change; no new app screen. |

## Evidence and limits

- Baseline `4a98d69`: staging [37135264135](https://github.com/andrew3stedall/Cdl-react/actions/runs/37135264135), CI [37135264249](https://github.com/andrew3stedall/Cdl-react/actions/runs/37135264249), PostgreSQL [37135264141](https://github.com/andrew3stedall/Cdl-react/actions/runs/37135264141) succeeded.
- Combined batch candidate: Ruff/format, 479 backend tests (24 external-service skips), frontend lint/typecheck and all 234 frontend tests pass. PostgreSQL and browser acceptance still require hosted CI before merge.
- Main Chromium suite passed 10 tests with two intentional desktop skips. Local Chromium download still returns an empty archive; no local or physical-device pass is claimed.
- No production release, destructive data reset, real-provider credential use, or dated restore/rollback proof is claimed.

## Every issue and current next action

| Issue | Current state / next action | Owning evidence |
| --- | --- | --- |
| [#467](https://github.com/andrew3stedall/Cdl-react/issues/467) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_auth_api.py](../../tests/test_auth_api.py) |
| [#468](https://github.com/andrew3stedall/Cdl-react/issues/468) | Batch 1: real PostgreSQL pre-assignment read/write denial assertion added | [tests/test_postgres_squad_api.py](../../tests/test_postgres_squad_api.py) |
| [#469](https://github.com/andrew3stedall/Cdl-react/issues/469) | Batch 1: invite/logout/fresh provider-policy login and revocation assertion added | [tests/test_auth_api.py](../../tests/test_auth_api.py) |
| [#470](https://github.com/andrew3stedall/Cdl-react/issues/470) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/App.tsx](../../frontend/src/App.tsx) |
| [#471](https://github.com/andrew3stedall/Cdl-react/issues/471) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/auth.test.ts](../../frontend/src/auth.test.ts) |
| [#472](https://github.com/andrew3stedall/Cdl-react/issues/472) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/ProfilePage.tsx](../../frontend/src/ProfilePage.tsx) |
| [#473](https://github.com/andrew3stedall/Cdl-react/issues/473) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeagueInvitePage.tsx](../../frontend/src/LeagueInvitePage.tsx) |
| [#474](https://github.com/andrew3stedall/Cdl-react/issues/474) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#475](https://github.com/andrew3stedall/Cdl-react/issues/475) | Partial: migrations/promotion deployed; signed-in hosted write verification remains | [scripts/cloud_run_staged_revision.py](../../scripts/cloud_run_staged_revision.py) |
| [#476](https://github.com/andrew3stedall/Cdl-react/issues/476) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [Dockerfile](../../Dockerfile) |
| [#477](https://github.com/andrew3stedall/Cdl-react/issues/477) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/market-page.css](../../frontend/src/market-page.css) |
| [#478](https://github.com/andrew3stedall/Cdl-react/issues/478) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/theme-presets.ts](../../frontend/src/theme-presets.ts) |
| [#479](https://github.com/andrew3stedall/Cdl-react/issues/479) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/theme-presets.test.ts](../../frontend/src/theme-presets.test.ts) |
| [#480](https://github.com/andrew3stedall/Cdl-react/issues/480) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/theme-presets.ts](../../frontend/src/theme-presets.ts) |
| [#481](https://github.com/andrew3stedall/Cdl-react/issues/481) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SessionSplash.tsx](../../frontend/src/SessionSplash.tsx) |
| [#482](https://github.com/andrew3stedall/Cdl-react/issues/482) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/ui/sheet.tsx](../../frontend/src/components/ui/sheet.tsx) |
| [#483](https://github.com/andrew3stedall/Cdl-react/issues/483) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/player](../../frontend/src/components/player) |
| [#484](https://github.com/andrew3stedall/Cdl-react/issues/484) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/player](../../frontend/src/components/player) |
| [#485](https://github.com/andrew3stedall/Cdl-react/issues/485) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/browser-tests/layout-invariants.spec.ts](../../frontend/browser-tests/layout-invariants.spec.ts) |
| [#486](https://github.com/andrew3stedall/Cdl-react/issues/486) | Batch 1: proven unused Squad/League header selectors removed | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#487](https://github.com/andrew3stedall/Cdl-react/issues/487) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#488](https://github.com/andrew3stedall/Cdl-react/issues/488) | Open: physical installed-PWA safe-area/keyboard/chrome checks | [frontend/browser-tests/layout-invariants.spec.ts](../../frontend/browser-tests/layout-invariants.spec.ts) |
| [#489](https://github.com/andrew3stedall/Cdl-react/issues/489) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_team_selection_service.py](../../tests/test_team_selection_service.py) |
| [#490](https://github.com/andrew3stedall/Cdl-react/issues/490) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_squad_service.py](../../tests/test_squad_service.py) |
| [#491](https://github.com/andrew3stedall/Cdl-react/issues/491) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_fpl_settlement.py](../../tests/test_fpl_settlement.py) |
| [#492](https://github.com/andrew3stedall/Cdl-react/issues/492) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#493](https://github.com/andrew3stedall/Cdl-react/issues/493) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_postgres_league_api.py](../../tests/test_postgres_league_api.py) |
| [#494](https://github.com/andrew3stedall/Cdl-react/issues/494) | Blocked: exact bonus criteria and award amounts still needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#495](https://github.com/andrew3stedall/Cdl-react/issues/495) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_postgres_trade_approval.py](../../tests/test_postgres_trade_approval.py) |
| [#496](https://github.com/andrew3stedall/Cdl-react/issues/496) | In progress: approved final league-rank tie-break; middle bracket path still needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#497](https://github.com/andrew3stedall/Cdl-react/issues/497) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_fpl_settlement.py](../../tests/test_fpl_settlement.py) |
| [#498](https://github.com/andrew3stedall/Cdl-react/issues/498) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-rules.md](../delivery/466-rules.md) |
| [#499](https://github.com/andrew3stedall/Cdl-react/issues/499) | In progress: approved Standard/Triple Captain zero-minute vice fallback | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#500](https://github.com/andrew3stedall/Cdl-react/issues/500) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#501](https://github.com/andrew3stedall/Cdl-react/issues/501) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#502](https://github.com/andrew3stedall/Cdl-react/issues/502) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/App.engineering-previews.test.tsx](../../frontend/src/App.engineering-previews.test.tsx) |
| [#503](https://github.com/andrew3stedall/Cdl-react/issues/503) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#504](https://github.com/andrew3stedall/Cdl-react/issues/504) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#505](https://github.com/andrew3stedall/Cdl-react/issues/505) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#506](https://github.com/andrew3stedall/Cdl-react/issues/506) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#507](https://github.com/andrew3stedall/Cdl-react/issues/507) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/data-freshness.test.ts](../../frontend/src/data-freshness.test.ts) |
| [#508](https://github.com/andrew3stedall/Cdl-react/issues/508) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#509](https://github.com/andrew3stedall/Cdl-react/issues/509) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/RulesWorkspacePage.tsx](../../frontend/src/RulesWorkspacePage.tsx) |
| [#510](https://github.com/andrew3stedall/Cdl-react/issues/510) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#511](https://github.com/andrew3stedall/Cdl-react/issues/511) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeagueCompetitionViews.tsx](../../frontend/src/LeagueCompetitionViews.tsx) |
| [#512](https://github.com/andrew3stedall/Cdl-react/issues/512) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/ui/global-notifications.tsx](../../frontend/src/components/ui/global-notifications.tsx) |
| [#513](https://github.com/andrew3stedall/Cdl-react/issues/513) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#514](https://github.com/andrew3stedall/Cdl-react/issues/514) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#515](https://github.com/andrew3stedall/Cdl-react/issues/515) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#516](https://github.com/andrew3stedall/Cdl-react/issues/516) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#517](https://github.com/andrew3stedall/Cdl-react/issues/517) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#518](https://github.com/andrew3stedall/Cdl-react/issues/518) | Batch 1: direct profile identity is no longer blocked by history fetch | [frontend/src/PlayerProfilePage.tsx](../../frontend/src/PlayerProfilePage.tsx) |
| [#519](https://github.com/andrew3stedall/Cdl-react/issues/519) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/navigation.test.ts](../../frontend/src/navigation.test.ts) |
| [#520](https://github.com/andrew3stedall/Cdl-react/issues/520) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_free_agency_draw_repository.py](../../tests/test_free_agency_draw_repository.py) |
| [#521](https://github.com/andrew3stedall/Cdl-react/issues/521) | In progress: configured-season draft delivered; independent league/season context needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#522](https://github.com/andrew3stedall/Cdl-react/issues/522) | In progress: independent leagues and season context explicitly selected | [docs/architecture/league-season-context-prerequisite-adr.md](../architecture/league-season-context-prerequisite-adr.md) |
| [#523](https://github.com/andrew3stedall/Cdl-react/issues/523) | In progress: immutable runtime versions; editing/activation and enforcement still open | [src/cdl_api/repositories/rule_versions.py](../../src/cdl_api/repositories/rule_versions.py) |
| [#524](https://github.com/andrew3stedall/Cdl-react/issues/524) | Open: general correction authority and affected records need definition | [docs/features/active/permissions-approvals-and-admin-audit.md](../features/active/permissions-approvals-and-admin-audit.md) |
| [#525](https://github.com/andrew3stedall/Cdl-react/issues/525) | Open: extension/conversion terms remain unspecified | [tests/test_postgres_loans.py](../../tests/test_postgres_loans.py) |
| [#526](https://github.com/andrew3stedall/Cdl-react/issues/526) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_private_scouting.py](../../tests/test_private_scouting.py) |
| [#527](https://github.com/andrew3stedall/Cdl-react/issues/527) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-frontend.md](../delivery/466-frontend.md) |
| [#528](https://github.com/andrew3stedall/Cdl-react/issues/528) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#529](https://github.com/andrew3stedall/Cdl-react/issues/529) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/App.tsx](../../frontend/src/App.tsx) |
| [#530](https://github.com/andrew3stedall/Cdl-react/issues/530) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-release-scope.md](../delivery/466-release-scope.md) |
| [#531](https://github.com/andrew3stedall/Cdl-react/issues/531) | Open: deployed signed-in, real-device and dated recovery evidence | [docs/delivery/466-ops.md](../delivery/466-ops.md) |
| [#532](https://github.com/andrew3stedall/Cdl-react/issues/532) | In progress: saved in-app state and opt-in 24h/1h FPL deadline reminders | [docs/features/active/notifications-activity-and-deadline-service.md](../features/active/notifications-activity-and-deadline-service.md) |
| [#533](https://github.com/andrew3stedall/Cdl-react/issues/533) | Open: canonical movement attribution and expanded comparison remain | [frontend/src/PlayerProfileScoutingPanels.tsx](../../frontend/src/PlayerProfileScoutingPanels.tsx) |
| [#534](https://github.com/andrew3stedall/Cdl-react/issues/534) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#535](https://github.com/andrew3stedall/Cdl-react/issues/535) | In progress: reasoned commissioner replacement preserving team/history | [docs/delivery/466-auth.md](../delivery/466-auth.md) |
| [#536](https://github.com/andrew3stedall/Cdl-react/issues/536) | Partial: optional route split measured; physical-device cold-load proof remains | [frontend/src/App.tsx](../../frontend/src/App.tsx) |

## Product decisions now recorded

- Standard/Triple Captain: a zero-minute captain passes the 2x/3x multiplier to a playing vice; playing with zero or negative fantasy points does not trigger fallback. Other chip edge cases are retained explicitly for review.
- A known playoff tie level on aggregate points and scoring-lineup goals resolves to the higher final regular-season finisher. Fifth/sixth scheduling remains unspecified.
- Commissioner replacement requires a reason and confirmation, removes the old manager’s league access and invites the new manager while preserving team/squad/history.
- League setup targets multiple independent leagues, user context switching and season-specific team management together; disconnected create records are insufficient.
- Alerts gain durable read/dismiss state and opt-in in-app 24h/1h FPL lineup-deadline reminders. No email/push delivery or automatic retention deletion is assumed.
- Bonus selection was “supply existing rules”; no exact criteria or amounts were supplied, so #494 remains open.
