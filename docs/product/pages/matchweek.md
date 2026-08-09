# Matchweek product specification

## Product job

Matchweek describes the weekly execution model. The current UI is consolidated into Squad so the manager has one lineup workspace. It answers:

> How should I set up my team for this gameweek before the deadline?

## Owns

- starting lineup;
- bench order;
- captain and vice-captain;
- chips;
- fixture lock state;
- save/submit selection;
- deadline context;
- weekly selection validation.

## Relationship with Squad

Squad is the canonical UI for the current lineup, bench, captaincy, chips, deadline, and save validation. `/team-selection` remains a compatibility alias and must resolve to the same experience; it must not render a second lineup panel.

## Entry behaviour

Matchweek should foreground the next lineup deadline and current selection state. If the lineup is valid and saved, the page should make that clear without creating artificial urgency.

## Usability acceptance criteria

- The user can tell whether the current gameweek selection has been saved.
- Captaincy, bench order and chips are grouped with the current gameweek lineup inside Squad.
- Lock state and deadline effects are explained before an action fails.
- The page remains useful on mobile without relying on drag-and-drop as the only editing mechanism.
