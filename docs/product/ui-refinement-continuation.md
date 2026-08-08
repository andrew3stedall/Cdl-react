# UI refinement continuation

## Purpose

This is the parking lot for product decisions that are intentionally not resolved yet. Use it to resume structured refinement without repeating decisions already captured in `docs/product/feature-placement-and-navigation.md` and `docs/product/pages/`.

The active refinement thread is now the possible **combined Squad + team-selection workspace**. Its settled decisions, unresolved chip question and backend implications are captured in `docs/product/combined-squad-team-selection-working-notes.md`. That working note takes precedence over the older assumption below that weekly lineup editing must always live on a separate Matchweek page.

## Decisions already made

- Primary navigation: Home, Squad, Market, Matchweek, League. This may be revisited if the combined Squad + team-selection direction removes the need for a separate Matchweek destination.
- Home is urgency-led and adaptive.
- Squad is season-long squad health and staged squad changes, and is now being explored as the same workspace used to edit gameweek selections.
- Market owns discovery, draws, watchlist, Interests and trade activity.
- League owns competition context.
- Quick context uses drawers/bottom sheets; complex consequential work uses dedicated flows.
- Compare supports up to three manually selected players in selection order.
- Watchlist and Interests are separate.
- Draw Interests are one ranked list per draw with drag, direct-number and move-control ordering.
- Draw wins create temporary rights; actual squad activation/removal belongs in Squad.

## Questions to resume later

### Combined Squad + team selection

Resume from **Question 4 — chip presentation** in `combined-squad-team-selection-working-notes.md`.

Already settled in that thread:

- all 20 players remain visible;
- each gameweek has 11 starters, 5 substitutes and 4 reserves;
- one substitute must be a goalkeeper;
- four outfield substitutes are explicitly ordered 1–4;
- future gameweeks can be prepared and saved independently;
- an unsaved future gameweek initially inherits the most recently saved prior selection;
- later roster changes flag invalid saved future selections rather than silently replacing players;
- lineup, substitute order, reserves, captaincy, vice-captaincy and chips are staged together and committed with one explicit Save Team action.

### Home

- Exact urgency categories and weighting.
- Which notifications should create Home items versus passive badges.
- Calendar scope and whether deadlines and fixtures share one calendar.
- How much explanation to show for automated priority recommendations.

### Squad

- Exact injury/availability model once official and injury-source data contracts are joined.
- Exact specialist List columns by position.
- Whether optional drag-and-drop should be offered for staged draw changes.
- Trade-value labels and thresholds.
- Full player-profile route and information architecture.
- Exact visual treatment for club shirts once an asset/licensing strategy is chosen.

### Market

- Exact contextual ranking formula and whether users can inspect its factors.
- Draw lifecycle presentation before, during and after processing.
- Watchlist placement relative to discovery.
- Full Trade Builder structure for multi-player trades.
- Whether trade negotiation messaging belongs inline or in an activity thread.

### League

- Which competition summary should be default on entry.
- Table movement visualisation.
- Fixture detail depth.
- Knockout bracket interaction on mobile.

## Known implementation dependencies

These are implementation gaps, not open product decisions:

- Current Squad API does not expose official form, xG, xA, next opponent, minutes risk or projected points in the Squad response.
- Current production Squad API does not expose temporary draw rights or an atomic staged squad-change endpoint. Checkpoint/modernisation routes demonstrate the domain but are not the persistent manager workflow.
- Current app does not have a dedicated full player-profile route.
- Current trade API can create and update proposals, but the intended Market Trade Builder and complete negotiation UI are not yet implemented.
- Current team-selection persistence assumes 11 starters + 4 bench + 5 reserves for a 20-player squad; the new target is 11 + 5 + 4, with one goalkeeper substitute and four ordered outfield substitutes.
- Current team-selection service is fixed to the current demo gameweek and needs a gameweek-aware persistence contract before future selections can be saved independently.

## Recommended implementation sequence after the current refinement

1. Finish the combined Squad + team-selection interaction decisions and prototype the single-page layout.
2. Update the team-selection contract for 11 starters + 5 substitutes + 4 reserves and future-gameweek persistence.
3. **Market** — it owns draws, Interests, discovery and trade activity and unlocks the remaining staged squad-change workflow.
4. **Home** — build urgency aggregation after the owning feature workflows can provide actionable states.
5. **League** — refine the competition experience after the manager action flows are stable.

## Rule for future refinement

Do not reopen settled questions unless implementation evidence shows a usability problem. Prefer building and testing a bounded slice, documenting what was learned, then refining only the uncertain parts above.
