# Claude Review: Byte UI-1 — Instrument Shell + Inspect Drawer (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `3b57ebc` on `origin/codex/byte-ui1-instrument-shell` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-ui1-instrument-shell-code-review`

## Verdict

**Approved — merge `codex/byte-ui1-instrument-shell`.** The declutter is exactly the "layer, don't replace"
discipline: the dense panels are re-homed into a default-closed `inspect` drawer via a **CSS collapse** (they
stay mounted in the DOM), every pre-existing `testid` + `window.*` harness is preserved, and it's **purely
presentational** — zero logic files touched. Build/db:smoke/diff green; **smoke 69/69 on a fresh DB**; audit
unchanged. Verified the declutter live (the browser check the in-app tool blocked for you).

## Focus-point confirmations

1. **Presentational only.** `git diff --name-only` shows only `main.ts` (template + drawer toggle), `style.css`,
   the smoke, and `.agent` bookkeeping — **no** transport/scoring/cycle/persistence/server/candidate/prosody/
   taste/song-form file touched. The toggle handler just flips classes + `aria-expanded` + the button label;
   no behavior/logic changed. ✓
2. **Every pre-existing testid stays attached while closed.** Closed state is CSS only —
   `.inspect-drawer:not(.is-open) .inspect-drawer__content { max-height: 0; visibility: hidden;
   pointer-events: none }` — not `display:none`-removed, not conditionally unmounted. Live: all sampled
   drawered ids resolve while closed (`song-goal-idea-input`, `song-goal-interpret`, `form-score-subscores`,
   `listening-tonal-context`, `song-sketch-title`, `thought-seed-list`), plus the contract test Codex added
   proving panels are attached while closed. ✓
3. **Drawered controls interactable after toggle.** Live: clicking `inspect-toggle` flips `is-open`, content
   `visibility` → visible, and `song-goal-idea-input` becomes actionable (non-zero box). ✓
4. **Stage remains the centerpiece with the drawer closed.** Live: the terrarium canvas is visible
   (non-zero box) on load with the drawer collapsed. ✓
5. **High-level controls visible without opening the drawer.** Live: `transport-toggle` visible while closed;
   the shell keeps transport + session/song/timing controls + compact tempo/key readouts up top. ✓

Live initial state (fresh load): `is-open=false`, `data-open="false"`, `aria-expanded="false"`, toggle label
"Inspect", content `visibility: hidden` / `max-height: 0` → **closed by default**, confirmed.

## On the smoke test changes

Appropriate and UX-faithful, not a weakening: tests that interact with now-drawered controls open the drawer
first (`inspect-toggle`), and a new drawer-contract test asserts the panels are *attached while closed*. Every
prior assertion is preserved; the only change reflects that detail now lives in a drawer. 69/69.

## Findings

None. Clean, low-risk, exactly scoped to "calm it down."

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. Cleared for **UI-2** (the high-level control bar + the "written ↔ evolving" dial as a real control).
