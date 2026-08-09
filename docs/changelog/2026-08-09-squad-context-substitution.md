# 2026-08-09 — Squad context-menu substitutions

## Decision

Player movement is now handled through the shared Squad contextual drawer. List view no longer exposes per-player dropdowns.

## Behaviour

- Selecting **Substitute player** opens a focused swap flow.
- Eligible replacements are limited to swaps that preserve the Starting XI formation and bench composition.
- Starting XI eligibility follows the configured 1 GKP, 3–5 DEF, 2–5 MID and 1–3 FWD limits.
- When a player enters the bench, the manager can choose the goalkeeper slot or numbered outfield position 1–4.
- Substitutions remain staged in the browser until **Save lineup**; the existing server-side lineup validation remains authoritative.
- Locked gameweeks expose the action context but disable substitution.

## Validation

- Added React coverage for dropdown removal, legal candidate filtering, bench ordering, and full-squad formation filtering.
- Updated the multi-viewport browser journey to exercise two context-menu swaps and persistence after reload.
