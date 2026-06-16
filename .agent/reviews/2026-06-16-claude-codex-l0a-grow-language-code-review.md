# Claude Review: Byte L0a — Grow language vocabulary map + degree colors (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Reviewed commit:** `4e49acc` on `origin/codex/byte-l0a-grow-language` (sha confirmed)
**Base:** `origin/main` `7b22d37` (verified ancestor)
**Review branch:** `claude/codex-l0a-grow-language-code-review`

## Verdict

**Approved — merge `codex/byte-l0a-grow-language`.** A clean, pure-additive vocabulary layer:
`src/grow-language.ts` (mode bridge + degree colors + two-way translate helpers), inert `--degree-1..7`
CSS tokens, dedicated unit tests, and an `export` on the existing `MODE_INTERVALS` so the new module reads
the engine's interval table as the single source of truth. **No behavior change**; smoke count unchanged.
The one real issue is a **scope gap caused by my kickoff** (see below) — Codex implemented exactly what was
asked and flagged the discrepancy correctly. That's resolved by a tiny follow-up (L0a-b), not a rework here.

Gauntlet (fresh, no preview server): **build 0 · unit 5/5 · db:smoke 0 · diff clean · smoke 70/70 · audit
unchanged** (2 known dev-only esbuild/Vite advisories).

## Focus-point confirmations

1. **Additive only.** `tonal-context.ts` gains *only* `export` on `MODE_INTERVALS` — the interval arrays are
   byte-identical (no engine behavior change). `style.css` adds 7 `:root` custom properties, applied nowhere.
   New module + new tests. No playback/scoring/song-goal/UI touched. ✓
2. **Single source of truth.** `grow-language.ts` imports `MODE_INTERVALS` and references it for each bridge's
   `intervals` (no copied arrays); a unit test asserts `modeBridge(m).intervals` deep-equals
   `MODE_INTERVALS[m]`. ✓
3. **Helpers correct.** `modeDisplayName`/`modeClassicalId`/`modeBridge`/`degreeColor`/`degreeRole` are pure,
   return `undefined` on miss, and lookups are case-insensitive (`normalizeLookup` → trim + locale-lowercase).
   Typed with `satisfies` so the maps are checked against their contracts. ✓
4. **Smoke count preserved.** The new `testIgnore: "**/*.unit.spec.ts"` only excludes the new unit file
   (existing smoke specs are `*.smoke.spec.ts`); a separate `playwright.unit.config.ts` + `unit:grow-language`
   script runs the units. Smoke stays 70/70. ✓
5. **Brightness ranks reserve the gaps** (6/5/4/3 for ionian/mixolydian/dorian/aeolian) so the future
   lydian(7)/phrygian(2)/locrian(1) slot in without renumbering. Nicely done. ✓

## The scope gap (my kickoff's error — not a defect, fix in L0a-b)

My L0a kickoff stated `MODE_INTERVALS`/`SONG_GOAL_MODES` are *four* modes. They are in fact **six** on current
main — `ionian, dorian, mixolydian, aeolian, lydian, phrygian` (only `locrian`/**Freefall** is unrealized).
Codex correctly built to the literal spec (4 modes) and made `lydian`/`phrygian` return `undefined`, flagging
it explicitly.

Consequence: **lydian and phrygian are realizable today but have no evocative name**, so when L0b applies the
skin, a song in either mode would render `undefined`. This must close **before L0b**. It's a trivial data
addition (two bridge entries + test updates), specced as **byte L0a-b**: add `lydian → Helium` and
`phrygian → Scorch`, covering all six realizable modes. `locrian`/Freefall stays out until the engine gains
locrian (a separate behavior-change byte).

## Findings (non-blocking)

- **Degree `role` labels drift slightly from the design-note table.** Code has 3=`color`, 4=`pillar`,
  5=`pillar`; the note had 3/4 unmarked and only 5=`pillar`. Cosmetic (descriptive text only, hexes match
  exactly). I'll reconcile in L0a-b and update the design note so docs and code agree — proposing the code's
  reading (1 home · 4 & 5 pillars · 7 leans home · rest color), which is musically defensible (subdominant +
  dominant as the functional pillars).
- The design note + roadmap claim "engine realizes 4 modes" — **corrected to 6** in the planning docs as part
  of this review.

## Handoff back to Codex — provided as a copy-paste block in chat (approve + the L0a-b follow-up).

## Blockers before the next byte

None for L0a itself. **Before L0b**, land L0a-b (name lydian/phrygian) so the skin never renders `undefined`.
