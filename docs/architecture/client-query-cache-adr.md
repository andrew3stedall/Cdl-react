# ADR: Persisted TanStack Query cache for authenticated API reads

## Status

Accepted and implemented.

## Context

CDL React's page components use injected API clients and imperative data loading. Route state is retained while navigating inside the app, but a browser reload discards fetched page data and makes the app wait for API responses again. Replacing every page with ad hoc local persistence would duplicate cache, identity, and invalidation behavior.

## Decision

- Send successful authenticated JSON `GET` requests under `/api/` and `/oauth/` through a shared TanStack Query client at the API transport boundary.
- Include the authenticated manager ID, API cache version, full request URL, and `Accept` header in each query key.
- Treat cached responses as fresh indefinitely and retain them in memory until invalidated. Persist the successful query cache in IndexedDB under a manager-specific key so a reload can restore it. After restoration, serve the cached response immediately and revalidate invalidated data in the background; refresh active pages when the new response is stored.
- Invalidate all cached API queries after successful non-GET requests and when existing `cdl:data-invalidated` events fire. Route re-entry, active-route refresh, visibility recovery, and reconnect refreshes continue to use the existing data freshness system and invalidate before requesting the data again.
- Clear the active manager's in-memory and IndexedDB cache after a confirmed sign-out. A different manager receives a separate cache namespace.
- Do not cache failed HTTP responses. If IndexedDB is unavailable, keep the same TanStack in-memory behavior and continue to serve the app normally.
- Bypass caching for authentication and passkey endpoints, live-draft traffic, WebMCP requests, and non-API assets. These flows have separate security or freshness requirements.

## Consequences

- Pages can render the last successful API response without waiting for the server after the cache has been populated.
- A cached response can remain visible immediately while a write, route freshness event, visibility/reconnect refresh, or explicit invalidation requests a background update. The existing active-route refresh interval remains the freshness backstop for data that may change on the server without a local write.
- The cache is local browser data, not a source of truth. The server remains authoritative for writes, permissions, and gameplay decisions.
- API response shape changes that cannot be read alongside an old browser cache require incrementing the client cache version.
- Browser storage can be cleared by the user or browser; the app must always continue to load from the API on a cache miss.

## Requirements for future frontend features

- Read and use the shared API clients and transport cache for every authenticated API feature. Keep view components on the established data-loading interface; the current app uses transport-level QueryClient integration rather than one QueryClient per page.
- Do not create alternate frontend caches or call the network directly from components. A new transport path must preserve manager-scoped keys, success-only caching, mutation invalidation, logout clearing, and IndexedDB failure fallback.
- Ensure each server-side mutation refreshes all affected views through the existing successful-write invalidation or `cdl:data-invalidated` mechanism.
- Preserve the explicit bypasses for authentication/session, passkeys, live draft, WebMCP, and static assets. Requests that need fresh uncached data must opt out using the established bypass.
- Keep route re-entry, active-route refresh, visibility recovery, reconnect, and manual refresh behavior aligned with invalidation. Because cache entries otherwise remain fresh indefinitely, do not remove or weaken these freshness triggers without an ADR update and tests.
- Increment the client cache version when a response contract changes incompatibly with data already persisted in browsers.
- Add focused regression coverage for the new or affected query behavior. Cache-layer changes also require the validation listed below.

## Validation

- Unit tests cover repeated-read reuse, IndexedDB restoration, stale-while-revalidate behavior, manager isolation, authentication bypass, mutation invalidation, and cache deletion on sign-out.
- Frontend typecheck, lint, unit tests, production build, and the configured initial bundle budget are required for each change to this cache layer.
