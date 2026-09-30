# administration-dashboard Specification

## Purpose
TBD - created by archiving change public-registration-and-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Administration requires an enabled administrator
The application SHALL provide an `/admin` dashboard and protected administration API accessible only to enabled accounts with current role `admin`. Navigation visibility SHALL reflect permissions, and the API SHALL enforce them independently. Admin responses SHALL use no-store caching; the browser SHALL NOT persist admin datasets or queue administrative mutations offline. Losing admin permission SHALL remove displayed admin data on the next authorization refresh or rejection.

#### Scenario: Non-admin direct access
- **WHEN** a user or read-only account directly requests an administrative URL or API
- **THEN** no administrative records are returned and the browser displays an access-denied state

#### Scenario: Offline admin action
- **WHEN** an administrator attempts an action without server connectivity
- **THEN** the UI reports that a connection is required and creates no queued operation

### Requirement: Administrators manage account lifecycle
The dashboard SHALL provide a bounded paginated account list, username/display-name search, role/status filters, account details, and summary counts. Administrators SHALL be able to change roles, disable/enable accounts, revoke sessions, issue one-use expiring recovery codes, and delete accounts with typed username confirmation. Disabling SHALL revoke sessions and stop subsequent server access; re-enabling SHALL NOT restore revoked sessions. Account deletion SHALL remove owned live server data through the existing deletion semantics without affecting another account. The UI SHALL explain deletion's effects and the limits of remotely erasing offline copies and retained backups.

#### Scenario: Disable a user
- **WHEN** an administrator disables an account
- **THEN** its sessions are revoked, subsequent server requests are denied, and its saved records remain available for later re-enablement

#### Scenario: Issue assisted recovery
- **WHEN** an administrator requests a recovery code
- **THEN** the new code is shown once in the direct response, expires after 24 hours, invalidates previous codes, and is absent from logs and audit history

#### Scenario: Delete with incorrect confirmation
- **WHEN** an administrator submits an account deletion with the wrong username confirmation
- **THEN** the server rejects deletion and all account records remain intact

#### Scenario: Confirmed deletion
- **WHEN** an administrator confirms deletion of an account that is not the last active administrator
- **THEN** that account's live data and sessions are removed, other accounts remain intact, and the deletion audit event survives

### Requirement: Administrators control registration
The dashboard SHALL display and update registration availability and the default signup role. Only `readonly` and `user` SHALL be accepted as signup defaults. Changes SHALL be persisted in PostgreSQL, enforced by signup transactions, and retained across application-container replacement. Existing accounts SHALL NOT change role when the default changes.

#### Scenario: Close registration
- **WHEN** an administrator saves registration as closed
- **THEN** subsequent signup attempts are denied, existing users can still sign in, and the policy survives a container restart

#### Scenario: Invalid signup default
- **WHEN** an administrator or forged API request selects `admin` as the signup default
- **THEN** the server rejects the setting without changing policy

### Requirement: Administrator bootstrap and recovery are operator-controlled
A documented operator CLI command SHALL explicitly assign any of the three roles using the same role service as the dashboard. First-admin provisioning SHALL require operator action and an enabled account with an initialized password. Public signup SHALL never grant admin based on registration order. Normal signup SHALL require no CLI or setup code after the operator opens registration. Operator commands SHALL retain a documented means to restore administrator access.

#### Scenario: First public registrant
- **WHEN** the first visitor registers through an open signup endpoint
- **THEN** they receive the configured non-admin role even if no administrator account exists

#### Scenario: Promote existing operator account
- **WHEN** the operator assigns `admin` to an enabled password-initialized account using the CLI
- **THEN** the account gains dashboard access without changing its identity, password or owned records, and the action is audited

### Requirement: The last usable administrator cannot be removed
Dashboard and CLI operations SHALL prevent demotion, disabling or deletion of the last enabled admin with an initialized password. The invariant SHALL hold under concurrent operations, using serialized administrator-membership changes. A pending activation or disabled account SHALL NOT count as a usable administrator. Self-demotion SHALL be allowed only when another usable admin remains and SHALL immediately remove the actor's administrative authority.

#### Scenario: Last administrator self-disable
- **WHEN** the only usable admin attempts to disable themselves through the API or CLI
- **THEN** the operation fails with a clear explanation and leaves access intact

#### Scenario: Concurrent administrator removals
- **WHEN** two administrators concurrently attempt changes that would collectively remove all usable admins
- **THEN** at most the change that preserves a usable administrator succeeds

### Requirement: Administrative mutations produce secret-free audit history
Successful administrative account and policy changes SHALL commit an append-only audit event atomically with the mutation. Events SHALL include time, actor/source, target, action and allowlisted before/after information. Audit history SHALL survive deletion of actors or targets and SHALL exclude passwords, credential hashes, session tokens, recovery codes, deployment secrets and game content. Admins SHALL be able to read paginated history but SHALL have no API to edit or delete it.

#### Scenario: Role change audit
- **WHEN** an administrator changes an account from `user` to `readonly`
- **THEN** the role change and a corresponding actor/target/old-role/new-role event commit together

#### Scenario: Audit persistence failure
- **WHEN** an audit event cannot be persisted for an administrative mutation
- **THEN** the mutation rolls back rather than succeeding without a record

### Requirement: Administration is usable on phone and desktop browsers
The dashboard SHALL follow the existing visual style, support keyboard and screen-reader navigation, and provide labelled actions, visible progress/errors, confirmation focus handling, and readable account lists at phone and desktop widths. Narrow screens SHALL avoid page-level horizontal scrolling. Destructive actions SHALL state their target and effects before confirmation.

#### Scenario: Manage an account on a phone
- **WHEN** an admin searches for an account and changes its role in a 375 CSS-pixel-wide viewport
- **THEN** all account information, role controls and result feedback are accessible without horizontal page scrolling

#### Scenario: Keyboard deletion confirmation
- **WHEN** an admin opens and cancels a deletion dialog using a keyboard
- **THEN** focus remains within the dialog while open and returns to its initiating control on cancellation

