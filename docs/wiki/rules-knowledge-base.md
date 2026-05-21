# Rules Knowledge Base

## Purpose

The rules knowledge base replaces the legacy static rules page with structured, searchable content that can be linked from validations and feature workflows.

## API Syntax

- GET /api/rules returns every rule section.
- GET /api/rules?category=trades filters sections by category.
- GET /api/rules/search?q=deadline searches titles, summaries, tags, and body text.
- GET /api/rules/{rule_id} returns one stable rule section.

## Rule Source Format

Each rule section contains:

- id: stable identifier used by validation errors and deep links.
- title: human-readable section heading.
- category: draft, squads, transfers, trades, matchday, chips, league, playoffs, or commissioner.
- summary: short overview for navigation and search results.
- body: ordered rule copy paragraphs.
- tags: searchable topic tags.
- anchors: route hash anchors that support deep links.
- related_rule_ids: related stable rules.
- version: version, effective date, status, and source document metadata.

## Versioning Plan

Current rules use version 2026.05. Future editable rules should preserve stable rule IDs and add version-history storage before admin editing is enabled.

## Shell and Session Behaviour

Rules are prepared for protected shell integration. The frontend helper getRulesRouteRedirect uses the authentication route guard contract and redirects unauthenticated sessions to the login route with the rules route as the next destination.

## Testing

Coverage includes backend rule contracts, API integration tests, frontend search and deep-link tests, and cross-feature shell/session route behaviour.
