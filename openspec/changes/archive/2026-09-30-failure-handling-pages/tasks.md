## 1. Shared failure presentation

- [x] 1.1 Add a responsive, accessible shared failure-page component for code, title, explanation, and recovery actions using existing visual tokens.
- [x] 1.2 Add a root React error boundary that renders the secret-free 500 fallback with Reload and Home actions while leaving handled asynchronous errors contextual.

## 2. Routing and adoption

- [x] 2.1 Replace authenticated protected-route denial with the 403 presentation while retaining Account/sign-in routing for unauthenticated visitors.
- [x] 2.2 Add the wildcard 404 route and adopt the shared 404 presentation for missing primary route resources, preserving useful destination-specific recovery links.
- [x] 2.3 Keep API status behavior unchanged and update explicit PWA navigation handling only for known failure-page routes without allowing arbitrary or API navigation.

## 3. Coverage and documentation

- [x] 3.1 Add Chromium and WebKit coverage for guest versus authenticated 403 behavior, unknown and missing-resource 404 behavior, the error-boundary 500 fallback, recovery actions, keyboard use, and 375px/desktop overflow.
- [x] 3.2 Update the user manual and changelog for the consistent failure and recovery experience without adding technical detail to the root README.
- [x] 3.3 Run lint, unit and browser tests, the production/PWA build, documentation-link and whitespace checks, and strict OpenSpec validation; record any platform-specific limitations accurately.
