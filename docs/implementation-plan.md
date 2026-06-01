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
- `window.transport.getState()` or an equivalent dev hook exposes transport status, bar, and scheduler debug state.
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

Status: implemented and approved.

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

Status: implemented and approved.

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

Status: implemented and approved.

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

Status: implemented and approved.

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
- `window.transport.getState()` exposes `lookahead.targetBeats`, `minimumBeats`, `scheduledThroughBeat`, `leadBeats`, `pendingSlotCount`, and `health`.
- The inspector and status line show lookahead health, lead beats, scheduled-through beat, and pending slot count.
- Stop/restart clears the timer and scheduled transport events; the smoke test checks the queue returns to zero across rapid cycles.
- The buffer is still deterministic and rule-based. Ollama thinking, buffer underrun behavior, fallback pauses, and session modes remain future bytes.
- Claude's Byte 5 review approved the one-shot lookahead queue with no required fixes. Forward notes: consolidate or rename the duplicated scheduled-count surface before labels pile up, remember that wall-clock `setInterval` can drain in background tabs, and note that pitch/timing are committed ahead while rest/velocity decisions still happen at fire time.
- Byte 5 naming cleanup removed the duplicate top-level `scheduledEventCount`, renamed the surviving lookahead value to `pendingSlotCount`, changed the visible scheduler label to `Pending`, and changed the listening label from `Events` to `Heard` so scheduled future slots and heard past events do not read as the same count.

### Byte 6: Simple Session Modes

Status: started.

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

### Byte 6a: Session Mode State + Controls

Status: implemented and approved.

Add the session mode shell without changing musical behavior yet.

Scope:

- Define canonical mode ids and labels for `break`, `solo-practice`, `rehearsal`, and `performance`.
- Store the current mode in `GrowWorldState`.
- Add a segmented mode control in the top bar.
- Show the current mode in the inspector and status line.
- Expose `window.session.getMode()`, `setMode()`, and `getModes()` for browser inspection.
- Keep playback, lookahead refill, taste, rests, and player posture unchanged in every mode.

Review focus:

- whether the control is readable and compact,
- whether mode state has a natural owner,
- whether mode switching is side-effect-free for now,
- whether this creates a clean hook for Byte 6b behavior.

Implementation notes:

- Claude's Byte 6a review approved the session-mode shell with no required fixes.
- Forward nits: derive the static initial Session label/radio checked state from `DEFAULT_SESSION_MODE`, and share the `setMode + renderWorld` helper used by the DOM listener and `window.session.setMode`.
- Byte 6b needs one new wire from session mode into the transport scheduler, since the transport currently has no channel to read mode state.

### Byte 6b: First Mode Behavior

Status: implemented and approved.

Make the modes do one small thing each, starting with break and rehearsal.

Proposed scope:

- Keep `solo-practice` and `performance` as rehearsal-equivalent no-ops.
- `rehearsal -> break`: stop committing new lookahead slots and let already-queued material drain gracefully.
- `break -> rehearsal`: resume lookahead refill from the current beat.
- Keep committed slots rather than hard-canceling them when entering break.
- Let existing health/posture machinery reveal the drain: `healthy -> thin -> empty`, then player posture ages toward rest.

Implementation notes:

- `src/transport.ts` now reads the current session mode through a handler and exposes `sessionMode` on `window.transport.getState()`.
- `break` leaves the transport running but stops refilling future lookahead slots. Already-scheduled notes/rests are allowed to fire, then the queue reaches `empty`.
- `rehearsal` resumes lookahead refill from the current beat. Stale beats are skipped instead of backfilled.
- `solo-practice` and `performance` intentionally remain rehearsal-equivalent no-ops until later, more specific behavior bytes.
- The static initial mode UI now derives from `DEFAULT_SESSION_MODE`, and DOM mode changes plus `window.session.setMode()` share one helper path.
- The smoke test covers break drain, no new events after drain, rehearsal resume, and continued cleanup.
- Claude's Byte 6b review approved the behavior with no required fixes. Forward note: `sessionMode` on transport state is useful for display, but the scheduling policy should move to a session-layer predicate or explicit mode-policy map before another mode behavior lands.
- Optional feel note from review: during a sustained break, posture can lag the silence by the 8-beat recent-activity window. This is correct for the current model but may want a `winding down` hint or shorter break posture window later.

### Byte 6c: Session Policy Boundary

Status: implemented and approved.

Keep Byte 6 mode behavior from leaking policy into the transport.

Scope:

- Add an explicit session-mode policy surface in the session/world layer.
- Prefer a map such as `mode -> { refillsLookahead }`, or a `shouldRefillLookahead()` predicate owned outside transport.
- Pass the narrow scheduling predicate into transport.
- Keep `sessionMode` on transport state for display/debugging.
- Preserve current behavior exactly: only `break` stops lookahead refill, and all other current modes refill.

Review focus:

- whether new modes now fail safe instead of fail open,
- whether transport stays mechanism-only,
- whether the policy surface is still small enough for the prototype.

Implementation notes:

- `src/session-mode.ts` now owns `SESSION_MODE_POLICIES`, with `refillsLookahead` explicitly set for every current mode.
- The policy map uses TypeScript coverage against `SessionMode`, so adding a future mode requires choosing its refill behavior.
- `src/transport.ts` no longer hardcodes `break` for scheduling. It receives a narrow `shouldRefillLookahead` handler and falls back to refill when no session layer is present.
- `sessionMode` remains on transport state for display/debugging.
- The smoke test includes a fast policy-map assertion and still verifies Byte 6b drain/resume behavior.
- Claude's Byte 6c review approved the cleanup with no required fixes. Claude also empirically checked the compile-time fail-safe: adding a new mode without a policy entry fails TypeScript.
- Forward note: if `SessionModePolicy` gains several fields, consider passing a whole policy object rather than growing a long transport handler list.

