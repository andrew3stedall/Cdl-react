# Milestone Delivery Workflow

## Purpose

Define the standard workflow for approved CDL React milestone or epic implementation.

This workflow applies when the user asks to implement a milestone or approved epic. It does not apply to exploratory audits, planning-only tasks, or small non-milestone changes unless the user explicitly asks for the full milestone loop.

## Inputs

Before implementation, identify:

- Milestone issue or approved epic.
- Child issue list.
- Dependency order.
- Active feature documents.
- Relevant ADRs.
- Relevant code paths.
- Known validation commands.
- Known product, data, or platform blockers.

## Delivery loop

1. Read the milestone issue, child issues, active feature documents, ADRs, and relevant code.
2. Confirm the ordered issue list from repo evidence.
3. Create or reuse a milestone branch.
4. Implement issues in dependency order.
5. Keep unrelated changes out.
6. Add or update tests where practical.
7. Update active docs, wiki docs, release docs, and changelog as required.
8. Open or update the milestone PR.
9. Include purpose, scope, files changed, validation, deferred validation, docs updated, data impact, operational impact, issue checklist, merge readiness, and follow-up work in the PR body.
10. Check PR mergeability and available CI/status information.
11. Squash merge only when GitHub reports the PR is mergeable, required checks are acceptable, scope is contained, and no unresolved decisions remain.
12. Update or close relevant issues and milestone trackers where appropriate.
13. Report merge result, validation status, known gaps, and the next recommended milestone or issue.

## Merge blockers

Do not merge when:

- GitHub reports the PR is not mergeable.
- Required checks are failing.
- Required status information is unavailable and needs user review.
- The change exceeds the approved milestone scope.
- Product, data, or platform decisions are unresolved.
- The change requires unapproved database, migration, auth, GCP, billing, IAM, deployment, or environment changes.

## Validation baseline

Backend:

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
npm run typecheck
```

If a command is not run, record it under deferred validation with the reason and follow-up.

## PR body template

```markdown
## Purpose

## Scope

## Files changed

## Covered issues

- [ ] #issue-number

## Validation performed

## Validation deferred

## Documentation updated

## Data impact

## Operational impact

## Merge readiness

## Follow-up work

## Next recommended work
```
