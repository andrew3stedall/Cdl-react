# 2026-08-08 — Staging draft reroll and lineup reset

## Problem

The first position-constrained staging reset successfully rewrote all 160 squad ownerships, but it used the same deterministic draft board and the same named team-to-draft-position mapping as the previous seed. As a result, a manager's visible squad could remain almost identical after a successful reset, which made the reset look ineffective for staging review.

The Squad page also merges the saved team-selection read model over the owned-player roster. Existing saved lineup rows therefore needed to be invalidated when the entire staging draft was replaced.

## Change

After the canonical constrained snake draft is seeded, staging now performs a deterministic **draft-order reroll**:

- each complete legal drafted squad is reassigned to a different named manager/team using a non-zero draft-position offset;
- the player sets remain unique and retain the constrained draft's legal composition;
- every final named squad is revalidated against GKP 2–3, DEF 4–10, MID 5–10 and FWD 2–4 with exactly 20 players;
- all saved team-selection lineup rows for the staging season are cleared in the same reroll transaction so stale gameweek placement cannot leak into the newly assigned squad.

This reroll is staging-only and exists to make repeated mock-draft resets useful for product testing. A future reroll can deliberately bump the staging reroll offset without changing production behaviour.

## Product documentation

The active combined Squad + team-selection refinement is now saved in `docs/product/combined-squad-team-selection-working-notes.md`. It records the 11 starters + 5 substitutes + 4 reserves target, goalkeeper-substitute rule, ordered outfield substitutes, future-gameweek planning and explicit Save Team transaction.