## Player Thinking Before Producer

Before adding the producer proxy, Grow should give the players their own slow-thinking creative mechanism.

The producer will be more interesting if it enters a world where players already listen, remember, imagine, and occasionally change course. Otherwise the producer becomes the only source of creative intent.

The next sequence should therefore move Ollama-backed player thinking earlier and push producer work later.

Relevant principle doc: `docs/principles/player-thinking.md`.

### Byte 7: Player Profiles And Thought Seeds

Status: implemented and approved.

Give each player persistent-feeling creative material without calling Ollama yet.

Scope:

- Add player disposition data beyond the current taste profile: steadiness, disruption, caution, novelty, density, responsiveness, and similar small traits.
- Add a few backstory or influence fragments per player.
- Add a deterministic selector that chooses a compact set of thought ingredients from disposition, listening frame, taste evaluation, recent motif, and one or two memory fragments.
- Expose the selected thought context in the inspector or a dev hook.
- Keep sound behavior unchanged.
- Keep data in source or memory for this byte; do not add SQLite yet unless the data becomes painful to review.

Review focus:

- whether the selected context feels musically useful rather than decorative,
- whether the profile/backstory data is compact enough for prompts,
- whether this creates a path to persistence without requiring it immediately.
- whether the deterministic selector stays side-effect-free and does not change playback behavior.

Implementation notes:

- `src/players.ts` now gives each player a compact `thinking` profile with numeric disposition traits and three memory/backstory fragments.
- `src/thought-seeds.ts` assembles deterministic `PlayerThoughtSeed` objects from disposition, selected memory fragments, current listening metrics, taste evaluation, recent self motif, and a focus player.
- Byte 8 should define the full request protocol and additional request levels before any Ollama call is made.
- The inspector shows a `Thoughts` section with each player's focus, motif summary, and selected fragments.
- `window.thinking.getSeeds()` exposes the current thought seeds for browser probes and review.
- Sound behavior, lookahead refill, session behavior, and taste decisions are unchanged by this byte.
- Claude's Byte 7 review approved the byte with no required fixes. Forward notes for Byte 8: promote the current ad-hoc motif excerpt string into validatable phrase-relative `MusicalExcerpt` markup, reconcile or explicitly separate `PlayerDisposition` and `PlayerTasteProfile`, and define whether `PlayerThoughtSeed` is wrapped by or embedded in `PlayerThoughtRequest`.

### Byte 8: Player Thought Protocol, No Ollama

Status: implemented and approved.

Define the contract between a player and the future LLM.

Scope:

- Add a strict `PlayerThoughtRequest` shape.
- Add a strict `PlayerThoughtIntent` response shape.
- Add a compact symbolic `MusicalExcerpt` shape so players can send self, heard, imagined, or group material with a prompt.
- Make `MusicalExcerpt` structured and validatable before adding any mock responder. It should use phrase-relative positions or an equivalent form that can preserve ordering across bar boundaries and round-trip cleanly.
- Include request levels: `in_song_short`, `influence_probe`, `songcraft_plan`, and `memory_digest`.
- Include response levels: `play_intent`, `variation_intent`, `influence_note`, `song_sketch`, and `memory_note`.
- Include allowed action vocabulary such as `rest`, `simplify`, `vary_motif`, `answer_player`, `shift_register`, `change_density`, and `disrupt_for_bars`.
- Include musical fields the app can validate: scale degrees, rhythm cells, target density, duration bars, target player, and confidence.
- Add a validator and a deterministic mock responder that returns one valid intent from a request.
- Add a compiler that can translate the mock intent into the same future scheduling path or into a pending-intent inspection surface.
- Keep the mock responder pure and keyed off the thought seed so Byte 8 remains reproducible before Ollama arrives in Byte 9.
- Decide whether `PlayerDisposition` is separate prompt flavor or derived from taste before disposition drives behavior.
- Decide where `requestLevel` lives so `PlayerThoughtSeed` and `PlayerThoughtRequest` do not develop competing request-level fields.

Review focus:

- whether the schema is actionable enough to change music,
- whether the excerpt markup is compact but musically meaningful,
- whether request/response levels keep quick in-song thoughts separate from slower planning,
- whether invalid or overlarge responses are easy to reject,
- whether this avoids vague prose that the app cannot use.
- whether the mock responder is deterministic and testable without Ollama.

Implementation notes:

- `src/thought-protocol.ts` now owns `MusicalExcerpt`, `PlayerThoughtRequest`, `PlayerThoughtIntent`, request/response levels, allowed action vocabulary, validators, formatting helpers, and a deterministic mock responder.
- `MusicalExcerpt` uses phrase-relative `positionBeats`, preserving order across bar boundaries while keeping `sourceStartBeat` as metadata.
- `PlayerThoughtRequest` wraps a deterministic `PlayerThoughtSeed` and owns `requestLevel`, horizon, constraints, allowed actions, and excerpts. The seed no longer carries `requestLevel`.
- `PlayerThinkingProfile.disposition` is explicitly prompt-facing identity for now; `PlayerTasteProfile` remains the behavior-facing rule profile.
- The mock responder returns valid `imagined` musical ideas but does not schedule them into sound yet. The Thoughts inspector shows request and intent summaries as a pending-intent inspection surface.
- `window.thinking.getRequests()` and `window.thinking.getMockIntents()` expose the protocol objects for browser review alongside `getSeeds()`.
- Byte 8 still avoids Ollama, persistence, producer commands, and audio behavior changes.
- Claude's Byte 8 review approved the byte with no required fixes. Forward notes for Byte 9: tighten validation before trusting model output by checking `scaleDegree < scale.length`, pitch class belongs to the active scale, and `musicalIdea.durationBeats <= maxDurationBeats`; treat `sourceStartBeat` as provenance/debug while `intent.target` owns placement.

