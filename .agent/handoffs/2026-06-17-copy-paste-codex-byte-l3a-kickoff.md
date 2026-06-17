# Kickoff: Byte L3a — interactive anchor editing + hear it (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Branch off:** current `origin/main` *after L2 merges*. State your base sha back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` + roadmap. Builds on the L2 editor
(`anchor-phrase-editor*`). This is **Phase 3, byte L3a** — where *watch* becomes *play*.

L3 is sliced like L1: **L3a = anchor editing (this byte)**, L3b = connector kernels/knobs, L3c =
segments/gaps. L3a turns the read-only roll interactive for **anchors only** and makes the edited phrase
**audible**, in-session.

## Goal
In the melody editor, let the human **move / retune / resize anchors and set their dynamics**, with each edit
**validated, in-scale, re-rendered, and heard live**. Reversible. **In-session only — no persistence yet**
(saving/authoring is L4). Melody-only.

## Architecture (keep the edit-model separate from the gestures)
- **Working phrase:** entering *edit mode* seeds a mutable `AnchorPhrase` working copy from
  `createCurrentProsodyAnchorPhrase()`. The read-only L2 view stays the default; edit mode is an explicit
  toggle inside the overlay.
- **Imperative, testable edit API** (the single mutation path; gestures call it): e.g.
  `editAnchor(segmentIndex, anchorIndex, patch)` where `patch` is a partial of
  `{ startBeat, degree, octave, durationBeats, dynamics }`. It applies the patch, runs the result through
  **`normalizeAnchorPhrase`**, and **commits only if valid** (else snap/clamp or reject — never leave a broken
  working phrase). On commit: re-render the roll + update the melody override (below). Expose a **read-only**
  `window.phraseEditor.getWorkingPhrase()` and the edit API on `window.phraseEditor` so smoke + I can drive
  edits deterministically (the drag/keyboard handlers call the same API — don't put edit logic in the DOM
  handlers).

## The four anchor edits (gestures → the API)
- **Move in time** — drag horizontally → `startBeat`, **grid-snapped** (subdivision 0.25), clamped so it stays
  ordered + non-overlapping within its segment and inside the phrase (no crossing into the breath/next segment).
- **Retune pitch** — drag vertically → `degree` (1..7) with octave crossing adjusting `octave`. Integer degrees
  only ⇒ **always in-scale by construction**.
- **Resize duration** — drag the right edge → `durationBeats`, clamped to `[0.0625, gap-to-next-anchor]`.
- **Dynamics** — a clear control on the selected anchor (handle / small slider / scroll) → `dynamics` 0..1
  (reflected as the bar's opacity, per L2).
Keyboard nudges are a plus (arrows for time/pitch on the selected anchor) but optional.

## Hear it — the editor melody override
- Add a **highest-precedence** source to `getActiveMelodyPhrasing`: an `editorMelodyOverride` (a
  `PlayerPatternSource = renderAnchorPhrase(workingPhrase, { baseOctave, subdivisionBeats: 0.25 })`) checked
  **before** `candidateMelodyAudition` and prosody. Set it on every valid edit and call
  `refreshLookaheadSchedule()` so the change is audible immediately (or staged if the transport is stopped).
- **Reversible:** a "revert to generated" control restores the working copy from prosody; exiting edit mode /
  closing the overlay **clears `editorMelodyOverride`** → melody returns to its normal source. Clearing must
  `refreshLookaheadSchedule()` too.
- **Keep it separate from the D2/D5 candidate audition** (don't reuse `candidateMelodyAudition` — a parallel
  override slot avoids entangling the editor with evolving swaps).

## Safety / invariants
- **In-scale by construction** (only integer degrees; rendered via `renderAnchorPhrase`), **bounded**
  (every field clamped via `normalizeAnchorPhrase`), **deterministic**, **reversible**, **melody-only**.
- **Edit mode is disabled in the evolving regime** (avoid fighting D5) — show a short note ("stop evolving to
  edit"); editing is available in written/speaking. (Simplest safe rule; we can relax later.)
- Opening/closing edit mode and editing while stopped must not start/stop the transport on their own.
- Read-only L2 behavior unchanged when not in edit mode; UI-1/UI-2 (drawer/control-bar) contracts intact.

## Tests
- **Unit** (edit-model): `editAnchor` applies a valid patch → normalized working phrase reflects it; an invalid
  patch (overlap / out-of-range) is rejected/clamped, never broken; degrees stay 1..7 (in-scale).
- **Smoke:** enter edit mode; apply an edit via `window.phraseEditor` (e.g. move an anchor + change dynamics);
  assert the working phrase changed, the roll re-rendered, and `editorMelodyOverride` (via
  `getActiveMelodyPhrasing`/a getter) reflects the edit and is in-scale; revert/close clears the override and
  the melody returns to prosody; edit mode is disabled in the evolving regime; default is still the read-only
  view. Note the final smoke count.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (note count) · `npm run db:smoke` (0) ·
`git diff --check` · `npm audit` (unchanged). I will **live-verify**: enter edit mode, apply edits via
`window.phraseEditor`, confirm the working phrase + roll + override update, reconstruct the heard melody (in-
scale, reflects the edit), revert clears it, and editing is blocked in evolving.

## Out of scope (explicitly)
- Connector kernel/knob editing → **L3b**. Segment/gap (add/remove/split/breath) editing → **L3c**.
- **Persistence / saving / authoring** the edited phrase (as a candidate or song override) → **L4**. (L3a
  edits are in-session and ephemeral.)
- Bass & beats. Editing during the evolving regime. Changing the scorer/representation/server.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: anchor-only edits via a testable
`window.phraseEditor` API; edits validated/in-scale/reversible; the editor override makes them audible and
clears on revert/close; edit disabled in evolving; read-only default intact; smoke count; and one line on the
edit gestures you implemented (drag axes / dynamics control / any keyboard nudges).
