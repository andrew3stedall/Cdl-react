# League, Season, Team, and Membership Model

## Purpose

Define the core CDL identity model: reusable leagues, seasons within leagues, persistent teams, season-specific team names/managers, memberships, and invitations.

## Status

Checkpoint 1 complete.

## Business Rules

- A league can be reused across seasons.
- A persistent team belongs to a league and can change display name between seasons.
- A `season_team` represents one team's participation in one league season.
- A user can belong to multiple leagues.
- A user should not manage more than one team in the same league season.
- Default league season size is 8 active managers/season teams.
- Initial onboarding supports invite links/codes.

## Target Architecture

Core tables:

```text
users
leagues
league_memberships
league_invitations
teams
league_seasons
season_teams
league_season_status_history
```

Recommended `league_season.status` flow:

```text
setup -> inviting -> ready_for_draft -> draft_live -> draft_complete -> active -> regular_season_complete -> knockout_active -> complete -> archived
```

## API Requirements

- Create league.
- Create league season.
- Invite users by link/code.
- Join league season.
- Create/claim season team.
- List league history by season.
- List persistent team history across seasons.

## React Requirements

- League creation flow.
- Invite acceptance flow.
- League/season switcher.
- Team history view.
- Commissioner season setup view.

## Data Access Requirements

- Enforce unique manager per league season.
- Preserve historical team identity across renamed seasons.
- Track status transitions in `league_season_status_history`.

## Acceptance Criteria

- A league can create multiple seasons.
- A team can appear in multiple seasons with different names.
- Eight-manager season setup is supported by default.
- Former/inactive managers do not break league history.
