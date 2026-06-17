# Claude Review: Byte L1d — prosody generator emits anchors+connectors (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `beeda5d` on `origin/codex/byte-l1d-prosody-anchors` (sha confirmed)
**Base:** `origin/main` `e7f2dae` (verified ancestor)
**Review branch:** `claude/codex-l1d-prosody-anchors-code-review`

## Verdict

**Approved — merge `codex/byte-l1d-prosody-anchors`.** The prosody generator now thinks natively in
anchors+connectors and renders through the L1b/L1c renderer, while **`generateProsodicMelody`'s external
contract (`→ PlayerPatternSource`) is unchanged** — so candidate-store, scorer, evolution, playback, and
transport are untouched. The conversion preserves the prosodic character (question/answer, breath, arch,
anacrusis, stress dynamics) and stays in-scale by construction. Gauntlet: **build 0 · unit grow-language 5/5 ·
anchor-phrase 5/5 · render 8/8 · melody-prosody 5/5 · smoke 70/70 (unchanged) · db:smoke 0 · diff clean ·
audit unchanged**. **Verified by ear** (rendered-stream reconstruction).

## Focus-point confirmations (code + live)

1. **External contract preserved.** `generateProsodicMelody(input): PlayerPatternSource` =
   `renderAnchorPhrase(normalize(generateProsodicAnchorPhrase(input)), {baseOctave, subdivisionBeats: GRID})`.
   Diff touches only `melody-prosody.ts`, `main.ts` (import + read-only `window.anchorPhrase.fromProsody`),
   the unit spec, `package.json` (script), `.agent`. No consumer/genome/scoring change. Unit test pins
   `generateProsodicMelody === renderAnchorPhrase(anchorPhrase)`. ✓
2. **Mapping is faithful.** Focal (stress-2) notes + cadence + two pickup anchors → **anchors**; passing motion
   → **connectors** (`approach` for the lead-in and the cadential lean, `fill` in the middle). Antecedent /
   consequent → two **segments** with the breath as the **gap**. ✓
3. **Degree conversion correct.** `anchorFromEngineDegree` does `degree = scaleDegree + 1` (1-based language);
   `clampDegree` now 0..6 so language degrees stay 1..7. Cadences: antecedent **5** (dominant/question),
   consequent **1** (home/answer) — pinned by unit test and seen live. No double-shift (renderer converts back
   `−1`). ✓
4. **Deterministic.** Seeded `mulberry32`; unit test asserts identical phrases for a seed; live `fromProsody`
   stable. ✓
5. **In-scale by construction.** Only integer degrees emitted; unit test runs every rendered note through
   `noteFromScaleDegree("C","mixolydian")` and asserts pitch class ∈ scale. ✓
6. **By-ear reconstruction (live, current song seed):** antecedent = pickup(ghost) → landing → ghosted passing
   → anchors → **dominant cadence (question)**; breath beats 7–7.75 fully silent; consequent = pickup → arc up
   → **ghosted descending run d3→d2→d1 into the home cadence d0 (answer)** with a d−1 lower-neighbour on the
   resolution. Anchors at 0.46, connector notes ghosted 0.18–0.44. Structural `fromProsody` across seeds
   777/42/2024 all show the same arc + 5-then-1 cadences + 0.5-beat breath + ghost anacrusis. It phrases like
   speech, not a flat line. ✓

## Findings (non-blocking)

- **Double normalize:** `generateProsodicAnchorPhrase` ends with `normalizeAnchorPhrase(...).phrase`, and
  `generateProsodicMelody` normalizes again before rendering. Harmless (idempotent), minor redundancy.
- Antecedent passing density is sometimes sparse vs the consequent (a function of which feet the seed draws) —
  musical, not a defect; just an observation that phrase busyness varies by seed.
- Forward-looking: `generateProsodicAnchorPhrase` + `window.anchorPhrase.fromProsody` are exactly what L2's
  editor will read to show "the idea the player is working on." Good setup.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. The melody now *speaks the new language end to end* — generated as anchors+connectors, rendered in-key,
audibly prosodic. **Phase 1's generator side is done.** Next candidates: candidate-store persisting the
anchors+connectors genome (the remaining L1d-adjacent piece), or **L2 — the read-only editor** that renders
`fromProsody` in the graphical grammar. Arne's call.
