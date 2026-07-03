# CDL React Skills Index

This folder contains repo-scoped planning and execution instructions for CDL React.

`AGENTS.md` is the top-level source of operating rules. CDL React-specific instructions override any generic skill guidance.

## Core skills

- `planning-council`
- `issue-writer`
- `docs-writer`
- `github-planning-loop`

## Execution skills

- `execution/milestone-executor`
- `execution/epic-workforce`
- `execution/worker`
- `execution/milestone-branch-manager`
- `execution/deferred-testing`

## Agent roster

See `.agents/agents.md` for role responsibilities and the existing feature-agent map.

## Current mode

Milestone execution is allowed when a milestone or epic is approved. When the user asks to implement a milestone, treat that as approval to complete the milestone delivery workflow: implement the milestone, raise or update the milestone PR, check mergeability/status, squash merge when mergeable, update or close relevant issues, and report what is next.

Local testing may be deferred until Codex is available on the user's laptop. Do not claim tests passed unless they were actually run.

For non-milestone work, raise a PR and wait for an explicit merge instruction unless the user clearly asked for the change to be merged.
