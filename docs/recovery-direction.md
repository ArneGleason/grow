# Grow Recovery Direction

From: Claude Code (cloud session)
To: Arne
Date: 2026-10-17
Scope: review of the whole repository at `8451d6e`, plus a proposed restart direction. Nothing in `src/` was changed.

Arne's framing for this review: the project was meant to be a musical terrarium where musician agents write little songs on their own agency, judge what is good, and grow past their current perimeter. Instead it became ever more elaborate and ever more stale, and "it just couldn't hear what was good or not." The questions were: is anything salvageable, should it be done with web tech at all, and how do we recover the original intent.

The short answer: the ideas are good and the code is mostly not. Do not continue this codebase. Start a fresh one with a different center of gravity (ears first, bodies second, UI last), carry four files and the principles, and judge every step by listening instead of by tests.

---

## Part 1: What is actually here

Three readers went through the code and the 430 KB of notes. Verified claims, with file references.

**What you hear.** Three Tone.js voices with no effects, no mixer bus, no samples: a sine `MembraneSynth` pulse, a triangle `MonoSynth` bass with one lowpass, a sine `Synth` melody (`src/transport.ts:389-449`). They loop three hand-written two-bar tables (`src/song-material.ts:30-421`), re-rooted per section and swapped for a fixed 16-slot chorus hook table (`src/song-form.ts:82-106`). The bridge is "transpose down two degrees, up an octave, quieter" (`src/song-form.ts:324-332`). Per-note variation is velocity breathing of roughly ten percent and timing offsets of at most 12 ms, which is below what most listeners can hear. Harmony is one diatonic root every four beats, at most four roots, triads only, in one of six modes. A fourth player cannot make sound without editing the transport dispatch (`src/transport.ts:483-489`).

**What the local model does.** It never authors a note. The slow-thinking path asks the model for a `PlayerThoughtIntent` including note steps, validates the steps, and then discards them; only the action label is compiled, and only `rest`, `simplify`, `change_density`, and `shift_register` are compilable (`src/main.ts:389-392`, `src/main.ts:6452-6498`). So the model can say "quieter" or "up an octave" for four beats, every eight beats, in rehearsal mode only, and only after someone clicks the health check button (`src/main.ts:7912-7914`). The other two model uses are a copy editor for proposal prose, forbidden to change anything musical (`src/ollama.ts:276-286`), and a critic that picks one id from a pre-scored candidate list (`src/ollama.ts:288-297`), whose pick the deterministic consensus can overrule.

**What "listening" is.** `src/listening.ts` reads the last 128 symbolic events the engine itself emitted and computes mean velocity, silence ratio, velocity mass by octave, and notes per beat. There is no AnalyserNode and no audio feature anywhere. "Brightness" is which octave the tables use.

**What "taste" and "fitness" are.** Taste is a six-state rule ladder whose only outputs are "mute offbeats" and a velocity multiplier between 0.82 and 1.08 (`src/taste.ts:241-283`, `171-239`). Phrase fitness is four hand-written prosody terms that reward a 0.25-beat pickup, a cadence on degree 5 then degree 1, and long notes on strong beats (`src/prosody-scoring.ts`). The generator in `src/melody-prosody.ts` emits exactly that template by default. So the scorer is the generator's own spec, and generation zero already sits near the optimum. The one term with a non-rule basis is the perspectival `surprise` score, an information-content measure against a count prior built from material in the session (`src/melody-scoring.ts:1211-1316`). That idea is worth keeping.

**What "evolution" is.** Each cycle injects a fresh random batch unrelated to the previous elites, then each elite spawns exactly one child by one operator chosen from `hashText(elite.id:elite.seed:elite.generation)`, which is constant for a stored candidate, so a surviving elite proposes the identical child every generation (`src/candidate-cycle.ts:716-760`). Every mutation re-wraps the result with all connectors set to `density: 0` (`src/phrase-candidate-genome.ts:141`), so the one expressive part of the genome is silenced after a single step. "Diversity" is Euclidean distance between score vectors, not between phrases (`src/candidate-diversity.ts:210-219`). No crossover, no population inheritance. It is a ranking with persistence, not a search.

**What the votes do.** The E3a ear-check votes are written as `song.interplay_vote` events and nothing in `src/`, `server/`, or `scripts/` ever reads them back. They are a log, not a signal. The Up/Down melody votes nudge one weight by 0.025.

**Where the lines went.** Of roughly 27,000 lines in `src/`, about 45 percent is UI, plumbing, and persistence (`main.ts` alone is 8,500 lines, 1,140 of them an HTML template string), 18 percent is offline scoring and evolution, 16 percent is model protocol, and 21 percent touches playback. The 69 review files and 95 "bytes" in 35 days produced 12 inspect-only bytes and a smoke suite that grew from 3 to 80 tests. Your ear appears in the project log five times, all after June 20, always as "pivoted after Arne reported."

