# Active Feature Documents

This folder contains feature documents that are ready for development or currently being developed.

## Rules

- All implementation work must start from a feature document in this folder.
- One feature document should map to one feature branch, pull request, or agent task.
- Multiple agents may work in parallel when each agent owns a different active feature document.
- Dependencies on other active features must be documented in the feature document.
- Cross-feature testing expectations must be documented before implementation is considered complete.

## Completion

When implementation is complete and validated, move the feature document to one of:

- `docs/features/completed/minor/vX.Y.Z/`
- `docs/features/completed/major/vX.Y.Z/`

Then update the matching release note at `docs/releases/vX.Y.Z.md`.
