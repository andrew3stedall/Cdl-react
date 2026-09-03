# 2026-09-02 — Automatic substitutions

Completed CDL fixtures now apply ordinary automatic substitutions during final
FPL settlement.

- A starter is eligible to be replaced only when the completed event-live
  payload explicitly reports zero minutes.
- Playing bench players are considered in saved bench order.
- Goalkeeper compatibility and the 3–5 DEF / 2–5 MID / 1–3 FWD formation
  constraints are enforced for every replacement.
- Bench Boost and Best XI retain their existing special scoring behaviour.
- Applied substitutions are stored in the frozen score snapshot and the new
  `lineup_substitutions` audit table.
- Historical fixture squads show `IN` and `OUT` markers for applied changes.
- Historical fixture views retain the locked lineup positions: a substitute
  remains in the bench slot and receives the effective points, while the
  replaced starter remains in the starting slot and is shown greyscaled at
  reduced opacity.
