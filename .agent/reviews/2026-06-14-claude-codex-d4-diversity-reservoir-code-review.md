# Claude Review: Track D4 — Diversity Floor + Latent Reservoir (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `40f0262` on `origin/codex/byte-d4-diversity-reservoir` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-d4-diversity-reservoir-code-review`

## Verdict

**Approved — merge `codex/byte-d4-diversity-reservoir`.** The ambitious version landed correctly: a similarity
floor keeps the scored elite from cloning, and a bounded latent reservoir preserves genuinely
high-interest/low-fitness genes (selected orthogonal to the prosody scorer) which then breed through the same
B2 development path — all with elitism preserved (top fitness never drops), deterministic, in-scale, and
default-off identical to D3. I live-verified all five focus points. Build/db:smoke/diff green; smoke 64/64
fresh DB; audit unchanged.

## Focus-point confirmations (live-verified)

1. **Default-off = D3-identical.** `runEvolution(seed 4242, no diversity)` → `0.6317 → 0.7945 → 0.7945 →
   0.8199`, mean==top (the D3 collapse), byte-for-byte the D3 baseline. ✓
2. **Elitism preserved + elite stays diverse.** With diversity on (seed 9001), `topFitness` is non-decreasing
   (`0.7718 → 0.8422` held). `chooseDiverseElite` always pushes the top `fitnessEliteLimit` first, then
   diverse-fills by a `minDistance` similarity floor in prosody-subscore space. Live elite fitness
   `[0.79, 0.842, 0.772]` — three *distinct* values (not the off-run's collapse), confirming the elite spans
   the space instead of cloning. ✓
3. **Reserved = genuinely high-interest / low-fitness, own stratum.** `chooseReservoir` filters to
   `fitness < eliteFloor` **and** `interestingness >= threshold`, persists with a new `reserved` status +
   `candidate.reserved` audit. Live reservoir fitness `[0.357, 0.584]` — well below the elite floor (0.772) —
   so the loop is preserving candidates the scorer doesn't reward. ✓
4. **Reserved parents breed via the same B2 path.** `developCandidate`'s guard was correctly relaxed to accept
   `elite` **or** `reserved` parents; `chooseReservedDevelopmentParents` feeds a deterministic fraction into
   the develop loop. Live: 2 children have a reserved parent. ✓
5. **Interestingness is orthogonal to fitness** (the crux). `interestingness = 0.75·melodicInterest +
   0.25·novelty`, where `melodicInterest` is pitch-content the rhythm-centric prosody scorer ignores
   (intervallic variety + register breadth + pitch-class diversity from `scaleDegree`/`octave`) and `novelty`
   is fitness-independent distance-from-others. **Live proof:** the reservoir is non-empty and holds a
   fitness-0.357 candidate — if interestingness merely re-rewarded fitness, no high-interest candidate could be
   that low-fitness and the reservoir would be empty. It selects genuinely different candidates than fitness.
   ✓

## Findings (non-blocking)

### Reporting gap vs the kickoff — per-generation elite diversity isn't surfaced
`runEvolution`'s per-generation summaries expose `reservedCount` but `s.diversity` is `null` per generation
(the elite mean-pairwise-distance is computed at cycle level — you reported ~0.40 — but not carried into the
per-gen summary). The kickoff asked to *report* per-gen elite mean-pairwise-distance so the anti-collapse is
observable over a run. Surface it in the per-gen summary — it's the number that *shows* diversity holding,
and we'll want it for tuning.

### Empirical honesty — the mechanism is correct; the payoff is the next question
In my 8-generation runs the top plateaued even with diversity on (0.8422 held from gen 2), while the reservoir
stayed populated and bred. That's **expected** for quality-diversity, not a defect: D4 delivers a *correct,
safe* mechanism (preserve + breed diverse/interesting material, elitism intact), but whether it produces a
*higher peak* than strict elitism is probabilistic and didn't surface in these short runs. Demonstrating the
payoff — a reservoir-origin lineage climbing into the elite, or a higher ceiling than strict elitism — is the
next empirical step (longer runs, more seeds, and the matched same-seed A/B). Which depends on:

### Carry-forward now load-bearing — branchId-omitted-from-id blocks the matched A/B
To fairly measure "diversity on vs off at the same seed" you need same-seed runs in isolated populations — but
candidate ids omit `branchId`, so same-seed runs collide across branches in one store (I had to A/B at
*different* seeds, which isn't matched). The branch-scoped candidate id is now the prerequisite for *measuring*
D4's value, not just a tidiness item. (Also still open: shared client/server B2 operator module.)

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. D4's diversity mechanism is correct, safe, and live-verified. To *prove its worth*, next is the
branchId-scoped candidate id (enabling matched A/B) + longer runs, and surfacing per-gen elite diversity.
