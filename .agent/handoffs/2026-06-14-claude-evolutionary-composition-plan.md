# Plan: Evolutionary Composition — players write many candidate songs, keep the best, purge the rest

**From:** Claude Code on `mac-mini-pro-m4` (creative advisor + reviewer)
**To:** Codex on `macbook-pro-m5`, and any agent picking up a track (e.g. Gemini via Antigravity)
**Relay:** Arne, manual
**Date:** 2026-06-14
**Status:** plan / direction. Self-contained — assume the reader has **no** prior conversation context.

---

## 0. North star (Arne's words, made concrete)

> "Get to the spot where our players are writing lots of candidate songs stored in our SQLite
> database, retaining the best of the best of songs and elements, and purging the rest as we
> progress."

That is an **evolutionary search over musical material**: bounded **generators** author candidate
songs *and* song-elements (melodic phrases, grooves, harmonic plans, forms); the existing **scorers**
act as the **fitness function**; a **SQLite-backed population** stores them with scores + lineage;
**selection** keeps the elite and **purges** the rest; **development operators** mutate survivors into
the next generation. Over sessions, the band's repertoire *evolves* and improves. This is the engine of
"grow and build on musical ideas to explore fruitful paths."

## 1. Where we are right now (read this first)

The project was three hardcoded ~4-bar loops, arranged/shaded very expressively but unable to *compose*.
Recent work added a SongGoal arc (key/mode/tempo/form + bounded character nudges) and, most recently, a
**generative leap that is already landed on a branch:**

- **Branch `claude/prosodic-melody-leap` (commit `4b7a85e`, base `main`), unmerged.** It adds
  `src/melody-prosody.ts`: a deterministic generator that builds the melody line as **prosody** —
  metrical feet (iamb/trochee/anapest) assembled into antecedent/consequent phrases with anacrusis
  pickups, an arch contour, breath between phrases, a suspended-dominant "question" answered by a
  tonic-resolved "answer", and stress-shaped dynamics. Wired behind a **default-off** `melodyPhrasing`
  handler in `transport.ts` (`buildPlayerPatterns` swaps the melody `PlayerPatternSource`) + a
  `window.prosody` toggle in `main.ts`. Verified audibly: OFF = 11 melody notes all `dur 0.5` (even
  eighths); ON = varied `0.24/0.25/1.5` long-short phrasing, pickups into a held cadence, velocity
  0.16–0.43, all in-scale. build/db:smoke green, smoke 37/37 (default-off path unregressed).
- **Known seam:** prosody is proven in the *verse*; in the chorus, `createChorusMelodyEvent`
  (`song-form.ts`) still authors its own hook and overrides the phrase. Reconciling that is Track B work.

Merge `claude/prosodic-melody-leap` (or rebuild on it) before extending the prosody track.

## 2. The non-negotiable disciplines (hold these on every byte)

These carried the whole project and **must not loosen**, even as generators start authoring material:

1. **Generators author bounded candidates; the model is a selector/nudger, never the final emitter.** A
   generator may invent a candidate, but it emits into a *validated, bounded* space; any LLM involvement
   *selects among app-owned candidates* or *nudges bounded knobs* — it never emits raw notes.
2. **In-scale by construction.** Pitch is always `noteFromScaleDegree(tonalContext, degree, octave)`
   (`tonal-context.ts`), which wraps any integer degree into the active scale. Generators shape
   *rhythm/contour/选择*, never raw pitch strings. (This is why rhythm/prosody are safe to generate: a bad
   candidate can be ugly, never out-of-key.)
3. **Deterministic floor first.** Build the heuristic generator + the scorer (the ruler) *before* any
   model-in-the-loop. Seed → deterministic output, so candidates are reproducible.
4. **Validate + clamp every candidate.** Mirror the existing `validate*` + clamp pattern (see
   `song-goal.ts`, `melody-scoring.ts`): bounded ranges, closed vocabularies, safe fallback.
