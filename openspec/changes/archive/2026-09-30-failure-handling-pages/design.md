## Context

The React application has a shared shell and page primitives, but route-level failures are presented inconsistently. Unauthorized administration shows a plain paragraph, missing games use isolated messages, unknown routes render no matched page, and there is no React error boundary. Authentication, recoverable form errors, synchronization failures, and offline status already have purpose-built handling and should not be collapsed into generic error navigation.

Because MeepleMark is an SPA, a rendered “403”, “404”, or “500” page communicates the failure category to the user but does not change the HTTP status of the already-served HTML document. Fastify API routes retain their real HTTP status codes and JSON bodies.

## Goals / Non-Goals

**Goals:**

- Give forbidden, missing, and unexpected navigation failures one consistent visual and accessible language.
- Always offer a safe route back to useful application state.
- Preserve authentication redirects and local-first/offline recovery behavior.
- Prevent unexpected React render errors from leaving a blank page or exposing internal details.

**Non-Goals:**

- Replace inline field validation, mutation errors, synchronization feedback, or connectivity notices.
- Convert the application to data-router loaders or server-side rendering.
- Add error reporting, telemetry, stack-trace display, or new dependencies.
- Claim SPA document status codes that the browser did not receive.

## Decisions

### One shared failure-page component

Create a small `FailurePage` component accepting a numeric code, title, explanation, and recovery actions. It uses the existing page, typography, button-link, and color tokens rather than introducing a separate visual system. Codes remain visible text, headings receive normal page semantics, and actions use native links or buttons.

Alternative: separate 403, 404, and 500 components would duplicate layout and make wording/style drift likely.

### Failure categories retain distinct navigation behavior

An authenticated account without the required capability sees a 403 page at the protected URL. A visitor without a session continues to the Account page because signing in can satisfy the request; authentication failure is not presented as authorization failure. Unknown routes and missing route-level resources use the 404 presentation. Existing recoverable errors remain on their current page.

Alternative: redirect every failure to a status-code route loses the requested URL and makes recovery/back navigation less clear.

### A root error boundary owns unexpected render failures

Wrap the application in a minimal class-based React error boundary and render the 500 presentation when a descendant throws during rendering or lifecycle work. The fallback includes Reload and Home actions, logs only through the existing development/browser console behavior, and never prints exception messages or stacks into the page. As React error boundaries do not catch event-handler or arbitrary asynchronous errors, those continue through existing local handlers.

Alternative: a global `window.onerror` handler cannot safely replace the broken React tree and would broaden scope into telemetry and non-render errors.

### Routing and offline boundaries stay explicit

Add a wildcard application route for unknown URLs and include any explicit failure routes in the PWA navigation allowlist. Known missing records reuse the 404 presentation. Offline deep links remain limited to the existing allowlist; the change does not make arbitrary unknown URLs cacheable or risk treating API paths as application navigation.

## Risks / Trade-offs

- A visual status code may be mistaken for the document's network status. → Documentation and implementation comments distinguish SPA presentation from API/HTTP responses.
- An error boundary can hide a recurring defect behind a friendly page. → Keep browser console reporting and provide Reload; do not swallow handled domain errors into the boundary.
- Generic pages could erase useful context. → Use them only for navigation-level terminal states and keep recoverable failures inline.
- A catch-all route could mask misspelled internal links. → Add direct-route browser coverage and keep the requested path visible in the address bar.

## Migration Plan

No data or API migration is required. Add the shared page and boundary, adopt them in protected and missing-resource routes, add the wildcard route and PWA allowlist entries, then deploy through the existing client build. Rollback is removal of the UI-only routing changes.

## Open Questions

None. Network-unavailable and maintenance-mode pages remain outside this change until the application has a server state that can distinguish them reliably from ordinary offline use.
