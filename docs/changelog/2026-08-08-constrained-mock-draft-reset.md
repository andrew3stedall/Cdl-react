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

## Draft-pool correction

The previous embedded top-160 staging board contains only 13 goalkeepers, but eight legal squads require at least 16. The existing top-160 order is therefore retained and three reviewed goalkeeper candidates are appended to the staging eligibility pool: Henderson, Sels and Martinez. Exactly 160 of the 163 eligible players are drafted.

The added goalkeeper candidates are sourced from the current goalkeeper review in `andrew3stedall/-static--cdl`; their staging pool ranks are deliberately placed after the existing 160 so this reset does not otherwise reorder the established mock board.

## Allocation

The draft retains the eight-team, 20-round snake turn order. At each pick the allocator takes the highest-ranked remaining candidate that:

1. does not exceed that team's positional maximum;
2. leaves enough roster slots for that team to satisfy every remaining minimum;
3. leaves enough players of each position for all eight teams to satisfy their remaining minimums; and
4. does not force the remaining player pool beyond the aggregate positional maximum capacity.

The deterministic position totals are:

| Team | GKP | DEF | MID | FWD | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exeter Gently | 2 | 5 | 10 | 3 | 20 |
| Stan Still Sells Tik | 2 | 6 | 10 | 2 | 20 |
| Koden All Stars | 2 | 5 | 9 | 4 | 20 |
| Dicks Dribbling XI | 2 | 6 | 10 | 2 | 20 |
| Sporting Lesbians | 2 | 7 | 7 | 4 | 20 |
| Bayer Neverlusen | 2 | 5 | 9 | 4 | 20 |
| Wilde Boars | 2 | 6 | 8 | 4 | 20 |
| Class of 84 | 2 | 4 | 10 | 4 | 20 |

## Staging execution

`seed_staging_snake_draft` deletes the season's ownership and roster-slot rows and inserts the replacement draft in one database transaction. A validation or insertion failure therefore cannot commit a partially populated league.

The `GCP Reset Staging Mock Draft` workflow runs only after a successful main-branch automatic staging rollout whose source commit explicitly contains `[reset-staging-draft]`. Ordinary staging deployments do not execute the synthetic seed.
