# Castle source sync

Status: implementation proposed; live database planning and loading pending.

Retain all non-FPL information readable by Andrew's existing personal Castle
account and load compatible records into CDL React. A manual Actions workflow
supports repeat runs without a personal computer.

## Mapping and schema gaps

| Source information | Destination | Boundary or gap |
|---|---|---|
| Every non-FPL dataset in the selected league, global records and own membership | Versioned `import_source_payloads` | Lossless JSON archive; not automatically visible in existing frontend screens. |
| League/season | Existing `leagues` / `seasons` via `import_source_mappings` | Exact season label and existing league/season binding required; no creation. |
| Teams and source manager IDs | Existing `draft_teams` and their `managers` | Unique normalized team-name match or explicit alias; no changes to users, Google accounts, memberships or permissions. |
| Player references | Existing `fpl_players`, using cached persistent codes where available | No FPL requests or writes. Numeric ID fallback also requires matching name and position; otherwise review an explicit mapping. |
| Source `draft_picks` | Archive; link identical active `squad_ownerships` | Mutable current ownership is not CDL's tradable `draft_picks` asset. Timelines, releases and loans require reconciliation; no ownership changes. |
| Saved lineups and armbands | Optional native `team_selection_lineup_slots` | Require valid mapped players/armbands/timestamps. Stale target slots block that lineup; differing existing rows require explicit adoption. |
| Fixtures and aggregate scores | Optional native `cdl_fixtures` / `fixture_results` | Match gameweek/home/away; preserve finalised results and scoring snapshots. Existing cached gameweek context required. No per-player scoring evidence or replay. |
| Completed visible non-loan trades | Optional native `trade_proposals`, `trade_assets`, `squad_rejection_reasons` | Known parties, players and gameweek required. Rejected trades often need an explicit gameweek mapping. No execution or ownership movement. In-flight trades stay archived. |
| Loans, chips, roster movements | Archive | Snapshots cannot reliably establish native timelines or season chip usage. |
| Draws, snapshots, results, per-manager interests and won/lost/unawarded outcomes | Archive in full | Native `free_agency_results` is unique per draw/team; Castle can award multiple players. Do not collapse awards or rerun draws. A future history reader/schema extension is needed. |
| Trade broadcasts and own notifications | Archive | Supporting evidence, not a fabricated structured trade ledger. |
| Own interests, predictions and votes | Archive | Native schemas/privacy differ; other managers' current private lists are not requested. |
| Deadlines, reports, archives, all-time baseline/positions/records | Archive | No automatic rules, settled standings or historical score overrides. Empty data may be permission-filtered. |

Approved trades map to accepted/approved; receiver-rejected to
rejected/not-submitted; commissioner-rejected to accepted/rejected; expired and
cancelled to cancelled/not-submitted. Original status and all fields remain archived.
Unknown execution time stays null. Pending/receiver-accepted trades are not made
actionable in the destination.

## Coverage and implementation

Successful source export run `40143323798` contained 11 draws, 203 draw results and
349 derived interest outcomes; all three completed draws had snapshots. Two trades
were directly visible. This demonstrates personal read access, not database-wide
completeness. Rejected trades between other managers remain unavailable under
source permissions. Broadcasts cannot reliably fill that gap.

The exporter is sequential rather than a source transaction. Failed non-FPL reads,
missing required datasets or mismatched counts reject import. Empty successful
reads still carry visibility limitations.

The dedicated adapter/repository/CLI reuses generic import tables, separately from
the synthetic-only historical import service. No migration or new dependency.
Manual staging-only plans precede digest-bound transactional applies. Stable
identity mappings cannot be silently rebound; local edits block native writes;
missing source rows never delete targets. Changed source versions and projected
target before-images are retained. PostgreSQL uses serializable isolation and an
importer advisory lock.

Actions output contains counts/digests/gap codes, not row values. Plaintext is
removed; encrypted artifacts expire after three days. Database archives remain
under existing database access controls, with no new public read endpoint.

Dependencies: [read inventory](castle-read-inventory.md), existing staging schema,
FPL reference cache, personal Castle Secret Manager credential, WIF and database
access. See [runbook](../../runbooks/castle-source-sync.md) and
[storage decision](../../architecture/castle-source-sync-adr.md).

Tests cover source drift/truncation, season/membership binding, mapping, replay and
version history, local-edit protection, no FPL/account writes, and migrated
PostgreSQL persistence. Live source-to-staging validation remains post-merge work.
