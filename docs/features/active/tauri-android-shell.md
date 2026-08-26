# Feature: Tauri Android shell

## Purpose

Provide an Android APK for Castle Draft League while preserving the existing React
frontend and FastAPI/PostgreSQL Cloud Run backend.

## Scope

- Add a Tauri 2 Rust application shell around the Vite-built React frontend.
- Keep the existing web/PWA build and Cloud Run service unchanged.
- Provide a reproducible GitHub Actions Android debug APK build.
- Build the staging APK against the deployed staging URL so the existing
  same-origin cookie session and authentication flow continue to work.
- Keep the Tauri capability set at the core default until a native feature is
  deliberately added.

## Build commands

From the repository root:

```bash
npm install
npm --prefix frontend install
npm run tauri:android:init -- --ci
npm run tauri android build -- --apk --debug --config src-tauri/tauri.staging.conf.json
```

The Android SDK, Java 17, and Rust Android targets are required. The GitHub
Actions workflow installs these dependencies and uploads the resulting debug APK
as an artifact.

## Deployment and authentication

The normal Cloud Run/PWA deployment remains the canonical web experience. The
staging APK uses `src-tauri/tauri.staging.conf.json` to open the staged
same-origin application inside the Tauri WebView. This is intentional: the
current application uses HTTP-only same-origin session cookies, so a local
embedded frontend calling the Cloud Run API from a `tauri.localhost` origin
would require a separate CORS, cookie, or token-auth contract.

The staging overlay is not a production release configuration. A production
mobile build must receive an explicitly approved production URL and must use
Android release signing before distribution.

## Rust boundary

No application domain logic has been moved to Rust. Rust is currently the
small native host required by Tauri. CPU-heavy local work should only be moved
behind a measured performance boundary.

## Validation

- Frontend lint, typecheck, tests, and build remain covered by the existing CI.
- The Tauri workflow initialises the Android project and builds a debug APK.
- Manual Android validation should check login, bottom navigation, drawers,
  scrolling, viewport insets, and passkey behaviour on a physical device.
