# FPL Data Access and Cache

## Purpose

Define the FPL-only external data layer, endpoint inventory, caching policy, fetch audit,
normalized cache tables, and source freshness display.

## Status

The first production ingestion slice is implemented for the official public
`bootstrap-static` and `fixtures` endpoints.

Implemented:

- timeout-bound HTTP access to the official FPL API;
- authenticated manager refresh through `POST /api/fpl/refresh`;
- authenticated cache evidence through `GET /api/fpl/status`;
- raw response retention with a canonical SHA-256 digest;
- an append-only fetch audit with status, record count, timestamp, and failures;
- idempotent PostgreSQL upserts for gameweeks, positions, EPL teams, players, current
  player value and availability, and EPL fixtures;
- official FPL numeric position IDs normalized to the application contract
  (`GKP`, `DEF`, `MID`, `FWD`);
- explicit failure when PostgreSQL mode is unavailable or upstream payloads do not
  satisfy the expected shape.

Still required:

- scheduled or operator-controlled staging execution;
- `event/{gameweek}/live` ingestion and scoring integration;
- `element-summary/{player}` ingestion;
- player metric wiring for form, total points, ownership and visible freshness;
- replacing or mapping remaining deterministic draft ownership fixtures to current
  official player IDs;
- commissioner refresh controls and live scoring freshness displays.

## Business Rules

- FPL is the only external provider for this build.
- Initial endpoints: `bootstrap-static`, `fixtures`, `event/{gameweek}/live`,
  `element-summary/{player}`.
- FPL entry endpoints are not used for normal CDL gameplay.
- Store raw payloads plus normalized FPL tables.
- TTL means how long cached data is considered fresh.
- Live scoring fetches `event-live` on demand per gameweek.
- Final CDL score snapshots are frozen and do not depend on future FPL refetches.
- Commissioner can force refresh/recalculate before finalisation.

## Implemented API

### Refresh

```http
POST /api/fpl/refresh
Content-Type: application/json

{
  "resources": ["bootstrap-static", "fixtures"]
}
```

The route requires an authenticated `manager`, `commissioner`, or `admin` role and
PostgreSQL repository mode. Each resource is fetched and committed independently. A
failed resource is recorded in the fetch audit and returned as an upstream failure.

### Status

```http
GET /api/fpl/status
```

The response reports the latest success/failure evidence for each implemented
resource and normalized row counts for players, teams, gameweeks, and fixtures.

## Target Architecture

```text
external_fetch_log
external_payload_cache
fpl_positions
fpl_players
fpl_player_values
fpl_player_availability
fpl_gameweeks
fpl_fixtures
epl_teams
fpl_cache_freshness
```

## Cache Policy

Suggested defaults:

```text
event-live during live GW: 30-120 seconds
bootstrap-static near deadline: 30-60 minutes
fixtures during active GW: 15-60 minutes
element-summary: 6-24 hours
```

The implemented endpoints currently refresh only when explicitly requested. TTL-based
reuse and scheduled refresh are the next operational slice.

## Data Access Requirements

- Log every external fetch with endpoint key, request params, status, response hash,
  and fetched time.
- Normalize payloads used by app logic.
- Keep payload hashes for scoring traceability.
- Never silently substitute synthetic payloads when official ingestion fails.

## Acceptance Criteria

Completed for this slice:

- official bootstrap and fixture payloads are persisted idempotently;
- raw payloads and canonical hashes are retained;
- fetch failures are auditable and do not mark a resource fresh;
- player positions remain compatible with the existing squad contract;
- only authenticated manager-level users can trigger a refresh.

Remaining for the full feature:

- fixture scoring identifies the exact FPL payload/hash used;
- cached data is reused while fresh;
- final results remain stable after FPL cache changes;
- current player metrics and live scoring are visible in product routes.
