# Claude Review: Byte L4a — save an edited phrase as a persisted candidate (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `5808876` on `origin/codex/byte-l4a-save-edited-phrase` (sha confirmed)
**Base:** `origin/main` `47b6591` (verified ancestor; L3c merged)
**Review branch:** `claude/codex-l4a-save-edited-phrase-code-review`

## Verdict

**Approved — merge `codex/byte-l4a-save-edited-phrase`.** Edits now *stick*: Save turns the working
`AnchorPhrase` into a scored native `anchor-phrase/v1` candidate and persists it via the existing
`writeCandidate` path — **no new persistence/server/schema** (diff is `main.ts` + `style.css` + smoke only).
The L1e failure modes are specifically cleared: the saved genome **round-trips** and a multi-cycle
`runEvolution` over the authored branch **stays clean**. Gauntlet: **build 0 · 6 unit suites green · db:smoke 0
(schema v3) · diff clean · smoke 75/75** · audit unchanged. **Live-verified.**

## Focus-point confirmations (code + live)

1. **Persistence-only, reuses proven paths.** `createAnchorPhraseEditorCandidate` builds
   `genome = createAnchorPhraseCandidateGenome(workingPhrase, …)` (L1e), scores via
   `scoreProsody(renderPhraseCandidateGenome(genome), [4,4])` (as `produceProsodyCandidates`), `kind:"phrase"`,
   `generation:0`, `status:"alive"`, **no explicit id**; `saveAnchorPhraseEditorCandidate` writes it through the
   existing `persistence.writeCandidate(candidate, branchId)`. No catalog/select/default-performance path
   added. ✓
2. **Idempotence is content-hash + branch-scope, not UI state.** No id is supplied, so the candidate layer's
   content-hash id applies; the server stays branch-scoped-id authoritative. Live: saving the **same** phrase
   twice returned the **same id** and left the branch count unchanged (true dedup). ✓
3. **Round-trips (L1e concern cleared).** Live: the saved candidate appears in
   `listCandidates({kind:"phrase", branchId:"editor-lantern"})` with `format:"anchor-phrase/v1"`, `generation 0`,
   `fitness 0.733`, and `renderPhraseCandidateGenome(saved.genome)` **equals the editor override** — the working
   phrase persists and renders back identically. ✓
4. **Does not revive the L1e no-op/evolution failure.** Live: **5 `runEvolution` cycles over `editor-lantern`
   completed with no error** (the exact failure mode that bit L1e). The branch's candidates carry the expected
   `b<hash>:` branch-scoped ids; gen-1 entries showing `status:"purged"` confirm the cap/purge is operating. ✓
5. **Branch + gating.** Stable per-song authored branch `editor-<songId>` (e.g. `editor-lantern`); branch
   filter is strict (a bogus branch returned 0). Save is an edit-mode action, disabled while evolving, guarded
   against concurrent saves; it keeps the working phrase + `editorMelodyOverride` as-is. ✓
6. **No scorer/representation/server/schema change; melody-only.** Confirmed by the diff (no server/persistence
   files touched) and db:smoke staying green on schema v3. ✓

## Findings (non-blocking)

- The authored branch accumulates **both** saved ideas (gen 0) **and** evolution output if a cycle runs over it
  (gen 1+, subject to purge). Not a bug — but **L4b's catalog should decide how it presents this** (e.g.
  "ideas I saved" vs the broader evolved population, or filter by generation/lineage). Flagging for the L4b
  spec.
- Making a saved idea the song's **default performance** remains out of scope (L4b/L4c), as intended.
- Carry-forward (from L2): editor values via `<title>`/labels rather than discrete `data-*` attrs.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. Edits now persist as scored candidates in the player's population, round-tripping safely, without
disturbing evolution. Cleared for **L4b** — the idea-catalog browse/select UI (navigate the saved/evolved
population, load an idea into the editor) — then **L4c** (author-from-scratch + evolution sparkline viz).
