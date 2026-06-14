# Claude Review: Track B4 — Prosody Phrase Candidates (Gemini 3.1 Pro)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Gemini (Antigravity), via Arne
**Date:** 2026-06-14
**Reviewed commit:** `53858f1` on `origin/gemini/byte-b4-prosody-candidates`
**Base:** `claude/prosody-stack-clean` (contains the prosody leap + B1/B2 + hardening, on `main@0834263`)
**Review branch:** `claude/gemini-b4-prosody-candidates-code-review`

## Verdict

**Approved — merge.** `produceProsodyCandidates` is a clean, pure, deterministic producer that meets all five
acceptance criteria from the kickoff: it generates a base phrase, spawns operator-driven variants, dedupes by
genome, validates every candidate, and emits bounded `phrase` candidates with `scores` = prosody subscores and
a provisional `fitness` = `scoreProsody().overall` (A2 owns final aggregation). It's inspect-only — no store
writes, no playback, no consumer. Build green; the 5 B4 acceptance tests pass; full suite **54/54** on a fresh
DB; db:smoke/diff green; audit unchanged.

## Acceptance tests (from the kickoff) — all pass

1. Returns N candidates, all `kind:"phrase"`, each `validateCandidate(...).valid` (validation-gated push). ✓
2. Deterministic — `mulberry32(seed)` drives operator/arg choices + `generateProsodicMelody(seed)` is
   deterministic, so the same seed yields the same set (ids/genomes/scores). ✓
3. Distinct — a `seenGenomes` JSON set rejects duplicate variants. ✓
4. Variants carry `parentId` (the base) + `generation: 1`; the base has no `parentId` + `generation: 0`. ✓
5. `scores` = the four prosody subscores; `fitness` = `scoreProsody(genome,[4,4]).overall`. ✓

## Boundary checks

- **Pure / inspect-only:** the commit touches only `src/prosody-candidates.ts`, its spec, and the handoff
  doc. `git grep` finds no consumer of `produceProsodyCandidates` outside its module/test — it produces
  candidates in memory and does not write the store or wire selection/playback. ✓
- **In-scale + bounded:** genomes are the generator/operator `PlayerPatternSource` outputs, each run through
  `validateCandidate` (so the pushed `candidate.genome` is a normalized, bounded phrase). ✓
- **Reuses only** the existing generator, B2 operators, scorer, and `Candidate` contract; no new note logic. ✓

## Findings (all non-blocking)

1. **`genome: basePhrase as any`** launders the type. Safe at runtime (`validateCandidate` →
   `readPhraseGenome` normalizes/bounds it), but `as unknown as CandidateGenome` (or letting the validator
   own the typing) would avoid the `any`. Cosmetic.
2. **Dedup is on raw genomes, push stores validated genomes.** `seenGenomes` keys on the pre-validation
   `JSON.stringify(variantPhrase)`, while the pushed candidate carries the *normalized* genome. If two
   raw-distinct genomes ever normalized to the same shape, you'd get near-duplicate candidates with different
   ids. Very unlikely with these operators; worth knowing. Dedup on the *validated* genome would be airtight.
3. **Soft count guarantee.** If the operators can't yield `count-1` distinct variants within
   `maxAttempts = (count-1)*10`, the producer returns fewer than `count`. Fine, but A3 should treat `count`
   as an upper bound, not an exact promise.
4. **First-order lineage only** — all variants develop the base (`generation 1`, `parentId=base`). Correct
   for B4; deeper lineage (developing a variant) is A4 territory.

## Merge logistics (for Arne)

- **B4's branch is a superset of the clean prosody stack** (it contains the 3 prosody commits + B4), so
  merging `gemini/byte-b4-prosody-candidates` lands the **entire prosody track + B4** in one unit — no need
  to merge `claude/prosody-stack-clean` separately.
- Both B4 and **A2** (`codex/byte-a2-fitness-aggregation`, also approved) are based on `main@0834263` and both
  touch `main.ts` (B4's stack adds `window.prosody`; A2 adds `window.persistence` fitness helpers). When you
  merge the second of the two, expect a `main.ts` touch-point — likely auto-mergeable (different regions, as
  the leap auto-merged with A1), but rebase the later one onto current `main` if git balks.

## Handoff back to Gemini

> Track B4 (`53858f1`) reviewed: **approved — merge it.** `produceProsodyCandidates` is pure, deterministic,
> and meets all five acceptance criteria — base (gen 0, no parent) + operator-driven variants (gen 1,
> `parentId`), genome-deduped, `validateCandidate`-gated, `scores`=prosody subscores, provisional
> `fitness`=`scoreProsody().overall`. Inspect-only (only 3 files; no store/playback consumer). build green; 5
> B4 tests pass; full suite 54/54 on a fresh DB; db:smoke/diff green. **Non-blocking nits:** `genome ... as
> any` (prefer `as unknown as CandidateGenome`); dedup keys on raw genomes while pushing validated ones
> (dedup on the validated genome would be airtight); `count` is a soft upper bound, not exact. **One process
> nit:** please include the **commit sha** in the handoff (I had to resolve it) and confirm `origin/<branch>`
> resolves to it — that's the check that caught the earlier empty-push. Strong, precise work. **Next:** the
> producer's candidates are ready for Codex's A3 to select/purge per kind once A2/A3 land.

## Blockers before merge

None.
