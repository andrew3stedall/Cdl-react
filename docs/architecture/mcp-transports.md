# MCP transport adapters

Status: Implemented under issue #592; disabled by default pending execution gateway and staging validation.

## Remote MCP

The Streamable HTTP endpoint is `/mcp`. It accepts JSON-RPC over `POST`,
validates the CDL OAuth bearer token and filters `tools/list` by the token's
granted scopes. It supports `initialize`, `notifications/initialized`, `ping`, `tools/list`, and
`tools/call`, with JSON responses, deterministic tool ordering, registry input
and output schemas, risk annotations, structured tool results and bounded
pagination. It accepts protocol revisions `2025-03-26`, `2025-06-18`, and
`2025-11-25`. The server issues a 24-hour MCP session ID at initialization,
requires `notifications/initialized` before tool methods, and checks the
negotiated version and OAuth connection on each subsequent request. Session
state is persisted in PostgreSQL for protected deployments.

The endpoint requires `Accept` to include both `application/json` and
`text/event-stream`, JSON request bodies and an `Authorization: Bearer`
credential. Unauthorized responses advertise OAuth protected-resource metadata
at `/.well-known/oauth-protected-resource` (including path-qualified discovery).
Present `Origin` headers must match the request origin to prevent DNS rebinding.
MCP itself is feature-flagged with `CDL_MCP_REMOTE_ENABLED`; it also requires
`CDL_MCP_OAUTH_ENABLED` and a configured OAuth signing secret.

This first transport increment intentionally supports the tools capability only.
It does not implement server-initiated SSE, resources, prompts, or experimental
task lifecycle methods. Tool execution uses a fail-closed executor seam until
issue #593 installs grant, approval, permission and audit enforcement. Therefore
the transport flag must remain off until that gateway is merged.

## Browser WebMCP

The React app registers the same registry catalogue on authenticated pages when
the browser exposes `document.modelContext.registerTool`. The implementation
fetches `/webmcp/tools` using the existing same-origin session and calls
`/webmcp/tools/{name}` with same-origin credentials. It does not place OAuth
bearer credentials into browser page context. Tool registration is removed with
an `AbortSignal` when the session or page lifecycle ends.

Browser tool discovery and invocation are controlled by
`CDL_MCP_BROWSER_ENABLED`. Browsers without WebMCP remain unaffected. WebMCP is
an evolving browser API and its availability varies by browser and rollout
channel; issue #595 must record the exact browser/version used in staging
verification.

## Pagination and errors

The transport removes `limit` and `cursor` before invoking the executor. For
list-valued results, cursors encode the offset and are authenticated with HMAC,
bound to the current user and tool, and rejected when replayed against another
user or tool. Tool validation failures and execution failures use MCP's
`isError` result form; JSON-RPC protocol errors use stable error codes. Mutations
are not retried by the transport.
