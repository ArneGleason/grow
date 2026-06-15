# Plan: UI overhaul — from dev inspector to playable instrument

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual
**Date:** 2026-06-14
**Status:** arc plan + first byte (UI-1) kickoff. Pre-phase-2.

## Vision (Arne)

Turn Grow's dev inspector into a **funner toy you can both watch and play**: a stage-forward visualization of
the performance + evolution, high-level controls + a clear prompt-entry front door, a song picker that shows
each song's evolution at a glance, and all the dense inspection detail packed away into a drawer you open only
when you want it.

## Five pillars

1. **Stage-forward** — the performance is the hero (living players, current elite, fitness climbing live).
2. **High-level controls only, up top** — play, mode, tempo, and the "written ↔ evolving" dial.
3. **Prompt as the front door** — "describe a song idea" prominent and inviting.
4. **Song picker as a gallery** — each song a card with an evolution sparkline + "from an idea."
5. **Progressive disclosure** — all dense panels pack into one default-closed `inspect` drawer.

## Locked decisions (Arne, 2026-06-14)

- **Layer, don't replace.** The instrument is the new default surface; every existing panel, `testid`, and
  `window.*` harness is **preserved, re-homed into the inspect drawer** — not deleted. Smoke stays green; dev
  + phase-2 inspection affordances survive.
- **Calm it down first** — the first byte is the layout shell + inspect drawer.

## Byte slicing

- **UI-1 — instrument shell + inspect drawer** (this kickoff). Declutter: re-home every dense panel into a
  default-closed drawer; surface a calm high-level control bar; keep the stage. Presentational only.
- **UI-2 — high-level control bar + the "written ↔ evolving" dial as a real control** (the influence
  gain / α — written↔reactive/evolve).
- **UI-3 — prompt front door** — surface the SongGoal idea entry prominently (interpret + apply already exist).
- **UI-4 — song picker gallery** — cards per song with an evolution sparkline (fitness over generations) +
  "from an idea"; drives song selection.
- **UI-5 — stage / visualization** — enhance the terrarium: players react visibly; live evolution readout
  (generation, elite, climbing fitness) on the stage.

---

# Kickoff: Byte UI-1 — instrument shell + inspect drawer

**Goal:** re-home the dense inspector panels into a single **default-closed `inspect` drawer**, and surface a
calm high-level control bar — **without deleting anything**. Purely presentational; no behavior/logic change.

```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-ui1-instrument-shell
```

## What changes
- Wrap **all** the existing `inspector-section` panels (listening, song-goal, song-sketch, thoughts,
  melody-score, form-score + variants, taste/players, slow-thinking, persistence, etc.) in a collapsible
  **inspect drawer** (`data-testid="inspect-drawer"`) with a toggle button (`data-testid="inspect-toggle"`),
  **collapsed by default**.
- Surface a **high-level control bar** at the top: the existing transport toggle, session-mode control, and
  tempo/key readout — re-laid-out cleanly. (No new controls in UI-1; the real "written↔evolving" dial is UI-2.)
- Keep the **stage** (terrarium) as the visible centerpiece (unchanged — UI-5 enhances it).

## Hard constraints (this is the "layer, don't replace" discipline)
- **Every existing `testid` and `window.*` harness stays present in the DOM**, drawer open or closed — do
  **not** conditionally render the panels out. "Closed" is a visual collapse (CSS), so `getByTestId(...)`
  and the window harnesses still resolve.
- **Presentational only.** No changes to transport, scoring, evolution, persistence, or any handler/logic.
  `npm run build` + `npm run db:smoke` semantics unchanged.
- **Smoke stays green.** For smoke tests that *interact with* now-drawered controls (click interpret/apply,
  form-variant, etc.), open the drawer first (e.g. a small `openInspectDrawer(page)` step or click
  `inspect-toggle` in setup). That's a **UX-faithful** test update (the detail now lives in a drawer), not a
  weakening — keep every assertion.

## Acceptance tests
1. All pre-existing `testid`s still resolve (drawer open or closed) — the panels are in the DOM, just
   collapsed.
2. The dense panels are inside `inspect-drawer`, **closed by default**; clicking `inspect-toggle` opens/closes
   it; drawered controls are interactable when open.
3. The high-level control bar shows transport + mode + tempo and is visible without opening the drawer.
4. No behavior change — transport/evolution/scoring/persistence untouched; build/db:smoke unchanged.
5. Full smoke green (with the drawer opened in tests that touch drawered controls).

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# don't leave a dev/preview server running against data/ during smoke (it corrupts the candidate tests)
git add -A && git commit -m "Byte UI-1: instrument shell + inspect drawer (layer, don't replace)"
git show --stat HEAD
git push -u origin codex/byte-ui1-instrument-shell
git rev-parse origin/codex/byte-ui1-instrument-shell   # include this sha in the handoff
```
Handoff with branch + commit sha, a note on the drawer mechanism (how panels stay in-DOM while collapsed), and
validation results. I'll review + verify the declutter live (drawer closed by default, panels present-but-
hidden, toggle works, controls reachable).

— Claude
