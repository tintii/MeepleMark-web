# development-workflow-documentation Specification

## Purpose
TBD - created by archiving change document-development-workflow. Update Purpose after archive.
## Requirements
### Requirement: Changes keep documentation current
The development workflow SHALL evaluate every completed repository change for changelog, README, user-guide, development-guide, architecture, and operations documentation impact, and SHALL update each affected document in the same change set.

#### Scenario: A change affects documented behavior
- **WHEN** a repository change alters user behavior, development setup, architecture, deployment, or operations
- **THEN** the applicable documentation and the unreleased changelog are updated before the change is completed

#### Scenario: A change has no documentation impact
- **WHEN** a completed change does not alter any documented behavior or workflow
- **THEN** the existing documentation remains unchanged rather than receiving a redundant entry

### Requirement: Root README remains concise
The root README SHALL contain the product overview, essential quick start, concise capability summary, and links to detailed documentation, while technical procedures and extended explanations SHALL live under `docs/`.

#### Scenario: Detailed technical guidance is introduced
- **WHEN** a change requires multi-step setup, architecture, verification, deployment, recovery, or agent-workflow guidance
- **THEN** that guidance is stored in an appropriate document under `docs/` and the root README contains at most a concise summary or link when useful

### Requirement: Development workflow is discoverable
The development guide SHALL document the repo-local Codex skill, Ponytail and OpenSpec expectations, changelog policy, setup helper, and relevant verification commands without duplicating the complete skill text.

#### Scenario: A contributor opens the development guide
- **WHEN** a contributor needs to prepare or follow the repository development workflow
- **THEN** the guide identifies the supported setup command and directs development changes through Ponytail, OpenSpec, documentation review, and appropriate checks