5. **Measure before drive.** A candidate is auditioned/scored before it is allowed to drive playback;
   nothing silently rewrites what plays.
6. **Persistence is event-sourced + dev-only.** SQLite via Node `node:sqlite` behind the dev Vite
   middleware (`/api/persistence/*`); append-only `events` + `sessions`. The candidate store extends this
   (see Track A for the one allowed addition: a mutable, capped population table).
7. **Per-byte hygiene:** small branch (`codex/byte-*` or `agent/*`), `npm run build` + `npm run smoke` +
   `npm run db:smoke` + `git diff --check` + `npm audit` green; Claude reviews on an unmerged
   `claude/*-code-review` branch.

**Superseded:** the earlier Euclidean-rhythm generator idea (`claude/generative-rhythm-arc-plan`) is
**dropped** — Arne finds Euclidean hollow (maximal evenness is the opposite of groove). Use the
**functional-interlock** model in Track C instead.

## 3. Core abstractions (the shared contract all tracks build toward)

```ts
type CandidateKind = "song" | "phrase" | "groove" | "harmony" | "form";

interface Candidate {
  id: string;
  kind: CandidateKind;
  genome: unknown;          // serialized, validated bounded spec (e.g. a PlayerPatternSource for a phrase)
  scores: Record<string, number>;   // per-objective fitness from the scorers
  fitness: number;          // aggregate (or store a Pareto rank)
  parentId?: string;        // lineage — which candidate this developed from
  generation: number;
  seed: number;             // reproducibility
  status: "alive" | "elite" | "purged";
  createdAtBeat?: number;
}
```

- **Genome** = a validated, bounded spec, never raw audio/notes. A phrase genome can be the
  `PlayerPatternSource` the prosody generator already emits; a groove genome is an onset/accent spec; a
  song genome references its element candidates by id.
- **Fitness** = the existing scorers (`scoreMelodyPhrase`/prosody, `createFormScore`, the new rhythm
  complementarity scorer, consensus) combined multi-objectively. Start with a weighted scalar; consider
  Pareto/elitism later.
- **Population** = bounded per-kind; selection keeps the top-N (elite), purges the rest.

## 4. The work, sliced into parallelizable tracks

Tracks A/B/C are largely independent (data / melody / rhythm); D composes them. Each is a sequence of
small bytes; first bytes are spelled out, later ones sketched.

### Track A — Candidate store + evolution engine (backend; no audio; great for a parallel agent)
The backbone of Arne's SQLite vision. Independent of audio playback, fully unit-testable.
- **A1** — `Candidate` contract + a **mutable, capped `candidates` SQLite table** (id, kind, genome JSON,
  scores JSON, fitness, parentId, generation, seed, status) with write/query/cap APIs, alongside
  append-only `candidate.*` audit events (created/scored/retained/purged) for provenance. Inspect-only.
  Files: extend `persistence.ts` + the dev persistence middleware; new `candidate-store.ts`.
- **A2** — fitness aggregation: combine per-objective scores → `fitness` (weighted scalar first; document
  the weights as tunable). Pure function.
- **A3** — selection + bounded population: keep top-N per kind as `elite`, mark the rest `purged`, enforce
  the cap (delete/tombstone). Deterministic given scores. Emits `candidate.retained`/`purged` records.
- **A4** — development: take an elite candidate, apply a (track-provided) mutation operator → child with
  `parentId` + incremented `generation`. Lineage forms a tree.

### Track B — Prosody: score, develop, reconcile (melody; builds on the landed leap)
- **B1** — `scoreProsody(phrase, meter)`: long/short richness (inverted-U, not even/not random),
  anacrusis presence, antecedent-consequent shape (suspended question → resolved answer), and
  **anchor-vs-contrast scored against the heartbeat/meter** (does the phrase lock to or pull against strong
  beats, and does it choose well). Pure ruler. Files: new `prosody-scoring.ts` consuming the
  `PlayerPatternSource` from `melody-prosody.ts`.
