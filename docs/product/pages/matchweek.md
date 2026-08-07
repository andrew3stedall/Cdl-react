# Matchweek product specification

## Product job

Matchweek is the weekly execution workspace. It answers:

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

Squad may show the current lineup as a read-only preview because it helps explain the current squad. Editing that lineup always belongs in Matchweek.

A Squad action that affects the season-long roster may change which players are available for Matchweek, but it does not silently rewrite the manager's weekly choices.

## Entry behaviour

Matchweek should foreground the next lineup deadline and current selection state. If the lineup is valid and saved, the page should make that clear without creating artificial urgency.

## Usability acceptance criteria

- The user can tell whether the current gameweek selection has been saved.
- Captaincy, bench order and chips are not mixed into season-long Squad management.
- Lock state and deadline effects are explained before an action fails.
- The page remains useful on mobile without relying on drag-and-drop as the only editing mechanism.
