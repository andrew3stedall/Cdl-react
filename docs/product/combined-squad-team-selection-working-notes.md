# Combined Squad + team-selection working notes

## Status

Active product refinement. These decisions supersede the earlier assumption that Squad is always season-long/read-only for lineup state and Matchweek is always a separate weekly lineup editor. The final navigation/page split is not yet settled.

## Current product direction

Explore a **single combined Squad workspace** that always shows all 20 owned players and lets the manager manage both the season-long roster and the selected team for a chosen gameweek.

The intended benefit is that the manager should not have to mentally switch between two pages to answer either of these closely related questions:

- who do I own?; and
- which of those players am I using this gameweek?

Season-long actions such as compare, trade initiation, staged releases and draw-won additions remain contextual squad actions. Weekly lineup state becomes another editable layer on the same 20-player workspace.

## Settled decisions so far

### All 20 players stay visible

The combined page should show the entire owned squad rather than hiding players that are not selected for the matchday team.

For each gameweek the 20 players are partitioned into:

- **Starting XI:** 11 players;
- **Substitutes:** 5 players;
  - exactly 1 substitute must be a goalkeeper;
  - the other 4 substitutes are outfield players ordered **1–4** by substitution preference;
- **Reserves:** 4 players.

This replaces the current implementation assumption of 11 starters + 4 bench + 5 reserves.

### Future-gameweek planning

The manager must be able to select and save a team for future gameweeks so they can prepare selections ahead of time.

- Every gameweek has an independently saved selection state.
- When a future gameweek has not yet been explicitly configured, its initial editable state inherits the most recently saved prior gameweek selection.
- Editing/saving one gameweek must not rewrite another gameweek's deliberate saved choices.
- If a later season-long squad change removes a player referenced by a saved future selection, that future selection is flagged as requiring attention rather than silently replacing the player.

### Save model

Weekly decisions are **staged locally** and committed with one explicit **Save Team** action for the selected gameweek.

The save unit includes all weekly choices together:

- Starting XI;
- goalkeeper substitute;
- ordered outfield substitutes 1–4;
- 4 reserves;
- captain;
- vice-captain;
- chips.

Do not auto-save these choices independently because chip selection and lineup/captaincy are intended to form one deliberate gameweek submission.

## Existing squad-management decisions that still apply

Unless later questions explicitly change them, retain the existing decisions for:

- Pitch and List representations;
- owned-player quick-detail drawer;
- Compare, Release to Free Agency, Draft Trade and Full Profile contextual actions;
- compare up to three players in manual selection order;
- staged draw additions/removals;
- Available to Add / Pending Removal workflow;
- atomic confirmation of season-long squad changes.

## Question sequence status

The grilling session paused at **Question 4 — chip presentation**.

Options not yet answered:

1. Always-visible chip buttons above the team.
2. Collapsible Chips section below the team.
3. Chip selector inside the Save Team confirmation flow.
4. Small Chips button near the gameweek selector that opens a drawer.
5. Show active chip status near the gameweek selector, with a Manage Chips drawer for selection/details.

Current recommendation when the session resumes: **5**.

## Implementation gaps created by these decisions

The current team-selection backend must be revised because it presently models a 20-player gameweek as **11 starters + 4 bench + 5 reserves**. The target is **11 starters + 5 substitutes + 4 reserves**, with one goalkeeper substitute and four ordered outfield substitutes.

Future-gameweek persistence also needs an explicit contract so selections can be saved independently per gameweek, inherited only as the initial state of an unsaved future gameweek, and flagged when later squad changes invalidate them.

The combined page design should not be implemented until the remaining interaction questions have been resolved or a bounded prototype proves the layout direction.