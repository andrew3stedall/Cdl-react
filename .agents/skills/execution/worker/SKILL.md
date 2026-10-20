---
name: worker
description: Use when implementing one scoped CDL React issue inside an approved branch or milestone.
---

# Worker Skill

## Purpose

Implement one scoped issue without drifting into unrelated work.

## Frontend server data

Before implementing a frontend feature that reads or changes server data, read `docs/architecture/client-query-cache-adr.md` and follow the shared TanStack Query integration in `AGENTS.md`.

- Reuse the existing API clients and shared `fetchWithQuery` transport; do not fetch API data directly in view components.
- Do not create a feature-local QueryClient or duplicate persistence/cache logic.
- Confirm that successful writes invalidate affected cached data. The shared transport invalidates API queries for successful non-GET requests; mutations using another path must use the established invalidation mechanism.
- Preserve per-manager cache separation, logout clearing, refresh triggers, and all documented endpoint bypasses.
- Test invalidation and any identity, restoration, or bypass behavior touched by the feature.

## Workflow

1. Read the issue, feature doc, ADRs, and relevant code.
2. Identify files likely to change.
3. Make the smallest safe implementation.
4. Add or update tests where practical.
5. Update docs and changelog when the change is meaningful.
6. Report validation performed and validation deferred.

## Guardrails

- Do not change shared contracts without updating affected docs and tests.
- Do not modify migrations or production settings unless the issue explicitly requires it.
- Do not claim checks passed unless they were actually run.
