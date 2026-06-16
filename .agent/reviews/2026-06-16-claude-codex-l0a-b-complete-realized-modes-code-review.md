# Claude Review: Byte L0a-b — name the realized modes (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Reviewed commit:** `973551b` on `origin/codex/byte-l0a-b-complete-realized-modes` (sha confirmed)
**Base:** `origin/main` `4e49acc` (verified merge-base; L0a is in main)
**Review branch:** `claude/codex-l0a-b-complete-realized-modes-code-review`

## Verdict

**Approved — merge `codex/byte-l0a-b-complete-realized-modes`.** Exactly the specced two-entry extension:
`lydian → Helium` (brightnessRank 7) and `phrygian → Scorch` (brightnessRank 2), so the bridge now covers
**all six engine-realizable modes**. Intervals still sourced from `MODE_INTERVALS`; `satisfies` typing intact;
`locrian`/Freefall correctly remains `undefined`. Pure-additive, no behavior change. Gauntlet (fresh, no
preview server): **build 0 · unit 5/5 · db:smoke 0 · diff clean · smoke 70/70 · audit unchanged**.

## Focus-point confirmations

1. **Both modes named, intervals from source of truth.** New `MODE_BRIDGES.lydian`/`.phrygian` reference
   `MODE_INTERVALS.lydian`/`.phrygian` — no copied arrays. `GROW_LANGUAGE_MODE_IDS` extended to 6. ✓
2. **Brightness order complete & strict** (bright→dark): Helium(7) > Sunshine(6) > Strut(5) > Smoke(4) >
   Bruise(3) > Scorch(2); rank 1 left for the future Freefall/Locrian. Test asserts the full chain. ✓
3. **Round-trip over all 6, case-insensitive.** `modeDisplayName("lydian") === "Helium"`,
   `modeClassicalId("helium") === "lydian"`, `modeClassicalId("SCORCH") === "phrygian"`. ✓
4. **Freefall/Locrian still `undefined`** — `locrian` is not in `MODE_INTERVALS`/`SONG_GOAL_MODES`, so naming it
   stays out of scope (a separate behavior-change byte). ✓
5. **Degree role labels reconciled** with the design note and pinned by tests: 1 home · 2/3 color · 4/5 pillar ·
   6 color · 7 leans home. Docs and code now agree. ✓
6. **Additive only.** Diff is `grow-language.ts` (+16) and its unit spec (+net) only — no `MODE_INTERVALS`,
   `SONG_GOAL_MODES`, tonal/playback/scoring/UI/CSS change. Smoke count unchanged. ✓

## Findings (non-blocking)

- None. The vocabulary layer is now complete for every realizable mode.
- Standing follow-up (unchanged, not this byte): naming **Freefall** requires first adding `locrian` to
  `MODE_INTERVALS` + `SONG_GOAL_MODES` — a small, separate behavior-change byte whenever we want the 7th mode
  realizable.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. Phase 0's vocabulary is done. Cleared for **L0b** (apply the skin: evocative mode names + degree colors
in the existing stage/inspector — the first byte that actually *shows* the new language).
