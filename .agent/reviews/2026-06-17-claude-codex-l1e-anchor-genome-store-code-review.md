# Claude Review: Byte L1e — candidate-store AnchorPhrase genomes (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `c975270` on `origin/codex/byte-l1e-anchor-genome-store` (sha confirmed)
**Base:** `origin/main` `beeda5d` (verified ancestor)
**Review branch:** `claude/codex-l1e-anchor-genome-store-code-review`

## Verdict

**Request changes — do not merge yet.** The design is sound and most of it is right, but **smoke fails
reproducibly**: under an accumulated store, the evolution loop dies with **HTTP 400** from
`POST /api/persistence/candidates/develop`, body `{"error":"Candidate development mutation did not change the
genome"}`. Root-caused below; it's a real regression L1e introduces, not flake. Everything else is green and
the genome layering is good — this should be a small, targeted fix.

## What's right (confirmed)

- **Single render chokepoint.** `renderPhraseCandidateGenome()` is the one path to a flat pattern; **no
  consumer still casts `genome as PlayerPatternSource`** — scoring (`scoreStoredPhraseCandidate`), development
  (`createProsodyDevelopmentMutation`), diversity (`calculateCandidateDiversityMetrics`), and D2 audition
  (`applyCandidateMelodyAudition`) all route through it (grep-verified). ✓
- **Both formats validated.** `candidate-store.readPhraseGenome` and `server normalizePhraseGenome` branch on
  `format === "anchor-phrase/v1"` → anchor path, else legacy flat path. Native genomes are bounded (caps /
  clamps / closed kernel set / structural checks) on **both** client and server. ✓
- **Legacy compatibility.** `anchorPhraseFromPlayerPatternSource` (silent connectors, degree/octave wrap)
  round-trips a flat pattern to anchors that re-render to the same notes. Schema stays v3. ✓
- Gauntlet apart from smoke: **build 0 · unit grow-language/anchor-phrase/render/melody-prosody 5/5/8/5 ·
  phrase-candidate-genome 3/3 · db:smoke 0 · diff clean · audit unchanged.**

## The blocker (reproduced + root-caused)

**Repro:** full `npm run smoke` failed **2 of 2 runs** on `tests/grow.smoke.spec.ts:4551` ("matched diversity
experiments can run same seed in one store") with `HTTP 400`; the test **passes in isolation**. I reproduced
it directly in a preview store: running `runEvolution` pairs repeatedly, **7 pairs succeeded, the 8th 400'd**.
Captured request/response: `POST /api/persistence/candidates/develop`, mutation
`phrase.replace`/`shiftAnacrusis`, response body **`"Candidate development mutation did not change the
genome"`**.

**Root cause — two interacting defects, both exposed by L1e:**

1. **Change-detection representation mismatch.** The client decides a development "changed" the genome by
   comparing the **rendered flat** patterns (`candidate-cycle.ts:690`,
   `stableJson(choice.genome) !== stableJson(renderPhraseCandidateGenome(elite.genome))`). The **server** runs
   its no-op guard on the **native anchor genome** (`persistence.mjs:562`). L1e's flat→anchor conversion
   (`createAnchorPhraseCandidateGenomeFromPattern`, silent connectors + degree/duration quantization) is
   **lossy**, so a flat-level change can collapse to a native genome equal to the parent. The client is sure it
   changed; the server sees no change → 400. (Pre-L1e both sides compared the same flat genome, so a
   client-confirmed change was never a server no-op.)
2. **The no-op tolerance can't fire.** `runCandidateCycle` *intends* to tolerate this:
   `catch (e) { if (isNoOpDevelopmentError(e)) continue; }` (`candidate-cycle.ts:226`), and
   `isNoOpDevelopmentError` matches `/did not change the genome/`. But `postPersistenceJson` throws a generic
   `Error("HTTP 400")` and **drops the server's body message**, so the regex never matches → the cycle
   re-throws → the whole `runEvolution` fails.

It's accumulation-dependent because more `develop` operations (and more elites whose B2 transform survives only
at the flat level) raise the odds of hitting a lossy no-op — so a single fresh smoke run can pass (likely why
Codex saw 70/70).

## Requested fix (either resolves the crash; both recommended)

- **Align change-detection to the native genome (root fix):** before POSTing, compare the converted native
  replacement (`createAnchorPhraseCandidateGenomeFromPattern(choice.genome)`, normalized) against the parent's
  native genome and **skip if equal** — so native no-ops are never sent.
- **Make `postPersistenceJson` surface the server body (robustness + better diagnostics):** throw
  `Error("HTTP 400: " + body.error)` (or similar) so `isNoOpDevelopmentError` matches and the existing
  `continue` tolerance works as designed. This also stops *every* persistence error from being an opaque
  "HTTP 400".

Add a regression test that runs several `runEvolution` cycles in one store (or asserts a no-op development is
skipped, not fatal). Re-run **full** smoke (ideally twice) to confirm.

## Carry-forward (unchanged, reaffirmed)

The anchor-phrase validator/normalizer is duplicated (TS `anchor-phrase.ts` ↔ `server/persistence.mjs`). Not
the cause here, but the same divergence class — extract a shared module before untrusted clients / trusted
provenance.

## Blockers before merge

The smoke regression above. Once developments no longer crash the cycle (and full smoke is green twice), this
is an approve — the rest of L1e is solid.
