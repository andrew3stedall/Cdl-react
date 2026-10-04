# #466 performance and player-history follow-up

## Scope

This follow-up records the scoped work for #536 and #533 against repository baseline `4a98d69d271035ec2358741380caa6d28f83a72b`. It also confirms #526's saved-player browsing boundary where it overlaps the player-profile feature. It does not change the shared audit/register or changelog.

## #536 — Initial production asset measurement

Built the frontend with the checked-in lockfile on Node/npm available in this workspace (`npm ci`, then `npm run build`). The build reports Vite 8.2.1. Baseline and changed builds used the same environment and production command.

| Initial asset set | Before | After | Change |
|---|---:|---:|---:|
| Entry JavaScript, minified | 616.46 kB | 551.30 kB | −65.16 kB (−10.6%) |
| Entry JavaScript, gzip | 168.08 kB | 154.93 kB | −13.15 kB (−7.8%) |
| Initial CSS, minified | 286.30 kB | 257.21 kB | −29.09 kB (−10.2%) |
| Initial CSS, gzip | 42.39 kB | 38.37 kB | −4.02 kB (−9.5%) |
| HTML + initial JS + CSS, gzip estimate | 210.90 kB | 193.73 kB | −17.17 kB (−8.1%) |

The change makes Profile, Result Colours, Rules, invite acceptance, and gated engineering-checkpoint modules React-lazy with a compact loading status in the existing route-content area. The shared shell, Desk, four-item global navigation, core Squad/Market/League routes, login and splash remain eager. The route cache remains active. Build output confirms separate chunks for invite, Rules, profile, result-colour settings, and checkpoint pages; their code is fetched when those routes are rendered.

`PlayerProfilePage` remains eagerly imported by the League and Squad modules, so it remains part of initial JavaScript; App retains the matching eager import. The main bundle still exceeds Vite's 500 kB warning threshold. Further splitting shared profile/card code requires a separate change to the eager League/Squad feature paths and fresh bundle evidence.

These are repeatable build asset measurements, not a representative handset cold-load or interaction benchmark. No physical phone/network run or deployed Lighthouse run was available in this workspace. Gzip values estimate transferred compressed asset size; they do not establish parse time, LCP, responsiveness, cache behavior on a phone, or user-perceived improvement. Acceptance for real-device performance measurement remains open for a representative phone and network.

## #533 — Supported and deferred player history

The player-profile feature document now separates shipped capability from the broader plan. The existing profile disclosure reads league-scoped `squad_ownerships` periods and displays season/team, start date, end date/current status. The API contract does not return an event type or source reference, and the ownership table is also written by different acquisition and loan paths. Therefore it cannot accurately label a period as a draft, transfer, trade, draw, free-agent acquisition, or loan. A canonical event projection and correction semantics remain deferred; no event labels or business rules were inferred.

The current compact comparison remains usable and compares up to three players on points, form, xG and xA. Expanded comparison fields remain deferred. The canonical movement-event projection and its correction semantics are still unimplemented, so #533 remains open. See [player-detail-history-and-comparison.md](../features/active/player-detail-history-and-comparison.md) for the full supported/deferred matrix.

## #526 — Saved-player browsing

The same profile panels provide private watchlist flags and notes through the current user's scoped record. The read/write API and watchlist endpoint already exist. This scope does not add a separate watchlist destination or alert preferences; those are outside the player-history and performance changes here.

## Validation

- Baseline `npm run build`: passed; entry JS 616.46 kB / 168.08 kB gzip and CSS 286.30 kB / 42.39 kB gzip.
- Changed `npm run build`: passed; entry JS 551.30 kB / 154.93 kB gzip and CSS 257.21 kB / 38.37 kB gzip. Vite retains its >500 kB warning and reports the static PlayerProfile import caveat above.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test -- --maxWorkers=2`: passed, 232 tests across 51 files. App-shell assertions now wait for deferred route modules before checking their contents.
- Physical-device and deployed/browser performance validation: not run.
