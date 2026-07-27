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
- an exact repeat is idempotent and reports unchanged payloads;
- reusing a batch ID with different content is rejected;
- changed source records preserve their prior payload as an archived row;
- conflicting source mappings create conflict and review payloads instead of overwriting mappings;
- synthetic classification is retained on mappings, payloads, conflicts, reviews, and batch audits.

This boundary does not write league-domain tables. It validates import mechanics and auditability only.

## Remaining scope

A real historical export still needs a versioned parser/adapter, source validation, mapping approval, and domain-write transaction evidence. Synthetic release-path tests do not establish compatibility with any real export format.
