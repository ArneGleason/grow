# Kickoff: Byte L3b — connector kernel + knob editing (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L3a merges*. State your base sha back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` (§ Anchors + connectors) + roadmap. Builds on
the L3a edit foundation (`anchor-phrase-edit.ts`, `window.phraseEditor`, `editorMelodyOverride`,
`canEditAnchorPhrase`, selection). **Phase 3, byte L3b** — edit *how notes travel between anchors*.

## Goal
In edit mode, let the human **select a connector** and change its **kernel** (`fill`/`detour`/`approach`/
`orbit`/`skip`) and **knobs** (reach/density/bias/pull/skew), with each change validated, re-rendered, and
**heard live** through the existing editor override. Reuse all of L3a's machinery — this byte adds the
connector mutation path + connector selection UI, nothing structural.

## Edit model — extend the pure module (single mutation path)
Add `editConnectorInPhrase(phrase, segmentIndex, connectorIndex, patch)` to `src/anchor-phrase-edit.ts`,
mirroring `editAnchorInPhrase`:
- `patch` = partial of `{ kernel, reach, density, bias, pull, color, skew }`.
- Validate `kernel` against `CONNECTOR_KERNELS` (reject unknown → keep current); clamp knobs:
  `reach/density/pull/color` → `[0,1]`, `bias/skew` → `[-1,1]`.
- Run the result through `normalizeAnchorPhrase`; return the same `AnchorEditResult` shape
  (`{ changed, valid, phrase, errors, warnings, clamps }`).
- **Connectors don't move anything** — no positional bounds/ordering/overlap/breath logic needed (anchors are
  untouched). The connector only changes the *gesture* between two fixed anchors.
- Wire `main.ts` `editConnectorPhraseConnector(...)` (parallel to `editAnchorPhraseAnchor`) that calls it,
  updates `workingAnchorPhrase` + the `editorMelodyOverride` (reuse the existing render+`refreshLookahead`
  path), and re-renders the roll. Expose `window.phraseEditor.editConnector(segmentIndex, connectorIndex,
  patch)` (and surface the current selection in `getState()`).

## UI gestures
- **Select a connector** — click its gesture curve/label in the roll (add a `selectedConnectorRef` alongside
  L3a's anchor selection; selecting one deselects the other). Highlight the selected connector.
- **Kernel palette** — the five kernels as small glyph buttons (`fill`/`detour`/`approach`/`orbit`/`skip`);
  picking one applies via `editConnector`.
- **Knob controls** — sliders for **reach, density, bias, pull, skew** on the selected connector.
- **`color` is omitted from the UI for now** — the renderer is diatonic-only (color is stored-not-rendered, per
  L1b), so editing it would have no audible effect. The data model/`editConnector` still *accept* `color`
  (bounded) for completeness; just don't surface a control until chromatic rendering exists. (Optionally show it
  disabled with a "diatonic only for now" note.)

## Hear it
Reuse L3a's `editorMelodyOverride`: after a connector change, `renderAnchorPhrase(workingPhrase)` regenerates
the connector's passing notes under the new kernel/knobs and the override plays it (via the existing
`refreshLookaheadSchedule`). The roll re-renders with the updated kernel cue. No new scheduling/audio path.

## Safety / invariants
- **In-scale by construction** — the renderer only ever emits integer scale degrees regardless of kernel/knobs;
  the **16-note-per-connector budget** (L1b) caps `density`. Bounded (knob clamps + closed kernel set),
  deterministic, reversible (revert/close/song-change/evolving clear the override, as L3a).
- **Edit disabled in the evolving regime** (reuse `canEditAnchorPhrase`). Melody-only. **In-session only**
  (persistence is L4). Read-only L2 default + UI-1/UI-2 contracts intact.

## Tests
- **Unit** (`anchor-phrase-edit`): `editConnectorInPhrase` applies a kernel change and knob change; unknown
  kernel rejected (keeps current); knobs clamped to range; **anchors/structure unchanged** (only the connector
  differs); `changed` flags correctly.
- **Smoke:** in edit mode, select a connector and via `window.phraseEditor.editConnector` change the kernel
  (e.g. `fill`→`orbit`) and a knob (e.g. density); assert the working phrase's connector reflects it, the
  override re-rendered and is in-scale, and the rendered passing notes changed; revert clears; connector edit
  disabled in evolving; default still read-only. Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify**: select a connector via
`window.phraseEditor`, change kernel (e.g. fill→orbit) and density, confirm the override's passing notes change
accordingly and stay in-scale, anchors unchanged, revert clears, edit blocked in evolving.

## Out of scope (explicitly)
- Anchor editing (done, L3a). Segment/gap add-remove-split-breath editing → **L3c**. Persistence / authoring →
  **L4**. Chromatic `color` *rendering* → a separate gated byte. Bass & beats. Editing during evolving.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: connector edits via a testable
`window.phraseEditor.editConnector`, kernel validated + knobs clamped, anchors/structure unchanged, edits
audible via the existing override and clearing as in L3a, edit disabled in evolving; smoke count; and one line
on the connector-selection + kernel-palette + knob controls you built (and whether `color` is hidden/disabled).
