# Kickoff: Byte L2 — the read-only graphical note editor (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L1e merges*. State your base sha back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` (§ The visual grammar) + roadmap. This is
**Phase 2, byte L2** — the first byte that lets you *see* a real phrase. **Read-only.** Editing is L3.

## Goal
Click the **melody** player → open a prominent, dismissable **graphical editor overlay** that renders the
player's current idea — `window.anchorPhrase.fromProsody()` (the native `AnchorPhrase` for the current song) —
in the visual grammar (timing grid, colored anchor bars, gesture ribbons, breath). **Layer-don't-replace,
calm, read-only.** No editing, no playback change, melody-only.

## Reachability
- Clicking `player-card-melody` (it already exists in `#player-list`) opens the editor overlay for the melody.
  Make the affordance clear (the card acts as a button / gains an "open editor" control) and keyboard-reachable.
- The overlay is **prominent but dismissable** (close button + Escape + click-outside), **default closed**,
  and rendered **over/beside the stage — NOT inside the dense inspect drawer** (keep the stage calm; the editor
  appears on demand). Opening/closing it must not touch playback or the transport.
- L2 is **melody-only**; bass/beats get editors later.

## Data
- Render `window.anchorPhrase.fromProsody()` — the native `AnchorPhrase` for the current song's prosody seed
  (rich anchors + real connector kernels). Re-render when the song changes (`song.setId`).
- **Note (not a bug to fix here):** when a candidate audition / evolved melody is the *active* performance, the
  editor still shows the prosody idea, not the auditioned candidate. Matching the live candidate's genome is a
  later refinement — out of scope for L2.

## The visual grammar (from the design note + the two mockups)
SVG canvas for the roll (precise grid/bars/ribbons); HTML chrome (header + close) around it. Use the
`--degree-1..7` CSS tokens (from L0a/L0b) for degree colors — consistent palette.

- **Header:** the evocative mode name via `modeDisplayName(mode)` + key, classical name on hover (`title`) —
  reuse the L0b helpers. This is the "idea" label (e.g. "C Strut").
- **Timing grid:** heavy **bar** lines, light **beat** lines, beat counts along the bottom; x-axis = beats over
  the phrase length.
- **Pitch axis:** vertical position reflects **pitch** (degree + octave) so the contour reads correctly
  (anchors can sit in different octaves — fromProsody occasionally peaks an octave up). **Color = degree**
  (`var(--degree-N)`), so same degree in different octaves shares color but differs in height. Faint lanes ok.
- **Anchors:** rounded-corner rects — `x = startBeat`, `width = durationBeats`, vertical position by pitch,
  `fill = var(--degree-N)`, **`opacity = dynamics`** (loud anchors solid, ghosts faded).
- **Connectors:** between consecutive anchors *within a segment*, a gesture indication — a connecting
  line/sparkline wrapped in a soft **variation ribbon whose width ∝ `reach`**, plus a small **kernel** cue
  (glyph or distinct style) for `fill`/`detour`/`approach`/`orbit`/`skip`. (Optionally show the faint rendered
  passing notes from `renderAnchorPhrase` — secondary; the anchor+connector structure is the point.)
- **Gaps:** the silence **between segments** shown as a visible breath (a small breath mark / clear empty span;
  no connector crosses the gap).

## Read-only
No drag, no edit, no click-to-change anchors/connectors. Open/close + view only. (Move/resize/retune = L3.)

## Verification surface (so smoke + I can confirm the view maps to the data)
- Editor root `data-testid="melody-editor"`; an open control + closed-by-default state queryable like the
  inspect drawer (UI-1 pattern).
- Each rendered anchor/connector element carries data attributes — e.g. anchor:
  `data-degree`, `data-octave`, `data-start`, `data-duration`, `data-dynamics`; connector: `data-kernel`,
  `data-reach` — so the rendered view can be asserted against `fromProsody()` deterministically.
- (Optional, helpful) a read-only `window` getter returning the editor's current view-model (the anchors/
  connectors it drew) for live reconstruction.

## Tests
- **Smoke:** clicking `player-card-melody` opens `melody-editor`; it's **closed by default**; the editor renders
  the expected anchor count and key structure for the default song (assert e.g. the first anchor's degree, the
  two cadence degrees **5** then **1**, and that a breath/gap is present between the two segments); close works;
  all existing testids (stage, player cards, inspect drawer) intact. Note the final smoke count.
- Keep it layered: the drawer-collapse and control-bar contracts from UI-1/UI-2 must still pass.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · existing unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify in the browser**: open the editor, screenshot
it, and reconstruct the rendered anchors/connectors (via the data attributes / view-model getter) to confirm
degree-colors, widths=durations, opacity=dynamics, the breath gap, and the evocative mode header all match
`fromProsody()`.

## Out of scope (explicitly)
- Any editing / interaction beyond open-close → **L3**.
- Bass & beats editors. Authoring / idea catalog → **L4**. Hearing/playing from the editor; matching the
  live-auditioned candidate. Connector-palette editing. Changing playback/scoring/representation.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: melody-only, read-only, opens from the player card,
default closed, layered (drawer/control-bar contracts intact); the rendered view maps to `fromProsody()` (data
attributes present); smoke count; and a one-line note on where the editor renders (overlay/panel) + how it's
dismissed.
