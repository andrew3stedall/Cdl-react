# Changelog

All notable changes to this repository must be documented in this file.

Use date-based entries and include validation evidence for every update.

## 2026-05-21 - Add legacy migration feature planning

### Added

- Added feature documents for planning the Castle Draft League modern web application migration.
- Added feature plans for authentication, application shell and visual presets, squad management, team selection, league fixtures, rules, dashboard analytics, fixture difficulty ratings, and backend API platform work.
- Added a legacy migration feature index under `docs/features/`.

### Changed

- Converted legacy review findings into feature documents only, without implementation source code.

### Validation

- Documentation-only change.
- Source code tests were not run because no application source exists yet.

## 2026-05-21 - Add shadcn UI preset requirements

### Added

- Added shadcn/ui as the default UI component and styling foundation.
- Added a UI style agent for shadcn/ui and configurable visual presets.
- Added UI Requirements to feature documents for component choices, theme presets, defaults, user configuration, accessibility, and tests.

### Changed

- Updated fullstack development guidance to include shadcn/ui and visual preset requirements.
- Updated repository instructions so interface work documents shadcn/ui usage and visual preset behaviour.

### Validation

- Documentation-only change.
- Source code tests were not run because no application source exists yet.

## 2026-05-21 - Standardise feature document location

### Changed

- Updated repository instructions so all feature documents must be created under `docs/features/`.
- Updated the legacy modernisation agent so legacy review work creates feature documents rather than development work.
- Updated the legacy application review skill to create feature documents in `docs/features/`.

### Added

- Added `docs/features/README.md` to define feature document naming and required sections.

### Validation

- Documentation-only change.
- Source code tests were not run because no application source exists yet.

## 2026-05-21 - Add Codex documentation workflow

### Added

- Added repository-level Codex operating instructions.
- Added baseline rules for React, Python, uv, Pydantic, testing, documentation, and changelog updates.

### Validation

- Documentation-only change.
- Source code tests were not run because no application source exists yet.
