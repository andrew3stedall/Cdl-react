# All 70 audit findings — execution batches

Updated: 7 October 2026 (Australia/Melbourne). Parent [#466](https://github.com/andrew3stedall/Cdl-react/issues/466). This index covers every issue; an item being tackled is not a claim that its acceptance is complete.

## Closure reconciliation — 7 October 2026

The following source-complete items are now closed after the merged implementation, its focused coverage and hosted validation were reconciled: [#470](https://github.com/andrew3stedall/Cdl-react/issues/470), [#471](https://github.com/andrew3stedall/Cdl-react/issues/471), [#473](https://github.com/andrew3stedall/Cdl-react/issues/473), [#478](https://github.com/andrew3stedall/Cdl-react/issues/478), [#479](https://github.com/andrew3stedall/Cdl-react/issues/479), [#480](https://github.com/andrew3stedall/Cdl-react/issues/480), [#481](https://github.com/andrew3stedall/Cdl-react/issues/481), [#483](https://github.com/andrew3stedall/Cdl-react/issues/483), [#498](https://github.com/andrew3stedall/Cdl-react/issues/498), [#500](https://github.com/andrew3stedall/Cdl-react/issues/500), [#501](https://github.com/andrew3stedall/Cdl-react/issues/501), [#502](https://github.com/andrew3stedall/Cdl-react/issues/502). Hosted validation for the exact pre-merge tree passed in [CI 37540121563](https://github.com/andrew3stedall/Cdl-react/actions/runs/37540121563) and [Backend PostgreSQL 37540121528](https://github.com/andrew3stedall/Cdl-react/actions/runs/37540121528), both on head ea12fffcec7da20ef1742c290cfa1129013f53d9. These are repository/test-contract closures; they do not claim physical-device, rendered-browser, recovery or product-policy evidence for other open findings.

- #470, #471 and #473 close the invite-return, failed-logout and invite-error handling findings.
- #478–#481 and #483 close the theme, splash and negative-chart findings.
- #498, #500 and #501 close formation-contract, incomplete-roster and historical-refresh findings.
- #502 closes production isolation for checkpoint APIs and engineering routes.
- #497 now closes after the current tree passed [CI 37541864031](https://github.com/andrew3stedall/Cdl-react/actions/runs/37541864031) and [Backend PostgreSQL 37541864055](https://github.com/andrew3stedall/Cdl-react/actions/runs/37541864055). PR #550's earlier backend failure was the SQLite naive-versus-UTC timestamp assertion at `tests/test_fpl_data_ingestion.py:837`; later current-tree validation passed.

## Release verification — issues #475 and #531

The release-verification pass is partially complete. Existing CI and rollout controls are green, and a deployed authenticated reviewer exercise passed on staging revision `cdl-react-staging-api-00330-fs7`.

- #475: migrations, schema-head verification, retained serving traffic and named-revision promotion are implemented and passed in [staging rollout 37304958609](https://github.com/andrew3stedall/Cdl-react/actions/runs/37304958609). The live reviewer completed a Squad read, lineup write, reload verification and restoration.
- #531: current-contract Playwright passed in [CI 37305913049](https://github.com/andrew3stedall/Cdl-react/actions/runs/37305913049), the real PostgreSQL release journey passed in [PostgreSQL 37305911567](https://github.com/andrew3stedall/Cdl-react/actions/runs/37305911567), and the deployed browser path was exercised.
- Remaining blockers are exact candidate-before-promotion authenticated gating for #475, plus real device passkey and dated restore/rollback evidence for #531. These issues remain open.

## Batch 4 — merged and staging-validated

PR [#547](https://github.com/andrew3stedall/Cdl-react/pull/547) is merged as `f7d543886f96c24662e570932d589c54ada2d8c1`. The five Batch-4 issues (#489–#493) are closed after acceptance hardening passed CI, PostgreSQL validation, and the post-merge staging rollout.

- #489: Auto Captain applies exactly one deterministic bonus; tie ordering and bench exclusion are covered.
- #490: squad changes retain team-scoped ownership validation.
- #491: unlocked lineup repair preserves captain/vice state and slot ordering while locked history remains unchanged.
- #492: completed fixture player breakdowns use frozen base points, multipliers and reasons rather than mutable event-live totals.
- #493: official table snapshots are selected by calculated freshness instead of identifier ordering.
- Hosted evidence: [CI 37304958586](https://github.com/andrew3stedall/Cdl-react/actions/runs/37304958586), [Backend PostgreSQL 37304958650](https://github.com/andrew3stedall/Cdl-react/actions/runs/37304958650), and [staging rollout 37304958609](https://github.com/andrew3stedall/Cdl-react/actions/runs/37304958609).
- Staging serves revision `cdl-react-staging-api-00330-fs7` at 100% traffic from [the staging service](https://cdl-react-staging-api-tkhbn7jfsa-ts.a.run.app); migrations, official FPL refresh, readiness, smoke and live service/auth checks passed.

### What to review after Batch 4 is deployed

1. Confirm Auto Captain tie and bench cases choose one eligible scorer and one bonus.
2. Verify an ownership change repairs only unlocked future lineups and leaves locked fixture history intact.
3. Confirm completed fixture explanations remain stable if event-live data changes after settlement.
4. Confirm a newer calculated official snapshot wins even when an older row has a larger identifier.

## Batch 3 — merged and staging-validated

PR [#545](https://github.com/andrew3stedall/Cdl-react/pull/545) is merged as `4d884fe1671d69deb9caadef4462fd05ebaa1dfe`. The four batch-3 issues (#513–#516) are closed after the focused journey coverage passed CI, PostgreSQL smoke passed, and the post-merge staging rollout completed successfully.

- #513: Market Interests and Trades keep failed reads distinct from empty states and retry in place.
- #514: authoritative same-gameweek history corrections refresh form, including an added double-gameweek fixture.
- #515: committed squad mutations remain successful when a later lineup refresh fails; Retry reloads data without reposting the mutation.
- #516: pending trade submission is single-flight, with a disabled **Sending…** state and retry after rejection.
- Hosted evidence: [CI 37203312911](https://github.com/andrew3stedall/Cdl-react/actions/runs/37203312911), [Backend PostgreSQL 37203312905](https://github.com/andrew3stedall/Cdl-react/actions/runs/37203312905), and [staging rollout 37203312984](https://github.com/andrew3stedall/Cdl-react/actions/runs/37203312984).
- Staging is serving revision `cdl-react-staging-api-00329-2q9` at 100% traffic from [the staging service](https://cdl-react-staging-api-tkhbn7jfsa-ts.a.run.app). Migrations, official FPL refresh and live service/auth checks passed.
- The review list below remains useful for manual app review; automated hosted evidence does not replace device-specific checks.

### What to review after Batch 3 is deployed

1. Market → Interests/Trades should show **unavailable + Retry** on read failure, never a false empty state.
2. Reopening a player after corrected FPL history should refresh points/minutes and split double-gameweek form.
3. A committed replacement must remain reported as committed even if the lineup refresh fails.
4. A slow trade submission should disable **Send trade proposal** and show **Sending…** until completion.

## Batch 2 — merged

- Finish #527 by removing the residual Manager's Desk narration while retaining status, player flags, counts and actions.
- Add regression assertions for the removed copy so the no-narrative rule stays enforceable.
- Reconcile acceptance-complete issues only where their exact issue criteria and dedicated tests already exist; policy/device/recovery-gated items remain open.

### What to review after Batch 2 is deployed

1. Desk injury cards should show the affected players and actions without an explanatory paragraph.
2. Locked Desk state should show the lock state and **View your team** action without repeating that the deadline passed.
3. Waiver cards should keep the countdown, interest count and action, without motivational/instructional prose when no interests exist.

## Batch 1 — merged

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
| [#470](https://github.com/andrew3stedall/Cdl-react/issues/470) | Closed after merged implementation and hosted validation | [frontend/src/App.tsx](../../frontend/src/App.tsx) |
| [#471](https://github.com/andrew3stedall/Cdl-react/issues/471) | Closed after merged implementation and hosted validation | [frontend/src/auth.test.ts](../../frontend/src/auth.test.ts) |
| [#472](https://github.com/andrew3stedall/Cdl-react/issues/472) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/ProfilePage.tsx](../../frontend/src/ProfilePage.tsx) |
| [#473](https://github.com/andrew3stedall/Cdl-react/issues/473) | Closed after merged implementation and hosted validation | [frontend/src/LeagueInvitePage.tsx](../../frontend/src/LeagueInvitePage.tsx) |
| [#474](https://github.com/andrew3stedall/Cdl-react/issues/474) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#475](https://github.com/andrew3stedall/Cdl-react/issues/475) | Partial: migration/promotion gate and deployed signed-in read/write verified; candidate-time authenticated gate remains | [docs/delivery/466-ops.md](466-ops.md) |
| [#476](https://github.com/andrew3stedall/Cdl-react/issues/476) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [Dockerfile](../../Dockerfile) |
| [#477](https://github.com/andrew3stedall/Cdl-react/issues/477) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/market-page.css](../../frontend/src/market-page.css) |
| [#478](https://github.com/andrew3stedall/Cdl-react/issues/478) | Closed after merged implementation and hosted validation | [frontend/src/theme-presets.ts](../../frontend/src/theme-presets.ts) |
| [#479](https://github.com/andrew3stedall/Cdl-react/issues/479) | Closed after merged implementation and hosted validation | [frontend/src/theme-presets.test.ts](../../frontend/src/theme-presets.test.ts) |
| [#480](https://github.com/andrew3stedall/Cdl-react/issues/480) | Closed after merged implementation and hosted validation | [frontend/src/theme-presets.ts](../../frontend/src/theme-presets.ts) |
| [#481](https://github.com/andrew3stedall/Cdl-react/issues/481) | Closed after merged implementation and hosted validation | [frontend/src/SessionSplash.tsx](../../frontend/src/SessionSplash.tsx) |
| [#482](https://github.com/andrew3stedall/Cdl-react/issues/482) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/ui/sheet.tsx](../../frontend/src/components/ui/sheet.tsx) |
| [#483](https://github.com/andrew3stedall/Cdl-react/issues/483) | Closed after merged implementation and hosted validation | [frontend/src/components/player](../../frontend/src/components/player) |
| [#484](https://github.com/andrew3stedall/Cdl-react/issues/484) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/components/player](../../frontend/src/components/player) |
| [#485](https://github.com/andrew3stedall/Cdl-react/issues/485) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/browser-tests/layout-invariants.spec.ts](../../frontend/browser-tests/layout-invariants.spec.ts) |
| [#486](https://github.com/andrew3stedall/Cdl-react/issues/486) | Batch 1: proven unused Squad/League header selectors removed | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#487](https://github.com/andrew3stedall/Cdl-react/issues/487) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#488](https://github.com/andrew3stedall/Cdl-react/issues/488) | Open: physical installed-PWA safe-area/keyboard/chrome checks | [frontend/browser-tests/layout-invariants.spec.ts](../../frontend/browser-tests/layout-invariants.spec.ts) |
| [#489](https://github.com/andrew3stedall/Cdl-react/issues/489) | Batch 4: Auto Captain tie and bench acceptance hardened; PR #547 merged and post-merge CI/PostgreSQL/staging evidence green; issue closed | [tests/test_team_selection_service.py](../../tests/test_team_selection_service.py) |
| [#490](https://github.com/andrew3stedall/Cdl-react/issues/490) | Batch 4: team-scoped squad validation retained and verified; PR #547 merged and post-merge CI/PostgreSQL/staging evidence green; issue closed | [tests/test_squad_service.py](../../tests/test_squad_service.py) |
| [#491](https://github.com/andrew3stedall/Cdl-react/issues/491) | Batch 4: unlocked lineup repair and captain/vice preservation verified; PR #547 merged and post-merge CI/PostgreSQL/staging evidence green; issue closed | [tests/test_fpl_settlement.py](../../tests/test_fpl_settlement.py) |
| [#492](https://github.com/andrew3stedall/Cdl-react/issues/492) | Batch 4: frozen completed-fixture scoring metadata verified; PR #547 merged and post-merge CI/PostgreSQL/staging evidence green; issue closed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#493](https://github.com/andrew3stedall/Cdl-react/issues/493) | Batch 4: fresh official table snapshot selection verified; PR #547 merged and post-merge CI/PostgreSQL/staging evidence green; issue closed | [tests/test_postgres_league_api.py](../../tests/test_postgres_league_api.py) |
| [#494](https://github.com/andrew3stedall/Cdl-react/issues/494) | Blocked: exact bonus criteria and award amounts still needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#495](https://github.com/andrew3stedall/Cdl-react/issues/495) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_postgres_trade_approval.py](../../tests/test_postgres_trade_approval.py) |
| [#496](https://github.com/andrew3stedall/Cdl-react/issues/496) | In progress: approved final league-rank tie-break; middle bracket path still needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#497](https://github.com/andrew3stedall/Cdl-react/issues/497) | Closed after merged implementation and current-tree hosted validation | [PR #550](https://github.com/andrew3stedall/Cdl-react/pull/550); [tests/test_fpl_data_ingestion.py](../../tests/test_fpl_data_ingestion.py); [tests/test_fpl_settlement.py](../../tests/test_fpl_settlement.py) |
| [#498](https://github.com/andrew3stedall/Cdl-react/issues/498) | Closed after merged implementation and hosted validation | [docs/delivery/466-rules.md](../delivery/466-rules.md) |
| [#499](https://github.com/andrew3stedall/Cdl-react/issues/499) | In progress: approved Standard/Triple Captain zero-minute vice fallback | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#500](https://github.com/andrew3stedall/Cdl-react/issues/500) | Closed after merged implementation and hosted validation | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#501](https://github.com/andrew3stedall/Cdl-react/issues/501) | Closed after merged implementation and hosted validation | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#502](https://github.com/andrew3stedall/Cdl-react/issues/502) | Closed after merged implementation and hosted validation | [frontend/src/App.engineering-previews.test.tsx](../../frontend/src/App.engineering-previews.test.tsx) |
| [#503](https://github.com/andrew3stedall/Cdl-react/issues/503) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#504](https://github.com/andrew3stedall/Cdl-react/issues/504) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#505](https://github.com/andrew3stedall/Cdl-react/issues/505) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#506](https://github.com/andrew3stedall/Cdl-react/issues/506) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#507](https://github.com/andrew3stedall/Cdl-react/issues/507) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/data-freshness.test.ts](../../frontend/src/data-freshness.test.ts) |
| [#508](https://github.com/andrew3stedall/Cdl-react/issues/508) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#509](https://github.com/andrew3stedall/Cdl-react/issues/509) | Closed — Batch 5: API-backed searchable Rules, mobile destination, stable links and retry states validated in PR #559; hosted CI/staging green | [frontend/src/RulesWorkspacePage.tsx](../../frontend/src/RulesWorkspacePage.tsx) |
| [#510](https://github.com/andrew3stedall/Cdl-react/issues/510) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#511](https://github.com/andrew3stedall/Cdl-react/issues/511) | Closed — Batch 5: knockout and head-to-head context exposed with explicit not-ready/empty states; hosted CI/staging green | [frontend/src/LeagueCompetitionViews.tsx](../../frontend/src/LeagueCompetitionViews.tsx) |
| [#512](https://github.com/andrew3stedall/Cdl-react/issues/512) | Closed — Batch 5: alert loading/error/empty/stale states and honest alert counts covered in PR #559; hosted CI/staging green | [frontend/src/components/ui/global-notifications.tsx](../../frontend/src/components/ui/global-notifications.tsx) |
| [#513](https://github.com/andrew3stedall/Cdl-react/issues/513) | Batch 3: failed reads stay distinct from empty states and retry in place; PR #545 merged and post-merge staging validation green | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#514](https://github.com/andrew3stedall/Cdl-react/issues/514) | Batch 3: authoritative same-gameweek corrections refresh form, including added DGW fixtures; PR #545 merged and post-merge staging validation green | [frontend/src/MarketPage.test.tsx](../../frontend/src/MarketPage.test.tsx) |
| [#515](https://github.com/andrew3stedall/Cdl-react/issues/515) | Batch 3: committed mutations remain successful when refresh fails; Retry reloads data; PR #545 merged and post-merge staging validation green | [frontend/src/PlayerProfilePage.test.tsx](../../frontend/src/PlayerProfilePage.test.tsx) |
| [#516](https://github.com/andrew3stedall/Cdl-react/issues/516) | Batch 3: pending trade submission is single-flight and disables repeat send; PR #545 merged and post-merge staging validation green | [frontend/src/SquadPage.test.tsx](../../frontend/src/SquadPage.test.tsx) |
| [#517](https://github.com/andrew3stedall/Cdl-react/issues/517) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#518](https://github.com/andrew3stedall/Cdl-react/issues/518) | Batch 1: direct profile identity is no longer blocked by history fetch | [frontend/src/PlayerProfilePage.tsx](../../frontend/src/PlayerProfilePage.tsx) |
| [#519](https://github.com/andrew3stedall/Cdl-react/issues/519) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [frontend/src/navigation.test.ts](../../frontend/src/navigation.test.ts) |
| [#520](https://github.com/andrew3stedall/Cdl-react/issues/520) | Closed — Batch 5: private ranked preferences, deterministic processing, stored results/rights and idempotency passed the real PostgreSQL draw integration test | [tests/test_free_agency_draw_repository.py](../../tests/test_free_agency_draw_repository.py) |
| [#521](https://github.com/andrew3stedall/Cdl-react/issues/521) | In progress: configured-season draft delivered; independent league/season context needed | [docs/delivery/466-scoring.md](../delivery/466-scoring.md) |
| [#522](https://github.com/andrew3stedall/Cdl-react/issues/522) | In progress: independent leagues and season context explicitly selected | [docs/architecture/league-season-context-prerequisite-adr.md](../architecture/league-season-context-prerequisite-adr.md) |
| [#523](https://github.com/andrew3stedall/Cdl-react/issues/523) | In progress: immutable runtime versions; editing/activation and enforcement still open | [src/cdl_api/repositories/rule_versions.py](../../src/cdl_api/repositories/rule_versions.py) |
| [#524](https://github.com/andrew3stedall/Cdl-react/issues/524) | Open: general correction authority and affected records need definition | [docs/features/active/permissions-approvals-and-admin-audit.md](../features/active/permissions-approvals-and-admin-audit.md) |
| [#525](https://github.com/andrew3stedall/Cdl-react/issues/525) | Open: extension/conversion terms remain unspecified | [tests/test_postgres_loans.py](../../tests/test_postgres_loans.py) |
| [#526](https://github.com/andrew3stedall/Cdl-react/issues/526) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [tests/test_private_scouting.py](../../tests/test_private_scouting.py) |
| [#527](https://github.com/andrew3stedall/Cdl-react/issues/527) | Batch 2: residual Desk narration removed; PR #544 merged and issue closed | [frontend/src/ManagerDeskPage.test.tsx](../../frontend/src/ManagerDeskPage.test.tsx) |
| [#528](https://github.com/andrew3stedall/Cdl-react/issues/528) | Implemented in merged delivery; checking the exact acceptance and documentation before closure | [docs/delivery/466-ui.md](../delivery/466-ui.md) |
| [#529](https://github.com/andrew3stedall/Cdl-react/issues/529) | Closed — contextual Analytics/FDR access is documented and the four-item primary navigation is preserved; hosted evidence is green | [frontend/src/App.tsx](../../frontend/src/App.tsx) |
| [#530](https://github.com/andrew3stedall/Cdl-react/issues/530) | Closed — roadmap, route inventory, feature placement and release scope now agree on the supported candidate and explicit follow-ups | [docs/delivery/466-release-scope.md](../delivery/466-release-scope.md) |
| [#531](https://github.com/andrew3stedall/Cdl-react/issues/531) | Partial: current-contract browser, real PostgreSQL and deployed signed-in read/write evidence verified; device/recovery evidence remains | [docs/delivery/466-ops.md](466-ops.md) |
| [#532](https://github.com/andrew3stedall/Cdl-react/issues/532) | Deferred — current alerts remain derived; durable read/dismiss/reminder lifecycle is not exposed and will be revisited after the #531 release-evidence gate | [docs/features/active/notifications-activity-and-deadline-service.md](../features/active/notifications-activity-and-deadline-service.md) |
| [#533](https://github.com/andrew3stedall/Cdl-react/issues/533) | Open: canonical movement attribution and expanded comparison remain | [frontend/src/PlayerProfileScoutingPanels.tsx](../../frontend/src/PlayerProfileScoutingPanels.tsx) |
| [#534](https://github.com/andrew3stedall/Cdl-react/issues/534) | Closed — commissioners can list pending invites and revoke an unused invite; expiry remains policy-optional | [frontend/src/LeaguePage.tsx](../../frontend/src/LeaguePage.tsx) |
| [#535](https://github.com/andrew3stedall/Cdl-react/issues/535) | Deferred — no destructive assigned-team release/reassignment control is exposed until the policy is accepted | [docs/delivery/466-auth.md](../delivery/466-auth.md) |
| [#536](https://github.com/andrew3stedall/Cdl-react/issues/536) | Partial: optional route split measured; physical-device cold-load proof remains | [frontend/src/App.tsx](../../frontend/src/App.tsx) |

## Product decisions now recorded

- Standard/Triple Captain: a zero-minute captain passes the 2x/3x multiplier to a playing vice; playing with zero or negative fantasy points does not trigger fallback. Other chip edge cases are retained explicitly for review.
- A known playoff tie level on aggregate points and scoring-lineup goals resolves to the higher final regular-season finisher. Fifth/sixth scheduling remains unspecified.
- Commissioner replacement requires a reason and confirmation, removes the old manager’s league access and invites the new manager while preserving team/squad/history.
- League setup targets multiple independent leagues, user context switching and season-specific team management together; disconnected create records are insufficient.
- Alerts gain durable read/dismiss state and opt-in in-app 24h/1h FPL lineup-deadline reminders. No email/push delivery or automatic retention deletion is assumed.
- Bonus selection was “supply existing rules”; no exact criteria or amounts were supplied, so #494 remains open.


## Batch 5 — hosted-validated UI follow-up

PR #559 completes the Rules mobile-access gap and adds notification stale-refresh coverage. Issues #509, #511 and #512 are closed after CI #37481699093, PostgreSQL #37481699113 and staging rollout #37481699009 passed. The next open capability boundary is #521, whose next-season activation depends on #522 league/season context.


## Contextual tools and release-scope reconciliation — 6 October 2026

Issues #529 and #530 are now evidence-complete. Analytics is reachable from League, Fixture Difficulty is reachable from Market, and the supported primary navigation remains Desk, Squad, Market and League. The roadmap and route inventory now distinguish historical checkpoints, supported product workflows, contextual utilities and deferred capability boundaries.

Hosted evidence for this closure remains the merged-main validation: [CI 37481699093](https://github.com/andrew3stedall/Cdl-react/actions/runs/37481699093), [Backend PostgreSQL 37481699113](https://github.com/andrew3stedall/Cdl-react/actions/runs/37481699113), and [staging rollout 37481699009](https://github.com/andrew3stedall/Cdl-react/actions/runs/37481699009). #522–#525 remain open because they are partial or architecture/policy-bound; #531 remains open for its device and recovery evidence.

## Commissioner invite lifecycle — 6 October 2026

## Assigned-team reassignment boundary — 6 October 2026

#535 is explicitly deferred from the current release. Ownership remains unchanged and the UI exposes no destructive release/reassignment control. Revisit after the league/season context and commissioner replacement policy settle authorization, approval, immutable reason, prior-user session revocation and history preservation.



#534 is closed. The authenticated commissioner management surface lists pending invites and supports revoking a selected unused invite. Reissuing an invite revokes the previous link; no expiration duration or team reassignment policy is inferred.

## Durable notification boundary — 6 October 2026

#532 is explicitly deferred from the current release. The notification bell remains a derived-alert surface with honest loading, unavailable, empty and stale states; its count is labelled alerts and no read/dismiss/reminder action is exposed. The target is the post-launch durable-notifications milestone after #531’s release-evidence gate, with cadence, delivery and retention policy settled before implementation.

## Batch 5 draw evidence — 6 October 2026

#520 is closed after the real PostgreSQL integration test `test_postgres_ranked_draw_persists_private_results_and_claims_once` passed in PostgreSQL run #37481699113. The test covers private ranked preferences, deterministic awards, temporary rights, idempotent reprocessing and ownership isolation. #521 remains partial until the next-season context/setup dependency #522 is resolved.
