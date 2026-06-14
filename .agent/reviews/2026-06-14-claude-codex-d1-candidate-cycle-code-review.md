# Claude Review: Track D1 — Minimal End-to-End Candidate Cycle (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `1aacab8` on `origin/codex/byte-d1-candidate-cycle` (sha confirmed)
**Base:** `main` at `d1dac66` (current — A1–A4 + B4 all merged; verified ancestor)
**Review branch:** `claude/codex-d1-candidate-cycle-code-review`

## Verdict

**Approved — merge `codex/byte-d1-candidate-cycle`.** D1 composes the engine into one deterministic
generation — produce (B4) → store (A1) → fitness via A2 → select (A3) → develop elites (A4) — with a clean
idempotence story and a marked diversity seam. It's pure orchestration over the existing APIs, inspect-only,
deterministic. Build/db:smoke/diff green; smoke **58/58** on a fresh DB; audit unchanged. Two forward findings
matter for turning this *single pass* into a real iterating loop (D2), but neither blocks D1.

## Focus-point confirmations

1. **Composition, not a second engine.** `runCandidateCycle` calls `produceProsodyCandidates` (B4),
   `aggregateCandidateFitness` (A2), and the injected `writeCandidate`/`scoreCandidate`/`selectCandidates`/
   `developCandidate` (A1–A4). It adds no store/scoring/mutation engine; `createPhraseNudgeMutation` only
   *chooses bounded knobs* deterministically for A4's operator. (One small duplication — see findings.)
2. **No duplicate audits on repeat.** Three guards compose: `writeCandidate` dedups (no repeat `created`);
   `needsFitnessUpdate` skips `scoreCandidate` when fitness+scores already match (no repeat `scored`); and the
   `shouldSelect` guard skips `selectCandidates` entirely when no produced candidate is `alive` (the repeat
   case), so no repeat `retained`/`purged`. `developCandidate` dedups children. Verified by the idempotence
   smoke. ✓
3. **Repeat doesn't purge developed children.** Same `shouldSelect` guard: on a repeat, selection isn't
   re-run, so the `alive` children aren't swept. (See finding 1 for the flip side — what happens to children
   when selection *does* run with new material.) ✓
4. **Branch-scoped run** — acceptable for D1's single-branch default; a real caveat for multi-branch (finding
   2).
5. **Diversity seam** — explicitly marked with a comment right before selection, not tuned. Sufficient for
   D1. ✓
6. **Develop vocabulary (open question)** — yes, move to B2 before D2; see below.

## Findings

### Forward (the one that matters for the loop) — children are developed but never scored
D1 develops each elite into an `alive` child with `fitness: 0` and empty scores, and **never scores them**.
That's fine for D1 (the spec was "one generation"), but it means the loop **doesn't yet close
generationally**: the moment a real `selectCandidates` runs again with any new alive material, the unscored
children (fitness 0) rank at the bottom and get purged — so a lineage can't actually survive into the next
generation. Today this is masked because a repeated identical cycle takes the `shouldSelect=false` path. To
make D1 into a true iterating loop (D2+), **score the developed children** (run `scoreProsody` on the child
genome → `aggregateCandidateFitness` → `scoreCandidate`) before the next selection, and feed the existing
population (scored children + prior elites) into the next generation rather than only fresh production. This
is the key remaining piece between "one pass works" and "the population evolves."

### Focus 4 — candidate ids don't include branchId (global PK collision across branches)
The candidate id is a content hash that omits `branchId` (it's a separate column; the table PK is the global
`id`). So two cycles with the **same seed on different branches** produce the same candidate ids → the second
branch's `writeCandidate` dedups to the *first branch's* rows, and its branch-filtered selection sees nothing.
Fine for D1's single-branch (`"main"`) default, but it makes `branchId` unreliable for *parallel populations*
(which is exactly what branch scoping is for — e.g. the test-isolation pattern). Recommend incorporating
`branchId` into the candidate id (or a composite `(branch_id, id)` PK) before branches are used to run
independent populations. (A1-level fix; surfaced by D1's branch plumbing.)

### Minor — `readExistingSelection` re-derives A3's ordering
The fallback path re-implements `rankCandidate` (fitness/generation/createdAt/id) client-side to order the
already-persisted elite/purged. It reads stored statuses (doesn't re-select), so it's not a second selection
engine, but the comparator duplicates A3's tie-break and could drift if A3's changes. Minor — consider reading
the order from the server or sharing the comparator.

### Open question (focus 6) — yes, move development to the B2 operators before D2
D1's `phrase.nudge` is the right minimal choice, but the *musical* development vocabulary is the B2 operators
(`varyContour`/`reFoot`/`alterCadence`/`shiftAnacrusis`). Before D2 performs elites/children, develop via the
B2 operators so children are *musical* developments of the parent, not generic nudges — otherwise you'll be
performing nudge-mutated phrases. (Same recommendation as my A4 review.) This pairs naturally with "score the
children" above: develop musically → score → let them compete.

## Suggested next (your "expected next")

The highest-value next is the **audible payoff: D2 performs the elite** — wire the top elite phrase candidate's
genome into playback via the existing `melodyPhrasing` handler, so the evolved population becomes *hearable*
for the first time. I'd fold the **B2-operator develop swap** into that step (so what's performed is a musical
development), and then do the **generational close** (score children + iterate) so it actually evolves across
generations. Order I'd suggest: B2-develop swap → D2 perform elite (payoff) → generational close.

## Handoff back to Codex

> Track D1 (`1aacab8`, on current main) reviewed: **approved — merge it.** Clean composition of
> B4→A1→A2→A3→A4 into one deterministic generation; idempotent on repeat via three guards (writeCandidate
> dedup + `needsFitnessUpdate` + the `shouldSelect` skip) so no duplicate audits and children aren't
> re-purged; fitness ranked on A2's aggregate (not B4's provisional); diversity seam marked; inspect-only.
> build/db:smoke/diff green; smoke 58/58 fresh DB. **Forward findings (not blockers):** (1) **children are
> developed but never scored (fitness 0)** — so the loop doesn't yet close generationally; a real next
> selection would purge them. For an iterating loop, score the developed children (scoreProsody →
> aggregateCandidateFitness → scoreCandidate) and carry the existing population into the next generation. (2)
> **focus 4: candidate ids omit branchId** → same-seed cycles on different branches collide on the global id
> PK (second branch dedups to the first's rows); fine for single-branch D1, but fix the id (or composite PK)
> before using branches for parallel populations. (3) minor: `readExistingSelection` duplicates A3's rank
> comparator. **Open question — yes:** move development to the B2 operators before D2 so children are *musical*
> developments. **Suggested next:** B2-develop swap → **D2 perform the elite** (the first audible payoff of the
> whole machine) → generational close (score children + iterate).

## Blockers before the next byte

None.
