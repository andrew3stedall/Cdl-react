# UI refinement continuation

## Purpose

This is the parking lot for product decisions that are intentionally not resolved yet. Use it to resume structured refinement without repeating decisions already captured in `docs/product/feature-placement-and-navigation.md` and `docs/product/pages/`.

## Decisions already made

- Primary navigation: Home, Squad, Market, Matchweek, League.
- Home is urgency-led and adaptive.
- Squad is season-long squad health and staged squad changes.
- Market owns discovery, draws, watchlist, Interests and trade activity.
- Matchweek owns weekly lineup editing.
- League owns competition context.
- Quick context uses drawers/bottom sheets; complex consequential work uses dedicated flows.
- Compare supports up to three manually selected players in selection order.
- Watchlist and Interests are separate.
- Draw Interests are one ranked list per draw with drag, direct-number and move-control ordering.
- Draw wins create temporary rights; actual squad activation/removal belongs in Squad.

## Questions to resume later

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

### Matchweek

- Preferred pitch editing mechanics on mobile.
- Bench-order editing fallback controls.
- Chip confirmation and warning behaviour.
- Lock-state messaging around individual fixtures versus whole-gameweek actions.

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
- Current primary navigation predates the Home/Squad/Market/Matchweek/League product decision and should be migrated deliberately.

## Recommended implementation sequence after the Squad slice

1. **Market** — it owns the features currently leaking into Squad and unlocks draws, Interests, discovery and trade activity in the correct place.
2. **Matchweek** — clarify weekly lineup editing after Squad becomes read-only for lineup state.
3. **Home** — build urgency aggregation after the owning feature workflows can provide actionable states.
4. **League** — refine the competition experience after the manager action flows are stable.

## Rule for future refinement

Do not reopen settled questions unless implementation evidence shows a usability problem. Prefer building and testing a bounded slice, documenting what was learned, then refining only the uncertain parts above.
