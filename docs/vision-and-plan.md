# Grow Vision and Initial Plan

## Intention

Grow is a playful local AI music terrarium.

The first version should feel like a bounded top-down world where a small, variable number of locally powered players move, listen, make simple musical choices, and gradually organize into sessions. The players are not modeled as humans. They are small autonomous presences with musical memory, tendencies, tools, and spatial awareness.

The human can enter the terrarium through an avatar-like proxy: another participant that takes direct human instruction and can move through the space, talk to the players, suggest musical direction, start or stop sessions, and influence what is built.

The project is exploratory. Drift is allowed. The repo should keep enough memory that ideas can mutate without losing why earlier choices were made.

## Confirmed Early Direction

- First prototype: browser-first.
- First musical language: tonal/modal and rhythm-linked from the start.
- Local model target: Ollama-backed and configurable. Gemma 4 31B remains a large-model reference, while `qwen3:4b-instruct-2507-q4_K_M` is the current fast default for projected JSON thought probes.
- Human avatar: language-driven producer proxy. Players can comply, resist, ignore, reinterpret, or develop changing attitudes toward producer suggestions.
- Capture: lightweight rolling best-moments capture, not a large permanent archive.
- First running slice: rule-based PixiJS/Tone.js terrarium with one pulse player. Next foundation: musical events and listening frames before adding multiple players.
- Time model: not hard real-time. Players can think ahead, commit material into a lookahead buffer, and perform it later in time with the transport.
- Session model: not nonstop generation. Grow has breaks, solo practice, rehearsals, performances, reflection, and constructed pieces.
- Player thinking model: players should gain their own slow Ollama-backed creative planning before the producer proxy is added, so they can generate future musical ideas from listening frames, dispositions, compact memory fragments, symbolic musical excerpts, influence probes, and songcraft plans.
- Prompt protocol model: Grow should keep one canonical internal thought contract while allowing swappable model-facing prompt adapters, because different local models tolerate projected JSON, card protocols, and other compact shapes differently.
- Scope model: solo local instrument first; future architecture may allow multiple terrariums/bands that can observe or react to each other.

## Course Adjustment: Musicality First (2026-06-12)

After Byte 15c-a, Arne redirected the project's center of gravity from take selection to musical motion.

The chorus-candidate pipeline (scoring, repair, critic, consensus) proved the safety architecture, but four consecutive bytes refined the selection of one 8-bar loop. That problem is sorted. The bar Grow is reaching for is not "pleasant generative loop" — it is music that moves: chord changes under sections, a bridge that lifts into a new key, a key change that happens because the bassist suggested it, band conventions that arrive as proposals rather than scripts.

What this means concretely:

- Harmonic motion is the next musical dimension: the `SongSketch` chord/root plan becomes audible rather than inspect-only.
- Band-level changes (key, mode, chord sequence, section shape) come to life through the existing proposal/response/consensus path from Bytes 12 and 15c.
- The model graduates from selector/copywriter toward bounded authorship: validator-gated phrases entering the candidate menu, guarded by scoring and consensus.
- Remember-good targets band-level outcomes — accepted key changes, chord plans, section developments — not just chorus candidate picks.
- Mark-a-moment lands as the first listener-facing capture feature, since persistence and the decision trail now exist.

The safety boundaries do not move: the app owns every note, model output is data or validator-gated structure with deterministic fallback, and changes commit through the lookahead path at musical boundaries.

## Product Feel

- A confined top-down terrarium rather than an infinite world.
- Small visible players with simple, readable representations.
- No heavy character psychology required; their musical behavior can imply personality without turning them into simulated people.
- Musical interaction is central: players should hear shared timing and each other’s contributions.
- Listening starts from structured musical events and shared listening frames, with raw audio features added as a lightweight reality check.
- The world can begin empty except for the players, then gain sound sources, instruments, play styles, and session structures.
- The human avatar should be able to join, observe, nudge, interrupt, or conduct through ordinary language.
- The system should occasionally notice interesting moments and make them easy to replay or export, while aggressively purging ordinary history.
- Slow thinking, listening, resting, and re-entry should feel like part of the musical behavior rather than app latency.
- Silence and breaks should be meaningful. Grow should avoid becoming an always-on pleasant texture generator.

