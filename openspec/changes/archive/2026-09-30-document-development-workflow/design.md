## Context

The root README currently mixes product introduction, setup, deployment, and repository navigation. Detailed development guidance already has a natural home in `docs/development.md`, and the repo-local Codex skill can enforce that boundary during future changes.

## Goals / Non-Goals

**Goals:**

- Keep the root README concise and useful to first-time visitors.
- Keep detailed setup, verification, architecture, operational, and agent-workflow guidance in `docs/`.
- Make documentation review part of the repo-local development workflow.

**Non-Goals:**

- Reorganize every existing technical document.
- Duplicate full skill instructions in project documentation.
- Change application behavior or deployment configuration.

## Decisions

- Add a short development-workflow section to `docs/development.md`, because it already owns contributor setup and repository structure.
- Keep only concise links and essential quick-start commands in `README.md`; link to the development and self-hosting guides for details.
- Put the maintenance rule in the repo-local skill so future changes evaluate README and documentation impact as part of completion.

## Risks / Trade-offs

- Documentation can still drift if a change is completed without loading the skill. → Keep the policy visible in `docs/development.md` as well as the skill.
- An overly strict README limit could hide essential onboarding information. → Retain the product summary, basic guest quick start, documentation index, and project status in the root README.
