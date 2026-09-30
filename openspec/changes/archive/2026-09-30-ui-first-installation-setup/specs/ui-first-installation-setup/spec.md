## ADDED Requirements

### Requirement: Fresh installation setup is discoverable
The application SHALL expose whether first-run setup is required as a public boolean without exposing account or deployment details. Setup SHALL be required exactly when the installation contains zero accounts.

#### Scenario: New database
- **WHEN** migrations have completed and the installation contains no accounts
- **THEN** public metadata reports that setup is required

#### Scenario: Existing account
- **WHEN** any account exists regardless of role, password state, or enabled state
- **THEN** public metadata reports that setup is complete

### Requirement: First administrator is created atomically
The setup API SHALL use a dedicated strict request model and SHALL atomically create an enabled, password-initialized `admin`, its sync state, authenticated session, and secret-free audit event only while the installation contains zero accounts. It SHALL reject role input and SHALL NOT use or modify public registration policy.

#### Scenario: Successful ownership claim
- **WHEN** valid setup credentials are submitted to a zero-account installation
- **THEN** one administrator is created, signed in, and able to open administration while normal registration remains closed

#### Scenario: Concurrent ownership claims
- **WHEN** multiple valid setup requests race on a zero-account installation
- **THEN** exactly one succeeds and every later serialized request receives a setup-complete conflict without creating an account

#### Scenario: Existing installation without administrator
- **WHEN** setup is requested after any account exists, even if no usable administrator remains
- **THEN** the request is rejected without promoting or creating an account

### Requirement: First run is completed through the browser
The application SHALL provide a dedicated responsive setup route with labelled username, optional display-name, password, and password-confirmation fields. It SHALL require no terminal account command, setup code, or manual role promotion. Success SHALL open the authenticated administration experience.

#### Scenario: Docker Compose first run
- **WHEN** an operator starts a migrated fresh installation and opens `/setup`
- **THEN** they can create the first administrator and reach registration controls entirely through the UI

#### Scenario: Password confirmation differs
- **WHEN** the setup password and confirmation do not match
- **THEN** the browser shows a validation error and sends no setup request

#### Scenario: Setup is already complete
- **WHEN** a visitor opens `/setup` after an account exists
- **THEN** the page offers sign-in instead of an administrator-creation form

#### Scenario: Unclaimed installation reminder
- **WHEN** a browser visits an unclaimed installation outside `/setup` for the first time
- **THEN** the application shows a dismissible notice linking to `/setup`, and dismissal prevents that installation's notice from appearing again in the same browser

### Requirement: Setup retains authentication protections
The setup endpoint SHALL require the configured origin, enforce bounded request rates before password hashing, validate bounded input, hash passwords with Argon2id, redact credentials from logs, return no-store responses, and establish the existing secure session cookies. The UI and deployment guide SHALL warn operators to finish setup before exposing an unclaimed installation to untrusted traffic.

#### Scenario: Foreign-origin setup
- **WHEN** a setup request carries an unauthorized origin
- **THEN** the API rejects it without creating an account

#### Scenario: Public registration remains separate
- **WHEN** setup is complete and public registration is closed
- **THEN** `/auth/register` remains closed and `/setup` cannot create another account or administrator