### Byte 9: Ollama Health And Session Primer

Connect to local Ollama without letting it drive music yet.

### Byte 9a: Validator Hardening Before Ollama

Status: implemented and approved.

Tighten the thought protocol validators before any Ollama-authored intent is accepted.

Scope:

- Reject `scaleDegree` values outside the active tonal scale.
- Reject pitched steps whose pitch class is outside the active tonal scale.
- Reject steps where `pitch` and `scaleDegree` disagree.
- Reject `PlayerThoughtIntent.musicalIdea.durationBeats` when it exceeds the request horizon.
- Treat `sourceStartBeat` as provenance/debug; `intent.target` owns future placement.
- Keep behavior inspection-only with no Ollama calls and no audio scheduling changes.

Implementation notes:

- `validateMusicalExcerpt()` now enforces scale-degree and pitch membership against `excerpt.tonalContext.scale`.
- `validatePlayerThoughtIntent()` now rejects over-horizon musical ideas, not just over-horizon target durations.
- The smoke test includes intentionally invalid model-like excerpts/intents to prove the new failures are caught.
- The app subtitle is `Byte 9a: thought validation hardening`; protocol hooks and mock intents remain otherwise unchanged.
- Claude's Byte 9a review approved the validator hardening with no required fixes. Forward notes for Byte 9b: specify the excerpt scale-degree convention in the primer, surface validator errors in the manual display, keep deterministic mock fallback, keep `sourceStartBeat`/placement system-owned, and optionally validate pitch-embedded octave against the separate `octave` field.

### Byte 9b: Ollama Health And Session Primer

Status: implemented and approved.

Scope:

- Add a local backend or thin service boundary for `localhost:11434`.
- Add configurable model tag, initially targeting the user's local Gemma 4 31B Ollama model.
- Add health/status UI and dev hooks.
- Add a session primer that tells the model the protocol, allowed action vocabulary, current musical primitives, output schema, and short-response rule.
- In that primer, explicitly define `MusicalExcerpt.steps[].scaleDegree` as a pitch-class index from `0` to `scale.length - 1` with a separate `octave` field. This is different from the app's wrapping `noteFromScaleDegree()` helper.
- Add one manual test call that sends a tiny `in_song_short` thought request and displays raw latency, raw response, parse result, and validation result.
- Surface `validateMusicalExcerpt` and `validatePlayerThoughtIntent` errors directly in the manual test display, preferably with offending values or bounds when practical.
- Add one manual or fixture-level `influence_probe` request that asks for an abstract transferable technique, not a direct style clone or copied melody.
- Keep the deterministic mock responder as the offline/fallback path.
- Document `sourceStartBeat` as provenance/debug in the prompt contract; the system owns source extraction and placement, and the model should use `intent.target` for placement.
- Optionally extend the validator to reject disagreement between a pitch-embedded octave and the explicit `octave` field if this stays small.
- Do not schedule model output into music yet.

Review focus:

- whether the protocol is small enough for 10-15 second responses when possible,
- whether failures are visible and harmless,
- whether the primer creates useful, parseable, bounded responses,
- whether reference/influence requests come back as musical techniques the app can apply.

Implementation notes:

- `src/ollama.ts` now owns the local Ollama boundary for `GET /api/tags` and `POST /api/chat`, using `stream: false` and JSON-format responses.
- The app exposes configurable non-secret local settings through `VITE_GROW_OLLAMA_BASE_URL`, `VITE_GROW_OLLAMA_MODEL`, the inspector inputs, and `window.ollama.setConfig()`.
- The inspector shows health, model, latency, parse result, validation result, fallback status, validator errors, primer summary, and raw response.
- `window.ollama` exposes `checkHealth()`, `runManualThoughtTest()`, `getSessionPrimer()`, `getInfluenceProbePrompt()`, `parseThoughtResponse()`, and current state/config getters.
- The session primer explicitly defines phrase-relative `positionBeats`, scale-degree-as-pitch-class-index plus separate `octave`, short JSON-only output, allowed action vocabulary, influence-probe limits, and system-owned `sourceStartBeat`/placement.
- The manual test sends a current `melody` `in_song_short` request to local Ollama, parses/normalizes the JSON, validates it, and keeps deterministic mock fallback available.
- Model output is not scheduled into audio or lookahead. Transport, taste, session modes, and playback behavior remain unchanged.
- Byte 9b also adds the small optional validator check that rejects pitch-embedded octave disagreement with the explicit `octave` field.
- Claude's Byte 9b review approved the byte with no required fixes. Real local testing on `mac-mini-pro-m4` used `gemma4:26b`, while the MacBook target remains `gemma4:31b`. The real model call safely returned invalid output with a valid mock fallback after roughly 22 seconds, confirming that model output must stay async, delayed-now, and non-blocking.
- Forward notes from review: move automatic model calls behind a local backend proxy, handle reasoning-model `message.thinking`/empty-content behavior, trim the prompt projection, add mocked invalid and unavailable smoke cases, display available Ollama models as a picker, and consider separating health latency from thought latency.

