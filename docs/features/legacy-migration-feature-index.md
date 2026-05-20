# Feature: Legacy Migration Feature Index

## Purpose

Plan the modern Castle Draft League web application by converting the legacy repository into a set of feature documents for React, Python API, Pydantic models, service classes, repositories, tests, documentation, and changelog work.

## Legacy Inventory

Reviewed legacy entry points include:

- `index.php` for unauthenticated login.
- `index.html` for squad management.
- `myTeam.html` for team selection.
- `fixtures.html` for league fixtures and table.
- `rules.html` for league rules.
- `dashboard.html` for analytics dashboards.
- `FDR.html` for fixture difficulty ratings.
- JavaScript modules under `assets/js/` using jQuery, D3, Skel panels, and PHP endpoints.

## Feature Documents

Required development planning features:

- `authentication-and-session-management.md`
- `application-shell-navigation-and-presets.md`
- `squad-management-scouting-and-transfers.md`
- `team-selection-and-chip-management.md`
- `league-fixtures-and-table.md`
- `rules-knowledge-base.md`
- `analytics-dashboard.md`
- `fixture-difficulty-ratings.md`
- `backend-api-data-platform.md`

## Business Rules

Business rules are currently distributed through static HTML, JavaScript UI state, PHP endpoints, SQL-backed responses, and rules copy. Modernisation must extract rules into documented Python services and API contracts.

## Risks

- Legacy source is not code-search indexed, so file coverage was based on discovered entry points and sampled linked assets.
- Existing behaviour may depend on undocumented PHP endpoints and database views.
- D3 rendering is tightly coupled to server response shape.
- Main CSS and template-era layout patterns may hide responsive behaviour.

## Target Architecture

Use React, TypeScript, shadcn/ui, configurable visual presets, Python API services, Pydantic request and response models, and repository classes for data access.

## Acceptance Criteria

- Every major legacy screen has a feature document.
- Each feature document defines UI, API, data access, tests, documentation, and changelog requirements.
- Implementation is not started from this review.

## Test Requirements

No source tests are required for this documentation-only planning change. Future implementation must include unit, integration, lint, Ruff, build, and accessibility checks.

## Documentation Requirements

Update wiki documentation when implementation starts. Keep this index current as new legacy modules are discovered.

## Changelog Requirements

Record this planning pass in `CHANGELOG.md`.
