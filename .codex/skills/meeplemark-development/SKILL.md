---
name: meeplemark-development
description: Develop or maintain the MeepleMark repository using its local setup, Ponytail minimalism, OpenSpec change workflow, verification commands, and changelog convention. Use for feature work, fixes, refactors, configuration, documentation, or development-environment setup in this repository.
---

# MeepleMark Development

Keep repository work minimal, specified, reproducible, and documented.

## Start work

1. Read the affected code and relevant documentation before choosing a solution.
2. Use the repo-local `$ponytail` skill at its default `full` intensity for code, configuration, scripts, and technical design. Its preference for a small diff does not replace accessibility, data integrity, security, tests, or explicit requirements.
3. Check active work with `openspec list --json`.
4. Before implementing product behavior, select the OpenSpec change that covers it. If none does, use `$openspec-propose` to create the proposal, design, specs, and tasks, then use `$openspec-apply-change` for implementation. Archive completed work with `$openspec-archive-change` after its tasks and verification are complete.
5. Do not create an OpenSpec change for read-only investigation or merely running the local environment. Small maintenance work still belongs in OpenSpec when it changes code, configuration, documentation, or shipped behavior.

Follow the OpenSpec artifacts over assumptions. If implementation reveals a different requirement or design, update the relevant artifact before continuing and keep task checkboxes accurate.

## Record changes

Update `CHANGELOG.md` under `[Unreleased]` for every completed repository change. Use the existing `Added`, `Changed`, `Fixed`, `Removed`, or `Security` section that best describes the outcome, adding the section only when needed. Describe the user or developer impact rather than filenames or implementation mechanics, and avoid duplicating an existing entry.

Keep the changelog update in the same change set as the implementation. Purely running checks or starting the development environment does not need an entry.

## Keep documentation current

Evaluate documentation impact for every completed change. Update the affected README or document in the same change set when user behavior, development setup, architecture, deployment, operations, or recovery guidance changes. Do not churn documents that remain accurate.

Keep the root `README.md` concise: product purpose, essential capabilities, the shortest guest quick start, and links to canonical documentation. Put multi-step setup, testing, architecture, API, deployment, recovery, operator, and agent-workflow detail under `docs/`. Prefer updating an existing canonical document over creating a competing guide:

- User workflows and product behavior: `docs/user-manual.md`
- Local setup, checks, repository structure, and contribution workflow: `docs/development.md`
- Production-like deployment and operations: `docs/self-hosting.md`
- Persistence and synchronization architecture: `docs/self-hosted-persistence.md`
- Planned directions: `docs/roadmap.md`

When adding or moving a canonical document, keep the root README documentation index accurate.

## Set up local development

Run the bundled setup script from the repository root:

```bash
.codex/skills/meeplemark-development/scripts/setup-local.sh guest
```

Use `account` instead of `guest` when the task needs the Fastify/PostgreSQL account stack. The script validates prerequisites, installs the locked npm dependencies, and, for account mode, starts and migrates the disposable integration database. It prints the commands to start the required development servers without leaving background application processes behind.

For details beyond routine setup, read `docs/development.md`. Use `docs/self-hosting.md` only for deployment or production-like Docker work.

## Verify proportionally

Choose the smallest checks that prove the change, then run the full relevant suite before completing substantial work:

```bash
npm test
npm run lint
npm run build
```

Use `npm run test:browser` for browser flows or responsive UI changes. Use `npm run test:integration` for account, API, persistence, or synchronization work after starting the integration database. Report unavailable or platform-specific checks accurately; do not mark them passed.

Before handoff, confirm the OpenSpec tasks and artifacts reflect what shipped, `CHANGELOG.md` contains the outcome, affected documentation remains accurate, and `git diff --check` passes.
