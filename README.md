# Grow

Grow is a new project workspace.

The repo is initialized with the Studio Pattern so future work has a clear place for project memory, handoffs, review notes, local setup details, and GitHub connection planning.

## Current State

- Local git repo initialized on `main`.
- Studio Pattern scaffold added.
- Initial vision and phased plan added in `docs/vision-and-plan.md`.
- GitHub setup notes prepared.
- Byte 1 app scaffold added: bounded PixiJS terrarium, one pulse player, Tone.js start/stop, and transport status hooks.

## First Work

1. Install dependencies with `npm install`.
2. Run the first byte with `npm run dev`.
3. Verify repeated start/stop does not duplicate the beat.
4. Review Byte 1 before adding movement or more players.
5. Wire any future GitHub app/API access using the least-privileged credential model for the job.

## Run

```sh
npm install
npm run dev
```

Default URL:

```txt
http://127.0.0.1:5173
```

## Repository Map

- `AGENTS.md`: fast orientation and working rules for agents.
- `CLAUDE.md`: Claude Code-specific review and collaboration orientation.
- `LOCAL_DEV_NOTES.md`: local commands, ports, setup notes, and gotchas.
- `.agent/`: project memory, session state, handoffs, and workflows.
- `.agent/reviews/`: review notes received through the Studio Pattern relay.
- `docs/implementation-plan.md`: small-byte implementation sequence and first build candidate.
- `docs/principles/`: foundational interaction principles for listening, inner music, and subjective taste.
- `docs/vision-and-plan.md`: the initial creative and technical direction for Grow.
- `docs/time-and-lookahead.md`: delayed-now and lookahead-buffer model for player thinking and playback.
- `docs/session-modes.md`: explicit break, solo practice, rehearsal, performance, reflection, and piece model.
- `docs/producer-proxy.md`: language-driven human avatar that interprets prompts into in-world actions.
- `docs/future-multi-terrarium.md`: future-only notes for multiple spaces/bands and audience/exchange behavior.
- `docs/persistence-checkpoints.md`: proposed SQLite event-log, snapshot, and fork design.
- `docs/github-setup.md`: GitHub repo and integration setup notes.
- `.env.example`: non-secret environment variable template.

## GitHub Connection

This repo is connected to the private GitHub repository [ArneGleason/grow](https://github.com/ArneGleason/grow).

No product-level GitHub credentials are configured yet. See `docs/github-setup.md` if Grow itself later needs to connect to GitHub as an app or API client.
