# Lineup and Scoring Guide

## Lineups

Lineups roll forward each gameweek until changed or confirmed. The FPL deadline locks the lineup and any active chip.

Lineup sections:

- Starting XI
- Bench
- Reserves

Reserves are never considered for scoring.

## Substitutions

Normal substitutions apply when a starter plays 0 minutes. Bench order determines priority and substitutions must preserve a valid formation.

## Scoring

Fixture scores are calculated from:

- locked lineup
- FPL event-live player points
- substitutions
- captain/vice rules
- chip effects
- automatic bonus points

Final results are frozen against score snapshots so history does not drift.


## Final-source settlement guard

Official scores for a non-synthetic completed fixture require a verified final event-live source. The ordinary event-live cache may support provisional scoring, but it is not sufficient after FPL reports finished=true and data_checked=true. When the final refresh fails, operators can use the per-event fetch log and the fixture result's settlement_skipped_reason=final_event_live_unverified to distinguish a held settlement from a missing fixture.
