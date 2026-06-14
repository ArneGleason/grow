# Handoff: Track B1+B2 Prosody Scoring & Development Operators Review

**From:** Gemini (Antigravity) on `macbook-pro-m5`
**To:** Claude Code on `mac-mini-pro-m4`
**Relay:** Arne, manual
**Date:** 2026-06-14
**Status:** Ready for review on branch `gemini/prosody-scoring-operators`

Claude, I have completed the implementation of Track B1 (prosody scoring) and Track B2 (development operators) as pure, deterministic functions on the `gemini/prosody-scoring-operators` branch. Please check out the branch and review the changes:

```sh
git checkout gemini/prosody-scoring-operators
```

## What was implemented

### 1. Track B1: Prosody Scoring (`src/prosody-scoring.ts`)
Implemented `scoreProsody(phrase, meter)` to evaluate the following:
- **Long/short richness (inverted-U)**: Uses Shannon entropy of note durations and adjacent contrast ratio (penalizing both completely even/monotonous rhythms and extremely random/chaotic ones).
- **Anacrusis presence**: Detects weak pickup notes (duration $\le 0.25$ beats, velocity $\le 0.25$) at the start of antecedent (beat 0) and consequent (beat 8) halves.
- **Antecedent-consequent shape**: Verifies antecedent ends on a suspended cadence (non-tonic degrees like 4, 2, 5) and consequent ends on a resolved cadence (tonic 0 or 7) with a solid downbeat landing.
- **Anchor-vs-contrast**: Normalizes note start times against metrical downbeats (downbeats map to 1.0, syncopated sixteenths to 0.0) into a linear alignment score.

### 2. Track B2: Development Operators (`src/prosody-development.ts`)
Implemented the following deterministic operators returning a new `PlayerPatternSource`:
- `reFoot(phrase, seed)`: Re-generates the rhythmic durations using a seed while mapping the original scale degrees onto the new note events in order.
- `shiftAnacrusis(phrase, action)`: Supports `'add' | 'remove' | 'lengthen' | 'shorten'` actions to modify pickups and shift the body note start beats to fit.
- `alterCadence(phrase, action)`: Supports `'question-to-answer' | 'answer-to-question' | 'extend-cadence' | 'shift-accent'` to modify cadence pitches and timing.
- `varyContour(phrase, action)`: Supports `'invert' | 'retrograde' | 'transposeUp' | 'transposeDown' | 'narrow' | 'widen'` pitch transformations, preserving rhythm exactly and keeping degrees within scale boundaries `[-1, 8]`.

### 3. Unit Tests (`tests/prosody.spec.ts`)
Added 9 playwright unit tests verifying each score metric and development operator.

## Verification
- Clean compilation: `npm run build`
- All 46 tests (37 smoke + 9 new unit tests) pass successfully:
  ```sh
  npx playwright test --workers=1
  ```

## Key areas for review
1. **Richness and Anchor/Contrast Metrics**: Does the Shannon entropy + contrast ratio combination appropriately penalize monotony/chaos? Is the normalized linear anchor-vs-contrast alignment robust for consensus/taste evaluation?
2. **Anacrusis Shift & Cadence Alteration boundaries**: Ensure note shift offsets and cadence duration extensions fit nicely within the phrase bounds and prevent overlaps or missing cadences.
3. **Contour Transposition & Inversion Bounds**: Verify that scale degree clamping logic (`[-1, 8]`) correctly keeps note pitches within the safe in-scale constraints.
