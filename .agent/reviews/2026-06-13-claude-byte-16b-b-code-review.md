# Claude Review: Grow Byte 16b-b (Form Variant Score Discrimination)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `a026181 Improve form variant scoring` on branch `codex/byte-16b-b`
**Base:** `main` at `331eb22`
**Review branch:** `claude/byte-16b-b-code-review`

## Verdict

**Approved - merge `codex/byte-16b-b`.** This resolves my Byte 16b-a forward note exactly: a new
`proportion` subscore (first-chorus arrival / final-chorus payoff room / bridge breath / chorus-verse
balance) breaks the Early-Hook vs Wide-Return tie **for a musically real reason, isolated to the new
metric** - not via arbitrary reweighting. It is scoring/display-only: no playback, selector, transport,
persistence, model, or consensus change. Build/db:smoke/diff green; smoke **32/32**. One precise,
non-blocking finding (a `bandScore` over-max degeneracy that only bites the chorus/verse ratio term).

## Real scorer output (deterministic probe, `createFormScore` per variant)

| variant      | total | harm | energy | **proportion** | motif | cadence | proportion summary                          |
|--------------|-------|------|--------|----------------|-------|---------|---------------------------------------------|
| classic-arc  | 0.837 | 0.87 | 1.00   | 0.812          | 0.87  | 0.56    | hook 17%, final 8 bars, bridge 8, c/v 1.50x |
| early-hook   | 0.811 | 0.87 | 1.00   | **0.619**      | 0.87  | 0.61    | hook 11%, final 8 bars, bridge 4, c/v 3.00x |
| wide-return  | 0.850 | 0.87 | 1.00   | **0.835**      | 0.87  | 0.61    | hook 18%, final 12 bars, bridge 4, c/v 2.33x|

The lift is **isolated to `proportion`** - harmony (0.87), energy (1.00), and motif (0.87) are identical
across all three variants, so the only thing that moves the total ordering is the new metric. The tie is
gone: all three totals are now distinct (0.811 / 0.837 / 0.850), and Wide Return > Early Hook on both
`proportion` and `total`.

## Focus-point confirmations

1. **Scoring/display only?** Yes. `form-scoring.ts` imports only types + the pure `applySectionDynamics`
   (no transport/persist/schedule/synth). `proportion` appears in `main.ts` **only** in `renderFormScore`
   (the subscore display line). The selector, `applyFormVariant`, `applySongSectionDecision`, transport, and
   persistence schema are untouched in the diff. The form score remains inspect-only (consumed only by
   `renderWorld` + `window.formScore`).
2. **Musically sensible?** Yes. The four terms are inverted-U bands on real form ratios, weighted toward the
   payoff: final-chorus room **0.34** (dominant), hook arrival 0.25, bridge breath 0.21, chorus/verse balance
   0.20 (sum 1.0). Final-chorus payoff carrying the most weight is the right instinct - "does the last chorus
   have room to land" is the strongest signal of whether a form *arrives somewhere*.
3. **Tie broken for the right reason?** Yes, and this is the key check. Wide Return's `proportion` 0.835 vs
   Early Hook's 0.619 is driven by exactly the traits that distinguish them: Wide Return's **12-bar final
   chorus** (a payoff with room) and its **well-placed 18% hook arrival**, vs Early Hook's **clipped 11% hook**
   (just below the satisfying band) and **lopsided 3.0x chorus/verse** ratio. Those are the defining features
   of each form, so the metric is rewarding/penalizing the audible difference, not an arbitrary constant.
   The other subscores being identical proves the discrimination comes from form proportion specifically.
4. **Classic Arc still valid/default; winner informational?** Yes. No selector/apply/transport change, so the
   default and the measure-before-drive boundary are intact - the winner is still shown, never auto-applied.
   (Note: absolute totals shifted because the weights changed - Classic is now the *middle* score, 0.837,
   not the lowest as under 16b-a's 0.28/0.26/0.24/0.22 weights. That is expected and harmless: the score is
   inspect-only and nothing keys off the absolute total; what matters is that the three are now distinct and
   ordered for real reasons.)
