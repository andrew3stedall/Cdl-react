# Historical import persistence foundation

Issue #69 tracks repeatable historical Castle Draft League imports. Real historical exports are not available, so repository evidence remains deterministic and synthetic and is not represented as real import coverage.

Migration `0008_import_tooling` creates five generic payload tables:

- `import_batches`;
- `import_source_mappings`;
- `import_source_payloads`;
- `import_review_items`;
- `import_conflicts`.

Each table uses the migration-owned `id`, `payload_json`, and `created_at` columns. Runtime SQLAlchemy metadata matches that schema exactly.

## Versioned synthetic contract

`historical-import/v1` defines one batch, its source system, source-to-domain mappings, and source records. `HistoricalImportService` currently accepts only explicitly synthetic contracts. A contract claiming to contain real export data fails closed until separate export-validation evidence exists.

The PostgreSQL repository provides these release-path behaviours:

- dry-run execution returns a structured audit without writing rows;
- a committed batch records its canonical SHA-256 digest;
- an exact repeat is idempotent and reports unchanged payloads and domain records;
- reusing a batch ID with different content is rejected;
- changed source records preserve their prior payload as an archived row;
- conflicting source mappings create conflict and review payloads instead of overwriting mappings;
- synthetic classification is retained on mappings, payloads, conflicts, reviews, batch audits, and projected rows.

## Bounded domain projection

The only supported domain projection is `entity_type=cdl_fixture`. Its approved mapping target becomes the identifier in the existing `cdl_fixtures` payload table.

- dry-run reports the fixture projection without writing import or domain rows;
- the import batch, source payload, mapping, and fixture are committed in one transaction;
- exact replay is idempotent;
- a mapping conflict records review evidence but performs no fixture write;
- a target fixture with different persisted content raises before commit, rolling back the import batch and source-payload changes.

## Synthetic fixture-export adapter

`synthetic-fixture-export/v1` is one concrete, test-only source shape. `SyntheticFixtureExportAdapter` validates its rows and normalizes them into `historical-import/v1` fixture records.

- the adapter emits explicit source-to-target mapping diagnostics;
- duplicate fixture keys produce review diagnostics and are not projected twice;
- unsupported export versions fail closed;
- adapter output is asserted equal to the direct versioned import contract;
- parser-to-projection dry-run audits have the same digest and projected-row counts in SQLite and clean migrated PostgreSQL.

This proves normalization and projection parity for a deterministic synthetic shape only. It does not establish compatibility with a real export format or authorize automatic replacement of existing domain records.

## Remaining scope

A real historical export still needs a separately validated parser/adapter, source authenticity and schema evidence, mapping approval, and coverage for each additional entity projection. Synthetic release-path tests do not establish compatibility with any real export format.
