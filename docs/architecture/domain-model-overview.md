# CDL Domain Model Overview

Status: accepted discovery baseline.

## Purpose

This document summarises the target domain model for the CDL React rebuild. It is the bridge between the decision log, feature documents, and implementation tasks.

## Core aggregate areas

```text
League setup
- users
- leagues
- league_memberships
- league_invitations
- teams
- league_seasons
- season_teams

Configuration and permissions
- league_rule_templates
- league_season_rule_versions
- approval_requests
- admin_actions
- admin_action_changes

Squads and player movement
- squad_assignments
- temporary_player_rights
- transfers
- transfer_items
- trade_negotiations
- loans
- draft_picks
- free_agency_draws

Weekly gameplay
- lineup_submissions
- lineup_players
- chip_activations
- lineup_substitutions

Scoring and competition
- cdl_fixtures
- fixture_score_snapshots
- fixture_player_scores
- fixture_results
- league_table_snapshots
- knockout_brackets
- knockout_ties
- knockout_legs

External FPL data
- external_fetch_log
- external_payload_cache
- fpl_players
- fpl_teams
- fpl_gameweeks
- fpl_fixtures
- fpl_event_live_players
- fpl_element_summaries

Notifications and audit
- notifications
- activity_events
- audit_events
- workflow-specific event tables
```

## Layering rules

1. CDL domain data is authoritative for leagues, teams, squads, lineups, transfers, fixtures, scoring results, and league tables.
2. FPL data is an external source cache, not CDL truth.
3. Live scoring can be recalculated from FPL event-live data, but final CDL results are frozen against a score snapshot.
4. Read models should power complex screens such as Gameweek Centre, Draft Room, Player Pool, Approval Queue, and Fixture Detail.
5. React should not implement business rules that decide official competition state.

## Key state boundaries

### League season state

```text
setup
→ inviting
→ ready_for_draft
→ draft_live
→ draft_complete
→ active
→ regular_season_complete
→ knockout_active
→ complete
→ archived
```

### Draft state

```text
created
→ order_generated
→ ready
→ live
→ paused
→ complete
```

### Lineup state

```text
rolled_forward
→ updated / confirmed / auto_adjusted
→ locked
→ commissioner_corrected, if required
```

### Fixture state

```text
scheduled
→ lineups_locked
→ live
→ provisional
→ system_final
→ commissioner_corrected, if required
```

## Implementation principle

Implement by domain dependency order, not by legacy page order. The first narrow validation loop should prove:

```text
league creation
→ season setup
→ FPL player cache
→ live draft
→ squad assignments
→ lineup lock
→ scoring snapshot
→ fixture result
→ table snapshot
```
