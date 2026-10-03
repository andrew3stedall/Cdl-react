# Retrospective staging candidate — 3 October 2026

[#466](https://github.com/andrew3stedall/Cdl-react/issues/466) coordinates 70 findings; [PR #538](https://github.com/andrew3stedall/Cdl-react/pull/538) delivers the implementation candidate.

The release corrects access isolation, repeated Google sign-in, logout feedback, lineup ownership and settlement, official/live tables, manager mutation recovery, and palette/modal/navigation consistency. Persistent trade approvals, ranked draws, basic loans and returns, configured-season drafts, private notes/watchlist flags and ownership periods are now exposed through authenticated workflows. New rule versions pin future locks and finalizations without rewriting historical records.

Schema migrations add workflow persistence. Deployment runs and verifies migrations against the immutable candidate image before promoting traffic. It does not run the destructive synthetic staging seed. Local tests, actual PostgreSQL CI, browser CI and hosted deployment are recorded separately in the [delivery register](../delivery/2026-10-03-retrospective-delivery.md).

Production is not yet approved: unresolved scoring policies, dynamic league/season setup, advanced loans, durable reminders, live device identity and dated recovery evidence remain explicit open work. See the register for every issue, acceptance boundary and recommended sequence.
