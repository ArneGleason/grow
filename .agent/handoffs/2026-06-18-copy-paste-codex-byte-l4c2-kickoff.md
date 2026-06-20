# Kickoff: Byte L4c-2 — evolution sparkline visualization (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Branch off:** current `origin/main`. State your base sha back.
**Design refs:** roadmap + `2026-06-18-claude-editor-ux-design-note.md` (the progressive-disclosure layout).
Builds on L4a/L4b (candidates + catalog) and the editor-ux layout. **Phase 4, byte L4c-2 — the last piece of
the arc.** Read-only visualization. No logic change.

## Goal
Make the **evolution of the song's ideas visible** — the "keep the best of the best, purge the rest" story as a
compact **fitness-over-generations sparkline** + a small status tally, inside the editor (a collapsible
"Evolution" panel, per the progressive-disclosure model). **Read-only / presentation-only** — it just reads the
existing candidate data and draws; **no change to the evolution algorithm, persistence, scorer, renderer, or
candidate-store.**

## Data (reuse `listCandidates` — no new endpoint)
- Read the song's **phrase candidates** via `persistence.listCandidates({ kind:"phrase", branchId:
  "editor-<songId>", limit:… })` (the same source the catalog uses). Optionally also include the autonomous
  evolving population (`dial-<songId>`) **if it's straightforward** — document whichever scope you choose; the
  required minimum is `editor-<songId>`.
- From that set compute (deterministically):
  - **best fitness per generation** = group by `generation`, take `max(fitness)` per group → the sparkline
    points (x = generation, y = fitness).
  - **mean fitness per generation** = `avg(fitness)` per group → an optional fainter second line.
  - **status tally** = counts by `status` (`elite` / `alive` / `reserved` / `purged`).

## The panel (small, in the editor)
- A collapsible **"Evolution"** section in the editor (progressive disclosure — collapsed by default with a
  chevron cue; expands on click). Small, narrow, vertically stacked — **fits the contained editor; no
  horizontal overflow** (same containment rules as editor-ux).
- **Sparkline:** a compact SVG line/area of best-fitness-per-generation (climbing curve), optional faint mean
  line. Small axis hints (gen count, top fitness) — minimal labels.
- **Status tally:** a tiny row — elite / alive / reserved / purged counts (a small stacked bar or just labeled
  numbers). This is the "best kept, rest purged" made visible.
- **Empty/sparse handling:** if the population has only one generation (e.g. just authored gen-0 ideas), show a
  graceful state (a single point / distribution, or a short "no evolution yet — run the line to evolve" note) —
  don't break.
- Re-render when the song changes and after the catalog refreshes (a save / an evolution run).

## Safety / invariants
- **Read-only, presentation-only.** Reads candidate data via `listCandidates`; **no** evolution/persistence/
  scorer/renderer/candidate-store/server/schema change. Deterministic render from the data.
- Fits the editor-ux contained/progressive-disclosure layout — collapsible, small, narrow, **no overflow/clip**.
- Melody/phrase candidates; doesn't disturb the catalog, the generated entry, or the editor's edit/save paths.
- Round any displayed fitness numbers (no float artifacts).

## Tests
- **Smoke (hermetic — unique/clean branch):** seed a song's branch with candidates across **multiple
  generations** (e.g. run `runEvolution`), open the Evolution panel; assert it renders a sparkline whose
  per-generation best-fitness points match the data (compute the expected max-per-gen from `listCandidates` and
  compare), and a status tally matching the `status` counts; the sparse/one-generation case renders the
  graceful state (no crash). Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (must pass on a non-clean store — run it twice) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will **live-verify**: populate a song's
branch with several generations (`runEvolution`), open the Evolution panel, confirm the sparkline's
best-per-generation points + the status tally match the candidate data, the sparse case is graceful, and the
panel fits without overflow/clipping at a normal viewport.

## Out of scope (explicitly)
- Changing the evolution algorithm / scoring. Per-candidate **lineage trees** (population-level per-generation
  only; per-idea mini-sparklines are a possible later nicety). Bass & beats. Any interactivity beyond
  expand/collapse. Any persistence/render/scorer change.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: a collapsible "Evolution" panel in the editor renders a
best-fitness-per-generation sparkline + status tally computed from `listCandidates` (state the branch scope you
read), handles the sparse/one-generation case gracefully, fits the contained layout with no overflow, is
read-only with no logic/persistence/render/scorer change; smoke count.
