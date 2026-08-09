# Login account flow — 2026-08-09

## Changed

- Updated the official Google sign-in control to use the dark variant so it sits cleanly within the mobile login surface.
- Enabled Google's supported FedCM button auto-select path so a returning manager can continue with the account already shown by Google without first opening the account chooser.
- Added an explicit **Use another Google account** action that opens Google's account-selection prompt when the manager wants to switch.
- Removed gradients and ambient blur from the login screen while retaining the dark blue and cyan visual language.
- Kept password login, server-side Google ID-token verification, the staging email allowlist, and the existing application session unchanged.

## Validation

- `npm run lint` passed.
- `npm run test` passed: 17 frontend test files, 55 tests.
- `npm run typecheck` and `npm run build` passed.
- `uv run ruff check .` and `uv run ruff format --check .` passed.
- `uv run pytest` passed: 337 tests, with 18 expected skips.
