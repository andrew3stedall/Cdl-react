---
name: worker
description: Use when implementing one scoped CDL React issue inside an approved branch or milestone.
---

# Worker Skill

## Purpose

Implement one scoped issue without drifting into unrelated work.

## Workflow

1. Read the issue, feature doc, ADRs, and relevant code.
2. Identify files likely to change.
3. Make the smallest safe implementation.
4. Add or update tests where practical.
5. Update docs and changelog when the change is meaningful.
6. Report validation performed and validation deferred.

## Guardrails

- Do not change shared contracts without updating affected docs and tests.
- Do not modify migrations or production settings unless the issue explicitly requires it.
- Do not claim checks passed unless they were actually run.
