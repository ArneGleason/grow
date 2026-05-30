# Grow

Grow is a new project workspace.

The repo is initialized with the Studio Pattern so future work has a clear place for project memory, handoffs, review notes, local setup details, and GitHub connection planning.

## Current State

- Local git repo initialized on `main`.
- Studio Pattern scaffold added.
- Initial vision and phased plan added in `docs/vision-and-plan.md`.
- GitHub setup notes prepared.
- Product scope, runtime stack, and repository visibility are still to be decided.

## First Work

1. Define the product shape for Grow.
2. Choose the runtime stack and app structure.
3. Confirm the GitHub repo slug and visibility.
4. Add the implementation scaffold.
5. Wire GitHub access using the least-privileged credential model for the job.

## Repository Map

- `AGENTS.md`: fast orientation and working rules for agents.
- `CLAUDE.md`: Claude Code-specific review and collaboration orientation.
- `LOCAL_DEV_NOTES.md`: local commands, ports, setup notes, and gotchas.
- `.agent/`: project memory, session state, handoffs, and workflows.
- `docs/vision-and-plan.md`: the initial creative and technical direction for Grow.
- `docs/github-setup.md`: GitHub repo and integration setup notes.
- `.env.example`: non-secret environment variable template.

## GitHub Connection

No GitHub remote or credentials are configured yet. See `docs/github-setup.md` when it is time to connect this repo or the app itself to GitHub.
