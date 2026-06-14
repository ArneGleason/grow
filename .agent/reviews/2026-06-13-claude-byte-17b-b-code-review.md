# Claude Review: Grow Byte 17b-b (Explicit SongGoal Setup Apply)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `94639f4` on branch `codex/byte-17b-b`
**Base:** `main` after Byte 17b-a
**Review branch:** `claude/byte-17b-b-code-review`

## Verdict

**Approved - merge `codex/byte-17b-b`.** This is the payoff byte: a human's song idea becomes *audible* through
an explicit Apply, and it lands with every guardrail intact. Interpretation stays a preview; Apply drives setup
from **only** the validated structured fields `(tonic, mode, tempoBpm, formPreference)` - never prose; the change
is applied **through `refreshLookaheadSchedule`** so no stale old-key/old-tempo material survives; wall-clock
fallback timers are cleared on the refresh; and non-default keys keep every heard pitch in-scale. I verified the
two riskiest claims **live end-to-end** (a clean non-default key, and a clean mid-playback key/tempo/form switch).
Build/db:smoke/diff green; smoke **37/37**; `npm audit` = the known 2-high Vite/esbuild advisory, unchanged.

## Live verification (the part that matters most)

I drove the real app through the preview and read the listening frame (`window.listening.getFrame()`), the same
source the smoke uses:

- **Non-default key, in-scale (focus 5):** applied `G dorian / 75 BPM / wide-return`, started playback ->
  `bpm=75`, tonal context `G dorian`, `totalBeats=176` (wide-return). 23 heard events, distinct pitch classes
  `{G, A, Bb, D, E, F}` - **all in the G dorian scale, `outOfScale: []`.**
- **Clean mid-playback switch (focus 3 - the seam):** while playing in G dorian, applied
  `Bb mixolydian / 90 BPM / classic` -> `bpm=90`, `totalBeats=192` (classic). The 26 post-switch heard pitch
  classes were `{Ab, C, Eb, F, G}` - **all in Bb mixolydian, and decisively `Eb`/`Ab` are present while
  G dorian's `E`-natural is gone.** So the heard material is genuinely the new key's notes, not stale committed
  material - the switch is clean, at the new tempo and new form, with zero out-of-scale notes.

This is the strongest evidence that the apply path does not mix old and new material, which was exactly the seam
risk I flagged in the 17b-a review.

## Focus-point confirmations

1. **Preview-only until explicit Apply?** Yes. `applySongGoalIdea` (Interpret) only re-interprets + renders;
   `applySongGoalSetup` is reachable **only** from the Apply button and `window.songGoal.applySetup()`. The
   Apply button is `disabled = !validation.valid`, and `applySongGoalSetup` early-returns on an invalid goal.
2. **Only structured validated fields drive setup; prose stays provenance?** Yes. After the validity guard,
   apply uses `createTonalContext(goal.tonic, goal.mode)`, `activeTempoBpm = goal.tempoBpm`, and
   `formVariantId = goal.formPreference` - all closed-enum / clamped fields. `sourceIdea` / `rationale` /
   `brief` are never read for behavior (only persisted as provenance in the record). The model is not involved.
3. **Apply around playback uses `refreshLookaheadSchedule`, no stale mixing?** Yes - verified live (above) and
   in code. The sequence mutates the live sources first (`setTonalContext` -> `activeTempoBpm` ->
   `formVariantId`), then invalidates the melody-repair cache, resets the proposal/critic tests, cancels
   slow-thinking + clears slow-thought playback, **clears the musical-event ledger and taste evals**, and calls
   `refreshLookaheadSchedule()`, which re-sets `transport.bpm`, clears the fallback timers, clears
   `scheduledEventIds` (cancels in-flight Tone callbacks), rebuilds `activePatterns` (so `getPatternStep` picks
   up the new context + form live), and resets the committed-index/expression/timing maps. Applying while
   stopped is also safe: `refreshLookaheadSchedule` early-returns, and the next `startTransport` reads the new
   tempo/context/form.
