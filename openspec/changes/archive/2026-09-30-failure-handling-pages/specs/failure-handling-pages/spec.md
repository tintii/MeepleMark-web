## ADDED Requirements

### Requirement: Failure pages share a clear recovery presentation
The application SHALL present navigation-level failures with a consistent responsive layout containing a visible failure code, plain-language title and explanation, and at least one safe recovery action. The page SHALL use semantic headings, keyboard-operable controls, existing visual tokens, and SHALL avoid page-level horizontal scrolling at supported phone and desktop widths.

#### Scenario: Failure page on a phone
- **WHEN** a failure page is displayed at a 375 CSS-pixel-wide viewport
- **THEN** its code, explanation, and recovery actions remain readable and operable without horizontal page scrolling

### Requirement: Forbidden access distinguishes authorization from authentication
An authenticated account that lacks permission for a protected browser route SHALL see a 403 failure page without receiving protected data. A visitor without an authenticated account SHALL be directed to the existing sign-in experience instead of being told that an authenticated identity is forbidden.

#### Scenario: Non-admin opens administration
- **WHEN** an authenticated `user` or `readonly` account opens `/admin`
- **THEN** the browser retains a safe route state and displays a 403 page with an action back to the application

#### Scenario: Guest opens administration
- **WHEN** a visitor without an authenticated account opens `/admin`
- **THEN** the browser directs them to the Account page where they can sign in

### Requirement: Missing routes and route-level resources show not found
The application SHALL show a 404 failure page for an unknown client route and for a known route whose primary requested resource does not exist. The address bar SHALL retain the failed route, and the page SHALL offer navigation to a known application destination.

#### Scenario: Unknown application URL
- **WHEN** a visitor opens a URL that matches no application route
- **THEN** a 404 page is displayed instead of a blank content area

#### Scenario: Missing game
- **WHEN** a visitor opens a game detail URL whose game does not exist
- **THEN** the application displays the shared 404 presentation with a route back to the collection

### Requirement: Unexpected React failures have a safe fallback
The application root SHALL contain an error boundary that replaces a failed React subtree with a 500 failure page. The fallback SHALL provide Reload and Home recovery actions and SHALL NOT display exception messages, stack traces, secrets, or persisted user data. Handled form, API, synchronization, and connectivity errors SHALL remain in their existing contextual UI rather than becoming 500 pages.

#### Scenario: Rendering throws unexpectedly
- **WHEN** a descendant throws during React rendering or a lifecycle covered by an error boundary
- **THEN** the user sees the 500 fallback with safe recovery actions and no internal error detail

#### Scenario: Recoverable request fails
- **WHEN** a form submission or synchronization request returns a handled error
- **THEN** the current workflow displays contextual feedback without navigating to the generic 500 page

### Requirement: Browser pages do not weaken server error semantics
Failure-page routing SHALL NOT replace or rewrite API error responses. API authorization, missing-route, and unexpected-server failures SHALL retain their existing HTTP status codes and non-cacheable JSON behavior. Browser-rendered SPA failure pages SHALL NOT claim to change the status of an HTML document already served successfully.

#### Scenario: Unknown API route
- **WHEN** a client requests an unknown `/api/` endpoint
- **THEN** Fastify returns its JSON 404 response rather than the browser application shell or visual failure page

#### Scenario: Forbidden API request
- **WHEN** a non-admin directly requests an administration API
- **THEN** the API returns 403 without protected data regardless of the browser failure-page implementation
