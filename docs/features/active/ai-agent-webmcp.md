# AI agent integration — WebMCP and remote MCP

> Planning update: [resolved Wayfinder contract](https://github.com/andrew3stedall/Cdl-react/issues/724) supersedes conflicting unresolved-decision wording below. This is policy, not evidence of implementation or release acceptance.

Status: Approved design; implementation in progress (2026-10-11).
Production deployment is NOT approved.

## Product contract
- Expose every **implemented** user-facing operation via task-oriented, typed tools; do not expose incomplete features.
- Provide WebMCP browser integration and remote MCP transport backed by a shared registry and existing FastAPI business services.
- Support compatible external AI clients, including ChatGPT and Claude where their respective account/client capabilities allow. CDL does not pay for AI inference.
- OAuth authorisation server: reuse CDL user identity, issue audience-bound scoped credentials (read/write), use PKCE, discovery, secure refresh rotation, revocation, per-client connections. Never expose application session cookies or Google ID tokens as MCP bearer credentials.
- Scope each invocation to the authenticated user and current league membership/role; server-side checks are mandatory. Commissioner actions require elevated checks and normal league approvals.
- Read operations and reversible personal writes (preferences/watchlists) require valid OAuth only. All other writes require a manually activated **60-minute** execution grant, plus an exact-action user approval when consequential. Renewal is manual. The execution grant is not proof of a live AI conversation.
- Use verifiable client approval where supported; otherwise CDL-hosted approval for a specific action. Expire proposals, bind to state version and parameters, prevent replay, and preserve existing trade/loan/vice-commissioner approval rules.
- Validate each step of a multi-step request; stop on failure. Allow in-flight atomic operation to finish if activation expires, but no new consequential step may start. Idempotency and deadline checks are mandatory.
- Structured, paginated outputs and structured errors. Do not blindly retry mutations.
- Audit reads/writes with actor, connection, tool, time and outcome; redact sensitive values; detailed retention 90 days, longer for consequential business history.
- Profile UI: connected clients, permissions, audit history, revoke, activation and manual MCP URL.
- Feature-flag staging rollout, test ChatGPT/Claude compatibility; production requires separate user approval.

## Architecture
Remote MCP HTTP endpoint -> shared tool registry -> authorisation/execution gateway -> existing application services.
Browser WebMCP adapter -> same registry semantics and existing authenticated application services.
The registry owns tool names, JSON schemas, risk classifications, permission requirements, response contracts and versioning.

## Delivery workstreams
1. Inventory API and user-facing actions; document tool registry, risk matrix and ADR.
2. Implement OAuth authorisation/discovery/PKCE/token lifecycle and connection persistence.
3. Implement remote MCP transport and browser WebMCP adapter using shared registry.
4. Implement 60-minute execution grants, exact-action approvals, idempotency, audit, league role enforcement.
5. Build Profile AI Connections and approval interface.
6. Add unit, integration, security and real-client compatibility tests; feature-flag staging deployment and verification.

## Connection onboarding

Profile → AI connections provides a resumable, mobile-first manual setup guide for ChatGPT and Claude. It displays the staging remote MCP URL, explains the OAuth consent step, and recommends starting with read access. The guide does not claim automatic installation where a provider does not offer it. It lets users choose read-only (the default) or read/write guidance, saves only this choice and the current step in session storage, and explains the matching CDL OAuth consent action.

ChatGPT setup is documented for ChatGPT web only. The guide explains the current account boundaries: Pro can connect with read/fetch access; full MCP is currently available to Business, Enterprise, and Edu; Plus is not currently listed as supporting custom MCP apps. Claude setup uses its current Custom → Web connector flow and links to Claude's connector guide. Both flows advise users to continue from a desktop browser when they start on mobile. Setup progress is stored only in the browser session and contains no credentials.

## Connection verification and repair (#605)

`GET /api/ai/connections` returns the owner's diagnostics with `Cache-Control: no-store`, and the client bypasses the shared query cache. It returns the deployment-configured canonical MCP URL (`{CDL_OAUTH_ISSUER_URL}/mcp`), the OAuth/remote/browser/execution flags, whether the user has an assigned team (`null` when the lookup fails), and one status per OAuth connection ID. Revoked connections stay visible for 14 days so the owner can reconnect. Connections are never merged by display name.

| State | Evidence |
| --- | --- |
| `authorized` | OAuth consent completed. No correlated remote read has been observed yet ("Pending check"). |
| `verified` | The audit log has a successful `read`-risk tool call recorded against this exact OAuth connection ID. |
| `check_failed` | The latest read-risk call for this connection failed after the last success. Only a sanitized category is exposed: `permission`, `request`, `service` or `other`. |
| `expired` | The connection has no unused, unrevoked refresh token that is still valid. |
| `revoked` | The owner revoked the connection, or a refresh-token replay revoked it. |

Consent, completing the wizard, a browser-side API read and browser WebMCP calls never mark a remote provider as verified. Browser WebMCP is shown as "Browser only" with no verification state. Personal-reversible and consequential tool outcomes do not count as verification. Evidence follows the 90-day activity retention, so an old success can fall back to `authorized`.

`POST /api/ai/connections/{id}/check` is a manual, owner-scoped re-check. It returns `404` for another user's connection and records a `connection.check` activity row with risk `diagnostic` and the derived state as its outcome. That row never counts as verification. There is no background polling.

Repair actions in the UI:

- **Check**: manual re-check.
- **Copy test prompt**: shown for pending and failed connections. The prompt is visible and copyable and contains no team data.
- **Reconnect**: shown for failed, expired and revoked connections. It reopens provider setup guidance and never broadens access; write is suggested only if the old connection already had `cdl:write`.
- **Revoke**: unchanged.

Execution-window controls appear only for live connections, and only when execution is enabled. When remote MCP is off, setup shows "Remote MCP unavailable." instead of a URL derived from the page origin. Diagnostics are available whenever `MCP_OAUTH_ENABLED` is on and return `404` otherwise.

Real ChatGPT/Claude account checks of these states are still required (#603/#604/#595). Until they are recorded, each provider remains unverified.

## Release acceptance
- Every implemented user-facing capability has an appropriately permissioned, validated tool, or an explicit documented exception.
- ChatGPT and Claude remote connection flows verified on supported client tiers; WebMCP verified in supported browser agents.
- Cross-manager data isolation, commissioner permissions, expiry, revocation, stale data, replay prevention and multi-step failure handling tested.
- No production deployment until separate approval.
