# 2026-08-10 — League workspace refresh

## Changed

- Reworked the League route from a flat contract scaffold into an overview-first
  competition workspace aligned with the Castle Manager's Desk direction.
- Added focused Fixtures & results, Table, Knockout, and Head-to-head views that
  use shared Teal cards, compact status treatments, responsive tables, and
  contextual navigation.
- Added fixture status filtering and a scoring-detail drawer for started
  fixtures, with explicit loading, error, empty, and unavailable-data states.
- Added table-source messaging so calculated snapshots are not presented as
  persisted historical truth.
- Tightened the Overview route so it stays a status and next-action landing
  view; detailed fixtures, standings, knockout, and head-to-head content only
  renders inside its selected contextual tab.

## Migration boundary

The page remains a competition surface. Legacy migration concerns are reflected
through provenance and explicit unavailable-data messaging; migration dry-runs,
review queues, and archive operations remain in the migration/API scope rather
than being mixed into manager-facing League navigation.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
