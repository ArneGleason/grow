# Kickoff: Byte L4b — the idea-catalog browse / select (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L4a merges*. State your base sha back.
**Design refs:** design note (§ The editor's job — "peruse its idea catalog") + roadmap. Builds on L4a
(candidates persisted to `editor-<songId>`), the L2/L3 editor (`window.phraseEditor`, the roll,
`editorMelodyOverride`), and L1e (`renderPhraseCandidateGenome`). **Phase 4, byte L4b.** L4c = author-from-
scratch + evolution sparkline viz.

## Goal
Turn the editor header's "idea N of M" into a real **catalog**: browse the song's saved/evolved phrase
population, **see** each idea rendered in the roll, and **load one to edit** (seed the working phrase from it
→ edit mode → re-save via L4a). Reuse L4a/L3 — this byte adds the browse/select UI + a load-to-edit path; no
new persistence/server/schema.

## Catalog data
- List the song's phrase candidates via `persistence.listCandidates({ kind: "phrase", branchId:
  "editor-<songId>", limit: … })`; **filter out `purged`** (show `alive`/`elite`), **sort by `fitness` desc**
  (best first). That ordered set is the catalog; "idea N of M" indexes it.
- Re-list when the song changes and after a Save (L4a) so the catalog reflects new ideas.
- **Scope to `editor-<songId>`** (the human-facing authored/edit branch). Surfacing the autonomous evolving
  population (`dial-<songId>`) is a later option — out of scope here.
- (Re the L4a finding: this branch mixes authored gen-0 and any evolution output. Sorting by fitness + hiding
  purged gives a coherent "best ideas" list; optionally show a small marker for `generation 0` = authored vs
  evolved. Marker is nice-to-have, not required.)

## Browse / select UI
- **Header nav:** prev / next + "idea N of M" (the mockup's catalog control). Navigating selects a candidate.
- **See it:** selecting renders the candidate **read-only** into the roll via
  `renderPhraseCandidateGenome(candidate.genome)` → the same grid/anchors/connectors/breath view (L2). Show its
  fitness + a tag (authored/evolved) in the header readout.
- Keep a **"generated"** entry (the live prosody idea, `fromProsody`) as the default/initial view so the
  catalog is "generated + the saved/evolved ideas." Browsing navigates the candidates.

## Load-to-edit (required)
- An **"Edit this idea"** action seeds `workingAnchorPhrase` from the selected candidate **when its genome is
  native** `anchor-phrase/v1` (use `isAnchorPhraseCandidateGenome` → `genome.phrase`), then enters edit mode →
  L3 editing + L4a Save apply to it. For a **non-native (legacy flat)** candidate, keep it **view-only** (or
  convert via `anchorPhraseFromPlayerPatternSource`) with a short note — don't fail.

## Hear it (recommended)
- A **"Preview"/"Hear"** action on the selected idea sets `editorMelodyOverride =
  renderPhraseCandidateGenome(candidate.genome)` so you hear it (reuse the L3 override + its existing
  clear-on-close/song-change/evolving paths + `refreshLookaheadSchedule`). Make preview **explicit** (a button),
  **not** automatic on every prev/next (avoid override thrash while paging). Clears like any override.

## Safety / invariants
- **Read-only by default**; browsing/selecting/previewing don't mutate candidates (`listCandidates` is a read).
  Editing only via the L3 working-phrase path; saving only via L4a.
- **In-scale by construction** (rendering via `renderPhraseCandidateGenome`/`renderAnchorPhrase`). No new
  scheduling/audio path (preview reuses the override). Edit/preview gated out of the evolving regime as L3/L4a.
- **No persistence/server/schema/scorer/representation change.** Melody-only.
- Read-only L2/L3 defaults + UI-1/UI-2 contracts intact.

> If browse + see + load-to-edit + preview is too large for one byte, land **browse + see + load-to-edit**
> first and **preview** as L4b-2 — your call; say so in the handoff. Don't compromise the read-only/safety
> guarantees.

## Tests
- **Smoke:** save ≥2 distinct ideas (L4a) for the song; open the catalog and assert it lists them
  fitness-sorted (purged excluded), prev/next updates "idea N of M" and renders the selected candidate in the
  roll (matches `renderPhraseCandidateGenome(candidate.genome)`); "Edit this idea" on a native candidate seeds
  the working phrase from its `genome.phrase` and enters edit mode; preview sets the override to the candidate's
  render (if you include it); browsing mutates nothing (candidate list/ids unchanged). Note the final smoke
  count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify**: save a couple ideas, browse the catalog
(fitness-sorted, purged hidden), confirm each selection renders in the roll matching its genome, "Edit this
idea" seeds the working phrase from the selected native candidate, preview plays it in-scale via the override,
and browsing mutates nothing.

## Out of scope (explicitly)
- Author-a-new-idea-from-scratch + evolution sparkline viz → **L4c**. Surfacing the `dial-<songId>` autonomous
  population. Making a selected idea the song's default performance. Bass & beats. Any persistence/server/
  schema/scorer change.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: the catalog lists `editor-<songId>` candidates
(fitness-sorted, purged hidden), prev/next + "idea N of M" render the selected candidate read-only,
"Edit this idea" seeds the working phrase from native candidates (legacy → view-only), preview (if included)
reuses the override + clears, browsing mutates nothing, no persistence/server/schema change; smoke count; and
whether you landed preview or deferred it to L4b-2.