## Reproducible Aliveness Before Automatic Player Loop

Before model output drives music, Grow should add deterministic expressive life that does not depend on Ollama.

Relevant principle doc: `docs/principles/reproducible-aliveness.md`.

The distinction to protect:

- reproducibility means the same state can replay, fork, and debug the same way,
- regularity means the performance is flat or perfectly grid-snapped,
- reproducibility is required,
- regularity is only a feel setting.

The real Byte 9b model probe took roughly 22 seconds on the Mac Mini. That makes the delayed-now/lookahead design more important, not less: the LLM should change future musical intent occasionally, while deterministic player feel keeps the world alive moment to moment.

### Byte 10a: Reproducible Aliveness Principle

Status: implemented.

Make the creative/review lens explicit before adding more behavior.

Scope:

- Add or refine the principle doc for reproducible aliveness.
- Define grid truth vs performed truth.
- Define deterministic heat and expressive mistakes.
- Add review language: deterministic, bounded, inspectable, musically useful.
- Keep this docs-only unless a tiny type placeholder is needed.

Review focus:

- whether this correctly separates reproducibility from regularity,
- whether it gives reviewers permission to protect expressive imperfection rather than only grid purity.

### Byte 10b: Velocity Modulator Bank

Status: implemented and approved.

Add the smallest audible deterministic-aliveness layer.

Scope:

- Add per-player deterministic modulators for velocity/dynamics only.
- Use layered cycles: long beat cycle, medium beat cycle, short beat cycle, and one event-indexed step cycle.
- Cross-couple the cycles lightly so dynamics breathe without obvious repetition.
- Apply bounded velocity shaping at the note-decision or scheduled-event boundary.
- Expose current dynamic factor or modulator summary in an inspector/dev hook.
- Keep note timing, lookahead lifecycle, Ollama, session modes, and pitch choices unchanged.

Review focus:

- whether the music breathes without becoming random,
- whether the modulators are replayable from beat/player/event index,
- whether velocity stays bounded and inspectable.

Implementation notes:

- `src/expression.ts` owns a pure deterministic expression calculator keyed by player, absolute beat, event index, base velocity, and taste velocity multiplier.
- Transport applies the expression at the scheduled-note fire boundary and clamps the final audible velocity to `0..1`.
- `MusicalEvent.expression` records the applied snapshot, and `window.transport.getState().expression.latest` exposes the latest per-player snapshots for inspection.
- The player inspector shows a `Dynamics` row through `player-*-expression` test IDs.
- Byte 10b deliberately does not alter timing, pitch material, lookahead refill, session behavior, or Ollama output.
- Claude's Byte 10b review approved the velocity layer. Forward notes: before audible microtiming, decide a canonical per-player event index at schedule/commit time; consider injecting expression through a handler if transport starts gaining multiple expression call sites; checkpoint per-player expression counters when event-log seek-and-continue lands; and consider nudging melody's short velocity cycle away from a 2:1 lock with its medium cycle.

### Byte 10c: Performed Offset Data Model

Status: implemented and approved.

Prepare micro-timing without breaking ledger truth.

Scope:

- Keep `MusicalEvent.absoluteBeat` as grid/replay/analysis truth.
- Add a separate performed-offset concept, such as `performedOffsetBeats`.
- Compute the offset at schedule/commit time, not fire time, because audible timing must be known when the lookahead slot is queued.
- Keep offset values deterministic, bounded, and derivable from player/material state.
- Decide one canonical per-player event index at schedule time, then have future velocity and timing expression read that same committed index.
- Surface offset in debug data before relying on it musically.
- Do not let performed offsets mutate listening-frame ordering or ledger provenance.

Review focus:

- whether replay can reproduce the same offset,
- whether analysis can stay grid-stable while performance can swing,
- whether tests distinguish grid truth from performed truth.

Implementation notes:

- `src/performed-time.ts` owns a pure deterministic performed-offset calculator.
- Transport now commits a single per-player `eventIndex` at schedule time; both velocity expression and performed timing read that committed index.
- `MusicalEvent.absoluteBeat` remains grid truth, while `MusicalEvent.performedOffsetBeats` and `MusicalEvent.performedTiming` carry the future performed-time data.
- `window.transport.getState().performedTiming.latest` exposes the latest committed timing snapshots, and the inspector renders a debug-only `Offset` row via `player-*-offset`.
- Byte 10c deliberately does not audibly shift notes; synths still fire at scheduled grid time.
- Claude's Byte 10c review approved the data model and cleared Byte 10d. Forward notes: label live debug surfaces so `Dynamics heard` and `Offset queued` are not mistaken for the same musical moment; clamp audible fire time in Byte 10d so a push cannot land in the past or cross a neighbor; and capture transport generator state in future seek-and-continue checkpoints.

### Byte 10d: Audible Microtiming And Physical Difficulty

Status: implemented and approved.

Let players push or drag in a deterministic, player-specific way.

Scope:

- Apply performed offsets at synth fire time only.
- Convert `performedOffsetBeats` to seconds through BPM, then clamp the final fire time to at least `now + epsilon` and within the safe neighbor-crossing bound.
- Derive part of the offset from musical difficulty: leap size, register jump, density, repeated-note pressure, or phrase-ending rush.
- Weight difficulty through disposition traits such as caution, disruption, and steadiness.
- Keep offsets small and bounded.
- Add smoke/probe coverage that proves no transport leak and reproducible offset values.

