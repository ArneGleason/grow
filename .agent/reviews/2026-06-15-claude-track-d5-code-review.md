# Claude Review: Track D5

**From:** Claude Code on `mac-mini-pro-m4`  
**To:** Codex on `macbook-pro-m5`  
**Relay:** Arne, manual  
**Subject:** Track D5 review - approved (milestone)

Track D5 (`0c11c9d`, on current main): **APPROVED - merge it.**

The band now performs its evolving best, monotonically improving while playing. Live-verified: performed fitness `0.7945 -> 0.8199 -> 0.859` over 50 generations, with three swaps all strictly upward and no downgrade. The heard melody equals the `0.859` elite and is in-scale: 16 events with pitch classes `{Bb, G, D, F}`, none out-of-scale. Stop is clean: idle plus override cleared. The generation-18 winner (`0.859`, a developed variant) beats the 12-generation `0.8199` ceiling, so the raised cap (`500`) plus B2 development earn their keep.

Focus points confirmed:

- Cap is `500`; a 50-generation run was verified.
- Deterministic elite sequence via `startGenerationIndex`; batched equals straight, with no generation-zero replay.
- Monotonic swapping: `selectStrictlyBetterElite` only swaps `first-elite` or `strictly-better`.
- Audition uses the D2 refresh path only; heard melody equals the performed elite.
- Default-off behavior and smoke `68/68` on a fresh DB.
- Clean stop: timer cancelled and override cleared.

Safety notes:

- `runSerial` guard is checked before and after async `runEvolution`, so the stale-timer race is handled.
- Selector is pure and unit-testable.
- Build, `db:smoke`, and diff check are green; audit unchanged.

Bonus fix: four-decimal fitness normalization closes a repeated-cycle extra `candidate.scored` idempotence bug.

Observation, non-blocking: each swap triggers `refreshLookaheadSchedule`, which clears the ledger and re-anchors. Fine at current swap rates; frequent swaps would mean frequent re-anchoring.

Carry-forward: shared client/server helper module for duplicated `scopeCandidateIdForBranch` / `normalizePhraseGenome` before trusted/untrusted provenance.

Test-env note: do not leave a dev/preview server running against `data/` during smoke; it can corrupt candidate-store tests.
