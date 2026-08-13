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

League is a single contextual page. Its page header contains the Castle Draft
League logo, a Fixtures/Table toggle, and notifications. Competition views do
not add a second navigation strip above the page.

## Current interaction model

The default view is the current competition context rather than an overview
landing page. Fixtures are grouped into compact gameweek sections: the current
gameweek first, followed by upcoming gameweeks. Each fixture is a single row.

- **Fixtures** shows whether each gameweek is not started, underway, or
  finished. Selecting a row opens a drawer whose content is a squad preview for
  an upcoming fixture, live scoring context for an active fixture, or final
  scoring context for a completed fixture.
- **Table** presents the current standings and identifies whether the response
  is a calculated result snapshot or a persisted snapshot. Movement is shown
  only when the API supplies a previous-table comparison.
- Knockout and head-to-head data remain API/domain capabilities, but are not
  exposed as competing top-level options in the manager-facing League page.

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
