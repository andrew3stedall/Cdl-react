# Legacy Data Migration and Backfill

## Purpose

Define how historical CDL data should be carried forward into the redesigned application.

## Status

Checkpoint 5 complete.

## Business Rules

- The legacy application is a reference for behaviour, not the target architecture.
- Historical data should be imported only when it maps clearly to the new model.
- Records that cannot be confidently transformed should be retained for read-only historical reference.
- Manual review is acceptable where historical context is unclear.

## Migration Modes

```text
strict import
- imports records that map cleanly into the new domain model

archive import
- preserves historical records for read-only display/reference
```

## Target Architecture

```text
migration_runs
migration_record_mappings
migration_review_items
legacy_archive_entries
```

## Migration Areas

```text
users and managers
leagues, teams, and seasons
historic squad membership
free agency interest history
fixtures and results
FPL reference data
```

## Tooling Requirements

- Dry-run import.
- Import report.
- Review queue for unclear historical records.
- Archive-only import option.
- Repeatable migration process.

## Acceptance Criteria

- Dry-run import reports counts and review items.
- Clean historical data can be imported into new tables.
- Unclear historical data is not guessed silently.
- Archived historical records remain viewable for reference.
