# Grow

Grow is a local AI music terrarium.

The basic picture: a few small players live inside a bounded top-down world. They listen to one another, take breaks, rehearse, perform, leave space, repeat ideas, disrupt ideas, and slowly develop musical habits. The first sounds are simple. The larger goal is stranger and more fun: a little browser-first band that can think ahead with local Ollama models, invent or revise short musical gestures, and eventually respond to a human producer avatar speaking ordinary language into the world.

This is not trying to be a polished music generator that plays pleasant texture forever. Silence, hesitation, disagreement, practice, bad ideas, recovery, and the occasional surprisingly good moment are all part of the point.

## Why This Is Public

Grow is also an experiment in how to make software now, when the process is changing as quickly as the tools.

The project is being built with a Studio Pattern:

- Arne is the human in the middle: the person who wants the thing, steers taste, notices drift, routes work, and sparks ideas between agents.
- Codex on `macbook-pro-m5` usually advances the implementation.
- Claude Code on `mac-mini-pro-m4` usually reviews, challenges, sanity-checks, and suggests nearby possibilities.
- Handoffs are intentionally written and manually copied between agents, partly because the friction makes the human read, react, and keep ownership of the direction.

The repo keeps the product and the process visible: implementation bytes, reviews, local experiments, handoffs, principles, and course corrections. Some of that is practical project memory. Some of it is a record of trying to find a fluid working style for a fluid medium.

## What Runs Today

Grow currently runs as a browser app with:

- A PixiJS terrarium canvas with simple player markers.
- Tone.js transport, synth voices, lookahead scheduling, start/stop lifecycle, and audible microtiming.
- Three deterministic players: `pulse`, `bass`, and `melody`.
- A structured musical event ledger and listening frame.
- A looping song form: Verse, Chorus, Verse, Chorus, Bridge, Chorus.
- A deterministic developed chorus melody committed through the lookahead, so the chorus is new material rather than a fire-time pitch trick.
- A deterministic melody scorer and repair pass that A/Bs the raw transformed chorus against a repaired take from each player's perspective.
- A manual local Ollama melody critic that can select among strategy-diverse, already-scored chorus candidates without emitting notes.
- Per-section behavior: grounded verses, lifted/full choruses, and a sparse shifted bridge.
- Session modes: break, solo practice, rehearsal, and performance.
- Player taste rules that can repeat, support, simplify, vary, contrast, or rest.
- Automatic bounded slow-thinking loops for melody and bass when local Ollama is available, with deterministic mock fallback.
- Deterministic "reproducible aliveness": velocity movement and slight performed-time offsets.
- A bounded agitation/contagion signal so the ensemble can expose shared heat before it changes behavior.
- Terrarium visual heat: the room warms with mix agitation and player halos respond to caught heat.
- A strict thought protocol for future Ollama-authored musical ideas.
- A manual local Ollama probe routed through the local app proxy, with projected JSON prompts, validation, and mock fallback.
- A local SQLite persistence shell plus browser-side buffered persistence for low-frequency decisions and musical event records.
- Context help in the inspector so the app can explain its growing set of controls.

The current milestone is Byte 15b-b: after the Byte 14 pivot back to audible composition and Byte 15a's deterministic repair substrate, Grow now lets a local model act as a critic by choosing among scored, app-owned chorus candidates with distinct musical strategies. The model can select and explain; the app still owns the notes, logs the choice, and shows how the selected take compares with the local scorer's best.

## What Is Not Here Yet

These are active directions, not promises that they are already implemented:

- A language-driven human producer avatar.
- SQLite checkpoints, forks, and replayable moments beyond the current append-only event records.
- Best-of capture/export.
- Player-made instruments and effects routing.
- Multiple bands or terrariums observing each other.
- Model/player consensus that selects and remembers preferred song-section developments.

The project is deliberately moving in small bytes so each piece can be heard, seen, reviewed, and changed before the next layer lands.

## How The Toy Thinks About Music

Grow starts from structured musical behavior instead of raw audio analysis.

Players first "hear" notes, beats, roles, density, register, silence, and recent events through a shared listening frame. Raw audio features can come later as a reality check, but the early system is symbolic on purpose: it is easier to inspect, validate, replay, and turn into prompts.

