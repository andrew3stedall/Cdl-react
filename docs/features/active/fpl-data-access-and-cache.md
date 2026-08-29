# FPL Data Access and Cache

## Purpose

Define the FPL-only external data layer, endpoint inventory, caching policy, fetch audit,
normalized cache tables, and source freshness display.

## Status

Official FPL ingestion now supports the shared player/fixture cache used by staging Squad
and scouting flows, plus lazy per-player gameweek history.

Implemented:

- timeout-bound HTTP access to the official FPL API;
- automatic staging refresh after migrations during the main-branch rollout;
- automatic five-minute staging refresh and settlement schedule, independent of app usage;
- authenticated manager refresh through `POST /api/fpl/refresh`;
- authenticated cache evidence through `GET /api/fpl/status`;
- raw response retention with a canonical SHA-256 digest;
- an append-only fetch audit with status, record count, timestamp, and failures;
- idempotent PostgreSQL upserts for gameweeks, positions, EPL teams, canonical players,
  current player value and availability, current player metrics, and EPL fixtures;
- official FPL numeric position IDs normalized to the application contract
  (`GKP`, `DEF`, `MID`, `FWD`);
- canonical player identity using `fpl-<official element id>`, matching draft ownership
  and lineup references so an official refresh enriches drafted players in place;
- current official points, form, selected percentage, minutes, goals, assists, clean
  sheets, xG, xA and chance-of-playing data exposed by Squad/scouting product routes;
- next unfinished FPL fixture, opponent, home/away, kickoff and fixture difficulty exposed on Squad player records;
- lazy `element-summary/{player}` retrieval through
  `GET /api/fpl/players/{player_id}/history`;
- cached `event/{gameweek}/live` data is used to finalise due CDL fixture results once
  FPL marks the gameweek finished and checked;
- six-hour PostgreSQL reuse of cached element-summary payloads so repeated player detail
  views do not make repeated upstream calls;
- explicit failure when PostgreSQL mode is unavailable or upstream payloads do not
  satisfy the expected shape.

Legacy note:

- previous official refreshes stored numeric player IDs such as `411`, while the draft
  owned `fpl-411`. The canonical format is now `fpl-411`;
- Squad/scouting suppress a legacy row only when its canonical counterpart exists. This
  preserves generic/non-FPL test and migration fixtures while preventing duplicate
  official players from appearing in the product;
- physical cleanup of those superseded numeric rows is intentionally deferred to a
  separate migration because it is not required for correctness.

Still required:

- commissioner-facing refresh controls and live scoring freshness displays;
- previous-season player history if the product needs more than current-season
  `element-summary` history;
- named-opponent enrichment in the history response rather than exposing only the
  normalized team identifier internally (the canonical Squad UI currently maps IDs
  against the refreshed club set);
- broader visible source-freshness treatment on player surfaces.

## Business Rules

- FPL is the only external provider for this build.
- Core endpoints: `bootstrap-static`, `fixtures`, `event/{gameweek}/live`,
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

The response reports the latest success/failure evidence for each bulk refresh resource
and normalized row counts for players, current player metrics, teams, gameweeks and
fixtures.

### Player history

```http
GET /api/fpl/players/fpl-411/history
```

The route requires authentication. It returns normalized current-season gameweek
history and upcoming fixtures sourced from the official FPL `element-summary` endpoint.
The raw payload, response hash and fetch audit are stored in PostgreSQL. A cached payload
is reused for six hours before another upstream request is made.

## Target Architecture

```text
external_fetch_log
external_payload_cache
fpl_positions
fpl_players
fpl_player_values
fpl_player_availability
fpl_player_current_metrics
fpl_gameweeks
fpl_fixtures
epl_teams
fpl_cache_freshness
```

## Cache Policy

Current/default targets:

```text
event-live during live GW: 30-120 seconds
bootstrap-static near deadline: 30-60 minutes
fixtures during active GW: 15-60 minutes
element-summary: 6 hours
```

Bulk bootstrap/fixture refresh is performed by the staging rollout and can also be
requested explicitly by an authenticated manager-level user. Element-summary is loaded
requested explicitly by an authenticated manager-level user. The staging Cloud Scheduler
invokes the refresh job every five minutes; that job also locks all team selections and
chips whose FPL deadline has passed and settles completed CDL results. Element-summary is
loaded on demand and reused while fresh.

## Data Access Requirements

- Log every external fetch with endpoint key, request params where applicable, status,
  response hash, and fetched time.
- Normalize payloads used by app logic.
- Keep payload hashes for scoring traceability.
- Never silently substitute synthetic payloads when official ingestion fails.
- Keep CDL ownership and lineup references on stable canonical FPL player IDs.

## Acceptance Criteria

Completed for the current player-data slice:

- official bootstrap and fixture payloads are persisted idempotently;
- raw payloads and canonical hashes are retained;
- fetch failures are auditable and do not mark a resource fresh;
- player positions remain compatible with the existing squad contract;
- only authenticated manager-level users can trigger a bulk refresh;
- drafted `fpl-*` players are enriched in place by official bootstrap refreshes;
- Squad/scouting expose current official FPL metrics rather than zero-value placeholders;
- player prices are selected from the official current gameweek, or the official next
  gameweek during pre-season, so a new season cannot surface the previous season's
  gameweek 38 price;
- element-summary history is fetched lazily, normalized, hashed and cached;
- repeat player detail reads reuse fresh PostgreSQL history cache.
- every due team has a persisted deadline lock and active chips are finalised for that
  gameweek even when the manager never opens the app;
- finalised CDL fixture results retain their event-live response hash and do not drift
  after later FPL refreshes.

Remaining for the full feature:

- `event-live` scoring and freshness are visible in product routes;
- commissioner-facing refresh/recalculation controls are implemented.
