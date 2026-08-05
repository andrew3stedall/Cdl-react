# Castle Draft League Login Redesign

## Summary

Replaced the utilitarian unauthenticated boundary with a dedicated Castle Draft League login experience based on the supplied dark mobile reference.

## Product changes

- Added Castle Draft League branding, a shield-and-castle mark, and cyan accent treatment.
- Added a mobile-first edge-to-edge layout and a restrained centred desktop panel.
- Added labelled email and password fields with icons and a password visibility control.
- Preserved the existing email/password API, Google Identity Services integration, generic server errors, session retry, protected-route redirect, and logout behaviour.
- Avoided unsupported registration, forgot-password, and remember-me controls.
- Added explicit keyboard focus states and reduced-motion behaviour.

## Validation

- Added focused React component tests for branding, fields, password visibility, retry handling, and error feedback.
- Updated the unauthenticated Playwright journey to assert the new login surface and confirm authenticated navigation remains hidden.
- Added deterministic login screenshots at mobile, tablet, and desktop widths, including a stubbed Google button in the screenshot-only browser fixture.
- Kept serious/critical axe-core checks, visible keyboard-focus checks, and horizontal-overflow checks enabled for the login route.

## Boundaries

The redesign changes presentation only. It does not add account registration, password reset, persistent remember-me behaviour, or new authentication endpoints.
