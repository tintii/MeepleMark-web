## Why

A fresh self-hosted MeepleMark installation currently requires Docker CLI commands, a one-use activation code, and a separate role-promotion command before the owner can administer registration. The first-run ownership flow should instead be completed safely and clearly in the browser.

## What Changes

- Add a dedicated one-time installation-setup model and API, separate from public account registration.
- Expose whether an installation is unclaimed without exposing account details.
- Provide a responsive browser form that creates and signs in the first administrator without terminal commands.
- Atomically close the setup path after the first successful claim and retain public registration as a separately controlled non-admin flow.
- Update self-hosting and user documentation around first-run ownership and safe exposure.

## Capabilities

### New Capabilities

- `ui-first-installation-setup`: One-time browser ownership claim and first-administrator creation for a fresh self-hosted installation.

### Modified Capabilities

None. Public registration remains a separate non-admin capability governed by its existing installation policy.

## Impact

Adds public setup state to installation metadata, a one-time setup endpoint, a first-run browser route, integration/browser coverage, and updated self-hosting, user, persistence, and changelog documentation. No database migration or new dependency is required.
