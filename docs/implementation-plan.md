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

Status: implemented and approved.

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

Status: implemented and approved.

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
- The visible subtitle was updated during this arc and is revised again as additional thinking players join.
- Claude approved Byte 11b and the accepted-queue cleanup has been applied. `SlowThinkingController` now has a single accepted-intent handoff path: `onAccepted`.

### Byte 11c-a: Bounded Melody Register Shift

Status: implemented and approved.

Let a slow thought move the existing melody line into a nearby register without adding notes or rewriting the motif.

Scope:

- Add `shift_register` to the automatic melody slow-thinking allowed actions.
- Extend the note-decision path with an optional pitch override and decision tags.
- Derive a bounded one-octave register shift from the accepted intent's musical idea compared with the request source excerpt.
- Apply the shift only inside the accepted future playback window and only to existing scheduled melody notes.
- Keep pulse and bass untouched.
- Keep pitch class unchanged, so shifted notes remain in the active tonal context.
- Surface the active register shift through `window.thinking.getSlowPlayback()` and the Thoughts inspector.
- Do not add, remove, or reorder scheduled note slots.

Review focus:

- whether allowing `shift_register` to play an already-scheduled melody note that taste would otherwise rest is acceptable,
- whether pitch override belongs in `TasteNoteDecision` for this byte or should become a separate thought-decision layer soon,
- whether the register-shift derivation from source/target octave is too implicit for future model output,
- whether the first material-injecting action should still wait for the lookahead commit path.

Implementation notes:

- Smoke coverage now includes a mocked valid `shift_register` intent, verifies `registerShift` is `+1`, and waits for shifted melody note events tagged `thought:shift_register` and `register:+1`.
- Fire-time register shift is intentionally allowed only because it modifies scheduled notes. Future note injection or motif rewrites still need the commit/lookahead path.
- Claude approved Byte 11c-a. The "rescue" behavior is acceptable as a bounded precedence rule: inside a shift-register window, a slow thought may un-suppress an already-scheduled melody slot that taste would otherwise rest, softened to keep it from becoming a hidden note-injection path.
- Forward note: replace the implicit source/target octave inference with an explicit `registerDelta` field soon, so the model can state direction and choose `0` instead of every shift defaulting to one octave when the inferred delta is flat.
- Forward note: when event-log/replay work lands, record grid pitch versus performed pitch structurally, not only through `register:+/-N` tags.

### Byte 11c-b: Explicit Register Delta

Status: implemented and approved.

Clean up the Byte 11c-a register gesture so the model states the intended register move directly.

Scope:

- Add optional `registerDelta` to `PlayerThoughtIntent`.
- Require `registerDelta` only when `action === "shift_register"`.
- Bound `registerDelta` to `-1`, `0`, or `1`; reject stray register deltas on other actions.
- Teach the Ollama primer and projected JSON prompt/schema about `registerDelta`.
- Coerce model-authored `registerDelta` through the existing canonical parse/validate path.
- Remove the hidden average-octave inference and delta-zero fallback from the slow playback compiler.
- Preserve Byte 11c-a playback behavior for `registerDelta: 1`: existing melody slots shift up one octave and remain tagged `thought:shift_register` plus `register:+1`.

Review focus:

- whether `registerDelta` should remain top-level or eventually move into an action-specific modifier object,
- whether the schema should become conditional when the Ollama format path can reliably express `required when action is shift_register`,
- whether allowing `registerDelta: 0` as a valid no-op is useful for model restraint,
- whether the old `accepted.request` field should be kept for upcoming decisions or pruned now that register inference no longer reads it.

Implementation notes:

- Smoke coverage now checks the prompt/schema mention `registerDelta`, validates missing/out-of-range/stray register deltas, accepts `registerDelta: 0`, and keeps the audible register-shift smoke passing with explicit `registerDelta: 1`.
- Claude approved Byte 11c-b and verified build/audit/diff/smoke. This resolves the implicit inference note from 11c-a: missing `registerDelta` is invalid rather than guessed.
- Live qwen finding: the model can choose `shift_register` but omit `registerDelta`, so the intent is rejected and the deterministic fallback remains safe. Do not restore inference/defaulting; improve model compliance instead.
- Claude recommended pruning `AcceptedSlowThought.request` because it was only used by the removed register inference. That prune has been applied with the review merge.

### Byte 11c-c: Register Delta Compliance

Status: implemented and approved.

Raise real-model land rate for `shift_register` without weakening the validator.

Scope:

- Add a projected JSON schema conditional so `registerDelta` is required when `action` is `shift_register`.
- Verify whether Ollama/llama.cpp honors that conditional in structured output.
- Add a compact concrete `shift_register` example to the primer/prompt.
- Tell the model the field must be top-level and must not be mentioned only in rationale.
- Keep missing `registerDelta` invalid; use deterministic fallback rather than inferring/defaulting.

Review focus:

- whether conditional schema is actually enforced by the local model stack,
- whether an example improves real qwen compliance without bloating every request,
- whether the validator remains the canonical guard.

Implementation notes:

- `ThoughtIntentJsonSchema` now supports an optional `allOf` array, and the projected JSON schema emits an `if action const shift_register then required registerDelta` condition when `shift_register` is an allowed action.
- The `registerDelta` property now uses `enum: [-1, 0, 1]` and an explicit top-level-field description.
- A minimal live qwen probe showed conditional schema plus a plain example still omitted `registerDelta` while mentioning it in the rationale. Strengthening the prompt to say "top-level registerDelta" and "Do not only mention registerDelta in rationale" made the same model emit `registerDelta: 1`.
- Smoke coverage asserts the prompt/schema include the conditional and concrete top-level example.
- Claude approved Byte 11c-c and verified live qwen3 compliance improved from rejected missing-delta output to 3/3 accepted `shift_register` intents with valid `registerDelta`. The schema conditional is useful self-documentation and future-proofing, but the prompt wording plus validator/fallback remain the durable guards because llama.cpp-style grammar support generally ignores `if`/`then`.

### Byte 11d: Second Thinking Player

Status: implemented and approved.

Let bass join the slow-thinking loop while keeping the audible compiler conservative.

Scope:

