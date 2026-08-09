# Squad product specification

## Product job

Squad is the season-long squad health workspace. It answers:

> What is the condition of my squad, and what squad action should I take next?

It is not the general player-discovery area. The weekly lineup editor is intentionally consolidated here so the manager has one place to review and submit the current team.

## Entry behaviour

The page is adaptive.

- If something genuinely requires squad attention, show an action-centre treatment first.
- Otherwise, open directly on the full squad.
- The highest-impact squad issue is featured; remaining issues are grouped by availability, performance, trades and opportunities.

Selecting an issue should show the problem, supporting evidence, a recommendation and alternative actions.

## Squad views

Support **Pitch** and **List**.

- Pitch is the overview representation.
- List is the analytical representation.
- Remember the manager's last choice.
- The current gameweek lineup positions players on the pitch and is editable from the same workspace.

### Shared essentials

Both views should show, when the underlying data is available:

- player name;
- club shirt or club identity;
- next opponent;
- form;
- availability.

The list view also keeps points, xG/xA, and an icon-only player action control visible without horizontal scrolling. Position and lineup group are communicated by the table section rather than repeated in each row. Player movement starts from the player drawer, then returns to the current pitch or list surface so the manager chooses the replacement from the visible squad.

Do not invent missing metrics or substitute implementation status for user-facing data.

### List analysis

List defaults to **All Players** using shared metrics, then exposes position tabs for Goalkeeper, Defender, Midfielder and Forward. Position tabs use specialist columns.

Columns are customisable. The default analytical set should include:

- total points;
- value;
- recent points;
- projected points;
- minutes risk;
- fixture difficulty;
- position-aware metrics such as xG, xA and clean-sheet information.

Only render metrics that have a trustworthy product data source. Missing joins should be documented rather than filled with synthetic values.

## Player quick-detail drawer

Selecting a squad player opens a contextual drawer. It prioritises:

1. current status and availability;
2. performance evidence;
3. upcoming fixtures;
4. actions.

The owned-player actions are:

- **Substitute player**;
- **Compare**;
- **Release to free agency**;
- **Draft trade**;
- **Full profile**.

### Substitute player

Substitution is an in-place swap between Starting XI, Bench and Reserves.

- Choosing **Substitute player** closes the player drawer and enters a page-level substitution mode.
- The current pitch or list surface remains visible; legal candidates are marked there and can be selected directly.
- Candidates are limited to swaps that preserve the configured Starting XI formation and bench composition.
- Starting XI eligibility uses the authoritative formation limits: 1 goalkeeper, 3–5 defenders, 2–5 midfielders and 1–3 forwards.
- When a player enters the bench, the page-level mode exposes the legal bench slot: goalkeeper or outfield positions 1–4.
- The swap is staged locally until **Save lineup** is selected; the existing backend lineup validation remains authoritative.
- A locked gameweek exposes the context but disables substitution.

Pitch players use a restrained position marker colour rather than a visible position label. Position rows remain transparent so the pitch markings stay visible, and the pitch uses compact vertical spacing.

### Compare

Compare stays on the Squad page in a drawer.

- Up to three players.
- First player is the selected squad player.
- Additional players are found by search.
- Preserve selection order.
- Use side-by-side cards.
- Advanced metrics expand within each comparison card.

### Release to free agency

Release is never an immediate player-by-player mutation.

- Selecting Release stages the player for removal.
- The player leaves the active squad representation and moves to the side panel's **Pending Removal** section.
- Pending removal has a **Removed** badge and a distinct treatment parallel to the **Added** treatment.
- The user can **Restore to Squad** explicitly. Drag-and-drop may be an optional convenience but is never required.

## Draw-won additions and staged squad changes

Players can only be added to the squad from temporary rights created by a completed draw.

A collapsible side panel contains two sections:

1. **Available to Add** — draw-won players whose temporary rights have not yet been activated;
2. **Pending Removal** — current squad players staged for release.

Both sections should be visible together when space allows.

Selecting an available-to-add player opens quick details with a prominent **Add to Squad** action.

When added:

- the player appears in the normal squad position;
- an **Added** badge and subtle styling distinguish the staged addition;
- the manager may resolve required removals afterward.

During staging, Added/Removed indicators are sufficient. Do not clutter the page with persistent validation banners.

### Submission

**Submit Squad Changes** opens a minimal confirmation dialog showing:

- players to add;
- players to remove;
- blocking validation errors, if any.

The manager may attempt submission even when the staging state is invalid. Validation happens in the dialog and blocks final confirmation until valid.

Final mutation must be atomic from the user's perspective: staged changes are committed together or not at all.

## Trade initiation

Draft Trade is contextual guidance, not a default action for every poor player.

- Compare is the default analytical action.
- Promote Draft Trade only when the player has credible trade value.
- Low-value/unwanted players are more likely release candidates.

Trade value combines performance, projection, positional scarcity and league-demand signals. Show a simple label with expandable evidence.

A lightweight trade drawer starts with the owned player preselected. It lets the manager choose the other manager and one target player, shows Favourable / Even / Unfavourable guidance with expandable evidence, and continues to the full Trade Builder for complex proposals.

## Boundaries

### Belongs in Squad

- squad health;
- full-squad review;
- current gameweek lineup and bench management;
- captain/vice-captain state and chip controls;
- next deadline context;
- owned-player comparison;
- staged additions/removals from draw wins;
- release staging;
- starting a trade from an owned player;
- lineup preview and submission.

### Belongs elsewhere

- player discovery -> Market;
- watchlist -> Market;
- draw Interests and preference ranking -> Market;
- trade inbox and negotiation management -> Market;
- league competition state -> League.

## Responsive behaviour

- Pitch remains usable on mobile, including rows that may contain up to five players.
- Avoid requiring drag-and-drop for any essential action.
- The Available to Add panel is collapsible and must not permanently consume the mobile viewport.
- Context drawers may become bottom sheets on narrow screens.

## Usability acceptance criteria

- The manager can review and save the current lineup without leaving Squad.
- `/team-selection` and `/squad-management` do not create duplicate player panels.
- Selecting a player exposes Substitute, Compare, Release, Draft Trade and Full Profile without hunting through menus.
- A manager can see only formation-valid substitution candidates and choose a numbered bench slot when needed.
- List view does not use per-player movement dropdowns; its player action control starts the same in-place substitution mode as Pitch view.
- A manager can stage and restore removals without mutating the server immediately.
- Draw-won players are clearly distinct from ordinary free agents.
- Added and Removed states are visible but not visually dominant.
- Submission explains blocking rules only when the manager reaches confirmation.
- Comparison supports up to three players and preserves manual selection order.
- No database, staging, persistence or other implementation terminology is exposed as normal user-facing status text.
