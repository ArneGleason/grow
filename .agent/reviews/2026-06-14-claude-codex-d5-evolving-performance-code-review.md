# Claude Review: Track D5 — Autonomous Evolving Performance (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `0c11c9d` on `origin/codex/byte-d5-evolving-performance` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-d5-evolving-performance-code-review`

## Verdict

**Approved — merge `codex/byte-d5-evolving-performance`.** This is the payoff: the band performs the evolving
top elite, and the performed melody **monotonically improves while it plays** — I ran it live and heard it
climb. The bold mechanism (timer-stepped background batches) is held to every safety invariant: a *pure*
strictly-better selector, swaps through the D2 audition path only, in-scale by construction, explicit-start /
default-off, deterministic elite sequence, clean stop. Build/db:smoke/diff green; smoke **68/68 on a fresh DB**
(clean run, no concurrent server); audit unchanged.

## Live verification (the milestone)

`performEvolvingElite(seed 4242, 50 gens, batch 2, diversity on)` + playback, polled over the run:

```
gen  2 → perform fitness 0.7945   (swap)
gen  4 → perform fitness 0.8199   (swap)
gen 18 → perform fitness 0.859    (swap — phrase_..._var_4, a DEVELOPED variant)
gens 24–50 → held (reason "not-better"), status → complete
```

- **Monotonic, never downgraded** — 3 swaps, all strictly upward; `lastSelectionReason` alternated
  "strictly-better" (swap) / "not-better" (hold). The listener's fitness never drops.
- **Heard melody == the performed elite, in-scale** — after the final swap, 16 heard melody events, pitch
  classes {Bb, G, D, F}, **zero out-of-scale**; active melody source = the 0.859 elite's 21-note phrase.
- **Clean stop** — `stopEvolvingElite()` → status `idle`, audition override cleared, default restored.
- **The cap relaxation earned its keep:** the gen-18 winner at **0.859** is a *developed variant* that beats
  the **0.8199** ceiling we repeatedly hit at ≤12 generations. Longer horizon + B2 development surfaced a
  genuinely better melody — concrete justification for raising the cap.

## Focus-point confirmations

1. **Cap raised** — `MAX_EVOLUTION_GENERATIONS = 500`; ran 50 generations live. ✓
2. **Deterministic elite sequence** — `runEvolution` takes `startGenerationIndex`, and each batch computes
   `createGenerationSeed(seed, startGenerationIndex + i)`, so batched evolution is *identical* to straight
   evolution (no gen-0 replay). The swap ids are seed-derived and reproducible. ✓
3. **Monotonic performed fitness** — `selectStrictlyBetterElite` (pure, `evolving-performance.ts`) only returns
   `shouldSwap` for `first-elite` or `best.fitness > current.fitness + EPSILON`; ties/lower → `not-better`,
   no swap. Live trajectory confirms it. ✓✓
4. **Audition wiring intact** — swaps call `applyCandidateMelodyAudition` → `refreshLookaheadSchedule` (the D2
   path); live the heard melody is the performed elite, in-scale. No new scheduling path. ✓
5. **Default-off / smoke green** — explicit start; full smoke 68/68 unchanged. ✓
6. **Clean stop** — driver timer cancelled + override cleared (verified live). ✓

## Safety review (where the risk did NOT go)

- **`runSerial` guard checked both before *and* after the async `runEvolution`** — a stale timer from a
  stopped/restarted run bails out (the classic background-loop race is handled correctly).
- The selector is a **pure function**, unit-testable independent of audio — the right place for the
  monotonic-swap invariant.
- Swaps reuse the verified D2 refresh (cancel slow-thinking + clear ledger + clear fallback timers + rebuild),
  so a mid-playback swap is the same safe operation already approved.

## Bonus fix + notes

- **Idempotence fix:** candidate-cycle scoring now normalizes aggregate fitness to the server's 4-decimal
  precision before comparing — closes a repeated-run rescoring bug that appended an extra `candidate.scored`
  event. Good catch; tightens the D1–D4 idempotence guarantee.
- **Observation (non-blocking):** each swap triggers a `refreshLookaheadSchedule` (clears ledger + re-anchors).
  With monotonic + few swaps this is fine; if a future config produced *frequent* swaps you'd hear frequent
  re-anchoring. Not an issue at current swap rates.
- **Carry-forward (unchanged):** the shared client/server helper module (duplicated `scopeCandidateIdForBranch`
  / `normalizePhraseGenome` etc.) remains the standing cleanup before trusted/untrusted provenance.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. The machine now performs its evolving best, audibly and monotonically. This is the arc's payoff
landing.
