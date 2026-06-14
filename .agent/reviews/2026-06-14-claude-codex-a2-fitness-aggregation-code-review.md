# Claude Review: Track A2 — Candidate Fitness Aggregation (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `bcad309` on `origin/codex/byte-a2-fitness-aggregation`
**Base:** `main` at `0834263`
**Review branch:** `claude/codex-a2-fitness-aggregation-code-review`

## Verdict

**Approved — merge `codex/byte-a2-fitness-aggregation`.** A2 is a clean, pure, inspect-only fitness ruler:
`aggregateCandidateFitness` / `previewCandidateFitness` are side-effect-free, normalized-weight, bounded,
and honestly framed as "a tunable ruler, not permanent musical truth." Weights normalize internally, missing
scores default to 0, unknown keys are reported (not used), and preview doesn't mutate its source. The bundled
A1 smoke isolation fix (per-run `branchId`) is the right fix and matches the pollution I hit independently.
Build/db:smoke/diff green; smoke **41/41** (verified on a fresh DB); audit unchanged. One architect note for
A3 about what fitness *means* across kinds — not a blocker.

## Focus-point confirmations

1. **Pure + inspect-only.** `candidate-fitness.ts` imports only types; both functions are pure (no DB, no
   store mutation, no selection/cap/purge, no audio/model). `grep` confirms the only consumers are the
   `window.persistence.{aggregateCandidateFitness,previewCandidateFitness}` debug helpers + the type decl —
   nothing in transport/selection/playback reads them. ✓
2. **Default weights are a sensible, honest ruler.** They sum to 1.0 and map to the existing scorers
   (landing/monotony/surprise = melody; harmony/energy/proportion/cadence = form; motif; goal), with landing
   highest (0.16) — reasonable. The comment explicitly disclaims permanence, and weights are *normalized*
   internally (`weight/totalWeight`), so retuning is robust and the absolute values don't matter — only
   ratios. ✓
3. **Missing → 0 is the right conservative default, and safe for A3 — with one caveat (see finding).** ✓
4. **Ignored keys reported, not used.** `ignoredScoreKeys` surfaces unweighted score keys (sorted) for
   transparency without affecting fitness — correct shape for mixed scorer output. ✓
5. **`previewCandidateFitness` is copy-only + deterministic.** It returns `{...candidate, scores:{...},
   fitness}` and never mutates the source; pure function of its inputs. Safe for A3/A4 to call. (Minor: the
   copy is shallow — `genome` is shared by reference; see finding 2.) ✓
6. **A1 smoke isolation fix is appropriate and masks nothing.** Switching the candidate-store test from a
   hardcoded `branchId:"main"` to a per-run `${sessionId}-branch` isolates each run's rows by branch, so
   leftover local candidates can't contaminate the cap assertion. The cap/query *logic* is untouched — this
   is pure test isolation, exactly the pre-existing quirk I flagged in the A1 review. ✓

## Findings (non-blocking)

### Forward note for A3 — fitness is only meaningful *within a kind*
With missing→0 and a single weight set spanning all scorers (prosody + form + goal), a **phrase** candidate —
which only carries prosody scores (landing/monotony/surprise/...) and legitimately *lacks* form scores
(harmony/energy/proportion/cadence/goal ≈ 0.48 of the normalized weight) — has roughly half its weight forced
to 0. This is **safe for A3's top-N-per-kind selection**: within a kind, every candidate misses the same
scores, so it's a constant offset that cancels and the *relative ranking* (the only thing selection needs) is
fully preserved by the present scores + A1's deterministic tie-break. The caveat is that **absolute and
cross-kind fitness values are not comparable** (a phrase's 0.45 is not worse than a song's 0.7) — so A3 must
select per kind (which is the plan) and nothing should display fitness as an absolute quality score or compare
it across kinds. Cleaner long-term: kind-appropriate weight subsets (phrase → prosody keys; song/form → form
keys) so absolute fitness is meaningful too. Not needed for A3 to be correct.

### Minor — preview's copy is shallow (genome shared by reference)
`previewCandidateFitness` spreads the candidate and copies `scores`, but `genome` is shared by reference with
the source. Fine for a read-only fitness preview (it never touches genome). But A4 (development) must
deep-clone the genome when deriving a child candidate rather than relying on preview's copy — otherwise a
child's genome mutation would corrupt the parent. Flag for A4.

## Handoff back to Codex

> Track A2 (`bcad309`) reviewed: **approved — merge it.** Pure, inspect-only fitness ruler — normalized
> weights, bounded scores, missing→0, ignored keys reported-not-used, preview copy-only + deterministic;
> default weights sum to 1.0, map to the real scorers, and are honestly disclaimed as tunable. `grep` confirms
> no consumer outside the `window.persistence` debug helpers. The A1 smoke fix (per-run `branchId`) is the
> right isolation and masks no cap/query bug — matches the pollution I'd flagged. build/db:smoke/diff green;
> smoke 41/41 on a fresh DB; audit unchanged. **Two non-blocking notes:** (1) **fitness is only meaningful
> within a kind** — missing→0 over a union weight set forces ~half a phrase's weight to 0; this is *safe for
> A3* because the offset is constant within a kind so top-N ranking is preserved by A1's tie-break, but
> absolute/cross-kind fitness isn't comparable, so keep A3 strictly per-kind and don't surface fitness as an
> absolute score (consider kind-appropriate weight subsets later); (2) preview's copy is shallow — A4 must
> deep-clone the genome when deriving children. **Cleared for A3** (deterministic top-N-per-kind elite /
> overflow-purged via the A1 mutation+audit APIs, preserving A1's tie-break order).

## Blockers before the next byte

None.
