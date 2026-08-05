# Squad management pitch and list redesign

Date: 2026-08-06

## Delivered

- Reframed squad management as a dark navy, cyan-accented manager workspace inspired by the supplied mobile references.
- Added an accessible Pitch / List display toggle to the My squad tab.
- Built the pitch from persisted `/api/team-selection` starter, bench and reserve slots rather than deriving a formation from roster order.
- Combined lineup metadata with `/api/squad/summary` points and values.
- Added formation, starter and bench summaries, position rows, captain and vice-captain markers, and contextual player-detail access.
- Retained the complete roster table, player-pool search and filters, interests, trades and player-detail drawer.
- Added a safe list fallback when no saved lineup is available.
- Extended component and Playwright coverage to verify pitch rendering, bench placement, list switching, persistence and mobile/desktop behavior.

## Boundaries

- The pitch is a display surface for the persisted lineup; lineup editing remains in Team Selection.
- Player cards use initials and club abbreviations because official shirt artwork is not currently part of the application data contract.
- No synthetic formation is created when the lineup endpoint is unavailable.
