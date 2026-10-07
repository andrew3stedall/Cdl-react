# Draft and Free Agency Guide

## Draft

The draft is a live sequential process. Managers pick from available players when it is their turn.

Supported order modes:

- random repeated
- snake
- manual

The commissioner can enable a pick clock. Managers can maintain a preselection queue. If a manager times out, the system can auto-pick from their queue or use the configured fallback strategy.

A new room is only available when its selected season has no active squad ownership. The configured active season is already drafted, so the commissioner UI and transactional API guard block another room. Next-season activation is targeted for **1 August 2027** and depends on the league/season context work tracked in [#522](https://github.com/andrew3stedall/Cdl-react/issues/522); see [#521](https://github.com/andrew3stedall/Cdl-react/issues/521).

## Free agency draws

Free agency draws happen in configured gameweeks. Managers submit private ranked preferences before the draw closes.

Processing is automatic:

1. Generate draw order.
2. Process teams in draw order.
3. Award each team the first available preferred player.
4. Create a temporary right for the winner.
5. Expire unused rights at the FPL deadline.

Failed preferences are private to the manager.