The time model is also deliberate. Grow is not aiming for model decisions on the audio sample clock. Players can think in a delayed-now: observe recent music, ask for a small future idea, validate it, and commit it into a lookahead buffer for a later bar. If thinking is slow, that becomes part of the session rather than a hidden failure.

## Local Model Direction

Grow is designed around local Ollama models so the exploratory loop can run without burning API tokens.

The app currently includes a manual Ollama thought probe and keeps a deterministic mock responder as fallback. Recent local experiments suggest:

- Short structured prompts should use `think: false` when available.
- A projected JSON prompt shape is the safest starting point and is now the default manual probe protocol.
- The default fast model target is `qwen3:4b-instruct-2507-q4_K_M`, while exact tags remain configurable per machine.
- Smaller fast models may be more useful for in-song ideas than larger slower reasoning models.
- Different models tolerate different prompt protocols, so Grow is moving toward a prompt protocol registry and calibration harness while keeping one canonical internal thought contract.

## Run It

```sh
npm install
npm run dev
```

Default local URL:

```txt
http://127.0.0.1:5173
```

Ollama is optional for most of the current app. The browser calls Grow's same-origin proxy, which forwards to the default local Ollama endpoint:

```txt
http://127.0.0.1:11434
```

## Validate It

```sh
npm audit
npm run build
npm run db:smoke
npm run smoke
```

The smoke tests cover the core browser behavior: transport lifecycle, event/listening hooks, session modes, thought protocol surfaces, context help, canvas fit, inspector resizing, and lookahead cleanup.

## Useful Browser Hooks

When the app is running, these globals are useful for inspection:

- `window.transport.getState()`
- `window.transport.getState().songForm`
- `window.listening.getFrame()`
- `window.listening.getEvents()`
- `window.session.getMode()`
- `window.taste.getEvaluations()`
- `window.thinking.getSeeds()`
- `window.thinking.getRequests()`
- `window.thinking.getMockIntents()`
- `window.melodyRepair.getTake()`
- `window.melodyRepair.getCandidate()`
- `window.ollama.runManualMelodyCriticTest()`
- `window.ollama.checkHealth()`
- `window.terrarium.getVisualState()`

They are intentionally boring and inspectable. The system should be weird because the musical behavior gets interesting, not because the state is hidden.

## Repository Map

- `src/`: the running browser app.
- `tests/`: Playwright smoke tests.
- `docs/vision-and-plan.md`: the creative and technical north star.
- `docs/implementation-plan.md`: the small-byte build sequence.
- `docs/principles/`: design principles for listening, session time, player thinking, taste, and reproducible aliveness.
- `docs/experiments/`: research notes, including local Ollama prompt-shape experiments.
- `docs/persistence-checkpoints.md`: proposed event-log, checkpoint, and fork model.
- `docs/producer-proxy.md`: future human avatar direction.
- `.agent/`: Studio Pattern memory, handoffs, reviews, session state, and routing notes.
- `AGENTS.md`, `CLAUDE.md`, `LOCAL_DEV_NOTES.md`: orientation for future AI collaborators.

## Current Shape Of The Code

- `src/players.ts`: durable player definitions.
- `src/world-state.ts`: in-memory world state and musical event ledger.
- `src/transport.ts`: Tone.js lifecycle and lookahead scheduling.
- `src/song-form.ts`: deterministic form timeline and section material.
- `src/melody-scoring.ts`: deterministic chorus scoring, repair candidates, model-critic validation, and perspective priors.
- `src/listening.ts`: listening-frame summaries, mix agitation, and per-player contagion.
- `src/taste.ts`: rule-based subjective choices.
- `src/expression.ts`: deterministic velocity expression.
- `src/performed-time.ts`: deterministic performed-time offsets.
- `src/thought-protocol.ts`: thought request/intent schemas and validators.
- `src/thought-seeds.ts`: compact player thought context.
- `src/ollama.ts`: browser-side Ollama probe orchestration and mock fallback.
- `vite.config.js`: local dev proxy for Ollama `/api/tags` and `/api/chat`.
- `src/terrarium.ts`: PixiJS world rendering.
- `src/main.ts`: app shell, inspector, controls, and browser hooks.

## A Note On Drift

Grow began as a vague image: a terrarium with tiny local AI musicians. The point is not to freeze that image too early. The point is to let the idea become specific through implementation, review, experiments, and taste.

That means this README should keep changing. If it starts sounding too certain, it is probably stale.
