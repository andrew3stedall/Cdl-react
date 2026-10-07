# Staging candidate capability and follow-up register

This delivery hardens the app's existing manager journeys for an already drafted league. It does not convert engineering checkpoints into a claim of completed production services. Production deployment remains separate from this staging delivery, including the documented database restore and live reviewer gates.

## Current candidate

| Capability | Staging candidate | Follow-up / gate |
| --- | --- | --- |
| Sign-in, returning Google members, team invites, team isolation | Delivered with protected-environment boundary | Live credential/device verification |
| Passkey add/list/revoke | Delivered | Real WebAuthn device/browser exercise |
| Squad changes, weekly selection, captaincy, chips | Delivered with ownership and scoring corrections | Bonus and captain-fallback rules below remain explicit decisions |
| Trade proposal, agreement, authorized approval and execution | Delivered | Multi-manager PostgreSQL and staging validation |
| Ranked free-agent draws, awards and temporary rights | Delivered; release checks pending | Private preferences and commissioner controls require hosted PostgreSQL/browser checks |
| Fixtures, official/live table, frozen history, knockout/H2H views | Delivered known paths | Unresolved knockout ties stay unresolved |
| Rules, appearance, compact navigation, alerts | Delivered / integration validation | Device layout checks; alerts are derived, not durable unread events |
| FDR and Analytics | Contextual optional tools | FDR from Market; Analytics from League; no fifth primary nav item |
| Live draft room | Persistent configured-season room; integration validation | #521/#522: next-season drafting requires the active-context/season-team redesign |
| Self-service league/season creation and switching | Deferred; existing APIs still resolve one hardcoded 2026/27 context | #522: accept dynamic context plus `season_teams` architecture; proposal in `docs/architecture/league-season-context-prerequisite-adr.md` |
| Immutable runtime rule versions | Current-season v2 adds the accepted #494 score-multiple league bonus while preserving immutable v1 scoring provenance | #523: commissioner editor/activation, templates, and references from other action families remain future scope; #499/#496 remain unconfigured |
| Loans, extensions, scheduled return/conversion | Basic loans and retryable scheduled returns delivered | #525: advanced extension/conversion policy remains open |
| Private watchlists and notes | Private persisted flags/notes delivered | #526/#532: availability alerts need durable event/reminder policy |
| Durable activity/read state/reminders | Deferred from the current candidate; current alerts remain derived | #532: revisit at the post-launch durable-notifications milestone after the #531 release-evidence gate; no unread/reminder promise is exposed |
| CDL ownership/loan history and expanded comparisons | Ownership periods API/UI delivered | #533: distinct loan/transfer explanations and expanded comparisons remain open |
| Assigned-team release/reassignment | Deferred from the current candidate; no destructive control exposed | #535: revisit after the league/season context and commissioner replacement policy are accepted; authorization, prior-session revocation, audit reason and history preservation remain required |

The deferred capabilities remain open GitHub work. Their accepted behavior is retained in the owning feature documents; they are not discarded or marked implemented. Engineering checkpoint routes are not first-release manager navigation and their APIs are unavailable in production.

## Decisions parked without blocking independent fixes

| Issue | Exact decision needed | Safe behavior while parked |
| --- | --- | --- |
| #494 | Resolved 8 Oct 2026: >=2× positive opponent = +1; >=3× = +2 total; max 2; opponent <=0 = 0 | Implemented through versioned rule configuration and frozen/projected awards |
| #499 | Captain DNP fallback: when vice-captain inherits the multiplier, including chip interaction | Preserve current scoring behavior until the league policy is approved |
| #496 | Fifth/sixth playoff path and winner if aggregate points and scoring-lineup goals remain tied | Implement specified top/bottom brackets; ambiguous branches explicitly unconfigured, ties have no winner |
| #535 | Deferred current-candidate workflow; authorization, confirmation/reason, prior-manager session revocation and immutable history | Leave current assignment unchanged; expose no destructive release/reassignment control |
| #531 / #71 | Deployed signed-in reviewer evidence and dated restore/recovery exercise if unavailable to this workspace | CI proves its actual database/browser scope; health is never substituted for recovery evidence |

No permission-dependent item is silently treated as solved. Each has an open issue and a bounded unblock condition.
