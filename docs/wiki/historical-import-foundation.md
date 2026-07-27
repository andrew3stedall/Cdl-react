# Historical import persistence foundation

Issue #69 tracks repeatable historical Castle Draft League imports. Real historical exports are not available, so this foundation defines storage and safety boundaries without claiming real-data coverage.

Migration `0008_historical_import` adds:

- `historical_import_batches` for versioned source identity, dry-run status and batch audit output;
- `historical_source_payloads` for immutable archived JSON payloads and SHA-256 identity;
- `historical_source_mappings` for source-to-target identity mapping;
- `historical_import_review_items` for manual-review findings;
- `historical_import_conflicts` for explicit existing-versus-incoming conflict evidence.

Unique constraints establish the first idempotency boundaries: one batch per source digest and contract version, one archived source identity per batch, and one source mapping per source and target type. Foreign keys keep payloads, reviews and conflicts attached to their import batch.

This slice does not implement a domain importer, dry-run command or real export adapter. The next bounded slice should add a versioned synthetic import contract and service proving repeat runs, payload archival, mapping conflict handling and structured audit output.