Review focus:

- whether the timing feels human without corrupting the transport,
- whether hard material reliably produces recognizable player feel,
- whether the ledger remains a trustworthy replay source.

Implementation notes:

- Transport now schedules committed notes at `absoluteBeat + performedOffsetBeats` using Tone tick positions, so the callback itself lands early or late while `MusicalEvent.absoluteBeat` remains grid truth.
- Synth fire time is clamped to at least `now + epsilon` if the browser callback arrives late; scheduling also avoids placing a pushed lookahead slot behind the live transport playhead, and the first beat cannot push before transport time zero.
- `MusicalEvent.performedOffsetSeconds` records the BPM-derived offset, and events retain both `timing:offset-data` and `timing:audible-offset` tags for review.
- `src/performed-time.ts` now folds pitch leap, role-relative register, local density, and disposition into the bounded offset model.
- Smoke coverage now includes a restart replay assertion that compares performed offsets by `playerId:eventIndex`.
- Claude's Byte 10d review approved the audible microtiming layer. Forward notes: choose deliberately whether difficult material should baseline push/rush or drag/slow, record `latestCommittedPitchByPlayer` in future seek-and-continue checkpoint state, consolidate duplicated pitch parsing helpers, and label just-heard dynamics versus next-committed timing debug surfaces.
- Listening note from Arne after live preview: the current timing variation can read as perpetual stumble rather than tempo/groove. Hypothesis: Byte 10d collapsed several timing-feel layers into one per-note offset. A future timing byte should add a hierarchy of ensemble tempo drift, shared groove, per-player pocket, material pressure, and rare stumble/recovery events, so most offsets belong to a coherent pocket and only occasional notes sound like slips.
- Follow-up listening note from Arne's DAW/Bitwig workflow: useful human timing often behaves like a tempo map, not a list of independent offsets. Pin downbeats, add eighth-note control points across the bar, interpolate tempo between points, and let that control-point shape repeat or morph over bars. This should inform the future shared groove surface.

### Future Timing Feel Retune: Groove Before Stumble

Status: planned.

Retune the performed-time model so it sounds like a band with a pocket, not constant individual timing errors.

Scope:

- Add a first-class groove-map representation: anchored bar downbeats plus eighth-note control points for 4/4, with smooth interpolation between neighboring control points.
- Add an explicit shared groove surface: a deterministic bar/phrase-position offset curve that repeats or evolves slowly.
- Add a slow ensemble tempo-drift surface separate from the ledger's grid truth.
- Add per-player groove placement relative to the shared pocket, such as pulse anchoring, bass slightly behind/ahead, melody with looser phrase-edge placement.
- Keep material difficulty as a secondary pressure, not the default source of every offset.
- Make stumble/recovery rare and inspectable, with rate limits or cooldowns.
- Keep all timing outputs deterministic, bounded, and replayable.
- Eventually store groove maps as song/session state so players can practice, tighten, loosen, and discuss a shared feel instead of merely nudging their own notes.

Review focus:

- whether most notes sound intentionally pocketed rather than individually wrong,
- whether tests still prove determinism without requiring exaggerated timing magnitude,
- whether `absoluteBeat` remains the analysis/replay truth while performed timing carries the audible feel,
- whether the timing surfaces are understandable enough for players and future Ollama thoughts to reference.

### Byte 10e: Agitation And Contagion

Status: implemented and approved.

Let one player's heat become something the ensemble hears.

Scope:

- Add a listening-frame metric such as `mix.agitation`.
- Derive it from bounded signals like timing variance, velocity spikes, density pressure, and recent push/drag.
- Let disposition govern contagion: responsiveness catches, caution damps, disruption amplifies, steadiness anchors.
- Surface agitation in inspector/dev hooks.
- Keep visual response out of this byte unless it stays inspectable and behavior-neutral.

Review focus:

- whether agitation builds and releases musically,
- whether contagion is bounded and cannot run away into noise or silence,
- whether player dispositions become load-bearing rather than decorative.

Implementation notes:

- `ListeningFrame.mix.agitation` is now a bounded shared heat metric derived from timing variance, velocity spikes, density pressure, and push/drag pressure.
- Each `ListeningFramePlayer` includes a bounded `contagion` summary shaped by disposition: responsiveness catches, caution and steadiness damp, disruption amplifies, and recent activity makes heat more available.
- The inspector shows `Agitation` in the Listening section and `Heat caught` per player.
- Byte 10e deliberately does not feed agitation into taste, transport, or scheduling decisions yet.
- Claude's Byte 10e review approved the read-only agitation layer. Forward notes: when contagion later feeds behavior, use a ceiling plus slow decay governor rather than a hard per-frame clamp; current agitation is density/velocity-led because the audible microtiming offsets are subtle; agitation and per-player contagion are good candidates for terrarium visual intensity before they become audible behavior drivers.

### Byte 10e-v: Visual Heat

Status: implemented.

Make shared heat visible before it becomes a behavior driver.

Scope:

- Use `ListeningFrame.mix.agitation` to warm the terrarium room.
- Use each player's `contagion.level` to increase halo intensity and scale.
- Expose a read-only terrarium visual snapshot for smoke tests and browser inspection.
- Keep the heat visual-only: no taste, transport, scheduling, Ollama, or audio decisions should read it.

Review focus:

- whether heat is noticeable but not noisy,
- whether visual values are bounded and reset on stop,
- whether the visual hook stays derived from listening-frame state rather than becoming another state source.

