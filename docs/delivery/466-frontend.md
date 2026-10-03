# #466 frontend delivery

Frontend implementation lane for the 3 October 2026 production retrospective.

## Scope and coordination

This lane owns `SquadPage`, `MarketPage`, `PlayerProfilePage`, `LeaguePage`, `AppRouteContent`, and `components/ui/global-notifications.tsx`. Authentication and invite changes remain with the auth lane; shared modal/theme/layout changes remain with the UI lane; Rules content and future contextual routes remain with the coordinator unless reassigned. Trade acceptance uses the existing `PUT /api/trades/{trade_id}` participant transition. `accepted` records counterparty agreement and still requires commissioner approval before ownership moves. Ranked draw submission is held to the movement lane's documented draw contract.

## Delivered

- Chip response handling preserves staged lineup roles until Save.
- Squad mutation success is kept distinct from post-commit lineup/rights refresh failures; staged changes clear at the successful commit boundary.
- Squad status is visible and announced, trade review links to `/scouting/trades`, and duplicate trade submissions are guarded.
- Compare and Trade drawers can retry scouting reads and can recover after a close/reopen during loading.
- Market has explicit retry and per-section loading/error/empty states, Interest removal updates local state, and official history refresh updates form data even when row counts do not change.
- Market trade rows expose participant-authorized accept/reject/cancel actions and identify accepted proposals awaiting commissioner approval.
- Player profile retains a supplied player header while history/lineup reads load.
- League fetches table and fixture reads separately by active view; commissioner management does not wait for fixture reads, and upcoming previews state clearly when zero or one lineup is published.
- League view tabs update to addressable routes and unrecognized URLs render a not-found state. Market and League provide contextual FDR/Analytics links.
- Notifications distinguish initial loading, failure, empty, and stale states, provide Retry, and label counts as alerts without claiming unread state.
- Commissioner management labels membership as assigned managers and removes unsupported online-presence and invite-process narration.
- Concrete explanatory copy identified in Squad, Player Profile and League was reduced to concise limits, consequence labels and controls.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test -- --maxWorkers=2 src/SquadPage.test.tsx src/MarketPage.test.tsx`
- `npm test -- --maxWorkers=2 src/LeaguePage.test.tsx src/MarketPage.test.tsx src/SquadPage.test.tsx`

The full frontend suite and production build remain to be run after cache freshness and the competition-view integration are complete. An intermediate four-file test run including AppShell had four unrelated integration failures after the Rules and shared UI changes: test stubs do not resolve Rules API reads, and shared header/account selectors need reconciliation.

## Deferred within this lane

- Shared route activation/visibility freshness and mutation invalidation, preserving staged Squad work.
- League knockout and head-to-head view wiring depends on the coordinator's competition components and additive API contract.
- Full Rules/AppShell integration test reconciliation remains.
- Ranked draws require a stable draw-discovery/readiness contract in addition to the movement lane's preference/results endpoints.
