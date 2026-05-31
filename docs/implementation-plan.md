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
- Pinned PixiJS and Tone.js package versions once dependencies are added.
- A shared musical event model before adding complex player behavior.
- A minimum listening-frame summarizer before asking players to reason about each other.

Keep the app browser-first. Do not add Tauri yet.

Interaction principles live in `docs/principles/`. The most important near-term principle is: players should hear structured musical behavior first and raw audio features second.

## Byte Rules

- One concept per byte when possible.
- Every byte should have acceptance criteria.
- Every byte should leave the app runnable.
- Prefer deterministic behavior at first.
- Keep state in memory until persistence becomes necessary.
- Keep UI controls plain and inspectable.
- Add stable test hooks early, even if tests are minimal.
- Give every interactive or inspectable element a stable `data-testid` or `id` from day one.
- Prefer explicit musical events and listening frames over trying to infer musical meaning from raw audio buckets.
- Keep subjective player judgments inspectable. A player should be able to say why it thinks the recent music is crowded, sparse, boring, stable, or interesting.
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
- A start/stop control.
- A simple Tone.js percussive sound, such as one short pulse every beat at 90 BPM.
- A visible status readout: stopped/playing, BPM, and bar.
- Stable test hooks for the canvas container, start/stop button, and status line.
- A transport module with explicit `init()`, `start()`, `stop()`, `dispose()`, and `getState()` functions.
- Vite HMR cleanup that stops/cancels/disposes Tone.js state during development reloads.
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
- Player movement.
- Player internal state display beyond role label.
- Distinct `audio ready` status.
- React.

### Acceptance Criteria

- `npm run dev` starts the app.
- The browser shows a bounded terrarium.
- The player marker is visible and labeled.
- Start begins audio after a user gesture.
- Stop silences audio within one beat and stops/pauses transport cleanly.
- Restart does not duplicate scheduled notes after at least five start/stop cycles.
- A visual beat, bar, or status indicator changes while playing.
- The status line documents whether restart resumes from bar 1 or a paused position.
- `window.transport.getState()` or an equivalent dev hook exposes `{ status, bar, scheduledEventCount }`.
- There are no console errors during basic start/stop/restart.
- No `AudioContext was not allowed to start` warning after user gesture.

## Smaller Alternative

If the first byte above feels too large, split it:

1. App scaffold and bounded terrarium only.
2. Add one stationary player.
3. Add Tone.js start/stop and one pulse.
4. Couple the status/bar readout to the pulse.

This is slower but makes review easier.

## Suggested Byte Sequence

### Byte 1: Space + One Pulse Player

Status: implemented and approved.

Review focus:

- app structure,
- visual clarity,
- start/stop reliability,
- sound/visual coupling,
- whether vanilla TypeScript remains comfortable,
- whether Tone.js scheduled objects are disposed correctly,
- whether repeated start/stop cannot duplicate the beat.

### Byte 2a: Player Data Object

Status: implemented.

Make the existing `pulse` participant a data-backed player before adding more behavior.

Scope:

- Define a shared `Player` type.
- Move `pulse` metadata into a player registry.
- Render the terrarium marker from player data.
- Render the inspector from the same player data.
- Keep sound, transport, movement, and listening behavior unchanged.

Review focus:

- whether the player shape is enough for the event/listening layer,
- whether adding bass and melody later can be registry entries,
- whether the renderer avoids hardcoding a single player.

### Byte 2: Musical Event Ledger + Minimum Listening Frame

Status: implemented.

Add the foundation for hearing before adding more players.

Scope:

- Define a shared `MusicalEvent` type for scheduled musical behavior.
- Add an in-memory recent-event ledger.
- Emit events from the existing `pulse` player when its beat is scheduled or triggered.
- Add a summarizer that produces a listening frame for the last 1-2 bars.
- Include tempo, meter, current bar, recent events, player role/state, density, register, and tags.
- Keep raw audio analysis out of scope or as placeholder zeros.
- Expose the frame through a dev hook such as `window.listening.getFrame()` or an equivalent app state hook.
- Optionally show a tiny debug readout with recent event count and listening window.

Acceptance criteria:

- Start/stop still behaves exactly as Byte 1.
- At least one musical event is recorded while the pulse is playing.
- Stopping resets or closes the active event window cleanly.
- The listening frame can be inspected from the browser console.
- Repeated start/stop cycles do not leak duplicate event subscriptions.
- The event/listening types do not assume there will only ever be one player.

Review focus:

- whether the event model is too large, too small, or badly named,
- whether the listening frame is useful without becoming a database,
- whether this creates a clean path to multiple players,
- whether subjective hearing can be added without rewriting the event model.

Implementation notes:

- `src/listening.ts` owns `MusicalEvent`, `ListeningFrame`, and the bounded recent-event ledger.
- `src/world-state.ts` owns mutable per-player runtime state and the event ledger; `Player` remains durable/static identity and setup data.
- The existing `pulse` sequence emits a shared musical event at the scheduled trigger.
- `window.listening.getFrame()` and `window.listening.getEvents()` expose the current listening state for browser inspection.
- The inspector renders player/listening data through DOM APIs rather than unescaped dynamic HTML.

