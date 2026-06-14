# Claude Review: Grow Byte 17c-a (SongGoal Energy + Section Emphasis)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `4607eb4` on branch `codex/byte-17c-a`
**Base:** `main` after merged Byte 17b-b
**Review branch:** `claude/byte-17c-a-code-review`

## Verdict

**Approved - merge `codex/byte-17c-a`.** This is the model of how a character-drive byte should look: an applied
SongGoal's `energy` + `sectionEmphasis` become a **bounded per-section velocity overlay** on the existing
section dynamics - it scales `velocityMultiplier` only, never `shouldPlay` / `action` / gating / pitch, so it
**cannot add, remove, or mute a note** - just change how loud a section sits. Playback and inspect-only form
scoring read the **exact same** goal-adjusted profile, no goal == the prior behavior exactly, only structured
fields are read (no prose, no model), and the multiplier envelope is musically sane. `surpriseTarget` /
`dispositionBias` / `influenceHints` remain deferred. Build/db:smoke/diff green; smoke **37/37**; `npm audit` =
the known 2-high Vite/esbuild advisory, unchanged.

## The multiplier envelope (independent probe)

`createGoalSectionDynamicsProfile(base, goal)` composes `energy` (a global section-agnostic scaler, range
[0.86, 1.14]) with per-section `emphasis` ([0.76, 1.24]), hard-clamped to **[0.65, 1.35]**, then multiplied onto
the base profile's neutral `verse/chorus/bridgeMultiplier` (1 in every base profile). I verified directly:

| goal                          | verse | chorus | bridge |
|-------------------------------|-------|--------|--------|
| **no goal (undefined)**       | -- returns the base profile, byte-for-byte identical -- |
| neutral (energy 0.5, emph 0.5)| 1.000 | 1.000  | 1.000  |
| min extreme (all 0)           | 0.654 | 0.654  | 0.654  |
| max extreme (all 1)           | 1.350 | 1.350  | 1.350  |
| DEFAULT_SONG_GOAL             | 1.006 | 1.044  | 0.981  |
| Codex sanity (e0.44,c/br0.72) | 0.983 | 1.087  | 1.087  |

So the overlay is a **+/-35% velocity nudge**, it can't collapse a section (floor 0.65 > 0, and the gating that
decides *which* notes play is untouched) or overdrive it (ceiling 1.35, and downstream velocity clamps to <=1
anyway), a neutral goal is exactly the balanced profile, and non-finite inputs fall back to the floor (clamp
guards `!Number.isFinite`). Codex's reported `1.087` chorus/bridge lift reproduces exactly.

## Focus-point confirmations

1. **Bounded overlay, not a new behavior path?** Yes. The new `verse/chorus/bridgeMultiplier` are neutral (1)
   in all three base profiles (inherited via the `{...BALANCED}` spread), so with no goal applied every section
   computation is x1 = unchanged. `createGoalSectionDynamicsProfile(base, undefined)` returns the base
   unchanged (probe-verified identical). The overlay multiplies the *existing* per-section velocity terms; it
   adds no branch that selects or gates notes.
2. **Playback + form scoring share the exact same profile?** Yes - single source of truth. Both
   `applySongSectionDecision` (playback) and `getCurrentFormScore` / `getCurrentFormVariantScores` (inspect)
   call the same `getGoalSectionDynamicsProfile(variant)`, which builds
   `createGoalSectionDynamicsProfile(variant.sectionDynamicsProfile, appliedSongGoal ? {id,energy,
   sectionEmphasis} : undefined)`. The profile id encodes `${base.id}+goal-${goal.id}`, so the two are
   verifiably identical. This extends the 16a-d shared-policy guarantee to the goal overlay - the score
   provably reflects what plays.
3. **No prose parsed, no model?** Yes. `getGoalSectionDynamicsProfile` passes only the structured numeric
   fields `{id, energy, sectionEmphasis}`; `sourceIdea` / `rationale` / `brief` are never read. No Ollama path.
4. **No new notes / material injection?** Yes - this is the most important property and it holds cleanly. Every
   goal multiplier is applied **only** to `velocityMultiplier`, and only where `shouldPlay` is already true
   (`shouldPlay ? base * goalMult : 0`). `shouldPlay`, `action`, the bridge gating
   (downbeat/alternate-bar/whole-beat), and pitch are all untouched. The goal can make a section louder or
   softer; it cannot change which notes exist.
5. **Multiplier bounds musically sane?** Yes (probe above) - [0.65, 1.35], neutral = 1, can't collapse or
   overdrive, gating preserved.
6. **Applied readout understandable?** Yes - `formatAppliedSongGoal` now shows `energy X.XX` and the per-section
   emphasis alongside key/tempo/form/id, and the form-score section energies reflect the active profile. (Minor
   nit below.)
7. **`surpriseTarget` / `dispositionBias` / `influenceHints` still deferred?** Yes - grep-confirmed they appear
   only in display / clone / the read-only harness; the `melody-scoring.ts` `surpriseTarget` hits are the
   scorer's own per-perspective target (pre-existing 15a machinery), unrelated to the goal. None drive behavior.

## Findings (all non-blocking)

- **Readout shows inputs, not derived multipliers.** The Applied row shows the goal's raw `energy 0.44` /
  `chorus 0.72`, not the resulting `chorus x1.087`. It's understandable (higher emphasis = louder), and the
  form-score section energies make the effect discoverable, but surfacing the derived per-section multiplier (or
  resulting energy) would make the active *effect* fully legible. Polish.
- **Applying the default goal is a small nudge, not a no-op.** `DEFAULT_SONG_GOAL` (energy 0.52, chorus emphasis
  0.58, bridge 0.45) yields chorus x1.044 / bridge x0.981 - so "apply default goal" differs slightly from "no
  goal." That is correct (applying is an explicit act) and bounded; noting only so the small baseline-with-goal
  shift is not mistaken for drift.
- Carried from prior bytes: `matchedKeywords` duplicates; inflection recall; no no-op guard on re-apply (17b-b).
  Carry-forward (unchanged): fallback `status` check + dev-flag gating; Vite/esbuild advisory; dead
  `MusicalEventRecordBuffer`; consensus-affinity-from-disposition.

## On verification approach

Unlike 17b-b (which changed pitch/tempo/form and carried a seam risk worth a live capture), this byte is a
pure, deterministic, well-bounded **velocity** overlay with a structural no-new-note guarantee, and playback +
scoring provably share one profile. So I verified by reading the full diff, an independent probe of the
multiplier envelope (exact values + neutral/extreme/NaN behavior), grep-confirming the deferred fields are not
wired and the no-goal path is byte-identical, and 37/37 (incl. the new tests asserting the goal profile flows to
both playback and scoring). A live audio capture would only re-confirm velocities scale by the probed factor.

## Merge + next slice

- **Merge `codex/byte-17c-a`.** Exactly the "bounded nudge to a knob the players already have, never new
  authority" discipline - the score still measures what plays, and no note is invented.
- **Next: Byte 17c-b** - `surpriseTarget` and/or bounded disposition nudges, through the existing
  scorer/taste mechanisms. Keep the same shape: a clamped nudge into the per-player surprise targets /
  taste machinery (never a rewrite, never note-selection authority), playback and any scorer reading one shared
  adjusted value. When `influenceHints` arrives, hold it to a sealed curated vocabulary -> bounded in-scale
  prior nudges. Consider surfacing the derived multipliers in the readout and the re-apply no-op guard along the
  way.

## Blockers before the next byte

None.
