# Local Developer Notes

This is the living memory file for local workflows. Add commands, ports, setup notes, deployment details, and gotchas when they become useful more than once.

## Studio Pattern Source

- Version/date: `2026-05-30 initial scaffold`
- Source repository: `https://github.com/ArneGleason/the-studio-pattern`
- Source commit: `dbbe3e9`
- License: `CC BY-SA 4.0`
- Local adaptation: early Grow project scaffold with GitHub connection notes; product scope and runtime stack are still TBD.

## Local Environment

- Machine handle: `macbook-pro-m5`
- Primary agent/tool here: `Codex`
- Local checkout: `/Users/arnegleason/Documents/Grow`
- Possible standard repo home: `/Users/arnegleason/code/github.com/arnegleason/grow`, if the human owner chooses to move this checkout later.

Machine handles are assigned by the human owner. Do not treat OS hostname, username, serial number, or network name as canonical unless the human explicitly maps it here.

## Setup

Install pinned dependencies:

```sh
npm install
```

## Run

```sh
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
git status --short --branch
git ls-files --cached --others --exclude-standard | sort
```

## Test

```sh
npm run build
npm run smoke
```

## GitHub Repo Setup

Remote:

```txt
origin https://github.com/ArneGleason/grow.git
```

Check local GitHub CLI authentication:

```sh
gh auth status
```

After the human owner confirms slug and visibility, create and connect the remote. Example:

```sh
gh repo create arnegleason/grow --source=. --remote=origin --private
git push -u origin main
```

Use `--public` instead of `--private` only after visibility is confirmed.

## GitHub App/API Connection

See `docs/github-setup.md` before adding tokens, OAuth credentials, webhook secrets, or GitHub App keys.

## Testability Standards

For software projects, record the testing conventions that future agents should preserve:

- Stable selectors or test IDs: Byte 10c exposes `transport-toggle`, `transport-status`, `session-mode-control`, `session-mode-current`, `session-mode-break`, `session-mode-solo-practice`, `session-mode-rehearsal`, `session-mode-performance`, `terrarium-container`, `terrarium-canvas`, `player-list`, `player-pulse-*`, `player-bass-*`, `player-melody-*`, including `player-*-expression` and `player-*-offset`, `thought-seed-list`, `thought-seed-pulse-*`, `thought-seed-bass-*`, `thought-seed-melody-*`, `thought-request-pulse-*`, `thought-request-bass-*`, `thought-request-melody-*`, `thought-intent-pulse-*`, `thought-intent-bass-*`, `thought-intent-melody-*`, `ollama-base-url-input`, `ollama-model-input`, `ollama-health-check`, `ollama-send-thought`, `ollama-health-status`, `ollama-model-status`, `ollama-protocol-status`, `ollama-latency`, `ollama-parse-result`, `ollama-validation-result`, `ollama-fallback-status`, `ollama-errors`, `ollama-primer-summary`, `ollama-raw-response`, `listening-event-count`, `listening-window`, `listening-latest-event`, `lookahead-health`, `lookahead-lead`, `lookahead-through`, and `lookahead-pending-slots`.
- Byte 12b-c adds proposal-text probe selectors: `ollama-send-proposal`, `ollama-proposal-text-status`, and `ollama-proposal-raw-response`.
- E2E state setup and teardown: TBD.
- E2E smoke command: `npm run smoke`; Playwright starts or reuses Vite at `http://127.0.0.1:5173/`.
- Long smoke runs on a laptop are sensitive to display sleep / system idle. Prefer `caffeinate -dimsu npm run smoke` when stepping away from the machine.
- Page readiness and realtime waits: wait for `window.transport.getState()` before transport assertions and `window.listening.getFrame()` before listening-frame assertions.
- Shared fixtures/helpers: TBD.
- Visual regression entry points: capture the Vite root page at `http://127.0.0.1:5173/`; the terrarium canvas should show three gently drifting players: `pulse`, `bass`, and `melody`.

## Studio Pattern Commands

Show current state:

```sh
git status --short --branch
```

