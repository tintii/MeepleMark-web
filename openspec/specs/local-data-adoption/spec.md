# local-data-adoption Specification

## Purpose
TBD - created by archiving change self-hosted-accounts-and-sync. Update Purpose after archive.
## Requirements
### Requirement: Existing browser records remain guest-owned until chosen
The storage upgrade SHALL preserve the current version-1 `meeplemark` database as guest data. Signing in SHALL NOT upload or reassign it automatically. An adoption offer SHALL identify the destination account and record counts, with a way to skip and continue account use.

#### Scenario: First login with existing data
- **WHEN** a user signs in on a browser containing previous local plays
- **THEN** those records remain in the guest workspace until the user explicitly chooses adoption

### Requirement: Adoption is a snapshot copy with stable identity mapping
Adoption SHALL copy a stable source snapshot into the selected account while leaving the source available. Source-workspace and record IDs SHALL identify adoption receipts. ID collisions SHALL allocate a persistent mapping rather than overwrite destination records. Related references SHALL use that mapping while names, decimal values, category keys, and embedded template snapshots remain intact.

#### Scenario: Destination ID collision
- **WHEN** a guest record's ID already identifies a different account record
- **THEN** adoption keeps the existing destination record, assigns a stable new ID to the copy, and consistently maps dependent references

### Requirement: Interrupted adoption is resumable without duplication
Accepted adoption mappings and mutation receipts SHALL be recorded on the server. Retrying the same source record snapshot SHALL return the same accepted mapping/result. Progress SHALL distinguish locally staged data from server-acknowledged data. Switching accounts SHALL pause the operation without changing its destination.

#### Scenario: Lost acknowledgement during adoption
- **WHEN** several records upload successfully but the browser loses their responses
- **THEN** restarting adoption recognizes those records and completes remaining work without duplicates

### Requirement: Changed or invalid source records are handled explicitly
Invalid source records SHALL be listed without deletion and SHALL NOT prevent valid records being adopted. A source record changed after prior adoption SHALL NOT silently overwrite its account copy or create a duplicate. The user SHALL be told it changed and can deliberately resolve it or leave it local.

#### Scenario: Corrupt play among valid records
- **WHEN** adoption includes an unreadable play and valid games/players/plays
- **THEN** valid records can complete adoption, the unreadable entry is reported, and all source records remain available

#### Scenario: Changed guest record after adoption
- **WHEN** adoption is run again after a previously adopted guest play was edited
- **THEN** the change is surfaced for explicit resolution and neither copy is automatically overwritten