---

## Part 2: Why it went stale (the structural reasons)

This is not a matter of missing a few features. Four decisions, each sensible alone, combined to make growth impossible by construction.

1. **There is no ear.** Every judgment in the system is a rule the author wrote. The scorer, the generator, and the mutation operators are three encodings of one 16-beat antecedent-consequent template. Optimizing fitness means conforming to the template. Nothing external (audio, a human, a model, a learned function) ever enters the objective. A system cannot grow past a perimeter that is defined as its fitness function.

2. **The safety doctrine became the design.** "The app owns every note" and "model prose is data, not instruction" were good rails for the first week. They hardened into law (`docs/vision-and-plan.md` course adjustment, every handoff since). The result is that the only component capable of surprising you was forbidden to play. Every course correction (musicality first, song goal, evolutionary composition, ear votes) was re-expressed as another deterministic, inspect-only, scored subsystem, because that was the only shape the rails allowed.

3. **Three frozen bodies.** With three fixed timbres and no effects, there is nothing to hear a difference in. The 2026-07-03 reset diagnosed this correctly ("frozen synth body") but the proposed remedy was still per-player parameter knobs on the same three synths.

4. **The process selected for stale.** Bytes had to be small, deterministic, reviewable by hooks, and smoke-tested, so each one added a rule. Thirty-five of 69 reviews end "Blockers: none" and list forward notes that became the next byte. One JSON field (`registerDelta`) consumed five bytes. The reviewer verified with `window.*` hooks because it could not hear the audio. A listening acceptance test was first written on July 3, the last day of work. The Studio Pattern is a fine way to build infrastructure. It is a bad way to run a creative search, because creative search needs batches of throwaway attempts judged by an ear, not increments judged by a test.

5. **The browser was the wrong home.** Not because web audio is bad, but because a browser is real-time only, cannot batch-render a hundred candidates offline, cannot run audio-understanding models, and exerts a gravitational pull toward panels. Forty-five percent of the code is UI for a system with three sounds.

Verdict on "complete waste of time": no. The principles documents (`docs/principles/`, `docs/session-modes.md`, `docs/producer-proxy.md`, `docs/time-and-lookahead.md`) are a genuinely good design brief and most of their ideas were never built. The code taught you what not to do, which is worth something. But the code itself should be archived, not continued.

---

## Part 3: What to carry forward

### Code (four files, as a quarry, not as a dependency)

| File | Why |
|---|---|
| `src/anchor-phrase.ts` + `src/anchor-phrase-render.ts` | Sparse anchor notes plus parametric connector kernels is a real, compact, human-editable genome with headroom. The only search space in the repo that is not a template. |
| `src/tonal-context.ts` + `src/grow-language.ts` | Small, correct, and the mode naming (Sunshine, Strut, Smoke, Bruise) is the project's voice. |
| `src/melody-scoring.ts` lines 1211-1316 only | The perspectival surprise prior. Rewrite in a page; discard the rest of the file. |
| `server/persistence.mjs` schema | Event-sourced store with branches and candidate lineage. The schema is fine for a real archive once votes become a signal. |

Everything else: `melody-scoring.ts` consensus, all `prosody-*`, all `candidate-*`, `song-form.ts` hook and bridge tables, `taste.ts`, `song-goal.ts` keyword interpreter, the phrase editor, and `main.ts` should not move to the new codebase.

### Ideas (keep all of these)

- Listening frame as a shared object every player sees.
- Imagined, committed, heard as three states of a musical idea.
- Session modes with real breaks, solo practice, rehearsal, performance, reflection. Silence as a state.
- Players as temperaments: subjective, disagreeing ears, not one objective score.
- Delayed-now: thinking happens off the clock and lands on a later bar.
- Producer proxy as ordinary language that players may follow, bend, or ignore.
- Best-moments as a small tray, aggressive purge of the ordinary.
- Multiple terrariums that can hear each other.

---

## Part 4: The recovery direction

Turn the terrarium inside out. The old system was a sequencer with evaluators bolted on. The new one is a search over sound, with ears at the center, and a sequencer is just one kind of body.

Four organs, built in this order.

### 4.1 Ears first

The missing organ. Build it before anything can play.

