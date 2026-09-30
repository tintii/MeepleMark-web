## ADDED Requirements

### Requirement: The cached app reopens offline
After a successful online visit and completed application-shell caching on a supported secure origin, the app SHALL reopen and reload offline at the root and existing nested app URLs. Offline readiness SHALL only be reported after successful caching. The first visit SHALL NOT be represented as available offline before assets have been cached.

#### Scenario: Offline nested reload
- **WHEN** the app has cached successfully, a saved play URL is opened, and connectivity is disabled before reload
- **THEN** the scoring screen loads and reads the play from IndexedDB

### Requirement: Core workflows remain local
Creating games/players/plays, editing score sheets, entering scores, completing plays, and viewing history SHALL work without network access once the shell is cached. These operations SHALL require neither installation nor an account. User data SHALL remain in IndexedDB independently of shell caches.

#### Scenario: Complete a play offline
- **WHEN** a user creates and completes a templated play while offline
- **THEN** the play and optional collection membership persist and remain visible after an offline reload

### Requirement: Shell updates preserve active work and user data
Application caching SHALL use versioned build assets and restrict navigation fallback to app navigation requests. Missing asset requests SHALL NOT receive HTML. New worker versions SHALL NOT force an active scoring page to reload. Activating an update and cleaning caches SHALL preserve all IndexedDB stores and assets still needed by active clients.

#### Scenario: Update during a draft
- **WHEN** a new build becomes available while a user is entering scores
- **THEN** their page and input remain intact until a safe reload or explicit update acceptance after saving

#### Scenario: Cache cleanup
- **WHEN** an obsolete application-shell cache is safely removed
- **THEN** games, players, plays, and unrelated origin caches remain unchanged

### Requirement: Online deep links have a documented hosting contract
The production build SHALL support same-origin app-route fallback on the selected static host and document HTTPS and fallback configuration. Deep-link verification SHALL include a fresh browser without an existing worker, so cached fallback cannot hide a host configuration error.

#### Scenario: First visit to a nested route
- **WHEN** a fresh online browser visits a nested app URL on a correctly configured host
- **THEN** the app shell loads and renders the corresponding route or a meaningful missing-record state