- Instantiate slow-thinking controllers for `melody` and `bass`.
- Keep one local model request in flight globally, while allowing each thinking player to keep its own loop state.
- Stagger bass's first thinking opportunity so it gets a clean first turn before melody's second cycle.
- Replace the singleton active slow-thought playback window with a per-player playback map.
- Keep melody's existing `rest`/`simplify`/`change_density`/`shift_register` lane.
- Restrict bass to `rest`/`simplify`/`change_density` for now; no bass register shift or pitch-changing behavior in this byte.
- Keep the same validator/fallback, bar-boundary, max-duration, no-overwrite-per-player, and lifecycle cleanup guardrails.
- Expose plural debug surfaces: all slow loops and all active slow playbacks, while preserving no-argument melody/default helpers.

Review focus:

- whether the shared one-request-at-a-time evaluator is enough protection before automatic real-model work has more players,
- whether bass should stay density/rest-only until a future bass-specific pitch/register design,
- whether the per-player playback map correctly allows independent future windows without one player clobbering another,
- whether the singleton `SlowThoughtPlayback` debug helper should remain for compatibility or be removed once reviewers switch to the plural API.

Implementation notes:

- `SlowThinkingController` now supports `initialDelayBeats`, used by `main.ts` to stagger bass's first request.
- `window.thinking.getSlowLoop(playerId?)`, `getSlowLoops()`, `getSlowPlayback(playerId?)`, and `getSlowPlaybacks()` expose the widened state for smoke tests and review.
- Smoke coverage now verifies melody and bass can both accept mocked Ollama thoughts, that bass's projected request excludes `shift_register` from `allowedActions`, that both active playback windows are retained at the same time, and that each player's audible future window lands on that player only.
- Claude approved Byte 11d and verified live qwen3 kept one pending slow-thinking lane globally, produced independent melody/bass windows, and cleared both lanes through lifecycle transitions.
- Forward live finding: qwen3 can leak `registerDelta` onto non-shift bass actions because the projected schema still listed the optional property even when `shift_register` was not allowed. This is safe because the validator rejects it, but it lowers bass's real-model valid rate.

### Byte 11e: Register Delta Schema Gating

Status: implemented and approved.

Prevent `registerDelta` prompt/schema emphasis from bleeding into non-shift player lanes.

Scope:

- Keep the strict validator unchanged: `registerDelta` is still required for `shift_register`, bounded to `-1 | 0 | 1`, and rejected on every other action.
- Keep the existing `if action is shift_register then require registerDelta` conditional for shift-capable requests.
- Omit the `registerDelta` schema property entirely when `request.allowedActions` does not include `shift_register`.
- Preserve `additionalProperties: false`, so non-shift lanes such as bass cannot emit `registerDelta` through the structured-output format.
- Do not change melody behavior, slow-thinking scheduling, playback compilation, or the musical validator.

Review focus:

- whether removing the schema property for non-shift lanes is enough to stop qwen from leaking `registerDelta` into bass `simplify`/`change_density`,
- whether melody's shift-register response format still includes the property and conditional,
- whether the prompt wording should also become action-set-aware later, or whether schema gating is sufficient for this byte.

Implementation notes:

- The independent melody/bass smoke now asserts the proxied bass Ollama `format` contains neither `registerDelta` nor `shift_register`.
- Focused validation so far: `npm run build` and `npm run smoke -- -g "independent melody and bass"` pass.
- Claude approved Byte 11e and confirmed the change mirrors the earlier pitch-drop pattern: non-shift lanes now structurally cannot emit `registerDelta` through the schema, while the validator still rejects any stray field.
- Forward note resolved in Byte 12a: the `registerDelta` prompt sentence should be gated on the same `allowsRegisterShift` condition so bass no longer sees a prompt for a contract its schema does not expose.

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

### Byte 12a: Inspect-Only Song Sketch Stub

Status: implemented and approved.

Start the song-sketch arc with a visible band-level draft, not a private player intent and not a playback driver.

Scope:

- Gate the `registerDelta` prompt sentence in both the projected user prompt and Ollama system primer so it appears only for shift-capable requests.
- Add an inspect-only `SongSketch` model with draft status, proposer, affected players, tonal context, sections, chord plan, per-player assignments, and open questions.
- Generate a deterministic sketch from the selected song material, current tonal context, and current player roster.
- Render the sketch in a new Song Sketch inspector section.
- Expose the sketch through `window.song.getSketch()` for browser review.
- Do not change transport, lookahead, slow-thinking scheduling, validators, or audible playback.

Review focus:

- whether the sketch is clearly band-level and not another private melody intent,
- whether the fields are enough to support later practice/reference/iteration without becoming persistence-heavy,
- whether the modal chord plan and player assignments are useful as a first songwriting surface,
- whether the prompt cleanup fully removes `registerDelta` instruction text from non-shift model calls while preserving melody shift-register guidance.

Implementation notes:

- Focused smoke now verifies bass slow-thinking calls omit `registerDelta` from system prompt, user prompt, and response schema, while melody shift-capable calls still include the rule.
- General app smoke verifies the new inspector section and `window.song.getSketch()` expose the draft title, proposer, sections, assignments, questions, source song, affected players, and tonal context.
- Claude approved Byte 12a and verified the sketch is pure, inspect-only, band-level, and playback-neutral.
- Forward note: the sketch is currently song-label-deep, not song-material-deep. Lantern, Switchback, and Glass get identical section/chord/assignment skeletons except for id/title. Settle this before Byte 12b builds proposal/response on top.
- Forward note: choose one chord vocabulary for the sketch. Current chord plans use note roots, while the empty-scale fallback uses roman numerals; also avoid treating `scale[6]` as always flat-seven if future modes add a natural leading tone.

### Byte 12b-a: Song-Material-Deep Sketch

Status: implemented and approved.

Make the inspect-only `SongSketch` reflect the selected song's actual material before adding any proposal/response behavior.

Scope:

- Derive section root plans from the bass pattern's scale-degree onsets rather than fixed tonal-context indices.
- Store chord plans as roman-root numerals, with root degrees retained as structured provenance.
- Resolve root degrees to current note names only in the inspector display.
- Derive per-player assignment density from source pattern slots.
- Keep musical content deterministic and independent of `currentBeat`; use current beat only for `createdAtBeat` metadata.
- Memoize the current sketch by song, tonal context, and roster so pattern scans do not run every render frame.
- Keep the sketch read-only over `SONG_MATERIALS`.
- Do not touch playback, transport, slow-thinking, validators, Ollama, persistence, or scheduling.

Acceptance criteria:

- Lantern, Switchback, and Glass sketches differ structurally beyond id/title.
- Glass melody assignment density is lower than Lantern's.
- Sketch root degrees are a subset of the selected song's bass pattern degrees.
- Chord plans use one canonical stored vocabulary.
- `npm run build`, `npm run smoke`, `npm audit`, and `git diff --check` are green.

