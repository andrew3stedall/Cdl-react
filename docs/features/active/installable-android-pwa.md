# Feature: Installable Android PWA

## Purpose

Allow managers to save Castle Draft League from Chrome on Android as an app
that opens in a standalone window without the browser address bar.

## Status

Implemented.

## Current behaviour

- The frontend publishes a web app manifest with the CDL name, theme colours,
  portrait orientation, standalone display mode, and Android-sized icons.
- Manifest and service-worker URLs are relative to the deployment base, so the
  same build works at the Cloud Run root and under GitHub Pages.
- A production-only service worker caches the static app shell and bypasses
  `/api/` requests so authenticated and league data remain network-backed.
- Dynamic viewport sizing keeps the app shell fitted to standalone mobile
  windows.

## Acceptance criteria

- Chrome Android recognises the site as installable when served over HTTPS.
- The installed app opens without Chrome's address bar.
- Static shell assets can load from the service-worker cache after a prior visit.
- API responses are never cached by the service worker.
- Development mode does not register a service worker.

## Validation

The change is validated by the frontend typecheck/build and GitHub Actions.
Manual confirmation on Android should use Chrome's three-dot menu after the
staging deployment has been visited once.
