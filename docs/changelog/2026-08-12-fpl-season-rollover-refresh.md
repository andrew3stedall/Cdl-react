# FPL season rollover refresh

The staging FPL cache was refreshed from the official FPL API for the 2026/27
pre-season data set.

The squad read path now selects player prices from the official current gameweek,
falling back to the official next gameweek before the season starts. This prevents
last season's gameweek 38 price rows from winning after a new season starts at
gameweek 1.

Validation includes the FPL ingestion test suite and the staging rollout, which runs
database migrations, the official FPL refresh job, and live health/authentication
checks.
