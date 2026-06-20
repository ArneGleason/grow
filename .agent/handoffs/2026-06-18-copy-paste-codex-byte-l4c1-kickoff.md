# Kickoff: Byte L4c-1 — author a new idea from scratch (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Branch off:** current `origin/main` (`28414d4` — L4b + editor-ux merged). State your base sha back.
**Design refs:** roadmap + `2026-06-18-claude-editor-ux-design-note.md`. Builds on L3 (edit mode + working
phrase), L4a (save), L4b (catalog), and the editor-ux progressive-disclosure layout. **Phase 4, byte L4c-1.**
L4c-2 = the evolution sparkline viz (separate, meatier — out of scope here).

## Goal
Add a **"New idea"** action to the melody editor that starts a **fresh phrase from a minimal template**,
drops you into edit mode to build it up (L3 tools), and saves it as a candidate (L4a). Mostly wiring — reuse
the working-phrase, override, edit tools, and save path. **No new persistence/render/scorer logic.** Melody-only.

## What "New idea" does
- A small **"+ New idea"** affordance in the editor (in the catalog area / header, per the progressive-
  disclosure layout — small/light, doesn't widen anything).
- On click: build a **minimal valid template `AnchorPhrase`** in the current key/baseOctave, set it as the
  `workingAnchorPhrase`, **enter edit mode**, and update `editorMelodyOverride` (so it's immediately audible).
  Mark the catalog selection as **"new · unsaved"**.
- The user then edits with the existing L3 tools (anchors / connectors / structure) and **Saves** via the
  existing L4a path → it persists as an `anchor-phrase/v1` candidate in `editor-<songId>` and shows up in the
  catalog (L4b).

## The template (document your choice)
A **minimal but valid + musical** starting point — not the prosody-generated idea, not a duplicate. Suggested:
**one segment, 2–3 anchors on strong degrees** (e.g. home `1` → dominant `5`, or `1 → 5 → 1`) with `fill`
connector(s) between them, default dynamics, `baseOctave 4`. It must pass `normalizeAnchorPhrase` clean
(≥1 segment, ≥1 anchor, connectors == anchors−1, in-scale by construction). Keep it small — the point is a
blank-ish canvas you build on.

## Wiring
- `window.phraseEditor.newIdea()` (or similar) creates the template + enters edit mode + sets the override —
  the same single mutation/override path L3 uses; gestures (the button) call it. Expose it for tests/review.
- Reuse `createAnchorPhraseCandidateGenome` + `writeCandidate` for Save (unchanged from L4a).

## Safety / invariants
- Template is **valid, bounded, in-scale** (integer degrees; via `normalizeAnchorPhrase` + `renderAnchorPhrase`).
- Reuses the L3 working-phrase + `editorMelodyOverride` + L4a save — **no new persistence/server/schema/render/
  scorer change**. Save still content-hash idempotent + branch-scoped.
- **Edit-mode action** → naturally gated out of the evolving regime (unchanged). Reversible (revert/close/song-
  change/evolving clear, as L3). Melody-only. Read-only L2 default + UI-1/UI-2 + editor-ux contracts intact.
- Authoring a new idea must not disturb the **"generated" / catalog** entries (it's a fresh working phrase,
  not a mutation of an existing candidate) until Saved.

## Tests
- **Unit:** the template builder produces a phrase that `normalizeAnchorPhrase` accepts unchanged (valid, ≥1
  segment/anchor, connectors == anchors−1, degrees 1..7).
- **Smoke (hermetic — unique/clean branch per the editor-ux pattern):** `newIdea()` sets the working phrase to
  the template + enters edit mode + the override reflects it (in-scale); after an edit + Save a **new**
  candidate exists in `editor-<songId>` (distinct from the generated entry and any prior idea) and appears in
  the catalog; the "generated" entry is unchanged. Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (must pass on a non-clean store — run it twice) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will **live-verify**: `newIdea()` →
working phrase is the template (in-scale), edit mode on, override audible; edit an anchor; Save → a new
candidate persists in `editor-<songId>` + appears in the catalog; the generated entry is untouched.

## Out of scope (explicitly)
- **Evolution sparkline visualization → L4c-2.** Bass & beats. Any persistence/render/scorer change. Making a
  saved idea the song's default performance. Duplicate-and-edit (this is from-scratch only).

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: "+ New idea" seeds a minimal valid in-scale template
into edit mode via a testable `window.phraseEditor.newIdea()`, audible via the override; Save persists it as a
new `anchor-phrase/v1` candidate in `editor-<songId>` (reusing L4a) that appears in the catalog; the generated
entry is undisturbed; no persistence/render/scorer change; smoke count; and the template you chose.
