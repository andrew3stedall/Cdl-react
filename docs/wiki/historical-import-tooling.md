# Historical import tooling

Issue #69 adds the PostgreSQL schema foundation for repeatable historical Castle Draft League imports.

## Scope

- `import_batches` tracks each import run, source system, status, timing, and notes.
- `import_source_mappings` maps legacy source identifiers to production table rows.
- `import_source_payloads` archives source payloads for review and reproducibility.
- `import_review_items` records rows that need manual checking.
- `import_conflicts` records mapping or payload conflicts that must be resolved before promotion.

Migration `0008_historical_import_tooling` follows `0007_dashboard_fdr_production_data`.

Import jobs should be idempotent and should produce review and conflict reports rather than silently overwriting production data.
