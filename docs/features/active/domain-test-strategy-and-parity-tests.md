# Domain Test Strategy and Parity Tests

## Purpose

Define scenario-driven testing, service tests, permission tests, time-based tests, migration tests, and legacy behaviour parity tests.

## Status

Checkpoint 5 implementation contracts are in progress on `checkpoint-5-history-documentation`.

## Test Categories

```text
unit tests
service tests
scenario tests
permission tests
time-based tests
migration tests
parity / characterisation tests
```

## Scenario Coverage

Draft:

```text
snake and repeated draft order
timeout autopick
preselection autopick
commissioner pick-on-behalf
pick duration tracking
```

Free agency:

```text
private preferences
deterministic draw processing
temporary rights
expiry at deadline
```

Transfers and loans:

```text
both-party agreement
commissioner approval
vice commissioner approval when commissioner involved
loan return
loan extension
loan-to-permanent conversion
```

Lineups and scoring:

```text
roll-forward lineup
auto-adjusted lineup
captain/vice validation
formation validation
substitutions
chips
fixture finalisation
commissioner correction
```

Knockouts:

```text
two-leg aggregate
most-goals tiebreaker
bracket winner progression
```

## Parity Tests

Use selected historical legacy examples to verify that new domain services either reproduce known behaviour or document intentional differences.

## Acceptance Criteria

- Rule-heavy workflows have service-level tests.
- Critical permissions are tested.
- Time/deadline behaviour is testable with fixed clocks.
- Legacy parity gaps are explicit, not accidental.
