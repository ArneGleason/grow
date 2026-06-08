# Claude Review: Grow Byte 15c-a (Deterministic Band Consensus for Chorus Candidates)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-07
**Reviewed commit:** `d36036d Add band consensus for chorus candidates` on branch `codex/byte-15c-a`
**Base:** `main` at `de76f28`
**Review branch:** `claude/byte-15c-a-code-review`

## Verdict

**Approved - merge `codex/byte-15c-a`.** This inserts a deterministic band-consensus layer between the
model's proposal and the audible chorus, and it does the thing I most wanted to see: it **reduces** the
model's unilateral power rather than expanding it. The model still only proposes an app-owned candidate id +
prose; pulse/bass/melody then weigh that proposal with their own (app-computed) scores + role affinities and
can override it. All selection stays among app-owned, scored candidates. Confirmed live + by the deterministic
smoke. Build/audit/db:smoke/diff green; smoke **28/28**.

## Focus-point confirmations

1. **Safety boundary (model can't emit notes/scores/etc.)?** Intact and unchanged - the critic schema is not
   touched in this byte (still `selectedCandidateId` enum + capped prose, verified in 15b-a/b). Consensus is
   pure deterministic computation over `take.candidates`. The model's proposal enters only as an *id* with a
   small `+0.08` deference bias. So the model's influence is now even more diluted.
2. **Selection boundary (app-owned candidates only)?** Yes - `createMelodyConsensusDecision` selects via
   `reduce` over `take.candidates` (the app-owned, in-scale, register-bounded, scored menu); the committed
   chorus is `getMelodyRepairCandidate(take, consensus.selectedCandidateId).events`. Nothing outside the menu
   can be chosen.
3. **Spacious passes, weak lifted not rubber-stamped?** Confirmed. Live: a model `spacious-hook` proposal was
   unanimously accepted and selected (pulse/bass affinity for space is high). The smoke pins both directions
   deterministically: `deterministicConsensus.selected === deterministicCandidate`; `spaciousConsensus.selected
   === spacious` with an `accept`; and crucially `liftedConsensus.selected !== liftedCandidate` - a weak
   lifted-hook proposal is overridden, not rubber-stamped. The tuning supports this (lifted ~0.51 + pulse/bass
   dislike cannot overcome balanced ~0.825 even with the +0.08 proposal bias).
4. **Fallback on invalid/absent model?** Yes - with no valid critic selection, `proposedBy =
   "deterministic-scorer"` and the proposal is the deterministic candidate, so consensus runs over the
   deterministic proposal (live: keeps balanced-repair). The smoke covers the invalid-candidate-id ->
   deterministic-consensus path.
5. **Proposed vs selected separation (UI/persistence)?** Clear. Persistence records `proposedBy` +
   `proposedCandidateId` **distinct from** `selectedBy: "band-consensus"` + the active `candidateId`, plus
   `consensusAgreementScore`, `consensusSummary`, and per-player `consensusResponses` (stance / preferred /
   margin). New inspector `Consensus` and `Responses` rows; the score row reads `consensus-selected` vs
   `deterministic`. Verified live (the fields are separate; they coincide only when the band accepts the
   proposal). This is exactly the proposal/consensus/feedback trail the next slice needs.
6. **Feel - band considering vs model overriding?** Confirmed in the structure and live: the model *proposes*,
   the three players each respond accept/defer/push with a reason, and the consensus selects. Live, the model
   proposed `spacious-hook` and the band unanimously accepted with per-player reasons - it reads as the band
   weighing the melodist's idea, not the model privately rewriting the song. (I observed the *accept* case
   live; the *override/push* case is pinned by the smoke.)

## Validation performed

- `db:smoke`/`build`/`audit`/`diff` green; `smoke` **28/28** (new consensus unit + end-to-end tests).
- **Live, real qwen3:** deterministic consensus keeps `balanced-repair` (3 accept, agreement 0.868, identical
  across calls - deterministic); model proposed `spacious-hook` -> band 3x accept -> consensus selected
  `spacious-hook` -> committed chorus strategy `spacious-hook`. Persistence record cleanly separates
  proposed/selected with the full consensus trail.

## Notes (non-blocking)

- **Role affinities are a hand-authored magic-number table** (`STRATEGY_AFFINITY_BY_PLAYER`) separate from
  the player dispositions that already drive the 15a perspective weights/surprise targets. The numbers are
  well-balanced at current scale (verified: spacious wins, lifted loses, balanced default holds), but as the
  band/strategies grow, consider deriving consensus affinity from each player's *disposition* (as the 15a
  perspective already does) so a player's consensus taste and its scoring taste stay consistent and there is
  one source of truth, rather than a second hardcoded table to keep tuned.
- **The deference bias (0.08) / defer margin (0.035) are tuned constants.** Fine now; keep an eye on them as
  more strategies arrive (a band-neutral mediocre proposal could ride the bias through, or a marginally-better
  band pick could be suppressed). Worth a brief calibration pass if the menu grows.
- **Live this run was unanimous-accept** (band agreed with the band-favored spacious proposal); I did not
  observe a live `push`/override, but the smoke pins it deterministically. A model proposal the band dislikes
  (lifted/energetic) would surface the push path live.
- Carry-forward (unchanged): dead code `MusicalEventRecordBuffer`; `lifted-hook` repetition feel (15b-b).

## Merge + next slice

- **Merge `codex/byte-15c-a`.** Deterministic, app-owned, safety-strengthening, with a rich provenance trail
  and confirmed musical behavior.
- **Next (your suggestion is right): make remember-good use the stored proposal/consensus/feedback trail**
  rather than only nudging a generic surprise weight - the persistence now records exactly that trail
  (proposed/selected/strategy/agreement/responses), so "remember this take" can reinforce the *specific*
  strategy/candidate the band agreed on (and learn which strategies a player tends to push for) instead of a
  blunt weight bump. Consider also unifying the consensus affinities with dispositions (note above) as part
  of that.
- **Still open:** form-level scoring; section/slow-thought precedence (Byte 14 note).

## Blockers before the next byte

None.
