# 2026-08-08 — Legal staging lineups and Squad grouping

## Weekly selection rules

The 20-player gameweek partition is now treated as:

- 11 players in the Starting XI;
- 5 substitutes;
  - exactly 1 goalkeeper substitute;
  - exactly 4 outfield substitutes ordered 1 through 4;
- 4 reserves.

A legal Starting XI contains exactly one goalkeeper and uses the standard formation bounds:

- DEF: 3–5;
- MID: 2–5;
- FWD: 1–3.

Captain and vice-captain must both be in the Starting XI and must be different players.

## Staging seed

After the constrained mock draft and named-team reroll, staging now persists a legal gameweek-one selection for all eight teams. The selection algorithm preserves roster/draft priority where possible while first satisfying the minimum legal formation. It then assigns one remaining goalkeeper to the bench, orders the best four remaining outfield players as substitutes 1–4, and places all other players in reserves.

The seed validates all 160 lineup rows before completion.

## Squad presentation

The Squad page keeps all 20 owned players visible but now separates weekly roles clearly.

- Pitch view shows Starting XI, Bench and Reserves as distinct areas.
- Bench shows five players, with the goalkeeper separate from outfield preference 1–4.
- List view has explicit Starting XI, Bench and Reserves sections.
- List rows include a role label such as Starting XI, GK sub, Sub 1–4 or Reserve.
- Position badges and row accents distinguish GKP, DEF, MID and FWD.
- Sorting remains available within the meaningful lineup grouping; bench preference order is never replaced by an analytics sort.