## Working Thesis

Grow should begin as a browser-first local app:

- Web UI for fast iteration.
- PixiJS for the top-down world.
- Tone.js/Web Audio for timing, synths, sequencing, and musical playback.
- Shared musical event and listening-frame types before complex player behavior.
- A small local backend that talks to Ollama on `localhost:11434`.
- SQLite persistence through the local backend for checkpoints, forks, and moments.
- TypeScript for shared schemas between the world simulation, UI, and agent decision protocol.
- A deliberate lookahead buffer so model reasoning can happen off the playback clock.

Tauri can become useful later if Grow wants to feel like a native desktop instrument or needs local-file permissions, but the first milestone should stay web-first.

## Core Loop

1. The terrarium moves between modes: break, solo practice, rehearsal, performance, and reflection.
2. The visual and audio world advances in animation ticks and musical bars when a mode calls for playback.
3. Musical actions are scheduled by Tone.js against a shared transport.
4. Visual actions are rendered in the terrarium without waiting for agent reasoning.
5. Rule-based agents provide the first musical behavior and remain useful as a fallback.
6. Players listen first through structured musical events and listening frames, then later through lightweight raw audio features.
7. Player thought requests assemble compact context from disposition, backstory fragments, listening frames, taste evaluations, recent motifs, and symbolic musical excerpts.
8. Ollama decisions arrive on slower intervals and update future intent rather than the currently sounding bar.
9. Players can ask different levels of questions: quick in-song variations, influence/reference probes, songcraft planning, and memory digests.
10. The simulation validates all agent proposals and turns them into safe world actions.
11. Validated material is committed into a lookahead buffer and scheduled at musical boundaries.
12. The human can eventually type ordinary language that a producer proxy interprets into in-world movement, speech, cues, and future musical requests.

## Time and Lookahead

Grow should use a deliberate delayed-now model. The audible/visible performance can trail the planning process by a few bars or seconds, giving players time to observe, think, synchronize, and commit upcoming material.

See `docs/time-and-lookahead.md` for the full model.

Important principles:

- Do not block the audio transport on Ollama.
- Treat late model output as material for a later bar, not the current moment.
- Let players visibly enter listening, thinking, rehearsing, resting, and performing states.
- Keep rule-based material as a fallback so the world can keep breathing while players think.
- If the lookahead buffer runs dry, pause or show a rehearsing/loading state intentionally rather than pretending it is seamless.

## Sessions, Breaks, and Pieces

Grow should use explicit session modes. See `docs/session-modes.md`.

Important principles:

- Avoid nonstop generative ambience as the default.
- Let players take breaks between sessions.
- Let players practice alone away from the group.
- Let rehearsals stop, repeat, revise, and restart.
- Let performances be bounded attempts at organized works, even when improvised.
- Let some players sit out, join late, or disagree with a proposed piece.
- Treat silence and absence as musical states, not missing output.

## Language: Players vs Agents

Product language should usually call visible participants `players` or `musicians`. They are musical presences in the terrarium, not chatbots in costumes.

Implementation language can still use `agents` for the reasoning system, action schemas, memory, and Ollama-backed decision loops.

## Initial Player Abilities

Keep the first player action set small:

- `move`: choose a nearby destination.
- `listen`: focus on another player or the current groove.
- `claim_role`: pick a simple musical role such as pulse, bass, melody, texture, or noise.
- `play_pattern`: schedule a short phrase using an existing instrument.
- `respond`: answer another player or the human avatar in short text.
- `rest`: intentionally leave space.
- `practice`: work independently on a phrase, role, or sound.
- `join_session`: opt into a rehearsal or performance.
- `sit_out`: decline or defer participation.

Players should not directly execute arbitrary code. The reasoning layer proposes declarative actions; the app validates and performs them.

Deferred actions:

