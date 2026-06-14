# Kickoff: Track B1 hardening — make the prosody scorer fitness-ready

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Gemini 3.1 Pro (High) in Antigravity, on the Intel MacBook
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14
**Status:** Kickoff — work branches off `gemini/prosody-scoring-operators`

---

**You are:** Gemini 3.1 Pro (High) in Antigravity, working on **Grow** — a browser-first local-AI
music project (PixiJS + Tone.js + Vite + TypeScript). It follows a "Studio Pattern": small bounded
changes on branches, reviewed by Claude Code before merge. Work in TypeScript; keep changes pure and
deterministic.

**Where this fits:** A previous agent implemented Track B1 (prosody scoring) and B2 (development
operators) as pure functions. Claude reviewed them: **approved as inspect-only, with one required fix
before the scorer is allowed to become a fitness function.** Your job is that hardening. Full review:
`.agent/reviews/2026-06-14-claude-gemini-prosody-b1b2-code-review.md` (on branch
`claude/gemini-prosody-b1b2-code-review`) — read it for context; the essentials are inlined below.

## Setup

```sh
git fetch origin
git checkout gemini/prosody-scoring-operators   # has melody-prosody.ts + prosody-scoring.ts + prosody-development.ts + tests, 46/46 green
git checkout -b gemini/prosody-scoring-hardening
```

## REQUIRED fix — `scoreAnchorContrast` has the wrong gradient (`src/prosody-scoring.ts`)

Today it is `clamp((averageAlignment - 0.1) / 0.9, 0, 1)` — a monotonic ramp that rewards **maximal
on-beat anchoring**. Proven: a robotic on-every-beat line scores 0.667, an expressive mix 0.444, and
**the actual good generated melody (`generateProsodicMelody`) scores 0.134 — near worst.** That is
backwards: if this drives selection it will breed *toward* a metronomic nursery-rhyme feel.

**The intent (this is the part to get right, not just "invert the curve"):** a compelling melodic line
**anchors its structurally-important notes** (the focal/long/accented notes — especially the phrase
cadences) **on or near strong beats**, while **using off-beat placement for contrast and drive on its
connective notes**. Penalize *both* extremes: (a) everything locked on strong beats (no contrast → a
march), and (b) the focal/cadence notes themselves floating off-beat (no structural grounding →
unmoored). A plain average-alignment statistic can't express this because it conflates "a lively mix of
strong-beat focal notes + off-beat connectives" with "everything on bland medium beats" — so weight by
note importance rather than averaging flat.

**Suggested formulation (you choose the exact math, but it must pass the tests):** combine a
**focal-anchoring** term (do the highest-velocity / longest notes, especially the antecedent &
consequent cadences, land on strong metrical positions?) with a **contrast-presence** term shaped as an
inverted-U (some — but not all — of the connective/non-focal notes fall off the beat). Neither extreme
should win.

**Acceptance tests (add to `tests/prosody.spec.ts`, all must pass):**
1. `generateProsodicMelody(...)` scores **higher** on `anchorContrast` than a fully-on-every-beat line.
2. It also scores **higher** than a fully-off-beat line (all notes on 16th offsets).
3. A line whose cadence/focal notes anchor on strong beats while connectives float scores near the top;
   a line identical except its cadences are pushed off-beat scores lower.

## Also address (small, improves fitness quality)

- **Cadence detection by pitch-class, not exact degree.** `scoreQuestionAnswer` checks `=== 0 || === 7`
  (tonic) and `=== 4` (dominant). Use `((degree % scaleLength) + scaleLength) % scaleLength` so it
  survives transposition by `varyContour` (scaleLength is 7 here). Tonic = pitch-class 0; dominant =
  pitch-class 4.
- **Quantize durations before the richness entropy.** `scoreRichness` buckets durations at 0.01, so the
  generator's `×0.96` articulation makes 0.24 vs 0.25 distinct buckets and inflates entropy with
  non-musical variety. Round durations to the nearest 0.25 (musical grid) before computing entropy.

## Optional (note, don't over-reach)
- `scoreProsody`'s `meter` param is unused and the phrase geometry (antecedent/consequent split at beat
  8, length 16, 4/4) is hardcoded. Either honor `meter` or add a guard/comment so a different phrase
  length can't mis-score silently.

## Disciplines (do not break)
- **Pure, deterministic functions.** Same seed/input → same output. No I/O, no audio, no playback.
- **Inspect-only.** This byte does NOT wire the score into selection/playback — it only makes the score
  *correct*. (Track D wires it later.)
- **In-scale safety is already guaranteed** by `noteFromScaleDegree` + the `[-1,8]` degree clamp — don't
  touch that.
- Keep all existing tests green; add tests for every new behavior.

## Finish (don't skip — last time work was almost stranded by not pushing)
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
git add -A && git commit -m "Harden prosody scorer: anchorContrast inverted-U + pitch-class cadence + richness quantize"
git push -u origin gemini/prosody-scoring-hardening      # MUST push to origin
```
Then write a short handoff for Claude (From/To/Relay, branch, commit, what changed, what to review,
validation results) and give it to Arne to relay.
