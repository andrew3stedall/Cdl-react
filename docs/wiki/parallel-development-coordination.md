# Parallel Development Coordination

## Purpose

This page summarises the active coordination rules for parallel feature development across the Castle Draft League modernisation work.

Source of truth: `docs/features/active/parallel-development-coordination.md`.

## Agent Workflow Map

| Agent | Issue | Feature document | Current status |
| --- | ---: | --- | --- |
| Agent 01 - Authentication | #2 | `authentication-and-session-management.md` | Implemented foundation |
| Agent 02 - Application Shell | #3 | `application-shell-navigation-and-presets.md` | Implemented foundation |
| Agent 03 - Backend Platform | #4 | `backend-api-data-platform.md` | Implemented foundation with persistence gaps |
| Agent 04 - Squad Management | #5 | `squad-management-scouting-and-transfers.md` | Implemented foundation |
| Agent 05 - Team Selection | #6 | `team-selection-and-chip-management.md` | Implemented foundation |
| Agent 06 - League Fixtures | #7 | `league-fixtures-and-table.md` | Implemented foundation |
| Agent 07 - Rules | #8 | `rules-knowledge-base.md` | Implemented foundation |
| Agent 08 - Dashboard | #9 | `analytics-dashboard.md` | Implemented foundation |
| Agent 09 - FDR | #10 | `fixture-difficulty-ratings.md` | Implemented foundation |
| Agent 10 - Migration Index | #11 | `legacy-migration-feature-index.md` | Current index foundation |

## Shared Contract Guardrails

- Agent 01 owns session model changes with Agent 02 route integration.
- Agent 02 owns navigation and theme preset coordination.
- Agent 03 owns shared Pydantic, API error, repository, and data contract conventions.
- Agent 10 owns legacy migration mapping and missing-feature discovery.
- Feature agents must update their active documents before changing shared contracts.

## Cross-Feature Validation

The active coordination document tracks cross-feature tests for:

- Protected routes and authenticated API clients.
- Shell navigation and theme preset persistence.
- Backend API contract compatibility.
- Shared player, team, fixture, gameweek, metric, and FDR rating models.
- Rule deep links from validation errors.
- Dashboard and FDR chart/rating palette compatibility.
- Legacy module mapping into active feature documents.

## Release Coordination

- `CHANGELOG.md` records every implementation or planning coordination pass.
- `docs/releases/v0.1.0.md` records implemented foundations and known gaps.
- Active feature documents remain active until a deliberate release-management pass moves them to completed.
- Completed feature movement should be coordinated in one release pass so shared contracts and release notes stay aligned.

## Maintenance Rules

- Keep issue numbers and active feature paths aligned with GitHub issues #2 through #11.
- Add new rows before starting new agent workflows.
- Update shared contract ownership when a feature starts owning a model or route used by another feature.
- Add documentation tests for new coordination rules that should not regress.
