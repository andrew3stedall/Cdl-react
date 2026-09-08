# Manager Desk fixture score density — 2026-09-08

## User-facing change

- Tightened vertical spacing between previous-gameweek score rows so each Manager Desk fixture card is shorter.
- Changed previous-gameweek score cells from wide pills to square cells.
- Kept the featured manager fixture score squares larger while using smaller compact squares for the remaining fixtures.
- Forced fixture manager identity content into a single vertical column so the manager nickname sits directly below the crest and the record remains below the nickname, including the featured fixture.

## Scope

This is a presentation-only Manager Desk change. Fixture ordering, five-gameweek history selection, score/result colours, bonus markers, league positions, and live-score visibility rules are unchanged.

## Validation

The existing Manager Desk component coverage continues to verify the canonical manager nicknames, featured/supporting fixture structure, score result states, and bonus markers. CI and staging rollout status are recorded on the implementation pull request.
