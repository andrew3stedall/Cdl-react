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

## Bounded fixture projection

`entity_type=cdl_fixture` projects an approved mapping target into the existing `cdl_fixtures` payload table.

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

## Bounded result projection

`synthetic-result-export/v1` is a separate test-only result shape. `SyntheticResultExportAdapter` normalizes scores into `entity_type=cdl_result`, and `PostgreSQLHistoricalResultImportRepository` projects them into `fixture_results` only when the mapped fixture already exists.

- dry-run reports the result projection without database writes;
- import evidence and the result row commit in one transaction;
- exact replay is idempotent;
- a missing mapped fixture creates an open `missing_fixture` review item and no result row;
- an existing result with different content raises before commit, rolling back the batch and source-payload changes;
- duplicate result keys create adapter review diagnostics and are not projected twice;
- unsupported result-export versions fail closed.

## Bounded scoring-snapshot projection

`synthetic-scoring-export/v1` normalizes bonus, chip, and EPL-link metadata into `entity_type=cdl_scoring_snapshot`. `PostgreSQLHistoricalScoringImportRepository` projects into `fixture_scoring_snapshots` only when both the mapped fixture and its result already exist.

- dry-run reports the scoring projection without database writes;
- import evidence and the snapshot commit in one transaction;
- exact replay is idempotent;
- missing fixtures and missing results create explicit open review items and no scoring row;
- existing scoring content is never silently overwritten; a conflict raises before commit and rolls back import changes;
- duplicate snapshot keys create adapter review diagnostics;
- unsupported scoring-export versions fail closed.

## Bounded EPL fixture-context projection

`synthetic-epl-context-export/v1` normalizes one EPL fixture context into `entity_type=epl_fixture_context`. `PostgreSQLHistoricalEplContextImportRepository` projects into `epl_fixtures` only when the named scoring snapshot exists and explicitly references the target EPL fixture ID.

- dry-run reports the EPL context projection without database writes;
- import evidence and the EPL context commit in one transaction;
- exact replay is idempotent;
- missing scoring snapshots create open `missing_scoring_snapshot` review items;
- scoring snapshots that do not reference the target context create open `missing_scoring_link` review items;
- existing EPL context content is never silently overwritten; a conflict raises before commit and rolls back import changes;
- duplicate context keys create adapter review diagnostics;
- unsupported EPL context-export versions fail closed.

These adapters prove normalization and transactional projection for deterministic synthetic shapes only. They do not establish compatibility with a real export format or authorize automatic replacement of existing domain records.

## Remaining scope

A real historical export still needs a separately validated parser/adapter, source authenticity and schema evidence, mapping approval, and coverage for squads, table snapshots, knockout, head-to-head, and other entity projections. Synthetic release-path tests do not establish compatibility with any real export format.
