# Kickoff: Track B4 — prosody phrase candidates into the population

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Gemini 3.1 Pro (High) in Antigravity
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14
**Status:** Kickoff — base on `main` once the prosody stack is merged (see prerequisite)

---

**You are:** Gemini 3.1 Pro (High) in Antigravity, working on **Grow** (browser-first local-AI music;
PixiJS + Tone.js + Vite + TypeScript). Studio Pattern: small bounded changes on branches, reviewed by
Claude before merge. Pure, deterministic TypeScript.

**Where this fits:** Your hardened prosody scorer (`scoreProsody`) is approved and fitness-ready, and the
candidate store (`src/candidate-store.ts`, Track A1) is landed. This byte connects them: turn the prosody
generator + your development operators into a **producer of scored phrase candidates** — the first step of
"players write many candidate songs/elements into SQLite, keep the best, purge the rest." You produce the
candidates; Codex's Track A2/A3 will aggregate fitness and select/purge.

**Prerequisite (Arne):** merge `claude/prosody-stack-clean` → `main` first (it carries the prosody leap +
B1/B2 + your hardening, rebased clean). Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b gemini/byte-b4-prosody-candidates
```

## Task: `src/prosody-candidates.ts` (pure, deterministic, inspect-only)

Build a pure function that produces a small **population of scored phrase candidates**:

```ts
produceProsodyCandidates(input: { seed: number; count?: number }): Candidate[]
```

1. **Generate a base phrase** with `generateProsodicMelody({ seed, ... })` (`src/melody-prosody.ts`).
2. **Spawn variants** by applying the B2 development operators (`varyContour`, `reFoot`, `shiftAnacrusis`,
   `alterCadence` from `src/prosody-development.ts`) to the base — a deterministic spread of `count`
   distinct phrases (vary the operator/arg by a seeded sequence).
3. **Score each** with `scoreProsody(phrase, [4,4])` (`src/prosody-scoring.ts`).
4. **Emit `Candidate` objects** (the contract in `src/candidate-store.ts`), one per phrase:
   - `kind: "phrase"`, `genome:` the phrase `PlayerPatternSource`
   - `scores:` the `ProsodySubscores` (richness/anacrusis/questionAnswer/anchorContrast)
   - `fitness:` `scoreProsody(...).overall` **as a provisional value** — Track A2 owns final fitness
     aggregation; your job is to populate `scores` faithfully and set a reasonable provisional `fitness`.
   - `seed:` the per-candidate seed; `generation:` 0 for the base, `1` for first-order variants
   - `parentId:` the base candidate's id for developed variants (lineage), omitted for the base
   - run each emitted candidate through `validateCandidate` (from `candidate-store.ts`) and return only
     valid ones (they will be, if genomes stay bounded).

## Boundaries (do not cross)
- **Pure + deterministic.** Same seed → same candidate set (ids, genomes, scores). No I/O, no audio, no
  store writes, no playback. This byte just *produces* candidates in memory.
- **Reuse only** the existing generator, operators, scorer, and `Candidate` contract — do not author new
  note/rhythm logic, do not modify the scorer or operators.
- **In-scale safety is already guaranteed** by those modules; don't touch it.
- **Do not write to the candidate store or wire selection** — that is a later, separate byte (so we keep
  this reviewable and avoid colliding with Codex's A2/A3).

## Acceptance tests (add `tests/prosody-candidates.spec.ts`, all must pass)
1. `produceProsodyCandidates({ seed, count: N })` returns exactly N candidates, all `kind: "phrase"`,
   each `validateCandidate(...).valid === true`.
2. Determinism: two calls with the same seed return identical candidate ids + genomes + scores.
3. The candidates are **distinct** (more than one unique genome / id) — the operators actually spread them.
4. Developed variants carry `parentId` (the base) and `generation >= 1`; the base has no `parentId`.
5. Each candidate's `scores` contains the four prosody subscores and `fitness` equals
   `scoreProsody(genome,[4,4]).overall` for that genome.

## Finish (don't skip — verify the push lands)
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
git add -A && git commit -m "Track B4: produce scored prosody phrase candidates"
git push -u origin gemini/byte-b4-prosody-candidates
git rev-parse origin/gemini/byte-b4-prosody-candidates   # confirm a NEW sha is on origin
```
Then write a short handoff for Claude (From/To/Relay, **branch + commit sha**, what changed, what to
review, validation results) and give it to Arne to relay.
```
```

(Note from Claude on the persistence test: `npm run smoke`'s candidate-store test depends on a fresh DB —
if you run smoke repeatedly, `rm -rf data` between runs, or it will fail on accumulated rows. This is a
pre-existing test-hygiene quirk, not your change.)
