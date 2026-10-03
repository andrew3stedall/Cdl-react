# #466 frontend delivery

Frontend implementation lane for the 3 October 2026 production retrospective.

## Scope and coordination

This lane owns `SquadPage`, `MarketPage`, `PlayerProfilePage`, `LeaguePage`, `AppRouteContent`, and `components/ui/global-notifications.tsx`. Authentication and invitation API changes remain with the auth lane; shared modal/theme/layout changes remain with the UI lane; Rules content and future contextual routes remain with the coordinator unless reassigned. Trade acceptance uses the existing `PUT /api/trades/{trade_id}` participant transition. `accepted` records counterparty agreement and still requires commissioner approval before ownership moves. Ranked draw submission follows the movement lane's documented draw contract.

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
- Shared route activation, visibility, network, and scoped mutation invalidation revalidate cached pages. Squad preserves staged lineup work and reports stale reads rather than replacing the draft.
- League now has addressable Knockouts and Head-to-head workspace views backed by additive competition client methods. Profile setting paths remain explicitly allowlisted alongside those routes.
- Retired Squad-local mobile navigation markup and dead styles are removed so the global navigation remains the single destination bar.
- Market has an addressable free-agency draw view with private ranked preferences, open-window editing, save feedback, the manager's own outcome, public awards, and retry for failed reads.
- Desk and Player Profile cached reads participate in shared freshness updates. Active visible routes poll every 60 seconds; hidden and inactive route subscribers do not refresh.
- Engineering checkpoint routes render only when the session explicitly enables engineering previews. Analytics and FDR are split into lazy-loaded route chunks.
- Commissioner League management lists pending invitations from the scoped API and supports revoking an outstanding invite with independent retry and success/failure feedback.
- Market Trades shows only role-matched pending approvals, supports approve/reject decisions, and reports ownership execution only after the API returns the committed result. Commissioner free-agency controls can create draws and open, lock, or process them within the API status/time windows.
- Rules deep links preserve SPA pathname routing and pass the current hash into the cached workspace so same-path in-app anchor navigation scrolls correctly.
- Rule-validation and chip-conflict Squad status feedback links directly to the relevant Rules section, and SPA route state keeps only the normalized pathname while preserving browser hashes.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test -- --maxWorkers=2 src/SquadPage.test.tsx src/MarketPage.test.tsx`
- `npm test -- --maxWorkers=2 src/LeaguePage.test.tsx src/MarketPage.test.tsx src/SquadPage.test.tsx`

Focused validation also covers `src/App.engineering-previews.test.tsx`, `src/data-freshness.test.ts`, and `src/navigation.test.ts`; the focused run passed 53 tests across five files. `npm run build` succeeds. Its current entry chunk is 615.42 kB minified / 168.21 kB gzip; Analytics and FDR are separate route chunks at 6.33 kB / 2.28 kB gzip and 4.86 kB / 1.78 kB gzip respectively. Vite still warns that the entry chunk exceeds 500 kB. The isolated lane run before integration passed 200/206 tests across 45 files; root's subsequent integrated frontend run passed 212 tests after reconciling the AppShell and lazy-route assertions.

## Deferred within this lane

- Generated bundle size comparison remains outside this lane's validation.
