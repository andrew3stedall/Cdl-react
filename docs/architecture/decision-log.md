# CDL Domain Decision Log

Status: accepted discovery decisions as of 2026-06-02.

## Core domain language

- Use **squad**, not roster.
- Use **transfers**, not transactions.
- Use **free transfers** for free-agent moves.
- A league persists across seasons.
- A persistent team can change name between seasons.
- A `season_team` represents one team in one league season.

## League and season model

- Anyone with an account can create a league.
- Initial league seasons default to 8 managers.
- Managers join by season-specific invite link or code.
- League configuration is edited through UI forms and stored as versioned database config.
- Rule versions are retained for audit and historical scoring.

## Squad movement

- Draft picks create active squad assignments immediately.
- Free agency draw wins create temporary rights for that gameweek only.
- If a draw-won player is not activated before the FPL deadline, the right expires and the player returns to free agency.
- Draw-won players auto-add only when squad space exists.
- If squad is full, the manager must remove a player before deadline.
- Loaned-out players count against the lender squad cap.
- Loan players automatically return to the original squad when the loan completes.
- Loans can be extended or converted to permanent transfers.
- A player cannot be traded out and return to the same squad within the configurable cooling-off period, default 4 gameweeks.

## Transfers and approvals

- Trade/loan negotiations happen in app with offers and counters.
- Both parties must agree before commissioner approval.
- Commissioner-involved transfers require vice commissioner approval.
- Commissioner cannot approve their own transfer.
- Corrections require a reason and are audited.

## Draft

- Draft is live and sequential.
- Draft order supports random repeated, snake, and manual modes.
- Commissioner can enable/disable pick clock.
- Pick time limit is configurable.
- Pick duration is tracked.
- Timeout autopick defaults to highest FPL cost available unless configured otherwise.
- Managers can maintain preselection queues.
- Preselection ordering mode is configurable.
- Commissioner can pick on behalf of a manager, but it must be public and audited.

## Free agency draws

- Free agency draws run in configured gameweeks.
- Managers submit private preferences.
- Draw order is generated automatically.
- Processing is deterministic: each team receives the first available preferred player in draw order.
- Failed preferences are private to the manager.

## Lineups and scoring

- Active squad, matchday lineup, and scoring lineup are separate concepts.
- Lineups roll forward automatically.
- FPL deadline locks the gameweek lineup.
- After deadline, team selection defaults to the next editable gameweek.
- Players removed from squad are auto-removed from future unlocked lineups.
- Auto-adjusted lineups submit as-is if the manager takes no action.
- Captain and vice captain must be starters, not bench players.
- Reserves never score.
- Normal substitutions trigger only for starters with 0 minutes.
- Substitutions follow bench order and must preserve valid formation.
- Negative-score starters remain if they played.

## Chips

- One chip per team per gameweek.
- Chips lock at the FPL deadline with the lineup.
- Triple Captain: captain scores 3x instead of 2x.
- Dual Captain: captain and vice captain both score 2x.
- Auto Captain: highest scorer from the scoring lineup gets captain multiplier.
- Bench Boost: bench players score; reserves excluded.
- Best XI: uses best 11 from starters plus bench, ignoring position constraints; reserves excluded.
- Chip impact must store points delta, wasted status, fixture-outcome impact, and league-points impact.

## Fixtures, tables, and knockouts

- Fixture schedule, score snapshots, final results, and league table snapshots are separate.
- Live/provisional scores are recalculated from snapshots.
- Final results freeze the selected scoring snapshot.
- Commissioner override appends corrections rather than overwriting silently.
- League table uses 3 points for win, 1 point for draw, plus automatic bonus points.
- Live, provisional, and official tables are shown through a toggle.
- Knockout view should be flowchart/bracket style.
- Knockout tiebreaker is most goals by scoring lineup players only.

## FPL data

- FPL is the only external provider for this build.
- Initial endpoints: `bootstrap-static`, `fixtures`, `event/{gameweek}/live`, `element-summary/{player}`.
- FPL entry endpoints are not used for normal CDL gameplay.
- Cache raw payloads and normalized FPL tables.
- TTL means the time cached data is considered fresh.
- Live scoring fetches event-live data on demand per gameweek.
- Final CDL result snapshots are frozen and do not depend on future FPL refetches.

## Notifications and audit

- Notifications, activity feeds, and audit records are separate concepts.
- Activity scopes include league public, team private, negotiation private, commissioner private, and system admin.
- In-app notifications come first; email is optional for critical events.
- Actionable notifications have one primary action URL.
- Watchlists notify on availability/status changes, not every points change.

## Documentation and implementation

- Legacy app is reference behaviour, not target architecture.
- Build by dependency order, not page order.
- Milestones are implementation checkpoints, not production release commitments.
- Use feature docs for implementation work, architecture docs for domain design, and wiki docs for general repo knowledge.