Implementation notes:

- `SongSketchSection.chordPlan` now stores roman roots such as `I`, `V`, and `bVII`.
- `SongSketchSection.rootDegrees` records the source scale-degree roots so tests and future tools can verify provenance without parsing display text.
- `SongSketchAssignment.density` records pattern-derived player density; assignment prose can mention sparse/moderate/active without tests depending on that wording.
- The inspector renders roman roots with note-name translations, for example `I(C)-V(G)`, while keeping the canonical sketch data key-independent.
- Claude approved Byte 12b-a and verified live sketches differ by song: Lantern, Switchback, and Glass now have distinct harmonic plans and pattern-derived densities while staying inspect-only.
- Forward notes: resolve the harmonic source by player role instead of literal `"bass"` if the roster changes; keep split length and section duration aligned if future patterns diverge in loop length; deep-clone, freeze, or document cached nested arrays before later proposal/response code can mutate returned sketches.

### Byte 12b-b: Inspect-Only Proposal And Responses

Status: implemented and approved.

Add the first band-level negotiation surface on top of the per-song sketch without letting it drive playback.

Scope:

- Add a deterministic `SongSketchProposal` derived from the current `SongSketch`.
- Include proposal status, kind, target section, requested action, chord/root provenance, and the proposing player.
- Add one deterministic mock response per assigned player with stance `accept`, `modify`, `resist`, or `defer`.
- Render Proposal and Responses rows in the Song Sketch inspector.
- Expose `window.song.getProposal()` for browser review.
- Resolve Byte 12b-a's harmonic-source cleanup by looking up the bass role instead of literal player id.
- Return cloned nested sketch arrays from `window.song.getSketch()` so the memoized base sketch cannot be mutated by inspectors/tests/future proposal code.
- Keep section durations as full-loop proposed overlays; root-plan splitting still uses the harmonic source's own loop.
- Do not touch playback, transport, slow-thinking, validators, Ollama, persistence, or scheduling.

Acceptance criteria:

- `window.song.getProposal()` exists and points back to the active sketch id and source song.
- Proposal chord/root provenance matches the target section.
- Every affected player has one response.
- Glass's sparse material produces a different proposal kind than Lantern.
- Mutating a returned `window.song.getSketch()` section does not mutate the cached sketch returned by the next call.
- `npm audit`, `npm run build`, `npm run smoke`, and `git diff --check` are green.

Implementation notes:

- The proposal is intentionally labeled `mock`; it is deterministic scaffolding for band-level coordination, not model-authored songcraft.
- Smoke checks proposal shape and clone behavior structurally, avoiding dependence on exact response prose.
- In-app browser sanity check verified the Song Sketch inspector renders `mock/tighten_roots` and per-player responses on Lantern.
- Claude approved Byte 12b-b and verified the proposal/response surface is band-level, song-reactive, inspect-only, and playback-neutral.
- Forward note: memoize proposal construction if the richer sketch/proposal surfaces become heavier; it currently rebuilds on each render frame.
- Next-slice steer: add model-authored proposal text behind the existing validator plus deterministic mock fallback, while keeping proposal kind, stance, chord/root provenance, and routing deterministic. Persistence prep should follow that, and proposal-to-playback should be a separate carefully gated byte.

### Byte 12b-c: Model-Authored Proposal Text

Status: implemented and approved.

Let Ollama rewrite the readable proposal wording without giving it authority over the band-level decision.

Scope:

- Add a bounded `SongSketchProposalText` overlay for `summary`, `requestedAction`, and per-player response `reason` / optional `requestedChange`.
- Extend proposal status from `mock` to `mock | model`.
- Keep `kind`, target section, proposer, chord plan, root degrees, response stances, player ids, timing, and routing deterministic.
- Add a proposal-text prompt, primer, JSON-schema format, parser, validator, and deterministic mock fallback.
- Add a manual `Send proposal` Ollama button and inspector/debug readouts.
- Apply model text only when it validates against the active proposal id; keep mock text active on invalid/failed/stale output.
- Expose the result through `window.ollama.getLastProposalTextTest()` and keep `window.song.getProposal()` returning the active inspect-only proposal.
- Do not add automatic proposal calls, persistence, proposal-to-playback, transport changes, slow-thinking changes, or scheduling behavior.

Acceptance criteria:

- A mocked valid proposal-text response changes `window.song.getProposal().status` to `model` and updates only readable text fields.
- Fixed fields stay unchanged: proposal id, kind, target section, proposer, chord plan, root degrees, player ids, and response stances.
- A mocked invalid response keeps the visible proposal at `mock` and leaves a valid fallback in the Ollama result.
- The model-facing schema omits structural proposal fields such as `kind`, `stance`, `chordPlan`, and `rootDegrees`.
- `npm audit`, `npm run build`, `npm run smoke`, and `git diff --check` are green.

Review focus:

- Check that the model is only a copywriter for inspect-only proposal text.
- Check that invalid model text cannot replace the deterministic proposal.
- Check that the new manual Ollama path does not trigger surprise/background calls or touch playback state.

Implementation notes:

- Claude approved Byte 12b-c and verified live qwen3 proposal text preserves every structural proposal field while moving `mock -> model`.
- Carry-forward principle: model prose is data, not instruction. Future proposal-to-playback behavior must act only on deterministic structured fields or newly validated structured fields, never by parsing summary/action/reason prose.

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

### Byte 13a: Persistence Record Boundaries

Status: implemented; approved and merged.

Define durable record families before adding any database or write path.

Scope:

- Add `docs/persistence-records.md` as the Byte 13a companion to `docs/persistence-checkpoints.md`.
- Define logical durable records for sessions, musical events, player thought request/response/acceptance, slow-thought playback windows, song sketches, deterministic proposals, model proposal text, checkpoints, and moments.
- Separate replay payload requirements from seek-and-continue generator state.
- Bank the Byte 12b-c rule that model-authored prose is stored as data and must not become an executable instruction source.
- Capture the future grid-vs-performed pitch gap before event-log replay becomes load-bearing.
- Keep SQLite schema changes, database files, persistence writes, fork UI, replay, media export, and proposal-to-playback behavior out of scope.

Acceptance criteria:

