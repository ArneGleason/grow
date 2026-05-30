# Grow Implementation Plan

## Intent

Build Grow in small reviewable bytes.

Each byte should be:

- understandable in one sitting,
- demoable in the browser,
- easy to review by another agent,
- small enough to revise or throw away,
- aligned with the current first implementation slice.

The first working code should teach whether a bounded space, a visible player, and a little sound feel like the right seed. Do not jump straight to Ollama, SQLite, producer prompts, multi-terrarium exchange, capture, or full session logic.

## Current Technical Recommendation

Start with:

- Vite + TypeScript.
- PixiJS for the terrarium canvas.
- Tone.js for sound and transport.
- Plain TypeScript modules for the first byte, with no React unless the UI becomes complex enough to justify it.
- Playwright or a simple browser smoke check once the app exists.

Keep the app browser-first. Do not add Tauri yet.

## Byte Rules

- One concept per byte when possible.
- Every byte should have acceptance criteria.
- Every byte should leave the app runnable.
- Prefer deterministic behavior at first.
- Keep state in memory until persistence becomes necessary.
- Keep UI controls plain and inspectable.
- Add stable test hooks early, even if tests are minimal.
- Do not add local database files, generated media, or secrets to git.

## First Byte Candidate

The proposed first build byte is:

> A browser page with a bounded terrarium, one visible player, one simple sound source, and start/stop controls.

It should answer:

- Does the terrarium read as a contained space?
- Does a single player feel like a participant rather than a UI decoration?
- Does starting/stopping sound feel clean?
- Is PixiJS + Tone.js pleasant enough as a foundation?

### Scope

Include:

- Vite/TypeScript app scaffold.
- A bounded top-down terrarium area.
- One player marker with a role label, probably `pulse`.
- A small deterministic movement loop.
- A start/stop control.
- A simple Tone.js sound, such as a short pulse every beat.
- A visible status readout: stopped, playing, audio ready, beat/bar, player state.
- Minimal styling that makes the first scene readable.

Exclude:

- Ollama.
- SQLite.
- Producer proxy.
- Natural-language prompts.
- Multiple players.
- Rehearsal/performance modes.
- Capture/export.
- Forks/checkpoints.
- Instrument invention.
- Effects routing.

### Acceptance Criteria

- `npm run dev` starts the app.
- The browser shows a bounded terrarium.
- The player marker is visible and labeled.
- The player moves without leaving the bounds.
- Start begins audio after a user gesture.
- Stop silences audio and stops/pauses transport cleanly.
- Restart does not duplicate scheduled notes.
- A visual beat or status indicator changes while playing.
- There are no console errors during basic start/stop/restart.

## Smaller Alternative

If the first byte above feels too large, split it:

1. App scaffold and bounded terrarium only.
2. Add one moving player.
3. Add Tone.js start/stop and one pulse.
4. Couple the player state to the pulse.

This is slower but makes review easier.

## Suggested Byte Sequence

### Byte 1: Space + One Pulse Player

Build the first byte candidate above.

Review focus:

- app structure,
- visual clarity,
- start/stop reliability,
- sound/visual coupling,
- whether vanilla TypeScript remains comfortable.

### Byte 2: Three Rule-Based Players

Add pulse, bass, and melody players.

Scope:

- Stable role colors.
- Simple deterministic patterns.
- Shared tempo and scale.
- Basic mix balancing.
- Keep all state in memory.

Review focus:

- does it sound musical enough,
- does the screen reveal roles,
- does adding a player stay easy.

### Byte 3: Lookahead Scheduling

Add a tiny lookahead buffer even before Ollama.

Scope:

- Schedule 1-2 bars ahead.
- Show buffer health.
- Retain deterministic fallback patterns.
- Keep stop/restart clean.

Review focus:

- whether the delayed-now model is represented correctly,
- whether scheduling is debuggable.

### Byte 4: Simple Session Modes

Add basic mode states:

- break,
- solo practice,
- rehearsal,
- performance.

No complex player decisions yet.

Review focus:

- avoiding nonstop ambience,
- making silence/rest readable,
- mode transitions and controls.

### Byte 5: Producer Marker, No LLM

Add the producer proxy visually and with a rule-based command interpreter.

Scope:

- Text input.
- Producer marker.
- A tiny command set such as "go to pulse", "stop", "play softer", "follow bass".
- World event display.

Review focus:

- whether natural-language input feels like it enters the world,
- whether the proxy is distinct from a control panel.

### Byte 6: Ollama Health And One Interpretation

Add backend health check for Ollama and one safe prompt-to-action path.

Scope:

- Model tag configuration.
- Health/status UI.
- One producer prompt interpreted into a validated world action.
- Keep rule-based fallback.

Review focus:

- latency handling,
- safety of action schema,
- inspectability of prompt interpretation.

### Byte 7: Minimal Persistence

Add SQLite only after there is something worth preserving.

Scope:

- `sessions`.
- `events`.
- `space_id`, `branch_id`, `session_mode`, `bar`, `scheduled_bar`.
- No snapshots or forks yet.

Review focus:

- whether events are useful for replay/debugging,
- whether schema stays small.

## First Review Request

Before coding Byte 1, ask Claude to review this implementation plan and specifically answer:

- Is Byte 1 still too large?
- Should we split space/player/audio into separate bytes?
- Is vanilla Vite TypeScript better than React for the first byte?
- What should the first player look/sound like?
- What is the smallest acceptance test that proves start/stop does not duplicate audio?
- What should be deferred even from Byte 1?

Use `.agent/handoffs/2026-05-30-copy-paste-claude-implementation-plan-review.md`.
