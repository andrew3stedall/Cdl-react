# Agents

See `.agents/agent-roster.md` for the CDL React planning and execution role roster.

## App component copy

- Never include narrative or explanatory prose in app components. Prefer compact labels, values, controls, and actionable status or error feedback.

## Server data and caching

- For frontend features that read or change server data, follow the shared TanStack Query cache and API transport rules in `AGENTS.md` and `docs/architecture/client-query-cache-adr.md`.
- Reuse the existing API clients and `fetchWithQuery`; do not add direct component fetches, separate QueryClients, or feature-local persistence.
- Preserve mutation invalidation, manager isolation, logout clearing, freshness triggers, and the documented bypass list. Add focused tests for the cache behavior the feature touches.
