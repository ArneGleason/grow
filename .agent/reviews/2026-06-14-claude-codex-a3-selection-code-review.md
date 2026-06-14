# Claude Review: Track A3 — Deterministic Candidate Selection (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `3f65962` on `origin/codex/byte-a3-selection`
**Base:** `main` at `4422e45`
**Review branch:** `claude/codex-a3-selection-code-review`

## Verdict

**Approved — merge `codex/byte-a3-selection`.** A3 closes the loop: `selectCandidates` is strictly per-kind +
branch-local, orders by A1's exact tie-break, promotes the top-N to `elite`, purges all overflow (including
demoted stale elites), reuses the existing `retained`/`purged` audit family with `reason:"selection"` + rank,
and — the subtle bit — only audits *actual* status mutations. Inspect-only, deterministic, transactional.
Build/db:smoke/diff green; smoke **42/42** on a fresh DB; audit unchanged. With A1+A2+A3, the evolution engine
is complete.

## Focus-point confirmations

1. **Per-kind + branch-local, no cross-kind comparison.** `listCandidates({ branchId, kind, … })` scopes to
   one kind + one branch; elite/overflow derive from that single list. ✓
2. **A1 tie-break preserved.** `order: "fitness"` → `fitness DESC, generation ASC, created_at ASC, id ASC`. ✓
3. **Top-N promotion + overflow purge + stale-elite demotion.** `eliteTargets = slice(0, eliteLimit)`,
   `overflow = slice(eliteLimit)`; overflow → `purged`, which correctly includes a previously-`elite`
   candidate that has fallen below the line (it's a non-purged row, so it's in the list and lands in
   overflow). ✓
4. **Audit right-sized.** Existing `candidate.retained` (promotions) + `candidate.purged` (overflow), payload
   `reason:"selection"`, `eliteLimit`, deterministic `rank`. No new event family. ✓
5. **Only audits actual mutations.** `retained` is `eliteTargets.filter(status !== "elite")` — already-elite
   candidates that stay elite get **no** redundant `retained` event, yet still appear in the returned `elite`
   list (re-read by id). `overflow` is drawn from non-purged rows (`includePurged:false`), so every `purged`
   event is a real alive/elite→purged change. Audits match status mutations 1:1. ✓
6. **No consumer.** `grep` shows `selectCandidates` referenced only by the `window.persistence` wiring + type
   decl + the `persistence.ts` client method — nothing in transport/playback/generator. ✓
7. **A4 guardrail affirmed** (see forward notes). ✓

## Findings (non-blocking; forward-looking)

### For Track D — selection is *strict elitism*; mind diversity
After a selection pass, the population per kind is exactly `{top-N elite} ∪ {purged}` — there is no surviving
non-elite "alive" tier (everything outside top-N, including demoted elites, is purged). This is precisely the
specified "keep the best, purge the rest," and it's correct for A3. But when Track D runs this in a loop, pure
elitism risks **premature convergence / diversity loss** (the population collapses onto the current best
lineage). Worth a diversity lever in D — e.g. keep a small random/novel "alive" reservoir, or select on a
fitness+novelty blend — rather than purging everything outside top-N every generation. Not an A3 bug; a
loop-design note.

### Carry-forward — `MAX_CANDIDATE_LIMIT` (500) bounds selection's view
`selectCandidates` reads up to `MAX_CANDIDATE_LIMIT` non-purged candidates before ranking; if alive+elite per
(branch, kind) ever exceeds 500, the overflow beyond 500 isn't seen and escapes purge. Same bound as `cap`.
Keep populations under 500 or paginate in D. (The strict-elitism behavior actually keeps live counts small, so
this is unlikely to bite soon.)

### A4 guardrail (your focus 7) — confirmed and important
A4 must **deep-clone the genome** before any mutation and emit a **new candidate** (`parentId` = the elite's
id, `generation + 1`, deterministic seed) — never mutate an elite in place. This also closes the loop with my
A2 note: `previewCandidateFitness`'s copy is shallow (genome shared by reference), so A4 cannot rely on it for
a safe-to-mutate copy. Deep-clone explicitly.

## Handoff back to Codex

> Track A3 (`3f65962`) reviewed: **approved — merge it.** `selectCandidates` closes the loop: strictly
> per-kind + branch-local, A1 tie-break preserved (`fitness DESC, generation ASC, created_at ASC, id ASC`),
> top-N → `elite`, all overflow (incl. demoted stale elites) → `purged`, reusing `retained`/`purged` with
> `reason:"selection"` + rank. **Focus 5 confirmed:** `retained` is filtered to `status !== "elite"`, so
> already-elite stayers get no redundant event but still appear in the returned `elite` list; `overflow` is
> non-purged rows so every purge is a real mutation — audits match mutations 1:1. Inspect-only (no
> transport/playback/generator consumer); transactional; deterministic. build/db:smoke/diff green; smoke 42/42
> on a fresh DB; audit unchanged. **Non-blocking, for the loop (D):** selection is *strict elitism* — after a
> pass the population is {top-N elite} ∪ {purged} with no surviving "alive" tier; correct as specified, but
> add a diversity lever in D (novelty reservoir or fitness+novelty) to avoid premature convergence; and
> `MAX_CANDIDATE_LIMIT=500` bounds the ranked view (keep populations under it or paginate). **A4 guardrail
> confirmed:** deep-clone the genome, emit a new candidate (`parentId`, `generation+1`, deterministic seed) —
> never mutate an elite in place (and don't rely on `previewCandidateFitness`'s shallow copy). **With A1+A2+A3
> the engine is complete** — cleared for A4 (development hook), then the loop can run end-to-end.

## Blockers before the next byte

None.