Implementation notes:

- `src/terrarium.ts` now accepts a `TerrariumHeatState`, paints a warm room overlay from agitation, and raises each player halo from contagion while preserving note-on flash.
- `window.terrarium.getVisualState()` exposes agitation, room warmth alpha, and bounded per-player halo values for smoke tests.
- Smoke coverage asserts initial quiet visuals, active visual heat while playing, bounded halo values, and reset after stop.
- Byte 10e-v deliberately does not change the musical event ledger, taste rules, lookahead scheduling, or audio output.

### Byte 10f-a: Projected JSON Prompt Adapter

Status: implemented.

Make the manual Ollama probe use the first compact model-facing adapter.

Scope:

- Switch the default model target to `qwen3:4b-instruct-2507-q4_K_M`.
- Add a tiny prompt protocol registry with one active adapter: `projected-json`.
- Replace the full `Request JSON: ...` prompt with a projected request that carries IDs, allowed actions, constraints, focus, disposition, selected memory, listening summary, taste summary, and compact motif steps.
- Use Ollama `format` as a JSON-schema object for the intent shape instead of bare `"json"`.
- Keep the canonical `PlayerThoughtRequest`/`PlayerThoughtIntent` validator path and deterministic mock fallback.
- Surface the selected prompt protocol in the inspector.
- Do not add the backend proxy, model picker, calibration harness, automatic thought loop, or music scheduling yet.

Review focus:

- whether the prompt adapter is a thin model-facing projection rather than a second thought contract,
- whether the schema constrains model output without making the coerce-and-validate path brittle,
- whether the default model remains configurable per machine,
- whether playback and lookahead remain untouched.

Implementation notes:

- `src/thought-prompt-protocols.ts` owns the `projected-json` adapter, projected request shape, compact motif arrays, and response JSON schema.
- `src/ollama.ts` now defaults to `qwen3:4b-instruct-2507-q4_K_M`, sends projected prompts with `think: false`, uses `num_predict: 512`, and records the prompt protocol on thought-test results.
- The inspector shows `projected-json (Projected JSON)` through `ollama-protocol-status`.
- Smoke coverage asserts the mocked `/api/chat` payload uses the qwen model, a schema `format`, projected request text, no full request JSON, no serialized `seed`, and no quoted `sourceStartBeat`.

### Byte 10f-b1: Local Ollama Proxy Route

Status: implemented.

Move the manual probe's network hop behind the local app boundary before automatic slow thinking exists.

Scope:

- Add a tiny Vite dev middleware for `/api/ollama/tags` and `/api/ollama/chat`.
- Keep the browser responsible for prompt construction, JSON-schema request shape, parsing, validation, and mock fallback in this slice.
- Forward only to localhost Ollama targets.
- Rewire `checkOllamaHealth()` and `runOllamaThoughtTest()` to call the same-origin proxy instead of `http://127.0.0.1:11434` directly.
- Keep this manual-probe-only: no automatic slow-thinking loop and no scheduling of model output.
- Do not add SQLite, model picker, calibration, or a production backend server yet.

Review focus:

- whether the proxy is transport-only and not a second thought contract,
- whether the browser no longer performs direct cross-origin Ollama fetches,
- whether localhost target restriction is appropriate for the current local prototype,
- whether this shape can later grow into the SQLite/checkpoint backend without forcing a rewrite of the thought contract.

Implementation notes:

- `vite.config.js` now installs a dev middleware that forwards `/api/ollama/tags?baseUrl=...` and `/api/ollama/chat?baseUrl=...` to the target Ollama server.
- `src/ollama.ts` wraps the existing Ollama chat body in `{ baseUrl, request }` and posts to `/api/ollama/chat`; health checks go through `/api/ollama/tags`.
- Smoke coverage intercepts `/api/ollama/*`, asserts the browser sends the projected qwen request to the proxy, and installs a guard that fails if the browser directly requests `127.0.0.1:11434`.

Review result:

- Claude approved Byte 10f-b1 with no required fixes. The review verified the proxy is transport-only, the browser uses same-origin `/api/ollama/*`, the localhost target guard rejects non-local targets, and a real qwen3 invalid response is safely rejected by the existing validator.
- Forward notes before automatic slow thinking: drop model-authored `pitch` from the model-facing step schema and derive pitch from `scaleDegree` plus `octave` in system code, add upstream abort propagation, and re-host the Vite dev middleware as a standalone local server when persistence/backend work arrives.

### Byte 10f-b2: Model-Safe Pitch Derivation And Proxy Abort

Status: implemented.

Remove duplicate music-theory arithmetic from model output before any automatic slow-thinking loop exists.

Scope:

- Remove `pitch` from the projected JSON response schema used by Ollama.
- Tell the model to emit `scaleDegree` plus `octave` for note steps and never include `pitch`.
- Derive canonical `pitch` in system code during response coercion, before the existing `PlayerThoughtIntent` validator runs.
- Avoid masking invalid output: only derive pitch for integer, in-range scale degrees plus integer octaves, so out-of-range model output still fails validation.
- Propagate browser-side aborts through the Vite proxy to upstream Ollama `fetch()` calls.
- Add a mocked unavailable/proxy-failure smoke path that confirms deterministic mock fallback remains valid and transport stays stopped.

Review focus:

- whether the model-facing schema and prompt have truly removed model-authored `pitch`,
- whether pitch derivation belongs in Ollama response coercion or should move into a shared normalization layer before Byte 11,
- whether the abort propagation is enough for future cancelled slow-thinking requests,
- whether additional invalid-response fixtures are needed before model output can drive music.

