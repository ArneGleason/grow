# Claude Review: Byte L0b — apply the Grow language skin (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Reviewed commit:** `e8d7eb4` on `origin/codex/byte-l0b-language-skin` (sha confirmed)
**Base:** `origin/main` `973551b` (verified ancestor; L0a-b in main)
**Review branch:** `claude/codex-l0b-language-skin-code-review`

## Verdict

**Approved — merge `codex/byte-l0b-language-skin`.** The toy now *speaks the language*: both musical-mode
readouts show the evocative name ("C Strut", "G Smoke") with the classical name + key on hover and the
canonical id in `data-mode-classical`, and the degree palette is visible as a legend in the inspect drawer.
**Display-only / read-only / layer-don't-replace** — confirmed by diff and live. Gauntlet green; **smoke 70/70**
(count unchanged); **live-verified in the browser**.

## Focus-point confirmations (code + live)

1. **Evocative names in the two readouts only.** Both `control-key-readout` and `listening-tonal-context`
   route through a shared `renderTonalContextDisplay` (DRY) that sets the evocative label + `title` bridge +
   `data-mode-classical`. `formatTonalContextDisplay` uses `modeDisplayName` guarded by `isKnownSongGoalMode`,
   with **fallback to the classical name** for any unknown/empty mode (never blank). The
   `session-mode`/`timing-feel`/`melody-development`/`form-variant` controls and the `goal.mode` log/summary
   strings are untouched. ✓
2. **Live (independent eval).** `control-key-readout` = `"C Strut"`, `data-mode-classical="mixolydian"`,
   `title="Strut · Mixolydian · key of C"`; `listening-tonal-context` identical. ✓
3. **Degree legend renders the real palette.** Live: 7 items, each swatch's computed `background-color` equals
   its `--degree-N` token exactly — 1 home `#D85A30`, 2 color `#EF9F27`, 3 color `#639922`, 4 pillar `#1D9E75`,
   5 pillar `#378ADD`, 6 color `#7F77DD`, 7 leans home `#D4537E`. Built from `DEGREE_COLORS` in numeric key
   order via `var(--degree-N)`; scoped `.degree-color-legend` CSS, additive. ✓
4. **Calm placement + drawer contract.** Legend lives inside the inspect drawer; smoke asserts it stays
   mounted while closed, is hidden when collapsed, and becomes visible (with `1 home`/`4 pillar`/`5 pillar`/
   `7 leans home`) on open — the UI-1 collapse contract holds. ✓
5. **Canonical value stays deterministic.** Smoke now asserts the classical id via `data-mode-classical`
   (and the dynamic G-dorian→"G Smoke" path on *both* readouts), so tests/tooling keep a stable canonical
   handle while the visible text is evocative. Count unchanged (assertions edited within existing tests). ✓
6. **Display-only.** No tonal/playback/scoring/SongGoal/representation/transport change; only DOM text +
   attributes + a legend + scoped CSS. ✓

Gauntlet (fresh, no preview during smoke): build 0 · unit 5/5 · db:smoke 0 · diff clean · smoke 70/70 · audit
unchanged (2 known dev-only esbuild/Vite advisories).

## Findings (non-blocking)

- **Initial static HTML hardcodes the default readout** (`data-mode-classical="mixolydian" title="…" C Strut`)
  to match the default song. Correct today; it's a small duplicate of what `renderTonalContextDisplay`
  computes, so if the default song's mode ever changes, the very first paint would be briefly stale until the
  first `renderStatus`. Trivial (renderStatus runs immediately) — could later seed it from the helper, not
  worth a change now.
- Legend CSS uses literal text colors (`#d7dfcf`/`#eef3e5`) rather than theme tokens — consistent with the
  surrounding inspector styles; fine, carry-forward.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. Phase 0 is complete — the toy now speaks the language end to end (names + palette). Next is **Phase 1**:
the anchors+connectors representation + kernel renderer (**L1a**), the real foundation. (Per-note degree
*coloring* lands there too, once notes render as elements.)
