# AI agent integration — WebMCP and remote MCP

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

Profile → AI connections provides a resumable, mobile-first manual setup guide for ChatGPT and Claude. It displays the staging remote MCP URL, explains the OAuth consent step, and recommends starting with read access. The guide does not claim automatic installation where a provider does not offer it.

ChatGPT setup is documented for ChatGPT web only. The guide explains the current account boundaries: Pro can connect with read/fetch access; full MCP is currently available to Business, Enterprise, and Edu; Plus is not currently listed as supporting custom MCP apps. Claude setup uses its current Custom → Web connector flow and links to Claude's connector guide. Both flows advise users to continue from a desktop browser when they start on mobile. Setup progress is stored only in the browser session and contains no credentials.

## Release acceptance
- Every implemented user-facing capability has an appropriately permissioned, validated tool, or an explicit documented exception.
- ChatGPT and Claude remote connection flows verified on supported client tiers; WebMCP verified in supported browser agents.
- Cross-manager data isolation, commissioner permissions, expiry, revocation, stale data, replay prevention and multi-step failure handling tested.
- No production deployment until separate approval.
