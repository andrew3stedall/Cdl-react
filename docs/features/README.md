# Feature Documents

Feature documents are the source of truth for all development work.

## Folder structure

```text
docs/features/
  README.md
  active/
    feature-name.md
  completed/
    minor/
      vX.Y.Z/
        feature-name.md
    major/
      vX.Y.Z/
        feature-name.md
```

## Active features

- All development starts from a feature document in `docs/features/active/`.
- One feature document should map to one feature branch, pull request, or agent task.
- Feature documents must be updated when implementation decisions change.
- Parallel work must document dependencies on other active feature documents.

## Completed features

After implementation and validation, move the feature document to:

- `docs/features/completed/minor/vX.Y.Z/` for minor releases.
- `docs/features/completed/major/vX.Y.Z/` for major releases.

The release folder must match the release documentation in `docs/releases/vX.Y.Z.md`.

## Filename rules

- Use kebab-case.
- Use clear feature names.
- Use the `.md` extension.

Examples:

- `active/reporting-dashboard.md`
- `active/customer-search.md`
- `completed/minor/v0.1.0/customer-search.md`

## Required sections

Each feature document should include:

- Purpose
- Status
- Release Target
- Legacy Inventory, when applicable
- Current Behaviour, when applicable
- Business Rules
- Dependencies On Other Active Features
- Risks
- Target Architecture
- API Requirements
- React Requirements
- UI Requirements
- Data Access Requirements
- Acceptance Criteria
- Test Requirements
- Cross-Feature Test Requirements
- Documentation Requirements
- Changelog Requirements
- Completion Checklist

## UI requirements

Interface-related feature documents must specify:

- shadcn/ui component choices.
- Theme preset requirements.
- Default visual preset.
- User configuration behaviour.
- Accessibility expectations.
- Test requirements for theme and preset behaviour.

## Completion checklist

A feature document can move to `completed/` only when:

- Feature acceptance criteria are met.
- Unit tests pass.
- Integration tests pass.
- Cross-feature tests are documented and pass where applicable.
- Lint, format, Ruff, and build checks pass.
- Wiki documentation is updated.
- Changelog is updated.
- Release documentation is updated.
