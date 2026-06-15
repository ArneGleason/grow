# Kickoff: Track D4 — diversity floor + latent reservoir (anti-convergence, ambitious version)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14
**Supersedes** the earlier simple-floor D4 kickoff (`claude/codex-d4-kickoff`). Arne chose the bigger, riskier
version — fold the latent-diversity reservoir in now.

---

## The problem (live in D3) + the goal

Strict fitness selection converges prematurely: top fitness plateaued at 0.8199 by generation 4, with
`meanEliteFitness == topFitness` from gen 2 (the elite became behavioral clones of one lineage). D4 adds
**two complementary anti-convergence mechanisms**:
1. a **similarity floor** so the *scored* elite isn't near-duplicates, and
2. a **latent reservoir** that *preserves interesting-but-unrewarded genes* (selected by criteria orthogonal
   to the fitness scorer) — and lets them **breed** — because a nice variation often doesn't pay off until
   later (neutral drift / stepping stones / quality-diversity).

**Prerequisite (Arne):** merge `codex/byte-d3-iterating-loop` to `main`. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-d4-diversity-reservoir
```

## Non-negotiable invariants (the safety floor — keep these even while being bold elsewhere)

1. **Elitism preserved.** The top-fitness candidate (and the top fitness tier) is always elite, so
   `topFitness` stays **non-decreasing across generations**. The reservoir is *additional* preserved
   capacity; it never displaces the best. (Take risks with exploration, never with losing the best.)
2. **Deterministic.** Same inputs + fresh store → identical strata + results.
3. **In-scale + bounded.** All reservoir candidates are validated phrase genomes; reservoir + elite are
   capped. No new note logic.
4. **Default off ⇒ D3-identical** (regression guard; lets us A/B).

## Population strata after selection (per kind, per branch)

- **Fitness elite** — top-`fitnessElites` by fitness (the exploiters; guarantees invariant 1).
- **Diverse elite** — additional elite slots filled greedily in fitness order but **skipping any candidate
  within `minDistance` of an already-kept elite** in prosody-subscore space (the similarity floor — no clones).
- **Latent reservoir** — a **bounded** archive (`reservoirLimit`) of candidates that are **high on
  interestingness but not high on fitness**. Give them a new candidate status **`"reserved"`** (add to the
  A1 status enum; it's a TEXT column, no migration) — exempt from purge, not counted as elite.
- **Everything else → purged.**

## Interestingness — orthogonal to the fitness scorer (the crux)

The prosody scorer is **rhythm/phrasing-centric** (richness=duration entropy, anacrusis, questionAnswer,
anchorContrast=beat alignment). So measure interestingness on dimensions it *ignores* — chiefly the
**melodic-pitch content** — plus novelty:
- **Melodic-pitch interest** (computable from the phrase `events`' `scaleDegree`/`octave`): intervallic
  variety (entropy / distinct count of consecutive-onset interval deltas), register breadth (range of
  `octave*scaleLength + scaleDegree`), pitch-class diversity (distinct `scaleDegree % scaleLength`). These are
  genuinely orthogonal: a phrase can speak ordinarily (mid prosody fitness) yet leap strikingly or range
  widely (high pitch-interest).
- **Novelty/rarity:** distance to the k-nearest already-kept candidates in prosody-subscore space
  (fitness-independent by construction).
A candidate enters the reservoir when its **interestingness is high but its fitness is below the elite floor**
— the deliberately-preserved recessive genes. Put the interestingness metric in a shared module (like the
scorers), not inline in the server.

## The feedback that makes it matter — the reservoir must breed

In the cycle's develop step, draw a fraction of development parents from the **reserved** stratum, not only
the elite (deterministically chosen). Develop them via the existing B2 operators, score the children, and let
them compete normally. Without this, the reservoir is inert; *with* it, latent genes get recombined and can
surface into the elite later. This is the whole point of "pays off down the line."

## Boundaries
- Inspect-only (no audio/model/transport; auditioning stays D2's API).
- Compose existing scorers/operators/persistence; the only new logic is the interestingness metric +
  the diversity/reservoir selection + the reserved-parent draw.
- Bounded reservoir; deterministic; in-scale; default off ⇒ D3-identical.

## Acceptance tests (deterministic — fresh DB; not the audio preview)
1. **Elitism holds** with everything on: `topFitness` non-decreasing across generations.
2. **Elite stays diverse:** elite mean pairwise behavioral distance stays above a floor (does not collapse to
   ≈0), vs the D3 baseline where `meanEliteFitness == topFitness`.
3. **Reservoir preserves the unrewarded:** the reserved stratum is non-empty and its members have **fitness
   below the elite floor** yet **interestingness above a threshold** (proving it keeps low-fitness/high-
   interest genes, not just runners-up).
4. **The reservoir breeds:** at least some developed children have a `reserved` parent (the feedback loop is
   wired and deterministic).
5. **Default off ⇒ D3-identical** (regression guard).
6. **Determinism:** same `{seed, generations, count, eliteLimit, diversity, reservoir}` + fresh store →
   identical strata + summaries.

**Report (don't hard-assert):** per generation — fitness curve, elite mean-pairwise-distance, reservoir size,
and (the dream) any candidate whose lineage passed through the reservoir and later reached the elite. That
last one is the research payoff and can't be guaranteed deterministically — report it if it happens over a
longer run.

## Risk note (you and Arne both signed up for this)
Too much preserved/low-fitness material *dilutes* selection and the loop can wander instead of converging on
good music. Keep `reservoirLimit` small relative to `eliteLimit`, and make interestingness a *real* signal
(not random). If it wanders, the knobs to pull back are `reservoirLimit`, the reserved-parent fraction, and
the interestingness threshold — all bounded params, so it's recoverable.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track D4: diversity floor + latent reservoir (anti-convergence)"
git show --stat HEAD
git push -u origin codex/byte-d4-diversity-reservoir
git rev-parse origin/codex/byte-d4-diversity-reservoir   # include this sha in the handoff
```
Handoff with **branch + commit sha**, your design choices (the interestingness metric, the strata sizes, the
reserved-parent draw), the per-generation fitness + diversity + reservoir numbers you observed, and
validation results.

**Note:** A/B-ing on the same seed in one store still hits the `branchId`-omitted-from-id collision — use
different seeds per run, or fix the branch-scoped id first.

— Claude
