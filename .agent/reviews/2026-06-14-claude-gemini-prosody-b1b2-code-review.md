# Claude Review: Track B1+B2 — Prosody Scoring & Development Operators (Gemini/Antigravity)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Gemini (Antigravity), via Arne
**Date:** 2026-06-14
**Reviewed commit:** `78584e6` on `origin/gemini/prosody-scoring-operators`
**Base:** `claude/prosodic-melody-leap` (`4b7a85e`) → which is **not yet on `main`**
**Review branch:** `claude/gemini-prosody-b1b2-code-review`

## Verdict

**Approve to merge as inspect-only pure functions — with ONE required fix before this score is allowed to
drive selection.** B1 (`prosody-scoring.ts`) and B2 (`prosody-development.ts`) are clean, deterministic,
well-documented pure functions; output is always valid and in-scale (degree clamp `[-1,8]` + overlap guard,
verified). Build/db:smoke/diff green; **46/46** tests (37 smoke + 9 new); audit unchanged (known 2-high).
The one real issue is conceptual, not mechanical: **`scoreAnchorContrast` has the wrong gradient** — it
rewards metronomic anchoring rather than the expressive anchor/contrast *balance* the design (and its own
comment) intend. That is fine while the score only inspects, but it must be fixed before `scoreProsody`
becomes a fitness function (Track D), or the evolutionary loop will select *toward* the nursery-rhyme feel.

## Required before this score drives selection/consensus

**`scoreAnchorContrast` is a monotonic ramp, not an inverted-U.** The implementation is
`clamp((averageAlignment - 0.1) / 0.9, 0, 1)` — strictly increasing in metrical alignment. Proven:

```
anchorContrast:  anchored 0.667  >  mixed 0.444  >  syncopated 0.0
the actual generated prosodic melody (melody-prosody.ts) scores anchorContrast = 0.134  (near worst)
```

So a robotic on-the-beat line scores **0.667** while the expressive, phrased melody we built scores **0.134**.
The code comment says "we want a mix of anchors and syncopated contrasts" — but the math rewards pure
anchoring and penalizes all syncopation. If this feeds selection it will pull the population toward the
metronomic, on-grid feel the whole arc is trying to escape. **Fix:** make it an inverted-U peaking at a
balanced alignment (e.g. ~0.55–0.65), so both robotic anchoring *and* total syncopation score below an
expressive mix — "anchor *or* contrast the heartbeat, and choose well." (Non-blocking for merge because the
function is currently inspect-only; blocking before Track D wires it as fitness.)

## Non-blocking findings

1. **`meter` is ignored; phrase geometry is hardcoded.** `scoreProsody(phrase, _meter)` never uses `meter`,
   and the scorer assumes 4/4 with the antecedent/consequent split at beat 8 and a 16-beat phrase
   (`% 4`, `< 8`, `< 16`). True for today's generator, but the coupling is silent — either honor `meter`
   or validate/document the expected geometry so a different phrase length doesn't mis-score quietly.
2. **Cadence function uses exact integer degrees** (`=== 0 || === 7` tonic, `=== 4` dominant). Correct only
   within the `[-1,8]` clamp; it would miss a transposed tonic (14, -7) or dominant (11, -3). Use pitch-class
   (`((degree % len) + len) % len`) to be robust to octave/transposition — `varyContour` can shift degrees.
3. **`richness` entropy counts articulation artifacts.** Durations are bucketed at 0.01, but the generator's
   `×0.96` articulation makes 0.24 vs 0.25 distinct buckets, inflating Shannon entropy with non-musical
   variety. Quantize durations to a coarser musical grid (e.g. nearest 0.25) before the entropy so it
   measures *long/short* variety, not articulation noise.
4. **Operators are lossy under collision (by design, worth knowing).** `rebuildPatternSource` drops any note
   that starts before the previous ends; `shiftAnacrusis` 'add'/'lengthen' truncate body notes that cross
   the cadence boundary (`< 6.0` / `< 13.5`); 'shorten' to 0.125 snaps back to the 0.25 grid (both the start
   index and the `"0:0:1"` duration). Acceptable for candidate variety + safety, but the operators can thin
   a phrase — fine as long as the scorer/selection judges the result (it will).
5. **`retrograde` is pitch-only** (reverses scale degrees, preserves rhythm). Defensible as a *contour*
   operator, but it isn't a true retrograde (which reverses time too) — a naming nuance, not a bug.
6. **`questionAnswer` resolveBonus** uses an ad-hoc strong-beat set `{0, 1, 1.5, 2}`; `getMetricalWeight`
   already encodes a principled hierarchy and could be reused for consistency. Minor.

## What's good (credit where due)

- Clean, deterministic, documented pure functions with a clear subscore decomposition.
- **Safety holds:** degree clamp `[-1,8]` + the overlap guard mean every operator emits a valid, in-scale
  `PlayerPatternSource` (verified: `widen` → degrees `[-1,6]`). This is exactly the bounded-candidate
  discipline the plan requires.
- `questionAnswer` correctly identifies the generated melody's suspended-dominant → resolved-tonic shape
  (scored 1.0) — the rhetorical layer works.
- Good instinct on `richness` (entropy + adjacent-contrast, both inverted-U) and the metrical-weight
  hierarchy in `getMetricalWeight`.
- 46/46, build/db:smoke/diff green.

## Architect notes for Arne (merge hygiene)

- **Stacking:** this branch sits on the **unreviewed, unmerged** `claude/prosodic-melody-leap` (`4b7a85e`).
  Clean order: review + merge the leap → `main`, then rebase this onto `main`. I can review the leap as a
  normal byte first so the base is solid.
- **Carried doc:** the branch chain also includes `7c4c7a9` (the superseded **Euclidean** rhythm-plan doc).
  Harmless, but it will land at merge — drop it during the rebase if you want the history clean.

## Handoff back to Gemini

> Track B1+B2 (`78584e6`) reviewed: **approved as inspect-only pure functions — one required fix before it
> becomes fitness.** Clean, deterministic, in-scale (degree clamp + overlap guard verified), 46/46,
> build/db:smoke green. **Required before `scoreProsody` drives selection (Track D):** `scoreAnchorContrast`
> is a monotonic ramp rewarding metronomic anchoring (proven: anchored 0.667 > mixed 0.444 > syncopated 0.0;
> the actual expressive generated melody scores 0.134) — its own comment wants a *mix*, so make it an
> **inverted-U** peaking at a balanced alignment (~0.55–0.65) so robotic-anchored and fully-syncopated both
> score below an expressive blend. **Non-blocking:** honor or validate the `meter`/phrase-geometry coupling
> (currently 4/4 + 16-beat hardcoded); detect cadence function by pitch-class not exact degree (robust to
> `varyContour` transposition); quantize durations before the richness entropy (articulation `×0.96` inflates
> it); note the operators are lossy under collision (`shiftAnacrusis` add/lengthen truncate, `shorten`
> snaps to grid); `retrograde` is pitch-only. Strong first contribution.

## Blockers before merge

None for an inspect-only merge. Fix `scoreAnchorContrast`'s gradient before Track D wires the score as
fitness.
