# Kickoff: Byte L3c — segment / gap structural editing (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L3b merges*. State your base sha back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` (§ Phrase = segments + gaps) + roadmap.
Builds on the L3a/L3b edit foundation (`anchor-phrase-edit.ts`, `window.phraseEditor`, `editorMelodyOverride`,
`canEditAnchorPhrase`, selection). **Phase 3, byte L3c** — the last editing slice: change the phrase's
*structure*. Then L4 = persistence/catalog.

## Goal
In edit mode, let the human **add/remove anchors** and **split/join segments (open/close breaths)**, each
change keeping all structural invariants, re-rendered, and **heard live** through the existing override.
Reversible. Melody-only, in-session.

## The structural ops — extend the pure module (single mutation path)
Add to `src/anchor-phrase-edit.ts`, each returning the `AnchorEditResult` shape and ending with
`normalizeAnchorPhrase` (the safety net — if the result is structurally invalid, **revert to base**, never ship
a broken phrase):

- **`addAnchorToPhrase(phrase, segmentIndex, atBeat, options?)`** — insert an anchor at `atBeat` (grid-snapped)
  into the segment, **also inserting one connector** so `connectors == anchors-1`. Defaults: degree/octave
  interpolated from neighbours (or a sensible default), small duration that fits the insertion gap, mid
  dynamics; new connector = default `fill` (the `connector()` defaults). Must land in a real gap between
  existing anchors (or at an end) without overlap; reject/clamp if it can't fit or would exceed
  `maxAnchors` (64).
- **`removeAnchorFromPhrase(phrase, segmentIndex, anchorIndex)`** — remove the anchor **and one adjacent
  connector** (keep `connectors == anchors-1`). If it's the segment's last anchor, **remove the segment**;
  reject if it's the phrase's only anchor (keep ≥1 segment, ≥1 anchor).
- **`splitSegmentInPhrase(phrase, segmentIndex, anchorIndex)`** (open a breath) — split so `anchorIndex` begins
  a new segment; **drop the connector that crossed the split** (each new segment keeps `anchors-1`
  connectors); **open an audible breath** by shifting the trailing segment later by a default breath
  (~0.5 beats), clamped to phrase length. Reject if `anchorIndex` is 0 (nothing before it) or would exceed
  `maxSegments` (16).
- **`joinSegmentsInPhrase(phrase, segmentIndex)`** (close a breath) — merge `segmentIndex` with
  `segmentIndex+1` into one segment, **inserting one bridging connector** (default `fill`) between the join so
  `connectors == anchors-1`. The former gap becomes that connector's span (the renderer fills it instead of
  silence). Reject if there's no next segment.

Wire `main.ts` wrappers (parallel to `editAnchorPhraseAnchor`/`editConnectorPhraseConnector`) that call these,
update `workingAnchorPhrase` + the `editorMelodyOverride` (reuse the render+`refreshLookahead` path), re-render
the roll, and keep selection sane after the structure changes. Expose on `window.phraseEditor`:
`addAnchor`, `removeAnchor`, `splitSegment`, `joinSegments`.

## UI gestures (keep minimal)
- **Add anchor:** an explicit affordance — e.g. double-click an empty grid cell, or a "+" that inserts into the
  largest gap / at the selected position.
- **Remove anchor:** Delete/Backspace on the selected anchor, or a small remove control.
- **Split (open breath):** a "split here" control at the selected anchor.
- **Join (close breath):** a "join" control on a breath band / between two segments.
Buttons-on-selection are fine; no fancy drag-to-split needed.

## Hear it
Reuse `editorMelodyOverride`: after any structural op, `renderAnchorPhrase(workingPhrase)` re-renders and plays
via the existing `refreshLookaheadSchedule`. No new scheduling/audio path.

## Safety / invariants
- **`connectors == anchors-1` per segment** maintained by each op; **ordering / non-overlap / gap≥0 / caps
  (≤16 segments, ≤64 anchors) / ≥1 segment / ≥1 anchor-per-segment** enforced via the op + the final
  `normalizeAnchorPhrase` revert-to-base guard. An op that can't produce a valid result returns `valid:false`
  and the unchanged base phrase.
- **In-scale by construction** (new anchors are integer degrees; renderer never emits raw pitch). Bounded,
  deterministic, **reversible** (revert/close/song-change/evolving clear the override, as L3a/b).
- **Edit disabled in the evolving regime** (`canEditAnchorPhrase`). Melody-only. **In-session only**
  (persistence = L4). Read-only L2 default + UI-1/UI-2 contracts intact.

> If the four ops in one byte get too large, it's fine to land add/remove first and split/join as L3c-2 — your
> call; just say so in the handoff. Don't compromise the invariants to fit it all in.

## Tests
- **Unit** (`anchor-phrase-edit`): add → `anchors+1` & `connectors+1`, still valid, fits without overlap;
  remove → `anchors-1` & `connectors-1` (or segment removed), rejects removing the only anchor; split →
  `segments+1`, the cross-connector dropped, a real gap opened, each segment `connectors==anchors-1`; join →
  `segments-1`, one bridging connector added, `connectors==anchors-1`; cap/edge rejections
  (`anchorIndex 0` split, no-next join, over-cap add) return `valid:false` + unchanged base.
- **Smoke:** in edit mode, via `window.phraseEditor` run an add, a remove, a split, and a join; assert the
  working phrase's segment/anchor/connector counts change as expected and stay valid, the override re-rendered
  + in-scale, breaths appear/disappear; revert clears; structural edits disabled in evolving; default still
  read-only. Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify**: drive add/remove/split/join via
`window.phraseEditor`, confirm counts + structure update correctly, the override re-renders + stays in-scale,
breaths open/close audibly, anchors stay ordered/non-overlapping, revert clears, edits blocked in evolving.

## Out of scope (explicitly)
- Anchor field editing (L3a) and connector kernel/knob editing (L3b) — done. Persistence / authoring / idea
  catalog → **L4**. Chromatic `color` rendering. Bass & beats. Editing during evolving.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: the structural ops via a testable `window.phraseEditor`
(add/remove/splitSegment/joinSegments); each maintains `connectors==anchors-1` + ordering/overlap/gap/caps with
the normalize revert-to-base guard; audible via the existing override + clearing as L3a/b; edit disabled in
evolving; whether you landed all four ops or staged them; smoke count; and one line on the gestures you built.
