# CDL Modernisation Feature Pack

Status: Discovery accepted; ready for feature-level elaboration.

## Purpose

This index groups the agreed CDL redesign work into implementable feature documents. The intent is to support development without reverting to a like-for-like migration of the legacy PHP application.

## Foundation

- `league-season-team-model.md`
- `league-configuration-and-rule-versioning.md`
- `permissions-approvals-and-admin-audit.md`

## Squad movement

- `squad-rights-and-assignments.md`
- `transfers-loans-and-negotiations.md`
- `live-draft-room.md`
- `free-agency-draws.md`

## Weekly gameplay

- `team-selection-and-lineup-locking.md`
- `substitution-engine.md`
- `chips-and-scoring-modifiers.md`

## Scoring and competition

- `fpl-data-access-and-cache.md`
- `fixture-scoring-snapshots-and-finalisation.md`
- `league-table-and-table-movement.md`
- `knockout-brackets-and-tiebreakers.md`
- `gameweek-centre-and-fixture-detail.md`

## Player experience

- `player-pool-availability-and-scouting.md`
- `player-detail-history-and-comparison.md`
- `squad-analysis-and-slot-visualisation.md`

## Notifications and operations

- `notifications-activity-and-deadline-service.md`

## Migration and delivery

- `legacy-data-migration-and-backfill.md`
- `domain-test-strategy-and-parity-tests.md`
- `implementation-sequencing-roadmap.md`

## Implementation principle

Build by dependency order rather than page order:

1. Domain foundation.
2. Squad and allocation foundation.
3. Weekly lineup and scoring loop.
4. Competition views.
5. Player/scouting and notification workflows.
6. Migration and historical hardening.