- `propose_tempo`: add once the transport and session control model exist.
- `propose_piece`: add once reusable motifs or song-like structures exist.
- `make_instrument`: defer until the basic listen/role/play loop feels good.
- `process_signal`: defer until Tone.js routing and a mixer model exist.

## Musical Model

Start with constrained musical primitives rather than open-ended audio generation:

- Global tempo and transport.
- Scale or mode.
- Bar/beat grid.
- Role lanes: pulse, low, mid, high, texture, and effects.
- Short phrase patterns: 1-4 bars.
- Instrument presets built from safe synth parameters.
- Effect presets built from constrained filters, delay, reverb, modulation, distortion, and routing choices.
- Recent-event memory so players can respond to what just happened.

This keeps the band coherent enough to be fun while still letting odd emergent behavior appear.

### Tonal/Modal Rhythm Foundation

The first musical grammar should not separate pitch from rhythm too cleanly. Agents should make choices using:

- Tempo and beat grid.
- Current key center.
- Current mode or scale.
- Rhythmic density.
- Register.
- Tension/release.
- Role against the ensemble.

The first prototype can use a small mode set such as major, minor, dorian, mixolydian, pentatonic, and chromatic color notes. More elaborate harmony can wait until the players can already listen and react in a simple groove.

### Effects Role

At least one player role should be able to behave less like a traditional instrumentalist and more like an effects operator:

- Listen to or target another player's output.
- Process a dry signal through a constrained effect chain.
- Sometimes replace the dry signal entirely with the processed signal.
- Add interest through filtering, delay, space, stutter, modulation, or distortion.
- Respect safety limits so the mix stays audible and not painfully loud.

This role can create drama without requiring every player to invent a new melody.

## Human Avatar

The human avatar should be a language-driven producer proxy rather than a purely omnipotent control panel.

Players can react individually to producer suggestions. Some may be compliant, skeptical, playful, resistant, or temporarily rebellious. This should not become a heavy social simulation, but it should create texture: requests can be followed, bent, ignored, over-applied, or argued with.

See `docs/producer-proxy.md`.

The producer avatar can:

- Move through the space.
- Interpret human text instructions and carry them into the world.
- Address a player or group on the human's behalf.
- Start, stop, or reshape sessions.
- Encourage roles or moods.
- Ask players to simplify, intensify, follow, contrast, or leave space.
- Mark a moment as worth keeping.

Player reactions should evolve from recent interactions, but remain bounded and inspectable.

First visual representation can be simple: a distinct dot or marker with a producer color, halo, and visible instruction/intent bubble. Character can emerge later through color modulation, pulse, trails, attention lines, and state changes.

## Capture and Replay

Grow should support best-of capture without turning into an archive.

Start with a rolling event buffer rather than raw video as the source of truth:

- World state snapshots.
- Player decisions and short visible messages.
- Musical events: notes, rhythms, patches, role changes, effect automation.
- Producer instructions.
- Session tempo, key, mode, and transport position.
- Session mode and boundaries.

This allows replay by re-running the visual and audio engine for a selected segment. It should be lighter, more inspectable, and easier to purge than recording everything as media.

Add optional media capture later:

- Browser canvas can be captured with `canvas.captureStream()`.
- Web Audio output can be routed to a `MediaStreamDestination`.
- `MediaRecorder` can combine visual and audio streams for lightweight export.
- Browser-native export will likely be WebM first; MP4 may require a local backend conversion step later.

The capture system should behave like a ring buffer:

- Keep only a short recent window by default, such as 2-5 minutes.
- Let the human press a mark button to preserve the last N seconds.
- Start with human-marked moments only.
- Later, let automatic heuristics or an observer agent suggest moments based on novelty, convergence, role changes, dense interaction, or sudden musical contrast.
- Keep a small best-moments tray.
- Purge unmarked material continuously.
- Use explicit export for anything that should survive beyond the session.

## World Model

Start with a 2D top-down grid or continuous plane:

- Bounded rectangular space.
- Agents have position, heading, color/shape, current role, and active instrument.
- Instruments can exist as small world objects.
- Height/layers can be represented later as stack level or z-index if objects need to overlap.
- Distance can affect who hears whom, or it can begin as purely visual until the audio model needs spatial listening.

