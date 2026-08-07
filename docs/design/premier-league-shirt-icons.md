# Premier League shirt-colour icons — 2026/27

## Source and intent

The Squad visual design needs compact club-identification imagery similar to the generated mobile concepts. The 2026/27 Premier League club set and current-kit context were checked against the Premier League's official kit page:

- https://www.premierleague.com/en/news/4672981/copy-premier-league-club-kits-for-202627-season

The application does **not** copy club crests, sponsor marks or commercial shirt photography. Instead, it stores small generic SVG football-shirt silhouettes using recognisable home-kit colour combinations. These are presentation assets rather than authoritative reproductions of each licensed kit.

## Stored assets

Assets live in `frontend/public/team-shirts/` for the 20 confirmed 2026/27 Premier League clubs:

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

`unknown.svg` is the fallback for an unrecognised team code.

## Maintenance

At each new Premier League season:

1. verify the 20-club membership against an official Premier League source;
2. verify whether any home colour treatment materially changed;
3. add/remove SVG assets for promoted/relegated teams;
4. keep icons generic unless the project later establishes an explicit licensed crest/kit asset strategy.
