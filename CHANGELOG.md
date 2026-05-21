# Changelog

## 2026-05-21 - Add backend API platform foundation

### Added

- Added Python API foundation using FastAPI, uv, Pydantic, service boundaries, and repository boundaries.
- Added shared API, session, theme, team, player, fixture, gameweek, and rule reference contract models.
- Added React and TypeScript frontend foundation with theme preset contracts.
- Added CI workflow for backend and frontend validation.
- Added v0.1.0 release documentation skeleton.

### Validation

- Added backend contract and app tests.
- Added frontend theme preset tests.
- CI is configured to run Ruff, pytest, lint, test, and build checks.

## 2026-05-21 - Move planning features to active

### Changed

- Moved planning feature documents into `docs/features/active/`.
- Updated migration feature index references to active paths.
- Removed old root-level planning feature copies.

### Validation

- Documentation-only change.

## 2026-05-21 - Add feature development lifecycle workflow

### Added

- Added active, completed, and release documentation lifecycle folders.
- Added parallel feature development and release documentation skills.

### Changed

- Updated development instructions to start from active feature documents.

### Validation

- Documentation-only change.