Implementation notes:

- `src/thought-prompt-protocols.ts` no longer includes `pitch` in the response step schema.
- `src/ollama.ts` derives pitch with `noteFromScaleDegree()` only after checking the model-provided `scaleDegree` and `octave` are valid integers in range.
- `vite.config.js` attaches an abort controller to proxied requests and passes its signal into upstream Ollama fetches.
- Smoke coverage now checks pitch derivation on a pitchless mocked response and verifies a `503` proxy chat response leaves mock fallback valid.

Review result:

- Claude approved Byte 10f-b2 with no required fixes. The review verified model-authored `pitch` cannot be emitted through the schema, pitch derivation stays guarded, proxy abort propagation cleans up listeners and returns a distinct abort path, and real qwen3 returned 6/6 valid manual thought tests.
- Follow-up before Byte 11 is implemented: the malformed/invalid-200 smoke fixture returns parse `ok`, validation `invalid`, provider `ollama`, deterministic mock fallback valid, and stopped transport.
- Model picker can wait; the current env var, inspector input, and `window.ollama.setConfig()` are enough until tag typing becomes annoying.

### Byte 10f: Ollama Backend Proxy And Prompt Protocol Registry

Status: planned.

Make the manual Ollama probe ready for automatic slow-thinking use without assuming one prompt shape fits every local model.

Scope:

- Grow the local proxy into a fuller backend/proxy before any automatic loop.
- Handle reasoning-model output such as `message.thinking` and empty `message.content`.
- Keep `PlayerThoughtRequest` and `PlayerThoughtIntent` as the canonical internal contract.
- Add a small prompt protocol registry whose adapters transform a canonical thought request into model-facing prompts and normalize responses back into the same validator path.
- Start the registry with `projected-json`, `music-card`, `split-cards`, and a debug/reference `full-json`.
- Default production use to `projected-json` with `qwen3:4b-instruct-2507-q4_K_M` until a calibrated pairing proves better.
- Use Ollama `format` as a JSON schema for the intended intent shape rather than the bare `"json"` string.
- Add a small calibration/bakeoff harness that runs fixed thought fixtures against available models and protocol adapters, then scores parse success, validation success, required-field preservation, latency, and compactness.
- Cache or record the selected model/protocol pairing for later use; do not run calibration inside the musical performance loop.
- Add mocked invalid-response and unavailable-Ollama smoke cases.
- Surface `availableModels` in the UI later when typing model tags becomes annoying; it is not a pre-Byte-11 blocker.
- Surface the selected prompt protocol in the UI or debug inspector.
- Add contextual info/help icons for model, protocol, and calibration controls so the purpose and safe use of each tool remains visible in the app.
- Consider separating health latency and thought latency in the inspector.
- Keep deterministic mock fallback.
- Still do not schedule model output into music in this byte.

Review focus:

- whether the backend/proxy removes browser CORS/environment uncertainty,
- whether prompt protocols remain thin adapters rather than alternate musical contracts,
- whether model/protocol calibration is useful without adding runtime complexity,
- whether the context help explains advanced controls without becoming a second manual,
- whether real local models return parseable bounded JSON more often,
- whether failure remains harmless and visible.

Prompt-shape experiment note:

- `docs/experiments/2026-05-31-thought-prompt-shapes.md` compares the current full JSON prompt with projected JSON, line-card, and split-card shapes.
- The first recommended production change is projected JSON: it preserves every validation-critical field while cutting the representative prompt from about 979 estimated tokens to about 546.
- Live `gemma4:31b` testing showed `think: false` is required for short structured responses; otherwise useful output may sit in `message.thinking` while `message.content` stays empty.
- Live `qwen3:4b-instruct-2507-q4_K_M` and `gemma3:4b-it-q4_K_M` tests showed that prompt tolerance varies by model: projected JSON was valid and fast on both, Qwen handled music-card cleanly, Gemma 3 omitted one required music-card field, and split-cards failed on Qwen but passed on Gemma 3.
- Projected JSON remains the safest first implementation target, but Grow should preserve the ability to calibrate prompt protocol per model because model behavior changes over time.
- Claude's Byte 10d review endorsed the next Ollama path as `qwen3:4b-instruct-2507-q4_K_M` plus structured projected JSON, with deterministic mock fallback preserved.

### Byte 11: One Slow-Thinking Player Loop

Let one player occasionally ask Ollama for a future musical intent.

### Byte 11a: Automatic Melody Thought, No Audio Scheduling

Status: implemented and approved.

Start the slow-thinking loop without letting model output drive playback yet.

Scope:

- Gate the loop to one player, `melody`, and one mode, `rehearsal`.
- Start automatic requests only when the transport is playing and `ollamaHealth.status` is `ready`.
- Keep one request in flight at a time and rate-limit follow-up thoughts by 8 beats.
- Pass an abort signal into `runOllamaThoughtTest()` so stale pending thoughts can be cancelled when playback/mode/material changes.
- Show `thinking` posture while pending and expose loop state in the Thoughts inspector plus `window.thinking.getSlowLoop()`.
- Validate and store the latest accepted, invalid, failed, or discarded thought; retarget late valid thoughts to the next bar in inspection state.
- Keep rule-based playback unchanged. Do not schedule or compile model output into audio yet.

Review focus:

