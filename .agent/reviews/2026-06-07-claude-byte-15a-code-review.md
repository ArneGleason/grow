# Claude Review: Grow Byte 15a (Melody Scoring + Bounded Repair Substrate)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-07
**Reviewed commit:** `05f9651 Score and repair chorus melody` on branch `codex/byte-15a`
**Base:** `main`/`d665c3d` (Byte 14 + bridge feel-fix)
**Review branch:** `claude/byte-15a-code-review`

## How I reviewed

Code + "by ear" via the deterministic `window.melodyRepair.getTake()` (raw/repaired phrases, per-player
scores, critiques - all computed without needing the audio clock) plus a live capture of the committed,
sounding chorus pitches. I focused hard on **focus #6 (score theater / overfitting)**: "repaired scores
higher than raw" is trivially true (the repair hill-climbs the scorer), so the real test is whether the
metrics align with audible improvement and whether repair can score higher while sounding worse.

## Verdict

**Approve the substrate - it is strong and correctly built - with ONE required feel-fix before it is trusted
(and before the 15b model critic stands on it): the scorer is octave-blind, and that produces an audible
register plummet in the chorus that the score rates as a clean landing.** Everything else is excellent: the
metrics are musically sound, the repair fixes real problems and refines rather than rewrites, perspectives
diverge meaningfully, and it is deterministic, in-scale, and committed material (not a fire-time hack). No
model, as scoped. Build/audit/db:smoke/diff green; smoke **26/26**.

## What is genuinely good (with evidence) - this is NOT score theater

The three metrics counterbalance, so you cannot trivially game one without hurting another, and the live data
shows the repair fixing *real* problems:

- **The raw mechanical chorus really does "sound terrible" (Arne was right):** 9 critiques - 3 off-chord
  landings, 3 unresolved leaps, a weak cadence, 2 "too jarring" - landing **0.462**, surprise **0.109**
  (average surprise 0.694 vs target 0.448 = too jarring).
- **Repair cleared all 9 and counterbalanced correctly:** landing **0.462 -> 1.0**, surprise pulled toward
  the sweet spot (avg **0.694 -> 0.548**, score 0.109 -> 0.638), and **monotony held at 1.0** (it did *not*
  trade jarring for boring). It changed only **5 of 10 notes** - a local refinement of the draft, exactly the
  "use the transform as a basis, fix what does not work" intent.
- **Metrics are musically grounded:** landing = chord-tone accents + Narmour gap-fill leap resolution +
  cadential closure; monotony = variety/repeated-run/one-way/exact-cell; surprise = real `-log2(p)`
  information content under a per-player prior, scored as inverted-U distance to a per-player target.
- **Per-player perspectives meaningfully disagree (focus #4):** the *same* repaired phrase scores melody
  **0.88** / pulse **0.76** / bass **0.725**, with distinct surprise targets **0.448 / 0.169 / 0.279** - the
  melodist loves its adventurous lifted hook while the steadier rhythm section finds it too surprising
  (surprise 0). Grounded in disposition + each player's authored influence corpus. This is the real
  "different perspectives from their backgrounds," and it sets up the consensus byte naturally.
- **Deterministic** (identical across calls), **in-scale** (0 out-of-scale pitch classes live), **committed
  material** (chorus plays grid==performed repaired pitches tagged `section:developed-chorus`, not a
  fire-time override), and **no model** - all confirmed.

## Required fix (before merge/trust) - the scorer is octave-blind

All three metrics operate on `scaleDegree` / pitch-class; **octave is never modeled**, and the repair
candidates include free octave nudges. So register can drift with zero score cost, and it does - audibly:

- Live, the repaired chorus sits at C5-Bb5 but its **final cadence note sounds as `Bb2`** - a ~3-octave
  plummet - which the octave-blind cadence check rates as a clean "lands on a chord tone."
- It gets worse on reject: the cadence went **G3 (repair) -> Bb2 (after reject)** - the candidate octave
  nudges drift downward because nothing penalizes register.
- Tellingly, the **raw** draft ended higher (~C5), so here **repair scored higher while sounding worse on the
  cadence.** That is precisely the "does the score explain what we hear?" misalignment you flagged in #6 -
  real, audible, and created by the repair.

This is the one place the substrate is not yet trustworthy, and it matters most now because **the 15b model
critic will inherit this blind spot** (it selects among candidates the scorer ranks, so it cannot see the
plummet either). Recommended fix, smallest first:

1. **Bound repair candidate octaves** to the phrase's register (e.g. within +/-1 of the source note's octave
   or the phrase median) so the cadence/any note cannot wander 2-3 octaves away. Cheap; stops the audible
   artifact immediately.
