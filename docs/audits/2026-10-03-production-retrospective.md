# CDL React — production retrospective

Audit date: **3 October 2026 (Australia/Melbourne)**. Repository: `andrew3stedall/Cdl-react`. Audited application revision: [`ca642efdce1ab03020342353676a6d1bf46bad7e`](https://github.com/andrew3stedall/Cdl-react/commit/ca642efdce1ab03020342353676a6d1bf46bad7e).

Milestone tracker: [#466 — Production retrospective](https://github.com/andrew3stedall/Cdl-react/issues/466).

## Assessment

**The app is not ready for production yet.** Its four main screens have a clear purpose and useful shared foundations, but secure team access, repeat onboarding login, scoring, ownership changes, mutation feedback and complete acquisition/trade workflows have material gaps. Passing existing tests does not resolve these gaps.

Six specialist agents reviewed visual consistency; frontend journeys; backend/domain behavior; authentication/onboarding/operations; feature purpose/roadmap/copy; and independent verification. Findings were consolidated into **70 child issues: 24 P1, 35 P2, 11 P3.** These are distinct fix, validation, scope-decision and improvement issues—not 70 independently reproduced runtime defects.

P1 means a launch blocker or critical-path issue **if the capability is included/exposed in the first release**. P2 means important functionality, consistency or a future deadline gate. P3 means optional improvement, cleanup or explicitly later scope. No active production incident is claimed. Earlier worker P0 labels were normalized to P1 launch blockers here.

This retrospective changes documentation and GitHub planning records only. It does not implement fixes, migrate/reset data, deploy code or approve production onboarding.

## Most important findings

| Problem | Evidence and consequence | Issue |
| --- | --- | --- |
| Production API protection is conditional on staging | Local production-mode anonymous chip mutation returned 200. Frontend route protection is insufficient. | [AUTH-01 / #467](https://github.com/andrew3stedall/Cdl-react/issues/467) |
| Unassigned signed-in users inherit another team's context | Actual PostgreSQL repository constructors with no manager match retain Exeter Gently / manager-1. Requires fail-closed membership handling. | [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468) |
| Invited Google members cannot return after logout | Initial invite login/join works; fresh Google login returns 401 because only allowlist or unconsumed invite is accepted. | [AUTH-03 / #469](https://github.com/andrew3stedall/Cdl-react/issues/469) |
| Auto Captain awards two captain bonuses | Actual scorer returns 39 instead of 34 when original captain is not highest scorer. | [BD-01 / #489](https://github.com/andrew3stedall/Cdl-react/issues/489) |
| Valid roster replacement is rejected | Squad validation totals every team's owned players; legal own DEF-to-DEF swap fails goalkeeper limit. | [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490) |
| Departed players can survive unattended lineup rollover | Ownership mutations and scheduler do not repair persisted future selections. | [BD-03 / #491](https://github.com/andrew3stedall/Cdl-react/issues/491) |
| Chip changes discard unsaved lineup/captaincy | React reproduction proves Save submits the old persisted captain after chip response. | [J01 / #503](https://github.com/andrew3stedall/Cdl-react/issues/503) |
| Squad errors are invisible; committed actions can look failed | Status is screen-reader-only; refresh failure after commit is caught as mutation failure. | [J02 / #504](https://github.com/andrew3stedall/Cdl-react/issues/504), [J17 / #515](https://github.com/andrew3stedall/Cdl-react/issues/515) |
| Final scores/history are not reliably immutable | Mutable event value 99 overrides frozen 10; failed final fetch can freeze older provisional data. | [BD-04 / #492](https://github.com/andrew3stedall/Cdl-react/issues/492), [BD-10 / #497](https://github.com/andrew3stedall/Cdl-react/issues/497) |
| Trades and free agency cannot complete as promised | Market trades are read-only; accepted trade does not move ownership; flat Interests are not ranked draw submission. | [J03 / #505](https://github.com/andrew3stedall/Cdl-react/issues/505), [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495), [PUR-06 / #520](https://github.com/andrew3stedall/Cdl-react/issues/520) |
| Cached/live pages remain stale | Page mounting/scroll retention works, but data is not invalidated on cross-page mutations or live score changes. | [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507) |
| Drawers, palettes and copy remain inconsistent | Market/League modal stack is below nav; custom companion palettes stay stale; some accent text fails contrast; specific narrative inventory exists. | [UI-01 / #477](https://github.com/andrew3stedall/Cdl-react/issues/477), [UI-02 / #478](https://github.com/andrew3stedall/Cdl-react/issues/478), [UI-04 / #480](https://github.com/andrew3stedall/Cdl-react/issues/480), [PUR-13 / #527](https://github.com/andrew3stedall/Cdl-react/issues/527) |

## Coverage and evidence limits

| Area | Reviewed / exercised | Boundary |
| --- | --- | --- |
| Primary routes | Desk; Squad pitch/list; lineup/captain/chips; comparison/trade/substitution drawers; Market Discovery/Interests/Trades; League fixtures/table/manage | Source/contract audit plus focused React/jsdom reproductions; no full signed-in deployed browser tour |
| Supporting routes | Player profile; Profile appearance/colours/orientation/passkeys; Rules; join/login; FDR; Analytics; compatibility and checkpoint routes | Reachability, purpose, copy, styling and state paths inspected |
| Domain | Auth/member context; invitations; squad rights/changes; proposals/approvals; draft/draw/loan prototypes; lineup/locks; chips/substitution; FPL ingestion/settlement; table/history/knockouts | Actual calculation/constructor/TestClient reproductions and existing tests; no real-data correction |
| Operations | CI; PostgreSQL workflow; Docker locks; staging rollout/migration/fallback; seed safeguards; production/recovery runbooks | Current repository and GitHub run evidence; cloud configuration, backup inventory and restore were not inspected live |
| Visual consistency | Shared header/nav/gutters; palettes/form/FDR/result/position roles; typography; sheets; contrast; copy | Contrast/blend math and CSS source verified. Geometry, safe areas and real-device legibility remain unverified |

The audit covers all current React route families and documented backend feature families. It is a broad retrospective, not a proof that no other defect exists. Playwright Chromium download repeatedly returned a zero-byte/truncated archive, so no browser screenshots or measured header positions were obtained. [UI-V01 / #485](https://github.com/andrew3stedall/Cdl-react/issues/485)–[UI-V04 / #488](https://github.com/andrew3stedall/Cdl-react/issues/488) retain these checks explicitly. Do not treat them as observed shifts/clipping.

The deployed staging `/health` returned HTTP 200 on a read-only check. This proves process reachability only. Successful historical workflow runs on the audited SHA include [CI](https://github.com/andrew3stedall/Cdl-react/actions/runs/35668707737), [Backend PostgreSQL](https://github.com/andrew3stedall/Cdl-react/actions/runs/35668707738), [Auto Rollout](https://github.com/andrew3stedall/Cdl-react/actions/runs/35668707767) and [Direct Rollout](https://github.com/andrew3stedall/Cdl-react/actions/runs/35669001298). These do not prove all signed-in workflows, backup/restore, or production safety.

## Validation performed

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Existing locked frontend dependencies installed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; JS 587.73 kB / 161.85 kB gzip; CSS 282.10 kB / 41.78 kB gzip; bundle-size warning |
| `npm run test` | 41 files / **187 tests passed** |
| `uv sync` | Existing backend dependency set installed |
| `uv run ruff check .` | Passed |
| `uv run ruff format --check .` | Passed; 444 files formatted |
| `uv run pytest` | **402 passed, 18 skipped**, 170 warnings; database-gated local tests were not exercised without PostgreSQL |
| Focused auth/onboarding group | **33 passed**; existing tests miss repeat-login and production-boundary failures |
| Focused gameplay group | **19 passed**; actual-method scratch reproductions expose missing edge coverage |
| Isolated React audit reproductions | **3 passed**, asserting current broken behavior: lost staged captain after chip update, stuck Compare loading, removed Interest dead action; 20 copied baseline cases skipped |
| Isolated API/constructor reproductions | Anonymous production-mode chip write; invited-member repeat-login 401; unassigned user default-team fallback confirmed |
| Browser/device execution | Unavailable because browser download failed; no visual all-clear claimed |

Focused groups are subsets/extra audit evidence, not additional app-suite totals. Scratch audit cases deliberately assert existing defects; they are not fixed regression tests committed to the application. Existing backend warnings include deprecation notices; none are represented as test failures.

## Milestone and production sequence

The repository already uses milestone/coordinator issues (#75/#78) and has no native GitHub milestones. **#466 is an issue-based milestone tracker** following that convention. The connected tooling cannot create native milestones; no native milestone object was created.

| Phase | Work | Gate |
| --- | --- | --- |
| 0 — Agree release reality | [PUR-18 / #530](https://github.com/andrew3stedall/Cdl-react/issues/530); real rules/formation/captain/bonus decisions; separate shipped/prototype/deferred claims | One current scope matrix; no undocumented rule invention |
| 1 — Secure and correct core loop | Auth/membership/repeat-login; scoring/final-source/history; squad validation/rollover; staged lineup preservation; migration ordering | No cross-team/anonymous write; deterministic scoring and persisted legal lineup |
| 2 — Finish supported manager actions | Trade resolution/execution; ranked draws/rights if promised; visible feedback; recovery; cache/live freshness; Rules | Every exposed action completes safely and survives reload across two accounts |
| 3 — Compact consistent UI | Modal stacking/keyboard; theme pairs/contrast; chart meaning; copy inventory; typography/header/safe-area matrix | Equivalent static elements stay aligned; essential content readable and controls accessible |
| 4 — Prove release operations | [V4 / #531](https://github.com/andrew3stedall/Cdl-react/issues/531); existing #70/#71/#75/#78/#111; backup/restore/rollback/alert evidence | Current-contract browser and real PostgreSQL journeys plus dated recovery evidence |
| Later deadlines / optional scope | Draft, league/season authoring, loans, watches/notes, durable activity, richer player history, advanced analytics; knockout before its phase | Explicit target or deferral; unsupported capability is safely guarded |

Do not require every P2/P3 feature before launching an already drafted current-season league. Do require a complete, secure current-season loop, safe operations and honest boundaries. If trade/free-agency features remain exposed as usable, their incomplete lifecycle is a launch blocker. Knockout readiness needs a clear delivery target before its season phase, not an unsupported “complete” label.

### Dependency order worth preserving

- [AUTH-01 / #467](https://github.com/andrew3stedall/Cdl-react/issues/467) and [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468) precede real-user onboarding; [AUTH-03 / #469](https://github.com/andrew3stedall/Cdl-react/issues/469) closes the returning-member lifecycle.
- [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490) and [BD-03 / #491](https://github.com/andrew3stedall/Cdl-react/issues/491) underlie trades, awarded rights and loans. Trade execution needs [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495); approval UI is [PUR-08C / #524](https://github.com/andrew3stedall/Cdl-react/issues/524).
- [BD-01 / #489](https://github.com/andrew3stedall/Cdl-react/issues/489), [BD-04 / #492](https://github.com/andrew3stedall/Cdl-react/issues/492) and [BD-10 / #497](https://github.com/andrew3stedall/Cdl-react/issues/497) underpin trustworthy official results. [BD-05 / #493](https://github.com/andrew3stedall/Cdl-react/issues/493) / [BD-06 / #494](https://github.com/andrew3stedall/Cdl-react/issues/494) precede [BD-09 / #496](https://github.com/andrew3stedall/Cdl-react/issues/496).
- [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507) preserves useful caching while adding invalidation; it supports live League/Desk, Market form and notifications. It must not erase unsaved Squad work.
- [UI-03 / #479](https://github.com/andrew3stedall/Cdl-react/issues/479) precedes automatic palette pairing in [UI-02 / #478](https://github.com/andrew3stedall/Cdl-react/issues/478); [UI-04 / #480](https://github.com/andrew3stedall/Cdl-react/issues/480) preserves exact fill accents while deriving readable text.
- [V4 / #531](https://github.com/andrew3stedall/Cdl-react/issues/531) integrates targeted regressions; it must not replace them with broad mocked screenshots or re-enable automatic screenshots contrary to the current workflow preference.

## Existing trackers: reconcile rather than duplicate

| Existing issue | Current audit treatment |
| --- | --- |
| [#70 — staging bootstrap](https://github.com/andrew3stedall/Cdl-react/issues/70) | Rollout evidence now exists; dated live database, migration, persisted-workflow, restore and rollback proofs remain to reconcile. Do not tick historical boxes from code alone. |
| [#71 — production go-live](https://github.com/andrew3stedall/Cdl-react/issues/71) | Owns production/recovery gate. AUTH-01/02/03, OPS-01 and V4 are new blocking inputs. OPS-04 below stays here rather than a duplicate recovery epic. |
| [#75 — database/GCP coordinator](https://github.com/andrew3stedall/Cdl-react/issues/75) | Link audit child work and distinguish completed persistence schema from complete real manager journeys. |
| [#78 — staging/production readiness milestone](https://github.com/andrew3stedall/Cdl-react/issues/78) | Reconcile successful deployments with unproven recovery/production boundaries. |
| [#96 — implementation/design readiness](https://github.com/andrew3stedall/Cdl-react/issues/96) | Older boundary and trade/UI completion claims are superseded by this source-based audit; link the concrete issue backlog. |
| [#111 — reviewed Terraform apply pipeline](https://github.com/andrew3stedall/Cdl-react/issues/111) | Apply/rollout workflows and successful runs exist. Resolve historical status using evidence; OPS-01 is the separate migration/promotion failure-path fix. |

OPS-04 (release/recovery evidence) requires dated backup inspection, successful restore drill, tested rollback, alert delivery, database/migration readiness and authenticated persisted smoke checks with owners/environment/SHA. The runbook lists these requirements but does not supply completion evidence. The audit does **not** assert that backups are absent or that a live restore has failed.

## Complete GitHub issue index

| Audit ID | Priority | Category | Finding type | GitHub issue |
| --- | --- | --- | --- | --- |
| AUTH-01 | P1 | Access | Confirmed defect | [#467 — Enforce authentication and safe configuration in production](https://github.com/andrew3stedall/Cdl-react/issues/467) |
| AUTH-02 | P1 | Access | Confirmed defect | [#468 — Reject manager operations for authenticated users without an assigned team](https://github.com/andrew3stedall/Cdl-react/issues/468) |
| AUTH-03 | P1 | Access | Confirmed defect | [#469 — Allow invited league members to sign in again with Google](https://github.com/andrew3stedall/Cdl-react/issues/469) |
| AUTH-04 | P2 | Access | Confirmed defect | [#470 — Preserve team invite state when the login page reloads](https://github.com/andrew3stedall/Cdl-react/issues/470) |
| AUTH-05 | P1 | Access | Confirmed defect | [#471 — Report failed logout accurately and preserve a retry path](https://github.com/andrew3stedall/Cdl-react/issues/471) |
| AUTH-06 | P2 | Access | Planned incomplete | [#472 — Complete passkey management with additional keys and revocation](https://github.com/andrew3stedall/Cdl-react/issues/472) |
| AUTH-07 | P2 | Access | Confirmed defect | [#473 — Distinguish invite outages from invalid links and support retry](https://github.com/andrew3stedall/Cdl-react/issues/473) |
| AUTH-08 | P2 | Access | Confirmed defect | [#474 — Remove commissioner narration and label assigned managers accurately](https://github.com/andrew3stedall/Cdl-react/issues/474) |
| OPS-01 | P1 | Operations | Confirmed defect | [#475 — Run and verify migrations before promoting application traffic](https://github.com/andrew3stedall/Cdl-react/issues/475) |
| OPS-02 | P2 | Operations | Confirmed defect | [#476 — Build runtime images from the checked-in dependency locks](https://github.com/andrew3stedall/Cdl-react/issues/476) |
| UI-01 | P1 | UI | Confirmed source defect | [#477 — Keep Market and League drawers above the mobile navigation](https://github.com/andrew3stedall/Cdl-react/issues/477) |
| UI-02 | P2 | UI | Confirmed source defect | [#478 — Complete companion light and dark palettes for custom theme colours](https://github.com/andrew3stedall/Cdl-react/issues/478) |
| UI-03 | P2 | UI | Confirmed source defect | [#479 — Correct blend weights when deriving missing theme palette variants](https://github.com/andrew3stedall/Cdl-react/issues/479) |
| UI-04 | P2 | UI | Confirmed source defect | [#480 — Provide accessible accent text while preserving exact chosen fill colours](https://github.com/andrew3stedall/Cdl-react/issues/480) |
| UI-05 | P2 | UI | Confirmed source defect | [#481 — Use the saved theme for the splash and remove marketing narration](https://github.com/andrew3stedall/Cdl-react/issues/481) |
| UI-06 | P2 | UI | Confirmed source defect | [#482 — Give app drawers and colour sheets a consistent keyboard modal lifecycle](https://github.com/andrew3stedall/Cdl-react/issues/482) |
| UI-07 | P2 | UI | Confirmed source defect | [#483 — Represent negative points accurately in the form and minutes chart](https://github.com/andrew3stedall/Cdl-react/issues/483) |
| UI-08 | P2 | UI | Confirmed source defect | [#484 — Expose five-fixture form history to assistive technology](https://github.com/andrew3stedall/Cdl-react/issues/484) |
| UI-V01 | P2 | UI | Verification / improvement | [#485 — Verify stable header and bell geometry across routes and loading states](https://github.com/andrew3stedall/Cdl-react/issues/485) |
| UI-V02 | P3 | UI | Verification / improvement | [#486 — Consolidate page gutters and remove verified unused header CSS](https://github.com/andrew3stedall/Cdl-react/issues/486) |
| UI-V03 | P2 | UI | Verification / improvement | [#487 — Define consistent typography roles and verify small-screen legibility](https://github.com/andrew3stedall/Cdl-react/issues/487) |
| UI-V04 | P2 | UI | Verification / improvement | [#488 — Verify PWA safe areas and colour sheets with dynamic viewport height](https://github.com/andrew3stedall/Cdl-react/issues/488) |
| BD-01 | P1 | Gameplay | Confirmed runtime defect | [#489 — Apply exactly one Auto Captain scoring bonus](https://github.com/andrew3stedall/Cdl-react/issues/489) |
| BD-02 | P1 | Gameplay | Confirmed runtime defect | [#490 — Validate squad changes against the requesting team only](https://github.com/andrew3stedall/Cdl-react/issues/490) |
| BD-03 | P1 | Gameplay | Confirmed source gap | [#491 — Repair unlocked lineups when ownership changes and during rollover](https://github.com/andrew3stedall/Cdl-react/issues/491) |
| BD-04 | P1 | Gameplay | Confirmed runtime defect | [#492 — Use immutable scoring snapshots for completed fixture player breakdowns](https://github.com/andrew3stedall/Cdl-react/issues/492) |
| BD-05 | P1 | Gameplay | Confirmed runtime defect | [#493 — Separate official and live standings and select fresh table snapshots](https://github.com/andrew3stedall/Cdl-react/issues/493) |
| BD-06 | P1 | Gameplay | Defect plus rule decision | [#494 — Resolve and enforce configured CDL league bonus awards](https://github.com/andrew3stedall/Cdl-react/issues/494) |
| BD-07 | P1 | Gameplay | Incomplete promised workflow | [#495 — Complete approved trades with atomic ownership movement](https://github.com/andrew3stedall/Cdl-react/issues/495) |
| BD-09 | P2 | Gameplay | Planned incomplete | [#496 — Deliver the live knockout generation and winner-progression engine](https://github.com/andrew3stedall/Cdl-react/issues/496) |
| BD-10 | P1 | Gameplay | Confirmed source failure path | [#497 — Block official settlement when the final event-live refresh fails](https://github.com/andrew3stedall/Cdl-react/issues/497) |
| BD-D1 | P2 | Gameplay | Rule decision / contract drift | [#498 — Reconcile the allowed formation contract across gameplay services](https://github.com/andrew3stedall/Cdl-react/issues/498) |
| BD-D2 | P2 | Gameplay | Rule decision | [#499 — Define captain and vice-captain fallback rules for every chip](https://github.com/andrew3stedall/Cdl-react/issues/499) |
| BD-D3 | P2 | Gameplay | Confirmed source gap | [#500 — Replace demo lineup counts with explicit incomplete-roster handling](https://github.com/andrew3stedall/Cdl-react/issues/500) |
| BD-I1 | P3 | Gameplay | Operational improvement | [#501 — Limit repeated historical event refreshes and expose source freshness](https://github.com/andrew3stedall/Cdl-react/issues/501) |
| BD-08 | P1 | Gameplay | Production surface gap | [#502 — Isolate checkpoint prototype APIs and catalogues from production gameplay](https://github.com/andrew3stedall/Cdl-react/issues/502) |
| J01 | P1 | Journeys | Confirmed source / runtime defect | [#503 — Preserve staged lineup and captaincy when updating a chip](https://github.com/andrew3stedall/Cdl-react/issues/503) |
| J02 | P1 | Journeys | Confirmed source / runtime defect | [#504 — Show actionable Squad load and mutation feedback visibly](https://github.com/andrew3stedall/Cdl-react/issues/504) |
| J03 | P1 | Journeys | Incomplete promised workflow | [#505 — Add authorized trade accept, reject and cancel controls to Market](https://github.com/andrew3stedall/Cdl-react/issues/505) |
| J04 | P1 | Journeys | Confirmed source / runtime defect | [#506 — Recover Compare and Trade after closing a drawer during loading](https://github.com/andrew3stedall/Cdl-react/issues/506) |
| J05 | P1 | Journeys | Confirmed source / runtime defect | [#507 — Refresh cached pages and live data after mutations and route activation](https://github.com/andrew3stedall/Cdl-react/issues/507) |
| J06 | P2 | Journeys | Confirmed source / runtime defect | [#508 — Allow removed Interests to be added again after reopening a player](https://github.com/andrew3stedall/Cdl-react/issues/508) |
| J08 | P1 | Journeys | Incomplete promised workflow | [#509 — Finish authoritative searchable Rules with mobile access and canonical links](https://github.com/andrew3stedall/Cdl-react/issues/509) |
| J10 | P1 | Journeys | Confirmed source / runtime defect | [#510 — Keep League and commissioner management usable when optional reads fail](https://github.com/andrew3stedall/Cdl-react/issues/510) |
| J11 | P2 | Journeys | Incomplete promised workflow | [#511 — Expose supported knockout and head-to-head context in League](https://github.com/andrew3stedall/Cdl-react/issues/511) |
| J12 | P2 | Journeys | Confirmed source / runtime defect | [#512 — Represent notification loading, failures and alert counts honestly](https://github.com/andrew3stedall/Cdl-react/issues/512) |
| J14 | P2 | Journeys | Confirmed source / runtime defect | [#513 — Add a real Market retry action and distinguish failed reads from empty data](https://github.com/andrew3stedall/Cdl-react/issues/513) |
| J16 | P2 | Journeys | Confirmed source / runtime defect | [#514 — Refresh Market form history when same-length fixture data changes](https://github.com/andrew3stedall/Cdl-react/issues/514) |
| J17 | P2 | Journeys | Confirmed source / runtime defect | [#515 — Separate committed squad changes from subsequent refresh failures](https://github.com/andrew3stedall/Cdl-react/issues/515) |
| J18 | P2 | Journeys | Confirmed source / runtime defect | [#516 — Prevent duplicate trade proposals during pending submission](https://github.com/andrew3stedall/Cdl-react/issues/516) |
| J19 | P2 | Journeys | Confirmed source / runtime defect | [#517 — Show a meaningful upcoming-fixture state when lineup previews are absent](https://github.com/andrew3stedall/Cdl-react/issues/517) |
| J20 | P2 | Journeys | Confirmed source / runtime defect | [#518 — Keep known player identity and controls visible while history loads](https://github.com/andrew3stedall/Cdl-react/issues/518) |
| J22 | P3 | Journeys | Confirmed source / runtime defect | [#519 — Make supported routes and League view URLs explicit](https://github.com/andrew3stedall/Cdl-react/issues/519) |
| PUR-06 | P1 | Planned scope | Conditional launch gate | [#520 — Complete ranked free-agency preferences, processing and awarded rights](https://github.com/andrew3stedall/Cdl-react/issues/520) |
| PUR-07 | P2 | Planned scope | Future deadline gate | [#521 — Deliver or explicitly defer the persistent live draft room](https://github.com/andrew3stedall/Cdl-react/issues/521) |
| PUR-08A | P2 | Planned scope | Planned incomplete | [#522 — Complete or explicitly defer league and season setup management](https://github.com/andrew3stedall/Cdl-react/issues/522) |
| PUR-08B | P2 | Planned scope | Planned incomplete | [#523 — Connect versioned league rule configuration to runtime enforcement](https://github.com/andrew3stedall/Cdl-react/issues/523) |
| PUR-08C | P2 | Planned scope | Planned incomplete | [#524 — Deliver commissioner approvals, corrections and an auditable action history](https://github.com/andrew3stedall/Cdl-react/issues/524) |
| PUR-09 | P2 | Product / maintenance | Planned scope / improvement | [#525 — Deliver or explicitly defer loans and scheduled player returns](https://github.com/andrew3stedall/Cdl-react/issues/525) |
| PUR-10 | P3 | Product / maintenance | Planned scope / improvement | [#526 — Track private watchlists and notes separately from draw Interests](https://github.com/andrew3stedall/Cdl-react/issues/526) |
| PUR-13 | P2 | Product / maintenance | Confirmed copy inconsistency | [#527 — Remove concrete narrative and developer prose from live app components](https://github.com/andrew3stedall/Cdl-react/issues/527) |
| PUR-15 | P3 | Product / maintenance | Planned scope / improvement | [#528 — Retire the superseded Market implementation after migrating useful tests](https://github.com/andrew3stedall/Cdl-react/issues/528) |
| PUR-16 | P3 | Product / maintenance | Planned scope / improvement | [#529 — Define contextual access or explicit deferral for Analytics and FDR](https://github.com/andrew3stedall/Cdl-react/issues/529) |
| PUR-18 | P2 | Product / maintenance | Planning integrity gap | [#530 — Reconcile roadmap, feature status and release scope with the current app](https://github.com/andrew3stedall/Cdl-react/issues/530) |
| V4 | P1 | Validation | Evidence gap | [#531 — Add current-contract browser and real PostgreSQL release journeys](https://github.com/andrew3stedall/Cdl-react/issues/531) |
| EXT-01 | P3 | Planned scope | Planned incomplete | [#532 — Track durable activity, read state and deadline reminders as separate scope](https://github.com/andrew3stedall/Cdl-react/issues/532) |
| EXT-02 | P3 | Planned scope | Planned incomplete | [#533 — Track CDL player ownership history and richer comparisons explicitly](https://github.com/andrew3stedall/Cdl-react/issues/533) |
| IMP-01 | P3 | Improvement | Optional policy decision | [#534 — Give commissioners an explicit pending invite and revocation lifecycle](https://github.com/andrew3stedall/Cdl-react/issues/534) |
| IMP-02 | P3 | Improvement | Optional policy decision | [#535 — Plan safe assigned-team release and manager reassignment](https://github.com/andrew3stedall/Cdl-react/issues/535) |
| IMP-03 | P3 | Improvement | Measured size / performance hypothesis | [#536 — Measure mobile cold-load cost and split optional code where justified](https://github.com/andrew3stedall/Cdl-react/issues/536) |

## Detailed findings and acceptance

Every entry below has a corresponding scoped GitHub issue with evidence, scope/out-of-scope, acceptance criteria, dependencies, data/API/frontend impacts, test expectations, documentation and risks. Classification identifies actual reproductions versus source gaps, product decisions and verification work.

### AUTH-01 — Enforce authentication and safe configuration in production

**P1 · Confirmed defect · [#467](https://github.com/andrew3stedall/Cdl-react/issues/467)**. Owning feature: [authentication-and-session-management.md](../features/active/authentication-and-session-management.md).

- **Priority:** P1. **Classification:** confirmed local behavior; production launch blocker.
- **Evidence:** `src/cdl_api/app.py:30-45` installs access middleware only for `environment == 'staging'`. `src/cdl_api/staging_access.py:31-35` explicitly bypasses other environments. `src/cdl_api/routers/team_selection.py:34-43,115-138` uses optional authentication for read/write repository selection. Settings default to memory repositories and an insecure cookie; production startup does not reject those defaults.
- **Repro/impact:** set environment to `production`, start app, request team-selection and activate Triple Captain anonymously. Both return 200 in the local memory fixture. With PostgreSQL the same route lacks an authentication requirement. The frontend protected-route check cannot secure direct API requests.
- **Acceptance:** enforce sessions across staging AND production protected routes; reject anonymous mutations with 401; require safe production cookie/persistence settings; explicitly disable temporary shared-secret login in production; retain anonymous memory preview only under explicit development configuration. Add production-environment API tests for anonymous reads/writes, auth exceptions, and unsafe startup config.
- **Dependencies:** precedes real-user launch. Related auth feature document and production go-live checklist; reconcile with open auth/security issues before creation.

### AUTH-02 — Reject manager operations for authenticated users without an assigned team

**P1 · Confirmed defect · [#468](https://github.com/andrew3stedall/Cdl-react/issues/468)**. Owning feature: [league-season-team-model.md](../features/active/league-season-team-model.md).

- **Priority:** P1. **Classification:** confirmed source + isolated constructor reproduction.
- **Evidence:** `src/cdl_api/repositories/postgres_squad_repository.py:194-209` defaults to primary staging team and demo manager; `src/cdl_api/repositories/postgres_team_selection.py:166-178` does the same for writable lineup/chips; `src/cdl_api/staging_draft_seed.py:598-637` returns None for an unassigned user. `src/cdl_api/routers/auth.py:299-320` creates an authenticated session before the separate invite accept call. Staging middleware checks only a session.
- **Repro/impact:** authenticate a verified new email through a valid invite, then close the page before acceptance, encounter an accept failure, or navigate directly to Squad. No manager match retains `team-exeter-gently / manager-1`; writable squad/lineup/chip code then targets that team. An allowlisted but unassigned user has the same path.
- **Acceptance:** fail closed for authenticated users lacking league/team membership; show compact onboarding/assignment state; require membership before all manager-scoped operations; development fallback must be explicitly separate from authenticated PostgreSQL behavior. Regression tests must assert unassigned users cannot read/write primary-team state and assigned users cannot affect others.
- **Dependencies:** auth boundary and invite/member contract; no UI-only fix.

### AUTH-03 — Allow invited league members to sign in again with Google

**P1 · Confirmed defect · [#469](https://github.com/andrew3stedall/Cdl-react/issues/469)**. Owning feature: [authentication-and-session-management.md](../features/active/authentication-and-session-management.md).

- **Priority:** P1. **Classification:** reproduced with actual verifier and stubbed verified claims.
- **Evidence:** `src/cdl_api/routers/auth.py:299-314` allows unlisted emails only while an invite preview is valid; `src/cdl_api/google_identity.py:47-55` otherwise requires allowlist; `src/cdl_api/repositories/league_memberships.py:264-266` makes assigned-team invite previews invalid. Existing member lookup is absent from Google sign-in.
- **Repro/impact:** invite a Google email outside staging reviewer allowlist, complete onboarding, sign out, use ordinary Google sign-in. It returns 401. The consumed invite also cannot restore access. Expired 30-day sessions and new devices therefore lock legitimate managers out unless their email is added manually or they previously registered a passkey.
- **Acceptance:** verified existing authorized league members can reauthenticate through Google without reusable invite tokens; unlisted nonmembers remain denied; test full invite -> assignment -> logout -> fresh login flow and revoked-member denial. Do not solve by globally allowing all Google users.
- **Dependencies:** AUTH-02; update onboarding/auth docs.

### AUTH-04 — Preserve team invite state when the login page reloads

**P2 · Confirmed defect · [#470](https://github.com/andrew3stedall/Cdl-react/issues/470)**. Owning feature: [authentication-and-session-management.md](../features/active/authentication-and-session-management.md).

- **Priority:** P2. **Classification:** deterministic state/URL inspection.
- **Evidence:** `frontend/src/App.tsx:124,149-161,245-248,296-298`: pending invite exists only in React state while browser URL is replaced with `/login`; Google request gets invite token from that state.
- **Repro/impact:** open `/join/<token>` while signed out, allow redirect to `/login`, then refresh. Initial path is now `/login`; pending token is lost; an unlisted invitee's Google sign-in gets 401 and does not allocate the target team.
- **Acceptance:** preserve validated invite/return state through login refresh and provider transitions (safe URL or tab session storage); clear after completion/cancellation; retain ordinary-login behavior. Cover reload and expired/revoked invite.
- **Dependencies:** AUTH-03; targeted App/login tests.

### AUTH-05 — Report failed logout accurately and preserve a retry path

**P1 · Confirmed defect · [#471](https://github.com/andrew3stedall/Cdl-react/issues/471)**. Owning feature: [authentication-and-session-management.md](../features/active/authentication-and-session-management.md).

- **Priority:** P1. **Classification:** confirmed error-path logic.
- **Evidence:** `frontend/src/App.tsx:333-346` catches logout failure and sets an unauthenticated local session. `src/cdl_api/routers/auth.py:443-458` returns 503 on database failure before deleting the session cookie.
- **Repro/impact:** make `/api/auth/logout` return 503 or interrupt the request. UI displays login, but the durable cookie/session can remain valid. Reload or another tab can reopen the account after the user believed sign-out succeeded.
- **Acceptance:** show compact logout failure with retry; avoid reporting completed server sign-out until confirmed; ensure logout behavior is explicit during network/database outage and across tabs. Regression test failed logout then reload/session check.
- **Dependencies:** session lifecycle; security and usability issue, not a narrative request.

### AUTH-06 — Complete passkey management with additional keys and revocation

**P2 · Planned incomplete · [#472](https://github.com/andrew3stedall/Cdl-react/issues/472)**. Owning feature: [authentication-and-session-management.md](../features/active/authentication-and-session-management.md).

- **Priority:** P2. **Classification:** implemented first-key feature with documented future gap.
- **Evidence:** `frontend/src/ProfilePage.tsx:376-406` shows setup only when `registeredCount === 0`; backend passkey repository/service exposes create/get/list/count but no delete endpoint. `docs/features/active/authentication-and-session-management.md` explicitly says multiple passkeys and revocation belong to a later account management pass.
- **Repro/impact:** register one passkey then open Profile on a second device. There is no Add passkey control, registered-key list, or revoke action. A lost device/key cannot be removed through the app.
- **Acceptance:** compact Security settings with key list, add another key, name/device metadata where reliable, revoke with ownership enforcement and clear success/failure feedback; prevent unintended lockout and test revoked keys cannot authenticate.
- **Dependencies:** existing planned account-management follow-up should be linked rather than presented as unplanned scope.

### AUTH-07 — Distinguish invite outages from invalid links and support retry

**P2 · Confirmed defect · [#473](https://github.com/andrew3stedall/Cdl-react/issues/473)**. Owning feature: [league-season-team-model.md](../features/active/league-season-team-model.md).

- **Priority:** P2. **Classification:** confirmed rendering/error handling.
- **Evidence:** `frontend/src/LeagueInvitePage.tsx:34-42,49-57,73-74` maps all preview/accept failures to a single “invalid, expired, or the league is full” message and only offers Open league.
- **Repro/impact:** transient network/503 while accepting a valid invitation is reported as a permanently unusable invite. Opening the league leaves an unassigned session, which compounds AUTH-02.
- **Acceptance:** preserve specific 404/409 outcomes; display brief retryable service/network errors; offer Retry preview/accept; remain in assignment state until completed; test unavailable network and already-owned team.
- **Dependencies:** AUTH-02 and invite API errors.

### AUTH-08 — Remove commissioner narration and label assigned managers accurately

**P2 · Confirmed defect · [#474](https://github.com/andrew3stedall/Cdl-react/issues/474)**. Owning feature: [permissions-approvals-and-admin-audit.md](../features/active/permissions-approvals-and-admin-audit.md).

- **Priority:** P2. **Classification:** confirmed UI text/source mismatch.
- **Evidence:** `frontend/src/LeaguePage.tsx:520` displays “People currently signed in to this league and the team they manage.” Data at `src/cdl_api/repositories/league_memberships.py:136-174` tests permanent `managers.user_id`, not active sessions. `frontend/src/LeaguePage.tsx:542` adds another explanatory paragraph (“Create a link for a specific team…”).
- **Impact:** logged-out assigned managers are shown as currently signed in; both paragraphs repeat what headings/buttons convey and violate AGENTS.md's compact label/control standard.
- **Acceptance:** remove both explanatory paragraphs; use accurate Assigned managers/Team access labels; never imply online/presence without supporting data; keep purposeful operational errors and team-assignment status.
- **Dependencies:** coordinate with global narrative audit; one targeted issue can cover all concrete commissioner prose.

### OPS-01 — Run and verify migrations before promoting application traffic

**P1 · Confirmed defect · [#475](https://github.com/andrew3stedall/Cdl-react/issues/475)**. Owning feature: [production-backend-database-and-gcp-infrastructure.md](../features/active/production-backend-database-and-gcp-infrastructure.md).

- **Priority:** P1. **Classification:** confirmed workflow ordering.
- **Evidence:** `.github/workflows/gcp-auto-rollout-staging.yml:378-380` applies Terraform (including application image change) before migration job at `429-444`. `.github/workflows/gcp-direct-staging-rollout.yml:39-46` automatically runs after any failed main auto-rollout; `212-219` deploys the image with no migration execution/version compatibility gate. `221-286` checks ready revision, `/health`, and anonymous 401 only; those do not use the new schema.
- **Repro/impact:** merge a new-table application change; migration fails, or plan/post-apply fails after image build. New code can still receive full traffic or be deployed by direct fallback without its schema. Health/auth boundary can pass while signed-in feature endpoints fail.
- **Acceptance:** stage new image without serving traffic, run/verify compatible migrations first, test authenticated critical reads and writes, then promote traffic. Direct fallback must prove schema/image compatibility or block on failed migration; failure evidence should retain last healthy revision. Add workflow tests for migration failure/order and failure classifications.
- **Dependencies:** existing deployment/migration milestone; address before schema-changing production releases.

### OPS-02 — Build runtime images from the checked-in dependency locks

**P2 · Confirmed defect · [#476](https://github.com/andrew3stedall/Cdl-react/issues/476)**. Owning feature: [production-backend-database-and-gcp-infrastructure.md](../features/active/production-backend-database-and-gcp-infrastructure.md).

- **Priority:** P2. **Classification:** confirmed build/CI divergence.
- **Evidence:** `Dockerfile:5-6` copies package.json only then runs npm install; package-lock arrives after installation at line 8. `Dockerfile:23-29` copies pyproject.toml but not uv.lock and installs via pip. Many frontend dependencies use `latest` (`frontend/package.json:16-38`). Backend CI uses uv lock resolution (`.github/workflows/ci.yml:15`) while Docker resolves broad ranges separately.
- **Impact:** the same source commit rebuilt later can install a different React/Vite/Python dependency set than CI tested. Immutable image tagging only pins the first successful build; it does not make the build reproducible or guarantee CI/runtime parity.
- **Acceptance:** lock frontend install with npm ci and both manifest/lock copied before install; install runtime Python from uv.lock/frozen exported requirements; freeze CI sync appropriately; prove checked-in lock changes are the only source of dependency resolution changes.
- **Dependencies:** CI/build infrastructure; no dependency upgrade required for this fix.

### UI-01 — Keep Market and League drawers above the mobile navigation

**P1 · Confirmed source defect · [#477](https://github.com/andrew3stedall/Cdl-react/issues/477)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/market-page.css:751-755` gives the Market drawer layer `z-index:30`; `:775-789` makes its body full height; `:912` places the mobile sheet at the viewport bottom. `frontend/src/league-page.css:2189-2211` gives League backdrop/drawer indexes 29/30. `frontend/src/global-navigation.css:22-40` fixes navigation at the viewport bottom with `z-index:40` and a 4.5rem plus safe-area height.
- Impact: the visible bottom navigation covers these modal surfaces. The Market footer has only normal sheet padding plus safe-area padding, so bottom actions can sit beneath navigation. League drawer content similarly extends beneath navigation. Squad drawers use index 80 and Profile sheets use 100, so modal behaviour differs across screens.
- Reproduction: at a viewport below 760px wide, open a player from Market and scroll to Add/Remove Interest and Close; then open a fixture from League and scroll to its bottom. Observe the bottom navigation remaining above the modal.
- Acceptance: one documented modal stack above bottom navigation; footer controls fully visible and operable on 320px/390px/430px portrait and landscape; safe-area handling and keyboard behaviour validated; behind-modal navigation cannot receive pointer/focus interaction while a modal is open.
- Dependencies: shared shell/modal primitive. Scope includes Market and League, with regression checks against Squad and Profile; no domain API changes.

### UI-02 — Complete companion light and dark palettes for custom theme colours

**P2 · Confirmed source defect · [#478](https://github.com/andrew3stedall/Cdl-react/issues/478)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/ProfilePage.tsx:1493-1499` writes `{...themeColourVariants,[themeMode]:colours}`. The provider duplicates this active-mode-only behaviour at `frontend/src/theme-preset-provider.tsx:553-576` and `:607-611`. Predefined templates correctly set both variants at `ProfilePage.tsx:1467-1469`.
- Impact: choose a new custom palette in dark mode, switch to light, and the old palette remains. The UI shows Light/Dark previews for templates but exposes only the currently active variant in the custom editor, without a direct variant choice. This leaves the user's requested associated opposite-mode palette incomplete.
- Reproduction: choose Ocean template; customise dark primary to rose; change appearance to light. Ocean's previous light blue remains.
- Acceptance: define custom-palette companion policy; editing one mode creates an appropriate companion unless independently overridden; users can deliberately edit both appearances in the colour editor; saved/reloaded/adaptive switching preserves both. Templates continue to set exact intended pairs.
- Dependencies: UI-03 should be fixed before using automatic derivation. Product decision needed only if preserving independent overrides is preferred over always regenerating a companion.

### UI-03 — Correct blend weights when deriving missing theme palette variants

**P2 · Confirmed source defect · [#479](https://github.com/andrew3stedall/Cdl-react/issues/479)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/theme-colours.ts:156-160` passes 0.18 for a light-mode darkening and 0.16 for a dark-mode lift; `:198-201` weights the original colour by that value and the black/white endpoint by the remainder. `:180-187` calls this for missing variant fallbacks and legacy plain palettes.
- Impact: the implementation comment promises a small adjustment, but darkening applies 82% black and lifting applies 84% white. Default teal `#0F766E` becomes light companion `#031514` or dark companion `#D9E9E8`, almost black/pale grey. Current templates supply explicit pairs, and the provider usually constructs both sides, so this is a confirmed helper/fallback defect rather than a claim that every current template is broken.
- Validation: independently recomputed the RGB blend from source with Python; outputs above are exact to the helper's rounded arithmetic.
- Acceptance: keep most of the selected hue/chroma when deriving a companion; unit tests assert expected channel results and resulting contrast; test migration of legacy flat palettes and partially supplied variants.

### UI-04 — Provide accessible accent text while preserving exact chosen fill colours

**P2 · Confirmed source defect · [#480](https://github.com/andrew3stedall/Cdl-react/issues/480)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: default accents are `#0F766E` / `#115E59` in `frontend/src/theme-colours.ts:16-20`; dark canvas `#0b1111` and card `#111c1b` are defined in `frontend/src/theme-presets.ts:29-35`. `frontend/src/application-shell.css:398-404` uses primary for 0.72rem brand text; `frontend/src/market-page.css:425-438` uses theme accents directly for owner text; `:415-422` makes owner labels 0.6rem on narrow viewports. Primary is also used for selected navigation, panel labels, and statuses.
- Impact: computed contrast against dark canvas is 3.48:1 for primary and 2.51:1 for secondary; against card it is 3.18:1/2.30:1. These are below 4.5:1 for normal-size text. All non-teal primary presets tested also fall below 4.5:1 on the default dark canvas (blue 3.69, violet 3.34, rose 3.03, sunset 3.68, forest 3.80). Fill chips choose a foreground with contrast, but font mode has no corresponding text-colour correction.
- Validation: contrast ratios calculated from sRGB relative luminance in Python. No screenshot judgement is needed for this finding.
- Acceptance: separate raw chosen fill accents from accessible accent-text tokens, retaining the user's exact fill choices; verify normal text against every surface and both modes; address custom black/white/extreme choices without silently mutating their chosen fill values; primary actions remain identifiable.

### UI-05 — Use the saved theme for the splash and remove marketing narration

**P2 · Confirmed source defect · [#481](https://github.com/andrew3stedall/Cdl-react/issues/481)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/SessionSplash.tsx:12-15` uses `defaultThemeColour`; `:24-28` renders “Own your league.” and “Your league. Your strategy. All season long.”; `:45` renders “Preparing your workspace”. No stored accent or current theme variant is passed to this component.
- Impact: boot displays default teal regardless of a user's selected accent. Decorative slogans are still shipped in a component despite `AGENTS.md`'s “Do not add narrative or explanatory prose to app components” and the user's earlier request for theme fill and white logo splash.
- Acceptance: splash uses the persisted selected primary colour where available, with a documented first-use fallback; white brand mark and compact loading/error feedback; remove marketing headings/taglines; verify cold launch and refresh in both modes.
- Dependencies: may require a small boot-safe persisted preference contract; do not delay auth while loading theme.

### UI-06 — Give app drawers and colour sheets a consistent keyboard modal lifecycle

**P2 · Confirmed source defect · [#482](https://github.com/andrew3stedall/Cdl-react/issues/482)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/components/ui/sheet.tsx:10-22` is a hidden/unhidden `<aside aria-modal="true" role="dialog">` with no focus/escape hooks. `frontend/src/ProfilePage.tsx:152-191` locks scrolling but adds no focus trap, initial focus, Escape handler, or focus restoration. Market/League separately focus their drawers and handle Escape (`MarketPage.tsx:209-219`, `LeaguePage.tsx:189-205`), so the behaviour differs between implementations.
- Impact: keyboard focus stays on the covered opener; users can Tab to controls behind the sheet; Escape does not close the chooser. Declaring `aria-modal` alone does not implement modal behaviour.
- Reproduction: open a colour chooser with keyboard; press Tab/Shift+Tab/Escape; check focus restoration on Close.
- Acceptance: shared modal primitive moves focus inside, traps it, closes on Escape, restores opener focus, and makes background inert; retain current scroll restoration and sheet layout; tests cover every colour chooser.

#### J21 — P2 — Declared modal dialogs do not trap/restore focus or dismiss consistently

- Evidence: Market drawer `MarketPage.tsx:212-218,537-540`, Squad drawer `SquadPage.tsx:455-467,965-1054`, League `LeaguePage.tsx:189-210,1408-1430` only focus container and register Escape. No focus trap/inert background/restoration. Compare/Trade outer aside lacks dialog role/name/aria-modal. Notification popover `global-notifications.tsx:83` declares dialog but has no Escape/outside-dismiss/focus management.
- Reproduction: keyboard Tab from last drawer action reaches underlying page/bottom navigation; notifications stay open after Escape/outside click; Compare/Trade not identified as dialogs by assistive technology.
- Acceptance: reusable accessible sheet/dialog behaviour: labelled semantics, appropriate focus containment/restoration, consistent Escape/backdrop handling and scroll behaviour, tested with keyboard. Pending mutation dismissal defined.


### UI-07 — Represent negative points accurately in the form and minutes chart

**P2 · Confirmed source defect · [#483](https://github.com/andrew3stedall/Cdl-react/issues/483)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/components/player/CombinedFormMinutesChart.tsx:96-101` computes all point heights with `chartBarHeight`; `:106-127` places them in the positive track; `:167-170` uses `Math.abs(value)`. Negative points therefore create an upward bar while the numeric label remains negative.
- Impact: a negative fixture looks like a positive result of similar magnitude. The chart's below-zero section is already reserved for minutes, so this needs an explicit representation decision, not just a sign flip into the minutes track.
- Reproduction: feed a completed fixture with 90 minutes and -2 points into CombinedFormMinutesChart; the point bar rises above zero.
- Acceptance: negative points have an unambiguous visual representation without colliding with the minutes plot, with correct value, sign and shared form colour; cover zero, negative, null, DNP, and high-scoring fixtures.

### UI-08 — Expose five-fixture form history to assistive technology

**P2 · Confirmed source defect · [#484](https://github.com/andrew3stedall/Cdl-react/issues/484)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/components/player/PlayerCard.tsx:203-229` sets the entire five-dot history `aria-hidden="true"`; individual dots provide only data attributes and no accessible summary. The function accepts an unused `value` argument. Shared dots are used throughout Squad and Market.
- Impact: colour, DNP, split double-gameweek scores, and the five-gameweek history are unavailable to screen-reader users. They are an important scouting signal rather than decorative content.
- Acceptance: add a concise accessible textual history with gameweek, each fixture's points, minutes/DNP; keep dots visually compact; double fixtures must be represented; do not announce decorative duplicate form widgets redundantly.

### UI-V01 — Verify stable header and bell geometry across routes and loading states

**P2 · Verification / improvement · [#485](https://github.com/andrew3stedall/Cdl-react/issues/485)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/page-layout.css:38-46,66-70` fixes hero height to 4.2rem desktop/3.8rem mobile; `frontend/src/application-shell.css:371-429,487-530` lays out non-shrinking actions, brand mark, copy and toggles. `ManagerDeskPage.tsx:120-136` includes Desk/Profile toggle plus account avatar plus notifications; Market uses three toggles; commissioner League adds a third toggle.
- Risk: Gaffers Desk title wraps or overlaps at narrow widths; text zoom worsens fit. Different controls mean equal header height alone does not guarantee matching title/bell position.
- Acceptance: measure hero, brand mark, h1 and notification bounding boxes on Desk/Squad/Market/League in manager/commissioner states at 320/360/390/430px and 200% text size. Record loading-to-loaded geometry and back-navigation geometry; deliberate extra controls must fit without title clipping.

### UI-V02 — Consolidate page gutters and remove verified unused header CSS

**P3 · Verification / improvement · [#486](https://github.com/andrew3stedall/Cdl-react/issues/486)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `.market-page` has padding in `frontend/src/market-page.css:1-15` and `:867-875`, plus a route-specific shell override at `:928-940`; `manager-desk.css:1-4`, `squad-page.css:1-39`, and `league-page.css:1-10` also set page padding. The late shared `page-layout.css` overrides these. Old `.squad-page__hero` and `.league-page__hero` rules remain though current screens use PageHero.
- Risk: imports/order/specificity are doing substantial integration work; a later stylesheet or isolated entry point can bring double gutters back. Do not claim the current app has double padding solely from dead declarations.
- Acceptance: one source owns page gutters/header geometry; remove verified unused legacy selectors in a scoped cleanup; capture cross-route geometry before/after and confirm no regressions. The user wants static elements to stay put, so automate measured invariants rather than screenshot-only approval.

### UI-V03 — Define consistent typography roles and verify small-screen legibility

**P2 · Verification / improvement · [#487](https://github.com/andrew3stedall/Cdl-react/issues/487)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/components/player/combined-form-minutes-chart.css:30-35` scales y-axis text down to 0.45rem; `frontend/src/squad-page.css:993-1009` includes 0.42rem/0.36rem elements; mobile overrides retain 0.48rem metadata at `:2635-2643,2875-2881`; notifications metadata uses 0.62rem (`components/ui/global-notifications.css:108-116`).
- Risk: source sizes span 5.76px–10px for some dense metadata at a 16px root. Density is intentional, so every small value is not automatically a defect; verify essential readable values and tap targets on actual phone-sized display, text scaling and landscape.
- Acceptance: record agreed minimum tokens for primary names, values, metadata and chart ticks; share roles between equivalent surfaces; essential values remain readable under text zoom; chart detail allows inspection without needing to read tiny glyphs.

### UI-V04 — Verify PWA safe areas and colour sheets with dynamic viewport height

**P2 · Verification / improvement · [#488](https://github.com/andrew3stedall/Cdl-react/issues/488)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: global bottom nav handles all safe-area sides (`global-navigation.css:31-34`), player profile header handles top (`player-profile.css:81`), but primary shell mobile padding (`page-layout.css:55-58`) uses a plain 0.75rem top and shared gutter; `.ui-sheet` uses `height:100vh` (`profile-page.css:893`) rather than `100dvh`.
- Risk: iOS standalone/landscape notches and mobile dynamic browser bars may overlap primary header or clip full-height sheets. This requires browser/device confirmation; no live overlap was observed by this worker.
- Acceptance: test installed PWA and browser portrait/landscape with safe areas, keyboard and dynamic browser chrome; primary hero/bell and palette Use buttons always visible; prefer one shell safe-area contract and dynamic viewport sizing.

### BD-01 — Apply exactly one Auto Captain scoring bonus

**P1 · Confirmed runtime defect · [#489](https://github.com/andrew3stedall/Cdl-react/issues/489)**. Owning feature: [chips-and-scoring-modifiers.md](../features/active/chips-and-scoring-modifiers.md).

- **Priority:** P1, scoring correctness. **Confidence:** confirmed executable reproduction.
- **Evidence:** `src/cdl_api/services/fpl_settlement.py:603-625`. The highest scorer gets multiplier 2, then another row which is the originally selected captain also gets multiplier 2. `docs/features/active/chips-and-scoring-modifiers.md:18` defines highest-scoring player as the recipient of the captain multiplier.
- **Trigger/impact:** original captain scores 5; another starter scores 10; other nine starters score 1 each. Base score 24. Auto Captain should return 34, but actual primary scorer returns **39**. Results and standings can be wrong.
- **Acceptance:** Auto Captain grants exactly one captain bonus, ties use a documented deterministic rule, and original captain is not additionally doubled. Tests cover original captain highest, another highest, negative points, ties, bench/reserve exclusion, and final fixture result.
- **Dependencies:** none; preserve snapshot/audit explanation when recalculating affected results.

### BD-02 — Validate squad changes against the requesting team only

**P1 · Confirmed runtime defect · [#490](https://github.com/andrew3stedall/Cdl-react/issues/490)**. Owning feature: [squad-management-scouting-and-transfers.md](../features/active/squad-management-scouting-and-transfers.md).

- **Priority:** P1, squad movement blocked. **Confidence:** confirmed executable reproduction of service plus direct PostgreSQL contract evidence.
- **Evidence:** `src/cdl_api/repositories/postgres_squad_repository.py:574-575` returns every player assigned to any team. `src/cdl_api/services/squad.py:122-149` projects and counts that entire result without filtering current manager. By contrast `get_summary` deliberately filters at `services/squad.py:50-54`.
- **Trigger/impact:** two legal 20-player squads each have two GKs; current manager replaces a defender with another defender via a valid temporary right. Service sees four GKs and rejects with **“GKP must stay between 2 and 3 players (would be 4).”** Eight-team staging amplifies the defect. The repository has a separate own-team removal check, so this finding is rejection of legitimate changes, not a claim that another team can actually be removed.
- **Acceptance:** project exactly the requesting team's active squad; test valid replacement with eight teams, foreign removal, position minima/maxima, valid/expired rights and rollback on failure.
- **Dependencies:** none.

### BD-03 — Repair unlocked lineups when ownership changes and during rollover

**P1 · Confirmed source gap · [#491](https://github.com/andrew3stedall/Cdl-react/issues/491)**. Owning feature: [team-selection-and-lineup-locking.md](../features/active/team-selection-and-lineup-locking.md).

- **Priority:** P1, weekly gameplay integrity. **Confidence:** confirmed missing cross-feature write/validation in inspected primary paths; actual staging scenario not executed.
- **Evidence:** `src/cdl_api/repositories/postgres_squad_repository.py:631-700` only updates ownership/right tables. `src/cdl_api/services/fpl_settlement.py:199-264` rolls previous lineup rows forward without joining active squad ownership. `_team_scores` at `fpl_settlement.py:500-521` joins player reference data, not current ownership. Active document explicitly requires departing players removed from future unlocked lineups (`docs/features/active/team-selection-and-lineup-locking.md:18`). `postgres_team_selection.py:187-210` filters for display when the manager loads the app, but that is not a repair of the persisted unattended scheduler path.
- **Trigger/impact:** player leaves before next deadline; manager never opens/saves next lineup; scheduler copies and locks the departed player's previous selection, so that player can still score for the old team. Incoming replacement may never get a valid selection.
- **Acceptance:** ownership movement atomically repairs all affected future unlocked lineups, captain/vice and bench order; excludes locked history; unattended rollover reconciles roster before scoring; tests cross trade/right activation and deadline processing without a page visit.
- **Dependencies:** BD-02; implement roster/right repair independently and integrate with BD-07 when trade execution is added. Do not repair locked historical records silently.

**Linked prerequisites / related work:** [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490).

### BD-04 — Use immutable scoring snapshots for completed fixture player breakdowns

**P1 · Confirmed runtime defect · [#492](https://github.com/andrew3stedall/Cdl-react/issues/492)**. Owning feature: [fixture-scoring-snapshots-and-finalisation.md](../features/active/fixture-scoring-snapshots-and-finalisation.md).

- **Priority:** P1, history and score explanation. **Confidence:** confirmed executable function reproduction.
- **Evidence:** `src/cdl_api/repositories/postgres_team_selection.py:795-808` returns `event_points` before frozen `snapshot_points`; `get_historical_fixture_squads` at `:247-271` reads both sources. Actual reproduction: event value 99 and stored frozen score 10 produce **99**. `docs/features/active/fixture-scoring-snapshots-and-finalisation.md` requires history independent of later FPL refetches.
- **Related concrete contract defects:** frozen `player_scores` stores multiplied CDL points (`services/fpl_settlement.py:626-628`) whereas cached event values are unmultiplied; `_historical_player_points` treats both as interchangeable. `_historical_points_multiplier` (`postgres_team_selection.py:812-818`) never represents Auto Captain selection, and a Best XI inclusion decision is not returned. Fixture cards can show a different meaning/number depending on cache availability and fail to explain chip-adjusted totals.
- **Acceptance:** store/return immutable per-player base points, multiplier, final points, scoring inclusion and substitution/chip reason; completed fixture views read the selected frozen snapshot; mutable cache is for provisional views; reload with cache changed/absent yields identical final explanation and reconciles exactly to fixture totals.
- **Dependencies:** BD-01; historical correction mechanism and snapshot versioning.

**Linked prerequisites / related work:** [BD-01 / #489](https://github.com/andrew3stedall/Cdl-react/issues/489).

### BD-05 — Separate official and live standings and select fresh table snapshots

**P1 · Confirmed runtime defect · [#493](https://github.com/andrew3stedall/Cdl-react/issues/493)**. Owning feature: [league-table-and-table-movement.md](../features/active/league-table-and-table-movement.md).

- **Priority:** P1, misleading standings. **Confidence:** confirmed executable reproduction.
- **Evidence:** `src/cdl_api/repositories/postgres_league_fixtures.py:639-661` only skips `outcome == pending`, not non-final fixtures. Live settlement creates win/draw outcomes while `finalised == False` (`services/fpl_settlement.py:376-402`); fixture read exposes that outcome regardless (`postgres_league_fixtures.py:332-338`). The primary `LeagueTableResponse` (`contracts/league_models.py:113-115`) has no mode/gameweek/movement contract. Document `docs/features/active/league-table-and-table-movement.md` requires separate live/provisional/official views and a stable official table.
- **Trigger/impact:** started 60–50 fixture counts as played and awards 3 in the primary table even before finalisation. No way for consumer to request an official-only calculation. A stored active-team table snapshot can also take precedence indefinitely (`postgres_league_fixtures.py:488-497`) because selection checks matching team IDs, not season/GW freshness.
- **Acceptance:** explicit live/provisional/official contract; official uses finalised regular-season results only; live clearly labelled; snapshot selection keyed by season, GW, mode and freshness; movement derives from prior official position; test pending/live/final result plus stale matching-team snapshot.
- **Dependencies:** bonus rule calculation BD-06 and knockout table boundaries BD-09.

**Linked prerequisites / related work:** [BD-06 / #494](https://github.com/andrew3stedall/Cdl-react/issues/494).

### BD-06 — Resolve and enforce configured CDL league bonus awards

**P1 · Defect plus rule decision · [#494](https://github.com/andrew3stedall/Cdl-react/issues/494)**. Owning feature: [league-table-and-table-movement.md](../features/active/league-table-and-table-movement.md).

- **Priority:** P1 if accepted league bonus rules are required for production; rule definition gap also needs resolution. **Confidence:** confirmed executable omission of stored bonus.
- **Evidence:** accepted decision `docs/architecture/decision-log.md:93` and feature `docs/features/active/league-table-and-table-movement.md:14` say 3/1 plus automatic bonus. `services/fpl_settlement.py:392-431` stores no CDL bonus-award calculation. `_table_from_fixtures` (`postgres_league_fixtures.py:670-680`) increments only 3/1. Reproduction: final home win with `score.bonus_points={'home': 2}` yields **3** league points instead of **5**. This concerns additional CDL table bonus, distinct from FPL player bonus already in FPL total_points.
- **Acceptance:** document exact configured bonus criteria and units; calculate and freeze auditable CDL bonus; official/live table uses the accepted rule and stored bonus; tests result totals plus bonus and correction. If bonuses are intentionally no longer desired, formally update accepted decisions and remove misleading API/event metadata.
- **Dependencies:** resolve precise bonus criteria from approved product/legacy source; no invented rule.

### BD-07 — Complete approved trades with atomic ownership movement

**P1 · Incomplete promised workflow · [#495](https://github.com/andrew3stedall/Cdl-react/issues/495)**. Owning feature: [transfers-loans-and-negotiations.md](../features/active/transfers-loans-and-negotiations.md).

- **Priority:** P1 for usable Market/trades. **Confidence:** confirmed inspected primary route/service/repository path.
- **Evidence:** `src/cdl_api/routers/squad.py:225-274` exposes create and status update only; `services/squad.py:308-360` transitions proposed→accepted/rejected/cancelled; `repositories/postgres_squad_repository.py:857-874` only updates trade status. Metadata includes `trade_approvals_table` but no primary approval/action service or route references it. Prototype `/modernisation/negotiations/.../approve` at `routers/modernisation_squad_movement.py:232-249` only sets `squad_effect='applied'` without writing squad ownership.
- **Trigger/impact:** two managers agree a trade, status changes, but no players move and no commissioner approval can complete it. UI acceptance can be mistaken for executed transfer. Document `docs/features/active/transfers-loans-and-negotiations.md` says complete but requires agreement→approval→transactional movement.
- **Acceptance:** persistent offer/counter/agreement and approval lifecycle; commissioner/vice approval policy; validate ownership/current rights/caps/deadline/cooling-off at execution; atomically move both sides and repair future lineups; idempotent execution; visible pending approval/action status. No transfer before approval.
- **Dependencies:** isolation/permissions audit, BD-02, BD-03; keep proposal mutation separate from movement.

**Linked prerequisites / related work:** [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468); [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490); [BD-03 / #491](https://github.com/andrew3stedall/Cdl-react/issues/491).

### BD-09 — Deliver the live knockout generation and winner-progression engine

**P2 · Planned incomplete · [#496](https://github.com/andrew3stedall/Cdl-react/issues/496)**. Owning feature: [knockout-brackets-and-tiebreakers.md](../features/active/knockout-brackets-and-tiebreakers.md).

- **Priority:** P2 before season approaches GW36; P1 production release gap if complete competition lifecycle is a gate. **Confidence:** confirmed implementation inventory.
- **Evidence:** `src/cdl_api/staging_fixture_seed.py:30,137-149` schedules GW1–35 only. `services/league_service.py:183-201` only reads a snapshot or lists fixtures with “Final” in their label. `repositories/postgres_league_fixtures.py:524-563` reads imported `knockout_matches` and returns empty matches for active teams with none. `routers/modernisation_competition_experience.py:103-132,196-200` returns hard-coded demo aggregate/winner. `contracts/league_models.py:117-126` has no ties, legs, aggregate or goals-tiebreak fields. The synthetic historical importer persists reference records; it does not generate this season's bracket. Feature `docs/features/active/knockout-brackets-and-tiebreakers.md` nonetheless says Checkpoint 4 complete.
- **Trigger/impact:** GW35 concludes, but there is no primary path to seed qualifying teams into top/middle/bottom brackets or create GW36–38 legs, aggregate their results or progress winners. Do not mistake imported historical knockout persistence for live competition automation.
- **Acceptance:** generate after final standings; cover all placement paths, byes and two-leg rules; immutable aggregate and scoring-lineup goals evidence; auditable winner progression and corrections; define a second-level tie outcome if aggregate and goals both equal; mobile bracket/empty/not-ready states; prove regular table excludes playoff fixtures.
- **Dependencies:** stable official standings BD-05/06, immutable scoring BD-04.

**Linked prerequisites / related work:** [BD-04 / #492](https://github.com/andrew3stedall/Cdl-react/issues/492); [BD-05 / #493](https://github.com/andrew3stedall/Cdl-react/issues/493); [BD-06 / #494](https://github.com/andrew3stedall/Cdl-react/issues/494).

### BD-10 — Block official settlement when the final event-live refresh fails

**P1 · Confirmed source failure path · [#497](https://github.com/andrew3stedall/Cdl-react/issues/497)**. Owning feature: [fixture-scoring-snapshots-and-finalisation.md](../features/active/fixture-scoring-snapshots-and-finalisation.md).

- **Priority:** P1, settlement correctness and observability. **Confidence:** confirmed failure-path code analysis; no external FPL outage/staging mutation induced.
- **Evidence:** `services/fpl_data_service.py:187-208` swallows `FplApiError` and returns None. `_refresh_completed_event_live` at `:167-175` ignores the return and refresh still invokes settlement at `:88-89`. `services/fpl_settlement.py:277-290` loads any cached event payload/hash without fetched_at; `:343-352` declares it final if newly refreshed bootstrap GW is finished/data_checked. There is no relationship between checked state and successful final event-live fetch.
- **Trigger/impact:** final bootstrap refresh succeeds, event-live refresh fails after a previously cached in-play version. Settlement can freeze that older score/substitution payload as official and normally skips future updates once final (`:341-342`). Workflow top-level checks only bootstrap/fixture resources, so no event error is exposed.
- **Acceptance:** finalisation requires successful verified final event fetch or an explicit previously verified final source; propagate/record per-event failure and settlement skipped reason; retain provisional result until retry succeeds; retry then idempotently finalise with verified hash/timestamp; regression covers bootstrap checked true + event fetch failure + old cache.
- **Dependencies:** BD-04 immutable source/version metadata.

**Linked prerequisites / related work:** [BD-04 / #492](https://github.com/andrew3stedall/Cdl-react/issues/492).

### BD-D1 — Reconcile the allowed formation contract across gameplay services

**P2 · Rule decision / contract drift · [#498](https://github.com/andrew3stedall/Cdl-react/issues/498)**. Owning feature: [team-selection-and-lineup-locking.md](../features/active/team-selection-and-lineup-locking.md).

Primary validation and automatic substitution support the generic FPL constraints (including 5-2-3/5-3-2): `services/team_selection.py:22-27,185-208`, `services/substitution_engine.py:114-119`. Checkpoint `modernisation_weekly.py:29` lists only 343/352/433/442/451/541. Actual primary `_validate_full_selection` accepts 5-2-3 with zero issues. Recent seed/docs explicitly use generic ranges, so the approved current intended set cannot be inferred safely from an old checkpoint or user memory. **Acceptance:** settle allowed formation set from current league rules; one shared backend contract used by selector, validator, seeder and substitutions; mark old prototype rule obsolete or align it.

### BD-D2 — Define captain and vice-captain fallback rules for every chip

**P2 · Rule decision · [#499](https://github.com/andrew3stedall/Cdl-react/issues/499)**. Owning feature: [chips-and-scoring-modifiers.md](../features/active/chips-and-scoring-modifiers.md).

`services/fpl_settlement.py:603-625` uses vice multiplier only with Dual Captain. With captain DNP=0 and vice=10, actual standard team total19 receives no additional captain bonus (would be29 under FPL fallback). The repo says captain/vice must exist but does not explicitly document DNP fallback policy. **Acceptance:** state standard/Triple/Dual/Auto/Best XI captain rules when captain plays0, vice plays0, or selected captain is omitted by Best XI; implement tests and returned scoring explanation for the chosen rules. Do not silently import official FPL semantics into draft rules.

### BD-D3 — Replace demo lineup counts with explicit incomplete-roster handling

**P2 · Confirmed source gap · [#500](https://github.com/andrew3stedall/Cdl-react/issues/500)**. Owning feature: [team-selection-and-lineup-locking.md](../features/active/team-selection-and-lineup-locking.md).

`services/team_selection.py:288-290` chooses 11/5/4 only for exactly20 players; every other roster size demands3/1/1. `postgres_team_selection.py:544-568` fallback roster assigns only4 bench and5 reserves for20 unless persisted selection fixes it. Current staging seeding prevents the normal case, but new league/unseeded/temporarily incomplete rosters are not a coherent primary UX. **Acceptance:** explicitly guard draft-incomplete states; construct a valid full selection for newly completed rosters; define legal shortage handling; 19-player teams never get misleading demo counts; tests operate without staging seed.

### BD-I1 — Limit repeated historical event refreshes and expose source freshness

**P3 · Operational improvement · [#501](https://github.com/andrew3stedall/Cdl-react/issues/501)**. Owning feature: [fpl-data-access-and-cache.md](../features/active/fpl-data-access-and-cache.md).

`services/fpl_data_service.py:171-175` refetches every started GW on every fixture refresh, even already immutable completed historical GWs. This grows through the season and pairs with silent per-event failures. **Acceptance:** prioritise active/provisional/unsettled events, avoid unnecessary historical refetch unless requested; report last successful hash/fetch, per-event failures, settlement skips and current-live freshness to operators and appropriate compact UI status. Coordinate with infrastructure auditor's schedule observations.

### BD-08 — Isolate checkpoint prototype APIs and catalogues from production gameplay

**P1 · Production surface gap · [#502](https://github.com/andrew3stedall/Cdl-react/issues/502)**. Owning feature: [parallel-development-coordination.md](../features/active/parallel-development-coordination.md).

- **Priority:** P1 production scope/guardrails. **Confidence:** confirmed code and frontend route inventory. Consolidate prototype isolation with auth auditor finding, but track each required feature below as acceptance work.
- **Evidence:** `src/cdl_api/routers/modernisation.py:119-128,413-512` keeps draft state in module globals, fixed two-team picks and demo player pool. `routers/modernisation_squad_movement.py:20-68,147-179,253-263` has one hard-coded draw, one demo loan, import-time deadlines and module-global lists. Primary repository factory (`repositories/factory.py:78-104`) does not create draft/free-agency/loan repositories. `frontend/src/ModernisationCheckpointPage.tsx:39-49,81-96` exposes feature descriptions/API references rather than these gameplay tools. Active documents call checkpoints complete.
- **Specific loose ends:**
  1. Live draft: actual league-season draft setup/order; start/pause/resume/complete; real current-turn clock/timeout; actual measured pick duration (prototype hard-codes 24); persisted manager preselection; concurrent pick uniqueness; current real squad assignment; usable draft room. No currently mounted primary implementation was found.
  2. Free-agency draw: create/configure per league/GW; saved manager preferences; durable draw order/results; ownership eligibility; award actual `player_rights`; deadline expiry; auto-add when legal space exists. Prototype repeats processing and appends duplicate rights without an already-processed guard. `next(...)` has no fallback when all preferences are exhausted. Primary `/interests` does not perform a draw.
  3. Loans: create and approve real loans; four-GW default minimum; lender cap tracking; extend/permanent conversion; scheduled automatic return and ownership audit. Current only return endpoint toggles a demo object's status; no scheduler ownership return path.
  4. Rule configuration/versioning: checkpoint globals mark versions/config state, but primary selection/scoring uses Python constants instead of the active version; formalise which configurable rules are production scope and test enforced effective versions.
- **Acceptance:** inventory prototypes explicitly as development fixtures; isolate them from runtime production; replace chosen production scope with real persistent workflows and end-to-end acceptance tests. Correct feature completion status so descriptions are not mistaken for shipped capability. If features are deferred, remove dead UI entry points and assign milestone/decision.
- **Dependencies:** auth prototype isolation issue, primary league context and membership models, movement BD-07 and ownership repair BD-03.

- **Priority:** P3 cleanup; coordinate production exposure review. **Type:** low product value / deliberate preview surface.
- **Evidence:** App routes at 549-566 remain directly reachable to authenticated managers. Static `ModernisationCheckpointPage` does not fetch the described contracts, and shows seeded issue numbers, API paths and “Implemented feature contracts.” The release inventory explicitly classifies it engineering preview (`docs/testing/release-candidate-inventory.md:26,32`).
- **Recommendation:** keep engineering value in docs/dev tools; explicitly gate/hide direct routes in production. Audit backend prototype route exposure separately rather than assume navigation removal secures it.
- **Acceptance:** production route inventory excludes engineering catalogues; development reference remains reproducible; release claims never count these as completed manager workflows.
- **Dependencies:** runtime route/environment policy. **Risk:** deleting prototype APIs may affect contract tests; feature-flag/diagnostics separation is safer than broad deletion.

Permission evidence: checkpoint mutations accept changed_by/approver_membership_id in payload without deriving commissioner authority from the session. `modernisation.py` update_status/decide_approval and `modernisation_squad_movement.py` ApprovalPayload use caller-supplied/demo identities. Scope of this issue is environment isolation and truthful feature status; real feature implementations are separate children.

**Linked prerequisites / related work:** [AUTH-01 / #467](https://github.com/andrew3stedall/Cdl-react/issues/467).

### J01 — Preserve staged lineup and captaincy when updating a chip

**P1 · Confirmed source / runtime defect · [#503](https://github.com/andrew3stedall/Cdl-react/issues/503)**. Owning feature: [team-selection-and-chip-management.md](../features/active/team-selection-and-chip-management.md).

- Evidence: `frontend/src/SquadPage.tsx:650-675` stages substitutions; `:596-603` stages captaincy; `:741-755` replaces the whole local selection with the chip response. Backend `src/cdl_api/services/team_selection.py:292-323` returns the persisted lineup when updating a chip.
- Reproduction: stage a captain/substitution change, activate a chip, then Save lineup. The server's old lineup overwrites the staged one. Squad card state is not merged on chip update, so it can temporarily display staged roles while save submits the reverted selection.
- Validation: scratch runtime regression reproduced staged Pickford captaincy being saved as false after chip response.
- Acceptance: chip mutations preserve dirty player selections; local roster matches the selection that Save submits; regression covers staged substitution and captaincy followed by chip activation/deactivation. No mixed unsaved/persisted state.
- Dependency: define consistent staged-vs-immediate save semantics (no new product scope required).

### J02 — Show actionable Squad load and mutation feedback visibly

**P1 · Confirmed source / runtime defect · [#504](https://github.com/andrew3stedall/Cdl-react/issues/504)**. Owning feature: [team-selection-and-chip-management.md](../features/active/team-selection-and-chip-management.md).

- Evidence: `frontend/src/SquadPage.tsx:413-419,734-738,756-759,768-770,793-796` all set `status`; its only rendering is `:848-850`, an `sr-only` status. When locked, it renders a generic locked message instead of `status`.
- Reproduction: fail both initial reads, reject Save lineup, reject chip activation, reject a trade, or fail squad changes. The visible screen has no actionable failure feedback for these cases; initial failure can look like an empty squad. Locked mutation feedback is suppressed even for assistive technologies.
- Acceptance: compact visible error/status feedback and Retry where applicable; loading failure differs from empty squad; Save success/failure remains visible and announced; lock description does not replace errors.
- Narrative policy: necessary actionable feedback should stay. Removing all messages would worsen this defect.

### J03 — Add authorized trade accept, reject and cancel controls to Market

**P1 · Incomplete promised workflow · [#505](https://github.com/andrew3stedall/Cdl-react/issues/505)**. Owning feature: [squad-management-scouting-and-transfers.md](../features/active/squad-management-scouting-and-transfers.md).

- Evidence: `frontend/src/MarketPage.tsx:531-535` renders only passive trade articles. `frontend/src/squad-api.ts:SquadClient` has create/read operations but no update trade method. Backend `src/cdl_api/routers/squad.py:213` exposes PUT and `src/cdl_api/services/squad.py:319-340` supports permission-aware accepted/rejected/cancelled transitions.
- Reproduction: create proposal from Squad, visit Market → Trades as recipient or sender. No response/cancel controls exist. Squad explicitly says proposals “need review” but links to Discovery (`SquadPage.tsx:853-856`).
- Acceptance: authorised recipient can inspect assets and accept/reject; sender can cancel; completed trades are read-only; correct status persists and notifications/ownership refresh. Review CTA opens `/scouting/trades`.
- Planning: `docs/features/active/squad-management-scouting-and-transfers.md:96` requires managers to manage proposed trades, so this is unfinished planned scope.

- **Priority:** P2. **Type:** wrong navigation target. **Confidence:** source-confirmed.
- **Evidence:** `frontend/src/SquadPage.tsx:853-857` claims proposals need review but links `/scouting`; `src/cdl_api/services/squad.py:180-190` uses the same `/scouting` for trade notification. Market only selects Trades for `/scouting/trades` (`frontend/src/MarketPage.tsx:578-580`).
- **Impact:** warning action fails to take user to its subject; extra search/tap needed.
- **Issue scope:** use canonical trade activity route for trade review CTAs/notifications. **Out of scope:** full negotiation workflow.
- **Acceptance:** all trade alerts open Trades; no unrelated route needed; back navigation preserves context.
- **Dependencies:** PUR-05 for actionable resolution, but routing fix independent. **Docs:** action URL inventory.

**Linked prerequisites / related work:** [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468); [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495).

### J04 — Recover Compare and Trade after closing a drawer during loading

**P1 · Confirmed source / runtime defect · [#506](https://github.com/andrew3stedall/Cdl-react/issues/506)**. Owning feature: [player-detail-history-and-comparison.md](../features/active/player-detail-history-and-comparison.md).

- Evidence: `frontend/src/SquadPage.tsx:424-445`. Opening sets `scoutingLoading=true`; effect cleanup sets `mounted=false`. Completion/finally then skip all updates. Reopening returns early because `scoutingLoading` remains true.
- Reproduction: throttle scouting, open Compare, close before response, reopen Compare or Trade. No second request and permanent “Loading … players”.
- Validation: scratch runtime test reproduces one request and permanent loading after reopening.
- Acceptance: pending load survives drawer transition safely or is aborted/reset; reopen can retry; Compare→Trade transitions during fetch work; error retry is reachable.

### J05 — Refresh cached pages and live data after mutations and route activation

**P1 · Confirmed source / runtime defect · [#507](https://github.com/andrew3stedall/Cdl-react/issues/507)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `frontend/src/App.tsx:460-639` keeps visited routes mounted with `hidden`; Market load effect `MarketPage.tsx:147-186` only runs on mount; Squad load `SquadPage.tsx:368-422` depends on stable clients; Desk `ManagerDeskPage.tsx:77-100` refreshes on local retry, not navigation or mutations; global notifications `components/ui/global-notifications.tsx:26-39` load once per client.
- Reproduction: visit Market/Desk, change captain/roster/create trade in Squad, return to Market/Desk. Their prior context remains. New incoming trade/injury notification also does not appear during a long running session.
- Acceptance: preserve cached layout/scroll but invalidate dependent data on successful mutations, route activation with a freshness policy, and window visibility/online recovery; stale content is marked when refreshing; no full-page reload required; unsaved Squad drafts are preserved during refresh.
- Dependency: shared invalidation/freshness contract across clients and global notification provider.

- Evidence: `LeaguePage.tsx:93-112` load on mount/reload key; user refresh only exposed in Table. `ManagerDeskPage.tsx:102-105` clock timer updates time only. No score/fixture polling, visibility invalidation, or live transport exists in these components.
- Reproduction: keep live fixture/Desk open while backend scores/status change. “Live” metrics remain initial snapshot indefinitely; fixtures view has no visible refresh.
- Acceptance: documented bounded refresh strategy for active live data, visibility-aware refresh, last update/error indication, one consistent refresh path. Avoid unnecessary hidden-page polling.
- Dependency: J05 freshness/invalidation design.

**Linked prerequisites / related work:** [J01 / #503](https://github.com/andrew3stedall/Cdl-react/issues/503).

### J06 — Allow removed Interests to be added again after reopening a player

**P2 · Confirmed source / runtime defect · [#508](https://github.com/andrew3stedall/Cdl-react/issues/508)**. Owning feature: [player-pool-availability-and-scouting.md](../features/active/player-pool-availability-and-scouting.md).

- Evidence: `frontend/src/MarketPage.tsx:290-292` resets the selected drawer but never clears `players[].status`. `:615-619` carries stale `interested` status through `effectiveStatus`; drawer at `:537-540` then hides Add when interested and hides Remove if interest record is missing.
- Reproduction: add Interest → remove → close drawer → reopen same player. Neither Add nor Remove is available until a full reload. Same issue occurs for an initially interested scouting row removed from the Interests panel.
- Validation: scratch runtime test verifies Add present immediately after remove, then absent after reopening.
- Acceptance: update canonical pool status on remove; derive Interest state from current Interests rather than stale server flags; add-remove-reopen-add regression passes.

### J08 — Finish authoritative searchable Rules with mobile access and canonical links

**P1 · Incomplete promised workflow · [#509](https://github.com/andrew3stedall/Cdl-react/issues/509)**. Owning feature: [rules-knowledge-base.md](../features/active/rules-knowledge-base.md).

- Evidence: `frontend/src/App.tsx:44-96,537-538` hardcodes four rules, including “Validation errors should link to this stable rule identifier”. `frontend/src/rules.ts:36-54` provides API reads that the App never calls. Backend `src/cdl_api/services/rules_service.py:16-104` has nine different skeletal rules and calls the chip rule `chip-use` while frontend/validation uses `chip-usage`.
- Impact: user cannot learn actual roster limits, valid formations, draw/trade/chip effects, auto-sub rules, qualification/tiebreakers, or commissioner decisions. Rule references exist without useful resolving guidance; frontend and backend disagree on IDs.
- Acceptance: authoritative versioned content with all production rules and real constraints; canonical IDs/aliases align service validation and UI; no engineering placeholder sentences; API-driven loading/error/empty/retry or an explicitly maintained single static source. Search covers full rule set.
- Planned: `docs/features/active/rules-knowledge-base.md` claims an implemented foundation but full readable/searchable rules acceptance is unmet; admin editing/version-history are explicitly pending and separate.

- Evidence: `frontend/src/RulesPage.tsx:22,34-43`: filtering uses immutable props; inputs use `defaultValue` without onChange or form submission. App supplies neither query nor category (`App.tsx:537-538`).
- Reproduction: enter “chip” or choose Trades. All four sections remain; controls do not affect data.
- Acceptance: controlled search/category state affects visible sections and contents, empty result state and Clear work, and link/navigation state is usable.

- Evidence: Rules exists only in AppShell sidebar and `desktop-shell-action` (`AppShell.tsx:94-147`), which mobile CSS hides; `GlobalNavigation.tsx` renders only four primary items. ManagerAccountSection offers profile/signout; Profile has no Rules link.
- Reproduction: normal phone navigation cannot reach Rules except a deep link/validation reference; Squad validation messages often print `/rules#...` as plain status text.
- Acceptance: a compact Rules destination in an appropriate existing menu (preserve four main navigation items), with actionable links from validation errors.
- Dependency: J08 usable rule content.

- Evidence: `frontend/src/RulesPage.tsx:26-40` omits `feature-screen` and a shared PageHero; filters/content are bare sections with no page-specific stylesheet. `:30-33` displays “Rules Knowledge Base” and “Searchable rule sections with stable identifiers for validation errors.” `frontend/src/App.tsx:46-102` supplies four rule entries containing development prose such as “Validation errors should link to this stable rule identifier.”
- Impact: this reachable support route has a different header, typography and control layout from the four primary screens, and its user-visible content mixes rules with implementation instructions. The rule body content itself is an app-completeness issue to coordinate with the functionality audit.
- Acceptance: use the shared page/header and settings/list foundations; remove implementation narration; real league rules and compact meaningful version/source metadata; usable mobile search/category layout and working filter interactions. Preserve needed rule content—actual rules are not prohibited narrative slop.

**Linked prerequisites / related work:** [BD-D1 / #498](https://github.com/andrew3stedall/Cdl-react/issues/498); [BD-D2 / #499](https://github.com/andrew3stedall/Cdl-react/issues/499).

### J10 — Keep League and commissioner management usable when optional reads fail

**P1 · Confirmed source / runtime defect · [#510](https://github.com/andrew3stedall/Cdl-react/issues/510)**. Owning feature: [league-fixtures-and-table.md](../features/active/league-fixtures-and-table.md).

- Evidence: `frontend/src/league-api.ts:336-354` requires all six fixture/table/knockout/head-to-head requests via Promise.all; `LeaguePage.tsx:254-266` renders all content, including commissioner management, only if snapshot is available. UI never consumes knockout/headToHead fields (`LeagueContent :427-432`).
- Reproduction: `/league/knockout` or `/league/head-to-head` returns 500 while fixtures/table/management succeed. Entire League and commissioner management are unavailable.
- Acceptance: fetch only required data for active content or represent independent partial failures; fixtures remain usable if table/knockout fails, management loads independently, each unavailable panel offers retry; no inferred standings fallback.

### J11 — Expose supported knockout and head-to-head context in League

**P2 · Incomplete promised workflow · [#511](https://github.com/andrew3stedall/Cdl-react/issues/511)**. Owning feature: [league-fixtures-and-table.md](../features/active/league-fixtures-and-table.md).

- Evidence: `LeaguePage.tsx:59-60,427-432,1485-1489` only renders Fixtures/Table/Manage. HttpLeagueClient still fetches/maps knockout and headToHead (`league-api.ts:336-354`). `/league/knockout` and `/league/head-to-head` silently resolve to ordinary fixtures.
- Acceptance: make available knockout bracket and matchup history discoverable in League with phase-appropriate context, or explicitly defer them behind documented release scope; no fake route success or unused blocking fetches.
- Planned scope: `docs/features/active/league-fixtures-and-table.md` requires accessible data; `knockout-brackets-and-tiebreakers.md` and `gameweek-centre-and-fixture-detail.md` describe the missing UI. This is unfinished planned work, not an unplanned embellishment.

**Linked prerequisites / related work:** [BD-09 / #496](https://github.com/andrew3stedall/Cdl-react/issues/496).

### J12 — Represent notification loading, failures and alert counts honestly

**P2 · Confirmed source / runtime defect · [#512](https://github.com/andrew3stedall/Cdl-react/issues/512)**. Owning feature: [notifications-activity-and-deadline-service.md](../features/active/notifications-activity-and-deadline-service.md).

- Evidence: `components/ui/global-notifications.tsx:23,32-34,88` initializes empty, swallows failures into empty, and uses same empty copy for all states.
- Reproduction: slow/error notification request, open bell. It claims no outstanding items without verified data; no retry.
- Acceptance: loading/unavailable/empty states distinct, compact retry, existing notifications retained as stale on refresh failure.

- Evidence: `components/ui/global-notifications.tsx:69,80-86` counts all derived alerts as “unread”; no mark-read action/client. `docs/features/active/notifications-activity-and-deadline-service.md:46-49` explicitly states endpoint does not claim durable unread state.
- Impact: opening/action never clears unread count; recurrent availability alerts appear as unread indefinitely. The product UI makes a stronger claim than the API.
- Acceptance: label count accurately as alerts until durable read state exists; if unread is delivered, define persistent read/unread API and behaviour. Keep that larger scope tracked separately.

### J14 — Add a real Market retry action and distinguish failed reads from empty data

**P2 · Confirmed source / runtime defect · [#513](https://github.com/andrew3stedall/Cdl-react/issues/513)**. Owning feature: [squad-management-scouting-and-transfers.md](../features/active/squad-management-scouting-and-transfers.md).

- Evidence: `MarketPage.tsx:175-178` says “Try again from the shell reload control”; `AppShell.tsx` has no reload control; Market has no reload trigger. Cached Market only loads at mount `:186`.
- Reproduction: fail Market reads, restore API, switch tabs/pages/back. Failure remains until browser reload.
- Acceptance: inline Retry reloads required data; per-tab request failures are distinguishable from empty data; avoid “No trade proposals”/“No Interests” before reads finish or when their read failed.

### J16 — Refresh Market form history when same-length fixture data changes

**P2 · Confirmed source / runtime defect · [#514](https://github.com/andrew3stedall/Cdl-react/issues/514)**. Owning feature: [player-detail-history-and-comparison.md](../features/active/player-detail-history-and-comparison.md).

- Evidence: `MarketPage.tsx:201-205` updates drawer formHistory only when grouped history lengths differ; it also never updates the underlying list row.
- Reproduction: existing GW points/minutes are corrected or live GW accumulates another fixture with the same grouped length. Official history table refreshes but form dots can retain stale points/minutes/split fixtures.
- Acceptance: use authoritative fetched fixture history when available; update matching row/drawer; cover same-length points corrections, minutes changes, double-GW additions.

**Linked prerequisites / related work:** [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507).

### J17 — Separate committed squad changes from subsequent refresh failures

**P2 · Confirmed source / runtime defect · [#515](https://github.com/andrew3stedall/Cdl-react/issues/515)**. Owning feature: [squad-management-scouting-and-transfers.md](../features/active/squad-management-scouting-and-transfers.md).

- Evidence: `SquadPage.tsx:777-794` applyChanges completes before sequential lineup and rights reads, all inside one catch; staged request remains if either read fails. `PlayerProfilePage.tsx:326-334` similarly waits for lineup read before reporting roster success.
- Reproduction: POST squad changes succeeds, next GET selection/rights returns 500. UI says unable to save/remove even though server committed. User can retry a mutation whose original rights have been consumed.
- Acceptance: separate mutation outcome from refresh outcome; committed action shown as saved with refresh unavailable; staged batch cleared once committed; retry reloads data rather than reposts; use transaction/idempotency if needed through backend owner.

**Linked prerequisites / related work:** [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490).

### J18 — Prevent duplicate trade proposals during pending submission

**P2 · Confirmed source / runtime defect · [#516](https://github.com/andrew3stedall/Cdl-react/issues/516)**. Owning feature: [transfers-loans-and-negotiations.md](../features/active/transfers-loans-and-negotiations.md).

- Evidence: `SquadPage.tsx:761-770` has no saving flag/guard; `TradeDrawer :1583-1587` disables Send only when no target. Backend `services/squad.py:294-310` generates a new ID and saves every valid create.
- Reproduction: double-tap Send trade proposal on slow network. Two independent requests/proposals can be created.
- Acceptance: pending guard/disabled button with short feedback; backend idempotency/dedup if required; retry after rejection remains possible; successful creation updates Market/notifications via J05.

**Linked prerequisites / related work:** [J03 / #505](https://github.com/andrew3stedall/Cdl-react/issues/505).

### J19 — Show a meaningful upcoming-fixture state when lineup previews are absent

**P2 · Confirmed source / runtime defect · [#517](https://github.com/andrew3stedall/Cdl-react/issues/517)**. Owning feature: [gameweek-centre-and-fixture-detail.md](../features/active/gameweek-centre-and-fixture-detail.md).

- Evidence: `LeaguePage.tsx:1407,1434-1436`: comparison only when exactly two squads; missing-squad message only for `!isPreview`.
- Reproduction: pending fixture squads endpoint returns [] or one published squad. Loaded drawer shows header with no squads or empty explanation.
- Acceptance: clear compact “lineups unavailable” state for upcoming fixtures; partial squad state defined; error retry doesn't require leaving the drawer.

### J20 — Keep known player identity and controls visible while history loads

**P2 · Confirmed source / runtime defect · [#518](https://github.com/andrew3stedall/Cdl-react/issues/518)**. Owning feature: [player-detail-history-and-comparison.md](../features/active/player-detail-history-and-comparison.md).

- Evidence: `PlayerProfilePage.tsx:131-165` sets loading until player, history and lineup all settle; `:353-355` renders a replacement loading-only screen even when initialPlayer/initialSelection are already known.
- Impact: first uncached FPL history can block identity and basic player controls; drawer close/header is absent while loading (outer backdrop/Escape remain). New player opening can visibly collapse static profile layout then expand.
- Acceptance: show known player/header/close immediately, load chart sections independently, disable only actions whose requisite data is missing, stable chart placeholders reserve space, retry failed sections.

**Linked prerequisites / related work:** [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507).

### J22 — Make supported routes and League view URLs explicit

**P3 · Confirmed source / runtime defect · [#519](https://github.com/andrew3stedall/Cdl-react/issues/519)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- Evidence: `navigation.ts:90-109` defaults unknown route to desk; `App.tsx:519-639` renders Desk fallback. League toggle `LeaguePage.tsx:224` uses setView rather than navigation, despite `/league/table` and `/league/manage` route support.
- Reproduction: typo `/scoutng`, old unsupported `/league/knockout`, or bookmark/share after clicking Table/Manage. URL either misleadingly succeeds or remains `/league` and reload opens Fixtures.
- Acceptance: explicit supported compatibility aliases, clear not-found for unknown destinations; table/manage state agrees with URL and browser Back/Forward. Product need not add new primary navigation.

### PUR-06 — Complete ranked free-agency preferences, processing and awarded rights

**P1 · Conditional launch gate · [#520](https://github.com/andrew3stedall/Cdl-react/issues/520)**. Owning feature: [free-agency-draws.md](../features/active/free-agency-draws.md).

- **Priority:** P1 if free-agent draws are in first production scope. **Type:** incomplete planned workflow.
- **Evidence:** `frontend/src/MarketPage.tsx:53-58,523-527` renders an unranked collection with only view/remove. POST at 257-262 carries only player_id; no draw ID, priority or ordering. No current/completed draw, public results, manager won/missed result or draw context surface exists in Market modes (`29,308-311`).
- **Plan:** `docs/features/active/free-agency-draws.md:11-20,45-64`; `docs/product/feature-placement-and-navigation.md` Watchlist/Interests requires ranked drag/direct-number/accessible up-down ordering. Prototype seeded draw is separate at `src/cdl_api/routers/modernisation_squad_movement.py:39-50,142-177`.
- **Issue scope:** define and persist draw-specific ranked preferences; show draw deadline/state/results and connect rights to existing squad activation. **Out of scope:** unrelated new acquisition models.
- **Acceptance:** preferences scoped to active draw, deterministically reordered, private, locked after deadline; processing/results/rights expiry are real; empty/no-open-draw state is explicit.
- **Dependencies:** actual draw service/configuration, privacy, temporary-right lifecycle. **Risk:** a flat generic Interest list must not be falsely represented as complete draw submission. **Docs:** live versus prototype completion states.

Backend acceptance details: persistent per-league/gameweek draw configuration, deterministic saved order/results, eligibility and actual player_rights. Processing must be idempotent; prototype duplicate rights and exhausted-preference next(...) failure are not production behavior. Clearly block or defer draw UI if this workflow is excluded from first release.

**Linked prerequisites / related work:** [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468); [BD-02 / #490](https://github.com/andrew3stedall/Cdl-react/issues/490); [BD-03 / #491](https://github.com/andrew3stedall/Cdl-react/issues/491).

### PUR-07 — Deliver or explicitly defer the persistent live draft room

**P2 · Future deadline gate · [#521](https://github.com/andrew3stedall/Cdl-react/issues/521)**. Owning feature: [live-draft-room.md](../features/active/live-draft-room.md).

- **Priority:** P2 for current-season launch; P1 before next draft. **Type:** incomplete planned feature.
- **Evidence:** no draft component/navigation/route in App. `src/cdl_api/routers/modernisation.py:112-127,413-433` contains four fake players, two hard-coded teams and module-global draft state; this is not the persistent live league.
- **Plan:** `docs/features/active/live-draft-room.md:9,13-24,57-66` says Checkpoint 1 complete while requiring live board/current turn, clocks, preselection, autopick and commissioner controls.
- **Issue scope:** implementation epic for persistent/authenticated draft with concurrency, connected player pool and real assignments. **Out of scope:** rebuilding for launch of an already drafted league.
- **Acceptance:** real managers can complete draft without duplicates; reconnect/current turn and timeout handling work; commissioner actions audited; picks create canonical squad assignments.
- **Dependencies:** league season setup/rules/player pool. **Risk:** module-global prototypes lose state and should never be counted as actual delivery. **Docs:** relabel prototype completion and explicit next-draft target.

**Linked prerequisites / related work:** [PUR-08A / #522](https://github.com/andrew3stedall/Cdl-react/issues/522); [PUR-08B / #523](https://github.com/andrew3stedall/Cdl-react/issues/523).

### PUR-08A — Complete or explicitly defer league and season setup management

**P2 · Planned incomplete · [#522](https://github.com/andrew3stedall/Cdl-react/issues/522)**. Owning feature: [league-season-team-model.md](../features/active/league-season-team-model.md).

- **Priority:** P2 for current league; P1 if independent commissioners must manage production without operators. **Type:** incomplete planned features.
- **Evidence:** `frontend/src/LeaguePage.tsx:436-570` only loads team assignment list and generates/copies invite links. No league creation, season switcher/setup, rule version editor/history, approvals queue or audit/correction UI.
- **Plan:** league model `docs/features/active/league-season-team-model.md:52-58`; rules `league-configuration-and-rule-versioning.md:51-56`; approvals `permissions-approvals-and-admin-audit.md:45-62` all state checkpoint completion.
- **Issue scope:** separate child items for (a) league/season setup/switch/history, (b) rule configuration/versioning, (c) approval queue/conflict-of-interest/corrections/audit. **Out of scope:** changing rules or adding powerful unreviewed edits during this audit.
- **Acceptance:** only authorized commissioner can perform each action; immutable corrections tied to mandatory reason; self-approval prevented; historical rule version retained; clear empty/permission/error states.
- **Dependencies:** production service contracts and approved configuration boundaries. **Risk:** bulk edits and corrections can corrupt results; stage by operation. **Docs:** commissioner capability matrix that clearly labels invitations as implemented and other controls planned.

**Bounded scope for this child:** league creation, season setup/switch/history; exclude rule editors and approval workflow. Separate related setup/configuration/approval children avoid one broad commissioner rewrite.

### PUR-08B — Connect versioned league rule configuration to runtime enforcement

**P2 · Planned incomplete · [#523](https://github.com/andrew3stedall/Cdl-react/issues/523)**. Owning feature: [league-configuration-and-rule-versioning.md](../features/active/league-configuration-and-rule-versioning.md).

- **Priority:** P2 for current league; P1 if independent commissioners must manage production without operators. **Type:** incomplete planned features.
- **Evidence:** `frontend/src/LeaguePage.tsx:436-570` only loads team assignment list and generates/copies invite links. No league creation, season switcher/setup, rule version editor/history, approvals queue or audit/correction UI.
- **Plan:** league model `docs/features/active/league-season-team-model.md:52-58`; rules `league-configuration-and-rule-versioning.md:51-56`; approvals `permissions-approvals-and-admin-audit.md:45-62` all state checkpoint completion.
- **Issue scope:** separate child items for (a) league/season setup/switch/history, (b) rule configuration/versioning, (c) approval queue/conflict-of-interest/corrections/audit. **Out of scope:** changing rules or adding powerful unreviewed edits during this audit.
- **Acceptance:** only authorized commissioner can perform each action; immutable corrections tied to mandatory reason; self-approval prevented; historical rule version retained; clear empty/permission/error states.
- **Dependencies:** production service contracts and approved configuration boundaries. **Risk:** bulk edits and corrections can corrupt results; stage by operation. **Docs:** commissioner capability matrix that clearly labels invitations as implemented and other controls planned.

**Bounded scope for this child:** versioned effective rule configuration and enforcement; exclude league setup and approval queue. Separate related setup/configuration/approval children avoid one broad commissioner rewrite.

### PUR-08C — Deliver commissioner approvals, corrections and an auditable action history

**P2 · Planned incomplete · [#524](https://github.com/andrew3stedall/Cdl-react/issues/524)**. Owning feature: [permissions-approvals-and-admin-audit.md](../features/active/permissions-approvals-and-admin-audit.md).

- **Priority:** P2 for current league; P1 if independent commissioners must manage production without operators. **Type:** incomplete planned features.
- **Evidence:** `frontend/src/LeaguePage.tsx:436-570` only loads team assignment list and generates/copies invite links. No league creation, season switcher/setup, rule version editor/history, approvals queue or audit/correction UI.
- **Plan:** league model `docs/features/active/league-season-team-model.md:52-58`; rules `league-configuration-and-rule-versioning.md:51-56`; approvals `permissions-approvals-and-admin-audit.md:45-62` all state checkpoint completion.
- **Issue scope:** separate child items for (a) league/season setup/switch/history, (b) rule configuration/versioning, (c) approval queue/conflict-of-interest/corrections/audit. **Out of scope:** changing rules or adding powerful unreviewed edits during this audit.
- **Acceptance:** only authorized commissioner can perform each action; immutable corrections tied to mandatory reason; self-approval prevented; historical rule version retained; clear empty/permission/error states.
- **Dependencies:** production service contracts and approved configuration boundaries. **Risk:** bulk edits and corrections can corrupt results; stage by operation. **Docs:** commissioner capability matrix that clearly labels invitations as implemented and other controls planned.

**Bounded scope for this child:** permission-aware approvals queue, conflict-of-interest/vice-commissioner decisions, corrections with reasons and audit; exclude league setup and rule editor. Separate related setup/configuration/approval children avoid one broad commissioner rewrite.

**Linked prerequisites / related work:** [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468); [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495).

### PUR-09 — Deliver or explicitly defer loans and scheduled player returns

**P2 · Planned scope / improvement · [#525](https://github.com/andrew3stedall/Cdl-react/issues/525)**. Owning feature: [transfers-loans-and-negotiations.md](../features/active/transfers-loans-and-negotiations.md).

- **Priority:** P2 / explicit defer recommendation. **Type:** incomplete planned feature.
- **Evidence:** no production loan UI/action found. Prototype `src/cdl_api/routers/modernisation_squad_movement.py:52-61,251-259` uses one seeded loan and return endpoint that updates only module-global flags.
- **Plan:** `docs/features/active/transfers-loans-and-negotiations.md:11-23,47-62` requires agreement, approval, minimum duration, automatic return, extension and permanent conversion.
- **Issue scope:** loan lifecycle epic after transfer approval is established. **Out of scope:** current launch if loans deferred.
- **Acceptance:** canonical player rights/assignments move transactionally; future return/extension/convert actions enforced and auditable; correct squad-cap accounting; manager UI shows return deadline.
- **Dependencies:** rights model, negotiation/approval, gameweek scheduler. **Risk:** prototype return status is not evidence of actual squad return. **Docs:** mark deferred and prevent misleading availability claims.

**Linked prerequisites / related work:** [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495); [BD-03 / #491](https://github.com/andrew3stedall/Cdl-react/issues/491).

### PUR-10 — Track private watchlists and notes separately from draw Interests

**P3 · Planned scope / improvement · [#526](https://github.com/andrew3stedall/Cdl-react/issues/526)**. Owning feature: [player-pool-availability-and-scouting.md](../features/active/player-pool-availability-and-scouting.md).

- **Priority:** P3 / enhancement backlog. **Type:** incomplete planned scouting feature.
- **Evidence:** Market modes have discovery/Interests/trades only; no bookmark collection, notes or notification preference controls. Prototype watchlist endpoint exists at `src/cdl_api/routers/modernisation_competition_experience.py:245-251`.
- **Plan:** `docs/features/active/player-pool-availability-and-scouting.md:17-19,52-67`; separate concepts required in `docs/product/feature-placement-and-navigation.md`.
- **Issue scope:** genuine private bookmarks/notes separate from current draw preferences. **Out of scope:** force it into production critical path.
- **Acceptance:** bookmarks do not register draw preferences; notes private per user; alert preferences meaningful and persisted if provided.
- **Dependencies:** user-scoped storage and notification event service. **Risk:** conflation with Interests causes unintended draw actions. **Docs:** future target and clear feature status.

### PUR-13 — Remove concrete narrative and developer prose from live app components

**P2 · Confirmed copy inconsistency · [#527](https://github.com/andrew3stedall/Cdl-react/issues/527)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

- **Priority:** P2. **Type:** confirmed UI-copy inconsistency.
- **Rule:** `AGENTS.md`, UI / UX Standards: “Do not add narrative or explanatory prose to app components. Use compact labels, values, controls, and actionable status or error feedback instead.”
- **Specific live copy inventory:**
  - `frontend/src/LeaguePage.tsx:1366`: standings sorting explainer plus future implementation remark about previous-table comparison.
  - `frontend/src/LeaguePage.tsx:1379-1382`: separate Standings source card explaining service versus persisted snapshot internals; retain Refresh action in compact toolbar.
  - `frontend/src/ManagerDeskPage.tsx:527`: “Only your starting XI is highlighted here; bench and reserve injuries stay out of the desk.” This describes implementation/display policy instead of user action. Same component uses long captaincy prose beside already explicit risk/title/actions.
  - `frontend/src/ManagerDeskPage.tsx:531`: “The deadline has passed. Review the submitted lineup and gameweek context.” Repeats locked status/action.
  - `frontend/src/ManagerDeskPage.tsx:537`: “Act now to give yourself a chance…” / “Register preferred free agents…” beside draw countdown and Add Interests. Keep count/deadline.
  - `frontend/src/SquadPage.tsx:856`: “Trade activity is managed in Market.” Redundant beside proposed-count and Review CTA.
  - `frontend/src/SquadPage.tsx:1514`: “Compare up to three players in the order you select them.” Replace with compact limit/status if needed.
  - `frontend/src/PlayerProfilePage.tsx:473`: formation-validation substitution explainer. `500`: squad replacement explainer. Keep clear consequential action confirmation and constraints, expressed compactly.
  - `frontend/src/FixtureDifficultyPage.tsx:71`: “Compare fixture difficulty by team, gameweek range, and attacking or defensive view.” Repeats the filters.
  - `frontend/src/AnalyticsDashboardPage.tsx:122`: “Explore manager performance through allowlisted metrics, dimensions, and filters.” Uses backend implementation jargon. `193-195` also prints chart type plus arbitrary widget description on every card.
  - `frontend/src/RulesPage.tsx:29`: “Searchable rule sections with stable identifiers for validation errors.” Developer framing rather than rules content.
  - `frontend/src/ProfilePage.tsx:1278`: pitch-orientation explainer beneath a direction toggle; `1839` saved-palette editability description. Lower-impact than paragraphs above; simplify if labels suffice.
  - `frontend/src/ModernisationCheckpointPage.tsx:145-190,203-238`: summaries and API contract catalogue; appropriate engineering material but should not be manager-facing in production.
- **Not slop:** actual Rules body, FPL news, actionable errors/status, invite assignment progress, numeric metric/count/captain labels, compact control choices and accessible descriptions. Do not delete essential warnings blindly.
- **Issue scope:** precise copy pass across current live pages, moving developer provenance to operator details/docs, using labels/actions for routine guidance. **Out of scope:** removing rule content or critical decision context.
- **Acceptance:** listed paragraphs removed/reduced to meaningful labels; controls/errors remain comprehensible; audit mobile/desktop/light/dark layouts after copy height changes.
- **Dependencies:** shared header spacing audit. **Risk:** over-removal can hide consequences; explicit confirmation still needed for squad removal. **Docs:** copy inventory and no-narrative review guideline.

### PUR-15 — Retire the superseded Market implementation after migrating useful tests

**P3 · Planned scope / improvement · [#528](https://github.com/andrew3stedall/Cdl-react/issues/528)**. Owning feature: [squad-management-scouting-and-transfers.md](../features/active/squad-management-scouting-and-transfers.md).

- **Priority:** P3. **Type:** maintenance cleanup / superseded implementation.
- **Evidence:** `frontend/src/SquadManagementPage.tsx:136-517` contains a second full discovery/Interests/trades implementation with old narrative copy, filters and styling; no non-test consumer imports it. `frontend/src/App.tsx:591-592` routes live Market to `MarketPage`; `/squad-management` routes to Squad, not this component. Its own tests continue to target the obsolete component.
- **Recommendation:** inventory useful tests, move relevant real workflow assertions to Market, then deliberately retire/archive unused component and exclusive CSS/tests after compatibility verification. Keep TeamSelection compatibility wrappers: they intentionally render canonical Squad and do not have the same duplication problem.
- **Acceptance:** one production Market implementation; browser/component tests exercise actual route; obsolete-only tests no longer appear as release evidence; no retained external import broken.
- **Dependencies:** test coverage mapping. **Risk:** deleting without checking test/route imports can remove the only meaningful scenario test.

### PUR-16 — Define contextual access or explicit deferral for Analytics and FDR

**P3 · Planned scope / improvement · [#529](https://github.com/andrew3stedall/Cdl-react/issues/529)**. Owning feature: [analytics-dashboard.md](../features/active/analytics-dashboard.md).

- **Priority:** P3 scope/discoverability decision. **Type:** implemented but inaccessible/low present usage.
- **Evidence:** App renders pages at `frontend/src/App.tsx:569-570,587-588`, but primary/utility/context navigation at `navigation.ts:42-79` does not link to either. No live frontend onNavigate/href entry to Analytics or `/fdr` was found; `/profile/fdr` is preference editing, not the FDR screen. `/fdr` actions exist only in `static-preview-clients.ts`. FDR is explicitly described as contextual, not a fifth primary item, in `docs/features/active/squad-management-scouting-and-transfers.md` and release inventory line32.
- **Plan:** both have active feature specs; these are not abandoned features. Analytics PostgreSQL drill-down is explicitly empty until persisted fact contract (`docs/testing/release-candidate-inventory.md:18`).
- **Recommendation:** choose either compact contextual access plus full data acceptance, or explicit exclusion/defer from first production scope. Do not add a fifth bottom-nav item contrary to current four-item direction.
- **Acceptance:** every supported screen has an actual discoverable entry; unavailable drill-down is not promoted as useful action; deferred screens are documented and do not expand launch gating silently.
- **Dependencies:** data/source and UX ownership. **Risk:** hidden-but-broken routes can complicate prod acceptance while offering little actual value.

### PUR-18 — Reconcile roadmap, feature status and release scope with the current app

**P2 · Planning integrity gap · [#530](https://github.com/andrew3stedall/Cdl-react/issues/530)**. Owning feature: [implementation-sequencing-roadmap.md](../features/active/implementation-sequencing-roadmap.md).

- **Priority:** P2 planning integrity. **Type:** documentation/issue-state drift.
- **Evidence:** `docs/features/active/implementation-sequencing-roadmap.md:9-13` says Checkpoint 5 complete and “project does not need an early production release”; current user objective is getting to production faster. Active docs for draft/draws/loans/watchlists/season/rules administration say complete although corresponding product UI is absent. `docs/product/feature-placement-and-navigation.md` requires separate Matchweek and says Squad must not own weekly editing, whereas newer `docs/features/active/team-selection-and-chip-management.md:5-19,39` and current code intentionally own editing in Squad. Current route inventory still says Preferences is not promoted/product-owned and Rules remains primary navigation (`docs/testing/release-candidate-inventory.md:24-25`), despite Profile being accessible and Rules now utility navigation. Open #96 contains an older 29 July boundary and calls trade controls a future product decision; #70/#75/#78 retain unchecked staging provisioning/deployment items although repository now contains deployed-staging feature notes. These cannot be blindly checked without live evidence.
- **Issue scope:** reconcile feature status into prototype / UI implemented / persisted / tested live / deferred; replace old five-nav ownership text with canonical four-nav model; update #96/#70/#75/#78/#111 using actual evidence and link concrete child backlog.
- **Acceptance:** each planned capability has one current source/status/owner/target; completion claims separated from prototype contracts; launch scope and gate evidence match audited runtime; no source conflict about where lineup editing belongs.
- **Dependencies:** consolidated audit and live deployment evidence. **Risk:** marking old checklists complete from code alone repeats the same false confidence. **Docs:** roadmap, route inventory, active feature indexes, relevant issue trackers.

- Evidence: `docs/features/active/application-shell-navigation-and-presets.md:62` says selected accents are “preserved exactly in every mode; only the neutral interface surfaces change”. `frontend/src/theme-colours.ts:25-38` and `:77-112` define intentionally different light/dark template values; `ProfilePage.tsx:1468` saves pairs. The user's newer requirement explicitly requests a companion selection for the other appearance.
- Impact: future work could “fix” the correct companion templates back to one identical palette or write the wrong acceptance tests.
- Acceptance: active feature doc, wiki and preference schema describe independent light/dark variants, custom companion generation/override rules and backward compatibility; document selected fill versus accessible text tokens. Cross-link UI-02/03/04.

- **Priority:** P3 product recommendation, not defect or silently approved change.
- **Recommendation:** prioritize secure invite/login/team assignment → view current fixture/table → change/save legal lineup/captain/chip → scoring/lock correctness → real acquisition/transfer actions if promised → safe operations/persistence/restore. Treat next live draft, new league/season authoring, loans, watchlists/notes, advanced analytics and historical archive UI as explicit later milestones unless necessary to current league operation. Schedule knockout before its actual use, not because prototype docs say done.
- **Why this helps:** separates real blockers from large planned features and dead scaffolding; avoids repeatedly polishing passive UI around an unfinished workflow; lets GitHub issues drive a coherent sequence.
- **Acceptance:** one current production scope matrix with capability/route/data proof/test proof/operational gate and explicit excluded functionality; no issue closed solely because schema, API stub or screenshot exists.
- **Dependencies:** root audit priorities. **Risk:** unresolved acquisition/approval semantics are launch blockers if managers are expected to use those features; they cannot be deferred while left visibly actionable.

### V4 — Add current-contract browser and real PostgreSQL release journeys

**P1 · Evidence gap · [#531](https://github.com/andrew3stedall/Cdl-react/issues/531)**. Owning feature: [domain-test-strategy-and-parity-tests.md](../features/active/domain-test-strategy-and-parity-tests.md).

- Severity: **P1 release confidence**. Candidate single issue for production regression gate; avoid splitting each test file into an issue.
- Evidence: `.github/workflows/app-screenshots.yml:4` runs browser interactions/axe/screenshots only on manual `workflow_dispatch`. PR/main `.github/workflows/ci.yml` runs jsdom Vitest rather than browser tests. `scripts/capture-app-screenshots.mjs:230` mocks all API traffic; its team-selection fixture at line 42 has 15 players, includes Wildcard at line 63, and old demo teams (instead of current CDL squad/chip contracts). It covers eight broad routes, not commissioner/invite flow or the settings subpages/custom palette/drawer behavior central to recent changes.
- PostgreSQL workflow does exist and applies Alembic. However `.github/workflows/backend-postgres.yml:33` selects a limited list; auth identity tests use SQLite (`tests/test_postgres_identity_repositories.py:14`) and team-selection tests use capturing sessions/overridden `get_players` (`tests/test_postgres_team_selection_api.py:42,53`). PostgreSQL naming alone is not proof these release paths ran against PostgreSQL.
- Impact: current green checks do not catch production auth omissions, unassigned-user isolation, cross-page freshness, database-level invite races, browser geometry changes, or real multi-manager workflows. The existing checks remain valuable for their narrower scope.
- Acceptance / scope: automate a current-contract browser smoke suite on PR or release candidate; maintain deterministic visual/axe checks for mobile portrait and landscape, dark/light/adaptive mode, four primary pages, settings palette, player drawers, invite/commissioner states; add real PostgreSQL two-manager auth/invite/lineup/chip/save/reload tests; include explicit empty/error/loading states; do not treat mocked screenshot tests as integration evidence.
- Dependencies: V1–V3 and known scoring/ownership corrections should acquire their own focused regressions. This gate then exercises integrated release paths.
- Documentation: record exact local/CI browser and database validation commands and explicitly label mocked, SQLite, actual PostgreSQL, and deployed-staging evidence separately.

Preserve the user's manual screenshot workflow: this issue does not require automatic screenshot collection. Add focused browser interaction/layout invariants at the chosen release gate; deterministic mock visuals remain separate from real API/database integration evidence.

**Linked prerequisites / related work:** [AUTH-01 / #467](https://github.com/andrew3stedall/Cdl-react/issues/467); [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468); [AUTH-03 / #469](https://github.com/andrew3stedall/Cdl-react/issues/469); [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507).

### EXT-01 — Track durable activity, read state and deadline reminders as separate scope

**P3 · Planned incomplete · [#532](https://github.com/andrew3stedall/Cdl-react/issues/532)**. Owning feature: [notifications-activity-and-deadline-service.md](../features/active/notifications-activity-and-deadline-service.md).

The current provider derives alerts from squad state and has no durable events/read/dismiss/reminder service. The active notifications feature explicitly defers these capabilities. Immediate misleading unread/error behavior is covered by J12; do not block that correction on this larger feature.

- Evidence: `frontend/src/components/ui/global-notifications.tsx:23-39,69-88`; `docs/features/active/notifications-activity-and-deadline-service.md:46-51`.
- Acceptance: decide release scope; if delivered, per-user durable events and read state persist across sessions, reminder cadence is explicit, delivery is retryable/idempotent and privacy enforced; if deferred, mark current surface as derived alerts with no unsupported promises.

**Linked prerequisites / related work:** [J12 / #512](https://github.com/andrew3stedall/Cdl-react/issues/512).

### EXT-02 — Track CDL player ownership history and richer comparisons explicitly

**P3 · Planned incomplete · [#533](https://github.com/andrew3stedall/Cdl-react/issues/533)**. Owning feature: [player-detail-history-and-comparison.md](../features/active/player-detail-history-and-comparison.md).

Current PlayerProfile renders FPL form/history/opponent charts, and Squad has an actual comparison drawer. Planned CDL ownership/transfer/loan history and richer comparisons are not fully represented; do not claim all comparison is absent.

- Evidence: `docs/features/active/player-detail-history-and-comparison.md:41-57`; `frontend/src/PlayerProfilePage.tsx` and `frontend/src/SquadPage.tsx`.
- Acceptance: publish supported-versus-deferred comparison/history matrix; if delivered, show persisted dated CDL ownership/movement with privacy and immutable league-season context; existing FPL profile and compact comparison remain usable.

**Linked prerequisites / related work:** [BD-04 / #492](https://github.com/andrew3stedall/Cdl-react/issues/492).

### IMP-01 — Give commissioners an explicit pending invite and revocation lifecycle

**P3 · Optional policy decision · [#534](https://github.com/andrew3stedall/Cdl-react/issues/534)**. Owning feature: [league-season-team-model.md](../features/active/league-season-team-model.md).

Invite tokens are random and hashed; regenerating an invite revokes the old link, but no explicit pending-invites/revoke view or expiration policy is exposed.

- Evidence: `src/cdl_api/repositories/league_memberships.py:210-218` stores no expires_at; current commissioner view creates/copies per-team links only.
- Acceptance: settle validity/expiry policy, show compact pending invite status, allow authorized revocation, reject revoked/expired tokens, preserve successful assigned memberships. Do not invent a required expiration duration.

**Linked prerequisites / related work:** [AUTH-03 / #469](https://github.com/andrew3stedall/Cdl-react/issues/469).

### IMP-02 — Plan safe assigned-team release and manager reassignment

**P3 · Optional policy decision · [#535](https://github.com/andrew3stedall/Cdl-react/issues/535)**. Owning feature: [permissions-approvals-and-admin-audit.md](../features/active/permissions-approvals-and-admin-audit.md).

An already assigned team cannot be released/reassigned through the commissioner screen; useful when the wrong Google identity claims a team or a manager is replaced.

- Evidence: `frontend/src/LeaguePage.tsx:551-552`; team-specific invites target open teams only.
- Acceptance: define who may release/reassign, required confirmation/audit reasons, prior-user access revocation, session behavior and preservation of team/fixture history. Implement only once ownership policy is explicit; no casual destructive button.

**Linked prerequisites / related work:** [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468).

### IMP-03 — Measure mobile cold-load cost and split optional code where justified

**P3 · Measured size / performance hypothesis · [#536](https://github.com/andrew3stedall/Cdl-react/issues/536)**. Owning feature: [application-shell-navigation-and-presets.md](../features/active/application-shell-navigation-and-presets.md).

The audited production build emits one 587.73 kB JavaScript bundle (161.85 kB gzip) and 282.10 kB CSS (41.78 kB gzip), with a >500 kB bundle warning. App statically imports optional Analytics/FDR/checkpoint surfaces. This is a measured asset-size finding, not a measured claim of slow device performance.

- Evidence: `npm run build` on audited SHA; `frontend/src/App.tsx` static route imports.
- Acceptance: measure cold-load/interaction on a representative phone/network; establish a reasonable budget; split or remove verified unused optional routes/styles only where measurement justifies it; preserve cached routes, splash and stable header geometry.

**Linked prerequisites / related work:** [UI-V01 / #485](https://github.com/andrew3stedall/Cdl-react/issues/485).

## Route and purpose inventory

| Route or surface | Actual behaviour | Completion / purpose classification |
| --- | --- | --- |
| `/`, `/dashboard`, `/team` | Manager Desk | Product implemented; contains compact fixture/urgency surfaces plus prose noted below. |
| `/squad`, `/team-selection`, `/squad-management` and nested aliases | Canonical Squad with lineup/chips, player profile, comparison, trade proposal and staged squad actions | Product implemented with compatibility aliases. Weekly editing belongs here in current code, although older product document says a separate Matchweek page. |
| `/scouting` | Market discovery | Product implemented. Current compact display intentionally omits availability/status filters; do not reintroduce them as an assumed audit fix. |
| `/scouting/interests` | Flat Interest list with remove/detail actions | Product partial; ranked draw preferences and draw/results context missing. |
| `/scouting/trades` | Read-only trade list | Product partial; proposal creation lives in Squad, resolution/counterparty UI absent. |
| `/league`, `/league/fixtures`, `/league/table` | Fixture carousel and standings | Product implemented. Knockout/head-to-head data loaded but not rendered. |
| `/league/manage` | Commissioner team assignments and team-specific invite links | Product implemented for invitations; full commissioner management remains planned. |
| `/join/{token}` | Invite authentication/join | Product implemented; reviewed by authentication auditors separately. |
| `/account*`, `/profile*`, result-colour subroute | Account and appearance | Product implemented; several compatibility aliases, no app-purpose objection. |
| `/players/{id}` | Standalone player profile | Product implemented. Query parameters are not interpreted as a compare mode; `/players/compare` matches a player ID rather than implementing the suggested compare route. Squad comparison is real, so do not claim all comparison is absent. |
| `/rules*` | Four hard-coded generic rule sections | Product partial with inert visible filters and incomplete content. |
| `/fdr*` | Standalone FDR | Implemented dedicated page, but no live product navigation/CTA discovered. |
| `/dashboard/analytics*`, `/analytics*` | Separate analytics screen | Implemented dedicated page, direct-link only; some drill-down functionality documented as empty in PostgreSQL mode. |
| `/modernisation/checkpoint-1` … `-5` | Static engineering contract catalogue | Deliberately preview-only per release inventory; low manager value and full of internal API paths. |
| Unknown route | Desk is default content | No not-found state; incorrect URLs can appear to work. |
| `SquadManagementPage` component | Superseded combined Market implementation | Not imported by production frontend; maintained tests do not prove live Market behaviour. |
| `TeamSelectionPage` / `TeamSelectionPanel` exports | Compatibility wrappers around SquadPage | Explicitly documented compatibility intent. Not a second maintained lineup implementation; no removal defect. |

Routing evidence: `frontend/src/App.tsx:516-614`; `frontend/src/navigation.ts:24-79,98-111`; canonical wrapper `frontend/src/SquadWorkspacePage.tsx:15-20`; compatibility exports `frontend/src/TeamSelectionPage.tsx:10-22`.

## Duplicate finding crosswalk

This crosswalk ensures every specialist observation is accounted for without duplicate implementation issues.

| Specialist IDs | Consolidated work |
| --- | --- |
| PUR-01/PUR-02, J07/J08/J09, UI-09 | [J08 / #509](https://github.com/andrew3stedall/Cdl-react/issues/509) — real Rules, working search, mobile access and matching page style |
| PUR-03, J06 | [J06 / #508](https://github.com/andrew3stedall/Cdl-react/issues/508) — Interest remove/reopen state |
| PUR-04/PUR-05, J03 | [J03 / #505](https://github.com/andrew3stedall/Cdl-react/issues/505) — correct Trades navigation and response controls; actual execution separate in [BD-07 / #495](https://github.com/andrew3stedall/Cdl-react/issues/495) |
| PUR-11, J10/J11 | [J10 / #510](https://github.com/andrew3stedall/Cdl-react/issues/510) — partial failure isolation; [J11 / #511](https://github.com/andrew3stedall/Cdl-react/issues/511) — contextual UI; engine in [BD-09 / #496](https://github.com/andrew3stedall/Cdl-react/issues/496) |
| PUR-12, J12/J13 | [J12 / #512](https://github.com/andrew3stedall/Cdl-react/issues/512) — honest alerts/error states; freshness in [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507); durable service in [EXT-01 / #532](https://github.com/andrew3stedall/Cdl-react/issues/532) |
| J05/J15, V3 | [J05 / #507](https://github.com/andrew3stedall/Cdl-react/issues/507) — mutation invalidation, activation and live refresh |
| UI-06, J21 | [UI-06 / #482](https://github.com/andrew3stedall/Cdl-react/issues/482) — shared accessible modal lifecycle across affected surfaces |
| PUR-14, BD-08 | [BD-08 / #502](https://github.com/andrew3stedall/Cdl-react/issues/502) — isolate engineering catalogues and prototype APIs |
| PUR-17, J22 | [J22 / #519](https://github.com/andrew3stedall/Cdl-react/issues/519) — strict routes and URL/back-forward state |
| UI-10, PUR-18/PUR-19 | [PUR-18 / #530](https://github.com/andrew3stedall/Cdl-react/issues/530) — current status, paired palette contract and release scope |
| AUTH-01/V1, AUTH-02/V2 | [AUTH-01 / #467](https://github.com/andrew3stedall/Cdl-react/issues/467); [AUTH-02 / #468](https://github.com/andrew3stedall/Cdl-react/issues/468) — independent corroboration, no duplicate issue |
| OPS-03/V4 | [V4 / #531](https://github.com/andrew3stedall/Cdl-react/issues/531) — current-contract browser and real PostgreSQL journeys |
| OPS-04 | Existing [#71](https://github.com/andrew3stedall/Cdl-react/issues/71), linked to #70/#78 — operational evidence gate |
| BD-08 feature subitems | Draft [PUR-07 / #521](https://github.com/andrew3stedall/Cdl-react/issues/521); draws [PUR-06 / #520](https://github.com/andrew3stedall/Cdl-react/issues/520); loans [PUR-09 / #525](https://github.com/andrew3stedall/Cdl-react/issues/525); rule config [PUR-08B / #523](https://github.com/andrew3stedall/Cdl-react/issues/523) |
| Commissioner missing capabilities | Separate setup [PUR-08A / #522](https://github.com/andrew3stedall/Cdl-react/issues/522), rules [PUR-08B / #523](https://github.com/andrew3stedall/Cdl-react/issues/523), approvals/corrections [PUR-08C / #524](https://github.com/andrew3stedall/Cdl-react/issues/524) |

## Useful foundations and hypotheses deliberately excluded

- Shared PageHero, global bell content, four-item bottom navigation, compact player card and five-band form mapping already exist. Keep these foundations; this audit does not recommend rebuilding the app.
- Main Desk/Squad/Market/League screens have useful purposes. Draft, loans, watchlists and advanced analytics have actual plans; absence of delivery is not evidence of purposelessness.
- `TeamSelectionPage` and `TeamSelectionPanel` are intentional wrappers around canonical Squad, not a separate maintained lineup implementation. Keep compatibility until verified consumers are gone. Only the unused full `SquadManagementPage` merits retirement review.
- The goalkeeper position CSS token is consistent; an early suspicion was checked and excluded.
- Legacy route-specific padding declarations do not by themselves prove current double gutters; later shared CSS overrides them. [UI-V02 / #486](https://github.com/andrew3stedall/Cdl-react/issues/486) verifies before cleanup.
- Current ordinary auto-rollout does not run a destructive seed reset. The reset workflow is separate and checks an explicit commit marker before execution. Keep this healthy safeguard.
- Commissioner invite creation checks role permissions; invite tokens are random and stored hashed. Passkeys enforce user verification/one-time challenges. The access findings concern environment/member enforcement and missing lifecycle paths, not a claim that every auth primitive is broken.
- Do not remove necessary rules text, player news, consequential confirmations, actionable errors or accessible summaries in the name of compact copy.
- Analytics/FDR discoverability is a supported-scope choice, not an instruction to add a fifth bottom navigation item.

## Additional improvement notes

- Native PWA manifest currently fixes teal theme and light background (`frontend/public/manifest.webmanifest:10-11`). Actual installed OS startup appearance was not inspected. Validate deliberate startup branding alongside [UI-05 / #481](https://github.com/andrew3stedall/Cdl-react/issues/481) and [UI-V04 / #488](https://github.com/andrew3stedall/Cdl-react/issues/488); the in-app persisted splash fix does not prove the OS launch surface matches.
- Account name/email are read-only (`ProfilePage.tsx:357-374`). Verified provider email need not be editable. If managers need nicknames, scope a separate display-nickname field through #466; this is an optional preference decision, not a current identity defect.
- Put developer provenance/API-source details in docs/operator diagnostics. Compact labels, values, error recovery and chart details serve managers better than routine explanatory cards.
- Treat checked-in schema, prototype endpoint, screenshot and a complete end-to-end manager workflow as different delivery states. Each issue should close with the matching evidence.

## Independent reproduction appendix


Scope: read-only inspection of current local checkout and isolated Python in-memory/session-stub reproductions. No source, tests, database, deployment, or GitHub mutation performed. Browser verification was unavailable; no rendered layout, contrast, or screen position is asserted from this work. Root validation reports frontend lint/typecheck/build and 187 tests passed; backend lint/format and 402 tests passed with 18 skipped. These counts do not establish production readiness.

### V1 — Production API authentication boundary is absent; anonymous chip writes succeed

- Severity: **P1 production blocker**. Merge into auth boundary finding rather than duplicate issue.
- Evidence: `src/cdl_api/app.py:30` registers access middleware only for `environment == "staging"`; `src/cdl_api/routers/team_selection.py:98,111` use optional-user repository selection without a mandatory authenticated write dependency.
- Isolated reproduction (actual `create_app` and routers, local memory repository; no live database):

```bash
CDL_ENVIRONMENT=production CDL_REPOSITORY_MODE=memory .venv/bin/python - <<'PY'
from fastapi.testclient import TestClient
from cdl_api.app import create_app
client = TestClient(create_app())
for path in ['/api/team-selection', '/api/squad/summary', '/api/league/fixtures', '/api/interests', '/openapi.json']:
    print(path, client.get(path).status_code)
selection = client.get('/api/team-selection').json()
chip = next(c for c in selection['chips'] if c['status'] == 'available')
response = client.put(f"/api/team-selection/chips/{chip['id']}", json={'active': True})
print(response.status_code, [(c['id'], c['status']) for c in response.json()['chips']])
PY
```

- Observed: team selection, squad summary, league fixtures, and OpenAPI each **200** anonymously; interests **401**; chip write **200**, with `triple-captain` becoming `active`.
- Impact: production configuration permits some private reads and team selection writes anonymously even though some neighboring routes correctly enforce auth. This does not claim the currently deployed staging instance is publicly writable.
- Regression requirements: parameterize public/private route matrix for staging and production; anonymous/expired-session mutations must fail before repository side effects; only intended auth bootstrap, invite preview, health, and public frontend routes bypass protection; verify actual production settings and PostgreSQL mode. Preserve public local-development previews only under explicit development configuration.
- Existing misleading protection: `tests/test_staging_access.py:74` confirms the boundary is inactive outside staging, rather than asserting production protection.

### V2 — Unassigned authenticated user falls back to Exeter Gently

- Severity: **P1 access-control blocker**. Merge into manager membership isolation finding.
- Evidence: resolver in `src/cdl_api/staging_draft_seed.py:598` returns `None` when user has no manager row; PostgreSQL squad and team-selection constructors establish `PRIMARY_TEAM_ID`/`PRIMARY_MANAGER_ID` before lookup and retain them on missing context (`postgres_squad_repository.py:194`, `postgres_team_selection.py:166`).
- Independent isolated reproduction used actual resolver and actual constructors, with an empty-result session stub (representing no matching manager rows). No resolver/constructor monkeypatch and no database access:

```python
from cdl_api.staging_draft_seed import resolve_staging_manager_context
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository


class Result:
    def mappings(self):
        return self

    def first(self):
        return None

    def __iter__(self):
        return iter([])


class Session:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def execute(self, statement):
        return Result()


factory = lambda: Session()
print(resolve_staging_manager_context(factory, "new-unassigned-user"))
for cls in [PostgreSQLSquadRepository, PostgreSQLTeamSelectionRepository]:
    repo = cls(factory, user_id="new-unassigned-user")
    print(cls.__name__, repo.manager_team.id, repo.manager_team.name, repo._manager_id)
```

- Observed: resolver returns `None`; both repositories select **team-exeter-gently / Exeter Gently / manager-1**.
- Limit: this validates real resolution/control-flow behavior, not a live PostgreSQL HTTP exploit. Actual role/login policy determines which unassigned users reach specific mutations.
- Regression requirements: a signed-in unassigned user must receive an explicit join/no-team state and zero access to another manager's data or mutations; two managers must read/write only their assigned context; revoked membership loses access; invite acceptance supplies the intended context immediately. Use real PostgreSQL with at least two managers and one unassigned user.

### V3 — Page caching preserves stale data indefinitely between routes

- Severity: **P1 correctness / live experience**. Merge into cross-page data freshness finding.
- Evidence: `frontend/src/App.tsx` retains each visited route under `hidden`; `LeaguePage.tsx:91` fetches only on client/reload-key changes; `ManagerDeskPage.tsx:77` fetches only on client/reload-request changes. Desk's timer at line 103 updates a displayed clock, not the data. No focus/visibility/activation revalidation or shared mutation invalidation is present on these paths.
- Existing test `frontend/src/AppShell.test.tsx:313` intentionally verifies `getLeagueSnapshot` was called **once** after navigating away and back. Keeping the component mounted is useful; treating mount-only data as permanently fresh is the problem.
- Reproduction sequence: open League or Desk; change lineup/chip elsewhere or let the backend settle/live-update a fixture; return to the cached page. Its previous data remains until an explicit relevant refresh or full app reload. Source-confirmed behavior; not browser-observed during this audit.
- Regression requirements: preserve mounted scroll/view state while revalidating stale page data on activation/window focus, invalidate affected surfaces after successful mutations, poll appropriate active fixtures without background-page duplication, display last successful freshness succinctly if materially stale, and verify deadline/lock transition. Test changed backend responses on route return rather than only call-count caching.

### V4 — Release regression coverage does not exercise current app contracts end to end

- Severity: **P1 release confidence**. Candidate single issue for production regression gate; avoid splitting each test file into an issue.
- Evidence: `.github/workflows/app-screenshots.yml:4` runs browser interactions/axe/screenshots only on manual `workflow_dispatch`. PR/main `.github/workflows/ci.yml` runs jsdom Vitest rather than browser tests. `scripts/capture-app-screenshots.mjs:230` mocks all API traffic; its team-selection fixture at line 42 has 15 players, includes Wildcard at line 63, and old demo teams (instead of current CDL squad/chip contracts). It covers eight broad routes, not commissioner/invite flow or the settings subpages/custom palette/drawer behavior central to recent changes.
- PostgreSQL workflow does exist and applies Alembic. However `.github/workflows/backend-postgres.yml:33` selects a limited list; auth identity tests use SQLite (`tests/test_postgres_identity_repositories.py:14`) and team-selection tests use capturing sessions/overridden `get_players` (`tests/test_postgres_team_selection_api.py:42,53`). PostgreSQL naming alone is not proof these release paths ran against PostgreSQL.
- Impact: current green checks do not catch production auth omissions, unassigned-user isolation, cross-page freshness, database-level invite races, browser geometry changes, or real multi-manager workflows. The existing checks remain valuable for their narrower scope.
- Acceptance / scope: automate a current-contract browser smoke suite on PR or release candidate; maintain deterministic visual/axe checks for mobile portrait and landscape, dark/light/adaptive mode, four primary pages, settings palette, player drawers, invite/commissioner states; add real PostgreSQL two-manager auth/invite/lineup/chip/save/reload tests; include explicit empty/error/loading states; do not treat mocked screenshot tests as integration evidence.
- Dependencies: V1–V3 and known scoring/ownership corrections should acquire their own focused regressions. This gate then exercises integrated release paths.
- Documentation: record exact local/CI browser and database validation commands and explicitly label mocked, SQLite, actual PostgreSQL, and deployed-staging evidence separately.

### Coordinated domain reproductions

Backend domain agent independently ran actual-method scratch reproductions and reported Auto Captain **39 versus expected 34**, a valid DEF-to-DEF swap failing because league-wide owned players are counted, provisional fixture inclusion plus stored bonus omission in standings, and historical event **99 overriding frozen 10**. That agent owns exact evidence and findings; these are not duplicated here. Its focused existing tests passed despite the exposed edge cases.

### Recommended release sequence

1. Access boundary and manager/membership isolation.
2. Scoring, roster validation, historical result correctness.
3. Shared data freshness / mutation invalidation.
4. Current-contract browser and real PostgreSQL production regression gate before promoting the reviewed staging build.

Current local checks passing should be reported alongside skipped PostgreSQL and unavailable browser/deployed-state validation, not as an app-wide all-clear.

