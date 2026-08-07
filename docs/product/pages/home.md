# Home product specification

## Product job

Home is the manager's urgency-led command centre. It answers:

> What needs my attention next, and what can wait?

## Default behaviour

Home adapts to the current state.

- When urgent work exists, feature the highest-impact action and group the remaining items by type.
- When no urgent work exists, feature the next deadline, then show upcoming items. Calendar access is secondary.
- Users can switch between ranked and grouped views.

## Priority model

The priority model combines:

- hard deadlines;
- player risks;
- pending decisions;
- performance problems;
- likely impact.

The score is a ranking mechanism, not necessarily a user-facing number.

## Interaction model

Selecting a Home item should either:

- open quick context in a drawer/bottom sheet; or
- take the user to the owning feature when the action is multi-step, consequential or comparison-heavy.

Examples:

- lineup deadline -> Matchweek;
- pending trade decision -> Market;
- injured squad player -> Squad quick detail;
- draw deadline -> Market draw preferences;
- league event -> League.

## Usability criteria

- A manager can identify the next important action without scanning every feature.
- Deadline state is never hidden behind generic dashboard metrics.
- Every urgent item has a clear owning feature and action.
- When there is nothing urgent, Home remains useful rather than empty.
