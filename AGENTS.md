# Instructions for AI Agents

Welcome to Grow.

This repository uses the Studio Pattern: one lead participant advances the project, another participant reviews or continues from a written handoff, and the project keeps lightweight memory surfaces so context survives across sessions.

The human owner is the routing hub by default. Different models, tools, roles, or machines should be chosen deliberately when their differences help with implementation, review, specialist analysis, or blind-spot coverage.

Studio Pattern source:

- Version/date: `2026-05-30 initial scaffold`
- Source repository: `https://github.com/ArneGleason/the-studio-pattern`
- Source commit: `dbbe3e9`
- License: `CC BY-SA 4.0`
- Local adaptation: early Grow project scaffold with GitHub connection notes; product scope and runtime stack are still TBD.

## Local Environment

- Agent/tool: `Codex`
- Machine handle: `macbook-pro-m5`
- Local checkout: `/Users/arnegleason/Documents/Grow`
- Possible standard repo home: `/Users/arnegleason/code/github.com/arnegleason/grow`, if the human owner chooses to move this checkout later.
- Intended reviewer/collaborator: `Claude Code` on `mac-mini-pro-m4`.
- Handle note: machine handles are human-assigned and should not be inferred from OS hostname without confirmation.

## First Reads

1. Read `README.md` for project purpose and normal commands.
2. Read `LOCAL_DEV_NOTES.md` for local workflow memory.
3. Read `docs/github-setup.md` before creating remotes, tokens, OAuth apps, or GitHub Apps.
4. Read `.agent/PROJECT_LOG.md` for recent decisions.
5. Read `.agent/REVIEW_QUEUE.md` for known risks and review focus.
6. If using Claude Code, read `CLAUDE.md`.
7. If resuming or reviewing, read `.agent/session.json` and the latest handoff in `.agent/handoffs/` if one exists.

## Working Rules

- Prefer existing project patterns over new process.
- Keep changes scoped to the task.
- For software/UI work, treat automated testability as part of implementation: semantic controls, stable selectors or test IDs, deterministic fixtures, and narrow persistence writes should be added while the code is fresh.
- Update `LOCAL_DEV_NOTES.md` when you discover a useful command, port, setup step, or recurring gotcha.
- Update `.agent/PROJECT_LOG.md` when you make a meaningful implementation, product, research, or architecture decision.
- Update `.agent/REVIEW_QUEUE.md` when you leave a question, risk, or known weak spot for a reviewer.
- Keep `.agent/session.json` current before suspend, handoff, or model/environment transfer.
- Include machine handles in handoffs when work moves between physical machines or local environments.
- Include explicit `From`, `To`, and `Relay` fields in handoffs so copied text preserves who is speaking, who is being addressed, and where the human-mediated relay sits.
- Write handoffs and review notes for the human owner first; another agent may be the next reader, but the human should be able to understand and route the work.
- Preserve role and perspective boundaries. Do not collapse a reviewer into an implementer, or start direct self-orchestration, unless the human owner explicitly routes the work that way.
- Treat reusable Studio Pattern lessons from Grow as part of the work: record local evidence, update this repo's memory, and route improvements back to `the-studio-pattern` docs or templates when they generalize beyond Grow.

## Validation

Before handoff or review, run the project's normal checks:

```sh
npm audit
npm run build
git status --short --branch
git ls-files --cached --others --exclude-standard | sort
```

This replaced the initial scaffold `find` check because the app stack now creates ignored `node_modules/` and `dist/` trees.

## GitHub Safety

- Do not commit GitHub tokens, OAuth secrets, private keys, webhook secrets, or raw credential exports.
- Keep local secrets in `.env.local` or another ignored file.
- Prefer a GitHub App or OAuth app for product integrations when the requirements are known.
- Use a personal access token only for local development or a narrow, temporary task.
- Confirm repo visibility before creating or pushing to a GitHub remote.

## Project Safety

Project-specific data, credentials, generated assets, deployment targets, and irreversible operations are still TBD. Add warnings here as soon as those surfaces exist.
