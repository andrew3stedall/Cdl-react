# Deferred and consolidated issue register

**Reviewed:** 9 October 2026 (Australia/Melbourne)  
**Repository:** `andrew3stedall/Cdl-react`  
**Audit baseline:** [3 October retrospective](../audits/2026-10-03-production-retrospective.md) · [70-finding execution index](../delivery/466-execution-batches.md) · [release capability matrix](../delivery/466-release-scope.md)

## Why this exists

Keep the GitHub **Open** queue limited to work that has a current, independent action or a material release gate. Closing an issue as **not planned** means **not planned for the present release**, not that the feature was implemented or permanently rejected. Historic requirements and implementation evidence remain in the linked issues and feature documents. A new issue can be opened later using these links and the reactivation conditions below.

The user's **three-month inactivity rule** was checked against **9 July 2026**. None of the 17 open issues reviewed on 9 October had an `updated_at` before that date. The cleanup below is therefore a **scope/duplication/completion review**, *not* an automatic stale-issue closure. Date of original creation is not inactivity. Issue comments, closed-status transitions and bot activity can change displayed activity timestamps; use actual product demand before reactivating.

**Result of this pass:** 17 open issues reviewed; 11 selected for closure (6 explicitly deferred, 2 implemented with device-evidence handoff, 2 redundant coordinators, 1 delivered workflow); 6 retained. The parent [#466](https://github.com/andrew3stedall/Cdl-react/issues/466) audit has 70 child findings; these closures reduce its remaining open children from 10 to 2, with the deferrals documented here. These numbers describe disposition, **not** complete acceptance of all 70.

## Deferred: not part of the current single-league staging release

| Issue | Already available / why no active ticket is needed | Future work and reactivation condition | Dependency / suggested timing |
| --- | --- | --- | --- |
| [#522 — league and season setup](https://github.com/andrew3stedall/Cdl-react/issues/522) | Current single-league memberships, invites and team ownership function. Self-service creation and context switching are **not implemented**. | Accept dynamic active league/season context, stable `season_teams` identity, migration/history model, authorized create/switch/start actions and regression tests. **Do not create another draft over live squads.** | **Time-boxed exception:** the next-season draft is targeted for **1 August 2027**. Re-plan this dependency well in advance (recommended by **April 2027**); see the unaccepted [context ADR](../architecture/league-season-context-prerequisite-adr.md) and previously deferred [#521](https://github.com/andrew3stedall/Cdl-react/issues/521). |
| [#523 — rule configuration and versioning](https://github.com/andrew3stedall/Cdl-react/issues/523) | Accepted rules can already be recorded as immutable snapshots. A commissioner-facing rules editor and general configurable runtime enforcement are **not implemented**. | Define authorization, effective date, activation, history, allowed field matrix and evaluation for each relevant gameplay action before opening a rules-editing interface. Never reinterpret frozen results. | Reactivate for configurable leagues/rules **after** fixed scoring contract [#499](https://github.com/andrew3stedall/Cdl-react/issues/499) and knockout policy [#496](https://github.com/andrew3stedall/Cdl-react/issues/496) are settled. |
| [#524 — commissioner corrections and general audit](https://github.com/andrew3stedall/Cdl-react/issues/524) | Trade approval/rejection and append-only participant/approver audit have been implemented. General commissioner corrections, reversals, conflict handling and broader history UI have **not**. | Specify actor/authority, independent approval, reason, reversibility, past-result/ownership effects and immutable event trail. Do not expose destructive corrections before policies and tests exist. | Reactivate when commissioners need operations beyond invites and approved trades, or before supporting independent commissioners. |
| [#525 — advanced loans](https://github.com/andrew3stedall/Cdl-react/issues/525) | Persisted basic loan approval, ownership movement, minimum constraints and retryable due returns are implemented. Extensions, permanent conversions, fees, complex effective dates and downstream recomputation remain **unspecified**. | Define extension/conversion agreements, rights, dates, fees, roster limits, scheduled job behavior and idempotent audit/recomputation before exposing new controls. | Reactivate when advanced loans become an actual league rule; preserve basic loan and return functionality. |
| [#533 — player movement history/comparisons](https://github.com/andrew3stedall/Cdl-react/issues/533) | A league-scoped ownership-period API and basic player history and comparisons exist. Richer loan-versus-transfer explanations and further comparison eligibility are **not implemented**. | Provide explicit ownership-movement event types, immutable season and historical display names, permissions, and useful comparison measures before expanding the drawer. | Reactivate after [#522](https://github.com/andrew3stedall/Cdl-react/issues/522) settles historical season identity or when users request a concrete comparison. |
| [#536 — mobile cold-load optimisation](https://github.com/andrew3stedall/Cdl-react/issues/536) | Optional route chunks are separated and a **235 kB gzip** initial-transfer CI budget is present. Remaining cold-start slowness is an **unverified hypothesis**, not a reproduced user defect. | Measure actual handset cold load, LCP and interaction on representative network, set a performance target, then optimise only proven bottlenecks. Preserve stable route/header and navigation caching. | Reactivate on an observed regression or measured unacceptable performance; never split code purely because a single bundle warning once appeared. |

## Implemented source; outstanding physical-device proof moved to release acceptance

These closures mean no distinct implementation ticket remains. **They do not assert a successful physical-device test.** The remaining proof belongs to active [#96 — release readiness](https://github.com/andrew3stedall/Cdl-react/issues/96), with go-live gate [#71](https://github.com/andrew3stedall/Cdl-react/issues/71).

| Issue | Delivered implementation | Verification still required in #96 |
| --- | --- | --- |
| [#472 — passkey management](https://github.com/andrew3stedall/Cdl-react/issues/472) | Add/list/revoke/re-add passkeys in Profile, with authenticated owner checks. | Real Android and iOS WebAuthn registration, second-device registration, revocation, login with remaining key, and fallback/recovery. |
| [#488 — viewport/safe areas](https://github.com/andrew3stedall/Cdl-react/issues/488) | Safe-area padding, dynamic-height colour sheets, and browser-resize tests protecting the Apply button above bottom navigation. | Installed PWA and browser portrait/landscape on real phone; notch/bottom home indicator, soft keyboard, dynamic browser chrome and palette actions. |

## Consolidated tracking / delivered pipeline

| Closed issue | Closure rationale | Live owner of anything outstanding |
| --- | --- | --- |
| [#75 — persistence and GCP coordinator](https://github.com/andrew3stedall/Cdl-react/issues/75) | Nested coordination duplicates specific technical and release tickets. The persistence milestone [#77](https://github.com/andrew3stedall/Cdl-react/issues/77) was previously closed. Do **not** infer that production is ready. | [#70 staging](https://github.com/andrew3stedall/Cdl-react/issues/70), [#71 production](https://github.com/andrew3stedall/Cdl-react/issues/71), [#96 release evidence](https://github.com/andrew3stedall/Cdl-react/issues/96). |
| [#78 — GCP milestone coordinator](https://github.com/andrew3stedall/Cdl-react/issues/78) | A second coordinator duplicates [#70](https://github.com/andrew3stedall/Cdl-react/issues/70)/[#71](https://github.com/andrew3stedall/Cdl-react/issues/71) and carries outdated early-bootstrap checkboxes. | Keep actual staging backup, restore, observability, rollback, production approval and deployment gates open in **#70/#71**. |
| [#111 — staging Terraform apply pipeline](https://github.com/andrew3stedall/Cdl-react/issues/111) | Review-controlled plan/apply, keyless workflow, migration and staging rollout exist, with later hosted rollout evidence. Its original statement that the workflow **never applies** is obsolete. | Proving repeatability from a **fresh project**, operational restore and recovery remains in **#70**; this closure makes **no** claim that a fresh-project disaster-recovery rehearsal has been performed. |

## Previously closed, expressly deferred scope to keep visible

These are not counted again in this pass.

| Existing issue | Future boundary |
| --- | --- |
| [#521 — next-season draft](https://github.com/andrew3stedall/Cdl-react/issues/521) | A persistent configured-season draft exists. Next-season activation target **1 August 2027**, gated by #522 league/season context; do not reset live ownership. |
| [#532 — durable alerts/reminders](https://github.com/andrew3stedall/Cdl-react/issues/532) | Current derived alerts are not persistent notifications. Revisit event lifecycle, unread state, channel/cadence and retention after release evidence. |
| [#535 — assigned-team release/reassignment](https://github.com/andrew3stedall/Cdl-react/issues/535) | No destructive reassignment control. Requires commissioner policy, reason/approval, revoked sessions, identity and historical ownership preservation after #522. |

## Remain open — do not sweep into future backlog

| Issue | Why it remains |
| --- | --- |
| [#499 — captain/vice fallback](https://github.com/andrew3stedall/Cdl-react/issues/499) | Live scoring may diverge when captain or vice does not play, especially with chips and Best XI. A concrete league policy and tests are needed. |
| [#496 — knockout progression](https://github.com/andrew3stedall/Cdl-react/issues/496) | Current-season knockout winner/progression still needs unresolved fifth/sixth path and equal-aggregate/equal-goals tiebreak. Must be resolved **well before GW36**; don't silently pick a winner. |
| [#70 — staging operations](https://github.com/andrew3stedall/Cdl-react/issues/70) | Backup/restore drill, resilience, monitoring and staging lifecycle operational evidence remain explicit gates. |
| [#71 — production release](https://github.com/andrew3stedall/Cdl-react/issues/71) | Production plan, deployment approvals, restore/rollback proof and go-live gate are not complete. |
| [#96 — implementation / test readiness](https://github.com/andrew3stedall/Cdl-react/issues/96) | Primary executable release evidence, real-device passkeys/layout, live reviewer acceptance and remaining tests. |
| [#466 — audit coordinator](https://github.com/andrew3stedall/Cdl-react/issues/466) | Maintains accurate disposition of all 70 audit findings and remaining #496/#499; completion cannot be inferred from number closed. |

## Reactivation checklist

When an actual new requirement arises, use the linked original issue as a historical specification, not as proof that the work exists. Create a small new issue referencing this register with: (1) why now; (2) exact supported-versus-missing user journey; (3) final policy/authority; (4) data and historical invariants; (5) bounded acceptance and real tests; (6) deployment or device gates. Remove or revise the corresponding row only when the work is accepted.

**Important:** no cloud infrastructure, account permissions, data, schemas, deployed app code or gameplay rules were changed as part of this issue-pruning exercise.
