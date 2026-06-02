# FPL Data Guide

FPL is the only external data provider for the initial rebuild.

## Initial endpoint families

- `bootstrap-static`
- `fixtures`
- `event/{gameweek}/live`
- `element-summary/{player}`

## Cache principles

- Store raw payload metadata.
- Store normalized FPL tables used by app logic.
- Use TTL freshness windows so the app does not refetch unnecessarily.
- Show source freshness on live scoring pages.

## CDL ownership boundary

FPL data provides player facts and scoring inputs. CDL owns leagues, squads, lineups, fixtures, results, and tables.

Final CDL results should not depend on future FPL refetches.
