# Squad Analysis and Slot Visualisation

## Purpose

Define the squad page as a visual slot-based analysis view showing filled/empty squad slots, constraints, risks, temporary rights, and loan state.

## Status

Checkpoint 4 complete.

## Business Rules

- Squad analysis should use filled and empty slot cards rather than only numeric counts.
- Empty slots should be grey/blank cards.
- Position colours are consistent across app.
- Temporary rights should be visible with expiry warnings.
- Loaned-in and loaned-out players should be visible.
- Injury/status risk should be visible but not forcibly hidden.

## Target Architecture

```text
squad_analysis_view
squad_assignments
temporary_player_rights
loans
fpl_players
fpl_fixtures
```

## API Requirements

- Get squad analysis for season team.
- Return slot layout by position.
- Return empty slots.
- Return loan and temporary right summaries.
- Return risk/status indicators.

## React Requirements

- Position-grouped card layout.
- Empty slot cards.
- Temporary right action prompts.
- Loan status badges.
- Injury/status indicators.
- Add/remove player actions where allowed.

## Data Access Requirements

- Slot layout derives from active squad and configured caps.
- Empty slots are presentation/read-model output, not persisted records.

## Acceptance Criteria

- Manager can see squad capacity visually.
- Manager can identify open slots, temporary rights, and loaned players.
