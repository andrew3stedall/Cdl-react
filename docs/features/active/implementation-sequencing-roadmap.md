# Implementation Sequencing Roadmap

## Purpose

Define practical build checkpoints for the redesigned CDL application.

## Status

Reconciled release-scope reference — 6 October 2026.

The named checkpoints remain dependency-planning labels; they are not a claim that every capability listed in them is production-ready. The supported candidate is the four-destination manager shell (Desk, Squad, Market and League), with Rules and Fixture Difficulty available contextually. Next-season authoring, configurable rule administration, general corrections, advanced loan policy, durable reminders and final release gates remain explicit follow-up work.

## Principle

Use checkpoints to order dependencies and validate connected workflows. Current delivery is staged toward production readiness; it does not wait for every future capability, and it does not turn a schema, prototype route or deterministic test contract into a product claim.

## Checkpoint A — Foundation and Draft

Validate invitations, FPL player data, the configured-season draft, squad creation and the basic squad page. Self-service league/season setup and next-season draft activation remain bounded by #521/#522.

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