- The persistence docs identify which new Byte 11-12 surfaces should persist and which should stay ephemeral.
- Checkpoint payload guidance includes `eventSerial`, `nextScheduleBeat`, `scheduledThroughBeat`, per-player committed event indexes, and latest committed grid pitch.
- Proposal persistence guidance distinguishes deterministic proposal structure from model-authored proposal text.
- Future behavior guidance says to act on structured fields, not model prose.
- `npm audit`, `npm run build`, and `git diff --check` are green. Smoke can be run if code changes are added; Byte 13a is docs-only.

Review focus:

- Whether the proposed durable records are enough for the next SQLite byte without over-normalizing.
- Whether the replay versus seek-and-continue distinction is clear.
- Whether the model-prose boundary is strong enough before proposal-to-playback work.

Review outcome:

- Claude approved Byte 13a as a docs-only persistence design.
- Carry forward into Byte 13b: add `song.changed` and `timing.feel_changed` record types, consider transport start/stop records, add taste action-dwell state to the seek-and-continue generator layer, and explicitly mark listening frame, agitation, contagion, and current taste display evaluations as ephemeral derived state.
- Keep `checkpoint.created` and `moment.marked` as type-tagged event rows unless a future storage need proves otherwise.

### Byte 13b: First SQLite Event Log

Add the smallest local persistence writer without replay or fork UI.

Scope:

- Introduce a local SQLite store owned by the local backend/server layer, with database files ignored by Git.
- Add append-only records for a very small set of safe types. Start with low-frequency UI decisions (`session.started`, `session.mode_changed`, `song.changed`, and `timing.feel_changed`); hold high-frequency `musical.event_recorded` for a later slice.
- Fold in the Byte 13a review additions before writing schema: `song.changed`, `timing.feel_changed`, taste action-dwell checkpoint state, and derived listening/agitation/contagion/taste display ephemeral guidance.
- Buffer writes off the audio scheduler path; never write to SQLite directly from a Tone scheduler callback.
- Add a tiny dump or inspect command so the log can be checked without a UI.

Out of scope:

- Fork UI, replay engine, media export, compaction, checkpoint restore, and proposal-to-playback behavior.
- Persisting model prose as executable instruction.
- Re-hosting the full Ollama proxy unless needed for the local server shape.

Review focus:

- Whether the event log stays append-only and off the audio path.
- Whether the schema remains under-normalized but queryable.
- Whether the first records are useful for debugging without turning Grow into an archive.

#### Byte 13b-a: SQLite Shell

Status: implemented; approved and merged.

Scope:

- Add a dependency-free Node SQLite shell using `node:sqlite`.
- Add schema initialization for `sessions`, append-only `events`, schema metadata, and the first event indexes.
- Add reusable append/read helpers in `server/persistence.mjs`.
- Add `npm run db:init`, `npm run db:dump`, and `npm run db:smoke`.
- Keep all app wiring, browser writes, playback writes, replay, fork UI, and checkpoint restore out of scope.

Acceptance criteria:

- `npm run db:smoke` creates a temporary database, inserts a session plus two events, reads them back, and cleans up after itself.
- The default database path is ignored by Git.
- The app still does not write to SQLite.

Review outcome:

- Claude approved the shell and the `node:sqlite` choice.
- A follow-up commit added ignored SQLite WAL/SHM sidecars for `.sqlite` and `.sqlite3` databases, plus a Node engine floor because `node:sqlite` is version-sensitive.
- Forward notes: make `db:dump` avoid creating an empty database if that becomes annoying, and add real schema migration checks before schema version 2. Byte 13b-b resolved the batch `appendEvents` and beat-column naming notes.

#### Byte 13b-b: Low-Frequency Decision Writer

Status: implemented; approved and merged.

Wire the first app-side persistence path without touching the audio scheduler.

Scope:

- Add a local persistence writer boundary that buffers records and flushes them outside UI/audio event handlers.
- Persist `session.started`, `session.mode_changed`, `song.changed`, and `timing.feel_changed`.
- Keep writes out of Tone scheduler callbacks.
- Expose enough debug/dump information to prove the records are appended in order.

Out of scope:

- `musical.event_recorded`, because it is high-frequency and scheduler-adjacent.
- Replay, fork UI, checkpoint restore, moments, compaction, and media export.

Review focus:

- Whether the writer is buffered and clearly off the audio path.
- Whether low-frequency records are enough to prove app-to-SQLite wiring.
- Whether the app remains usable when persistence is unavailable.

Implementation notes:

- `src/persistence.ts` owns a browser-side queue that schedules flushes with a timer and can be manually flushed through `window.persistence`.
- `vite.config.js` exposes `/api/persistence/status`, `/api/persistence/append`, and `/api/persistence/dump` on the dev server.
- `server/persistence.mjs` now has batch `appendEvents` and uses `beat` / `scheduled_beat` columns rather than `bar` / `scheduled_bar`.
- Smoke verifies a stopped app records `session.started`, `session.mode_changed`, `song.changed`, and `timing.feel_changed` in order with the queue drained.

Review outcome:

- Claude approved the writer and verified it stays off the UI/audio scheduler path.
- Stable client ids plus server-side skip-if-exists make retried unacknowledged batches idempotent.
- `session.started` on page load is accepted because a session is a terrarium run, not a playback span.
- Carry forward: unchanged-value early returns are a small bundled behavior change; each page load/HMR creates a new session; there is no pagehide flush yet.

#### Byte 13b-c1: Persistence Writer Hardening

Harden the low-frequency writer before persisting high-frequency musical events.

Scope:

- Make `db:dump` or the dump endpoint read-only when no database exists, or clearly report "no database; run db:init".
- Add explicit unavailable/offline smoke coverage proving persistence failure stays soft and the app remains usable.
- Add bounded retry/backoff for failed queued records.
- Add a pagehide best-effort flush or deliberate discard behavior.
- Add a small persistence inspector/debug line or equivalent visible state for status, pending count, and last error.

Out of scope:

- `musical.event_recorded`.
- Replay, fork UI, checkpoint restore, moments, compaction, and media export.

Review focus:

- Whether failed persistence can recover without duplicating records.
- Whether tab-close/pagehide behavior is explicit.
- Whether users and agents can tell when persistence is degraded.

Status:

- Implemented in Byte 13b-c1.
- `npm run db:dump` and `/api/persistence/dump` now report an uninitialized database instead of creating an empty DB just to inspect it.
- `src/persistence.ts` now has bounded retry/backoff, an explicit `retrying` state, and a best-effort `flushOnPageHide()` path using `sendBeacon` or keepalive fetch.
- The Session inspector shows persistence status, saved count, pending count, retry attempt, and last error.
- Smoke covers a forced `/api/persistence/append` outage and verifies the app stays usable while queued records remain pending.