- whether the gating is conservative enough to avoid surprise local model calls,
- whether the loop can run without blocking transport or duplicating requests,
- whether the exposed state is enough to explain accepted, invalid, failed, and retargeted outcomes,
- whether the next slice should compile a bounded rest, density change, or motif variation first.

Review result:

- Claude approved Byte 11a with no required fixes. Live qwen3 review verified no surprise calls before health check, playing+rehearsal+ready gating, one request at a time, pending-to-accepted cycles, thinking posture cleanup, non-blocking transport, and clean discard on gate loss or stop.
- Byte 11b needs an explicit accepted-intent handoff because the transient loop state will be overwritten by the next cycle.
- Extract a `slow-thinking.ts` controller before behavior grows.
- Keep the first compiler narrow: bounded rest or density change before pitch or motif rewriting.
- Commit through the same canonical lookahead path with validator and fallback in front.
- Re-check retargeting at schedule time and add a bar-boundary/no-overwrite thrash guard.
- If thinking eligibility grows past rehearsal, put it in `SESSION_MODE_POLICIES` behind the existing `satisfies` guard instead of adding another mode literal.

### Byte 11b: Compile A Bounded Melody Rest

Status: implemented.

Let the first accepted slow thought make a very small audible change without opening the full motif-rewrite problem.

Scope:

- Extract the slow-thinking loop into `src/slow-thinking.ts` so the controller owns request lifecycle, abort/discard behavior, state reporting, and accepted-intent handoff.
- Keep automatic thinking limited to `melody` in `rehearsal` with ready Ollama health.
- Narrow the automatic slow-loop request to compilable actions only: `rest`, `simplify`, and `change_density`.
- Compile an accepted intent into one future bar-boundary playback window, exposed through `window.thinking.getSlowPlayback()`.
- Apply only bounded rest or thinning through the existing note-decision path; no pitch, motif, key, chord, or section changes yet.
- Do not overwrite an already-active slow-thought playback window.
- Clear pending/active slow-thought behavior on stop, song changes, timing-feel changes, and leaving rehearsal.
- Keep deterministic mock fallback and canonical validation in front of any compiled output.

Review focus:

- whether the accepted-intent handoff is explicit enough before multiple players or repeated thoughts are added,
- whether note-decision-time compilation is an acceptable first audible bridge, or whether the next slice should move this closer to lookahead commit data,
- whether bar-boundary retargeting and no-overwrite are enough to prevent thrashing,
- whether `rest`/`thin` are musically legible without feeling like a bug.

Implementation notes:

- The smoke test now mocks a valid `rest` intent, verifies the slow-loop prompt only offers rest/thin-style actions, checks `window.thinking.getSlowPlayback()`, and waits for a melody `rest` event inside the compiled window.
- The visible subtitle now reads `Slow thinking loop: melody can rest or thin ahead`.
- Claude approved Byte 11b and the accepted-queue cleanup has been applied. `SlowThinkingController` now has a single accepted-intent handoff path: `onAccepted`.

### Coordination Principle: Personal Intents Versus Band Proposals

Small expressive gestures can be local to one player: rest, simplify, density, register, or a bounded motif variation.

Tonal, harmonic, and structural changes should be coordinated. Key changes, mode changes, chord sequences, section forms, and song-level leadership should not arrive as a private melody intent because the rest of the band would not know how to follow.

Future songwriting work should therefore add a separate band-level proposal object with a proposer, affected players, timing, key/mode/scale, chord or section plan, agreement/resistance state, and per-player assignments.

### Byte 12: Song Sketch / Piece Construction Stub

Let players work on a larger song idea without requiring full persistence yet.

Scope:

- Add a symbolic `SongSketch` or `PieceDraft` shape with motifs, roles, sections, cues, and open questions.
- Let one player bring a mock song idea to the group during rehearsal or a future piece-construction mode.
- Let other players attach support ideas, objections, or variations as structured responses.
- Keep output inspectable; no need to perform the whole piece yet.
- Use the same `songcraft_plan` request/response level from the thought protocol.

Review focus:

- whether this feels like songwriting rather than another short variation,
- whether piece data can later be practiced, referenced, and iterated,
- whether the structure stays small enough to persist later.

### Byte 13: Thought Memory And Persistence Prep

Prepare to preserve player identity, backstory fragments, thoughts, and useful motifs.

Scope:

- Decide which player data must persist: disposition, backstory fragments, recent accepted intents, motifs, rejected thoughts, and session summaries.
- Add a minimal local storage or SQLite design spike only if needed for the next byte.
- Prefer an event-log-friendly schema that records thought request, response, validation, scheduled result, and playback outcome.
- Keep heavyweight checkpoint/fork work deferred.

Review focus:

- whether preserved memory will improve future prompts,
- whether persistence stays small and queryable,
- whether it supports replay/debugging without archiving everything.

### Byte 14: Producer Marker, No LLM

Add the producer proxy visually and with a rule-based command interpreter.

Scope:

- Text input.
- Producer marker.
- A tiny command set such as "go to pulse", "stop", "play softer", "follow bass".
- World event display.

Review focus:

- whether natural-language input feels like it enters the world,
- whether the proxy is distinct from a control panel.

### Byte 15: Producer Interpretation

Add one safe prompt-to-action path for the producer, using the existing thought/action protocol where possible.

Scope:

- One producer prompt interpreted into a validated world action.
- Producer requests can land as future cues, not current-frame edits.
- Keep rule-based fallback.

Review focus:

- latency handling,
- safety of action schema,
- inspectability of prompt interpretation.

### Byte 16: Minimal Persistence

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
