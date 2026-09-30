## ADDED Requirements

### Requirement: Visitors can register with username and password
When registration is open, the application SHALL offer Create account using a unique normalized username, a password satisfying the existing password policy, and an optional display name. Registration SHALL require neither an operator-issued code nor email delivery. The server SHALL atomically create the account, initialize sync state, assign the configured non-admin role, and establish a session. Users SHALL remain separate from player records.

#### Scenario: Successful registration
- **WHEN** a visitor submits valid available credentials while registration is enabled
- **THEN** the visitor is signed into a new account with the configured role and an empty private workspace, without automatically creating players or adopting guest records

#### Scenario: Concurrent normalized duplicate
- **WHEN** two requests submit usernames that normalize to the same value
- **THEN** exactly one account is created and the other request receives a useful username-unavailable response without partial account or sync state

#### Scenario: Invalid credentials
- **WHEN** a visitor submits an invalid username or a password outside the supported policy
- **THEN** registration creates no account and the form identifies the invalid field without exposing the password in logs

### Requirement: Registration obeys installation policy
Registration SHALL initially be closed on both fresh installation and upgrade until explicitly enabled. Administrators SHALL be able to open/close signup and select `readonly` or `user` as the signup role, with `user` the initial default. Public metadata SHALL expose the effective signup availability and default role without exposing administrative data. Policy checking and account creation SHALL serialize against policy updates. Public requests SHALL NOT assign or override roles.

#### Scenario: Direct request after closure
- **WHEN** a signup request is processed after an administrator closes registration, including from an outdated browser form
- **THEN** the API rejects account creation while existing sign-in and guest use remain available

#### Scenario: Role escalation attempt
- **WHEN** a public registration request supplies a role or another privileged account field
- **THEN** the server rejects the payload and creates no account

#### Scenario: Read-only registration default
- **WHEN** an administrator changes the signup default to `readonly` and a visitor registers
- **THEN** the new account is read-only and existing accounts keep their assigned roles

### Requirement: Registration uses existing session and abuse protections
Signup SHALL enforce the configured request origin, bounded input and attempt rates before password hashing, Argon2id password storage, and existing expiring cookie/session protections. Login SHALL apply the same username normalization as signup. Deployment configuration SHALL constrain trusted proxy hops so untrusted forwarding headers cannot evade the attempt limit. Authentication responses SHALL be non-cacheable and credentials SHALL NOT appear in ordinary logs or durable browser storage.

#### Scenario: Excessive signup attempts
- **WHEN** a client exceeds the configured registration attempt limit
- **THEN** further attempts receive a rate-limit response before account creation or password hashing

#### Scenario: Foreign-origin signup
- **WHEN** a signup request carries an unauthorized origin
- **THEN** the API rejects it without creating an account or session

#### Scenario: Return after registration
- **WHEN** a registered user signs out and signs in with an equivalent normalized username and the correct password
- **THEN** the application returns to the same account and its existing private records

### Requirement: Existing accounts and assisted recovery remain usable
Existing usernames, passwords, account IDs, setup/recovery codes, owned data and workspace identity SHALL survive upgrade. The normal onboarding UI SHALL present registration and sign-in; existing code redemption SHALL remain available through a secondary activation/recovery flow. Password recovery SHALL retain the assigned role and revoke previous sessions. A disabled account SHALL NOT redeem a setup/recovery code until re-enabled. The UI SHALL explain that password recovery requires administrator assistance while email recovery is unavailable.

#### Scenario: Existing pending activation
- **WHEN** a user redeems a valid pre-upgrade setup code
- **THEN** they can set their password and access the same account with its current role

#### Scenario: Read-only password recovery
- **WHEN** a read-only user redeems a valid recovery code
- **THEN** their password is replaced, previous sessions are revoked, and their role remains `readonly`

#### Scenario: Disabled account recovery
- **WHEN** a disabled account presents a valid recovery code
- **THEN** no password change or session creation succeeds

### Requirement: Account entry works on phones and desktop
Registration, sign-in and recovery SHALL use accessible labelled fields, password-manager autocomplete, keyboard operation, visible validation and submission feedback, and layouts usable at phone and desktop widths. Closed registration SHALL display an explanation and retain sign-in and guest access. Registration SHALL require a server connection without preventing offline guest scoring.

#### Scenario: Signup on a phone
- **WHEN** a visitor registers in a 375 CSS-pixel-wide viewport
- **THEN** fields, validation and submission controls remain usable without page-level horizontal scrolling

#### Scenario: Offline signup attempt
- **WHEN** the server cannot be reached during signup
- **THEN** the UI reports the connection requirement without claiming success or altering guest records
