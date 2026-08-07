# Market product specification

## Product job

Market is the acquisition workspace. It answers:

> Who could improve my squad, and what acquisition action should I take?

## Entry behaviour

Market is adaptive.

- If a draw or trade has urgent action, surface that first.
- Otherwise, open on player discovery.

## Discovery

Use one unified discovery view with:

- search;
- position tabs;
- filters;
- ownership/status indicators;
- sortable visible metrics;
- an advanced filter/sort drawer.

Default ordering is contextual and may combine projection, form, fixtures, availability and positional scarcity. Do not require a prominent synthetic ranking score.

Visible core metrics include:

- total season points;
- form;
- xG;
- xA.

The visible metrics are sortable. Advanced filters include:

- position;
- EPL club;
- ownership status;
- availability;
- statistical thresholds such as minimum xG, xA, form or points.

## Ownership and acquisition status

Use concise labels:

- **Yours**;
- **Available**;
- **Owned by [Manager]**;
- **Won in Draw**;
- **Pending Trade**.

These labels explain acquisition context and should not be conflated with injury/playing availability.

## Watchlist

Watchlist is a simple bookmark only.

- Add/remove bookmark.
- No priority, notes or acquisition metadata are required by default.
- Watchlist remains separate from draw Interests.

## Interests

Interests are private, draw-specific preference registrations.

Registering an Interest from a player card adds the player to the bottom of the current draw's preference list.

Each draw has one ranked list. The manager can reorder it using:

- drag-and-drop;
- direct priority-number entry;
- move-up/move-down controls as the accessible fallback.

Direct priority entry is important for large lists so users do not need to drag a player through many positions.

Watchlist and Interests are separate features and should not automatically mirror one another.

## Draws

Market owns:

- active draw status;
- draw deadline;
- preference entry and ordering;
- processed results;
- manager-specific won/missed outcomes;
- temporary-right context.

A player won in a draw receives temporary acquisition rights. Activating those rights and resolving squad removals occurs in Squad because it changes the season-long squad.

## Trades

Market is the primary home for trade activity.

It owns:

- incoming offers;
- outgoing offers;
- pending negotiations;
- trade history;
- counter/accept/reject/cancel actions as permitted;
- the full Trade Builder.

Urgent trade actions may also surface on Home and Squad.

### Trade Builder

A trade started from Squad may enter Market with the owned player preselected.

The full builder supports multi-player or otherwise complex proposals. Guidance may combine performance, projection, positional scarcity and league demand, presented as **Favourable / Even / Unfavourable** with expandable evidence rather than pretending the guidance is objective truth.

## Comparison

Comparison initiated in Market should use the same shared interaction model as Squad:

- drawer rather than forced page navigation for quick comparison;
- up to three players;
- manual search-based additions;
- preserve selection order;
- side-by-side cards with expandable advanced metrics.

## Usability acceptance criteria

- Discovery, watchlist, draw Interests and trade activity are conceptually distinct.
- A manager can understand how a player may be acquired from the ownership/status label.
- Interests always communicate which draw they belong to.
- Large preference lists can be reordered without long drag gestures.
- Market does not directly mutate the season-long squad when a draw is won; it hands temporary rights to Squad.
