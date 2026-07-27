# Historical import persistence foundation

Issue #69 tracks repeatable historical Castle Draft League imports. Real historical exports are not available, so repository evidence must remain synthetic and must not be represented as real import coverage.

Migration `0008_import_tooling` already creates five generic payload tables:

- `import_batches`;
- `import_source_mappings`;
- `import_source_payloads`;
- `import_review_items`;
- `import_conflicts`.

Each table currently has the migration-owned `id`, `payload_json`, and `created_at` columns. Runtime SQLAlchemy metadata must match that schema exactly. An earlier metadata definition modelled typed columns and foreign keys that do not exist in a clean Alembic-migrated database; this branch removes that mismatch and adds clean PostgreSQL evidence.

The payload contract, idempotency rules, source mapping semantics, conflict handling, dry-run audit, and domain writes remain intentionally unimplemented. The next bounded slice should add one versioned deterministic synthetic payload contract and repository/service path that proves repeat execution, archival, mapping conflicts, and structured audit output without requiring real exports.
