# Squad Management Workspace Redesign

## Summary

Replaced the single long Squad Management page with a focused, tabbed manager workspace inspired by shadcn/ui interaction patterns and modern material surfaces.

## UX changes

- Made **My squad** the default view instead of rendering squad, scouting, interests, trades, and player details simultaneously.
- Added dedicated **Player pool** and **Activity** tabs with counts and contextual header actions.
- Added a compact summary row for player count, squad value, average points, and current gameweek.
- Added player and club search plus position and availability filters inside the Player pool context only.
- Replaced the inline player-detail section with a responsive right-hand drawer that supports backdrop and Escape-key closing.
- Kept interests and proposed trades in an Activity view rather than permanently occupying the squad page.
- Added responsive, horizontally contained player tables with position and availability badges.

## Data behaviour

- Preserved the existing authenticated PostgreSQL-backed squad, scouting, interests, and trades API calls.
- Preserved server error messages for rejected or unauthenticated interest mutations.
- Updates the local player state after a successful interest registration so the interface immediately shows the player as watched.

## Validation

- Updated component tests for focused default content, tab switching, player filtering, interest creation, and the player drawer.
- Updated mobile and desktop Playwright persistence journeys to navigate the new Player pool and Activity tabs.
