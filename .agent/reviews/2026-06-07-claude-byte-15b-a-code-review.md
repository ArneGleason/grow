# Claude Review: Grow Byte 15b-a (Model Critic Selects Scored Chorus Candidates)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-07
**Reviewed commit:** `d585eac Add melody critic candidate selection` on branch `codex/byte-15b-a`
**Base:** `main` at `32a22d4`
**Review branch:** `claude/byte-15b-a-code-review`

## Verdict

**Approved - merge `codex/byte-15b-a`.** The model finally enters the *musical* loop, and it is done exactly
right: the LLM is a **pure selector among app-owned, scored, in-scale candidates** - it cannot emit, mutate,
or invent any note, pitch, scale degree, octave, score, timing, or playback instruction. The safety boundary
is airtight at three independent layers, the selected candidate commits through the existing lookahead path,
fallback/staleness are handled, and feedback records who selected what. All six focus points confirmed live
against the real qwen3. Build/audit/db:smoke/diff green; smoke **28/28**. One honest, non-blocking finding:
the model's *musical value is unproven so far* (it is a shaky critic on this small model, and the candidate
menu is tightly clustered), which the deterministic-ground-truth design correctly lets us see.

## Safety boundary - airtight (focus #1, #2), confirmed live

The model can only return `selectedCandidateId` + three short prose fields, enforced at three layers:
1. **Schema:** `selectedCandidateId` is an `enum` of the take's candidate ids; `additionalProperties:false`;
   prose fields length-capped. No notes/scores/timing fields exist to fill.
2. **Validator:** `validateMelodyCriticSelection` rejects any `selectedCandidateId` not in the app-owned menu
   (-> invalid -> deterministic fallback).
3. **Selection:** the active candidate is `getMelodyRepairCandidate(take, selectedId)` - a lookup into the
   **app-owned** menu - so only the *id* (an index into safe candidates) comes from the model; the app owns
   every note. `coerceMelodyCriticSelection` reads only the 4 string fields.

Live: the real model returned a valid id + prose; the active candidate switched to that app-owned candidate.
Note `rawResponse` *mentions* "degree 9 in octave 4" in its prose - that is the model *describing* a
candidate's contour, not emitting notes; nothing parses the prose as notes (prose-as-data). So even prose
that names pitches is inert. Manual-probe-only (Send critic / `runManualMelodyCriticTest`) - no background
calls.

## Focus-point confirmations

1. **Model cannot emit/mutate notes/pitches/scores/timing/structure?** Confirmed (three layers above + live).
2. **Valid output selects one app-owned id; invalid leaves deterministic active?** Confirmed - valid live
   selection switched the active candidate; the validator + 28/28 smoke cover the invalid -> deterministic
   path.
3. **Committed through the chorus/lookahead path, not fire-time?** Confirmed - `getCurrentChorusDevelopment`
   sources `getCurrentMelodyRepairDecision().candidate.events` (the active candidate's app-owned events),
   committed via the same path as Byte 14/15a.
4. **Musical result useful?** The selection *does* audibly differ (live: the model's pick changed note 2 from
   `C6` to `E5` vs the deterministic candidate). But see the honest finding below - usefulness is not yet
   demonstrated.
5. **Staleness resets stale critic output?** Confirmed - changing song reset the critic to `idle` and the new
   song played the deterministic candidate (`selectedBy: deterministic`); `getActiveMelodyCriticSelection`
   gates on `status === "valid" && takeId === take.id && candidate-still-exists`, and reject/song/config call
   `resetMelodyCriticTest`.
6. **Feedback records candidate + source?** Confirmed - `song.take_feedback` records `candidateId`,
   `candidateSource`, and `selectedBy: "model-critic" | "deterministic-scorer"` (verified live: a model-
   selected take recorded `selectedBy: model-critic`).

## Honest finding (non-blocking) - the critic layer is correct, but the model's value is unproven, and the menu is too clustered to matter much

This is exactly what the deterministic-ground-truth harness was built to reveal, so I am reporting what it
showed:

- **The small model is a shaky critic.** First live run, qwen3:4b selected a *mid*-scoring alternate (0.833)
  over both the deterministic pick (0.825) and the best-scoring alternate (0.85), and its own `rationale`
  then *criticized* that very candidate ("introduces a high degree leap to 9 ... tonally unstable"). Second
  run it simply agreed with the deterministic pick. So its selection neither tracks the score nor coheres
  with its own prose. Harmless (prose-as-data; the pick is still a safe app-owned candidate), but it means
  the critic is not yet earning its place over the heuristic.
- **The candidate menu is tightly clustered.** The 6 candidates are micro-variants of the same repaired
  draft (totals 0.823-0.85, typically differing by 1-2 notes), all in octave 5. So the critic's choice is
  *low-stakes* - whatever it picks sounds nearly identical. For the critic to add real musical value it needs
  genuinely **diverse** options to choose between (different contours/registers/rhythmic feels/development
  strategies), not near-identical repairs.

Recommendations (for the next slice, not this byte):
- **Diversify the candidate menu** so selection is meaningful (e.g. include a couple of distinct development
  strategies, not only local repair micro-variants).
- **Log the model-pick-vs-deterministic-best score delta over time** (you already have both) so we can
  measure whether the model ever beats the heuristic - the literal experiment this harness enables.
- **Surface the rationale honestly in the readout** (it already does) and accept that it may contradict the
  pick on a small model; that is information, not a bug.

## Smaller notes

- `feedbackNudge` still a generic surprise push (carried from 15a) - later, "remember" should bias toward the
  remembered candidate's traits, and now that feedback records `selectedBy`, you can also learn whether the
  human prefers model-critic vs deterministic picks.
- Carry-forward (unchanged): dead code `MusicalEventRecordBuffer`; the `noteSurprise` octave-aware interval
  vs scale-degree prior calibration note from the 15a fix.

## Merge + next slice

- **Merge `codex/byte-15b-a`.** The critic mechanism is safe, correct, and the right shape; the model is now
  in the musical loop without any ability to play a wrong note.
- **Next (15b-b or similar):** make the critic *worth consulting* - diversify the candidate menu and start
  logging model-vs-deterministic outcomes; that is where the "is the model's taste actually good?" question
  gets answered. Then the multi-player consensus (the rhythm section pushing back on the melodist's pick) and
  remember-good can build on a menu that has real choices in it.
- **Still open:** form-level scoring; section/slow-thought precedence (Byte 14 note).

## Blockers before the next byte

None.
