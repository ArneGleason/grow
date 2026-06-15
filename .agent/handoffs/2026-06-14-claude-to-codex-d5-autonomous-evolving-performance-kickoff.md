# Kickoff: Track D5 — autonomous evolving performance (the band performs its evolving best, live)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14
**Risk posture:** Arne asked to be more progressive here — this is a bolder byte. Hold the safety invariants
below hard; be ambitious with everything else.

---

## The leap

Everything is in place — the loop produces, scores on quality, selects (elitism + diversity + reservoir),
develops musically, iterates, and D2 can audition an elite into playback. D5 connects the last wire: **the
band performs the evolving top elite, and the performance updates as evolution finds better candidates** — so
you *hear the melody improve, generation over generation, while it plays.* This is the project's payoff:
it stops being a thing you query and becomes a thing you listen to getting better.

**Prerequisite (Arne):** merge `codex/byte-branch-scoped-candidate-id` to `main`. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-d5-evolving-performance
```

## Task

1. **Relax the generation cap (folded in, low effort).** `MAX_EVOLUTION_GENERATIONS = 12` is too low for
   long-horizon evolution. Raise it to a sane upper bound (e.g. 500) or parameterize it. Keep a bound (don't
   make it unbounded).
2. **Autonomous evolving performance.** Add a driver (e.g. `window.prosody.performEvolvingElite({ seed,
   branchId, generations, batch?, diversity? })`) that:
   - runs the evolutionary loop (now over many generations),
   - **auditions the current top elite into playback** via the existing D2 audition path
     (`melodyPhrasing` → `refreshLookaheadSchedule`), and
   - as evolution advances, **re-auditions to a strictly-better elite when one emerges** — so the performed
     melody monotonically improves while playing.
   - Bold/progressive shape (your call): a timer-stepped background loop that evolves a batch, checks for a
     better elite, swaps, and repeats; or a step function that does one batch per call. Propose which.
3. Expose start/stop/getState so it's controllable and inspectable.

## Safety invariants (non-negotiable — these are where the risk does NOT go)

1. **Only ever swap to a *strictly-better* elite.** The performed melody's fitness is monotonically
   non-decreasing — never downgrade what the listener is hearing. (Measure-before-drive, applied live.)
2. **Swaps go through the approved audition path only** (`refreshLookaheadSchedule` — cancels slow-thinking,
   clears the ledger + fallback timers, rebuilds). A mid-playback swap is the same safe refresh D2/SongGoal
   already use; do not introduce a new scheduling path.
3. **In-scale by construction.** The performed genome is a validated phrase `PlayerPatternSource`; pitch
   resolves through `noteFromScaleDegree`. The performance can sound clumsy, never out-of-key.
4. **Explicit start, default off.** Nothing auto-evolves or auto-plays on load; the full smoke stays green
   unchanged. It runs only when explicitly started.
5. **The evolved elite *sequence* is deterministic** given `(seed, branch, config)`. (Live *swap timing* is
   real-time — fine for performance; the underlying content is reproducible.)
6. **Stop cleanly.** Stopping halts evolution + clears the audition override, restoring prior behavior.

## Acceptance tests (deterministic where possible — fresh DB; not the audio clock)
1. **Cap raised:** `runEvolution({ generations: 50, ... })` runs 50 generations (no longer capped at 12).
2. **Deterministic elite sequence:** the sequence of top-elite ids/fitness across generations is identical for
   the same `(seed, branch, config)` on a fresh store.
3. **Monotonic performed fitness:** the driver only updates the performed elite to a strictly-higher fitness;
   given a known evolution run, the performed-elite fitness over time is non-decreasing and ends at the run's
   peak. (Test the *selection-of-what-to-perform* logic deterministically, separate from audio.)
4. **Audition wiring intact:** when performing, the active `melodyPhrasing` source is the current top elite's
   genome (reuse D2's verified path); stop restores default.
5. **Default-off / existing smoke green:** no auto-start; D1–D4 + audition smoke unchanged.

(The actual "hear it improve" is audible/real-time — I'll verify that live in review by running it and
capturing the heard melody changing to higher-fitness genomes over generations. Your tests should pin the
deterministic *logic*: cap, elite sequence, monotonic-swap rule, audition wiring.)

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs;
# don't leave a dev/preview server running against data/ during smoke (it corrupts the candidate tests)
git add -A && git commit -m "Track D5: autonomous evolving performance + raise generation cap"
git show --stat HEAD
git push -u origin codex/byte-d5-evolving-performance
git rev-parse origin/codex/byte-d5-evolving-performance   # include this sha in the handoff
```
Handoff with **branch + commit sha**, the driver shape you chose (background timer vs step function), what the
new cap is, and validation results.

**Deferred:** the longer/more-seeds diversity sweep (now unblocked by the higher cap) — we'll run that as a
measurement experiment later. Carry-forward: shared client/server helper module (the duplicated scope/validate
functions).

— Claude
