# Kickoff: Track D3 — the iterating evolutionary loop (score children + run generations)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## Context

The candidate machine now produces, scores, **selects on real musical fitness** (D2b), develops via the B2
operators (D1b), and can audition the elite into playback (D2). One thing stands between this and an actual
*evolutionary* loop: developed children are never scored (fitness 0), so they'd be purged the moment a new
generation selects. D3 closes that and runs the loop across generations so the population measurably improves.

**Prerequisite (Arne):** merge `codex/byte-d2b-phrase-fitness` to `main` first. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-d3-iterating-loop
```

## Task

1. **Score developed children in the cycle.** In `runCandidateCycle`'s develop step, after
   `developCandidate` returns the child, score it: `scoreProsody(childGenome, [4,4])` →
   `aggregateCandidateFitness(subscores, { kind: "phrase" })` → `scoreCandidate(child.id, subscores,
   fitness, branchId)`. Now children enter the next generation with real fitness and can compete.
2. **Add `runEvolution({ seed, generations, count, eliteLimit, branchId })`** (extend `candidate-cycle.ts`)
   that runs `generations` cycles in one branch:
   - Each generation uses a **deterministic per-generation seed** derived from the base seed + generation
     index (so fresh B4 material each generation, fully reproducible).
   - Each generation = one `runCandidateCycle` pass (produce fresh → score → select over the *whole branch
     population* (A3 already ranks all non-purged) → develop the new elites → score the children).
   - Return a per-generation summary: `{ generation, topFitness, meanEliteFitness, eliteCount,
     populationSize }`, plus the final elite list.
3. **Make development no-op-safe.** A B2 operator (and the fallback) can occasionally produce a genome equal
   to the parent, which makes `developCandidate` throw "did not change the genome." In an unattended
   multi-generation loop that aborts the whole run — so **catch/skip a no-op development for that elite**
   (try the next operator, or skip that child) rather than letting it throw.
4. **Expose `window.persistence.runEvolution(options)`** (debug surface).

## Boundaries (do not cross)
- **Inspect-only.** D3 evolves the *population*; it does not drive audio. Auditioning is D2's existing API
  (`window.prosody.auditionEliteCandidate`) — the manual payoff recipe is: `runEvolution(...)` then
  `auditionEliteCandidate({ branchId })`, then Start.
- **Compose, don't reimplement.** Reuse `produceProsodyCandidates`/`scoreProsody`/`aggregateCandidateFitness`/
  the A1–A4 persistence APIs. No new scorer, store, or mutation logic.
- **Respect the diversity seam, don't over-build it.** Fresh B4 production each generation is the simple
  diversity source for D3 (it keeps injecting new material against A3's strict elitism). Leave the existing
  diversity-seam hook/TODO; do **not** build a novelty-reservoir / fitness+novelty mechanism yet — we add
  that once we can observe convergence over more generations.
- **Deterministic.** Same `{ seed, generations, count, eliteLimit }` + fresh store → identical per-generation
  stats and elite set.
- Keep `generations` modest for D3 (e.g. ≤ 12) and within `MAX_CANDIDATE_LIMIT`.

## Acceptance tests (deterministic — fresh DB; do NOT depend on the audio preview)
1. **Children are scored.** After a cycle, each developed child has the four prosody subscores and a
   **non-zero** fitness matching `aggregateCandidateFitness(its scores, { kind: "phrase" })` (no longer 0).
2. **Elitism holds — top fitness never decreases.** Across `runEvolution(generations: N)`, the per-generation
   `topFitness` is **non-decreasing** (the best-ever candidate is never purged). This is the rock-solid
   "it doesn't get worse" guarantee.
3. **Determinism.** Two `runEvolution` runs with the same options against a fresh store yield identical
   per-generation summaries and final elite ids.
4. **No-op-safe.** A development that would produce an unchanged genome is skipped, not thrown — a multi-
   generation run completes without erroring.

**Report (don't hard-assert):** include `meanEliteFitness` per generation in the result so we can *observe*
whether the population climbs (development finding better-than-parent phrases). Whether mean strictly rises
every generation is empirical, not a guarantee — `topFitness` non-decreasing is the hard invariant.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track D3: iterating evolutionary loop (score children + generations)"
git show --stat HEAD     # confirm src/candidate-cycle.ts etc. are in the commit
git push -u origin codex/byte-d3-iterating-loop
git rev-parse origin/codex/byte-d3-iterating-loop   # include this sha in the handoff
```
Handoff with **branch + commit sha**, what changed, the per-generation fitness numbers you observed (so we
can see it improve), and validation results.

**Still open after D3 (not D3 blockers):** candidate ids omit `branchId` (cross-branch collision); shared
client/server B2 operator module before trusted provenance/untrusted clients. Once D3 lands and we can watch
fitness climb over generations, the natural follow-up is the diversity lever (novelty) if we see premature
convergence — and audition gen-over-gen to *hear* it improve.

— Claude
