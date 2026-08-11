# Squad pitch orientation preference

Date: 2026-08-10

- Added a persisted manager preference for attacking upwards or downwards.
- Defaulted new and existing managers to attacking upwards.
- Added a profile control for changing the attacking direction.
- Updated Squad pitch view to show the corresponding 60% pitch slice and order
  forwards toward the selected attacking end.
- Confirmed the physical direction mapping so attacking upwards places forwards
  at the top of the pitch view, while attacking downwards places the goalkeeper
  at the top and forwards at the bottom.
- Added responsive and API regression coverage for both orientations.
