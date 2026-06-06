# Claude Planning Review: Grow Byte 12b (Make Song Sketch Song-Aware)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed against:** `main` at `1b24a0f` (Byte 12a merged)
**Branch:** `claude/byte-12b-planning-review` (planning artifact; no code)

## Recommendation

**Approve your proposed slice (12b-a), with refinements.** "Make sketches materially different per selected
song, keep them inspect-only, touch no playback/transport/slow-thinking, add a smoke assertion that
switching songs changes more than id/title" is exactly the right next step and exactly the size it should be.
The key insight from reading `song-material.ts`: the differentiation lever already exists in
`SongMaterial.patterns`, and it is *measurable* and *song-distinguishing* - so 12b-a can be a pure,
deterministic derivation with no new concepts. It also dissolves the `scale[6]` problem for free (see #3).

## What the patterns actually give you (grounding)

Each song carries per-player `PlayerPatternSource { subdivisionBeats, events: (PatternNoteSource|null)[] }`.
Computed across the three current songs, these differ in ways that match their descriptions:

- **Density (non-null / slots), melody:** Lantern ~0.56, Switchback ~0.58, **Glass ~0.31** (the "sparser
  loop with wider air" - real, not just a label).
- **Bass harmonic roots (scale degrees):** Lantern `{0,4,6}`, Switchback `{0,4,5,6}`, Glass `{0,3,6}` -
  distinct per song, and exactly the right source for a chord/root plan.
- **Onset placement / syncopation:** derivable from which subdivision slots are filled (Switchback is the
  "more syncopated" one).
- **Loop length:** Switchback's bass/melody loops are 6 beats (12 x 0.5) vs 8 for Lantern/Glass.
- **Register span / velocity range** per player, also derivable.

So the sketch can become genuinely per-song from `patterns` alone - **without** needing per-song tonal
context (which does not exist in `SongMaterial` today; `world.getTonalContext()` is the same C mixolydian
for all three). That is important: the differentiation in 12b-a must come from *patterns*, not tonal context.

## Answers to your five focus questions

### 1. How should `SongSketch` start using `SongMaterial.patterns`?
Derive a small set of **per-song measured features**, then build the sketch from them. Smallest honest set:
- **Chord/root plan from the bass pattern's scale degrees** (in onset order, deduped or windowed into the
  two sections). This is the single highest-value change: it is harmonic (bass = roots), song-specific, and
  mode-robust by construction. Lantern bass `{0,4,6}` -> a different plan than Glass `{0,3,6}`.
- **Per-player density** (non-null/slots) -> feeds assignment briefs ("bass is sparse here - you own the
  silence" vs "bass is active - choose where to relax") and/or a per-section density target.
- Optionally **loop length** and **melody register span** for the section cue / melody brief.
Keep the derivation a **pure function of `(patterns, tonalContext, roster)`** - no `currentBeat` dependence
in the musical content (currentBeat stays metadata on `createdAtBeat` only), so the same song always yields
the same sketch. `createInspectOnlySongSketch` already receives the `SongMaterial`; it just needs to *read*
`song.patterns` instead of only `song.id`/`song.label`. Read-only - never mutate the shared pattern arrays
the scheduler also consumes.

### 2. Chord-plan vocabulary - note roots, roman numerals, or other?
**Make scale-degree-derived roman numerals (or degree integers) the canonical stored form; resolve to note
names only in the inspector.** The source data is scale degrees, so roman numerals/degrees are the natural,
key-and-transposition-independent representation, and they keep one consistent vocabulary (fixing the 12a
inconsistency where the main path stored note names like `"C"` but the empty-scale fallback stored `"I"`).
For a stub, degree-based roots without chord quality are fine (`I`, `bVII`, `IV`); derive quality from the
mode later if wanted. If you prefer concrete roots in the UI, resolve `degree + tonalContext -> pitch` at
render time - but do not store note names as canonical (that bakes in the current key). Minimal-diff option:
keep `chordPlan: readonly string[]` but fill it with roman-numeral strings, and resolve note names for
display; no type change required.

### 3. How to avoid hardcoding `scale[6]` as flat-seven?
**Stop indexing fixed scale positions entirely** - derive the plan from the song's *actual* degrees (#1).
That is mode-robust automatically: whatever degrees the bass uses are whatever they are, in any mode. If you
ever need a fallback for a degenerate (empty) pattern, derive it from degree *frequency*, not a fixed index.
This makes the `scale[6]` mode-sensitivity tripwire moot rather than patched. (For the record: `scale[6]` is
the idiomatic bVII in the current flat-7 modes, so 12a is fine today - this just removes the latent problem
before more songs/modes arrive.)

### 4. What stays inspect-only for 12b vs waits for a later byte?
**12b-a stays purely deterministic + inspect-only.** In scope: read patterns, compute features, build a
song-specific sketch, render it, expose via `window.song.getSketch()`. Out of scope (later bytes):
- Any **mock proposal/response** object or model-authored songcraft (your 12b/later).
- **Section *detection*** / multi-loop forms - the songs are single loops, so keep "sections" as an honest
  *proposed overlay* over the one loop (e.g. Gather = loop as-is, Answer = a thinned/contrasted variation),
  not a claim that the song has a bridge. Two proposed sections is fine; just don't over-claim structure.
- **Persistence / versioning / status beyond `"draft"`**.
- **Anything that drives playback/transport/scheduling** - hard line, unchanged.

### 5. Smoke that proves the byte without coupling to generated prose
Assert **structure and cross-song difference**, never exact cues/briefs. Recommended:
- **Cross-song difference beyond id/title:** for two songs, assert at least one musical field differs, e.g.
  `expect(lantern.sections[0].chordPlan).not.toEqual(glass.sections[0].chordPlan)` (or compare a derived
  per-player density vector). This is your "more than id/title" assertion.
- **One or two directional/semantic invariants** (robust to formula tweaks, grounded in the descriptions):
  - Glass melody density `<` Lantern melody density (sparsity is real).
  - Switchback has more off-beat onsets (or a different loop length) than Lantern.
  - Each sketch's chord plan is a non-empty subset of the song's actual scale degrees (proves it is
    *derived from the song*, without pinning the exact formula).
- **Keep the existing identity assertions** (id/status/sourceSongId/roster) but drop any reliance on exact
  cue/brief text.
Avoid: equality to a hardcoded chord array, exact brief/cue strings, exact question wording - those couple
the test to prose and will fight iteration.

## Risks / tight implementation boundary

- **Read patterns, never mutate them.** The scheduler consumes the same `SONG_MATERIALS` arrays; the sketch
  derivation must be read-only and allocate its own derived values. (Pure function, no shared mutable state.)
- **Differentiation must come from `patterns`, not tonal context** (tonal context is song-invariant today).
  If a degree->note-name display path is added, it still reads the constant tonal context - fine, but the
  *content* difference has to be degree/density/rhythm based.
- **Keep it pure & deterministic:** same song -> same sketch (content independent of `currentBeat`,
  transport status, and live listening frame). Do not pull from the live event ledger - that would make the
  sketch time-varying and is a different (later) idea.
- **No type churn if avoidable:** the minimal version keeps the `SongSketch` shape, only changing how
  fields are *filled* (chordPlan = derived roman numerals; briefs reference derived density). Add fields
  (e.g. `degrees`/`densityByPlayer`) only if a smoke assertion genuinely needs them exposed.
- **Don't grow the section model** into structure detection (scope creep toward 12b/12c).
- **Performance:** 12a rebuilds the sketch every render frame; once it does real pattern crunching, memoize
  on `(songId, tonalContext, roster)` so per-frame derivation does not scan every pattern each rAF.

## Suggested 12b-a definition of done

- `createInspectOnlySongSketch` reads `song.patterns` and produces a chord/root plan derived from the bass
  degrees and assignment briefs that reference per-player density (or similar measured features).
- Switching songs changes chord plan and/or assignments, not just id/title - proven by a smoke assertion of
  cross-song difference plus one directional invariant (Glass sparser than Lantern).
- Chord plan uses one canonical vocabulary (degree-based roman numerals), resolved to note names only for
  display.
- No playback/transport/slow-thinking/validator change; still inspect-only, not persisted, does not drive
  music. `npm run build` + `npm run smoke` green; `git diff --check` clean.

## Verdict

**Proceed with 12b-a as scoped, with the refinements above.** The slice is correctly sized, the lever
(`patterns`) is already present and measurably song-distinguishing, and deriving the chord plan from real
bass degrees resolves both the song-label-deep gap and the `scale[6]` mode tripwire in one move. Hold the
mock proposal/response and any section *detection* for a later byte.
