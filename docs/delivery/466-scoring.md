# #466 Scoring and Competition Delivery

Branch: `milestone/466-scoring` · baseline: `b9b1794`

This lane addresses scoring correctness, completed-fixture explanations, official versus live standings, unattended lineup repair, FPL source freshness, roster readiness, and knockout progression. It does not include schema changes or external deployment actions.

## Implemented in this delivery

- Auto Captain now gives one 2x multiplier to the highest-scoring scoring-lineup player. Equal scores resolve by the existing deterministic lineup slot order. The original captain receives no second multiplier. Frozen snapshots now keep base points, multiplier, final points, inclusion, slot, captaincy, and scoring reason per scoring player.
- Completed fixture player detail reads frozen snapshot values before the mutable event-live cache. Older frozen snapshots without per-player explanations retain their frozen final total and are labeled `legacy_frozen_total`.
- Table reads have explicit `official` and `live` modes. Official calculations count finalised fixtures only; the default is official. Stored bonus awards are included as awarded, without guessing how an automatic award is earned. Legacy, synthetic, unkeyed, or stale table snapshots no longer override a fresh official calculation.
- Ownership changes and scheduled rollover can call `PostgreSQLTeamSelectionRepository.repair_unlocked_lineups` within the same transaction. It repairs unlocked future rows, preserves valid selections and slot order, and leaves locked history untouched.
- Incomplete squads no longer get demo `3/1/1` lineup requirements. The selection contract reports the actual roster size and blocks submission until all 20 roster slots are filled.
- Formation validation, substitution checks, and the checkpoint validator now share the accepted 1 GKP, 3–5 DEF, 2–5 MID, 1–3 FWD limits. The six-formation checkpoint list was stale; the shared ranges enumerate every legal eleven-player combination.
- Event-live refresh avoids refetching completed historical gameweeks when a cache exists, records per-event failures, and prevents a failed refresh newer than the cached payload from being used to finalise a result. Cache rows expose the successful fetch time used by settlement.
- `/league/knockout` has additive status/bracket/tie/leg fields for a bracket UI contract. A deterministic domain engine seeds documented 1v4/2v3 and bottom-two pairings and resolves ties by aggregate then scoring-lineup goals; it reports an aggregate-and-goals tie as unresolved. Persisted schedule generation and winner progression remain incomplete.

## Rules still requiring product evidence

- **#494 league automatic bonus criteria:** the accepted decision says win/draw points plus automatic bonuses, and persisted awards are now counted. No active document defines eligibility, points units, or how settlement calculates an award. Do not synthesize awards until an approved league rule or authoritative legacy source supplies those criteria.
- **#499 captain and vice-captain fallback:** active rules state chip multipliers and require captain/vice in the starting XI, but do not define DNP/zero-minute fallback or Best XI omission behavior. No official FPL fallback is inferred. Auto Captain tie order is explicit above because the current implementation already orders equal scores by lineup slot.
- **#496 incomplete bracket paths:** the active document supports top-four two-leg semi-finals/final/third-place playoff and a bottom-two two-leg final after a GW36 bye. It describes 5th/6th only as having “similar” playoff/final mechanics, with no pairings or tie progression. An aggregate-and-goals tie also has no second-level decision. The API can truthfully report not-ready, partially-configured, and unresolved tie states; no winner is invented.

## Validation

- Full backend suite: 411 passed, 18 skipped. Ruff checks passed for changed Python files; bytecode compilation passed.
- No migrations, GitHub changes, cloud changes, or staging deployment were performed.
