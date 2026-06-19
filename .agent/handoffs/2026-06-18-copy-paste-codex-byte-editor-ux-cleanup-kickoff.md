# Kickoff: Byte editor-ux-cleanup — progressive disclosure + player menu (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Branch off:** current `origin/main` *after L4b merges*. State your base sha back.
**Design ref:** `2026-06-18-claude-editor-ux-design-note.md` (read it — the model + the two chat mockups).
**This byte comes BEFORE L4c** (Arne's UX feedback). Please wait for this kickoff before building.

## Goal
Reorganize the melody editor's **presentation + entry point** per the design note: a small **player menu** as
the way in, a **contained** overlay that scrolls inside itself, and **progressive-disclosure** collapsible tool
panels that are **small, light, narrow, and vertically stacked**. Also fix the **non-hermetic L4a/L4b smoke**.
**Presentation-only — no change to edit/catalog/persistence/render/scoring logic.** Melody-only.

## Scope

### 1. Entry — click a player → a small menu
- Clicking the **melody** player opens a **small menu** (a compact popover), not the editor directly. First
  item **"Graphical phrase"** opens the graphical editor; keep the menu tiny (e.g. just "Graphical phrase" for
  now, optionally a disabled "Voice & level" placeholder). This **replaces the off-screen player-card trigger**
  (currently `top ≈ 2485`, width 0 — unfindable). The menu must be discoverable and keyboard-reachable.
- Structure the menu + editor so other player types (beat → grid, harmony → cadence) and other menu items can
  be added later — but **build melody only** now. "Graphical phrase" is a per-player label.

### 2. Contained overlay
- The editor overlay must **fit the viewport**: `max-height: ~90vh` (or fit-to-stage) + **`overflow-y: auto`**,
  so content **scrolls within the panel** and never spills off the bottom. Keep it **narrow** (≈300–360px) and
  **vertically stacked** — **no horizontal overflow/clipping** of any control or the roll.

### 3. Progressive disclosure
- **Open minimal:** header (breadcrumb e.g. "melody › Graphical phrase" + small Read/Edit toggle + close) +
  the **idea stepper** (‹ prev · "Idea N / M" · next ›) + the **roll**. No tool panels expanded initially.
- **Reveal on selection:** the **Connector** panel and **Anchor** panel are collapsible sections that
  **expand when you select** a connector/anchor (and collapse/cue otherwise with a chevron). Show only the
  selected element's tools. Tuck **secondary connector knobs (bias, pull, skew)** behind a **"More"**
  disclosure; show the primary ones (kernel chips + reach, density) first.
- **Small & light:** compact buttons, small kernel chips, tidy sliders; sliders one-per-row (stacked) so they
  never clip. The structural ops (+Anchor / Remove / Split / Join) live in the Anchor panel (or a small tools
  row inside it), not a crammed top row.

### 4. Catalog inside the editor
- Browsing ideas = the header **stepper** (prev/next, "Idea N / M") + a **collapsible catalog list** section —
  **not** a separate menu destination. Keep all L4b catalog behavior (fitness-sorted, purged hidden, render
  selected read-only, edit-this-idea, preview); just present it within this disclosure model.

### 5. Fix the non-hermetic L4a/L4b smoke
- The L4a/L4b tests assume a clean `editor-<songId>` branch but the SQLite store persists across runs, so they
  fail on accumulated state (e.g. `expect(savedCount).toBe(1)` at `grow.smoke.spec.ts:2228`). Make them
  **hermetic**: unique per-test song/branch (like the timestamped diversity tests), or reset the branch at test
  start, or assert **relative deltas** instead of absolute counts. Full `npm run smoke` must pass on a store
  that already has `editor-<songId>` candidates.

## Invariants / guardrails
- **Presentation + entry + disclosure only.** Do NOT change `window.phraseEditor` semantics, the edit-model,
  catalog/persistence, the renderer, scoring, or the transport. Behavior identical — just reorganized and
  progressively disclosed.
- **Preserve smoke testids** (or update them coherently with the smoke in the same byte); keep the
  `window.phraseEditor` API surface.
- Read-only default; edit gated out of evolving (unchanged). Melody-only. In-scale etc. unaffected (no logic
  change). UI-1/UI-2 (drawer/control-bar) contracts intact.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · unit suites green · `npm run smoke` (must pass on a non-clean store — run it twice) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will **live-verify** at a normal
viewport: the player menu opens and "Graphical phrase" opens the editor; the editor opens minimal; selecting a
connector/anchor reveals its panel; **nothing clips or spills** (measure overlay vs viewport + scrollHeight);
resize check; and the smoke is hermetic.

## Out of scope (explicitly)
- New edit features. Bass & beats editors / menus. L4c (author-from-scratch + evolution sparkline viz). The
  actual per-player-type variants (just keep the structure generalizable). Any logic/persistence/render change.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: player-menu entry (melody) opening the editor; overlay
contained (max-height + overflow-y auto) with no spill; progressive-disclosure panels (reveal-on-select +
collapse cues + "More" for secondary knobs); small/narrow/vertical, no horizontal clipping; catalog inside the
editor; L4a/L4b smoke now hermetic (passes on a non-clean store); no logic/persistence/render change; smoke
count.
