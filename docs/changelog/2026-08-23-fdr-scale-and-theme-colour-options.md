# 2026-08-23 — FDR scale options and theme colours

The account appearance controls now support an FDR scale chooser that presents
numeric options with colour illustrations instead of exposing the underlying
D3 scale names. Eight additional three-colour palettes are available for
staging; each defines colours at FDR 1, 3, and 5 and linearly interpolates FDR
2 and 4 between those anchors.

Managers can also choose separate main theme colours for light and dark mode,
including arbitrary colours through the native colour picker. These choices
are applied to primary actions, accents, focus rings, and chart hooks, and are
persisted with the existing authenticated preference contract.