- **B2** — prosody **development operators**: re-foot, shift the anacrusis, alter the cadence, vary the
  contour → produce candidate variants of a phrase (these become Track-A `phrase` candidates).
- **B3** — **reconcile the chorus seam**: teach `createChorusMelodyEvent` (`song-form.ts`) to *develop*
  the active prosodic phrase rather than replace it, so the phrase carries through the whole form.
- **B4** — feed prosody candidates into the store (Track A): generate → `scoreProsody` → store → select.

### Track C — Groove: functional interlock (rhythm; NOT Euclidean; independent track)
The "thump/smack/sizzle" model. Compelling rhythm lives in the *interaction* of functionally-differentiated
voices and in *characterful deviation*, never in evenness.
- **C0 (design):** three functional voices — **Anchor** (thump/kick: beat/downbeat, "where is one"),
  **Response** (smack/snare: backbeat answer), **Subdivision** (sizzle/hat: the feel + accent texture).
  The atom is **onset + accent/ghost level**, not a boolean. A groove is an onset/accent mask over the
  grid — it never touches pitch (same safety as prosody).
- **C1** — `RhythmMotif` contract + a **functional-interlock generator** parameterized by role targets,
  a **syncopation budget** (formal metric-tension dial — Longuet-Higgins/Lee — targeting an inverted-U),
  complementarity strength, and call-response coupling. Deterministic, bounded. Inspect-only.
- **C2** — `scoreGroove`: **resultant balance from uneven parts** (the composite covers the grid though no
  voice is even), syncopation-vs-inverted-U, call-response coupling, and **metric clarity** (can you still
  find "one"?). Complementarity is the soul — score voices *against each other*. Pure ruler.
- **C3** — drive a chosen groove (onset/accent mask) audibly through the transport (reuse the
  `melodyPhrasing`-style handler + the SongGoal-apply/refresh template). Measure-before-drive.
- **C4** — feed groove candidates into the store (Track A).

### Track D — The evolutionary loop (composes A+B+C)
- **D1** — orchestrate a cycle: generate candidates (B/C generators) → score (B/C scorers) → store (A1) →
  aggregate fitness (A2) → select + purge (A3) → develop survivors (A4 + B2/C operators). Bounded per
  cycle; deterministic-floor; measure-before-drive.
- **D2** — assemble + perform the current **elite song** from the best elements (best phrase + best groove
  + best form), and let it keep evolving as better elements arrive. This is the audible payoff: the band
  plays its best-so-far, and it gets better.
- **D3+** — model-in-the-loop *selection/nudging* over the evolved candidates (the critic/consensus you
  already have), and cross-session retention so the repertoire persists and compounds.

## 5. Suggested ownership (Arne routes)

- **Codex** — **Track A** (candidate store + evolution engine): well-specified, testable, no audio-clock
  flakiness, and it is the heart of the SQLite vision. Strong fit for the disciplined byte cadence + my
  review loop.
- **Gemini / Antigravity agent** — **Track B1+B2** (prosody scorer + development operators): pure
  functions over the already-landed `melody-prosody.ts`, fully unit-testable, no audio drive needed —
  safe for a cold agent. (Hand it this doc + the prosody branch.)
- **Claude (me)** — **Track C** (functional-interlock groove) and **B3** (chorus reconciliation): the
  parts that most benefit from the conversation context + audible verification, plus reviewing A/B as they
  land.

## 6. Open design decisions (flag, don't block)

1. Population store: mutable capped `candidates` table (recommended, matches "purge") vs pure event-sourced
   projection. Recommend mutable table + append-only audit events.
2. Fitness: weighted scalar (start here) vs Pareto/multi-objective elitism (later).
3. Cross-session vs within-session evolution — start within-session, persist for cross-session in D3.
4. Song genome: references element candidate ids (recommended — recombination of best elements) vs an
   inlined spec.

— Claude
