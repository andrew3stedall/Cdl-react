# League product specification

## Product job

League is the competition workspace. It answers:

> What is happening in the league, and what does it mean for my position and upcoming competition?

## Owns

- league overview;
- fixtures;
- table and movement;
- knockout competition;
- head-to-head information;
- competition results and history.

## Relationship with Home

League events can create urgency on Home when they require a manager decision or materially change what should be reviewed. Home should link into the relevant League context rather than duplicate the full competition experience.

## Navigation

League may retain contextual sub-navigation for:

- Overview;
- Fixtures;
- Table;
- Knockout;
- Head-to-head.

## Current interaction model

The overview is the decision-first entry point. It surfaces the current round,
next round, leading team, recorded results, and the two secondary competition
paths before sending the manager into a detailed view.

- **Fixtures & results** groups current and upcoming fixtures, then provides an
  all-fixtures browser with lightweight status filters.
- Started fixtures can open a scoring-detail drawer; pending fixtures remain
  visibly pending rather than presenting guessed detail.
- **Table** presents the current standings and identifies whether the response
  is a calculated result snapshot or a persisted snapshot. Movement is shown
  only when the API supplies a previous-table comparison.
- **Knockout** uses round columns and tie cards rather than reproducing the
  legacy table layout.
- **Head-to-head** keeps matchup records in compact comparison cards.

The League UI does not expose migration operations. Legacy data is brought into
the competition views only through the migration rules: clean records map into
the new model, ambiguous records remain archive-only, and unavailable history
is never silently invented.

## Usability acceptance criteria

- Competition state is easy to scan without mixing in squad-management controls.
- The manager can move between fixtures, table and head-to-head without returning to global navigation.
- League pages use the same player/team terminology as Squad, Market and Matchweek.
- League pages use the shared Teal surface, card, status, drawer, and responsive
  interaction patterns from the authenticated application shell.
