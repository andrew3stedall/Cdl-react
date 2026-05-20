# Skill: Release Documentation

## Purpose

Capture completed feature work in release documentation after implementation and validation.

## Release folders

Completed feature documents must move to one of these folders:

- `docs/features/completed/minor/vX.Y.Z/`
- `docs/features/completed/major/vX.Y.Z/`

Release notes must be created or updated at:

- `docs/releases/vX.Y.Z.md`

## Release document template

```markdown
# Release vX.Y.Z

## Release Type

Major or minor.

## Completed Features

- Feature name and link to completed feature document.

## User-Facing Changes

## API Changes

## UI and Theme Preset Changes

## Data and Migration Changes

## Testing Evidence

## Known Gaps
```

## Required checks

- Every completed feature is listed.
- Testing evidence includes unit, integration, cross-feature, lint, Ruff, and build checks where applicable.
- Known gaps are explicit.
- Changelog and wiki documentation are updated.