4. **Wall-clock fallback timers cleared on refresh/dispose?** Yes - this byte adds `clearWallClockFallbackTimers()`
   and calls it in **both** `disposeLookaheadSchedule` (refactor, same behavior) **and**
   `refreshLookaheadSchedule` (new) - exactly the tidiness fix I recommended in 17b-a. Combined with the
   `scheduledEventIds.has(eventId)` guard, a stale-tempo fallback can neither fire nor linger.
5. **Non-default tonal contexts keep pitches in-scale?** Yes - verified live for two keys (above), and
   structurally guaranteed: `createTonalContext` builds a correct 7-note scale from the right mode intervals
   (probe-checked C mixolydian == default, plus G dorian / Bb mixolydian / E aeolian / F lydian / Db phrygian /
   A ionian all correct), and `materializeNote` -> `noteFromScaleDegree` only ever indexes into that scale.
6. **`song.goal_set` boundary + payload shape?** Right boundary. It is a discrete human-initiated setup change
   (`actorId: "human"`), recorded once per Apply, analogous to `song.changed` / `song.form_variant_changed`. The
   payload carries the full bounded goal plus `previousSetup` / `nextSetup` snapshots
   (`tonic/mode/scale/tempoBpm/formVariantId/goalId`), captured before vs after the mutation in the correct
   order. The smoke asserts the payload's `goal` and `nextSetup` shapes.

## Findings (all non-blocking)

- **No no-op guard on re-apply.** Unlike `applyFormVariant` (which early-returns on no change), pressing Apply
  with the same goal again re-clears the ledger + taste, cancels slow-thinking, and records a redundant
  `song.goal_set`. A "skip if next setup == current applied setup" guard would avoid disruptive churn on a
  double-click. Minor.
- **Goal-driven form change emits no separate `song.form_variant_changed` record** - it is captured inside the
  `goal_set` snapshots instead. That is reasonable, but a consumer counting `form_variant_changed` would miss
  goal-driven form changes; worth keeping in mind if anything downstream aggregates that type.
- **Form-variant control vs `formVariantId` sync.** Apply sets `formVariantId` directly; confirm the form-variant
  inspector control's *selected* value re-syncs on `renderWorld` (the current-variant text does) so a later
  manual dropdown change starts from the right place. Cosmetic.
- **Scales are flat-spelled** (E aeolian shows `Gb` not `F#`; A ionian shows `Db/Gb/Ab`). Enharmonically correct
  and consistent with the system's existing flat convention (`Bb`), zero audible effect - purely a display
  nicety, noting only so it is not mistaken for a bug.
- Carried from 17b-a: `matchedKeywords` duplicates; whole-token matching narrows inflection recall. Carry-forward
  (unchanged): fallback `status` check + dev-flag gating; Vite/esbuild advisory; dead `MusicalEventRecordBuffer`;
  consensus-affinity-from-disposition.

## On verification approach

Because this byte changes audible behavior (key/tempo/form), I did **not** rely on code-reading alone: I drove
the real transport live and confirmed (a) a non-default key produces only in-scale heard pitches and (b) a
mid-playback switch replaces the old key's material cleanly (new-key notes present, old-key-only notes absent,
all in-scale) at the new tempo/form. That, plus the `createTonalContext` probe, 37/37, and the diff, establishes
the apply path is both audible and seam-free.

## Merge + next slice

- **Merge `codex/byte-17b-b`.** The SongGoal is now audible through an explicit, validated, seam-free human
  Apply - the arc's first real payoff, delivered with the discipline intact.
- **Next: Byte 17c** - let the goal drive the character fields (energy/surprise, disposition nudges, influence
  hints, section emphasis). Keep these as **bounded nudges** into the existing per-player surprise targets /
  density / influence priors / section dynamics (clamped, never a rewrite), and keep `influenceHints` a sealed
  curated vocabulary mapped to bounded in-scale prior nudges - the same boundary that has carried 15-17.
  Consider the no-op-guard + the inflection-recall nits along the way.

## Blockers before the next byte

None.
