# Claude Review: Track D2 — Audition Elite Phrase Candidates (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `fcdaef8` on `origin/codex/byte-d2-elite-audition` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-d2-elite-audition-code-review`

## Verdict

**Approved — merge `codex/byte-d2-elite-audition`** (the byte is correct in isolation), **but it surfaced a
high-priority cross-cutting bug that must be fixed before the loop is "selecting on quality" — fix it before
D3.** D2 does exactly what it claims: it routes the top-ranked elite phrase candidate's validated genome
through the existing `melodyPhrasing`/lookahead hook, deterministically, reversibly, in-scale — I live-verified
the audible bridge. The problem it *reveals* is upstream: **every phrase candidate's `fitness` is 0**, so the
"elite" being auditioned is selected by id-order, not musical merit. Build/db:smoke/diff green; smoke 59/59
fresh DB; audit unchanged.

## Focus-point confirmations (D2 itself)

1. **Just source selection into the existing path.** `getActiveMelodyPhrasing` precedence is
   audition-pattern → generated-prosody (if enabled) → default; auditioning sets
   `candidateMelodyAudition.pattern` and the rest of the transport/lookahead is unchanged. No new audio path. ✓
2. **Deterministic ranking matches A3.** `compareCandidateAuditionRank` = `fitness DESC, generation ASC,
   createdAt ASC, id ASC` — identical to A3/A1. ✓
3. **Safe refresh.** `applyCandidateMelodyAudition` does `cancelSlowThinkingControllers` +
   `clearSlowThoughtPlayback` + `refreshLookaheadSchedule` + `renderWorld` — the established safe-mutation
   path. ✓
4. **Clear restores cleanly.** `clearCandidateMelodyAudition` resets the override and refreshes; precedence
   falls back to prosody/default. Live: "Cleared elite phrase audition …" and the override is gone. ✓
5. **Genome → pattern is safe.** The genome is an already-normalized phrase `PlayerPatternSource` from the
   store; it's cloned, and `materializeNote`→`noteFromScaleDegree` guarantees in-scale regardless. Live: the
   auditioned candidate played 10 melody events, pitch classes {C,E,G,F,D}, **all in-scale**. ✓
6. **UI vs debug API:** the `window.prosody.*` debug API is sufficient for D2/D3; a tiny visible control is a
   nice-to-have, not needed yet.

## High-priority finding (cross-cutting — surfaced by D2, root cause upstream)

**Every phrase candidate has `fitness: 0`, so selection is fitness-blind.** Live proof:
`aggregateCandidateFitness({ richness, anacrusis, questionAnswer, anchorContrast })` → **fitness 0**, with all
four keys in `ignoredScoreKeys` and **zero contributing keys**.

- **Root cause:** A2's `DEFAULT_CANDIDATE_FITNESS_WEIGHTS` keys are `{landing, monotony, surprise, harmony,
  energy, proportion, motif, cadence, goal}` — the melody/form scorer keys. The **prosody** scorer (which
  scores phrase candidates) emits `{richness, anacrusis, questionAnswer, anchorContrast}`. The two sets are
  **completely disjoint**, so `aggregateCandidateFitness` over a phrase's scores treats every weighted key as
  missing (→0) and every prosody key as ignored → fitness is identically 0 for all phrases.
- **Effect:** with all fitness tied at 0, A3's `fitness DESC, generation ASC, createdAt ASC, id ASC` falls
  through to the tie-breaks — so "elite" = lowest-generation / earliest / smallest-id, **not** the musically
  best. The machine produces, scores, "selects," develops, and now auditions — but the *select* step is using
  a null signal. "Keep the best, purge the rest" is currently "keep by id-order."
- **Why it matters for D2:** the audible bridge genuinely works (you can hear an evolved candidate, in-scale,
  through the real transport — the milestone is real), but the candidate it auditions is **not** the
  highest-quality one, so the headline ("the first audible payoff of the candidate machine") is only half
  true until fitness reflects the prosody scores.
- **Fix:** make fitness aggregation **kind-appropriate** — for `phrase` candidates, weight the prosody keys
  (`richness/anacrusis/questionAnswer/anchorContrast`). Either a per-kind default weight map in A2, or have
  D1's cycle pass phrase weights into `aggregateCandidateFitness`. **This is the "kind-appropriate weight
  subsets" note from my A2 review — I under-rated it; for phrases it's not a nicety, it's the difference
  between selecting on quality and selecting on id-order.** Fix it before D3.

## Carry-forwards (acknowledged by Codex; still open)

- Developed children are unscored (fitness 0) → loop doesn't close generationally. (Compounds with the bug
  above: once fitness is real, children must be scored to compete.)
- Candidate ids omit `branchId` → same-seed cross-branch collision on the global PK.
- Rare no-op B2-operator fallback can throw in `developCandidate`.
- `phrase.replace` trust split — move B2 operators to a shared client/server module before untrusted clients /
  trusted provenance.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

D2 itself: none. **Before D3 / before the loop is "evolving on quality": fix the fitness-key mismatch** so
phrase fitness reflects the prosody scores.
