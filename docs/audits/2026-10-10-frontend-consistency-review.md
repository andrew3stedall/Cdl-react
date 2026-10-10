# Frontend consistency review — 10 October 2026

## Scope and evidence

Reviewed the React route structure, shared player/profile components, Scouting and trade actions, the frontend delivery notes, and existing tests. This is a source review against the current repository tree. I could not run the app or execute its test/build commands in this session because the repository could not be cloned into the workspace; CI and staging evidence are recorded separately after the PR runs.

## Fixed in this review

- A player owned by another manager was rendered with the `owned_by_other` state, but the Scouting profile drawer fell through to the free-player action and offered **Add to Interests**.
- The drawer now offers **Propose trade**, opens a focused one-for-one proposal form with that player preselected, and requires the manager to choose one player from their own squad.
- Submission uses the existing `HttpSquadClient.createTrade` contract. A regression test checks the owner-targeted action and exact offer/request player IDs.

## Findings and recommended alignment

### P1 — Player actions need a shared ownership policy

Squad, Scouting, and Market share `PlayerProfilePage` and `PlayerCard`, while each route supplies its own action bar. This is a useful separation for layout, but the rules for free agents, the current manager's players, and other managers' players are independently assembled. The defect above is the result.

**Recommendation:** define a small shared player-action policy from ownership and current membership, then have each context render only the actions that policy allows. Keep the actual button labels and navigation context-specific. Add one policy test matrix covering free, self-owned, other-owned, and already-interested players.

### P1 — Page modules carry too many responsibilities

The largest React route files in the reviewed tree are SquadPage (91 KB), LeaguePage (86 KB), ProfilePage (81 KB), MarketPage (63 KB), PlayerProfilePage (56 KB), and ManagerDeskPage (38 KB). MarketPage combines discovery, Interests, trades, approvals, free-agency draws, loans routing, data loading, mapping, and interaction state. These sizes make regressions harder to isolate and increase the cost of adding functionality.

**Recommendation:** extract by workflow and contract, in small tested steps: Market discovery/activity/draw views; League fixtures/table/commissioner workflows; and profile chart groups/dialogs. Keep route components responsible for route state and composition.

### P1 — PlayerProfilePage depends on a route component

PlayerProfilePage imports `applySubstitution` and `getSubstitutionOptions` from SquadPage. A shared feature component depending on a page module couples its behavior and test loading to the whole Squad route.

**Recommendation:** move the selection rules into a focused team-selection domain module and import them from both pages.

### P2 — API access styles are mixed

Some data mutations use typed clients, while Market still uses page-local fetch helpers for other operations. Error normalization and request payload handling can therefore vary by action. The new trade proposal uses the existing typed squad client; the remaining Market requests should be migrated only when their response contracts are covered by tests.

**Recommendation:** consolidate request/error handling behind the existing API clients, preserving independently retryable sections.

### P2 — Keep concise privacy/status copy distinct from narration

The reviewed screens use status text for loading, errors, confirmations, unavailable data, and private-draw visibility. Those communicate state or a real privacy boundary. Keep those messages concise; remove copy that merely describes how to use a screen when a label or control already makes that clear. Existing source and tests already guard several removed narratives.

## Validation status

- The new regression test and frontend changes are committed on the review branch.
- Local lint, typecheck, unit tests, and build were not run in this environment.
- Pull request checks and the staging rollout are the release gates for this change.
- The previously documented boundary remains: current browser journeys rely on API test doubles; live staging trade and identity behavior need staging verification.
