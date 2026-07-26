# 2026-07-26 — Multi-viewport App Screenshots

## Summary

Expanded the repository-safe application screenshot workflow from a single mobile viewport to mobile, tablet, and desktop evidence.

## Added

- Named 390 × 844 mobile, 768 × 1024 tablet, and 1440 × 900 desktop captures.
- Route-by-viewport artifact directories containing 18 screenshots per run.
- Automated checks for a `main` landmark and horizontal overflow before each screenshot.
- Font readiness waiting to reduce inconsistent captures.
- Documentation contract coverage for the viewport and layout-safety requirements.
- Keyboard-focusable horizontal-scroll regions for league tables on narrow screens.

## Validation finding

The first multi-viewport run detected a real document-level overflow on `/league` at 390 px. League fixture and standings tables now retain their columns inside labelled, focusable scroll regions instead of widening the document.

## Scope

The workflow continues to use deterministic mocked API fixtures. It does not deploy infrastructure, use secrets, require historical exports, or prove live PostgreSQL integration.

## Related work

- Issue #96: Finalise implementation, design and testing readiness.
