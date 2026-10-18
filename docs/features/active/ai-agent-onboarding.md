# AI assistant onboarding — approved scope

Status: Approved for GitHub planning and documentation (2026-10-11). Implementation and staging validation pending. Production deployment not approved.

## Product objective
Make connecting a personal ChatGPT or Claude account to CDL mobile-first and as automatic as each provider officially supports. When automatic installation/configuration is unavailable, present interactive provider-specific guidance. Do not host AI inference or bypass provider account restrictions.

## Decisions
- Entry: Profile → AI Connections; no permanent main-navigation AI button.
- Prioritise official automatic setup/deep links, followed by interactive guidance and manual MCP URL copy.
- Mobile-first; retain progress and provide desktop handoff where provider setup requires it.
- Explain unsupported plans and paths and provide supported alternatives. Do not infer provider capabilities from a user's stated plan alone.
- Connection verification: OAuth status + safe authenticated team read; provider installation/enabled verification only where technically supported. Distinguish authorised from end-to-end verified.
- Discover connections authorised outside CDL using the OAuth registry.
- Support multiple connections, including multiple accounts with the same provider, independently scoped and audited.
- Let users select read-only or read/write scopes during setup; default read-only. Consequential actions still require the 60-minute execution grant and exact-action approval per the approved MCP architecture.
- Personalised team-aware starter prompts; deep-link/prefill where officially supported, otherwise copy prompt.
- Detect connection expiry/revocation/breakage via existing state and user-triggered checks, not unnecessary background polling; guide repair.
- Hardcode provider instructions and compatibility information in the application; update through normal releases rather than remote configuration.
- Validate real ChatGPT and Claude accounts, supported tiers, mobile/desktop, automatic/manual paths, permissions and repair. Document unsupported scenarios.
- Feature-flag staging rollout; production requires separate approval.

## Issues
- #602 — Mobile-first AI Connections onboarding wizard (depends on #591, #592, #594).
- #603 — ChatGPT provider connection and compatibility (depends on #602 and core MCP).
- #604 — Claude provider connection and compatibility (depends on #602 and core MCP).
- #605 — Connection verification diagnostics and repair (depends on #591, #593, #594, #595).
- #606 — Personalised AI first-use and onboarding E2E tests (depends on #602–#605 and #590–#595).

## Implementation order
1. Finish prerequisite MCP endpoints, OAuth and connection UI.
2. Build shared mobile-first wizard and per-provider guides.
3. Add diagnostics and repair.
4. Add first-use prompts and real-provider E2E verification.
5. Deploy feature-flagged staging for review; do not deploy production without explicit approval.

## Security and capability caveats
Provider-side app installation cannot always be verified via public APIs. OAuth success must not be displayed as proof of full end-to-end provider functionality. Use only officially documented automatic configuration routes; never emulate provider account actions or ask for provider credentials. Keep existing CDL role, league, scope, approval, audit and token security requirements unchanged.

See docs/features/active/ai-agent-webmcp.md for the approved core architecture.
