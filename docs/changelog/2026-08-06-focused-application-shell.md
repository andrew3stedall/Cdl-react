# Focused Application Shell

## Summary

Replaced the oversized all-routes shell with a focused navigation model inspired by shadcn application layouts and modern material surfaces.

## Changes

- Reduced global navigation to Overview, Squad, Team, and League.
- Moved Scouting and Fixture difficulty into Squad context.
- Moved league formats into a dedicated contextual navigation row.
- Moved Rules to support navigation and the desktop header utility action.
- Replaced the generic Application Shell heading with the current section and page.
- Removed the permanent session summary card and exposed account, appearance, refresh evidence, and sign-out through contextual account controls.
- Added a mobile drawer with backdrop, grouped navigation, account settings, and explicit close behaviour.
- Changed the authenticated root destination to the Overview dashboard.
- Made `/scouting` open Squad Management directly on the Player pool tab.

## Validation boundary

The change preserves existing route components, API clients, authentication checks, PostgreSQL behaviour, and visual presets. It changes shell information architecture and navigation presentation only.