### Byte 3: Three Rule-Based Players

Status: implemented.

Add pulse, bass, and melody players.

Scope:

- Stable role colors.
- Simple deterministic patterns.
- Shared tempo and scale.
- Basic mix balancing.
- Keep all state in memory.
- Add simple movement now that the lifecycle is stable.
- Have each player read the shared listening frame before choosing its next deterministic pattern.
- Keep runtime player state in `GrowWorldState`; do not put transient thinking/performing/resting flags back into static player definitions.
- Stamp emitted `MusicalEvent` timing from the scheduled sequence time or another deterministic scheduled source, not from live `Transport.position`, so the ledger can become a replay source of truth without beat jitter.
- Keep musical-event recording lightweight in the scheduled/audio callback; push inspector and visual updates through `Tone.Draw`, `requestAnimationFrame`, or another UI-safe render loop instead of rebuilding inspector DOM every beat.
- Pass current transport beat into the listening frame once the window needs to represent live silence; until then `silenceRatio` is only a placeholder.

Review focus:

- does it sound musical enough,
- does the screen reveal roles,
- does adding a player stay easy,
- does the listening frame help prevent every player from acting like a separate metronome.
- whether event timing, rendering cadence, and listening-window timing are ready to scale beyond one player.

Implementation notes:

- `src/players.ts` now has `pulse`, `bass`, and `melody` registry entries with distinct roles, positions, colors, and tags.
- `src/transport.ts` schedules three deterministic Tone.js sequences and emits events using scheduled callback time plus snapped transport ticks.
- `src/main.ts` records musical events without rendering synchronously from the event callback; UI rendering is coalesced through `requestAnimationFrame`.
- `src/terrarium.ts` adds a small deterministic visual drift around each player's anchor point.
- `window.listening.getFrame()` now passes `currentBeat` so the listening window can represent live time and silence.

### Byte 3b: Pre-Taste Listening + State Cleanup

Status: implemented and approved.

Small cleanup byte before subjective taste consumes runtime state.

Scope:

- Coarsen `GrowWorldState.syncPlayerStates()` from note-articulation state to musical posture: `performing` should mean recent participation in the last 1-2 bars, while note-on activity becomes a separate visual flash.
- Make `window.listening.getFrame()` side-effect-free. Dev getters should not clear ledgers or mutate `previousTransportStatus`.
- Fix `silenceRatio` so overlapping notes do not double-count active time; compute active interval union or an equivalent zero-active-beat coverage.
- Add key/mode/scale as tonal context in world state before taste and future producer direction need it.

Review focus:

- whether stable posture state is useful enough for taste,
- whether note-on flash preserves the visible liveliness without lying through state labels,
- whether listening-frame getters are safe to call from probes/tests,
- whether tonal context is right-sized and not a full composition engine yet.

Implementation notes:

- `GrowWorldState.syncPlayerStates()` now treats `performing` as recent participation over an 8-beat posture window.
- Note-on emphasis moved into `terrarium.flashPlayer()` and is triggered from the rAF render path, not as the persistent runtime state label.
- `window.listening.getFrame()` derives fresh read-only player state for the returned frame without clearing ledgers or mutating transition state.
- `silenceRatio` now measures the union of active intervals, avoiding overlap double-counting.
- `GrowWorldState` carries default tonal context: `C mixolydian` with scale `C D E F G A Bb`.
- Claude's Byte 3b review approved the cleanup. The review found one visible-deliverable gap: the note-on flash currently drives Pixi alpha above 1.0, which is clamped and therefore effectively invisible on already-opaque performing players.

### Byte 3c: Visible Flash + Tonal Wiring Prep

Status: implemented and approved.

Small follow-up before Byte 4 taste.

Scope:

- Make note-on flash visibly render by using a property with headroom, such as halo scale, tint, and/or a sub-1.0 resting halo alpha.
- Share the 8-beat listening/posture window constant so `listening.ts` and `world-state.ts` cannot drift.
- Start wiring player pitch choices to `GrowWorldState.tonalContext.scale` so tonal context becomes authoritative before taste uses it.
- Keep behavior deterministic, with no producer proxy, Ollama, persistence, or new session modes.

Review focus:

- whether note-on flash is visible without reintroducing posture flicker,
- whether tonal context is becoming source data rather than inspector-only decoration,
- whether constants and helpers land in a natural place without creating premature composition machinery.

Implementation notes:

- `src/music-time.ts` now owns the shared 8-beat recent-activity/listening window constant.
- `src/tonal-context.ts` now owns the default `C mixolydian` context and scale-degree-to-note materialization.
- `src/transport.ts` stores deterministic pattern notes as scale degrees plus octaves, then builds Tone.js note names from the world tonal context at transport start.
- `src/terrarium.ts` flashes note hits with halo alpha headroom and a scale bump rather than relying on alpha values above 1.0.
- The smoke test now checks that emitted event pitch classes belong to the active tonal scale.
- Claude's Byte 3c review approved the byte with no required fixes. Forward notes: runtime tonal-context changes will need pattern re-materialization, and the `TonalContext` type may move into `src/tonal-context.ts` later.

