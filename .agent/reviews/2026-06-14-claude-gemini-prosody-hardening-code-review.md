# Claude Review: Prosody Scorer Hardening (Gemini 3.1 Pro)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Gemini (Antigravity), via Arne
**Date:** 2026-06-14
**Reviewed commit:** `d936dbf` on `origin/gemini/prosody-scoring-hardening` (one commit atop B1/B2 `78584e6`)
**Base chain:** `claude/prosodic-melody-leap` (`4b7a85e`) → B1/B2 (`78584e6`) → hardening (`d936dbf`)
**Review branch:** `claude/gemini-prosody-hardening-code-review`

## Verdict

**Approved — merge.** The required fix is done correctly and the gate is cleared: `scoreAnchorContrast` no
longer rewards metronomic anchoring. All three things from the kickoff landed — the anchorContrast dual-term,
richness quantization, and pitch-class cadence detection — plus the optional meter guard. Build/db:smoke/diff
green; smoke **46/46**; audit unchanged. **The prosody scorer is now safe to become a fitness function.**

## The required fix, verified against the acceptance tests

`scoreAnchorContrast` is now a dual-term: focal/cadence notes' anchoring (weighted 0.6) + an inverted-U on
connective-note alignment toward 0.4 (weighted 0.4). A phrase needs *both* focal anchoring *and* connective
contrast to score high — neither extreme wins. I re-ran my own gradient probe:

```
anchorContrast:  generated 0.531  >  on-beat 0.437  >  off-beat 0.220
generated overall prosody score: 0.582 (before) → 0.696 (after)
```

The expressive generated melody now scores **highest**, beating both the robotic on-beat line and the
fully-syncopated line — the exact inversion the previous version got backwards (where the good melody scored
0.134, near worst). The three acceptance tests I specified are all implemented in `tests/prosody.spec.ts`
(`generated > locked`, `generated > offbeat`, anchored-cadence vs pushed-cadence) and pass.

## Other fixes confirmed

- **`scoreRichness` quantization:** durations rounded to nearest 0.25 before the entropy, so the generator's
  `×0.96` articulation no longer inflates richness with non-musical buckets. ✓
- **`scoreQuestionAnswer` pitch-class:** cadence function now `((degree % 7) + 7) % 7` — tonic = pc 0,
  dominant = pc 4 — robust to `varyContour` transposition/octave (old exact `=== 0 || === 7` is subsumed). ✓
- **`meter` guard:** `scoreProsody` now `console.warn`s if meter ≠ 4/4 instead of silently mis-scoring. ✓
  (the geometry is still hardcoded to 16 beats; the guard makes that explicit — full multi-meter support is
  future, which is fine.)
- **No dependency churn:** the package-lock delta removes no `node_modules`/`resolved`/`version` entries
  (benign normalization). Claim holds.

## Findings (trivial / non-blocking)

- **`console.warn` in a pure scorer** is a minor purity wart (logging side-effect). Harmless as a dev guard;
  if you want `scoreProsody` strictly pure later, surface the meter mismatch as a returned warning instead.
- **Tuned constants** (focal threshold `importance > 0.5`, connective target `0.4`, width `0.5`, the
  0.6/0.4 split) are reasonable and pass the tests — document them as tunable when the score feeds A2's
  fitness aggregation, since the weights become selection pressure.

## Note on the previous bounce

The first push of this branch pointed at `78584e6` (the unchanged B1/B2 commit) with none of this work.
This push (`d936dbf`) is correct and contains it. Confirming the lesson worth banking: **a handoff should
quote the commit sha, and the relay should confirm `origin/<branch>` resolves to that sha** — that one check
catches "looks pushed, isn't."

## Merge hygiene (for Arne)

This branch tip (`d936dbf`) contains the **entire prosody stack** — the leap + B1/B2 + this hardening (and,
incidentally, the superseded Euclidean rhythm-plan doc `7c4c7a9`). Merging it to `main` lands the whole
track in one unit. Clean order if you prefer granular history: review/merge the leap base first, then this;
otherwise merging `gemini/prosody-scoring-hardening` brings it all. Drop `7c4c7a9` in a rebase if you want
the history clean.

## Handoff back to Gemini

> Prosody hardening (`d936dbf`) reviewed: **approved — merge it.** The required fix is correct and the gate
> is cleared — `scoreAnchorContrast` is now a dual-term (focal anchoring 0.6 + inverted-U connective contrast
> 0.4), and my independent probe confirms the gradient inverted the right way: generated melody **0.531** >
> on-beat 0.437 > off-beat 0.220 (was 0.134/near-worst before), overall prosody 0.582 → 0.696. The three
> acceptance tests are implemented and pass. Richness quantization (nearest 0.25) and pitch-class cadence
> (`((deg%7)+7)%7`) both landed; the `meter` guard (console.warn) addresses the optional note. build/db:
> smoke/diff green; smoke 46/46; audit unchanged; no dependency churn. **The scorer is fitness-ready.** Two
> trivia: `console.warn` is a small side-effect in a pure function (consider returning a warning instead if
> you want strict purity); the focal/connective constants are tunable and become selection pressure once A2
> aggregates fitness. Excellent, precise work — the spec's acceptance tests were met exactly.

## Blockers before merge

None.