- **Embedding ear.** Run a local audio embedding model over every rendered clip. CLAP (LAION) is the practical default; MERT or MuQ-MuLan are alternatives. A January 2026 study found pretrained CLAP and MuQ-MuLan embeddings align with human similarity judgments without fine-tuning, which is exactly what we need. The embedding gives you three things for free: similarity between clips, novelty as distance from the archive, and zero-shot text queries such as "sounds like gamelan" or "sounds like a broken elevator chime."
- **Descriptor ear.** Cheap DSP features with librosa or equivalent: onset density, spectral centroid, loudness curve, silence ratio, key clarity, tempo estimate, roughness. These are the behavior descriptors that define the terrarium's map (see 4.3) and the facts the language model gets to reason about.
- **Taste ear, one per musician.** Each player's ear is a small linear probe over the embedding, trained on your votes. A few hundred thumbs up or down is enough for a ridge or logistic probe. Give each player a different vote subset, a different set of CLAP text anchors, or a different weighting, and you have the "ears of the musicians" that disagree with each other. This is the subjective-taste principle, realized in a hundred lines instead of a rule ladder.
- **Verbal ear.** The language model is never shown numbers to rank. It is shown the descriptor facts, the nearest neighbors' names, the CLAP tag hits, and the lineage, and asked to describe and critique in words. Those words become names, captions, and prompts for the next mutation, not scores.

The old `listening.ts` symbolic frame can live on as a fifth ear once a sequencer body exists. It should never be the only one again.

### 4.2 Bodies second, and the genome includes the instrument

Sound variety is not a preset problem. The genome must contain the instrument, so that a mutation can change what a thing is made of, not only what notes it plays.

- Use a headless, offline, programmable synthesis renderer that takes text in and writes a WAV out. SuperCollider in non-real-time mode is the proven choice (the Sound Innovation Engine quality-diversity work at the University of Oslo uses audio graphs in exactly this way); Csound or Faust are acceptable alternatives. Any renderer where a program is the input.
- A body genome is a short program: a SynthDef plus a pattern or score. The language model can write and rewrite these; local coder models know SuperCollider and Csound well enough. Random mutation can perturb parameters and splice subgraphs without the model.
- The new rails replace "the app owns every note." The sandbox owns the render: it must compile, render in bounded time, not be silent, not clip, and stay under a loudness ceiling. Everything inside those rails is allowed, including dissonance, noise, roughness, silence, and broken phrases.
- Offline rendering is faster than real time, so a hundred candidates per hour is cheap on an M4. That is the batch size at which an ear can start to matter.
- The anchor-phrase genome from the old repo becomes one body type among several: a "sequencer body" that renders through a SynthDef. Field recordings and found sound can become another body type later.

### 4.3 Growth as quality-diversity, not hill-climbing

"Grow" means leaps past the current perimeter. Hill-climbing one fitness value can never do that; it does the opposite. The right search shape is MAP-Elites style quality-diversity.

- The terrarium is the archive. The map's axes are descriptors from the ears, for example onset density by spectral centroid, or two principal components of the embedding. Each cell holds the best inhabitant found for that niche.
- A new clip survives if it fills an empty cell, or beats the cell's occupant on a taste ear, or is far from everything in embedding space. Minimal criteria: not silent, not painful, not a duplicate.
- Stepping stones are the point. A weird clip in an empty cell is valuable even if nobody likes it, because its children may land somewhere good. This is the mechanism that gets you "different ideas of what a musical system should be."
- Bands are islands. Each band is an archive with its own ears. Occasionally a clip migrates. An audience band's ears are trained on another band's archive. This is `docs/future-multi-terrarium.md` for free.
- Mutation operators: parameter noise, subgraph splice, crossover of two genomes, and model-authored rewrites prompted by the verbal ear ("make the thing in cell 3,7 but with the attack of cell 1,2"). The model gets to be an author because the ears and the sandbox, not the rules, decide what survives.

### 4.4 Minds for what minds are good at

The local model's old jobs (pick an id, rewrite prose) were jobs it was bad at and that did not matter. Its new jobs are jobs it is good at:

- Write and rewrite body programs.
- Propose structural transformations in words, given descriptor facts and lineage.
- Name things, caption things, write a player's reaction.
- Reflect after a session: what to keep, what to avoid, a prompt seed for next time.

Latency does not matter because nothing is on a playback clock. Thirty seconds per thought is fine when a thought is one of a hundred candidates. Upgrade Ollama and use a current coder-tuned model in the 7B to 30B class for authoring; the exact tag is a per-machine detail. Keep the old projected-JSON validator discipline from `src/thought-protocol.ts` for structured outputs.

### 4.5 The window last

The browser terrarium becomes a viewer: a map of the archive you can click to hear, with lineage lines, player markers sitting on their favorite cells, and a best-moments tray. It plays rendered WAVs. Real-time performance can return later as a body type that streams, once there is something worth performing. Do not build the window until the first listening session has happened.

### On web technology

Keep the web for the window. Move the organism to a local Python process (PyTorch with MPS for the ears, subprocess calls to the renderer, SQLite for the archive, Ollama for the mind). Python is where the audio models, the DSP libraries, and the quality-diversity libraries live. A Node or TypeScript organism would be fighting its ecosystem for every ear.

---

