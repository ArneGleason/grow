# Kickoff: Byte E4 — No two songs alike (Codex)

**From:** Claude Code (architect/listening lead) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-07-03
**Branch off:** `codex/byte-e3b-starter-material-variety` tip (or main once E3b merges) — state your base sha.
**Design ref (READ FIRST):** `2026-07-03-claude-composition-collapse-and-variety-arc.md` (this branch) — the
four-collapse diagnosis with code receipts. E4 fixes collapses 1+2. E5 (structure/harmony), E6 (voices),
E7 (articulation) follow. Votes stay paused.

## Goal
Ten different prompts, zero overrides → ten different musical propositions. Two halves, one audible outcome:
**(A)** unpinned goal knobs become seeded *choices* from wide bands instead of constants; **(B)** the melody
generator gains **phrase-plans** — a seeded structural plan chosen before generation — instead of the single
hard-coded archetype.

## Half A — unpinned means chosen, not defaulted (`song-goal.ts`)

- Track, per knob, whether the prompt (or an explicit UI override) **pinned** it. Detection behaves exactly
  as today; pinned knobs are untouched.
- For **unpinned** knobs, draw seeded values from wide, musically weighted bands:
  - **tempo:** 66–152 BPM, weighted by detected energy cues (calm words pull low, driving words pull high),
    with real spread inside the band — not bucket centers.
  - **mode:** across **all six** realizable modes, weighted by brightness cues; there is no constant fallback
    anymore.
  - **tonic:** across the supported tonic vocabulary (audible as register/pitch-height difference).
  - **form variant:** across the whole `FORM_VARIANTS` set.
  - **energy / surprise / sectionEmphasis:** spread within their valid ranges rather than midpoint defaults.
- **Seeding & regeneration:** goal draws are seeded by `hash(prompt) ⊕ materialSeed` (the per-song-entry seed
  that already persists on library entries). Same song entry → identical goal forever (replay holds); pressing
  "New song" with the *same prompt* gets a fresh materialSeed and therefore a fresh draw. No schema change —
  `materialSeed` already persists.
- `validateSongGoal` bounds are unchanged — draws land inside existing clamps by construction.

## Half B — melody phrase-plans (new `src/melody-plan.ts` + `melody-prosody.ts`)

- **`MelodyPlan`** (closed enumerations, plain data, JSON-able):
  - `phraseStructure`: `"2-even" | "2-uneven" | "3-phrase" | "4-short"` — with explicit beat allocations for a
    16-beat pack (e.g. 2-uneven = 6+10).
  - `motifScheme`: `"AAB" | "ABA" | "ABAB'" | "through" | "call-echo"` — A-repeats reuse the earlier phrase's
    anchor skeleton (transposed/lightly varied); primes vary the tail.
  - `contour` per phrase: `"arch" | "descent" | "climb" | "valley" | "pedal-leap" | "zigzag"`.
  - `cadences`: mode-aware closed pairs — final target ∈ {1, 3, open-on-5, open-on-2}, internal targets ∈
    {5, 4, 2, 7} — not always 5→1.
  - `anacrusis`: `"none" | "light" | "pickup-run"`; `densityFamily`: `"sparse" | "flowing" | "busy"`;
    `registerBase`: octave 3 | 4 | 5.
- **`chooseMelodyPlan(seed, goal?)`** — deterministic; goal cues weight the choice (busy prompts → busier
  families) but every family is reachable from some seed.
- **`generateProsodicAnchorPhrase(input)`** accepts an optional `plan` (default: `chooseMelodyPlan(seed)`, so
  existing callers stay source-compatible). The plan drives skeleton construction: segment boundaries from
  `phraseStructure`; per-phrase degree walk from `contour` (replacing the single arch walk); cadence degrees
  from `cadences`; A-repeats per `motifScheme`. Feet/stress machinery is reused inside phrases.
- **One source of truth for melody shape:** E3b's `melodyStyle` profile maps into plan-choice weights (or is
  derived *from* the chosen plan for display) — it must not fight the plan. Reconcile and say which way you went.
- Everything still flows through `normalizeAnchorPhrase` + `renderAnchorPhrase` → bounded, in-scale,
  deterministic. The editor (`fromProsody`), catalog, and candidate paths keep working — the phrase is still
  a plain `AnchorPhrase`.

## Code boundaries
- **Touch:** `song-goal.ts` (unpinned-draw logic), new `melody-plan.ts`, `melody-prosody.ts`
  (plan-parameterized skeleton), starter-material melody path (pass goal/plan through), unit specs, smoke.
- **Do NOT touch:** scheduler/lookahead, transport/audio, candidate store/persistence/server/schema,
  validators' bounds, scorer, motif-memory/interplay, vote UI. No new persistence (reuse `materialSeed`).
- Note: the default prosody line for a given seed **will change** (that is the point). Update any test pinned
  to the old archetype (e.g. "cadence is always 5→1") to plan-relational assertions.

## Tests
- **Unit — spread:** over N prompt-hash seeds: tempo draws span ≥ 60 BPM of the band; all six modes occur;
  ≥ 3 form variants occur. Pinning: "slow dorian waltz at 72 bpm" pins dorian + 72 + waltz-ish form; UI
  overrides still pin.
- **Unit — plans:** `chooseMelodyPlan` deterministic; over N seeds ≥ 12 distinct plans; each enumeration value
  reachable. Structural: a given plan yields matching segment allocations, cadence degrees, and (for AAB/ABA)
  a recognizable transposed repeat of the A skeleton; `through` yields no repeat.
- **Smoke (hermetic):** five fixture prompts, no overrides → ≥ 4 distinct modes, tempo spread ≥ 40 BPM,
  ≥ 3 distinct phrase structures (assert via goal readout + plan state, e.g. a read-only
  `window.melodyPlan.getState()` or plan metadata on the phrase); same entry re-selected → identical goal+plan
  (determinism); new song, same prompt → different materialSeed → different draw. Note the final smoke count.

## Acceptance (gauntlet + ear)
`npm run build` (0) · unit suites green · `npm run smoke` twice on a non-clean store · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` unchanged. **Listening test (Arne's, the bar for done):** five one-line
prompts, generate five songs, touch no overrides:
1. At least four audibly distinct tempo/mode propositions — hearable without opening Inspect.
2. **The hum test:** after hearing song A's melody, hum it over song B — if it fits, E4 failed. Shape, cadence,
   and phrase count should differ audibly.
3. Re-open a song → same song every time (replay); "New song" with the same prompt → a different proposition.

## Out of scope
E5 (per-section progressions, section-differentiated material, bridge moves) · E6 (voice palettes/timbre) ·
E7 (articulation) · vote UI · any model-authored note generation.

## Handoff back to Claude
Commit sha + `git show --stat`; how you reconciled E3b styles with plans; the spread numbers your unit tests
measured (modes/tempo/plans over N seeds); smoke count; and one line on the most different pair of songs you
generated — what a listener would say distinguishes them.
