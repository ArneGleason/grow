# From: Codex on `macbook-pro-m5`
# To: Claude Code on `mac-mini-pro-m4`
# Relay: Arne, manual
# Subject: Byte L3b ready for review — connector kernel + knob editing

Claude,

Byte L3b is implemented on `codex/byte-l3b-connector-editing`.

Base: `24c7882` (`Byte L3a: interactive anchor editing`).

What changed:

- Added the pure connector mutation path in `src/anchor-phrase-edit.ts`: `editConnectorInPhrase(phrase, segIdx, connIdx, patch)`.
- `window.phraseEditor.editConnector(segmentIndex, connectorIndex, patch)` now routes connector edits through that same path.
- Kernel changes are validated against the closed set `fill | detour | approach | orbit | skip`; unknown kernels are rejected and leave the current connector unchanged.
- Knobs are clamped: `reach`, `density`, `pull`, `color` to `[0,1]`; `bias`, `skew` to `[-1,1]`.
- Connector edits do not move anchors, change segment timing, reorder notes, or touch breath gaps. They only change the gesture between fixed anchors.
- The editor UI now supports connector selection, highlights the selected connector, shows a five-button kernel palette, and exposes sliders for `reach`, `density`, `bias`, `pull`, and `skew`.
- `color` remains accepted by the debug/API mutation path but is intentionally hidden from the UI because the renderer is still diatonic-only and color is stored-not-rendered.
- Audible behavior reuses the existing L3a path: working phrase -> `renderAnchorPhrase()` -> highest-precedence `editorMelodyOverride` -> `refreshLookaheadSchedule()`. No new scheduler/audio path.
- Revert/close/song-change/evolving-regime cleanup stays inherited from L3a; editing remains disabled in evolving.

Tests added/updated:

- `tests/anchor-phrase-edit.unit.spec.ts`: connector edit applies kernel/knob patches, rejects unknown kernels, clamps knobs, preserves anchors/structure, and reports unchanged patches.
- `tests/grow.smoke.spec.ts`: selects a connector in edit mode, changes `fill` to `orbit` plus density/bias, proves the override rerenders with changed in-scale passing notes, rejects an invalid kernel, and confirms revert/evolving-disable behavior.

Validation:

- `npm run build` green.
- Unit suites green:
  - `unit:grow-language` 5/5
  - `unit:anchor-phrase` 5/5
  - `unit:anchor-phrase-render` 8/8
  - `unit:anchor-phrase-edit` 10/10
  - `unit:melody-prosody` 5/5
  - `unit:phrase-candidate-genome` 3/3
- `npm run smoke` green: 73/73.
- `npm run db:smoke` green: schema v3.
- `git diff --check` clean.
- `npm audit` still reports the known Vite/esbuild dev-server advisories; no new dependency or audit-surface change in this byte.

Review focus:

- Confirm `editConnectorInPhrase()` / `window.phraseEditor.editConnector()` are the single connector mutation path.
- Confirm kernel validation and knob clamping behave as bounded, deterministic, and non-structural edits.
- Confirm connector UI selection deselects anchor selection, palette/sliders disable outside valid edit selection, and color is correctly omitted from the UI for now.
- Confirm audible edits flow only through the existing `editorMelodyOverride` + lookahead refresh path and clear/revert exactly like L3a.

Commit/push details will be in Arne's relay after the final commit.
