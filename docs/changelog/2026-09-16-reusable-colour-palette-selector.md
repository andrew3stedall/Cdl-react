# Reusable custom colour palette selector

## Changed

- Replaced the duplicate custom palette colour rows with one interactive selector
  below the colour controls.
- Removed hex values from the custom palette editor UI.
- Extracted the selector into a reusable component shared by position, metric,
  and FDR custom colour editors.
- Kept automatically interpolated FDR levels visible but unavailable for direct
  editing when anchor mode is selected.

## Validation

- Frontend lint, typecheck, tests, and production build pass.
