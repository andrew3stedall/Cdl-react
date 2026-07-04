---
name: deferred-testing
description: Use when a CDL React task cannot run all local validation commands in the current environment.
---

# Deferred Testing Skill

## Purpose

Make validation gaps explicit when local execution is not available.

## Required output

For every deferred check, record:

- Command not run.
- Reason it was not run.
- Expected environment needed.
- Risk of deferral.
- Follow-up validation step.

## Rules

- Do not state or imply that tests passed when they were not run.
- Prefer static review and repo evidence when local checks are unavailable.
- Keep deferred validation visible in PR bodies and final summaries.
