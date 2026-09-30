# self-hosted-user-accounts Specification

## Purpose
TBD - created by archiving change self-hosted-accounts-and-sync. Update Purpose after archive.
## Requirements
### Requirement: Guest scoring remains available
The application SHALL allow the existing guest workflow without an account or network after shell caching. Sign-in SHALL enable an account workspace and synchronization without automatically adopting guest data. Users SHALL be able to distinguish the active guest/account workspace.

#### Scenario: Continue as guest
- **WHEN** a visitor chooses guest use without signing in
- **THEN** games, players, sheets, and plays can be recorded locally without an authentication request

### Requirement: Users and players are separate identities
An authenticated user SHALL own a private player directory and play history. A player SHALL require no account, email address, or credentials. The system SHALL NOT create or link an account based on a player's name or BGG username.

#### Scenario: Record participants without accounts
- **WHEN** a signed-in user adds Alice and Bob as players
- **THEN** both can participate in plays without creating user accounts

### Requirement: Operators provision and recover local accounts
The initial release SHALL support operator-created accounts through a documented CLI, with unique normalized usernames and single-use, expiring setup/recovery codes. Users SHALL set their own passwords through the application. Passwords SHALL be stored using a maintained Argon2id implementation meeting current OWASP minimum guidance; setup codes SHALL be stored hashed. Public signup and required external identity/email services SHALL NOT be introduced.

#### Scenario: Provision a user
- **WHEN** the operator creates an account and the user redeems its valid setup code
- **THEN** the user can set a password and sign in, and the same code cannot be reused

#### Scenario: Expired setup code
- **WHEN** an expired or consumed setup code is presented
- **THEN** it grants no access and the UI explains how to request a replacement from the operator

### Requirement: Sessions are validated and revocable
Login SHALL establish a server-validated, expiring session using a host-only HttpOnly Secure SameSite cookie in production. The server SHALL enforce Origin/CSRF protections on state changes, bounded login/setup attempts, and generic authentication failures. Password change/reset, account disabling, and logout SHALL revoke the applicable sessions. Tokens, passwords, and setup codes SHALL NOT appear in ordinary application logs or browser local storage.

#### Scenario: Disabled account
- **WHEN** an operator disables a signed-in account
- **THEN** subsequent authenticated API requests fail authorization and the browser pauses sync without losing pending edits

#### Scenario: Cross-origin state change
- **WHEN** a state-changing request lacks valid same-origin/CSRF authorization
- **THEN** the server rejects it without altering account or game data

### Requirement: Logout and switching isolate browser workspaces
Logout SHALL immediately hide account data and stop account sync in all tabs, preserving unsent changes in that account's locked partition unless explicitly discarded. Offline logout SHALL record revocation work for reconnect and SHALL NOT automatically unlock from a surviving cookie. Unlocking after explicit logout SHALL require online sign-in to the same account. Another account SHALL never receive the locked account's cached records or pending uploads.

#### Scenario: Offline logout with pending scores
- **WHEN** A edits scores offline, logs out, and later signs in as B
- **THEN** A's scores remain unavailable to B and are not uploaded as B's data

#### Scenario: Return to the original account
- **WHEN** A signs back in after an offline logout with retained edits
- **THEN** A can recover those edits and resume synchronization under A's identity

### Requirement: Account deletion is distinct from player deletion
The operator SHALL have a documented, explicitly confirmed way to delete an account and its owned server data, sessions, and sync metadata. The process SHALL document backup retention and the inability to erase an offline browser remotely. A reconnecting deleted account SHALL lose server authorization without assigning its local records to another account.

#### Scenario: Delete an account
- **WHEN** the operator confirms deletion of A
- **THEN** A's live server data and sessions are removed while B's records remain unchanged

