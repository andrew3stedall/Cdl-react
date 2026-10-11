# AI tool registry and capability inventory

Status: Accepted for implementation under issues #590–#595 (2026-10-11).

## Context

Remote MCP and browser WebMCP must describe the same user-facing operations,
permissions, risk, versioned argument and response contracts. Routes are not a safe source of tool
definitions: some are operational, unfinished or expose implementation details,
and route-level session dependencies do not authorize a separate OAuth bearer.

## Decision

`src/cdl_api/ai_tools/registry.py` is the transport-neutral catalogue. Each
immutable definition includes a stable name, task-oriented description, closed
JSON object schema, OAuth scopes, risk, required role, response contract,
version, existing service or repository owner, and whether results are paginated.
Transport adapters must use this registry
and route execution through an authorization gateway into the existing service
layer. They must not call repositories or duplicate league rules.

List tools expose a bounded `limit` (1–100) and opaque `cursor`, with a common
`data` plus `page` response envelope. The transport adapter applies pagination
to service results and must not pass pagination arguments into domain rules.
The caller identity,
league membership and effective role are resolved server-side for each call;
identifiers supplied by the model are selectors, never proof of ownership.

## Risk and authorization matrix

| Risk | Examples | Scope | Additional gate |
| --- | --- | --- | --- |
| Read | Squad, fixtures, rules, FDR, player detail | `cdl:read` | Authenticated identity; league membership where data is private |
| Personal reversible | Preferences and private watchlist | `cdl:write` | OAuth only; owner is always the authenticated user |
| Consequential | Lineup, trade, loan, approval | `cdl:read` + `cdl:write` | Manual 60-minute execution grant; exact-action approval where required; existing deadline, role and approval rules |

Commissioner and eligible-approver tools additionally require the corresponding
current league role and normal application workflow. OAuth scope does not grant
league authority. The gateway introduced by issues #591–#593 enforces these
conditions; registry metadata alone is not an authorization decision.

## Capability inventory

The first catalogue covers squad, team-selection and manager-desk reads; league
table and fixtures; player search/detail; rules search; fixture difficulty;
dashboard metrics; personal preferences and private scouting; lineup/chip/squad
changes; trade and loan proposals, participant decisions and approvals; player
interest; free-agency manager and commissioner actions; league invite
management; and live-draft reads, manager queue/picks and commissioner controls.
Each definition names the response contract/version and its existing service
owner. Private scouting and league invitation routes currently call persistence
repositories directly; those targets are explicitly marked and must retain the
route's owner/commissioner checks until refactored behind services.

| Tool area | Existing API/UI operation | Tool registry coverage |
| --- | --- | --- |
| Manager workspace | `/squad/summary`, `/squad/workspace`, `/desk`, `/squad/notifications` | Squad, workspace, desk, notifications reads |
| Team selection | `/team-selection`, `/team-selection/lineup`, `/team-selection/chips/{chip_id}`, `/team-selection/fixtures-summary` | Selection and fixture reads; lineup and chip writes |
| Player market | `/scouting/players`, player detail, `/interests`, `/squad/changes` | Search/detail, player interest, squad changes |
| Trades and loans | `/trades`, trade approvals/update/audit; `/loans`, loan approvals/decision/events | List, propose/respond, approval, loan and audit tools |
| League | table, fixtures/current/next/detail, knockout, head-to-head, management/invites | League read, invite management and competition tools |
| Free agency and draft | `/free-agency/draws*`, `/live-draft*` | Draw read/preferences/admin lifecycle and draft read/queue/pick/control |
| Personal profile | `/me/preferences*`, `/me/watchlist`, `/me/scouting/{player_id}` | Preferences, private scouting and palette tools |
| Reference and analysis | `/rules*`, `/fdr*`, `/fpl/status`, player history, dashboard metrics/widgets | Rules, FDR, FPL status/history and dashboard query tools |

All consequential definitions require an idempotency key in their input
contract; the gateway strips this transport-level key before invoking existing
business services. Pagination is transport metadata, not a domain argument.

Authentication/session management and passkey management are excluded because
MCP OAuth uses separate credentials. FPL refresh, historical imports, migration,
admin corrections, data ingestion/finalization, and `modernisation*` checkpoint
routes are excluded because they are operational/admin endpoints or not verified
as supported user-facing capabilities. Public static contract endpoints are not
AI tools. Invite preview and acceptance remain on the authenticated CDL join
page because they create/attach account membership and must follow the existing
login/linking flow. FDR calculation-input audit routes remain operator-only.
The API inventory and these explicit exceptions are part of the #590 contract;
new routes do not appear automatically.

## Consequences

- Remote MCP and WebMCP can advertise identical schemas and policy metadata.
- Every added tool must name an existing service/repository boundary and include
  versioned input and response contracts, scope, risk and role in tests.
- As future features ship, developers add an explicit tool registration with
  the feature's acceptance tests; routes do not become tools automatically.
- This catalogue does not make the listed operations callable by itself. Issues
  #591–#595 implement identity, dispatch, execution controls, UI and validation.