Carry forward:

- `flushOnPageHide()` intentionally does not remove queued records because the browser gives no response; server-side event ids keep a repeated write idempotent.
- High-frequency `musical.event_recorded` remains deferred to Byte 13b-c, where the writer must prove ring-buffer/batch-flush discipline away from Tone callbacks.
- Claude approved Byte 13b-c1. Byte 13b-c should test that scheduler callbacks only enqueue memory data, persisted musical events stay ordered/idempotent under load, stop/cleanup either flushes or discards deliberately, bounded back-pressure is surfaced in the inspector, and grid versus performed pitch is decided before or alongside the event payload.

#### Byte 13b-c2: Musical Event Payload And Buffer Boundary

Define the high-frequency event record shape before connecting it to SQLite.

Scope:

- Add explicit grid versus performed pitch fields to emitted `MusicalEvent` while preserving `event.pitch` as the existing performed-pitch compatibility field.
- Add a `MusicalEventRecordPayload` with `grid` and `performed` sections for timing and pitch replay truth.
- Add an in-memory fixed-capacity musical-event record buffer that drops oldest records under pressure and drains in order.
- Add fast tests for payload shape and ring-buffer back-pressure, plus a live shifted-register assertion proving `gridPitch` and `performedPitch` diverge correctly.

Out of scope:

- Appending `musical.event_recorded` to SQLite.
- Fetching, scheduling, timers, or DB writes from Tone callbacks.
- Replay, fork UI, checkpoint restore, and media capture.

Status:

- Implemented in Byte 13b-c2.
- `src/musical-event-record.ts` owns the schema-v1 payload builder and fixed-capacity ring buffer.
- `transport` emits `gridPitch` from committed material and `performedPitch` from the actual sounded decision.
- The next slice should wire musical events into the buffer and a separate batch flusher, without letting scheduler callbacks do anything beyond synchronous memory enqueue.
- Claude approved Byte 13b-c2. Forward notes for Byte 13b-c3: keep callback push minimal, preferably event plus tonal snapshot; build payloads in the flusher if possible; send drained-but-failed batches to the retained/idempotent persistence queue keyed by `sourceEventId`; make stop cleanup flush-or-discard explicit; treat buffer drops as replay discontinuities because persisted seq remains contiguous on write.

#### Byte 13b-c3: Musical Event Buffer Flush To Persistence

Wire high-frequency musical events to SQLite without doing I/O in the audio callback.

Scope:

- In `handleMusicalEvent`, synchronously enqueue only the emitted event plus a tonal-context snapshot into the musical-event source buffer.
- Run a separate interval flusher that drains source events, builds schema-v1 `musical.event_recorded` payloads, and hands deterministic-id records to the existing retained/idempotent persistence queue.
- Key musical persistence ids by browser session id plus source event id so retried drained batches do not duplicate rows.
- Flush the source buffer on deliberate transport stop and pagehide/HMR before the existing persistence queue's best-effort flush.
- Surface source-buffer pending/enqueued/dropped/last-flush state in the Session inspector.
- Add smoke coverage that persisted musical rows are ordered by source event id, carry grid/performed payloads, and leave the source buffer empty after stop cleanup.

Out of scope:

- Replay or restoring from `musical.event_recorded`.
- Dedicated persisted gap markers for dropped source-buffer events.
- Re-hosting the Vite persistence middleware as a standalone server.

Status:

- Implemented in Byte 13b-c3.
- `handleMusicalEvent` still does no fetch, DB write, or timer scheduling; the flusher interval is started during app setup.
- Failed DB appends are handled by the existing `src/persistence.ts` retained queue and stable event ids rather than by re-entering the source buffer.
- Claude reviewed Byte 13b-c3 and found one required fix: musical persistence ids collided across stop/start play spans because transport-local `eventSerial` resets to `event-0` on each start while the browser session id stays stable.

#### Byte 13b-c4: Musical Event Play-Span Idempotency Fix

Fix the cross-span id collision found in Byte 13b-c3 review.

Scope:

- Add a browser-local play-span serial that increments on each successful transport start.
- Capture the play-span serial in each musical-event source-buffer entry when the audio callback enqueues it.
- Shape musical persistence ids as `musical-<sessionId>-span-<playSpanSerial>-<sourceEventId>` so `event-0` can recur safely in later play spans.
- Keep `MusicalEvent.id` / `sourceEventId` span-local so deterministic event-index/expression behavior does not change.
- Expand smoke to play, stop, play, stop, then assert persisted musical rows equal total drained source events and that each span's source ids are ordered independently.

Out of scope:

- Persisting `playSpanSerial` inside the schema-v1 musical-event payload.
- Changing transport event serial semantics.
- Reporting inserted-versus-deduped counts from `/api/persistence/append`.

Status:

- Implemented in Byte 13b-c4.

### Byte 14: Audible Song Form With Developed Chorus

Pivot from infrastructure to audible composition. No Byte 14 slice ships unless it changes what the human can hear.

Scope:

- Add a swappable default song form as data: Verse, Chorus, Verse, Chorus, Bridge, Chorus.
- Add a tiny arrangement timeline, `sectionAtBeat(absoluteBeat)`, that loops the full form and reports section type, occurrence, local beat, and bar-in-section.
- Drive per-section behavior through the existing note-decision path: verse grounded, chorus fuller/lifted/louder, bridge thinned and shifted.
- Commit a deterministic developed chorus melody through the lookahead material path, not as a fire-time hack. The chorus is in-scale, starts on a chord tone from the song root plan, and is derived from the source melody motif.
- Show current section and bar-in-section in the Session inspector and status line.

Out of scope:

- Producer marker or producer prompt interpretation.
- Model-authored melody or model consensus.
- Replay/restore, alternate forms, section detection, and more persistence.

Review focus:

- Listening: whether verse, chorus, and bridge are audibly distinct.
- Whether the chorus melody feels related to the verse while clearly becoming its own hook.
- Whether section transitions happen at bar boundaries and the inspector stays synced.
- Whether the material remains deterministic, in-scale, and committed through the lookahead.

Status:

- Implemented in Byte 14.
- Live probe confirmed the first chorus starts at beat 32 with section readout `Chorus 1, bar 1/8` and melody events tagged `section:chorus` / `section:developed-chorus`.

### Byte 15a: Deterministic Chorus Scoring And Repair

Treat the Byte 14 developed chorus as a draft. Score it from each player's deterministic perspective, repair it toward a sweet spot, and let the human remember or reject takes before any model critic enters.