2. **Fold octave into the leap/surprise interval** (use absolute pitch position, e.g. `scaleDegree +
   octave * scaleLength`, or semitones, as the interval basis) so a register jump counts as a leap and an
   octave drift costs surprise - i.e. make the score see what we hear. The fuller fix.

#1 alone unblocks the feel; #2 is the proper completion (do it before or alongside 15b).

## Answers to your seven review-focus questions

1. **Raw vs repaired - less mechanical without becoming random?** In contour/landing/surprise, yes -
   convincingly (it fixes off-chord landings, unresolved leaps, and over-jarring surprise, changing only half
   the notes). The exception is register: the repaired cadence plummets (Bb2), which on that note sounds
   *worse* than raw - the octave-blindness fix above.
2. **Committed through song-form/lookahead, not fire-time?** Confirmed - live chorus plays grid==performed
   repaired pitches via the `chorusDevelopment` material path, tagged `section:developed-chorus`.
3. **Every repaired pitch in-scale and deterministic?** Yes - 0 out-of-scale live; `getTake()` identical
   across calls; `noteFromScaleDegree` wrap guarantees scale membership.
4. **Per-player perspectives differ meaningfully?** Yes - 0.88 / 0.76 / 0.725 on the same phrase, distinct
   targets, grounded in disposition + influence corpus.
5. **Up/Down scoped correctly?** Yes - both persist `song.take_feedback`; Up remembers, Down rejects the
   phrase key and re-repairs to a different phrase (verified the phrase changed). (Minor: the `feedbackNudge`
   raises surprise weight/target *generically* rather than reinforcing the specific liked phrase - coarse but
   fine for now.)
6. **Scorer overfitting / score theater?** In the dimensions it models, **no** - it is a sound, multi-
   objective, counterbalanced scorer that fixes real problems and refines locally. But it is **octave-blind**,
   which is a genuine misalignment between score and ear (the required fix). So: not theater, but incomplete -
   it does not yet model register.
7. **Model-critic kept out?** Yes - fully deterministic substrate; no model in the loop.

## Forward notes (non-blocking)

- The reject re-repair drifting the octave lower (G3 -> Bb2) is the same octave-blind root cause; the fix
  resolves both.
- `feedbackNudge` is a generic surprise/novelty push; later, "remember this" should bias toward the
  *remembered phrase's* characteristics, not just "more surprise."
- The octave-blindness also means two phrases differing only by register score identically - worth keeping in
  mind for the eventual form-level/contour scoring.

## Merge + next slice

- **Fix the octave-blindness (at least #1, bound repair octaves) and then merge `codex/byte-15a`.** The
  substrate is otherwise excellent and exactly the deterministic floor + experiment harness we wanted. I would
  not stand 15b's model critic on it until the cadence stops plummeting, since the critic inherits the blind
  spot.
- **Then Byte 15b - model as critic** on the (now register-aware) substrate: the model selects among the
  scorer's validated candidates, behind validator + mock fallback, prose-as-data, with the deterministic
  pick logged as ground truth so we can measure whether the model's taste beats the heuristics.
- **Still open from prior bytes:** form-level scoring; section/slow-thought precedence (Byte 14 note);
  carry-forward dead code `MusicalEventRecordBuffer`.

## Blockers before the next byte

One: octave-blindness (the cadence plummet). Fix #1 (bound repair octaves) is small and unblocks both the
feel and 15b.
