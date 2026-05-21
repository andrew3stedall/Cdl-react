# Feature: Rules Knowledge Base

## Purpose

Plan the modern replacement for the legacy Rules page as a structured, searchable, maintainable knowledge base.

## Legacy Inventory

- `rules.html` contains league rules as static HTML.
- Navigation anchors include draft rules, squads, transfers, trades, matchday gameweeks, league, and playoffs.
- The page uses repeated inline styling and static copy.

## Current Behaviour

Users read long-form league rules and navigate between rule sections using anchor links.

## Business Rules

- Rules define the domain constraints for squads, transfers, trades, matchday behaviour, chips, playoffs, and commissioner decisions.
- Implementation features must reference the rule source instead of duplicating hidden logic.
- Rule changes must be versioned and auditable.

## Risks

- Some rules are prose and need conversion into enforceable service validations.
- Static copy may be outdated or inconsistent with JavaScript/PHP behaviour.
- Commissioner override rules may need explicit workflow support.

## Target Architecture

- React rules route with structured sections and search.
- shadcn/ui accordion, command search, cards, tabs, badges, and table of contents.
- Python rule service for structured rule metadata if rules are API-driven.
- Pydantic models for rule section, rule version, rule category, and references.
- Repository or content adapter for Markdown, database, or CMS-backed rules.

## API Requirements

- `GET /api/rules`
- `GET /api/rules/{rule_id}`
- Optional `GET /api/rules/search?q=`
- Optional admin endpoints for rule version management.

## React Requirements

- Searchable rules page.
- Section navigation.
- Rule category filters.
- Deep links to specific rule sections.
- Version or last-updated display.

## UI Requirements

- Use shadcn/ui accordion, command, cards, badges, and navigation primitives.
- Visual presets must preserve readability for long-form content.
- Typography scale and content width must be configurable by preset.

## Data Access Requirements

- Rules should be stored as structured Markdown or database records.
- Rule IDs must be stable for linking from feature validation errors.
- Rule version history should be planned before admin editing is added.

## Acceptance Criteria

- Users can read and navigate all league rules.
- Users can search or filter rule sections.
- Rule sections have stable identifiers.
- Future service validations can reference rule identifiers.

## Test Requirements

- Unit tests for rule parsing or content adapter behaviour.
- Integration tests for rules API if API-driven.
- React tests for search, navigation, and deep links.
- Content validation tests for required rule metadata.

## Documentation Requirements

- Wiki page explaining rules source format, syntax, examples, and versioning.

## Changelog Requirements

- Add implementation changelog entry when built.

## Validation Status

Completed after CI validation for issue #8 passed on PR #15.
