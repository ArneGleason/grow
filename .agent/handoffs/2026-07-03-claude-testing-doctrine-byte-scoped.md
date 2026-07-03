# Testing Doctrine: Byte-Scoped Discovery, Milestone Sweeps, No Golden Music

**Author:** Claude Code (architect/listening lead), decided with Arne
**Date:** 2026-07-03
**Status:** Agreed and in force immediately — **supersedes the "full gauntlet per byte (sometimes twice)"
acceptance sections in ALL prior kickoffs, including E4's.** Those sections were Claude's doctrine; this
replaces it.

## Why (Arne's decision)

Two problems with the old regime:
1. **Cost:** the full Playwright suite (one 7,488-line smoke file, 65 browser tests, serial on one dev server
   + one SQLite store, ~2–2.5 min/run) was being run repeatedly inside every byte's dev loop — paying the
   merge-gate price at edit-time frequency, multiplied by flake re-runs.
2. **The rut:** tests that pin exact musical output (exact BPM, mode names, degree arrays, note counts —
   ~18 such literals in smoke today) encode *the current sound as the definition of correct*. Every musical
   improvement then breaks tests, and the cheapest path to green is to change the music less. That is a
   mechanical ratchet against exactly the emergent musicality this project exists to find.

Principles: **per-byte testing finds problems in the current byte; completeness runs at milestones to catch
drifted side effects; tests never constrain performance results to a previous target.**

## The three tiers

**Tier 0 — always (seconds):** `npm run build` (types) + the unit suites for the modules you touched.
Musical logic (plans, goal spread, motif ops, renderers) belongs in pure modules with unit specs — provable
without a browser.

**Tier 1 — per byte (the handoff bar):** the byte-focused slice only:
- the smoke tests for the touched domain(s) (`npx playwright test -g "<area>"` or the domain spec file);
- rail tests for any contract the byte touches (e.g. `npm run db:smoke` **only if** the byte touches
  persistence/store; determinism/replay check if generation paths changed);
- `git diff --check`.
Handoffs state *which* slice was run. Reviews (Claude) verify the same slice + the byte's musical claim —
by ear/reconstruction, not by suite-completeness.

**Tier 2 — milestone sweep (scheduled, not per byte):** the complete set — full smoke (on a **non-clean**
store, twice only when the milestone included state-touching bytes), all unit suites, `db:smoke`,
`npm audit`, plus a **listening session** against the arc's acceptance tests (e.g. the hum test).
**A milestone is:** the end of an arc phase (E4 landed+reviewed; E5; …), any merge of a multi-byte stack to
main, and always before resuming vote training. Codex runs the sweep once at the milestone; Claude re-runs it
at the milestone review. Side effects found here get a dedicated fix byte — that is the accepted trade.

## Assertion doctrine (what tests may and may not say)

**Pin these hard (code rails — not aesthetic):** bounds/clamps/validators, schema and persistence
round-trips, `connectors == anchors−1` and structural invariants, scheduler/lookahead behavior, no-crash,
hermeticity (every test must pass on a dirty store), and **replay determinism as a property** — "the same
seed reproduces the same output" (this pins *reproducibility*, never *what* the output is).

**Assert music relationally (against the byte's own contract, never a stored target):**
- "every degree is in scale" — not "the melody equals [2,4,5,…]"
- "phrase count/cadence match the *chosen plan*; AAB contains a transposed repeat" — not "cadence is 5→1"
- "tempo ∈ 66–152" — not "tempo is 90"

**Add variety-regression tests (sameness is the bug):** distribution checks (over N seeds: ≥K modes, ≥K
plans, tempo span ≥X), not-identical checks (two seeds → two different songs), minimum-distance checks
between melodies from different plans. The suite defends the *width* of the musical space, not points in it.

**Never add** a new golden-music literal (exact notes, exact BPM/mode text, exact counts of musical events).
**Convert on touch:** whenever one of the ~18 existing pinned literals breaks under a musical change, replace
it with the relational/property form — do not re-pin to the new output. No big-bang rewrite.

**Quality stays human:** no automated test judges whether music is *good*. That is the listening test, and it
remains the acceptance bar for musical bytes.

## Mechanics (adopt opportunistically, don't block E4)

- **Split `grow.smoke.spec.ts` by domain** (transport/session, editor, catalog+persistence, song-library,
  interplay/listening, song-goal) so "run the touched file" is the inner loop and conflicts stop piling into
  one 7.5k-line hotspot. Fine as a small chore byte or done incrementally on touch.
- **npm scripts:** `test:unit` (all unit configs), `test:byte -- <grep|file>` (targeted smoke),
  `test:sweep` (the full Tier-2 set). Keep `smoke` as-is for compatibility until the split lands.
- **Flakes:** `retries: 1` for smoke; a known-flaky annotation instead of re-running the world; a flake that
  recurs gets a fix byte, not a shrug.
- **Seeded randomness stays the rule** for generation (replay + evolution store depend on it). Where
  performance-time humanization wants non-determinism later (E7), the rail is "seeded at performance start
  and recorded," preserving replay without freezing the music.

## What this changes operationally

- **Kickoffs** from now on carry a "Validation (byte-scoped)" section naming the exact Tier-1 slice, and name
  the milestone at which the next sweep runs. The full-gauntlet acceptance text in prior kickoffs is void.
- **E4 amendment (in flight):** its validation is now Tier 0/1 — unit spread + plan suites, song-goal +
  song-library + prosody-area smoke, determinism checks, diff-check. The full sweep + hum-test listening
  session runs when E4 lands as the **E4 milestone review**.
- **Reviews:** Claude verifies the byte slice + the musical claim per byte, and runs the complete sweep at
  milestone reviews only.
