# Premier League shirt icons — 2026/27

## Source and intent

The Squad visual design needs compact club-identification imagery similar to the generated mobile concepts. The 2026/27 Premier League club set and current-kit context were checked against the Premier League's official kit page:

- https://www.premierleague.com/en/news/4672981/copy-premier-league-club-kits-for-202627-season

The Squad page now uses the actual current FPL shirt artwork from the official FPL asset path. The asset code is the FPL `teams[].code` value from `bootstrap-static`, not the club's FPL database ID:

```text
https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_code}-{size}.webp
```

The frontend keeps the remote URL mapping in `frontend/src/fpl-shirt-assets.ts`, uses 66px artwork for cards and 110px artwork in drawers, and falls back to the existing generic SVG if the upstream asset is unavailable. The fallback SVGs remain for legacy or unknown team codes.

## Stored assets

The current official FPL asset-code mapping is:

| Club | FPL asset code |
|---|---:|
| Arsenal | 3 |
| Aston Villa | 7 |
| Bournemouth | 91 |
| Brentford | 94 |
| Brighton & Hove Albion | 36 |
| Chelsea | 8 |
| Coventry City | 9 |
| Crystal Palace | 31 |
| Everton | 11 |
| Fulham | 54 |
| Hull City | 88 |
| Ipswich Town | 40 |
| Leeds United | 2 |
| Liverpool | 14 |
| Manchester City | 43 |
| Manchester United | 1 |
| Newcastle United | 4 |
| Nottingham Forest | 17 |
| Sunderland | 56 |
| Tottenham Hotspur | 6 |

The repository still stores generic SVG fallbacks in `frontend/public/team-shirts/` for the 20 current clubs:

- `ars.svg` — Arsenal — red;
- `avl.svg` — Aston Villa — claret / sky blue;
- `bou.svg` — Bournemouth — red / black stripes;
- `bre.svg` — Brentford — red / white stripes;
- `bha.svg` — Brighton & Hove Albion — blue / white stripes;
- `che.svg` — Chelsea — blue;
- `cov.svg` — Coventry City — sky blue;
- `cry.svg` — Crystal Palace — blue / red stripes;
- `eve.svg` — Everton — royal blue;
- `ful.svg` — Fulham — white / black;
- `hul.svg` — Hull City — amber / black stripes;
- `ips.svg` — Ipswich Town — blue / white;
- `lee.svg` — Leeds United — white;
- `liv.svg` — Liverpool — red;
- `mci.svg` — Manchester City — sky blue;
- `mun.svg` — Manchester United — red;
- `new.svg` — Newcastle United — black / white stripes;
- `nfo.svg` — Nottingham Forest — red;
- `sun.svg` — Sunderland — red / white stripes;
- `tot.svg` — Tottenham Hotspur — white / navy.

The repository also retains two colour icons used by existing staging/test-season fixtures while those fixtures are migrated to the current season:

- `whu.svg` — West Ham United — claret / sky blue;
- `wol.svg` — Wolverhampton Wanderers — gold.

`unknown.svg` is the fallback for an unrecognised team code.

## Maintenance

At each new Premier League season:

1. refresh `bootstrap-static` and verify the 20-club membership and `teams[].code` values;
2. update `frontend/src/fpl-shirt-assets.ts` for promoted/relegated teams;
3. verify the official asset URLs in a controlled staging browser;
4. retain the generic SVG fallback for upstream outages and legacy persisted data;
5. confirm reuse rights before copying the artwork into local storage or a CDN. The current implementation hotlinks the official FPL artwork and does not redistribute a copied binary bundle.

The official FPL metadata source is [bootstrap-static](https://fantasy.premierleague.com/api/bootstrap-static/). The artwork is an undocumented website asset path and may change; treat the fallback as part of the runtime contract.
