# Plan: the Generative Rhythm arc — the band starts authoring (and developing) ideas

**From:** Claude Code on `mac-mini-pro-m4` (creative advisor + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual
**Date:** 2026-06-13
**Status:** plan / direction — not a review.

## Why this arc exists

Arne's framing: the project currently *arranges and shades three canned ~4-bar loops* very expressively but
cannot *compose or develop* musical ideas — the output has the rhythmic/tonal character of a nursery rhyme
because every axis sits at its simplest setting (even grid, stepwise scale-degree melody, single-mode root
recolor, all material tracing to three hardcoded seeds). The goal: **something that can grow and build on
musical ideas to explore fruitful paths.**

The encouraging part: the *hard half* of "explore fruitful paths" is already built — the **evaluator** (melody
scorer w/ Narmour gap-fill + IDyOM information-content surprise + the inverted-U; form scorer; consensus) and
the **memory** (remember-good, persistence) and the **bounded transform→critique→repair** loop. What is missing
is a **state space made of *ideas*** and a **generator of candidates in it.**

## Arne's locked decisions (2026-06-13)

1. **Rhythm is the first lever.** The cheapest perceptual win — breaking the even-grid feel does more for
   "this sounds alive" per unit effort than anything else, and it is independent of pitch.
2. **A generator may author bounded ideas.** Shift from "nothing authors new material; everything traces to
   app-owned seeds" to **"a generator authors bounded candidate ideas that the app validates + scores, and
   consensus judges."** The model stays a **selector/nudger**, never the final note-emitter.

## Why rhythm is the right place to introduce the generator (the safety argument)

Rhythm is **bounded-by-construction safe.** Onsets are just the non-null entries in `PlayerPatternSource.events`
(`song-material.ts`); `getPatternStep` → `arrangeSongFormPatternEvent` → `materializeNote(tonalContext, …)`
(`transport.ts`) keeps **pitch in-scale no matter what**. So **a rhythm motif is an onset mask over the grid —
it chooses which steps fire, and never touches pitch.** A generated rhythm can be *bad* (ugly, too dense,
arrhythmic) but it can **never be illegal** (out of key). That makes rhythm the lowest-trust-surface domain in
which to prove the "generator authors bounded candidates" paradigm before it is ever applied to pitch/harmony,
where the trust surface is far larger.

This keeps the whole arc's discipline intact, just one level up: like the melody critic *selects an app-owned
candidate*, like the SongGoal *fills bounded knobs* — the rhythm generator *authors bounded onset-pattern
candidates*, the app *validates + scores* them, *consensus* judges, the model *selects*. The new thing is that
candidates are **authored by a generator** rather than tracing to a seed — but in a domain where "authored"
can't mean "out of bounds."

## The deterministic generator: Euclidean (Bjorklund) rhythms

Use **Euclidean rhythms** (Toussaint 2005, "The Euclidean Algorithm Generates Traditional Musical Rhythms";
Bjorklund's algorithm) as the deterministic generator: maximally-even distribution of `k` onsets across `n`
steps, parameterized by `(onsets k, steps n, rotation r)`. This is the rhythmic analogue of the Narmour/IDyOM
grounding the project already uses for melody — deterministic, fully bounded, and it reproduces a huge range of
traditional world grooves (clave, tresillo, etc.) from three integers. It is the floor *and* the fallback *and*
the ruler, exactly like the deterministic interpreters/scorers in the 15–17 arcs.

## The `RhythmMotif` contract (sketch)

```ts
interface RhythmMotif {
  id: string;
  source: "euclidean" | "developed" | "model-selected"; // mock-vs-model seam
  role: PlayerRole;
  steps: number;                 // grid length (e.g. one or two bars at the player's subdivision)
  onsets: readonly boolean[];    // length === steps; the onset mask
  accents?: readonly number[];   // optional bounded accent weights, length === steps
  density: number;               // onsets/steps, for bounded validation
  generator?: { k: number; n: number; rotation: number };  // provenance for euclidean
  brief: string;                 // deterministic human-readable summary
}
```

Plus `validateRhythmMotif` (length === steps; density ∈ [floor, ceiling] per role; not all-on / all-off;
role-aware downbeat rules — e.g. the pulse must anchor beat 1) and bounded clamps — the same validator+fallback
shape used everywhere in the arc.

## Integration point (audible step, R-d)

A rhythm-motif **onset overlay** in the existing `arrangeSongFormPatternEvent` chain: given (player, stepIndex,
section), the chosen motif decides whether the step is an onset, *masking* the seed's onset pattern. Pitch is
untouched (still `materializeNote` on whatever fires). This is the rhythmic analogue of
`applySongSectionDecision` — a per-step decision that can suppress or (carefully, within density bounds) place
an onset, but never changes pitch. v1 should likely **mask within the seed's existing onsets** (thin/displace)
before allowing *added* onsets, to stay conservative; widen once the scorer is trusted.

## The scorer (R-b): complementarity is the soul

A `scoreRhythmMotif` analogous to `scoreMelodyPhrase`, with subscores:
- **syncopation / surprise** — onset information-content vs an inverted-U target per role/section (the rhythmic
  IDyOM analogue);
- **groove / metric anchoring** — downbeat presence + metric-weight alignment (regularity as a *dial*, per
  Arne's standing reproducibility-vs-regularity lens);
- **density fit** — vs section energy + the SongGoal energy/disposition already in place;
- **complementarity / interlock** — the most important: score players *against each other* — penalize everyone
  hitting the same slots, reward pocket / call-and-response / hocket. This is the rhythmic analogue of harmony;
  it is the difference between an ensemble grooving and three players hitting the grid.

## Sequencing (deterministic floor first, audible by R-d)

- **R-a — `RhythmMotif` contract + Euclidean generator + validator (inspect-only).** Generate candidate motifs
  per role; show them + validation in an inspector + a `window.rhythm.*` harness. No playback drive. Floor +
  ruler + fallback.
- **R-b — `scoreRhythmMotif` (inspect-only).** The four subscores above, esp. complementarity. Ground-truth
  ruler; generalize across the three songs. No drive.
- **R-c — development operators + a rhythm bank (inspect-only).** Operators: rotate/displace, add/thin (density),
  augment/diminish, accent-shift, syncopate. `developRhythmMotif` greedy pass toward a scored target (mirror
  `repairMelodyPhrase`). A **rhythm bank** (remember-good): well-scored grooves are remembered and become
  development candidates later in the form / across sessions — this is literally "build on ideas."
- **R-d — drive playback (AUDIBLE — the payoff).** A *chosen* motif drives the onset mask through the existing
  transport, applied at a section/phrase boundary via `refreshLookaheadSchedule` (reuse the SongGoal-apply
  template: cancel slow-thinking, clear ledger, clear fallback timers, refresh), measure-before-drive (audition
  + score shown, human/consensus selects), persist `rhythm.motif_set`. Pitch untouched → in-scale guaranteed.
- **R-e — generator → critic + consensus, bank develops.** Route generated candidates through the existing
  critic (model **selects** an app-owned rhythm candidate — same enum/validator boundary as the melody critic)
  and **consensus** (role affinities: pulse favors groove/anchor, melody favors syncopated surprise, bass
  favors interlock with pulse), and let the bank accrue + develop good grooves across the form. Closes "grows
  and builds on rhythmic ideas, explores fruitful paths."

## Disciplines to hold

- **Generator authors candidates; app validates + scores; consensus judges; model selects/nudges.** The model
  never emits a final rhythm directly — it picks among app-validated generated candidates (same boundary that
  carried 15–17), now over a *generated* candidate space.
- **Deterministic floor first** (Euclidean generator + validator + scorer) before any model selection — ruler +
  fallback.
- **Rhythm masks onsets, never pitch.** The audible overlay only chooses which grid steps fire; pitch stays
  in-scale by construction. Keep this invariant explicit and test it (heard pitches must remain in-scale with
  any motif applied).
- **Reproducibility:** `(k, n, rotation)` and the operators are deterministic; persist the chosen motif so a
  take is reproducible from it. Model selection is the one nondeterministic step, captured by persisting the
  choice.
- **Regularity is a dial, groove is the goal** (Arne's lens): the scorer should treat metric regularity as a
  tunable target (inverted-U surprise), not maximize either order or chaos.
- **Measure-before-drive; audible by R-d;** don't bury the payoff behind the full generator/critic/bank stack.

## Open questions for Codex (pick as you build)

1. Motif grid length — one bar vs two — and whether v1 masks *within* the seed's onsets (conservative) before
   allowing added onsets.
2. The complementarity metric's reference — score each player against the *committed* onsets of the others in
   the same window?
3. Where the motif applies first — a single role (e.g. give the pulse/bass a generated groove) before the whole
   ensemble, to keep R-d small and legible.

— Claude
