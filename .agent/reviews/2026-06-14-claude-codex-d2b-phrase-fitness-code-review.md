# Claude Review: Track D2b — Phrase Candidates Rank on Prosody Fitness (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `8d97cc1` on `origin/codex/byte-d2b-phrase-fitness` (sha confirmed)
**Base:** `main` (current — verified ancestor; D2 fast-forwarded in)
**Review branch:** `claude/codex-d2b-phrase-fitness-code-review`

## Verdict

**Approved — merge `codex/byte-d2b-phrase-fitness`.** This resolves the high-priority finding from my D2
review: phrase candidate fitness now reflects the prosody scorer, so A3 selects elites by musical quality
instead of id-order. The fix is kind-aware with a conservative auto-detect fallback, leaves default/non-phrase
behavior intact, and I live-proved selection now ranks on quality (elite fitness ≥ purged fitness). Build/
db:smoke/diff green; smoke 59/59 fresh DB; audit unchanged.

## Focus-point confirmations (live-verified)

1. **Phrase fitness matches the prosody ruler.** `PHRASE_CANDIDATE_FITNESS_WEIGHTS` = `{richness 0.3,
   anacrusis 0.15, questionAnswer 0.35, anchorContrast 0.2}` — exactly the prosody scorer's `overall`
   weights, so A2's phrase aggregate == `scoreProsody.overall`. Live: `aggregateCandidateFitness({richness,
   anacrusis, questionAnswer, anchorContrast}, {kind:"phrase"})` → fitness **0.3775**, `ignoredScoreKeys:[]`,
   all four keys contributing (and 0.747·0.3 + 0·0.15 + 0.1·0.35 + 0.592·0.2 = 0.3775, exact). ✓
2. **Non-phrase/default behavior intact.** `getDefaultWeightsForScores` returns DEFAULT weights unless
   `kind==="phrase"` or the score object is *unambiguously* prosody-shaped (`hasPhraseScore &&
   !hasDefaultScore`). Live: default-shaped `{landing:0.8, cadence:0.6}` still aggregates on the default
   weights (0.2, contributing landing+cadence). The auto-detect is conservative — mixed or default-shaped
   objects keep default weights; only kind-less *purely* prosody objects switch (so the debug/probe path works
   without a kind). ✓
3. **D1 stores the A2 aggregate, not B4's provisional.** `candidate-cycle.ts:102` →
   `aggregateCandidateFitness(candidate.scores, { kind: candidate.kind })`, and `needsFitnessUpdate` now
   compares at 6-decimal precision so the precise A2 value replaces B4's 3-decimal `overall`. (For phrases the
   two values now coincide by construction, since the weights match — the A2 path remains the right
   architecture for future kind-specific tuning.) ✓
4. **Unblocks D3 — selection is now musically scored.** Live cycle (seed 4242, count 6, eliteLimit 2):
   produced fitness `[0.793, 0.636, 0.682, 0.601, 0.548, 0.673]` (varied, non-zero); elite `[0.793, 0.682]`,
   purged `[0.673, 0.636, 0.601, 0.548]` → **every elite fitness ≥ every purged fitness**. The top-quality
   candidates are kept; the rest purged. ✓

## Design notes (non-blocking)

- **`previewCandidateFitness`** now passes `kind: options.kind ?? candidate.kind` — preview is kind-correct
  too. Good.
- **Auto-detect heuristic** is appropriately conservative (only kind-less, purely-prosody score objects). The
  primary path (D1) is explicit-kind, so the heuristic only serves debug/probe callers. Fine. If a future
  non-phrase scorer ever emits a key named like a prosody key with no default keys present, a kind-less call
  could mis-route — but the explicit-kind path makes that a non-issue in practice.

## Carry-forwards (now sharper)

- **Score the developed children (now the #1 item for a real iterating loop).** With fitness real and
  selection quality-driven, the unscored children (fitness 0) will be purged at the *bottom* on the next
  generation. So the develop step must score its children (`scoreProsody` → `aggregateCandidateFitness({kind:
  "phrase"})` → `scoreCandidate`) before D3 can iterate a genuinely improving population.
- Candidate ids omit `branchId` (cross-branch collision); rare no-op B2 fallback can throw; shared client/
  server B2 operator module before trusted provenance/untrusted clients.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. The loop now selects on musical quality. Next gate for a *true iterating* loop: score the developed
children.
