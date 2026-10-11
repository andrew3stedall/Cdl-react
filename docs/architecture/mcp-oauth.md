# MCP OAuth authorization server

Status: Implemented for issue #591; disabled by default pending the staged MCP release.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata for the authorization server |
| `/oauth/register` | Register a public assistant client and its exact callback URLs |
| `/oauth/authorize` | Authenticated CDL consent page with per-scope selection |
| `/oauth/authorize/decision` | CSRF-protected consent decision and one-time code issuance |
| `/oauth/token` | Authorization-code exchange with PKCE or rotated refresh-token exchange |
| `/oauth/revoke` | RFC 7009 token revocation endpoint |
| `/oauth/connections` | List the signed-in user's active assistant connections |
| `/oauth/connections/{id}` | Revoke one connection and its refresh-token family |

Only public clients with `authorization_code` and `refresh_token` grants are
accepted. Authorization code flow requires a registered exact redirect URI,
transaction-specific `state`, and PKCE `S256`. HTTPS callbacks are required;
plain HTTP is limited to loopback callbacks for local clients. No client secret,
CDL cookie, or upstream identity token is returned to an assistant.

Consent grants only the selected subset of `cdl:read` and `cdl:write`. Access
tokens are signed, 15-minute JWT bearer tokens with issuer, `cdl-mcp` audience,
user, client, connection, scope, issue time, expiry, and token ID claims. Resource
servers must validate the signature, issuer, audience, expiry, active connection,
and granted scope on every request. Refresh tokens are opaque random values;
only SHA-256 hashes are stored. Each successful refresh rotates the token. Reuse
of a spent refresh token revokes the connection and all refresh tokens in its
family. Token revocation also revokes the connection, which invalidates already
issued access tokens at the next request.

## Configuration and persistence

`CDL_MCP_OAUTH_ENABLED` controls the endpoints and defaults to `false`.
`CDL_OAUTH_ISSUER_URL` is the public HTTPS origin. When enabling the feature in a
protected environment, configure `CDL_OAUTH_SIGNING_SECRET` with at least 32
random bytes through the existing secret manager. No production value or secret
is committed. Staging and production environments must pass protected-settings
validation before OAuth can be enabled.

PostgreSQL stores public client redirect URIs, hashed one-time authorization
codes, scoped user connections, and hashed refresh-token history. The in-memory
implementation is only for development and isolated tests. Migration
`0036_mcp_oauth` adds the persistent tables without modifying existing user or
league data.

The implementation follows OAuth authorization-server metadata (RFC 8414),
authorization code with PKCE S256 (RFC 7636), refresh-token rotation and audience
restriction (RFC 9700), and token revocation (RFC 7009). Remote MCP discovery and
resource-server permission enforcement are completed by issues #592 and #593.