## Part 5: The first spike (two weeks, one script, no tests)

The acceptance test is your ear. Nothing else counts until this passes.

1. One Python script: genome → render 20-second WAV → embed → descriptors → place in a 10 by 10 grid → pick parents → mutate (half random, half model-authored) → repeat for 300 candidates.
2. Output: a folder of WAVs and one static HTML contact sheet with the grid, play buttons, and thumbs up/down that write to a CSV.
3. You listen for an evening. Count how many clips you would play twice. Compare with the current app.
4. If the count is not clearly higher, change the body or the ear and run again. If after two such runs it is still not higher, stop and reconsider.
5. Only after the contact sheet produces clips you want to hear again: train the first taste probe on the CSV, add the second player's ear, and start migrating ideas from Part 3.

Rules for the spike: no tests, no handoff documents, no review queue, no inspect panels. A single `NOTES.md` with the date, what was tried, and what you heard. The first commit to the new repo is the script and the contact sheet, not a plan.

---

## Part 6: Process changes

The Studio Pattern should keep running for infrastructure (the render sandbox, the archive store, the window). For the creative core, change the unit of work.

- Replace bytes with seasons: a week-long run with a target ("fill the sparse-and-bright quadrant", "make a bass body that can growl"), judged at a listening session, not a review.
- The reviewer's job becomes listening and naming what was heard. If the reviewer cannot hear the audio, the reviewer is the wrong instrument for that step; route it to you.
- Tests only for the sandbox and the store. Musical behavior is never pinned by a test; it is pinned by the archive of what survived.
- One log, not sixty-nine review files. Memory should be clips and votes, not prose about clips.
- Keep "model output is data" for structured protocol fields. Drop "the app owns every note."

---

## Part 7: Creative drift (optional, separate from the critique)

Things that would make it stranger and more alive, none required for the spike.

- **Players are ears before they are hands.** Define a musician by what it loves to hear (three CLAP text anchors plus its vote probe) and let it play by searching for things its own ear rates highly. Two players with different ears playing the same body produce different music from the same material.
- **A piece survives if any ear loves it.** Niche by critic, not only by descriptor. The pulse player's favorite cell can be the melody player's least favorite, and both persist.
- **The producer is a text anchor.** Typing "more like rain on a tin roof" moves a CLAP text embedding target that the taste ears blend in for the next season. Players comply, resist, or over-apply by how much weight each gives it.
- **Lineage listening.** Play a clip's ancestors in order. The best-moments tray can hold a lineage, not only a clip.
- **Seasons and extinctions.** Periodically wipe a quadrant of the map. Forced re-colonization is the "little leaps" generator.
- **Found sound as a body.** Short field recordings as raw material that the sequencer body can slice and the SynthDef body can resynthesize.
- **An audience band.** A second terrarium whose only job is to listen to the first and vote with its own ears; its votes become a fourth taste ear for the first band.
- **Weirdness budget.** The minimal criteria are the only rails on content. Everything the old project forbade (dissonance, noise, roughness, long silence, imperfect phrases) is allowed, and the ears decide.

---

## Part 8: Risks of this direction

- **Novelty search drifts into noise.** Pure novelty pressure finds the weirdest corners of the renderer. Mitigation: minimal criteria plus at least one vote-trained taste ear in the survival rule from the start.
- **Short-clip embeddings are coarse.** CLAP was trained on ten-second windows and is weaker on micro-detail. Mitigation: pair it with descriptor features, and treat the vote probe as the ground truth the embeddings serve.
- **Model-authored programs fail often.** Expect a high compile or render failure rate from local models. Mitigation: the sandbox rejects silently and random mutation carries the load; the model's hit rate only needs to be nonzero.
- **Renderer installation friction.** SuperCollider on macOS is a straightforward install, but it is a new dependency. Mitigation: the spike can begin with a pure numpy renderer of three primitives and switch once the loop is proven.
- **Compute per candidate.** Render plus embed plus descriptors should sit around one to three seconds per clip on an M4. If it is slower, shorten the clips before shrinking the batch.
- **The old gravitational pull.** The first instinct will be to add an inspector. Do not. The contact sheet is the inspector until the ear test passes.

---

## Sources consulted outside the repo

- Quality-diversity search in sound generation, University of Oslo RITMO, Sound Innovation Engine line (arXiv 2606.09780 and the EvoMUSART 2024 paper "Towards Sound Innovation Engines Using Pattern-Producing Networks and Audio Graphs").
- Pretrained CLAP and MuQ-MuLan embeddings compared against human similarity judgments (arXiv 2601.19109, January 2026).
- MERT-v2 (non-commercial license) and AllMusicCaps CLAP (512-dimensional, 24 kHz mono) as local embedding options.
- Ollama audio input remains an open feature request; the ears must run outside Ollama, in Python.
