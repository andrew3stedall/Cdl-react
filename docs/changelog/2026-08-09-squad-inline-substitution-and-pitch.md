# 2026-08-09 — Squad inline substitutions and pitch refinement

## Decision

Substitution is now completed on the main Squad surface rather than in a second candidate drawer.

## Behaviour

- Selecting **Substitute player** closes the player detail drawer and enters a compact page-level substitution mode.
- The current Pitch or List view remains visible, with only formation-valid replacement players selectable.
- The selected replacement and any required goalkeeper or numbered outfield bench slot are confirmed inline.
- Pitch position rows are transparent so the pitch markings remain visible.
- Players use restrained position marker colours instead of visible position labels in the main player representations.
- Pitch rows use tighter vertical sizing and spacing while retaining the mobile five-player layout.

## Validation

- React coverage exercises direct replacement selection from Pitch and List views.
- The existing multi-viewport journey continues to cover list-view dropdown removal, valid candidate filtering, bench ordering, save/reload persistence and fixture-lock behaviour.