Scope:

- Add a melody scorer with landing, monotony, and surprise-vs-target sub-scores plus per-note critique flags.
- Give each player a tiny deterministic influence corpus and derive per-player scoring weights/targets from existing disposition.
- Repair the raw chorus with bounded in-scale candidate substitutions and commit the repaired result through the lookahead material path.
- Add an inspector readout for raw versus repaired score, sub-scores, top critique, and per-player perspective scores.
- Add Raw/Repaired A/B audition and Up/Down feedback; Up persists a remembered-good `song.take_feedback` record, Down rejects the current phrase key and repairs again.

Review focus:

- Listening: whether the repaired chorus sounds less mechanical than the raw transform.
- Whether raw and repaired are easy to A/B and the repaired line remains deterministic and in-scale.
- Whether per-player perspectives visibly disagree on the same phrase.
- Whether human feedback persists as data and affects only future deterministic repair, not model behavior.

Status:

- Implemented in Byte 15a.

### Byte 15b: Model Critic On The Scoring Substrate

Let a local model critique only by selecting among already-scored, already-validated candidate repairs. The deterministic scorer remains the fallback and comparison harness.

Scope:

- Present bounded candidate repair choices and deterministic scores to the model.
- Validate the model's structured choice; invalid or unavailable output falls back to the deterministic scorer's balanced repair while the local best score remains visible for comparison.
- Store model rationale as prose data only, never as executable instruction.

Review focus:

- Whether the model's selected candidate beats or usefully differs from the deterministic pick by ear and score.
- Whether the validator/fallback path prevents wrong notes or unbounded edits.
- Whether model critique improves the compositional loop without hiding the deterministic ground truth.

Status:

- Byte 15b-a implemented the first manual model critic.
- `MelodyRepairTake` now exposes a bounded candidate menu: raw transform, deterministic heuristic repair, and top local alternates. Each candidate carries app-owned phrase/events, scores, phrase key, changed-note count, and critique summary.
- Ollama receives only a projection of scored candidate IDs and critique context, then returns `selectedCandidateId` plus short prose fields. The response schema does not allow notes, pitches, scale degrees, octaves, scores, timing, or instructions.
- Valid model selections refresh the chorus lookahead to use the chosen local candidate. Invalid, failed, or stale model output falls back to the deterministic candidate.
- Human Up/Down feedback now records the active candidate id/source and whether it was selected by the model critic or deterministic scorer.
- Byte 15b-b diversifies the menu into named deterministic strategies: balanced repair, lifted hook, stepwise hook, spacious hook, energetic hook, cadence hook, plus raw/local fallback choices when distinct. Candidates now expose strategy, note count, best-candidate id, score delta from local best, and score delta from the deterministic fallback.
- Manual critic outcomes are recorded as `song.melody_critic_selection` so model picks can be compared with the local scorer over time without parsing model prose.

### Byte 15c: Deterministic Band Consensus

Let the model critic propose a chorus candidate, then let the deterministic players respond before anything becomes the active audible take. The model still selects only an app-owned candidate id plus prose; it does not vote, emit notes, or mutate scores.

Scope:

- Add a consensus pass over the existing scored candidate menu.
- Give each player a deterministic response to the proposed candidate: accept it, defer to a slightly preferred option, or push for a different strategy.
- Use role-shaped strategy affinities so the rhythm section can favor breath/space while the melodist can favor lift or motion.
- Select the active chorus candidate from the existing local menu by consensus score, then commit it through the same lookahead material path already used by Byte 14/15.
- Record proposal id/source, selected id, consensus summary, agreement score, and per-player responses with human feedback and critic-selection persistence.

Review focus:

- Whether consensus makes the model proposal feel like something the band considers rather than a private override.
- Whether a characterful but lower-scoring proposal, such as `spacious-hook`, can pass when the pulse/bass/melody responses support it.
- Whether a weak proposal, such as an overly high/repetitive `lifted-hook`, is still rejected by deterministic consensus rather than rubber-stamped.
- Whether invalid/failed/stale model output still falls back to the deterministic scorer without changing the audible chorus.

Status:

- Byte 15c-a adds the first deterministic consensus layer.
- `createMelodyConsensusDecision()` scores app-owned candidates from pulse, bass, and melody perspectives with a modest proposal bias and role-specific strategy affinities.
- The inspector shows `Consensus` and `Responses` rows, and `window.melodyRepair.getConsensus()` exposes the selected candidate, proposal source, agreement score, and player responses.
- Manual critic outcomes and Up/Down feedback now preserve the model proposal separately from the consensus-selected candidate.

Deferred producer work:

- Producer marker, rule-based text input, and safe producer prompt interpretation remain useful, but they are no longer Byte 14/15. Bring them back after the band is audibly composing.

## Byte 16 Arc: Musicality First (Course Adjustment, 2026-06-12)

Arne redirected the project after Byte 15c-a: stop deepening chorus take selection and move to musical motion. See `.agent/handoffs/2026-06-12-claude-musicality-course-adjustment.md` and the matching section in `docs/vision-and-plan.md`. The planned standalone remember-good byte is folded into this arc.

### Byte 16a: Audible Harmonic Motion

Make the `SongSketch` chord/root plan audible. Bass and accompaniment follow the per-section chord plan instead of a static tonal center, committed through the existing song-form/lookahead material path.

Scope:

- Deterministic only; no model involvement in this byte, so the musical change is isolated from any protocol change.
- Sections should become harmonically distinct by ear, not just by density/register behavior.
- Interpret root plans as modal harmonic roots inside the current tonal context. This byte recolors pulse/bass degrees within C mixolydian and does not change key, mode, or the active validator scale.

Review focus:

- Whether chord changes land at section boundaries through the lookahead path without timing or cleanup regressions.
- Whether melody material stays coherent over a moving root, or needs chord-aware scoring next.

Status:

- Byte 16a implemented audible modal root motion for pulse and bass.
- `deriveSongSectionRootPlans()` mirrors the SongSketch gather/answer root split, adds a deterministic bridge plan, and `getSongHarmonicContext()` exposes the active root for transport/UI.
- `arrangeSongFormPatternEvent()` applies harmonic recoloring at schedule/materialization time before pitch resolution, so no fire-time note-decision path or model protocol is involved.

### Byte 16a-b: Chord-Aware Melody Scoring

Make the deterministic chorus scorer listen to Byte 16a's moving roots. The repaired chorus should be judged against the active chorus/answer root plan, not the old song-wide tonal center.

