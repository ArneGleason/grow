# Grow

Grow is a new project workspace.

The repo is initialized with the Studio Pattern so future work has a clear place for project memory, handoffs, review notes, local setup details, and GitHub connection planning.

## Current State

- Local git repo initialized on `main`.
- Studio Pattern scaffold added.
- Initial vision and phased plan added in `docs/vision-and-plan.md`.
- GitHub setup notes prepared.
- Byte 1 app scaffold added: bounded PixiJS terrarium, one pulse player, Tone.js start/stop, and transport status hooks.
- Byte 2a player registry added: the existing `pulse` participant is now rendered from shared player data.
- Byte 2 listening foundation added: the pulse emits structured musical events into an in-memory ledger, the app exposes a minimum listening frame, and per-player runtime state lives in world state.
- Byte 3 rule-based trio added: pulse, bass, and melody now play deterministic patterns into the shared listening frame with simple visual drift.
- Byte 3b listening cleanup added: player state now represents stable musical posture, listening getters are read-only, `silenceRatio` avoids overlap double-counting, and world state carries `C mixolydian` tonal context.
- Byte 3c tonal/visual prep added: note hits use a visible Pixi-safe halo pulse, posture/listening share the same 8-beat window, and transport patterns materialize notes from tonal scale degrees.
- Byte 4 rule-based taste added: players now have inspectable taste evaluations that can repeat, support, simplify, vary, contrast, or rest based on the listening frame.
- Byte 4b taste stabilization added: taste actions now hold for a minimum beat span so threshold decisions read as phrasing rather than flicker.

## First Work

1. Install dependencies with `npm install`.
2. Run the first byte with `npm run dev`.
3. Verify repeated start/stop does not duplicate the beat or event subscription.
4. Review Byte 4b before adding lookahead scheduling, producer commands, Ollama, or persistence.
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

## Validate

```sh
npm audit
npm run build
npm run smoke
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
- `src/players.ts`: player data types and the initial `pulse`, `bass`, and `melody` registry entries.
- `src/world-state.ts`: in-memory runtime state owner for players and the musical event ledger.
- `src/listening.ts`: musical event and listening-frame types plus the recent-event summarizer.
- `src/taste.ts`: deterministic player taste evaluation and note-decision logic.
- `src/music-time.ts`: shared musical timing constants used by posture and listening windows.
- `src/tonal-context.ts`: default tonal context and scale-degree note materialization.
- `.env.example`: non-secret environment variable template.

## GitHub Connection

This repo is connected to the private GitHub repository [ArneGleason/grow](https://github.com/ArneGleason/grow).

No product-level GitHub credentials are configured yet. See `docs/github-setup.md` if Grow itself later needs to connect to GitHub as an app or API client.
