# Claude Review: Byte L2 — read-only graphical phrase editor (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-17
**Reviewed commit:** `3eabee4` on `origin/codex/byte-l2-readonly-graphical-editor` (sha confirmed)
**Base:** `origin/main` `5b878cc` (verified ancestor; L1e is merged)
**Review branch:** `claude/codex-l2-readonly-graphical-editor-code-review`

## Verdict

**Approved — merge `codex/byte-l2-readonly-graphical-editor`.** The first byte that lets you *see* a phrase, and
it's faithful: clicking the melody card opens a prominent, dismissable, **read-only** overlay that renders the
current song's `generateProsodicAnchorPhrase` in the visual grammar — timing grid, degree-colored anchor bars,
labeled connector gestures, and a visible breath. **UI-only** (no transport/prosody/persistence touched).
Gauntlet: **build 0 · all 5 unit suites · db:smoke 0 · diff clean · smoke 71/71** (+1 new editor test) ·
audit unchanged. **Live-verified** (open + reconstruct + screenshot).

## Focus-point confirmations (code + live)

1. **Read-only, UI-only.** The whole diff is `main.ts` (+361, editor render/open/close), `style.css` (+259),
   smoke (+45). Grep confirms **no transport/prosody/persistence/audition call** in the added code; live, the
   transport stayed `stopped` across open→close. No editing affordances. ✓
2. **Reachable + melody-only.** Only the melody card becomes a button (`role=button`, `tabIndex 0`,
   `aria-haspopup="dialog"`); click and Enter/Space open it (live: `cardIsButton: true`, card click opened the
   overlay). ✓
3. **Default closed + dismissable.** Overlay `hidden` by default (live `closedByDefault: true`); Close button,
   Escape (`handleGlobalKeydown`, torn down in HMR), and backdrop click all close + restore focus to the card. ✓
4. **Renders the real data, 1:1.** `createCurrentProsodyAnchorPhrase()` = `generateProsodicAnchorPhrase(prosody
   SeedForSong(songId))`; re-renders on song change, churn-guarded by a render key. Live, the roll rendered
   **11 anchors / 9 connectors / 1 breath**, exactly matching `fromProsody()` (2 segments, cadences [5, 1]). ✓
5. **Visual grammar correct.** Anchors = rounded rects, `x=startBeat`, `width=durationBeats`, vertical by pitch
   (`octave*7+degree-1`), **`fill=var(--degree-N)`**, **opacity scales with dynamics** (live: dyn 0.18→0.53,
   0.46→0.68). Connectors = labeled bezier gestures with per-kernel classes (live kernels:
   approach/fill/…/approach). Breath = a labeled band between segments. Grid = bar/beat lines + beat labels.
   Header = evocative `modeDisplayName` ("C Strut") + `data-mode-classical` + classical/key `title`. ✓
6. **Layered/calm.** Renders over the stage (not in the inspect drawer); UI-1/UI-2 drawer + control-bar
   contracts still pass (smoke). Screenshot confirms it's a prominent overlay, stage/controls intact behind. ✓

Screenshot captured: the arch (teal 4 → blue 5 → purple 6, the dominant question), the breath band at beat 8,
the consequent resolving to coral 1 (home), labeled approach/fill connectors, "C Strut" header, read-only note.

## Findings (non-blocking)

- **Values exposed via `<title>` + labels, not discrete `data-*` attrs.** My kickoff suggested
  `data-degree`/`data-start`/etc.; Codex put the values in `<title>` tooltips (`degree 3, octave 4, beat 0,
  dynamics 0.18`) + visible labels (`3.4`, kernel names). Verifiable (I reconstructed from them), just less
  convenient for assertions — consider discrete `data-*` if L3 needs finer test hooks. Not blocking.
- **`reach` shown in the connector `<title>`, not as a variation-ribbon width.** The labeled curve conveys the
  kernel clearly; ribbon-width-as-reach (the mockup nicety) can land with L3's interactivity. Fine for read-only.
- Opacity floor 0.44 keeps ghost notes legible — intentional, reads well in the screenshot.
- (Process) the kickoff `.md` lives on my unmerged planning branch, so Codex worked from Arne's relayed block —
  expected; the copy-paste block is the operative handoff.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. **You can now see a real phrase.** Cleared for **L3 — interactive editing** (move/resize/retune anchors,
pick connector kernels + knobs, open/close gaps, hear it) on top of this read-only view.
