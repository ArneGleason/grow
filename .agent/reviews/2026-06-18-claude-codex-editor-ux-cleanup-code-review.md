# Claude Review: Byte editor-ux-cleanup — progressive disclosure + player menu (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Reviewed commit:** `6f26b42` on `origin/codex/byte-editor-ux-cleanup` (sha confirmed)
**Base:** `b601949` (stacked on **L4b**, which is not yet in main — `main` is `2571831`/L4a)
**Review branch:** `claude/codex-editor-ux-cleanup-code-review`

## Verdict

**Approved — merge after L4b.** This fixes **all three of Arne's reported problems** (unfindable / spills the
popup / clips), implements the progressive-disclosure model, and is **presentation-only** (boundary held: only
`main.ts` + `style.css` + smoke; no edit-model/catalog/persistence/render/scorer/transport/`window.phraseEditor`
change). It also makes the L4a/L4b smoke **hermetic**. Gauntlet: **build 0 · 6 unit suites · db:smoke 0 · diff
clean · smoke 76/76 on my reused/non-clean DB** (the hermeticity proof) · audit unchanged. **Live-verified at a
real viewport.**

## Live verification (viewport 821×942, measured + screenshot)

1. **Findable entry.** A visible `player-entry-strip` / `player-entry-melody` is **in the viewport**
   (`top 252`, w 785) → opens a `player-action-menu`; `player-menu-graphical-phrase` opens the editor. (Old
   trigger was the player card off-screen at `top ≈ 2485`, width 0.) ✓
2. **Contained, scrolls inside.** Editor `max-height: min(847.8px, 100% − 20px)`, **`overflow-y: auto`**;
   `scrollHeight 754` within a `352px` panel (vScroll), **`spillBottom: false` / `spillRight: false`** (bottom
   894 < 942). No more off-screen spill. ✓
3. **No horizontal clip.** `scrollWidth == clientWidth` (`hOverflow: false`), panel ~360px narrow — vertical
   only, never side-to-side. ✓
4. **Opens minimal.** At open only the **roll + catalog** are visible; connector tools, kernel chips, anchor
   add-button, dynamics slider are **collapsed** (0 visible range sliders). ✓
5. **Reveal on selection.** Edit mode → selecting an **anchor** reveals its tools + dynamics slider; selecting
   a **connector** reveals the kernel chips. Secondary connector knobs (bias/pull/skew) behind "More" (design
   + smoke). ✓
6. **Catalog inside the editor** (stepper "Idea 1 of 7" + a collapsible Catalog list + Preview / Edit idea);
   L4b browse/preview/edit behavior preserved. ✓

## Other confirmations

- **Boundary held.** Diff is `main.ts`/`style.css`/smoke/`.agent` only — no logic file touched; no
  `window.phraseEditor` semantic change. ✓
- **Hermetic smoke.** Full `npm run smoke` passed **76/76 on my heavily-polluted `data/`** (the exact
  `editor-lantern` accumulation that failed the L4b review's run). The L4a/L4b tests no longer depend on a clean
  branch. ✓
- The old inspector melody card still opens the same menu (continuity) — fine.

## Findings (non-blocking)

- Containment uses `max-height: min(…, 100% − 20px)` + `overflow-y: auto`, which mathematically adapts to any
  viewport; I verified no-spill at 821×942 but did not exhaustively resize-sweep — the formula makes me
  confident it holds smaller.
- Carry-forward (from L2): editor values still via `<title>`/labels rather than discrete `data-*` attrs.

## Merge note

Stacked on L4b. Merge order: **L4b → editor-ux-cleanup** (both off the current main).

## Blockers before the next byte

None. Arne's editor UX issues are resolved and the test fragility is fixed. Cleared to resume **L4c**
(author-from-scratch + evolution sparkline viz) — which now slots into the progressive-disclosure model.
