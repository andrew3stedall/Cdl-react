# Completed Feature Documents

This folder contains feature documents after implementation and validation.

## Folder structure

```text
completed/
  minor/
    vX.Y.Z/
      feature-name.md
  major/
    vX.Y.Z/
      feature-name.md
```

## Rules

- Move a feature document here only after implementation is complete.
- The folder path must match the release type and release version.
- The completed feature must be included in `docs/releases/vX.Y.Z.md`.
- Keep the completed document as a release record of what was planned and delivered.

## Release type guidance

- Use `minor` for additive features and non-breaking improvements.
- Use `major` for breaking changes, large architecture shifts, or incompatible API/data changes.
