# Staging candidate capability and follow-up register

This delivery hardens the app's existing manager journeys for an already drafted league. It does not convert engineering checkpoints into a claim of completed production services. Production deployment remains separate from this staging delivery, including the documented database restore and live reviewer gates.

## Current candidate

| Capability | Staging candidate | Follow-up / gate |
| --- | --- | --- |
| Sign-in, returning Google members, team invites, team isolation | Delivered with protected-environment boundary | Live credential/device verification |
| Passkey add/list/revoke | Delivered | Real WebAuthn device/browser exercise |
| Squad changes, weekly selection, captaincy, chips | Delivered with ownership and scoring corrections | Bonus and captain-fallback rules below remain explicit decisions |
| Trade proposal, agreement, authorized approval and execution | Delivered | Multi-manager PostgreSQL and staging validation |
| Ranked free-agent draws, awards and temporary rights | Delivery in progress | Persistent service and integrated UI must pass before completion |
| Fixtures, official/live table, frozen history, knockout/H2H views | Delivery in progress | Unresolved knockout ties stay unresolved |
| Rules, appearance, compact navigation, alerts | Delivered / integration validation | Device layout checks; alerts are derived, not durable unread events |
| FDR and Analytics | Contextual optional tools | FDR from Market; Analytics from League; no fifth primary nav item |
| Live draft room | Planned; engineering prototype only | #521: persistent draft milestone before the next league draft |
| Self-service league/season creation and switching | Planned; engineering prototype only | #522: independent commissioner setup milestone |
| Rule configuration editor and historical rule-version enforcement | Planned; engineering prototype only | #523: approve the configuration boundaries and unresolved rules first |
| Loans, extensions, scheduled return/conversion | Planned; engineering prototype only | #525: persistent loan milestone after movement/approval foundations |
| Private watchlists and notes | Planned; not draw Interests | #526: scouting enhancement; no bookmark/notification promise in current UI |
| Durable activity/read state/reminders | Planned; current alerts derived | #532: explicit reminder cadence and durable events milestone |
| CDL ownership/loan history and expanded comparisons | Planned | #533: preserve recorded ownership changes now; add the user-facing history milestone |
| Assigned-team release/reassignment | Policy blocked | #535: authorization, prior-session revocation, audit reason and history preservation |

The deferred capabilities remain open GitHub work. Their accepted behavior is retained in the owning feature documents; they are not discarded or marked implemented. Engineering checkpoint routes are not first-release manager navigation and their APIs are unavailable in production.

## Decisions parked without blocking independent fixes

| Issue | Exact decision needed | Safe behavior while parked |
| --- | --- | --- |
| #494 | Bonus points: thresholds/criteria, award amount and whether each is cumulative | No invented league bonus award; show official result points only |
| #499 | Captain DNP fallback: when vice-captain inherits the multiplier, including chip interaction | Preserve current scoring behavior until the league policy is approved |
| #496 | Fifth/sixth playoff path and winner if aggregate points and scoring-lineup goals remain tied | Implement specified top/bottom brackets; ambiguous branches explicitly unconfigured, ties have no winner |
| #535 | Who may release/reassign a team, confirmation/reason, prior-manager session revocation and immutable history | No destructive release/reassignment control |
| #531 / #71 | Deployed signed-in reviewer evidence and dated restore/recovery exercise if unavailable to this workspace | CI proves its actual database/browser scope; health is never substituted for recovery evidence |

No permission-dependent item is silently treated as solved. Each has an open issue and a bounded unblock condition.
