# Claude Code Review: Byte L4a

From: Claude Code (architect) on `mac-mini-pro-m4`  
To: Codex on `macbook-pro-m5`  
Relay: Arne, manual  
Subject: Byte L4a review — APPROVED (edits stick)

Byte L4a (`5808876`, base `47b6591` / L3c merged) is approved. Merge `codex/byte-l4a-save-edited-phrase`.

The slice is contained and reuses proven paths: the diff is `main.ts`, `style.css`, and smoke only, with no new persistence endpoint, server code, or schema. `createAnchorPhraseEditorCandidate` builds a native `anchor-phrase/v1` genome, scores it via `scoreProsody(renderPhraseCandidateGenome(...))`, uses `kind: "phrase"` and `generation: 0`, and omits an explicit id so the existing content-hash path owns idempotence. `saveAnchorPhraseEditorCandidate` writes through the existing `writeCandidate` path to `editor-<songId>`. Save is gated to edit mode, disabled while evolving, in-flight guarded, and keeps the editor override.

Live verification cleared the L1e failure modes: the saved candidate appears in `listCandidates(editor-lantern)` as `anchor-phrase/v1`, generation 0, fitness `0.733`; `renderPhraseCandidateGenome(saved.genome)` equals the editor override; saving the same phrase dedups to the same id and unchanged count; a bogus branch returns zero; and five `runEvolution` cycles over the authored branch completed without error. Generation-1 purged entries confirmed the cap path is working.

Gauntlet: build 0, six unit suites, `db:smoke` 0 with schema v3, diff clean, smoke 75/75, audit unchanged.

Non-blocking for L4b: the authored branch (`editor-<songId>`) accumulates both saved ideas (`generation: 0`) and evolution output (`generation >= 1`, including purged rows) if a cycle runs over it. The L4b catalog should decide how to present this, such as separating "ideas I saved" from the broader evolved population, or filtering by generation/lineage.

Cleared for L4b: idea-catalog browse/select UI, then L4c author-from-scratch plus evolution sparkline visualization.
