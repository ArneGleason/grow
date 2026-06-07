# Claude Sanity Check: Grow Byte 15a register-aware feel fix

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-07
**Reviewed commit:** `be5351d Make melody repair register-aware` on branch `codex/byte-15a`
**Previous 15a commit:** `05f9651` · **Base:** `d665c3d`
**Review branch:** `claude/byte-15a-code-review` (appended)

## Verdict

**Blocker closed - approve and merge `codex/byte-15a`; proceed to Byte 15b-a.** The fix does *both* things I
recommended (not just the band-aid): repair candidates are bounded to the raw phrase's register band, **and**
leap/monotony/surprise now use a register-aware `melodicPosition = octave*scaleLength + scaleDegree`. The
audible plummet is gone, verified live, while the repair still does its real refinement work. Build/audit/
db:smoke/diff green; smoke **26/26** with new regression coverage that the repaired chorus cannot leave the
raw register band or make giant adjacent jumps.

## Verification (live)

- **The cadence no longer plummets (focus #1).** `getTake()`: repaired octave range **[5,5]**, final note
  **4@o5** (was Bb2), **max adjacent jump raw 6 -> repaired 3** (repair now *reduces* register leaps). Under
  3 repeated rejects - the exact path that drifted G3 -> Bb2 before - the register stays within **[4,5]**.
  Live sounding chorus: **G5 C6 A5 G5 E5 G5 Bb5 A5 G5 G5**, octave range [5,6], ending on **G5** - tight,
  coherent, in-scale, `grid==performed` (committed material).
- **Still a useful refinement (focus #2).** raw_total **0.437 -> 0.825**, landing **0.333 -> 1.0**, surprise
  **0 -> 0.471** (toward the sweet spot), monotony held 1.0, **all critiques cleared** - the real
  landing/leap/jarring fixes are intact, now without the register artifact.
- **No opposite-direction theater (focus #3).** Scores remain discriminating: per-player totals still diverge
  (pulse 0.76 / bass 0.725 / melody 0.825), surprise is a moderate 0.471 (not collapsed to 0 or maxed). Note
  the melody total honestly dropped **0.88 -> 0.825**: the pre-fix 0.88 was partly earned by the octave-blind
  cheat, so a slightly lower, honest score is the right outcome.
- **Committed / deterministic / in-scale (focus #4).** `grid==performed` on the live chorus; 0 out-of-scale;
  `getTake()` deterministic across calls; material still flows through the song-form/lookahead path.

## Answers to your five sanity-check questions

1. **Blocker closed - no reward for a multi-octave plunge?** Yes - bounded candidates + register-aware
   leap/surprise; verified the cadence is G5 and reject-drift stays in [4,5].
2. **Raw vs Repaired still a useful refinement?** Yes - 0.437 -> 0.825, all critiques cleared, register
   tight; the refinement is intact.
3. **Score readout still meaningful, no opposite theater?** Yes - still discriminating; the honest melody
   drop (0.88 -> 0.825) is a good sign, not a regression.
4. **Committed / deterministic / in-scale?** Yes - all confirmed live.
5. **Enough to merge and move to 15b-a?** Yes.

## Notes (non-blocking, for 15b-a)

- The substrate is now register-aware, so the **15b-a model critic will not inherit the blind spot** - good;
  it can select among the (register-bounded, in-scale, scored) candidates with the deterministic pick as a
  trustworthy ground-truth comparison.
- Minor calibration to keep half an eye on: `noteSurprise` now measures candidate intervals with the
  octave-aware `melodicPosition` (range +/-14) while the prior is built from corpus scale-degree deltas; if a
  later pass finds surprise scores skewing, reconcile the prior's interval basis with the scored basis. Not
  an issue at current numbers.
- Carry-forward (unchanged): `feedbackNudge` is a generic surprise push; dead code `MusicalEventRecordBuffer`.

## Merge + next slice

- **Merge `codex/byte-15a`** (with this register-aware fix).
- **Byte 15b-a - model as critic** on the now-register-aware substrate: the model **selects among the
  scorer's validated deterministic candidates** (never emits notes), behind validator + mock fallback,
  prose-as-data, with the deterministic pick logged as ground truth so we can measure whether the model's
  taste actually beats the heuristics.

## Blockers

None. The required register-awareness blocker is resolved (verified live).
