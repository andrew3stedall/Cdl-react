# Feature placement and navigation

## Purpose

This document is the product-level source of truth for where Castle Draft League features belong and why. Page specifications should implement this model rather than inventing feature ownership independently.

## Primary navigation

The manager-facing primary navigation is:

1. **Home** — urgency-led command centre.
2. **Squad** — season-long squad health and squad actions.
3. **Market** — acquisition, discovery, draws, interests, watchlist and trade activity.
4. **Matchweek** — weekly lineup decisions and deadline execution.
5. **League** — competition state, fixtures, table and head-to-head context.

## Home

Home is urgency-led rather than feature-led. It ranks actions using a combined priority signal that considers deadlines, player risks, pending decisions and likely impact.

The user can switch between ranked and grouped views. The default is adaptive: when urgent items exist, the highest-impact action is featured and the remaining items are grouped; when nothing urgent exists, the next deadline is featured with upcoming items behind it and calendar access available secondarily.

Selecting an item uses adaptive detail handling:

- quick context opens in a drawer on desktop or bottom sheet on mobile;
- multi-step, consequential or comparison-heavy work moves into the owning feature flow.

## Squad

Squad owns season-long roster management. Its core question is:

> What is the condition of my season-long squad, and what squad action should I take next?

Squad owns:

- whole-squad health and quality;
- player status and availability context;
- identifying weak or expendable squad players;
- comparison from an owned-player context;
- staging draw-won additions and corresponding removals;
- releasing a player to free agency as part of staged squad changes;
- starting a trade from an owned player;
- navigating to the full player profile.

Squad does **not** own weekly lineup editing. It may preview the current lineup, but Matchweek owns lineup changes.

Squad does **not** own general player discovery, watchlists, draw preference management or trade inboxes. Those belong in Market.

## Market

Market is the full acquisition workspace. It owns:

- player discovery;
- free-agent and ownership status browsing;
- contextual player ranking;
- watchlist bookmarks;
- draw-specific Interests and preference ordering;
- active and completed draw context;
- trade activity and negotiations;
- comparison initiated from discovery or trade contexts.

Market discovery defaults to contextual ranking using projection, form, fixtures, availability and positional scarcity. The ranking itself does not need a prominent synthetic score. Visible core metrics include total season points, form, xG and xA, with sortable columns and an advanced filter/sort drawer.

Ownership/status labels should be concise and explicit: **Yours**, **Available**, **Owned by [Manager]**, **Won in Draw**, **Pending Trade**.

## Matchweek

Matchweek owns weekly execution:

- starting lineup;
- bench order;
- captain and vice-captain;
- chips;
- fixture lock state;
- save/submit selection;
- deadline context.

Squad may show the current lineup as a read-only preview and link into Matchweek for changes.

## League

League owns competition context:

- league overview;
- fixtures;
- table;
- knockout competition;
- head-to-head information;
- competition results and movement.

League information may create urgency items on Home, but the detailed competition views remain in League.

## Contextual actions

Simple, reversible actions should stay contextual. Multi-step, consequential or comparison-heavy actions use a dedicated flow.

A player selected from Squad opens the full player profile in a full-width, full-height replacement layer above the main navigation. The layer prioritises:

1. current status;
2. performance evidence;
3. upcoming fixtures when data is available;
4. contextual actions.

For an owned Squad player, the profile actions are:

- **Move to bench** or **Move to Starting XI**;
- **Compare**;
- **Remove** — opens the confirmation action dialog;
- **Draft trade** — only promoted when the player has credible trade value;
- **Close player profile**.

## Comparison model

Comparison is contextual and should not force the manager to leave the page that initiated it.

- Open as a drawer.
- Support up to three players.
- Preserve the order in which comparison players were selected.
- Add comparison players through search rather than automatic ranking.
- Use side-by-side cards with expandable advanced metrics.

## Trade-value guidance

Trade value combines performance, projections, positional scarcity and league demand signals. The UI should show a simple trade-value label with expandable evidence.

A lightweight trade drawer may start from an owned player. It should allow the manager to choose the other manager and one target player, show **Favourable / Even / Unfavourable** guidance with expandable evidence, and continue into a dedicated Trade Builder for complex or multi-player proposals.

## Watchlist and Interests

These are separate concepts.

- **Watchlist** is only a bookmark.
- **Interests** are draw-specific preference registrations.

Registering an Interest adds the player to the bottom of the current draw's ranked preference list.

The ranked list supports:

- drag-and-drop;
- direct priority-number entry for long moves;
- accessible move-up/move-down controls as a fallback.

Watchlist and Interests remain visually and conceptually separate.
