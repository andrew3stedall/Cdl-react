# Production retrospective follow-up

## Status

Audit and backlog complete; the original implementation and corrective rollouts are merged and deployed to staging. All 70 findings are now being reconciled and completed in [execution batches](../../delivery/466-execution-batches.md). Parent milestone tracker: [#466](https://github.com/andrew3stedall/Cdl-react/issues/466).

## Source of truth

[Full retrospective, issue index and acceptance criteria](../../audits/2026-10-03-production-retrospective.md), audited at `ca642efdce1ab03020342353676a6d1bf46bad7e` on 3 October 2026 Melbourne time.

## Scope

70 child issues: 24 P1, 35 P2, 11 P3. Cover access isolation/onboarding, scoring and ownership integrity, visible manager workflows, cache/live freshness, styles/palettes/typography/static geometry, copy/scaffolding and production evidence. Planned later capabilities are explicit scope decisions, not silently required for first launch.

## Dependency order

1. Agree current production scope/rules and truthful feature status (#530).
2. Secure sessions/team assignment and returning-member Google login (#467–#469).
3. Correct scoring/ownership/history/lineup state (#489–#497, #503–#507).
4. Finish exposed trades/draws, Rules and recoverable failure states.
5. Verify compact UI, modal, colour, typography and invariant geometry.
6. Prove real PostgreSQL/browser and dated recovery gates (#531, existing #71).

## Acceptance

- Every exposed first-release action completes safely and persists per manager.
- No anonymous or cross-team mutations; no inferred official result from a failed final data fetch.
- Scoring explanations reconcile immutable snapshots to fixture/table totals.
- Shared static header/nav elements remain stable through loading, navigation, theme and commissioner states, proved by device/browser evidence.
- Current rules and capability status accurately distinguish implemented, prototype, deferred and live-tested.
- Future draft/loans/watchlists/analytics scope has explicit targets or deferral and guarded surfaces.
- Production operational evidence is dated and linked; no launch inferred from green unit tests or health only.

## Audit baseline validation

Local frontend checks and 187 tests passed; backend Ruff/format and 402 tests passed, 18 skipped. Targeted scratch reproductions confirm defects, not fixes. Browser unavailable; live signed-in and recovery gates remain unproven. No data/API/cloud/runtime changes made in this audit.

## Cross-feature ownership

Each child links its existing active feature document. Any implementation changing shared rules, API contracts, ownership or persistence must update the affected owning docs together. This follow-up records the backlog; it does not silently approve unresolved rule/launch decisions.

## Delivery evidence

[Capability and parked decision register](../../delivery/466-release-scope.md) and the lane records under `docs/delivery/466-*.md` describe actual implemented work and its limits. PR #538 is the historical first integration; the execution index records current batches. A historical checkpoint label must not be treated as a completed persistent production workflow.
