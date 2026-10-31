## Unreleased

- Removed repeated fixture list group headings and counts to align both team columns, retained accessible group labels, and colour-coded open, active, and closed fixture status badges from the selected theme.

- Add a confirmation-gated, staging-only database job to remove fixture rows explicitly marked synthetic and their linked results/scoring snapshots. The job uses an immutable image and reports deleted row counts.

- Add manual staging Castle sync with read-only plans, reviewed transactional applies, versioned non-FPL archives, conservative fixture/lineup/completed-trade projection, conflict protection, schema-gap documentation and a repeatable phone-compatible runbook. Live loading and Actions database permissions remain unverified.

- Add complete paginated personal Castle exports with historical draw outcomes, visible trades/bulletins and FPL payloads, encrypted temporary Actions artifacts, count/hash manifests and regression tests. No app import is performed.

- Fix Castle collector path validation rejecting the documented `top8_votes` table; verified GCP credential access, personal Castle authentication and preceding league reads in live Actions.

- Preserve safe Castle collector failure reasons and stage/endpoint progress; validate collector changes automatically on trusted main pushes.

- Added Castle read inventory collectors for GitHub Actions/GCP and optional local Google sign-in, with membership-scoped reads, secret-free reports and nine regression tests. The Actions path uses a dedicated Secret Manager personal Castle credential and existing staging federation; credential bootstrap and live validation remain pending.

- Hid the notification control in page headers and reduced the phone header from 8.5rem to a compact, stable 5.5rem two-row layout.

- Show the latest five completed gameweeks in the Manager's Desk fixture comparison, including the most recently completed week before an upcoming fixture.

- Added contributor and agent requirements for all frontend server data to use the shared TanStack Query transport cache, preserve invalidation and freshness behavior, and retain manager isolation and endpoint bypasses.

- Route authenticated JSON API reads through a per-manager TanStack Query cache persisted in IndexedDB. Cached pages can render immediately after a reload; successful writes and existing route/data refresh events invalidate cached responses, and sign-out clears the manager's cache.

- Build staging images as a single-platform immutable manifest so Cloud Run's candidate digest matches the image reviewed by the rollout gate.

- Keep five previous gameweek scores visible on the Manager's Desk during a live gameweek by including the active gameweek plus five prior gameweeks in the form fixture payload.

- Replace the Teams view's rotating image planes with solid meshes extruded from each badge's SVG contours, preserving cutouts and disconnected details, with bevels, coloured sidewalls, lighting, and full rotation. Add a vector companion for the raster-backed Sporting Lesbians asset and regressions for real mesh depth and open holes.

