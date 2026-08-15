# 2026-08-15 — Draft fixture manager labels

## Changed

- Draft fixture rows and fixture detail views now show manager names instead of draft team names.
- PostgreSQL fixture reads resolve the current manager name from the active draft-team relationship, including for existing persisted fixture payloads.
- League standings continue to show draft team names.

## Validation

- Added frontend coverage for manager-labelled fixture rows and squad comparison labels.
- Added PostgreSQL repository coverage for manager-name enrichment.
