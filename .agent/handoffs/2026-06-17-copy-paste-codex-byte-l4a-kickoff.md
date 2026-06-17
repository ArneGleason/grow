# Kickoff: Byte L4a — save an edited phrase as a persisted candidate (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L3c merges*. State your base sha back.
**Design refs:** roadmap + design note. Builds on the L3 editor (`window.phraseEditor`, `workingAnchorPhrase`)
and L1e (`phrase-candidate-genome.ts`). **Phase 4 (L4) keystone — sliced.** L4 = persistence + authoring +
catalog; this is **L4a (save/persist only)**. L4b = the idea-catalog browse/select UI; L4c = author-new +
evolution sparkline viz. **Please wait for this kickoff before building** — L4 re-touches persistence + the
evolution loop (where L1e bit us), so the guardrails matter.

## Goal
Add a **Save** action to the melody editor: turn the current working `AnchorPhrase` into a **native
`anchor-phrase/v1` candidate**, score it, and **persist it** to the candidate store so the edit *sticks*
(survives reload) and becomes a first-class candidate in the player's population. Persistence only — **no
catalog browse UI, no author-from-scratch, no evolution viz** (those are L4b/L4c).

## What "Save" does (reuse existing pieces — don't invent new persistence)
1. Build a `CandidateInput` from `workingAnchorPhrase`:
   - `genome = createAnchorPhraseCandidateGenome(workingAnchorPhrase, renderOptions)` (L1e — bounded/validated).
   - `const rendered = renderPhraseCandidateGenome(genome); const score = scoreProsody(rendered, [4, 4]);`
     → `scores = score.subscores`, `fitness = score.overall` (exactly as `produceProsodyCandidates`).
   - `kind: "phrase"`, `generation: 0`, `status: "alive"`, and a **content-hash-derived id** (idempotent:
     saving the identical phrase twice → same id → dedup; a changed edit → a new candidate). Reuse the existing
     hashing/id convention if there is one.
2. Persist via the existing client path: `persistence.writeCandidate(candidate, branchId)` (already wired to
   `window.persistence.writeCandidate`). **No new endpoint / no schema change.**
3. **Branch:** save to a **stable per-song authored branch** (e.g. `editor-<songId>`) so saved ideas group per
   song and L4b can list them; document the convention. The server remains branch-scoped-id authoritative
   (reuse existing — don't bypass).
4. Minimal feedback only: a "saved" indicator + a count of saved ideas for the song (from `listCandidates`).
   **No browse/select navigation** — that's L4b.

## Safety / invariants (L1e lessons — read these)
- **Bounded + round-trips.** The saved genome is `anchor-phrase/v1`, validated/clamped by L1e on the client
  **and** re-normalized by the server (`normalizePhraseGenome` → `normalizeAnchorPhraseCandidateGenome`). It
  must round-trip: a written candidate, re-read, renders **identically** to the working phrase. (This is the
  path L1e proved; saving a native genome should not 400.)
- **Must not crash the evolution loop.** A saved candidate is a normal candidate — a later `runEvolution` /
  develop on its branch must select/develop it without error (L1e's no-op-development fix is merged; saving
  isn't developing, but confirm a cycle over the authored branch stays clean).
- **In-scale by construction** (the genome's anchors are integer degrees; rendered via `renderAnchorPhrase`).
- **Save is an edit-mode action** → naturally gated out of the evolving regime (editing is disabled there).
  Saving keeps the working phrase + `editorMelodyOverride` as-is (you can keep editing and save again).
- **No change to** the scorer, representation, server normalizer, or schema (v3). Melody-only.
- Note: L4a persists the idea into the *population*; making a saved idea the **song's default performance** is a
  later concern (L4b/L4c) — out of scope here.

## Tests
- **Smoke:** in edit mode, make an edit and **Save**; assert a candidate now exists via
  `listCandidates({ kind: "phrase", branchId: editor-<songId> })` with the native `anchor-phrase/v1` genome,
  `fitness > 0`, `generation 0`; saving the **same** phrase again does not duplicate (same content-hash id);
  the candidate's genome **renders back identical** to the working phrase; a `runEvolution` over that branch
  completes without error and can include the saved candidate. Note the final smoke count.
- (db:smoke already exercises native-genome persistence end to end; keep it green.)

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify**: edit → Save → the candidate appears in
`listCandidates` (correct branch/kind, native genome, scored), persists across a re-list, renders back
identically (round-trip), saving the same phrase dedups, and a `runEvolution` on the authored branch stays
clean (no 400 / no crash) — the L1e failure mode.

## Out of scope (explicitly)
- Idea-catalog browse/select navigation → **L4b**. Author-a-new-idea-from-scratch + evolution sparkline viz →
  **L4c**. Making a saved idea the song's default melody. Bass & beats. Any scorer/representation/server/schema
  change.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: Save builds an `anchor-phrase/v1` candidate (scored,
content-hash id, generation 0) and persists via the existing `writeCandidate` to a stable per-song branch;
round-trips (re-read renders identically); idempotent on identical phrase; a cycle over the authored branch
stays clean; no schema/scorer/server change; smoke count; and the branch convention you chose.
