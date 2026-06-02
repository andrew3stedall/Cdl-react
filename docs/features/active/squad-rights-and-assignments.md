# Squad Rights and Assignments

## Purpose

Define the difference between player control, temporary rights, and active squad membership.

## Status

Checkpoint 1 complete.

## Business Rules

- Use the term squad, not roster.
- A player cannot be owned by more than one team in the same league season at the same time.
- Free agency draw wins create temporary rights for that gameweek only.
- Temporary rights do not count against squad caps.
- If squad has space, a temporary draw-won player can be auto-added.
- If squad is full, manager must remove a player before the FPL deadline.
- If not activated before deadline, temporary right expires.
- Squad history must be preserved for scoring, cooling-off rules, and audit.

## Target Architecture

```text
squad_assignments
temporary_player_rights
squad_actions
squad_action_items
transfer_restrictions
```

`squad_assignments` should represent historical active squad membership:

```text
start_gameweek_id
end_gameweek_id
start_reason
end_reason
```

## API Requirements

- Get active squad for team/gameweek.
- Get squad history.
- Activate temporary right.
- Remove player from squad.
- Validate squad cap and position limits.
- Explain why a player is or is not available.

## React Requirements

- Squad page with filled and empty slot cards.
- Temporary right callouts.
- Remove-to-add flow when full.
- Availability reason display.

## Data Access Requirements

- Current squad is derived from historical assignments.
- Do not maintain a separate current-only source of truth.
- Preserve all squad changes as events/actions.

## Acceptance Criteria

- Draw-won player expires if not activated before deadline.
- Player activation respects squad caps.
- Historical squad state can be reconstructed for any gameweek.
