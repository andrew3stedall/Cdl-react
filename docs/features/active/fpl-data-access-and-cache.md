# FPL Data Access and Cache

## Purpose

Define the FPL-only external data layer, endpoint inventory, caching policy, fetch audit, normalized cache tables, and source freshness display.

## Status

Checkpoint 1 complete.

## Business Rules

- FPL is the only external provider for this build.
- Initial endpoints: `bootstrap-static`, `fixtures`, `event/{gameweek}/live`, `element-summary/{player}`.
- FPL entry endpoints are not used for normal CDL gameplay.
- Store raw payloads plus normalized FPL tables.
- TTL means how long cached data is considered fresh.
- Live scoring fetches `event-live` on demand per gameweek.
- Final CDL score snapshots are frozen and do not depend on future FPL refetches.
- Commissioner can force refresh/recalculate before finalisation.

## Target Architecture

```text
external_providers
external_fetch_log
external_payload_cache
fpl_players
fpl_teams
fpl_gameweeks
fpl_fixtures
fpl_event_live_players
fpl_element_summaries
```

## Cache Policy

Suggested defaults:

```text
event-live during live GW: 30-120 seconds
bootstrap-static near deadline: 30-60 minutes
fixtures during active GW: 15-60 minutes
element-summary: 6-24 hours
```

## API Requirements

- Fetch/cache bootstrap data.
- Fetch/cache fixtures.
- Fetch/cache event-live by gameweek.
- Fetch/cache element summary by player.
- Return source freshness metadata.
- Allow commissioner force refresh.

## React Requirements

- Show FPL data freshness on live scoring/detail pages.
- Show refresh availability where permitted.
- Use cached FPL player status/news/fixtures in team selection and player pool.

## Data Access Requirements

- Log every external fetch with endpoint key, request params, status, response hash, and fetched time.
- Normalize payloads used by app logic.
- Keep payload hashes for scoring traceability.

## Acceptance Criteria

- Fixture scoring can identify which FPL payload/hash was used.
- Cached data is reused while fresh.
- Final results remain stable after FPL cache changes.
