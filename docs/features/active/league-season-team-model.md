# League, Season, Team, and Membership Model

## Purpose

Define the core CDL identity model: reusable leagues, seasons within leagues, persistent teams, season-specific team names/managers, memberships, and invitations.

## Status

Team-specific invitations, pending-invite listing/revocation and membership/team isolation are implemented. Self-service league/season creation, switching and history remain planned (#522). They are deferred pending an accepted dynamic active-context and `season_teams` design because application repositories still resolve the single CDL 2026/27 context through constants. See the proposal in [the dynamic league and season context ADR](../../architecture/league-season-context-prerequisite-adr.md); it is not an accepted product policy. Engineering checkpoint completion does not prove those production workflows.

## Business Rules

- A league can be reused across seasons.
- A persistent team belongs to a league and can change display name between seasons.
- A `season_team` represents one team's participation in one league season.
- A user can belong to multiple leagues.
- A user should not manage more than one team in the same league season.
- Default league season size is 8 active managers/season teams.
- Initial onboarding supports invite links/codes.
- Commissioners can list active pending team invites and revoke one. Reissuing an invite continues to revoke its earlier link. Invite expiry remains optional until a league policy sets a duration; no new expiry duration is implied by this lifecycle.
- A user without a team assignment cannot access manager-scoped PostgreSQL API data. Invite acceptance remains available as the onboarding path.

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
- Commissioner League management lists pending invitations and supports revocation through the authenticated management API.
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
