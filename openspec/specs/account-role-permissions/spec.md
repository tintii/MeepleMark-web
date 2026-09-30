# account-role-permissions Specification

## Purpose
TBD - created by archiving change public-registration-and-admin-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Accounts have one explicit role
Each account SHALL have exactly one role: `readonly`, `user`, or `admin`. Existing accounts SHALL migrate to `user` without automatic promotion. A read-only account SHALL read its own domain records; a user SHALL also create, edit and delete its own records; an admin SHALL additionally manage the installation. All enabled roles SHALL be able to change their own password and sign out. Roles SHALL NOT link accounts to players or grant cross-account domain access.

#### Scenario: Existing account migration
- **WHEN** a populated installation upgrades
- **THEN** existing accounts retain their IDs, credentials and owned data with role `user`, and none becomes admin automatically

#### Scenario: Admin requests another owner's play
- **WHEN** an admin submits another account's ownership context through a sync or adoption endpoint
- **THEN** the server denies access rather than treating admin status as an ownership override

### Requirement: Server authorization applies to every protected path
Every authenticated API request SHALL resolve current account status and role from authoritative server data. Read-only accounts SHALL be denied domain mutations, adoption, and uploads implementing conflict resolution, including direct API calls and receipt replays. Non-admin accounts SHALL be denied every administrative endpoint. State-changing routes SHALL retain Origin/CSRF checks. Mutation transactions SHALL serialize with role/status changes and recheck write authority before committing changes.

#### Scenario: Forged read-only write
- **WHEN** a read-only account directly requests a put, delete, adoption, or write-receipt replay
- **THEN** the server responds with a machine-readable permission denial without creating domain changes, adoption receipts or mutation receipts

#### Scenario: Demotion races an upload
- **WHEN** a write transaction is serialized after demotion to `readonly`
- **THEN** the transaction is rejected even if the session or browser previously reported `user`

#### Scenario: Admin demotion with an open session
- **WHEN** an admin is demoted and their existing browser next calls an admin endpoint
- **THEN** the server rejects the call without requiring session expiry

### Requirement: Browser actions respect known capabilities
Session metadata SHALL expose the account role and capabilities. Browser navigation, editing actions and repository mutation entry points SHALL honor those capabilities. Missing or unknown capabilities SHALL NOT authorize edits. A known read-only account SHALL remain able to browse its own downloaded records and receive remote data, but SHALL NOT create local account mutations, adoption work or conflict-upload work. Guest workspace scoring SHALL remain independent.

#### Scenario: Read-only edit route
- **WHEN** a read-only user directly navigates to an edit or scoring route
- **THEN** the UI explains the read-only restriction and neither submission nor repository calls create an outbox entry

#### Scenario: Read-only personal security
- **WHEN** a read-only user changes their own password with valid authorization
- **THEN** the change succeeds without granting domain write permission

#### Scenario: Guest use remains available
- **WHEN** a read-only user deliberately switches to the guest workspace
- **THEN** guest scoring works locally without adopting records into or modifying the read-only account

### Requirement: Permission changes preserve pending offline work
The browser SHALL refresh permissions on login, focus, reconnect and before resuming uploads, and propagate role changes across tabs. A write-permission denial SHALL pause uploads/adoption without destructive retries, discard, or false synchronized status. Read synchronization SHALL continue where authorized while preserving pending local versions separately from server versions. Pending work SHALL remain recoverable and SHALL resume only after confirmed write permission returns, using normal revision checks. Offline clients SHALL use the last known permissions without claiming to know remote changes.

#### Scenario: Offline edits followed by demotion
- **WHEN** a user edits offline, is remotely made read-only, and reconnects
- **THEN** the server accepts no new writes, the UI reports read-only access and held local edits, and unsent work remains preserved

#### Scenario: Write access restored
- **WHEN** write access is restored for an account with held edits
- **THEN** the browser confirms the new capability and resumes normal upload/conflict handling without changing ownership

#### Scenario: Role refresh in another tab
- **WHEN** one browser tab learns the account is read-only
- **THEN** other tabs in that account stop creating new account edits and pause uploads while retaining their pending work

