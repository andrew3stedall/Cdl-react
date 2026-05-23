# Fixture Difficulty Ratings

## Purpose

Issue #10 adds the modern Fixture Difficulty Ratings route for attack and defence difficulty tables, team and gameweek filters, dense responsive layouts, and token-driven rating scales.

## Source of Truth

- Feature document: `docs/features/active/fixture-difficulty-ratings.md`
- Issue: #10
- Coordination:
  - Authenticated application shell routing.
  - Shared team and gameweek contracts from league fixtures.
  - Theme preset tokens for accessible FDR colour scales.
  - Dashboard chart palette consistency for rating and legend semantics.

## API

### Combined FDR

```http
GET /api/fdr?team_id=arsenal&gameweek_start=12&gameweek_end=16
```

Returns both attack and defence tables plus the active rating scale.

### Attack FDR

```http
GET /api/fdr/attack?gameweek_start=12&gameweek_end=16
```

Returns attack-focused fixture difficulty rows grouped by team and gameweek.

### Defence FDR

```http
GET /api/fdr/defence?team_id=man-city
```

Returns defence-focused fixture difficulty rows grouped by team and gameweek.

### Rating scales

```http
GET /api/fdr/scales
```

Returns rating values, difficulty labels, semantic bands, foreground token names, background token names, and documented contrast ratios.

## Rating Scale

| Rating | Band | Meaning |
|---:|---|---|
| 1 | Very easy | Lowest difficulty |
| 2 | Easy | Favourable fixture |
| 3 | Medium | Neutral fixture |
| 4 | Hard | Difficult fixture |
| 5 | Very hard | Highest difficulty |

The frontend maps rating values to `fdr-rating-{n}` classes. CSS maps those classes to theme-level FDR variables such as `--fdr-1-background` and `--fdr-1-foreground`.

## UI Behaviour

`/fdr` renders inside the shared authenticated application shell and includes:

- Team filter.
- Start and end gameweek filters.
- Rating legend.
- Attack FDR table.
- Defence FDR table.
- Sticky team column.
- Horizontal scrolling dense table layout for small screens.

## Data Access

The implementation uses an in-memory repository behind a `FixtureDifficultyService` boundary. Persistent FDR calculations, legacy data import, and stable database views remain future migration work. API responses separate rating values from display metadata so clients do not need direct calculation or SQL access.

## Validation

Expected validation commands:

```bash
uv run pytest
cd frontend
npm run lint
npm run test
npm run build
```

The active feature document remains in `docs/features/active/` until validation passes.
