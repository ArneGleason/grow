# Kickoff: Byte E1 — interplay MVP: the band starts listening (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-27
**Branch off:** current `origin/main` (`b2daca6`). State your base sha back.
**Design ref (READ FIRST):** `2026-06-27-claude-course-correction-ears-and-interplay.md` — this byte is
Move 1 of a course correction; the *why* matters to the *how*. Both docs live on branch
`claude/grow-language-design-and-roadmap`.
**Spikes:** please HOLD `byte-wild-song-draft-a` / `byte-connector-song-spike-a` (unmerged) — the design
note explains why. `byte-midi-export-a` can be submitted for review separately if you want it landed.

## Goal
Make two players **musically respond to each other** for the first time: melody and bass share a **motif
memory** over a simple two-chord alternation; the bass **answers** what the melody just played (quote /
vary), and a per-section **tension curve** drives how busy and how high they play. Success is *audible*:
a listener should be able to point at the bass and say "it just echoed the melody."

## The mechanics

### 1. Motif memory (new module, e.g. `src/motif-memory.ts`)
- A bounded pool (cap ~16) of **motifs**: short fragments `{ playerId, barIndex, degrees: number[] (engine
  scale degrees), rhythm: {startBeat, durationBeats}[] , dynamics }` — 2–6 notes each.
- **Capture:** at each bar boundary, extract the melody's just-played bar (from the same pattern data the
  transport schedules — not from audio) into the pool. Oldest evicted first.
- Pure, deterministic, unit-testable: `capture(pattern, barIndex)`, `latest(playerId)`,
  `vary(motif, op, context)`.

### 2. Answer behaviors (deterministic, seeded — variation is a function of seed + bar)
`vary(motif, op, context)` with a small closed op set for E1:
- **quote** — restate the motif's degree contour, transposed so it lands on/targets the **current chord
  root** (see §3), rhythm simplified to the bass's grid.
- **invert** — mirror the contour around its first degree, same transposition rule.
- **thin** — keep the motif's strongest 2–3 notes (by dynamics/duration), same transposition rule.
Choice among ops = deterministic function of (seed, barIndex). **All output = integer scale degrees**
(in-scale via `noteFromScaleDegree` downstream — E1 stays diatonic; tension/color is E2).

### 3. Two-chord alternation (minimal harmonic context)
- A simple per-bar alternation for starter/library songs: bar's chord root alternates tonic ↔ one
  mode-appropriate contrast root (reuse/derive from `MODE_ROOT_CYCLES` in `song-starter-material.ts` — e.g.
  take entries [0] and [2] of the cycle). Expose `chordRootAtBar(barIndex)`; the bass's answers transpose
  toward it. No chord voicings yet (E2) — this is a *target*, not a harmony engine.

### 4. Call and response (the wiring — reuse the proven swap path, NO new scheduler)
- The melody keeps its existing source (prosody/editor/audition — untouched).
- The **bass** gains an interplay source: each bar (or each lookahead refresh), build the bass's next bar
  from `vary(latest("melody"), chosenOp, {chordRoot})`, falling back to its current starter/canned pattern
  when the pool is empty.
- Integrate exactly like the existing melody override: a `bassPhrasing`-style handler consulted in
  `buildPlayerPatterns` + updates applied via **`refreshLookaheadSchedule()`** (the D2/D5 swap mechanism,
  proven safe). **No new scheduling/audio path.**
- Update cadence: refreshing once per bar boundary is enough; don't refresh more than the existing
  lookahead machinery already tolerates.

### 5. Tension curve (minimal, E1 version)
- Per-section scalar from the existing song form (e.g. verse 0.3, chorus 0.7, bridge 0.5 — or derive from
  the SongGoal `sectionEmphasis` when present).
- Drives, for the *answering* bass line (and optionally melody density if trivial): note density (thin vs
  full answers) and register (octave up at high tension). Bounded, clamped, deterministic.

### 6. Scope & toggle
- **ON by default for library/starter songs; OFF for the hidden canned templates** (so the old demo material
  is unchanged as a control). A small toggle (UI or `window.interplay.setEnabled`) for A/B listening.
- Expose `window.interplay.getState()` (read-only): pool contents, last answer {sourceBar, op, chordRoot,
  resultingDegrees}, enabled flag — so review can verify who quoted whom, deterministically.

## Invariants / guardrails
- **Code rails stay:** bounded pool, clamped values, integer scale degrees only (diatonic in E1),
  deterministic given (seed, bar), no new persistence/schema, no new audio path, melody's existing
  source precedence (editor override > audition > prosody) untouched.
- **Music rails loosen (per the design note):** the *point* is that the bass changes bar to bar in response
  to the melody. Do not flatten the behavior to make tests easier — make the tests assert the relation
  instead (below).
- Editor/catalog/evolution/persistence untouched. Bass interplay is a performance-time source, not a stored
  genome (persistence of liked answers comes with E3/E5).

## Tests
- **Unit** (`motif-memory.unit.spec.ts`): capture extracts the expected fragment; pool caps/evicts; each op
  (quote/invert/thin) produces the specified transform (assert degree relations, e.g. invert mirrors
  intervals; quote preserves contour shape; thin keeps ≤3 notes); transposition targets the chord root; all
  outputs integer degrees; deterministic for a fixed (seed, bar).
- **Smoke (hermetic):** with interplay ON, after melody plays bar N, the bass's bar N+1 pattern equals
  `vary(capturedBarN, op(seed,N), chordRoot(N+1))` (assert via `window.interplay.getState()` + the bass
  pattern — an exact relational assertion, not a golden file); with interplay OFF, bass pattern = its
  starter/canned pattern unchanged; canned template songs are byte-identical to before (control); tension
  curve changes answer density/register between verse and chorus. Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green (incl. the new one) · `npm run smoke` (non-clean store, run twice) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will additionally **review by ear**:
reconstruct several consecutive bars live and verify (a) the bass audibly quotes/varies the melody's prior
bar (relation verifiable via `window.interplay.getState()`), (b) answers land toward the alternating chord
roots, (c) verse vs chorus answers differ in density/register, (d) everything in-scale, (e) canned songs
unchanged, (f) toggle works. **The bar: a listener can hear the bass answering. If it's only provable by
inspector, it's not done.**

## Out of scope (explicitly)
- Chords/voicings, tension tones, rendering `color` → **E2**. Human votes / ELO ear → **E3**. Corpus
  surprisal ear → **E4**. Persisting answered material / evolution re-aim → **E5**. Pulse interplay,
  melody-answers-bass (bass→melody direction), per-player rosters. Any change to scorer/persistence/schema.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: motif capture/vary as pure tested module; bass
answers via the existing refreshLookahead swap path (no new scheduler); ON for library songs / OFF for
canned (control) + toggle; tension curve wired; `window.interplay.getState()` exposed; smoke count; and one
line on what you can *hear* when you A/B the toggle — that sentence is the point of the byte.
