# Kickoff: Track D1 — the minimal end-to-end candidate cycle

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## Context

The engine is complete and approved: **A1** (store) · **A2** (fitness) · **A3** (selection) · **A4**
(development), plus **B4** (`produceProsodyCandidates`, a scored phrase-candidate producer). D1 ties them into
one deterministic cycle so the population becomes genuinely self-curating — the north star: *write many
candidates, keep the best, purge the rest, develop the survivors.*

**Prerequisite (Arne):** merge **`claude/prosody-track-clean`** (`d01d87d`, the prosody track + B4) and
**A4** to `main` first, so produce/score/select/develop + the producer are all on main. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-d1-candidate-cycle
```

## Task: one deterministic generation, inspect-only

Add `runCandidateCycle({ seed, kind: "phrase", eliteLimit?, count?, branchId? })` (a new
`src/candidate-cycle.ts` orchestration + a `window.persistence.runCandidateCycle` / debug surface) that runs
**one generation** by composing the existing APIs — **author no new store/scoring/mutation logic**, just wire
what's built:

1. **Produce** — `produceProsodyCandidates({ seed, count })` (B4) → N scored phrase candidates.
2. **Store** — `writeCandidate` each (A1).
3. **Score → fitness** — for each, `scoreCandidate(id, scores)` with the prosody subscores, and set `fitness`
   via A2's `aggregateCandidateFitness(scores)` (so selection ranks on the A2 ruler, not B4's provisional
   overall).
4. **Select** — `selectCandidates({ kind, eliteLimit, branchId })` (A3) → top-N `elite`, rest `purged`.
5. **Develop** — for each surviving elite, `developCandidate({ parentId, mutation })` (A4) → an `alive` child
   (`parentId`, `generation+1`). For D1, use A4's `phrase.nudge` (deterministically derive its bounded knobs
   from the elite's seed) — keep it simple and reuse the audited path.

Return a summary `{ generation, produced, elite, purged, children }` (ids + fitness). Calling it again runs
the next generation against the accrued population.

## Boundaries (do not cross)
- **Inspect-only.** No audio/transport/playback consumption — this is the population pipeline, not yet
  performance. (Track D2 will perform the elite.)
- **Compose, don't reimplement.** Use the existing B4/A1/A2/A3/A4 functions; add no new scoring, mutation, or
  store logic.
- **Deterministic.** Same `seed` + fresh store → identical produced ids, scores, fitness, elite/purged split,
  and children.
- **Leave a diversity seam.** Selection is strict elitism (A3 purges all non-elite) — add a clear TODO/hook
  where a diversity lever (novelty reservoir / fitness+novelty blend) would plug in, but **do not tune it
  yet** (we tune it once we can observe convergence by running this loop).

## Acceptance tests (deterministic — fresh DB; do NOT depend on the audio preview)
1. One `runCandidateCycle({ seed, count: N })` writes N `phrase` candidates, each scored with a fitness
   matching `aggregateCandidateFitness(scores)`.
2. After the cycle, exactly `min(eliteLimit, N)` are `elite`, the rest `purged` (A3 ordering preserved),
   and each elite has a developed `alive` child with `parentId` + `generation+1`.
3. Determinism: two runs with the same seed against a fresh store yield identical ids / fitness / elite set /
   children.
4. The audit trail shows the expected `candidate.created` (produce + development), `candidate.scored`,
   `candidate.retained`/`purged` (with `reason:"selection"`) events — and no duplicates on a repeated
   identical run (idempotence holds end-to-end).

## Open question to answer in your handoff (don't block on it)
The develop step uses A4's server-side `phrase.nudge`, but the *musical* development vocabulary is the B2
operators (`varyContour`/`reFoot`/… in `src/prosody-development.ts`). For D1, `phrase.nudge` is fine. Note in
your handoff whether you think development should later move to the B2 operators (so children are musical
developments) — that's the seam to resolve before D2.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track D1: minimal end-to-end candidate cycle"
git show --stat HEAD     # confirm src/candidate-cycle.ts etc. are in the commit
git push -u origin codex/byte-d1-candidate-cycle
git rev-parse origin/codex/byte-d1-candidate-cycle   # include this sha in the handoff
```
Handoff with **branch + commit sha**, what changed, the develop-vocabulary note, and validation results.

**Note:** B3 (chorus develops the prosodic phrase, `claude/codex-b3-kickoff`) is still queued — D1 and B3 are
independent; do them in whichever order Arne prefers. I'd do D1 first (it's the north-star payoff and surfaces
the diversity question), B3 next.

— Claude