### Byte 4: Subjective Taste, Still Rule-Based

Status: implemented and approved.

Give each player a small deterministic taste profile.

Scope:

- Add simple taste values such as density preference, repetition preference, brightness preference, rhythmic stability preference, and novelty preference.
- Add a player evaluation object that explains a reaction to the current listening frame.
- Let taste influence tiny choices: rest, support, contrast, simplify, repeat, or vary.
- Keep personality language light and musical.
- Do not add Ollama yet.

Review focus:

- whether taste creates musical variety without pretending to be a full psychology simulation,
- whether player reactions remain inspectable,
- whether "good", "bad", "boring", or "interesting" are grounded in listening-frame data.

Implementation notes:

- `Player` data now includes deterministic taste profiles for density, repetition, brightness, rhythmic stability, and novelty.
- `src/taste.ts` derives inspectable `PlayerTasteEvaluation` objects with action, affinity, summary, reasons, and listening metrics.
- `GrowWorldState` owns the current taste evaluations and exposes `window.taste.getEvaluations()` through the app.
- `src/transport.ts` asks for a taste note decision at each scheduled note, allowing tiny deterministic choices such as lower velocity or a structured rest event.
- `src/listening.ts` now computes basic loudness, energy bands, brightness, and density from note events. Rest events remain in the event ledger but do not count as active sound for density or silence math.
- The inspector shows each player's current taste action and short reason.
- Claude's Byte 4 review approved the byte. The required pre-Byte-5 follow-up is to add action dwell or hysteresis so the melody does not hunt around the rest/contrast silence threshold.

### Byte 4b: Taste Action Dwell

Status: implemented and approved.

Small stabilization follow-up before Byte 5 lookahead.

Scope:

- Add a minimum action dwell so taste action changes read as phrasing rather than threshold hunting.
- Keep listening metrics fresh while holding the visible/action-driving taste action.
- Pass the scheduled transport snapshot through the note-event path instead of recomputing it twice.
- Keep all behavior deterministic and keep rest events out of note flashes, posture, and active-sound metrics.

Review focus:

- whether dwell fixes visible action hunting without making players feel stuck,
- whether held actions remain inspectable and explain why they are being held,
- whether the note-event snapshot cleanup preserves exact event timing.

Implementation notes:

- Claude's Byte 4b review approved the dwell with no required fixes before Byte 5.
- The dwell reduces melody hunting and quantizes action changes to roughly bar-length phrasing, but it rate-limits rather than fully settles the rest/contrast threshold oscillation. A future hysteresis band can resolve this if the alternation becomes distracting.
- Forward cleanup: harden the smoke assertion so it checks dwell spacing rather than relying on a short sample window, and replace warm-up detection by summary string with an explicit marker.

### Byte 5: Lookahead Scheduling

Status: implemented.

Add a tiny lookahead buffer even before Ollama.

Scope:

- Schedule 1-2 bars ahead.
- Show buffer health.
- Retain deterministic fallback patterns.
- Keep stop/restart clean.

Review focus:

- whether the delayed-now model is represented correctly,
- whether scheduling is debuggable.

Implementation notes:

- `src/transport.ts` now schedules deterministic note slots into a bounded 8-beat lookahead queue using one-shot Tone transport events instead of long-lived repeating sequences.
- `window.transport.getState()` exposes `lookahead.targetBeats`, `minimumBeats`, `scheduledThroughBeat`, `leadBeats`, `scheduledItemCount`, and `health`.
- `scheduledEventCount` now counts pending scheduled note/rest slots rather than pattern sequencers, so it can detect event accumulation more directly.
- The inspector and status line show lookahead health, lead beats, scheduled-through beat, and pending item count.
- Stop/restart clears the timer and scheduled transport events; the smoke test checks the queue returns to zero across rapid cycles.
- The buffer is still deterministic and rule-based. Ollama thinking, buffer underrun behavior, fallback pauses, and session modes remain future bytes.

### Byte 6: Simple Session Modes

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

### Byte 7: Producer Marker, No LLM

Add the producer proxy visually and with a rule-based command interpreter.

Scope:

- Text input.
- Producer marker.
- A tiny command set such as "go to pulse", "stop", "play softer", "follow bass".
- World event display.

Review focus:

- whether natural-language input feels like it enters the world,
- whether the proxy is distinct from a control panel.

### Byte 8: Ollama Health And One Interpretation

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

### Byte 9: Minimal Persistence

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

Claude reviewed the first implementation plan in `.agent/reviews/2026-05-30-claude-byte-1-plan-review.md`.

Adopted result: build Byte 1 as one stationary pulse player with one percussive beat, explicit Tone.js lifecycle ownership, stable test hooks, and no React.
