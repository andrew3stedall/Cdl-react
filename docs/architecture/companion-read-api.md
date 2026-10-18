# Companion read API

## Purpose

Provide a small, read-only API for companion apps that need league history and
locked weekly selections. All endpoints use the configured CDL 2026/27 league
and season, matching the current single-season repository context.

## Access and privacy

Every route is public and requires no authentication. The API does not expose
pending/private trade proposals or draw preferences. Trades are returned only
after approval and execution. Selections are returned only for lineups with a
persisted lock timestamp; unlocked selections are omitted. API reads do not
mutate league state.

Wildcard CORS (`Access-Control-Allow-Origin: *`) is enabled only for this
read-only namespace, with `GET` and `OPTIONS` allowed and no credentials. This
lets browser-based companion apps call the API directly from any origin.

## Endpoints

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/companion/teams` | `{ teams: [...] }` | Team and manager display names. |
| `GET /api/companion/draft-picks` | `{ draft_id, status, picks: [...] }` | Picks are ordered by overall pick number. Empty if no persisted draft exists. |
| `GET /api/companion/draw-results` | `{ draws: [...] }` | Processed draws and public awards only. |
| `GET /api/companion/squad-movements` | `{ movements: [...] }` | Ownership start/end events; each addition and removal has its own timestamp. |
| `GET /api/companion/trades` | `{ trades: [...] }` | Executed, approved trades and exchanged player assets. |
| `GET /api/companion/team-selections?gameweek=14` | `{ gameweek, selections: [...] }` | Omit `gameweek` to get the most recent locked gameweek. Unlocked rows are never returned. |

## Draft history source

Draft room picks are read from the persisted live-draft pick table. If no room
pick rows exist, the endpoint reads the active historical seed's stable
`ownership-pick-NNN` ownership identifiers and calculates round number from
the configured league team count. It labels those rows `historical_seed` and
uses their ownership timestamp as the captured draft time. A future data
backfill should populate canonical pick history rather than relying on this
seed-specific fallback.

## Implementation boundaries

- Reads are isolated in `CompanionDataRepository`; the router owns auth and
  response validation only.
- No new table, migration, write path, or credential type is introduced.
- The league and season context remains fixed until the active-context work in
  issue #522 is completed.
