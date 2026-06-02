# Product Overview

Castle Draft League is a draft-style fantasy football league application built around private leagues, live drafts, squad management, head-to-head fixtures, chips, live scoring, and knockout finals.

## Product goals

- Support reusable leagues across seasons.
- Let any account holder create a league and invite managers.
- Run live drafts in app.
- Support free agency draws, transfers, loans, and commissioner approvals.
- Provide weekly team selection with deadline locking.
- Calculate CDL fixtures from locked lineups and FPL data.
- Show live scoring, fixture details, table movement, and knockout brackets.
- Preserve historical results and audit trails.

## Design direction

The rebuild should not be a like-for-like recreation of the legacy PHP application. It should use the legacy app as a behavioural reference while building clearer domain services, database models, APIs, and React workflows.

## Core workflows

```text
create league
→ invite managers
→ configure season
→ run draft
→ manage squads
→ select weekly lineups
→ score fixtures
→ update tables
→ run knockouts
→ preserve history
```
