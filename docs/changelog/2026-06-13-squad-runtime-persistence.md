# 2026-06-13 - Squad runtime persistence

## Added

- Added PostgreSQL squad repository runtime coverage for issue #65 interest and trade write paths.
- Routed squad management endpoints through the repository factory instead of a fixed in-memory service.
- Added API tests for PostgreSQL-backed interest writes, trade writes, and validation failures.
