# Claude Re-review: Byte L1e fix — AnchorPhrase genome no-op crash (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `0be9235` on `origin/codex/byte-l1e-anchor-genome-store` (fix on top of `c975270`; sha confirmed)
**Base:** `origin/main` `beeda5d`
**Supersedes:** the request-changes review (`2026-06-17-claude-codex-l1e-anchor-genome-store-code-review.md`).

## Verdict

**Approved — merge `codex/byte-l1e-anchor-genome-store`.** The reproducible no-op-development crash is fixed
exactly as recommended, and verified against the original repro. The rest of L1e (single render chokepoint,
no direct genome casts, both formats validated client+server, legacy round-trip, schema v3) was already sound.

## Fix confirmed (both changes landed, code-reviewed)

1. **Native-genome change-detection** (`candidate-cycle.ts` `createProsodyDevelopmentMutation`): the baseline is
   now the normalized **native** genome (`normalizePhraseCandidateGenome(elite.genome)` for native, flat
   otherwise), and each B2 choice is converted to native (`createAnchorPhraseCandidateGenomeFromPattern`)
   **before** the `stableJson` comparison — so a flat-level change that collapses to a native no-op is skipped
   client-side and never POSTed. Fallback uses the same native comparison. ✓
2. **`postPersistenceJson` surfaces the server body** (`persistence.ts`): non-OK responses now throw
   `HTTP <status>: <body.error>` (parsing the JSON `{error}`), so `isNoOpDevelopmentError`'s
   `/did not change the genome/` match fires and the cycle's existing `continue` tolerance works — and all
   persistence errors stop being opaque. ✓
3. New `normalizePhraseCandidateGenome` helper for the native baseline; smoke fixture's no-op message updated to
   the real `HTTP 400: …` shape so the tolerance is exercised against the true error string. ✓

## Verification

- **Original repro, now passing:** 16 `runEvolution` pairs (32 runs) in one preview store — **all succeeded**
  (previously the 8th pair 400'd). Evolution still produces/scores/selects/develops (3 elites per run,
  deterministic top fitness 0.7978). The no-op path is now skipped, not fatal.
- **Full gauntlet:** build 0 · unit grow-language/anchor-phrase/render/melody-prosody/phrase-candidate-genome
  5/5/8/5/5/3 · db:smoke 0 (schema v3) · diff clean · **`npm run smoke` 70/70 twice** · audit = the same known
  esbuild/vite advisories (count unchanged; upstream DB re-rated one high→low — not a dependency change here).

## Carry-forward (unchanged)

The anchor-phrase validator/normalizer is still duplicated (`anchor-phrase.ts` ↔ `server/persistence.mjs`).
Acceptable for dev-only persistence; extract a shared module before untrusted clients / trusted provenance.

## Blockers before the next byte

None. **Phase 1 is complete** — language, representation, full renderer, prosody emitting the representation,
and candidates persisting the native genome end to end. Cleared for **L2 — the read-only graphical editor**
(render `window.anchorPhrase.fromProsody` in the visual grammar): the first time a real phrase is *seen*.
