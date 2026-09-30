# docker-self-hosting Specification

## Purpose
TBD - created by archiving change self-hosted-accounts-and-sync. Update Purpose after archive.
## Requirements
### Requirement: A self-contained Compose deployment is provided
The release SHALL include a production application Dockerfile, Compose configuration for application/PostgreSQL/migrations, a non-secret configuration example, and operator instructions. The app SHALL serve frontend and API on one origin behind a documented HTTPS proxy. No managed database, email service, or external identity provider SHALL be mandatory.

#### Scenario: Fresh self-hosted installation
- **WHEN** an operator follows the documented build/configuration/migration/provisioning steps on a clean supported host
- **THEN** a user can sign in and synchronize a play from one browser to another using only the configured installation

### Requirement: Data and secrets have explicit lifecycles
PostgreSQL data SHALL use persistent storage independent of application containers. Database ports SHALL not be publicly published by default. Secrets SHALL be supplied at runtime, excluded from image layers and committed examples. Application container replacement SHALL preserve accounts and user records.

#### Scenario: Replace application containers
- **WHEN** application containers are stopped and replaced while retaining the database volume
- **THEN** accounts, games, players, templates, memberships, and plays remain readable

### Requirement: Migrations and readiness govern startup
SQL migrations SHALL be versioned, checksum-tracked, and run through an explicit serialized operation. Application readiness SHALL require a reachable compatible database schema. A failed migration SHALL prevent the new application from accepting traffic and SHALL not silently reset user data.

#### Scenario: Migration failure
- **WHEN** an upgrade migration fails
- **THEN** startup reports the failure, the application remains unready, and operator recovery instructions preserve the database

### Requirement: API traffic is excluded from shell caching
Authentication/API responses SHALL use no-store caching and SHALL not be served from the application-shell cache or SPA fallback. Account/conflict navigation routes SHALL support normal online direct entry and cached offline navigation where meaningful. Protocol mismatch SHALL pause synchronization with a useful update message while preserving local changes.

#### Scenario: Missing API route
- **WHEN** a browser requests a nonexistent API endpoint online or offline
- **THEN** it receives an appropriate API/network error, never cached HTML or another account's response

### Requirement: Backup restore and upgrade procedures are tested
Operator documentation SHALL cover logical database backup, protected backup storage/retention, restore into a clean deployment, installation identity/recovery-epoch handling, session revocation, and schema-compatible rollback. Normal upgrade instructions SHALL not delete volumes. Restore verification SHALL compare representative accounts and domain records and exercise a browser with newer local work.

#### Scenario: Restore a backup
- **WHEN** a backup is restored into an isolated deployment following the documented procedure
- **THEN** representative data evaluates identically, sessions are revoked, and stale browser sync state triggers explicit recovery

### Requirement: Deployment claims are based on runnable verification
Release verification SHALL include fresh setup, two-browser sync, offline reconnect, account isolation, container replacement, and backup restore against the production Compose topology. If Docker or required browser infrastructure is unavailable, the result SHALL be reported as unverified rather than marked passed.

#### Scenario: Missing container runtime
- **WHEN** the implementation environment cannot run the Compose acceptance checks
- **THEN** the verification record identifies those checks as outstanding and does not claim the self-hosted release is fully verified

