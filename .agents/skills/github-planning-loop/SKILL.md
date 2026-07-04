---
name: github-planning-loop
description: Use when coordinating CDL React planning through GitHub issues, branches, pull requests, docs, and milestone trackers.
---

# GitHub Planning Loop Skill

## Purpose

Keep GitHub as the delivery record for CDL React planning and implementation.

## Loop

1. Read the relevant repo docs, active feature docs, ADRs, issues, and recent PRs.
2. Identify the owning issue, milestone, or feature document.
3. Create or update issues with clear scope and acceptance criteria.
4. Use scoped branches for implementation work.
5. Open or update PRs with purpose, scope, validation, data impact, operational impact, and follow-up work.
6. Keep docs and changelog aligned.
7. Report current status and next recommended work.

## Guardrails

- Do not commit directly to `main` unless explicitly requested.
- Do not merge non-milestone PRs without an explicit merge request.
- For approved milestone implementation, follow `docs/milestone-delivery-workflow.md`.