Scope:

- Deterministic only; no model, consensus, persistence-schema, or key/mode behavior change.
- Keep the active scale as C mixolydian. This is chord-aware landing inside the same modal-root-recolor strategy, not modulation.
- Use the existing melody repair/scoring path so the audible repaired chorus can shift toward current-section chord tones through committed lookahead material.

Review focus:

- Whether accented/final chorus notes now land on chord tones for the current moving answer roots.
- Whether the visible Melody Score context makes the scoring target clear enough for listening review.
- Whether candidate diversity and deterministic consensus still behave after the score target changes.

Status:

- Byte 16a-b is approved and merged.

### Byte 16a-c: Inspect-Only Form Scoring

Score the current song form before letting the form score drive any decisions. The goal is to answer: does the whole arrangement go somewhere?

Scope:

- Deterministic and inspect-only; no playback, model, consensus, persistence-schema, or key/mode behavior change.
- Score one full default form pass using the same song-form materialization path and current chorus development.
- Keep scores readable: harmonic motion, energy arc, melodic coherence, and cadence/arrival.

Review focus:

- Whether the score reflects audible form shape rather than just static metadata.
- Whether a deliberately weakened chorus variant scores worse, proving the scorer can detect a real musical problem.
- Whether the inspector readout is clear enough to guide later audible variants.

Status:

- Byte 16a-c is approved and merged.

### Byte 16a-d: Shared Section Dynamics Policy

Extract the section-dynamics rule that Byte 16a-c duplicated between playback and form scoring. This keeps the inspect-only form score and the audible note-decision path reading the same verse/chorus/bridge policy before a variant chooser makes that policy load-bearing.

Scope:

- Deterministic only; no model, persistence-schema, key/mode, consensus, or melody-candidate behavior change.
- Preserve the existing audible section behavior exactly: chorus melody can override taste rests, chorus support keeps its taste action while lifting velocity, bridge thins pulse/bass/melody, and verse grounds melody velocity.
- Use the shared function from both `applySongSectionDecision()` and form scoring's energy estimate.

Review focus:

- Confirm playback and form scoring now share one section-dynamics source.
- Confirm the extraction does not alter audible section decisions or form-score totals except through the intended shared path.
- Confirm the weakened-chorus form-score assertion covers the total score as well as cadence.

Status:

- Byte 16a-d is approved and merged.

### Byte 16b-a: Audible Form Variant Chooser

Use the form score as a ruler for deterministic whole-form audition variants, then let the human choose which variant drives playback. This is the first form-score-to-audio bridge and stays app-owned: variants change section layout and section-dynamics profile, while pitches still come from existing in-scale song-form material and chorus candidates.

Scope:

- Deterministic only; no model-authored phrases, key/mode changes, or consensus changes.
- Variants are app-owned data: arrangement shape plus section-dynamics profile.
- Show all variant scores in the Form Score inspector, mark the current score winner, and let a visible selector drive playback through the normal lookahead path.
- Switching variants refreshes lookahead and clears stale slow-thinking playback windows.

Review focus:

- Confirm variant switching changes what is heard through transport/song-form materialization, not just inspector text.
- Confirm the default variant preserves the existing Classic Arc until the human chooses another variant.
- Confirm all variants remain in-scale and rely on existing committed song-form/lookahead paths.
- Confirm form scoring measures the same selected variant that playback uses.

Status:

- Byte 16b-a is approved and merged.

### Byte 16b-b: Form Variant Score Discrimination

Improve the form-score ruler before any variant winner gets more authority. Byte 16b-a made variants audible, but Early Hook and Wide Return tied; this byte adds proportion/payoff scoring so the score can distinguish form shapes that sound different.

Scope:

- Scoring/display only; no transport, selector, model, persistence-schema, or playback behavior change.
- Add a proportion/payoff metric that considers first chorus arrival, final chorus room, bridge breath, and chorus/verse balance.
- Keep the winner informational; do not auto-apply it.

Review focus:

- Confirm Early Hook and Wide Return no longer tie, and the distinction follows the stated proportion/payoff logic.
- Confirm `Classic Arc` remains a valid default variant.
- Confirm no selected-variant playback behavior changed from Byte 16b-a.

Status:

- Byte 16b-b is approved and merged.

### Byte 17 Arc: Song-Goal Front Door

Arne and Claude added a new front door for Grow: a human or another agent can enter a free-text song idea, and the local system interprets it into a validated, bounded `SongGoal` that seeds the band's setup and working brief. See `.agent/handoffs/2026-06-13-claude-song-goal-arc-plan.md`.

Core boundary:

- The prompt resolves into knobs the app already understands, never into notes, scales, or executable instructions.
- `sourceIdea` prose is provenance only and is never parsed downstream as instruction.
- The same validator handles human and agent text.
- Persist the interpreted `SongGoal` so a take is reproducible from the structured goal, not just the prose.

#### Byte 17a: SongGoal Contract And Deterministic Interpreter

Define the broad `SongGoal` contract, validator/clamps, deterministic keyword interpreter, and inspector/debug harness.

Scope:

- Deterministic only; no model involvement.
- Inspect-only; no playback, tempo, key/mode, or form drive yet.
- Include broad but bounded vocabulary: setup fields, energy/surprise/mood, form preference, section emphasis, disposition nudges, curated influence hints.
- Add deterministic fallback behavior that later model interpretation can be measured against.

Implementation notes:

- `src/song-goal.ts` owns the closed vocabulary, clamping validator, deterministic keyword interpreter, and deterministic id/brief generation.
- The inspector exposes a Song Goal panel plus `window.songGoal.*` review harness.
- 17a intentionally does not call `refreshLookaheadSchedule()`, set tonal context, set tempo, select a form variant, or persist `song.goal_set`; those are 17b responsibilities.

#### Byte 17b: Goal Drives Setup

First audible payoff. Apply validated setup-time goal fields to key/mode, tempo, and form preference.

Scope:

- Curated `(tonic, mode)` set and clamped tempo range.
- Setup-time only, not mid-song modulation.
- Thread active tonal context and tempo through existing bypass paths before playback uses them.
- Persist `song.goal_set`.

#### Byte 17b-a: Setup Plumbing And Safe Keyword Matching

Prep slice before SongGoal drives sound:

- Replace substring keyword matching with token/phrase matching so fallback cues such as `air` and `run` cannot fire inside larger words.
- Make `GrowWorldState` hold a mutable active tonal context while preserving the default C mixolydian behavior.
- Let transport read active tonal context and tempo through handlers instead of raw static assumptions.
- Route display/root-name paths through the active context. No SongGoal setup is applied yet.

