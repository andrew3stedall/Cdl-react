# 2026-08-07 — Squad generated-design visual parity

## Goal

Bring the implemented Squad page materially closer to the four approved/generated portrait mobile concepts without inventing backend data.

## Visual implementation

- Reworked Squad into a full dark navy/cyan mobile presentation.
- Added Castle Draft League visual lockup inside the Squad experience.
- Restyled the Pitch/List selector to the large segmented treatment from the generated concepts.
- Added the four-card summary strip for total points, form, xG and xA.
- Total points and form are calculated from real Squad response values.
- xG/xA show explicit API placeholders until persistent analytics fields exist.
- Rebuilt Pitch player tiles around shirt imagery, player name, fixture placeholder, form dots, form value and captain/vice-captain indicators.
- Added a compact bench strip.
- Rebuilt List view with search, sorting, position tabs, total points, form, xG, xA and availability columns.
- Reworked player quick detail into the generated bottom-sheet treatment on mobile.
- Kept Compare, Release to Free Agency, Draft Trade and Full Profile as the four player actions.
- Reworked Squad Changes into the collapsed/expanded treatment from the visual target.
- Reworked confirmation into a mobile bottom review sheet.
- Added a Squad-only mobile bottom navigation using the settled Home / Squad / Market / Matchweek / League product model.

## Team shirt imagery

Added generic local SVG football-shirt icons for all 20 confirmed 2026/27 Premier League clubs, based on recognisable home colours. The assets intentionally avoid club crests, sponsors and copied commercial kit photography.

See `docs/design/premier-league-shirt-icons.md`.

## API placeholders

The generated designs include information that the current authenticated manager APIs do not expose. The UI now marks those values rather than fabricating them. Missing contracts include xG, xA, next opponent, player availability/chance of playing, trade-value evidence, advanced filters, draw-won temporary rights and a complete player-profile dataset.

See `docs/product/api-gaps/squad-visual-parity.md`.

## Product boundary retained

- Squad remains season-long roster management.
- Matchweek remains the owner of weekly lineup editing.
- Market remains the owner of discovery, draws, watchlist, Interests and trade activity.
- Squad Changes still does not claim to persist draw additions/releases until the atomic manager workflow exists.