## Suggested Architecture

```txt
web app
  src/app          shell, controls, state wiring
  src/world        terrarium simulation and entities
  src/audio        Tone.js transport, synths, pattern scheduler
  src/agents       agent memory, prompts, action schemas
  src/ollama       client for local model calls
  src/shared       shared TypeScript types and validation schemas

local backend
  src/server       Ollama proxy, persistence, optional GitHub integration later
  data             local SQLite database files, ignored by git
```

The browser should own visuals and audio scheduling. The backend should own local model calls, persistence, and any GitHub API work that needs credentials.

Persistence should use an append-only event log plus periodic snapshots. See `docs/persistence-checkpoints.md`.

Time and scheduling should use a lookahead buffer. See `docs/time-and-lookahead.md`.

Session modes should keep breaks, solo practice, rehearsal, performance, and reflection explicit. See `docs/session-modes.md`.

The human-facing avatar should be a producer proxy that interprets natural-language prompts into in-world actions. See `docs/producer-proxy.md`.

Future architecture should avoid assuming that only one terrarium or band can ever exist. See `docs/future-multi-terrarium.md`.

Foundational interaction principles, including the listening model, inner music, and subjective taste, live in `docs/principles/`.

## First Implementation Slice

Build the smallest playable thing that can answer whether Grow feels alive:

- One browser tab.
- PixiJS canvas with a bounded terrarium.
- One visible pulse player first.
- A musical event ledger and listening frame before adding more players.
- Then three colored moving players.
- Roles: pulse, bass, melody.
- Tone.js shared transport with play/stop and tempo readout.
- Rule-based quantized patterns in a small tonal/modal scale.
- No Ollama calls.
- No SQLite persistence.
- No producer avatar.
- No forks/checkpoints UI.
- No instrument invention or effects routing.
- No full session-state machine yet, but avoid designing the first loop as endless ambience.
- No multi-terrarium or band exchange behavior.

What this tests:

- Whether the terrarium reads visually.
- Whether the audio and visual loops feel coupled.
- Whether structured events are enough for players to "hear" each other before raw audio analysis.
- Whether three constrained musical roles can later sound like a tiny band rather than noise.
- Whether the stack is pleasant enough before adding reasoning and memory.

From the start, make stop/restart cleanup reliable and keep the transport/test hooks deterministic.

## Collaboration Model

Use the Studio Pattern deliberately:

- Codex can act as the implementation lead in this checkout.
- Antigravity can review product shape, architecture, interaction drift, or implementation risk from a second environment.
- Claude can be used as a creative or structural reviewer when the project needs alternate framings, musical behavior ideas, or sanity checks.
- Handoffs should say whether the next participant is allowed to implement, review only, or intentionally propose creative drift.
- Creative drift is welcome, but should be recorded as a choice so the project can pull back if it wanders away from what is fun.

## Milestones

### Milestone 0: Intentional Scaffold

- Record vision and plan.
- Keep GitHub setup separate from app credentials.
- Confirm app stack.

### Milestone 1: Playable Rule-Based Terrarium

- Build the top-down bounded visual world.
- Show one pulse player first, then three moving players with stable role colors and labels.
- Add Tone.js transport with play/stop and tempo readout.
- Add a musical event ledger and minimum listening frame.
- Give players rule-based quantized patterns: pulse, bass, melody.
- Keep state in memory.
- Verify transport start/stop cleanup and audio/visual coupling.
- Add the first simple lookahead scheduling boundary, even if rule-based material only looks ahead 1-2 bars.

### Milestone 2: Producer and World Events

- Add the producer avatar after the terrarium already feels alive.
- Let the human type ordinary language prompts.
- Add a simple producer marker with a distinct color/halo.
- Let the producer proxy move and place interpreted text instructions into the world.
- Start with a rule-based interpreter for a small command set before using Ollama.
- Show attention lines or simple notice animations when players react.
- Add a visible in-memory event log with a small rolling history.
- Add tonal/modal controls and rhythm density controls.
- Add simple explicit modes: break, solo practice, rehearsal, performance.

