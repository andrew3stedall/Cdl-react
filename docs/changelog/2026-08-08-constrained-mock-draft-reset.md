# 2026-08-08 — Position-constrained staging mock draft

## Goal

Reset every 2026/27 staging squad and repopulate the eight-manager league with a deterministic mock draft that obeys the Castle Draft League squad-composition rules.

## Squad rules enforced

Every squad contains exactly 20 unique players and must remain within:

- GKP: minimum 2, maximum 3;
- DEF: minimum 4, maximum 10;
- MID: minimum 5, maximum 10;
- FWD: minimum 2, maximum 4.

The seed validates all eight completed squads before the transaction commits.

## Captured draft board

The active staging source of truth is the completed 160-pick board captured from the draft screenshots. Player identity and pick rank are preserved, with official FPL records refreshed separately before the seed runs.

## Allocation

The draft retains the eight-team, 20-round snake turn order. The screenshot's first-round manager order is Exeter Gently, Dicks Dribbling XI, Bayer Neverlusen, Sporting Lesbians, Stan Still Sells Tik, Class of 84, Koden All Stars, and Wilde Boars. That order is explicitly mapped to the application's team IDs before ownerships are written.

The deterministic position totals are:

| Team | GKP | DEF | MID | FWD | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exeter Gently | 2 | 5 | 10 | 3 | 20 |
| Stan Still Sells Tik | 2 | 5 | 9 | 4 | 20 |
| Koden All Stars | 2 | 6 | 8 | 4 | 20 |
| Dicks Dribbling XI | 3 | 7 | 6 | 4 | 20 |
| Sporting Lesbians | 2 | 7 | 8 | 3 | 20 |
| Bayer Neverlusen | 2 | 7 | 7 | 4 | 20 |
| Wilde Boars | 2 | 7 | 8 | 3 | 20 |
| Class of 84 | 2 | 7 | 7 | 4 | 20 |

## Staging execution

`seed_staging_snake_draft` deletes the season's ownership and roster-slot rows and inserts the replacement draft in one database transaction. A validation or insertion failure therefore cannot commit a partially populated league.

The `GCP Reset Staging Mock Draft` workflow runs only after a successful main-branch automatic staging rollout whose source commit explicitly contains `[reset-staging-draft]`. Ordinary staging deployments do not execute the synthetic seed.
