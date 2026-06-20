# Claude Review: Byte L4c-1 — author a new idea from scratch (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Reviewed commit:** `4b0aac0` on `origin/codex/byte-l4c1-new-idea` (sha confirmed)
**Base:** `origin/main` `28414d4` (verified ancestor)
**Review branch:** `claude/codex-l4c1-new-idea-code-review`

## Verdict

**Approved — merge `codex/byte-l4c1-new-idea`.** "+ New idea" seeds a minimal valid template into the existing
edit/override/save machinery and persists it as a candidate — small, contained, and correct end to end.
Boundary held (a new pure `anchor-phrase-templates.ts` + wiring; no persistence/render/scorer/server/schema
change). Gauntlet: **build 0 · 6 unit suites · db:smoke 0 · diff clean · smoke 77/77 on my polluted DB**
(hermeticity holds) · audit unchanged. **Live-verified.**

## Focus-point confirmations (code + live)

1. **Minimal valid template.** `createMinimalAuthoringAnchorPhrase` builds 1 segment, anchors `1 → 5 → 1`
   (home → dominant → home), 2 `fill` connectors, run through `normalizeAnchorPhrase` (throws if invalid).
   Live: `getWorkingPhrase()` = `[1,5,1]`, 1 seg / 3 anchors / 2 connectors. In-scale by construction. ✓
2. **Seeds edit mode + audible.** `window.phraseEditor.newIdea()` sets the working phrase to the template,
   **enters edit mode**, and sets `editorMelodyOverride`. Live: `editMode: true`, override active and in-scale. ✓
3. **Save reuses L4a; persists a new candidate.** Edit + Save → a new `anchor-phrase/v1` candidate
   (`generation 0`, `fitness 0.368`) in `editor-lantern`; the catalog **grew by exactly one**. Uses the
   unchanged `createAnchorPhraseCandidateGenome → render → scoreProsody → writeCandidate` path. ✓
4. **Generated/catalog undisturbed.** Live: `fromProsody()` is byte-identical before/after authoring; the new
   idea is a fresh working phrase (transient "new · unsaved" entry) until Saved, not a mutation of an existing
   candidate. ✓
5. **Boundary held.** Diff is `main.ts` + new `anchor-phrase-templates.ts` + its unit test + smoke. No
   persistence/server/schema/renderer/scorer/transport/candidate-store change. ✓
6. **Gating + scope.** Edit-mode action → disabled while evolving (existing `canEdit`); reversible; melody-only;
   in-session until saved. ✓

## Findings (non-blocking)

- Carry-forward (from L2): editor values via `<title>`/labels rather than discrete `data-*` attrs.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. You can now start a melody from a blank template, build it, and save it into the catalog. Only
**L4c-2 — the evolution sparkline visualization** remains of the arc (how a song's candidates climbed over
generations) — the last piece of the "watch the songs evolve, keep the best" loop.
