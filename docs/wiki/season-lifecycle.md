# Season Lifecycle

A league can run many seasons. Each season has its own teams, managers, draft, squads, fixtures, scoring, and history.

## Default lifecycle

```text
setup
→ inviting
→ ready_for_draft
→ draft_live
→ draft_complete
→ active
→ regular_season_complete
→ knockout_active
→ complete
→ archived
```

## Key behaviours

- League persists across seasons.
- Teams persist across seasons but can change display name.
- Each season starts with a new draft.
- Rule configuration is versioned per season.
- Historical seasons remain viewable after completion.

## Commissioner responsibilities

- Configure rules.
- Invite managers.
- Start draft.
- Manage approvals and corrections.
- Finalise or review competition issues as needed.
