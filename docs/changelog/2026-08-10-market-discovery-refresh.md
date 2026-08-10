# 2026-08-10 — Refresh Market discovery workspace

## Summary

Replaced the legacy-shaped scouting presentation with a focused Market workspace aligned to the current Home / Squad / Market / League shell.

## Changes

- Added a Market page at `/scouting` with Discovery, Interests, and Trades task views.
- Added contextual Market navigation for Interests and Trades while retaining Fixture Difficulty as a Market-context tool.
- Reframed the page around the acquisition question: find a player, inspect official evidence, then take a contextual action.
- Preserved the existing `/api/squad/summary`, `/api/scouting/players`, `/api/interests`, `/api/trades`, and FPL history contracts.
- Added explicit ownership, draw-Interest, availability, next-fixture, xG and xA presentation without fabricating missing values.
- Removed the page-local mobile navigation so the global shell remains the single navigation source.
- Updated the screenshot route inventory and browser interaction journey to exercise Market rather than the former combined page.

## Deliberate gaps

Watchlist bookmarks, ranked Interest reordering, advanced threshold filters, and the full Trade Builder remain separate follow-up work. The page labels these boundaries instead of implying that the legacy Interest endpoint is already a general watchlist.