### Milestone 3: Local Reasoning Loop

- Add Ollama connection health check.
- Define structured agent action schema.
- Let one agent decide between safe actions.
- Let the producer proxy interpret open-ended human prompts into validated world actions.
- Add bounded memory and logs so decisions can be inspected.
- Target Gemma 4 31B first, with the exact Ollama model tag configurable.
- Keep rule-based behavior active while Ollama decisions are pending.
- Schedule Ollama results into future bars through the lookahead buffer.

### Milestone 4: Persistence and Moments

- Add minimal SQLite persistence for sessions and events.
- Include `branch_id` in events as a future fork extension point.
- Add manual "mark moment" support.
- Defer automatic best-moment detection until real sessions reveal what is interesting.
- Design for checkpoints/forks, but do not build full fork UI unless the workflow demands it.

### Milestone 5: First Band Session

- Run 3-5 players.
- Start with explicit modes: break, solo practice, rehearsal, performance, reflection.
- Let the human avatar conduct: "make it sparser", "follow the pulse", "switch roles", "try a brighter melody".
- Let players opt in, sit out, or break away for solo practice.
- Persist session snapshots.
- Add varied player reactions to producer suggestions.
- Add checkpoint and fork support for session branches.

### Milestone 6: Instrument and Effects Invention

- Let players propose constrained synth patches.
- Save instruments as declarative presets.
- Let players switch instruments and reuse discoveries.
- Add a small library view.
- Let effects players propose constrained effect patches.
- Add the effects-agent role once the mixer/routing model exists.

### Milestone 7: Best-Moments Capture

- Add a rolling event buffer.
- Add manual moment marking.
- Add automatic "maybe interesting" markers.
- Add replay of a short captured segment.
- Add optional WebM export.
- Evaluate whether MP4 export needs local backend conversion.

### Milestone 8: GitHub Connection

- Decide whether Grow needs GitHub only as its source remote or as a product integration.
- If product integration is needed, prefer a GitHub App or OAuth app over a long-lived personal token.
- Add repo export, session publishing, issue creation, or versioned experiment logs only after the core local loop exists.

### Later: Multi-Terrarium / Band Exchange

- Bank between two terrarium spaces or bands.
- Let one band act as audience for another.
- Let players draw inspiration from another group's session.
- Allow responses such as applause, critique, imitation, heckling, or musical counterpoint.
- Treat as a later experiment after the solo terrarium is fun.

## Research Notes

- Ollama has a local chat API at `/api/chat` with tool-call and JSON-format support, plus official JavaScript/TypeScript library support.
- Tone.js is a Web Audio framework with transport scheduling, synths, effects, samples, and DAW-like timing concepts.
- PixiJS is a high-performance 2D renderer with WebGL/WebGL2 as the recommended renderer path.
- Web Audio can support custom instruments directly, including oscillators, envelopes, scheduling, visualization, and later AudioWorklet processors.
- Vite is a good lightweight starting point for a TypeScript web app.
- Tauri is a later option for a small cross-platform desktop shell using the same web frontend.
- Browser media capture can likely cover simple best-moment export, while MP4 may need later backend support.

## Open Design Questions

- Should players communicate in visible text bubbles, hidden logs, musical gestures, or all three?
- How much "personality" should players have beyond musical tendencies?
- What should the first rolling window length be: 2, 3, or 5 minutes?
- Should automatic best-moment detection begin with simple heuristics or ask an observer agent to nominate moments?
- What is the exact local Ollama model tag for Gemma 4 31B on this machine?
- Should the terrarium keep ambient memory between sessions or start fresh by default?
- Should the producer move by keyboard, click-to-move, or another input model?
- What should the producer proxy's first visual identity be: dot with halo, ring, cursor-like marker, or another simple sign?
- What first lookahead target feels right: 4 bars, 8 bars, or about 20 seconds?
- What should the user see when the lookahead buffer runs thin: pause, visible rehearsing, fallback groove, or a mix?
- What should a saved piece contain first: motifs, role assignments, cue points, mode/key/tempo, or all of these?
