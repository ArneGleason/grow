# Kickoff: Track D4 — the diversity lever (keep the elite from inbreeding)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## The problem (observed live in D3)

The loop iterates and climbs, but it **converges prematurely**: with strict fitness-only selection, the
elite fills up with near-identical top-fitness candidates from one lineage. Live 8-generation run (seed 4242):
top fitness plateaus at `0.8199` by generation 4 and `meanEliteFitness == topFitness` from generation 2 — i.e.
both elites are behaviorally identical and the population stops exploring. Fresh B4 material is produced each
generation but gets purged immediately for being lower-fitness than the converged lineage. We need a diversity
lever so the loop keeps exploring — the "best inbred monster" problem.

**Prerequisite (Arne):** merge `codex/byte-d3-iterating-loop` to `main`. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-d4-diversity-lever
```

## The invariant that must NOT break

**Elitism is preserved — the diversity lever adds exploration but never sacrifices the best.** The single
highest-fitness candidate (and the top fitness tier) must always remain elite, so `topFitness` stays
**non-decreasing across generations** exactly as in D3. Diversity reserves *additional/lower-priority* elite
capacity for distinct explorers; it never displaces the best. (The failure mode to avoid is trading quality
away for diversity.)

## Task — diversity-aware selection behind a parameter (default off)

1. **Behavioral distance.** Define a distance between two phrase candidates over their **prosody subscores**
   (`{richness, anacrusis, questionAnswer, anchorContrast}` — already persisted in `scores_json`): Euclidean
   distance in that 4-space (bounded ~[0,2]). This is *behavioral* novelty (how different they sound by the
   scorer's lights), which is what we want — not just "different notes."
2. **Diversity-aware elite selection (recommended: a similarity floor).** Extend the selection so the elite is
   filled greedily in fitness order, but a candidate is **skipped from the elite if it is within
   `minDistance` of an already-kept elite** (a near-duplicate of a better one). The top-fitness candidate is
   always kept first (so elitism holds); near-clones of it are passed over in favor of more-distinct
   candidates further down the fitness order. Result: the elite spans the behavior space instead of cloning
   one lineage, and fresh/distinct material survives selection.
   - If fewer than `eliteLimit` candidates clear the floor, fill the remaining slots with the next-best by
     fitness (don't leave the elite short).
   - (Alternative if you prefer: a two-tier `fitnessElites` + `noveltyElites` split — keep top-K by fitness,
     then add candidates that maximize minimum distance to the kept set. Either is fine; propose your choice.)
3. **Behind a parameter, default off.** Add e.g. `diversity?: { minDistance }` (or `noveltyElites`) to the
   selection / cycle / `runEvolution` options. **Default off ⇒ D3 behavior is byte-identical** (existing tests
   unchanged). The cycle opts in.
4. **Where it lives.** Recommend extending A3's `selectCandidates` server-side with the optional diversity
   mode — selection stays authoritative + audited in one place, and the subscore distance is cheap to compute
   from the persisted `scores_json`. (If you'd rather compute diversity-aware selection in the cycle and drive
   retain/purge from there, propose it — but keep one source of truth for which rows become elite.)

## Boundaries (do not cross)
- **Elitism preserved** (the invariant above). The best is never displaced by a novelty slot.
- **Deterministic.** Same inputs + fresh store → identical selection (the distance + greedy fill are
  deterministic; tie-break by the existing A3 order).
- **Inspect-only.** No audio/model/transport. Auditioning stays D2's API.
- **Compose, don't reimplement.** Reuse the persisted scores + existing selection/cycle plumbing; add no new
  scorer.
- **Default off ⇒ D3-identical.**

## Acceptance tests (deterministic — fresh DB; not the audio preview)
1. **Elitism still holds with diversity ON.** Across `runEvolution(generations: N, diversity: {...})`,
   `topFitness` is non-decreasing (the best is never lost). 
2. **The elite stays diverse.** With diversity ON, the elite set's **mean pairwise behavioral distance stays
   above a floor across generations** (it does **not** collapse to ≈0). Directly contrast the D3 baseline
   (diversity off) where `meanEliteFitness == topFitness` (zero spread / one lineage).
3. **Default off = D3-identical.** With no diversity option, selection/results are identical to D3 (a
   regression guard).
4. **Determinism.** Same `{seed, generations, count, eliteLimit, diversity}` + fresh store → identical
   per-generation summaries + elite set.

**Report (don't hard-assert):** per generation, both the fitness curve *and* the elite mean-pairwise-distance,
so we can see the loop keep exploring (distance held up) instead of flatlining — and ideally reach a higher
top fitness over a longer run than the strict-elitism baseline did.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track D4: diversity-aware selection (anti-convergence)"
git show --stat HEAD
git push -u origin codex/byte-d4-diversity-lever
git rev-parse origin/codex/byte-d4-diversity-lever   # include this sha in the handoff
```
Handoff with **branch + commit sha**, your design choice (similarity-floor vs two-tier; server-side vs
cycle-side), the per-generation fitness + diversity numbers you observed, and validation results.

**Note:** if you want to A/B diversity-on vs -off on the **same seed in one store**, you'll hit the known
`branchId`-omitted-from-candidate-id collision (same-seed candidates dedup across branches). For D4 testing,
use **different seeds** per run, or fix the branch-scoped id first. The branchId-scoped id remains the other
open carry-forward.

— Claude
