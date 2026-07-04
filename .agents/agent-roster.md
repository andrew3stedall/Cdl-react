# CDL React Agent Roster

Use these roles as planning and review perspectives. A single task may use several roles, but each implementation branch still needs a clear owner and scope.

## Planning council roles

| Role | Responsibility |
| --- | --- |
| Executive Sponsor | Confirms alignment with the CDL React product goal and prevents scope drift. |
| Product | Defines user value, MVP relevance, priority, and deferral boundaries. |
| Requirements / Business Analyst | Turns intent into epics, milestones, issue scope, acceptance criteria, dependencies, and risks. |
| UX | Defines user flows, mobile-first behaviour, state handling, and Manager's Desk-style interaction patterns where relevant. |
| Metrics | Defines scoring, analytics, dashboard, FDR, prediction, and measurement requirements where relevant. |
| Data | Defines PostgreSQL, migration, import, cache, repository, quality, and lineage impacts. |
| Platform | Defines CI, GCP, Cloud SQL, Cloud Run, environment, deployment, and operational constraints. |
| Developer Feasibility | Reviews implementation practicality, sequencing, dependencies, and risk. |
| Full-Stack Developer | Designs and implements scoped backend/frontend changes after planning is approved. |
| Docs Writer | Keeps active feature docs, wiki pages, ADRs, release notes, and changelog aligned. |
| Integration | Checks cross-feature API/session/theme/model compatibility. |
| Reviewer | Reviews scope, quality, validation evidence, merge readiness, and follow-up work. |

## Existing feature workflow map

The active coordination docs already define these workflows:

| Workflow | GitHub issue | Scope |
| --- | ---: | --- |
| Authentication | #2 | Login, session, logout, protected routes. |
| Application Shell | #3 | App shell, navigation, visual presets. |
| Backend Platform | #4 | Python API, Pydantic, repositories, shared contracts. |
| Squad Management | #5 | Squad, scouting, interests, trades. |
| Team Selection | #6 | Team lineup, chips, bench, reserves. |
| League Fixtures | #7 | Fixtures, tables, knockouts, head-to-head. |
| Rules | #8 | Structured rules, search, rule references. |
| Dashboard | #9 | Analytics widgets, filters, drill-downs. |
| FDR | #10 | Fixture difficulty ratings, scales, tables. |
| Migration Index | #11 | Legacy coverage tracking and missing-feature discovery. |

## Current production-readiness issue map

| Issue | Role in delivery |
| ---: | --- |
| #75 | Production database and GCP implementation coordinator. |
| #77 | Production persistence migration milestone. |
| #78 | GCP staging and production readiness milestone. |
| #65-#69 | Remaining production persistence and historical data import work. |
| #70-#71 | GCP staging and production go-live readiness work. |

## Usage rules

- Do not invent a new workflow when an active feature document already owns the area.
- Shared contracts must be coordinated through the backend/platform owner and updated in affected feature docs.
- Execution roles must work from approved issues or milestone docs, not memory.
- Review must block merge if scope, validation, documentation, or mergeability is not clear.