5. **Smoke behavior-level, not over-coupled?** Yes. The new assertions are *relational*, not pinned to exact
   numbers: every variant `proportion > 0`; `wideReturn.total > earlyHook.total`; `wideReturn.proportion >
   earlyHook.proportion`; plus the e2e check that the inspector subscore row contains `proportion`. Asserting
   the ordering that this byte exists to create (rather than magic constants) is exactly the right coupling.

## Finding (non-blocking) - `bandScore` over-max branch is degenerate for ratio metrics > 1

`bandScore(value, min, max, ideal)` (`form-scoring.ts:452`) handles the over-max case as:

```ts
if (value > max) return roundScore(clamp((1 - value) / Math.max(0.0001, 1 - max), 0, 1) * 0.75);
```

This assumes `value` lives in `[0, 1]`. Three of the four proportion terms (hook/final/bridge) are
beat-ratios that are always < 1, so the branch is a proper ramp and behaves correctly. But **`chorusVerseRatio`
can exceed 1** (it is `chorusBeats / verseBeats`; Early Hook = 3.0, Wide Return = 2.33). For `value > 1` and
`max = 2.6`, `(1 - value) / (1 - max)` is `negative / negative` = positive and **clamps to 1.0 for any value
above the band**, so every chorus-heavy form scores a flat `0.75` on `chorusBalance` no matter how lopsided -
3.0x and 10.0x are scored identically. It is **not** breaking this byte (the tie still resolves correctly via
the other three terms, and Early Hook's penalty mainly comes from its clipped hook arrival), so it is not a
required fix. But the chorus/verse-balance term currently **under-discriminates** verse-starved forms, which
is worth tightening before the proportion subscore gets leaned on harder - specifically before the planned
**goal-relative scoring** (17e) starts judging variants against a requested energy/form, where "way too
chorus-heavy" should be separable from "a bit chorus-heavy." Suggested fix: give the over-max branch a real
falloff for ratio-domain metrics (e.g. penalize by `(value - max)` scaled, or operate on `1/ratio` so both
sides live in `[0,1]`).

## Notes (trivial / carry-forward)

- `FormScoreSection` gains `durationBeats` + `bars` (additive, consumed by `scoreProportion` + display).
  `section.bars` is read from the arrangement section - build passes, types fine.
- Carry-forward (unchanged): fallback `status` check + dev-flag gating (16a); Vite 8 / esbuild advisory
  (`npm audit` = 2 high, unchanged from prior bytes); dead `MusicalEventRecordBuffer`;
  consensus-affinity-from-disposition.

## On verification approach

Scoring/display-only change to an inspect-only subsystem, so I verified deterministically: the real scorer
output per variant (probe above), `git diff` proving the boundary, and 32/32 incl. the new ordering
assertions + the e2e subscore-display check. A live audio capture would only re-confirm unchanged playback
(and the preview audio clock remains flaky), so I did not run one - same rationale as the 16a-d refactor.

## Merge + next slice

- **Merge `codex/byte-16b-b`.** The ruler now discriminates the three forms for real, audible reasons - the
  precondition I flagged before letting the form score ever auto-drive or feed a proposal step.
- **Next:** with the ruler sharpened, the natural next moves are still (a) the **Song-Goal arc** (plan pushed
  on `claude/song-goal-arc-plan`, `f69c5b4`) - a human/agent idea -> bounded `SongGoal` brief, where this
  proportion metric becomes the basis for *goal-relative* form scoring; (b) finish verse/bridge chord-aware
  melody scoring (open from 16a-b); (c) the human/remember-good loop. If you go toward goal-relative scoring,
  tighten the `bandScore` over-max branch first (the finding above).

## Blockers before the next byte

None.