#### Byte 17b-b: Explicit Apply/Audition Setup

First setup-drive slice:

- Keep interpretation as preview until the human presses an explicit Apply setup control.
- Apply only validated structured fields: `(tonic, mode)` -> active tonal context, `tempoBpm` -> active transport tempo, and `formPreference` -> active form variant.
- Refresh lookahead scheduling after setup changes so committed material, tempo, section form, and fallback timers are rebuilt together instead of mixing old and new setup.
- Persist `song.goal_set` with the full bounded `SongGoal` plus previous/next setup snapshots so the take can be reproduced from structured data; never parse `sourceIdea`, `brief`, or rationale prose as instructions.

#### Byte 17c: Goal Drives Character

Apply bounded goal character fields to existing knobs: energy/surprise, per-player disposition nudges, curated influence-hint nudges, and section emphasis.

#### Byte 17c-a: Energy And Section Emphasis

First character-drive slice:

- Derive a goal-adjusted `SectionDynamicsProfile` from the applied `SongGoal`.
- Use `energy` plus `sectionEmphasis` as bounded multipliers over the existing section-dynamics path, so playback and form scoring stay aligned.
- Keep this as an overlay on app-owned deterministic material: no model, no prose parsing, no new notes, no new persistence schema.
- Leave `surpriseTarget`, `dispositionBias`, and `influenceHints` for smaller follow-up slices.

#### Byte 17c-b: Surprise And Disposition Taste Nudges

Second character-drive slice:

- Derive an adjusted `PlayerTasteProfile` from the applied `SongGoal`.
- Use `surpriseTarget` as a bounded nudge toward novelty/repetition preference, and role-specific `dispositionBias` as a bounded density-target nudge.
- Feed the adjusted taste profile into the existing taste evaluation path; do not alter actions directly, bypass dwell, parse prose, or create/remove notes.
- Expose the base/adjusted taste profiles through the debug surface so reviews can verify one shared adjusted value.
- Leave curated `influenceHints` and melody-scoring prior nudges for a separate slice.

#### Byte 17d: Local ML SongGoal Interpreter

Let Ollama fill the proven `SongGoal` shape via structured output, validator/clamps, and deterministic fallback. The model fills knobs only.

#### Byte 17e+: Goal-Relative Scoring

Add goal-alignment terms to melody/form scorers so the band can compare candidate takes against the interpreted brief.

### Evolutionary Composition Arc: Candidate Population

Claude's 2026-06-14 evolutionary-composition plan reframes the next backbone as a bounded search over musical material: players/generators create many candidate songs and elements, existing scorers assign fitness, SQLite keeps the best, and the rest are purged. Source planning note: `claude/evolutionary-composition-plan` commit `d2e083c`.

Core boundary:

- Candidates are bounded genomes, not raw audio or executable instructions.
- A phrase candidate genome can be the same `PlayerPatternSource` shape used by song material and the prosody generator.
- The candidate table is the one allowed mutable persistence projection; every create/score/retain/purge decision also appends an audit event.
- Deterministic seed and lineage stay on every candidate so later development and replay can reproduce the path.

#### Track A1: Candidate Store Shell

Build the inspect-only candidate store:

- Add the `Candidate` contract: `kind`, validated bounded `genome`, `scores`, `fitness`, `parentId`, `generation`, `seed`, `status`, and optional `createdAtBeat`.
- Add a mutable capped `candidates` SQLite table alongside the existing append-only `events`.
- Add write/query/score/retain/purge/cap APIs through the dev-only `/api/persistence/*` middleware and debug client.
- Emit `candidate.created`, `candidate.scored`, `candidate.retained`, and `candidate.purged` audit events.
- No audio, no generator loop, no model, and no playback drive.

#### Track A2: Fitness Aggregation

Add a pure weighted-scalar fitness aggregator over candidate score maps. Document the first weights as tunable, not permanent musical truth.

#### Track A3: Selection And Bounded Population

Select deterministically by kind: top-N become `elite`, overflow becomes `purged`, and population caps are enforced with audit events.

#### Track A4: Development Hook

Clone an elite candidate, apply a caller-provided mutation operator, and create a child with `parentId`, `generation + 1`, and a new deterministic seed.

### Byte 16b: Band-Proposed Key/Mode Change

First case: a bridge modulation, since it is already convention. A proposer (bassist first, model critic later) proposes a key/mode change for a target section through the Byte 12 proposal shape; players respond with the Byte 15c stance machinery; an accepted change commits through the lookahead path at the section boundary.

Scope:

- Reuse `SongSketchProposal` and consensus; do not invent a parallel mechanism.
- Fallback is trivial and always valid: stay in the current key.
- Fold in the carry-forward: derive consensus affinities from player dispositions instead of the hand-tuned `STRATEGY_AFFINITY_BY_PLAYER` table.

Review focus:

- Whether the modulation feels proposed and agreed rather than scripted.
- Whether rejection paths stay audible-safe.

### Byte 16c: Model-Authored Phrase As Candidate

Let the model emit one phrase through the existing `MusicalExcerpt` validator as an additional entry in the chorus candidate menu. Scoring and consensus already guard it; the band can outvote a bad phrase.

Review focus:

- Whether validator + scorer + consensus genuinely contain a bad model phrase.
- Whether a good model phrase can win on merit, by ear and by score.

### Byte 16d: Mark-A-Moment

A "keep that" control that preserves the recent decision/event trail as a named moment, using existing persistence. Small; can land in parallel with 16a-16c.

### Folded Remember-Good

Remember-good now targets band-level outcomes recorded by this arc: accepted key changes, chord plans that worked, section developments, and which strategies players push for — not only chorus candidate picks.

### Byte 16 (superseded): Minimal Persistence

Superseded by Byte 13b after the song-sketch and proposal-text surfaces became worth preserving.

Scope:

- `sessions`.
- `events`.
- `space_id`, `branch_id`, `session_mode`, `beat`, `scheduled_beat`.
- No snapshots or forks yet.

Review focus:

- whether events are useful for replay/debugging,
- whether schema stays small.

## First Review Request

Claude reviewed the first implementation plan in `.agent/reviews/2026-05-30-claude-byte-1-plan-review.md`.

Adopted result: build Byte 1 as one stationary pulse player with one percussive beat, explicit Tone.js lifecycle ownership, stable test hooks, and no React.
