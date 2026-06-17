# Kickoff: Byte L1d — prosody generator emits the anchors+connectors representation (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` (`e7f2dae` — the L-stack + L0b are now merged). State your base sha back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` + roadmap. Builds on `src/melody-prosody.ts`,
`src/anchor-phrase.ts` (L1a), `src/anchor-phrase-render.ts` (L1b/L1c). **Phase 1, byte L1d.**

Arne's decision: **convert the prosody generator to think natively in anchors+connectors.** This *will* change
the audible melody (the connector kernels regenerate passing motion rather than the old per-cell notes). That's
accepted — provided the **prosodic character and the in-scale invariant are preserved**.

## The safety lever (read first)
**Keep `generateProsodicMelody`'s external contract identical.** Its signature stays
`generateProsodicMelody(input): PlayerPatternSource`. Internally it now:
1. builds an `AnchorPhrase` from the prosodic structure (`generateProsodicAnchorPhrase`), then
2. returns `renderAnchorPhrase(thatPhrase, { baseOctave, subdivisionBeats: GRID })`.

Because the **output type/shape is unchanged**, the candidate-store, prosody scorer, evolution, playback, and
transport are all **untouched** — this byte is contained to the generator + its tests. Do **not** change the
candidate-store genome, scoring, or any consumer.

## The mapping (prosody → anchors + connectors)
Map the existing structure in `melody-prosody.ts` onto the representation:
- **Antecedent + consequent phrases → two SEGMENTS**, with the existing breath between them as the **gap**
  (first-class rest between segments).
- **Focal notes (stress 2) and the cadence note → ANCHORS** (the structural tones). Anchor `dynamics` from the
  stress velocity; `durationBeats`/`octave` as today; `degree` from the arch contour.
- **Weak/mid passing notes (stress 0/1) between focal tones → CONNECTORS.** Stepwise passing → `fill`;
  the anacrusis run-in / cadential lean → `approach`. Choose kernel + knobs **deterministically** from the
  prosodic function (you have latitude — fill is the default workhorse).
- **Anacrusis pickup →** a soft leading anchor (low dynamics) at the segment start, *or* an `approach`
  connector into the first anchor — your call; keep it light.
- **Arch contour →** the anchor degree sequence (rise to the peak, fall to the cadence).
- **Question/answer →** antecedent cadence hangs on the **dominant** (language degree **5**), consequent
  resolves to **home** (language degree **1**).
- **Degree conversion:** the generator currently works in 0-based-ish degrees (`0` = tonic). Anchors use
  **1-based language degrees** (`1` = home). Convert `languageDegree = engineDegree + 1` when building anchors
  (so cadence `0 → 1`, dominant `4 → 5`). The renderer converts back (`degree − 1`) at render time — make sure
  you don't double-shift.

## Scope
- New exported `generateProsodicAnchorPhrase(input: ProsodicMelodyInput): AnchorPhrase` — **seeded-deterministic**
  (keep the `mulberry32(seed)` variety; same seed → same phrase). This is the native artifact L2's editor will
  read.
- `generateProsodicMelody(input)` becomes `renderAnchorPhrase(generateProsodicAnchorPhrase(input), …)` —
  same `PlayerPatternSource` output.
- Optionally expose the phrase for verification/L2 (e.g. extend the read-only `window.anchorPhrase` getter with
  `fromProsody(seed)` returning the `AnchorPhrase`). Read-only.

## Invariants / guardrails
- **External contract preserved** — `generateProsodicMelody` output type/shape unchanged; no consumer touched.
- **In-scale by construction** — only ever via `renderAnchorPhrase` (integer degrees, wrapped); never a raw pitch.
- **Deterministic** — seed-driven; same seed → identical phrase → identical render.
- **Prosodic character preserved** — two segments + a breath, an arch contour, an anacrusis, a question on the
  dominant and an answer on home. The line should still phrase like speech, not flatten to even notes.
- **Validate** the built phrase through `normalizeAnchorPhrase` before rendering (defensive; should pass clean).

## Tests
- **Update the smoke melody assertions** that pin the old prosody output to the new rendered output — but keep
  the *invariant-level* checks (in-scale, has the antecedent/consequent + breath, lands the answer on home).
  Keep smoke count unchanged where you can. (If a melody assertion encodes exact old notes, replace with the
  new exact notes or assert the structural property instead.)
- **Unit tests** (extend `tests/anchor-phrase-render.unit.spec.ts` or add `melody-prosody.unit.spec.ts`):
  `generateProsodicAnchorPhrase(seed)` is deterministic; produces **2 segments** with a real gap between them;
  uses **1-based** anchor degrees; antecedent cadence anchor = degree **5**, consequent = degree **1**; an
  anacrusis is present; the rendered output is **in-scale** under a sample `tonalContext` (run emitted degrees
  through `noteFromScaleDegree`).

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · the unit suites green · `npm run smoke` (note the count; explain any change) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will **verify the new melody by ear**
(reconstruct from the listening frame / `window` getter): in-scale, two phrases with a breath, rises to the
dominant (question) and resolves to home (answer), arch contour, stress dynamics — i.e. still prosodic, not a
nursery rhyme.

## Out of scope (explicitly)
- Candidate-store storing the anchors+connectors genome (separate byte). Editor/UI (L2+). Other players
  (bass/beats). Chromatic `color`. Changing the scorer or evolution.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: external contract unchanged (output type), seeded
determinism holds, two segments + breath + 1-based cadence degrees (5 then 1), in-scale; which smoke assertions
you updated and the final smoke count; and one line on how the new melody differs audibly from the old prosody.
