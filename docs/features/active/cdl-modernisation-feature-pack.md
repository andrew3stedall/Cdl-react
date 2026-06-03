# CDL Modernisation Feature Pack

Status: Checkpoint 3 implementation contracts are in progress on `checkpoint-3-squad-movement`.

## Purpose

This index groups the agreed CDL redesign work into implementable feature documents. The intent is to support development without reverting to a like-for-like migration of the legacy PHP application.

## Checkpoint history

- Checkpoint 1 completed in PR #50: league/season setup, rule versioning, permissions/approvals/audit, FPL cache freshness, live draft contracts, and squad rights/availability contracts.
- CI for PR #50 passed backend lint/format/pytest and frontend lint/test/build before merge.
- Checkpoint 2 completed in PR #51: team selection, substitutions, chips, fixture scoring snapshots, and league table movement contracts.
- CI for PR #51 passed backend lint/format/pytest and frontend lint/test/build before merge.
- Checkpoint 3 covers free agency draws, transfers/loans, notifications, activity, and deadlines in issues #33, #31, and #46.

## Foundation

- [x] `league-season-team-model.md` (#27)
- [x] `league-configuration-and-rule-versioning.md` (#28)
- [x] `permissions-approvals-and-admin-audit.md` (#29)

## Squad movement

- [x] `squad-rights-and-assignments.md` (#30)
- [x] `transfers-loans-and-negotiations.md` (#31)
- [x] `live-draft-room.md` (#32)
- [x] `free-agency-draws.md` (#33)

## Weekly gameplay

- [x] `fpl-data-access-and-cache.md` (#34)
- [x] `team-selection-and-lineup-locking.md` (#35)
- [x] `substitution-engine.md` (#36)
- [x] `chips-and-scoring-modifiers.md` (#37)

## Scoring and competition

- [x] `fixture-scoring-snapshots-and-finalisation.md` (#39)
- [x] `league-table-and-table-movement.md` (#40)
- [ ] `knockout-brackets-and-tiebreakers.md` (#41)
- [ ] `gameweek-centre-and-fixture-detail.md` (#42)

## Player experience

- [ ] `player-pool-availability-and-scouting.md` (#43)
- [ ] `player-detail-history-and-comparison.md` (#44)
- [ ] `squad-analysis-and-slot-visualisation.md` (#45)

## Notifications and operations

- [x] `notifications-activity-and-deadline-service.md` (#46)

## Migration and delivery

- [ ] `legacy-data-migration-and-backfill.md` (#47)
- [ ] `domain-test-strategy-and-parity-tests.md` (#48)
- [ ] `implementation-sequencing-roadmap.md` (#49)

## Implementation principle

Build by dependency order rather than page order:

1. Domain foundation. Completed in checkpoint 1.
2. Squad and allocation foundation. Partially completed in checkpoint 1; transfers/loans and free-agency draws remain.
3. Weekly lineup and scoring loop. Completed in checkpoint 2.
4. Squad movement and notification loop. Implemented in checkpoint 3 branch.
5. Competition views.
6. Player/scouting workflows.
7. Migration and historical hardening.
