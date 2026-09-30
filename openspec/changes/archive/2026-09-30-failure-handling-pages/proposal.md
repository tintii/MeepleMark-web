## Why

MeepleMark currently handles forbidden routes and missing records with scattered inline messages, has no catch-all page for unknown URLs, and can leave a blank application shell after an unexpected React rendering failure. Users need consistent, useful recovery paths when navigation cannot complete.

## What Changes

- Add a shared, responsive failure-page presentation with an error code, plain-language explanation, and context-appropriate recovery actions.
- Add a dedicated forbidden experience for authenticated users who lack permission, while unauthenticated visitors continue to be directed to sign in.
- Add a catch-all not-found page for unknown application routes and reuse the same presentation for missing route-level records where appropriate.
- Add an application error boundary that renders an unexpected-failure page with safe retry and home actions instead of a blank shell.
- Preserve inline validation, synchronization, connectivity, and API errors when the current page can recover without navigation.
- Add accessible and responsive browser coverage and document the user-visible behavior.

## Capabilities

### New Capabilities

- `failure-handling-pages`: Consistent forbidden, not-found, and unexpected-failure pages with accessible recovery actions and route/error-boundary integration.

### Modified Capabilities

None. Existing authentication, offline, and domain workflows retain their current behavior; this proposal standardizes navigation-level failure presentation.

## Impact

This affects React routing, protected-route rendering, missing route-level resource states, the application root error boundary, shared page styling, browser tests, the user manual, and changelog. It introduces no API, database, deployment, or dependency changes. Browser-rendered failure pages do not change the HTTP status of the SPA document; API endpoints continue returning their existing JSON status codes.
