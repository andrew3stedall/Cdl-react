# AI execution controls

Remote MCP and browser WebMCP calls enter the same registry and execution gateway. The gateway uses the authenticated CDL user, the current league membership repository, and the existing domain service adapters. Transport-provided role or approval claims are never trusted.

## Consequential actions

The user must manually activate a grant for a specific assistant connection in Profile. Grants expire after 60 minutes and can be revoked at any time. A browser session uses its own `browser:<user id>` connection identity. A grant permits proposing an action; it does not approve the action.

The first call for a consequential action creates a proposal bound to the tool, canonical arguments, idempotency key, and domain state version. CDL returns an approval URL that requires the user's authenticated CDL session. The page displays the exact action and uses a same-origin CSRF token. Approvals expire after ten minutes and are consumed once. A later retry with the same key and parameters returns the completed result; a changed payload is an idempotency conflict. If the observed state version changes before execution, the proposal is marked stale and a new approval is required.

The gateway rechecks the user's current league role and active grant at invocation. Domain services still enforce their existing deadlines, ownership, conflict-of-interest, commissioner, validation, and transaction rules. A missing service adapter fails closed. The live-draft room service's legacy read-time timeout auto-pick is disabled for AI read calls; the response remains a snapshot and does not trigger a consequential draft step.

## Activity retention

AI activity records include the actor, connection, tool, risk class, time, outcome, and redacted parameters. Routine activity is retained for 90 days. Existing trade, loan, draft, and other business history remains authoritative for consequential outcomes and follows its established retention policy.

## Rollout

`MCP_EXECUTION_ENABLED` gates grants, approvals, activity, and execution. It defaults off. Remote and browser transport feature flags remain separate. Enable the execution flag in staging only after the complete service adapters and integration checks are present. Production MCP access requires separate approval.
