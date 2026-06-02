# Implementation Sequencing Roadmap

## Purpose

Define practical build checkpoints for the redesigned CDL application.

## Status

Proposed / accepted discovery.

## Principle

The project does not need an early production release. These checkpoints are for managing build risk and validating connected workflows.

## Checkpoint A — Foundation and Draft

Validate league setup, season setup, invitations, FPL player data, live draft, squad creation, and the basic squad page.

## Checkpoint B — Weekly Gameplay

Validate team selection, lineup lock, chips, substitutions, FPL live scoring, fixture detail, fixture result finalisation, and the basic league table.

## Checkpoint C — Squad Movement

Validate free agency draws, transfers, loans, approval queue, lineup warnings, and notifications.

## Checkpoint D — Competition Experience

Validate Gameweek Centre, table movement, knockout bracket, player comparison, watchlist alerts, and squad analysis.

## Checkpoint E — History and Documentation

Validate historical import, archived reference views, parity tests, historical seasons, and wiki documentation.

## Dependency Order

1. League, season, and team model.
2. Rule configuration and permissions.
3. FPL data cache.
4. Draft and squad assignments.
5. Lineups and scoring.
6. Fixture, table, and knockout views.
7. Player and scouting features.
8. Notifications and operational workflows.
9. History and documentation.

## Acceptance Criteria

- Each checkpoint has a runnable end-to-end validation path.
- Incomplete states are guarded explicitly.
- Build order follows domain dependencies, not legacy page order.
