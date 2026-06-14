# Claude Review: Grow Byte 17c-b (SongGoal Surprise + Disposition Taste Nudges)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `c9c7945` on branch `codex/byte-17c-b`
**Base:** `main` after merged Byte 17c-a
**Review branch:** `claude/byte-17c-b-code-review`

## Verdict

**Approved - merge `codex/byte-17c-b`.** The more delicate character-drive byte - surprise + disposition shape
*what players are inclined to do* - and it holds the line exactly: an applied goal **shifts four taste-profile
thresholds within bounds**, feeds them to the **unchanged** evaluator, and the players still decide every action
through `chooseAction` with `MIN_ACTION_DWELL_BEATS` intact. The goal never selects an action directly, never
bypasses dwell, never mutates the player registry, and never adds or removes a note via a new path. Playback and
the inspector read the same goal-adjusted evaluation. Build/db:smoke/diff green; smoke **38/38**; `npm audit` =
the known 2-high Vite/esbuild advisory, unchanged.

## The data flow (why dwell + the no-new-path guarantee hold)

`renderWorld` -> `world.syncTasteEvaluations(frame, { getTasteProfile: getGoalTasteProfile })`. For each player,
`syncTasteEvaluations` resolves the (goal-adjusted) profile and passes a **transient** `{...player, taste:
adjustedProfile}` to the existing `evaluatePlayerTaste` -> `chooseAction`, storing the result in
`tasteEvaluations`. Playback's note decision is `getTasteNoteDecision` -> `decideNoteFromTaste(this.
getTasteEvaluation(playerId), input)` - it reads the **same stored evaluation**, and only *materializes* the
already-chosen `evaluation.action`. So:
- The goal changes only the **thresholds** that `chooseAction` weighs; the action change itself is still gated by
  `MIN_ACTION_DWELL_BEATS` inside the unchanged evaluator. A goal cannot make actions flip faster than dwell.
- Display and playback consume one shared stored evaluation - no divergence (the same single-source guarantee as
  17c-a, here via the single `syncTasteEvaluations` call).

## The threshold envelope (independent probe)

`createGoalTasteProfile(base, role, goal)` shifts four fields off the `BASELINE_GOAL_SURPRISE = 0.42` baseline:

| profile (melody)               | densityTarget | densityTol | novelty | repetition |
|--------------------------------|---------------|------------|---------|------------|
| base                           | 0.85          | 0.32       | 0.58    | 0.42       |
| hi-surprise(1.0) + push(+0.25) | 0.95          | 0.34       | 0.829   | 0.241      |
| lo-surprise(0.0) + pull(-0.25) | 0.75          | 0.34       | 0.429   | 0.529      |
| NaN inputs                     | 0.75          | 0.34       | 0.429   | 0.529      |

Bounds: densityTarget +/-0.1 clamped [0.1, 1.2]; densityTolerance only widens by <=0.02 clamped [0.18, 0.7];
noveltyPreference shift [-0.151, +0.249] clamped [0,1]; repetitionPreference the inverse (x0.72) clamped [0,1].
So it can't collapse (density floor 0.1 well above the base pulse max of 1.0; novelty/rep floor 0) or overdrive
(density ceiling 1.2; novelty/rep ceiling 1), `surprise == 0.42` is a true no-op, no-goal returns the base
object by reference (sync takes the identity fast-path -> behavior-preserving), and non-finite inputs fall back
to the floor. Directionality is musically coherent: higher surprise -> more novelty, less repetition.

## Live verification

Applied `surpriseTarget 0.72 / melody bias 0.18` in the running app and read `window.taste.getProfiles()`:
pulse novelty 0.08 -> 0.191, bass 0.24 -> 0.351, melody 0.58 -> 0.717 (the largest, since it carries the
disposition bias), repetition falling correspondingly, base profiles shown unchanged. So the resolver is wired
into the live render and the per-player nudges are bounded and role-correct.

## Focus-point confirmations

1. **Only adjusts thresholds consumed by the existing evaluator?** Yes - the four fields
   (densityTarget/Tolerance, novelty/repetitionPreference) are exactly what `chooseAction` / the fit scorer
   already read. The goal supplies different inputs; the evaluator is unchanged.
2. **Does not select actions / bypass dwell / override `decideNoteFromTaste`?** Yes - none of `chooseAction`,
   `decideNoteFromTaste`, or `MIN_ACTION_DWELL_BEATS` (still 4) is modified. The action change stays dwell-gated
   inside `chooseAction`; the goal only moves the thresholds it weighs.
3. **No add/remove notes / new material path?** Yes - the taste layer's existing action vocabulary (incl. its
   existing rest/simplify) is untouched; the goal parameterizes the existing `syncTasteEvaluations` sync, and
   `decideNoteFromTaste` merely materializes the already-chosen action. No note generator, no new removal path.
4. **Player registry not mutated?** Yes - `createGoalTasteProfile` returns a new `{...base}` object;
   `syncTasteEvaluations` passes a transient `{...player, taste}` copy; `grep` finds no `.taste =` assignment
   anywhere; and the probe confirms the base profile is byte-identical after every call.
5. **Bounds sane, no collapse/overdrive?** Yes (probe above) - small, clamped, role-correct, NaN-safe.
6. **`window.taste.getProfiles()` a clear shared surface?** Yes - per player `{playerId, role, base, adjusted}`,
   which is *better* than 17c-a's readout: the derived effect is directly inspectable, not just the inputs.
7. **Prose/model/influenceHints deferred?** Yes - only `{id, surpriseTarget, dispositionBias}` are read;
   `grep` confirms `influenceHints` and the melody-scoring prior nudges are not wired into the taste path.

## Findings (all non-blocking)

- **Applied readout shows goal inputs, not the derived thresholds** (same nit as 17c-a) - but here
  `window.taste.getProfiles()` fully exposes base-vs-adjusted, so the effect *is* inspectable. If you want the UI
  to show it too, surface the adjusted novelty/density alongside.
- **`densityTolerance` can only widen** (`+abs(roleBias)*0.08`), never tighten - a biased role gets a slightly
  more permissive acceptance band, never a stricter one. Intentional and tiny (<=0.02); noting only as an
  asymmetry in case a future byte wants symmetric control.
- **Applying the default goal is a small nudge, not a no-op** (default disposition biases pulse 0.06 etc. give
  tiny shifts; default surprise 0.42 == baseline -> zero surprise effect). Correct and bounded.
- Carried: `matchedKeywords` duplicates; inflection recall; no re-apply no-op guard (17b-b). Carry-forward
  (unchanged): fallback `status` check + dev-flag gating; Vite/esbuild advisory; dead `MusicalEventRecordBuffer`;
  consensus-affinity-from-disposition.

## On verification approach

This shifts audible behavior (the action mix), but it is a bounded, deterministic threshold nudge that
parameterizes the unchanged evaluator, with playback + display sharing one stored evaluation. I verified by
reading the full data flow (sync -> evaluate -> stored -> `getTasteNoteDecision`), an independent envelope probe
(exact values, neutral/extreme/NaN, base-unchanged), `grep`-confirming no registry mutation and the deferred
fields are unwired, a live `getProfiles` check that the resolver is wired and role-correct, and 38/38. Dwell and
the no-new-note property are structural here, so a live audio capture would only re-confirm a subtle, hard-to-
assert action-mix shift.

## Merge + next slice

- **Merge `codex/byte-17c-b`.** Bounded nudge to the players' existing taste targets, dwell and the scorer
  intact, registry untouched - exactly the discipline I asked for in the 17c-a handoff.
- **Next:** curated `influenceHints` as a **sealed vocabulary -> bounded in-scale prior nudges** (the last
  deferred character field), or the small polish byte (surface derived multipliers/adjusted taste in the UI +
  the re-apply no-op guard). For influenceHints, hold the line hardest: each tag maps to a bounded, in-scale
  nudge of an existing prior - never freeform musical material, never a new note source.

## Blockers before the next byte

None.