Create a handoff:

```sh
# TBD
```

Suspend work:

```sh
# TBD
```

Resume work:

```sh
# TBD
```

## Operational Notes

- GitHub remote is configured as `origin` and tracks `main`.
- No committed secrets should be added. Use `.env.local` for local-only credentials.
- Byte 1 pins PixiJS, Tone.js, Vite, and TypeScript directly in `package.json`.
- Byte 2a adds `src/players.ts`; renderers and inspectors should consume player registry data instead of hardcoding visible players.
- Byte 2 adds `src/listening.ts` and `src/world-state.ts`. Static player data belongs in the registry; transient state such as `waiting`, `performing`, `thinking`, and `resting` belongs in `GrowWorldState`.
- Byte 5 schedules one-shot Tone.js events into an 8-beat lookahead queue. While playing, `window.transport.getState().lookahead.pendingSlotCount` counts pending note/rest slots and should stay bounded; after stop it should return to `0`.
- Musical events should be stamped from scheduled transport time and snapped to the current pattern grid, not from live `Transport.position`.
- The inspector DOM is built only when the player registry changes; state/listening values update on a browser render cadence.
- Before Byte 4 taste logic, player runtime state needs to represent musical posture over a recent window instead of individual note-on articulation. Use a separate visual flash for note-on emphasis.
- `window.listening.getFrame()` should be read-only; do not let dev/test getters mutate transition state or clear ledgers.
- Byte 3b implements posture state over the last 8 beats, `terrarium.flashPlayer()` for note-on emphasis, side-effect-free `window.listening.getFrame()`, interval-union `silenceRatio`, and default tonal context `C mixolydian`.
- The first transport implementation exposes `window.transport.getState()` for dev inspection.
- Byte 2 exposes `window.listening.getFrame()` and `window.listening.getEvents()` for dev inspection.
- Tone.js audio must start from a user gesture in normal browsers.
- For Tone.js scheduled callbacks, the callback `time` argument is the intended audio fire time. `Tone.now()` includes Tone's lookahead; use `Tone.immediate()` when testing whether a callback is truly late. Comparing scheduled times to `Tone.now()` can add audible jitter even when grid offsets are zero.
- Playwright smoke tests pass Chromium `--autoplay-policy=no-user-gesture-required` so the test can focus on lifecycle cleanup rather than browser audio policy.
- If several unrelated playback smoke tests all report `eventCount: 0` while lookahead is healthy and pending slots exist, suspect the browser AudioContext/transport clock is parked or wedged rather than a musical regression. Stop any manual dev server, rerun the focused playback smoke from a clean Playwright-managed server, and use `caffeinate` for long runs if the laptop may blank/sleep.
- Vite dev HMR can leave audio objects alive if cleanup regresses; preserve transport disposal hooks.
- Byte 1 validation passed with `npm run build`, `npm audit`, and a Playwright smoke check for repeated start/stop cleanup.
- Byte 3 validation historically checked that repeated start/stop cycles kept the three Tone sequences at 3 while playing and 0 while stopped. Current Byte 5+ validation should use `lookahead.pendingSlotCount` instead.
- Byte 3b validation should include confirming all three player states remain `performing` after they have participated recently, rather than blinking between `performing` and `resting` between staccato notes.
- Byte 3c validation should include confirming emitted event pitch classes belong to `window.listening.getFrame().tonalContext.scale` and that the note-on halo flash is visible by eye.
- Byte 4 validation should include `window.taste.getEvaluations()`, taste summaries/reasons in the inspector, at least one taste-driven `rest` event, and continued cleanup of scheduled sequences across start/stop cycles.
- Byte 4b validation should sample `window.taste.getEvaluations()` across several render frames to confirm melody action does not flip rapidly around the rest threshold.
- Byte 5 validation should check `window.transport.getState().lookahead`, visible `Lookahead` inspector values, a healthy lead while playing, and a zero pending queue after stop/restart cycles.
- Byte 4b review found that dwell reduces but does not settle melody rest/contrast oscillation. If this becomes distracting, add hysteresis; also harden the smoke assertion to check dwell spacing rather than relying on a short sample window.
- Byte 5 review approved the one-shot lookahead queue. The follow-up naming cleanup removed duplicate `scheduledEventCount`, kept the canonical count at `lookahead.pendingSlotCount`, and disambiguated the visible labels as `Pending` lookahead slots versus `Heard` listening events.
- Byte 5 lookahead refill uses a 250ms wall-clock interval. Background tabs can throttle it and drain the queue; current behavior is safe but may drop new notes until the tab foregrounds and refills.
- Byte 5 commits pitch/timing ahead, but taste rest/velocity is still decided at fire time. Later "committed material" work should make that boundary explicit.
- Byte 6a adds `src/session-mode.ts`, stores current mode in `GrowWorldState`, and exposes `window.session.getMode()`, `window.session.setMode(mode)`, and `window.session.getModes()`. Mode switching is intentionally side-effect-free until Byte 6b.
- Byte 6a review approved the mode shell. Before or during Byte 6b, derive static initial mode UI from `DEFAULT_SESSION_MODE`, share the set-mode/render helper, and add the transport wire needed for the scheduler to read mode state.
- Byte 6b recommended first behavior: `break` stops refilling new lookahead slots and lets queued material drain; `rehearsal` resumes refill; `solo-practice` and `performance` remain rehearsal-equivalent no-ops.
- Byte 6b implements that first behavior. `window.transport.getState().sessionMode` mirrors the world mode; switching to `break` while playing should leave status `playing`, let `lookahead.pendingSlotCount` drain to `0`, and report lookahead `empty` without new events after the drain. Switching back to `rehearsal` should refill from the current beat.
- Byte 6b review approved the behavior. Before adding more mode behavior, move the scheduling policy out of transport's `mode !== "break"` check into a session-layer predicate or explicit mode-policy map; keep `sessionMode` on transport state for display/debugging.
- Byte 6c implements that boundary cleanup. `SESSION_MODE_POLICIES` in `src/session-mode.ts` owns `refillsLookahead`; transport receives `shouldRefillLookahead` and no longer branches on session mode literals for refill policy.
- Byte 6c review approved the cleanup and verified the `satisfies Record<SessionMode, SessionModePolicy>` guard fails TypeScript if a future mode lacks a policy. If session policies gain several fields, consider passing a whole policy object instead of adding many transport handlers.
- Planning update after Byte 6c: player Ollama thinking should come before producer work. Next arc should add player profiles/backstory fragments, a deterministic thought-context selector, musical-excerpt markup, strict player thought request/intent protocol with request levels, Ollama health/session primer, one slow-thinking player loop, song sketch/piece construction, and thought memory.
- Byte 7 adds compact player thinking profiles in `src/players.ts` and deterministic thought seed assembly in `src/thought-seeds.ts`. Use `window.thinking.getSeeds()` to inspect each player's `in_song_short` context: disposition summary, selected fragments, listening metrics, taste summary, recent motif, and prompt focus.
- Byte 7 intentionally does not call Ollama and does not affect transport, taste decisions, lookahead refill, or session-mode behavior. Byte 8 should define strict request/response protocol and validators before any local model call is wired in.
- Byte 7 review approved the thought-seed layer. Before Byte 8's mock responder, replace or supplement the motif display string with validatable `MusicalExcerpt` markup that uses phrase-relative positions and preserves ordering across bar boundaries.
- Byte 8 should also decide whether `PlayerDisposition` is separate prompt flavor or derived from `PlayerTasteProfile`, and where `requestLevel` belongs between `PlayerThoughtSeed` and the future `PlayerThoughtRequest`.
- Byte 8 adds `src/thought-protocol.ts`. Use `window.thinking.getRequests()` and `window.thinking.getMockIntents()` to inspect strict thought protocol objects. Requests wrap seeds and own `requestLevel`; mock intents are pure deterministic protocol output and are not scheduled into sound.
- Byte 8 `MusicalExcerpt` protocol data uses phrase-relative `positionBeats`; the inspector string is derived display text. Do not reintroduce `absoluteBeat % 4` as protocol data because it loses ordering across bar boundaries.
- Byte 8 documents disposition as prompt-facing identity only. Taste remains the behavior-facing rule profile until a later byte deliberately wires thought output into behavior.
- Byte 8 review approved the protocol with no required fixes. Before Byte 9 trusts model-authored intents, tighten validators so `scaleDegree < scale.length`, pitched steps belong to the active scale, and `musicalIdea.durationBeats` cannot exceed the request horizon.
- Byte 9 should surface `validatePlayerThoughtIntent` errors in the manual Ollama test display, keep the deterministic mock responder as offline fallback, and treat `sourceStartBeat` as provenance/debug while `intent.target` owns placement.
- Byte 9a implements the validator hardening only. `validateMusicalExcerpt()` now rejects out-of-scale `scaleDegree`, out-of-scale `pitch`, and pitch/degree disagreement; `validatePlayerThoughtIntent()` now rejects `musicalIdea.durationBeats` beyond `maxDurationBeats`.
- Byte 9a review approved the validator hardening with no required fixes. Byte 9a still has no Ollama calls and no scheduling of thought intents into audio.
- Byte 9b should add health/status, session primer, manual test call, and validation/error display only.
- Byte 9b's primer must define `MusicalExcerpt.steps[].scaleDegree` as a pitch-class index from `0` to `scale.length - 1` with a separate `octave` field. That is intentionally different from the app's wrapping `noteFromScaleDegree()` helper.
- Byte 9b should surface `validateMusicalExcerpt()` and `validatePlayerThoughtIntent()` errors directly in the manual test display, keep deterministic mock intents as offline fallback, and keep `sourceStartBeat`/placement owned by the system rather than the model.
- Byte 9b implemented `src/ollama.ts` as a browser-side local Ollama boundary. Byte 10f-b1 moved the actual Ollama network hop behind the same-origin Vite dev proxy at `/api/ollama/tags` and `/api/ollama/chat`.
- The default local model tag is now `qwen3:4b-instruct-2507-q4_K_M`, configurable in `.env.local`, the inspector model input, or `window.ollama.setConfig({ model })`. Adjust it to the exact tag returned by `ollama list` if needed.
- `window.ollama.checkHealth()` checks local model availability; `window.ollama.runManualThoughtTest("melody")` sends one current `in_song_short` thought request and records raw latency, raw response, parse result, validation result, and mock fallback status. It does not schedule anything into the transport.
- `window.ollama.getInfluenceProbePrompt("melody")` produces a fixture-level `influence_probe` prompt that asks for abstract transferable technique rather than direct style copying.
- Byte 9b also rejects `MusicalExcerpt` steps where a pitch's embedded octave disagrees with the explicit `octave` field.
- Byte 9b review approved the Ollama probe. Claude verified the Mac Mini model tag is `gemma4:26b`, while the MacBook target remains `gemma4:31b`; keep the tag configurable per machine.
- Real local `gemma4:26b` testing returned invalid/empty content after about 22 seconds with a valid mock fallback. Before the automatic slow-thinking loop, move model calls behind a local backend/proxy, handle reasoning-model `message.thinking`, trim the prompt, add mocked invalid/unavailable smoke cases, and surface `availableModels` as a picker.
- Prompt-shape experiment: `node experiments/2026-05-31-thought-prompt-shapes.mjs` compares full JSON, projected JSON, music-card, and split-card thought prompts. The current recommendation for Byte 10f is projected JSON first, then live-test music-card/split-card once Ollama is reachable.
- Byte 10f-a implements `src/thought-prompt-protocols.ts` with the first prompt adapter, `projected-json`. `runManualThoughtTest()` now sends a compact request projection plus Ollama JSON-schema `format`, records `promptProtocol`, and still validates only through the canonical `PlayerThoughtIntent` path with deterministic mock fallback.
- Byte 10f-a live review on the Mac Mini confirmed `qwen3:4b-instruct-2507-q4_K_M` works end-to-end: health ready, pulse/bass/melody all returned valid projected-JSON intents in about 4-5 seconds, and no model output is scheduled into music yet.
- Byte 10f-b1 adds `vite.config.js` with a local dev Ollama proxy. The browser still owns prompt construction and validation, but `checkHealth()` and `runManualThoughtTest()` now call the same-origin `/api/ollama/*` routes instead of direct cross-origin Ollama URLs.
- Byte 10f-b1 review approved the proxy. Claude verified same-origin proxy use, localhost target rejection, and a real qwen3 call safely falling back when the model returned a pitch/scaleDegree disagreement. Next Ollama schema work should ask the model for `scaleDegree` plus `octave` only, then derive `pitch` in system code before validation/scheduling.
- Before the automatic slow-thinking loop, add abort propagation through the proxy so a cancelled browser-side thought can cancel the upstream Ollama request. Re-host the proxy as a standalone local server when SQLite/persistence work begins.
- Byte 10f-b2 implements that hardening: the projected JSON response schema omits `pitch`, the primer/prompt says not to include pitch, `coerceMusicalExcerptStep()` derives pitch only for in-range integer `scaleDegree` plus integer `octave`, and the proxy passes an abort signal to upstream Ollama `fetch()` calls.
- Byte 10f-b2 smoke now includes an unavailable proxy-chat case. A `503` response should leave transport stopped, show `HTTP 503`, and keep the deterministic mock fallback valid.
- Byte 10f-b2 review approved the branch and real qwen3 returned 6/6 valid manual thought tests. Before Byte 11, add one more smoke fixture for HTTP 200 with validator-failing JSON; the expected state is `invalid`, provider `ollama`, and mock fallback valid.
- The invalid-200 smoke fixture is now in place: `manual Ollama thought probe keeps mock fallback for invalid model JSON` returns parse `ok`, validation `invalid`, provider `ollama`, mock fallback valid, and transport stopped.
- Do not delay Byte 11 for a model picker unless typing model tags becomes annoying. The env var, inspector input, and `window.ollama.setConfig()` are enough for now.
- Byte 11a adds the first automatic slow-thinking loop. It only starts for `melody` when transport is playing, session mode is `rehearsal`, and `ollamaHealth.status` is `ready`; it uses `runOllamaThoughtTest()` with an abort signal, rate-limits by 8 beats, and exposes `window.thinking.getSlowLoop()` plus `thought-slow-melody-status`.
- Byte 11a deliberately does not schedule accepted model output into audio. The accepted intent is inspected and late valid thoughts are retargeted to a future bar in loop state; the next Byte 11 slice should add the first narrow compiler into future playback.
- Byte 11a review approved the loop. Before Byte 11b compiles anything into audio, extract a slow-thinking controller, add an explicit accepted-intent handoff so accepted state cannot be overwritten by the next cycle, re-check retargeting at schedule time, and add a bar-boundary/no-overwrite thrash guard.
- Keep Byte 11b's compiler narrow. Prefer bounded rest or density change before pitch/motif rewriting; broader key/mode/chord/section changes should go through a future band-level proposal/song-sketch coordination path.
- Byte 11b extracts `src/slow-thinking.ts` and exposes the accepted slow-thought playback window through `window.thinking.getSlowPlayback()`. The automatic melody request is narrowed to `rest`, `simplify`, and `change_density`; accepted output can only become a bounded future `rest` or `thin` note-decision window.
- Byte 11b deliberately applies the first audible slow-thought bridge through the existing `noteDecision` path. This keeps the slice small, but review should decide whether future intent application belongs closer to lookahead commit data before pitch/motif rewriting arrives.
- Byte 11b smoke coverage uses a mocked valid `rest` intent and waits for a melody `rest` event inside the compiled playback window. Use `window.thinking.getSlowLoop()` for request lifecycle and `window.thinking.getSlowPlayback()` for the active compiled window.
- Byte 11b review approved the bridge and verified real qwen3 `change_density` can thin melody while pulse/bass continue. Before 11c, clean up the unused accepted queue in `src/slow-thinking.ts`; for any future injected notes or motif rewrites, move intent application into the lookahead commit path rather than fire-time decisions.
- The Byte 11b accepted-queue cleanup is now done. `SlowThinkingController` exposes accepted thoughts only through `onAccepted`; there is no longer a parallel `takeAcceptedIntent()` queue.
- Byte 11c-a adds bounded `shift_register` for melody. `window.thinking.getSlowPlayback()` includes `mode: "shift-register"` and `registerShift`; shifted events carry `thought:shift_register` and `register:+/-N` tags. This still does not add notes: it only changes pitch for existing scheduled melody notes inside the active window.
- Byte 11c-a intentionally lets shift-register play a scheduled melody note even if taste would otherwise rest it, so the register thought is audible without adding new note slots. Review this before expanding thought-driven behavior.
- Byte 11c-a is approved and merged. Carry forward Claude's wording: the rescue behavior is slow-thought precedence over taste rests, acceptable because it is bounded and only un-suppresses an existing slot. Prefer explicit `registerDelta` next instead of inferring direction from average octave.
- Byte 11c-b implements that `registerDelta` cleanup. `PlayerThoughtIntent.registerDelta` is required for `shift_register`, must be -1/0/1, and is rejected on other actions. The Ollama prompt/schema mention it explicitly, the parser preserves it, and slow playback no longer infers direction from average octaves.
- Byte 11c-b is approved and merged. Real qwen currently chooses `shift_register` but omits `registerDelta`, which is correctly rejected to deterministic fallback. Improve compliance with conditional schema support or a concrete primer example; do not infer/default missing deltas. `AcceptedSlowThought.request` has been pruned because register inference no longer reads it.
- Byte 11c-c adds a conditional projected JSON schema for `shift_register` requiring `registerDelta`, plus a concrete top-level example and "do not only mention in rationale" wording. Minimal live qwen probe: conditional + plain example still omitted the field, but the top-level/rationale warning produced `registerDelta: 1`.
- Ollama reachability on the MacBook: the app/server listens at `127.0.0.1:11434`, but Codex sandboxed commands cannot open that local socket without escalation. `gemma4:31b` needs `think: false` for short structured `/api/chat` calls; otherwise it may put reasoning in `message.thinking` and leave `message.content` empty.
- Reproducible aliveness is now a planning principle: keep replay/debug determinism, but allow deterministic heat through velocity modulation, performed offsets, physical-difficulty microtiming, and agitation/contagion.
- Byte 10b adds `src/expression.ts` for deterministic per-player velocity expression. Transport applies `baseVelocity * tasteVelocityMultiplier * expression.velocityMultiplier`, clamps final velocity to `0..1`, records the snapshot on each `MusicalEvent.expression`, and exposes latest snapshots at `window.transport.getState().expression.latest`.
- Byte 10b expression is intentionally velocity-only. Do not use it to shift timing, change pitch, refill lookahead, call Ollama, or change session behavior; those belong to later bytes.
- Byte 10b review approved the velocity layer. Claude verified deterministic replay across two runs, bounded role ranges, audible variation, unchanged grid timing, clean rests, and 4/4 smoke.
- Byte 10c should compute `performedOffsetBeats` at schedule/commit time and preserve `absoluteBeat` as grid truth. Pick a canonical schedule-time per-player event index so velocity and future timing expression do not desync during break drains.
- Forward consistency note: if expression grows beyond velocity, consider injecting expression through a transport handler like taste/session policy. Future checkpoint/seek work should restore per-player expression/event-index counters. Feel nit: melody's short velocity cycle is harmonically locked at half its medium cycle; consider a small retune such as `4.7` beats when doing feel tuning.
- Byte 10c implements `src/performed-time.ts`. Transport now commits a schedule-time per-player `eventIndex`, computes `performedOffsetBeats` before queueing the Tone event, records the offset on `MusicalEvent.performedOffsetBeats` and `MusicalEvent.performedTiming`, and exposes future/latest timing snapshots at `window.transport.getState().performedTiming.latest`.
- Byte 10d audibly uses `performedOffsetBeats`: transport schedules one-shot notes at `absoluteBeat + performedOffsetBeats` in Tone ticks, guards resumed scheduling against pushed slots behind the live playhead, clamps late callbacks to `now + epsilon`, and records `MusicalEvent.performedOffsetSeconds` while preserving `absoluteBeat` as grid truth.
- Timing feel experiment branch adds `Grid`, `Feel`, and `Wide`. `Grid` should report `0ms` offset, normal `Feel` is subtle, and `Wide` is a deliberately exaggerated audition mode tagged as `timing:wide-audition`.
- The timing feel experiment branch also adds `src/song-material.ts` and a header `Song` selector. `Lantern` is the original loop; `Switchback` and `Glass` are alternate deterministic audition loops. Switching songs while playing clears the local ledger/taste frame and refreshes the lookahead from the current beat.
- Byte 10c review approved the data model and cleared Byte 10d. UI labels now distinguish `Dynamics heard` from `Offset queued` because expression latest is fire-time/just-heard while performed timing latest is schedule-time/future-committed.
- Byte 10e-v adds `window.terrarium.getVisualState()` for derived visual heat inspection. It should remain a read-only visual snapshot sourced from the current listening frame, not a new behavior state source.
- Persistence/checkpoint note: event-ledger replay is self-contained from stored event payloads, but seek-and-continue must restore transport generator state such as committed event indexes, next scheduled beat, scheduled-through beat, and event serial.
- Byte 13b-a adds the local SQLite shell without app wiring. It uses Node's built-in `node:sqlite` module, verified locally on Node `v25.8.1`. Use `npm run db:smoke` for a temp-file append/read check, `npm run db:init` to create the default ignored `data/grow.sqlite3`, and `npm run db:dump -- --limit 20` to inspect sessions/events.
- Byte 13b-b wires low-frequency browser decisions to SQLite through the Vite dev middleware at `/api/persistence/*`. The app queues records in `src/persistence.ts` and flushes them off the UI handler path. Use `window.persistence.getState()`, `window.persistence.flush()`, and `window.persistence.dump(100)` to inspect the current browser session.
- Byte 13b-c1 hardens that writer before musical-event persistence. `window.persistence.getState()` now includes `retryAttempt`, `nextRetryAt`, and `lastPagehideFlushAt`; `window.persistence.flushOnPageHide()` exercises the tab-close best-effort path; and the Session inspector has `data-testid="persistence-status"` for the visible degraded-write state.
- `npm run db:dump -- --db <missing-path>` now reports `initialized: false` and does not create an empty database. Use `npm run db:init` when you actually want to create the default DB.
- Byte 13b-c2 defines the musical-event record boundary without writing those records yet. `MusicalEvent.gridPitch` is the committed material pitch, `MusicalEvent.performedPitch` is the sounded pitch, and legacy `MusicalEvent.pitch` still aliases the sounded pitch for listening/taste compatibility. `src/musical-event-record.ts` builds schema-v1 `musical.event_recorded` payloads and owns the fixed-capacity drop-oldest buffer for the future flusher.
- Byte 13b-c3/c4 wires musical events to persistence through that source buffer. `handleMusicalEvent` only enqueues `{ event, tonalContext, playSpanSerial }`; a setup-time interval drains up to 64 sources, builds payloads, and calls the retained persistence queue with deterministic ids shaped like `musical-<sessionId>-span-<playSpanSerial>-<sourceEventId>`. The span matters because transport-local `sourceEventId` restarts at `event-0` on each stop/start play span. Use `window.persistence.getMusicalEventBufferState()` and `window.persistence.flushMusicalEvents()` to inspect or manually drain the source buffer.
- Byte 14 adds audible song form. The default form loops Verse/Chorus/Verse/Chorus/Bridge/Chorus, 8 bars each. `window.transport.getState().songForm` and `data-testid="song-section-current"` show the current section/bar. The first chorus starts at beat 32; for a quick live probe, start playback and wait until `currentBeat >= 34`, then inspect melody events tagged `section:chorus` / `section:developed-chorus`.
- Byte 14 bridge feel note: the bridge melody's lift lives in committed song-form material (`createBridgeMelodyEvent`) and should not be shifted again in the note-decision layer.
- Byte 15a adds deterministic chorus scoring and repair. `window.melodyRepair.getTake()` returns raw/repaired phrases, sub-scores, per-player perspective scores, and the active repaired event array. The default audition mode is `repaired`; `window.melodyRepair.setMode("raw")` is the A/B palate-cleanser path, and Up/Down feedback persists `song.take_feedback` records.
- Byte 15a review fix: melody scoring must be register-aware, not pitch-class-only. Repair candidates are bounded to the raw phrase register and leap/surprise intervals use melodic position (`octave * scaleLength + scaleDegree`) so octave plunges are penalized instead of being treated as clean chord-tone landings.
- Byte 15b-a adds a manual local Ollama melody critic. `window.melodyRepair.getTake().candidates` is the bounded, app-owned candidate menu, `window.melodyRepair.getCandidate()` is the active audible repaired candidate, and `window.ollama.runManualMelodyCriticTest()` asks the model to choose only a `selectedCandidateId` plus prose rationale. The model never emits notes; invalid or failed output leaves the deterministic candidate active.
- Byte 15c-a adds deterministic band consensus after a model/deterministic chorus proposal. Use `window.melodyRepair.getConsensus()` to inspect `proposedBy`, `proposedCandidateId`, `selectedCandidateId`, agreement score, and per-player accept/defer/push responses. `window.melodyRepair.getCandidate()` remains the active audible consensus-selected candidate.
- Byte 16a adds audible modal harmonic motion. `window.transport.getState().harmony` exposes the active gather/answer/bridge root plan and root degree; the Session inspector mirrors it in `data-testid="song-harmony-current"`. This is root recoloring inside the existing tonal context, not a key/mode change.
- Byte 16a smoke found that headless Chromium can report an AudioContext as `running` while its clock is effectively frozen. The transport now keeps Tone's callback as the primary path, but arms a wall-clock fallback for still-pending committed lookahead events so inspector/listening/persistence state can keep advancing in that test environment. Review duplicate-emission risk any time this fallback is touched.
- Byte 16a-b makes the chorus melody repair score against the chorus/answer root plan from `deriveSongSectionRootPlans()`. Use `window.melodyRepair.getTake().scoringRootDegrees` or `data-testid="melody-score-roots"` to confirm the scorer is following the moving roots.
- Byte 16a-c adds inspect-only form scoring. Use `window.formScore.getScore()` or the Form Score inspector rows to inspect total, harmonic motion, energy arc, motif coherence, cadence, and section summaries. It does not drive playback.
- Before runtime key/mode changes, remember that transport patterns currently materialize from tonal context at `initTransport`/start time; tonal changes will need pattern re-materialization.
- PixiJS v8 clamps alpha to 1.0, so note-on flashes should not rely on `alpha > 1`. Use scale, tint, or a resting alpha below 1.0 so the flash has visible headroom.
- Use `git ls-files --cached --others --exclude-standard | sort` for the file inventory now that ignored `node_modules/` and `dist/` trees exist.
- Track D3 adds `window.persistence.runEvolution({ seed, kind: "phrase", generations, count, eliteLimit, branchId })` for inspect-only candidate evolution. It runs bounded deterministic generations, scores developed children, and returns per-generation `topFitness`/`meanEliteFitness`; use D2's `window.prosody.auditionEliteCandidate({ branchId })` separately to hear the current elite.

## Known Gotchas

- Browser autoplay policy can block audio if start is not triggered by a click/tap.
- Repeated start/stop should not let `lookahead.pendingSlotCount` grow without bound while playing, and it should always return to `0` after stop.
- `silenceRatio` should measure actual silent coverage. If multiple players overlap, compute active interval union rather than summing durations across players.
