# Claude Review: Byte L3a — interactive anchor editing + hear it (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `24c7882` on `origin/codex/byte-l3a-anchor-editing` (sha confirmed)
**Base:** `origin/main` `834437b` (verified ancestor; L2 merged)
**Review branch:** `claude/codex-l3a-anchor-editing-code-review`

## Verdict

**Approved — merge `codex/byte-l3a-anchor-editing`.** *Watch* becomes *play*: the melody editor can now move /
retune / resize anchors and set dynamics, each edit validated + in-scale + re-rendered + **heard live** via a
highest-precedence editor override, and reversible. Clean architecture (a pure edit module + a single mutation
path), correctly scoped (melody-only, in-session, no persistence). Gauntlet: **build 0 · 6 unit suites green ·
db:smoke 0 · diff clean · smoke 72/72** · audit unchanged. **Live-verified** the full edit→hear→clear loop.

## Focus-point confirmations (code + live)

1. **Single mutation path.** `src/anchor-phrase-edit.ts` `editAnchorInPhrase` is the only place a working phrase
   is mutated; `main.ts` `editAnchorPhraseAnchor` wraps it, and **every** entry point (drag, dynamics
   control/keyboard, `window.phraseEditor.editAnchor`) routes through it (grep-verified — no direct
   `workingPhrase.segments = …` writes). ✓
2. **Edits can't break ordering / overlap / breath, and stay in-scale.** The pure module clamps `degree` to
   1..7 (integer ⇒ in-scale), `octave` 0..8, `dynamics` 0..1; snaps `startBeat` to the 0.25 grid and clamps it
   to `[prev-anchor-end | prev-segment-end, next-anchor-start | next-segment-start]` (so neighbors, segment
   order, and the inter-segment breath are all preserved); clamps `durationBeats` to `[min, gap-to-next]`; then
   runs the result through **`normalizeAnchorPhrase`** and **reverts to base if invalid** — never a broken
   working phrase. Live: an out-of-range `startBeat: 9999` stayed valid (clamped); degrees stayed integer. ✓
3. **`editorMelodyOverride` — highest precedence, audible, clears cleanly** (live A/B/C/D):
   - **A** after an edit, `getActiveMelodyPhrasing()` *equals* the override (checked before
     `candidateMelodyAudition` and prosody) → the edited phrase is the melody; 18 rendered notes, all integer
     (in-scale).
   - **B** `revert()` clears the override; melody returns to the generated line.
   - **C** song change while editing clears the override + exits edit mode.
   - **D** entering the evolving regime sets `canEdit:false`, exits edit mode, and clears the override. ✓
4. **No new scheduling/audio path.** Audible edits reuse `getActiveMelodyPhrasing` + the existing
   `refreshLookaheadSchedule()`; grep shows no new transport/audio calls. ✓
5. **Scope honored.** Melody-only; in-session (override is ephemeral); read-only L2 view is the default;
   `canEditAnchorPhrase() = writtenEvolvingRegime !== "evolving"`; no scoring/candidate-store/server change. ✓
6. **Testable surface.** `window.phraseEditor` exposes `enterEditMode`/`editAnchor`/`getWorkingPhrase`/
   `getOverridePattern`/`revert`/`exitEditMode`/`getState` — drove all of the above headlessly; the unit spec
   pins the edit-model. Gestures: drag-to-move/retune, right-edge resize, dynamics slider. ✓

## Findings (non-blocking)

- The editor override is **in-session only** (cleared on reload) — expected per scope; persistence/authoring is
  **L4**.
- Carry-forward (from L2): anchor/connector values are exposed via `<title>`/labels rather than discrete
  `data-*` attrs. Fine; revisit if L3b/L3c want finer test hooks.
- I verified edit mode functionally (window API + by-ear reconstruction) rather than a fresh edit-mode
  screenshot — the editor visual is on record from L2 and the functional proof is conclusive.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. You can now reach in and move a note and hear it stay in key. Cleared for **L3b** — connector kernel +
knob editing (pick `fill`/`detour`/`approach`/`orbit`/`skip`, adjust reach/density/bias/pull/skew) on the same
working-phrase + override foundation.
