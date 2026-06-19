# Design Note: Editor UX — progressive disclosure + player menu

**Author:** Claude Code (architect), with Arne
**Date:** 2026-06-18
**Status:** Agreed direction. Drives the **editor-layout-cleanup** byte (companion kickoff:
`2026-06-18-copy-paste-codex-byte-editor-ux-cleanup-kickoff.md`). Claude shared two mockups in chat (the
contained-panel pass, then the progressive-disclosure pass) — this note is the durable record of the model.

## The problem (Arne's report, diagnosed live)
The melody phrase editor grew a lot of controls across L2/L3/L4 and never got a layout pass. Measured live at
viewport 821×942:
- **Unfindable.** The only trigger is the melody player card, which sits off-screen (`top ≈ 2485`, **width 0**).
  No visible "open the editor" affordance.
- **Spills the popup.** Editor `max-height ≈ 716px` but `overflow-y: visible` → content overflows with **no
  internal scroll**; editor bottom (`978`) is **below the viewport** (`942`).
- **Clips horizontally.** The toolbar's segment readout, the connector Pull/Skew sliders, and the roll's right
  edge spill past the right boundary; catalog + edit + revert + save + 4 structural buttons are crammed into one
  overflowing row.

## The direction
A shift from "popup that shows everything" to **progressive disclosure with a small menu as the way in.**

### 1. Entry: click a player → a small menu of choices
Clicking a player opens a **small menu**, not the full editor. The **first item opens the graphical editor**
("Graphical phrase"). Don't dump everything on screen immediately. The menu replaces the off-screen player-card
trigger and is the discoverable entry point.

### 2. "Graphical phrase" is a per-player label (generalizable)
The same graphical editor generalizes by player type — melody → a **line** ("Graphical phrase"), and later a
beat player → a **grid**, a harmony player → a **cadence**. The label/content vary; the editor is one concept.
**This byte is melody-only**; just build the menu + editor so that generality is easy to add later.

### 3. The editor: progressive disclosure
- **Open minimal** — just what you need to start: the roll + the idea stepper + a small Read/Edit toggle +
  close. No tool panels shown yet.
- **Reveal on interaction** — property panels appear/expand as you click: select a **connector** → its panel
  (kernel + knobs) expands; select an **anchor** → its panel; unselected panels stay **collapsed with a cue**
  (a chevron) so you know there's more to open. Secondary controls (e.g. bias/pull/skew) tuck behind a "More"
  disclosure within their panel.
- **Contextual** — show the tools for what's selected, not all tools at once.

### 4. Small, light, narrow, vertical
- **Small lightweight controls** (compact buttons, small chips, tidy sliders).
- **Stack vertically** and keep the panel **narrow** (≈300px). Scrolling up/down is fine; **never side to
  side** — no horizontal clipping/overflow.
- **Collapsible panels** for any extra properties.

### 5. Contained overlay
The overlay **fits the viewport** (`max-height: ~90vh`, `overflow-y: auto`) and **scrolls inside itself** — it
must never spill off the bottom of the screen again.

### 6. Catalog lives inside the editor
Browsing ideas is the editor's prev/next **stepper** in the header + a **collapsible catalog list** — not a
separate menu destination. The player menu stays tiny.

## Principles (carry forward)
Small & light · progressive disclosure (start minimal, reveal on click, cue what's collapsed) · contextual
(selected element's tools only) · vertical-stacked & narrow (no horizontal scroll) · collapsible · contained
(fits + scrolls within the viewport).

## What this is NOT
Not a feature change. The edit/catalog/persistence/render/scoring logic is unchanged — this is a presentation +
entry-point + disclosure reorganization. All `window.phraseEditor` APIs and behaviors stay; only the layout and
how controls are surfaced change.
