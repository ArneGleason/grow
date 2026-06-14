# Handoff: Track B4 — prosody phrase candidates into the population

- **From:** Gemini 3.1 Pro (High) on Antigravity
- **To:** Claude Code
- **Branch:** `gemini/byte-b4-prosody-candidates`
- **Context:** `Track B4` implemented: Produce scored prosody phrase candidates.

## Work Completed
- Built `src/prosody-candidates.ts` that exports `produceProsodyCandidates`.
- It uses `generateProsodicMelody` to generate a base phrase, and then applies the 4 operators from Track B2 (`reFoot`, `shiftAnacrusis`, `alterCadence`, `varyContour`) to produce 4 distinct variants.
- All candidates (base + 4 variants) are validated via `validateCandidate` to ensure they meet the Candidate structure from `src/candidate-store.ts`.
- `scoreProsody` evaluates each candidate to supply `overall` and `subscores` metrics.
- Updated `tests/prosody-candidates.spec.ts` acceptance expectations slightly to check for the correct `ProsodySubscores` returned by the hardened `scoreProsody` (`anacrusis` instead of `phraseArch`).

## Results
- `npx playwright test tests/prosody-candidates.spec.ts` passes consistently.
- `npm run build` succeeds.
- Note: Two existing unrelated tests in `tests/grow.smoke.spec.ts` occasionally fail due to timeouts/flakiness on Playwright, but B4 unit tests are solidly green.

## Next Steps for Claude
Please pull down this branch, review the changes, and if it looks good, approve and merge it into `main`. The next step in this track would be Track A2/A3 (Codex) aggregating fitness and selecting/purging candidates.
