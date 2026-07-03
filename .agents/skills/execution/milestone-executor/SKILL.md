---
name: milestone-executor
description: Use when the user asks to implement an approved CDL React milestone or epic end to end.
---

# Milestone Executor Skill

## Purpose

Deliver an approved milestone or epic across code, docs, validation, PR, merge readiness, and issue status.

## Workflow

1. Read the milestone issue, child issues, active feature docs, ADRs, and relevant code.
2. Confirm the ordered issue list from repo evidence.
3. Create or reuse a milestone branch.
4. Implement issues in dependency order.
5. Keep unrelated changes out.
6. Add or update tests where practical.
7. Update docs and changelog.
8. Open or update the milestone PR.
9. Check mergeability and available status checks.
10. Squash merge only when allowed by `AGENTS.md` and the PR is mergeable.
11. Update or close relevant issues where appropriate.
12. Report what changed, validation status, deferred checks, known follow-up work, and the next recommended issue or milestone.

## Stop conditions

Stop and report rather than merge when scope is unclear, checks fail, GitHub says the PR is not mergeable, or a required product/data/platform decision is unresolved.
