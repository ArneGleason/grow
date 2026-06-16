# Kickoff: Byte L0a — Grow language vocabulary map + degree colors (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` — state the sha you branch from in your handoff back.
**Design refs (on branch `claude/grow-language-design-and-roadmap` until merged):**
`.agent/handoffs/2026-06-16-claude-grow-language-design-note.md` (north star) +
`...-grow-language-roadmap.md` (plan). This is **Phase 0, byte L0a**.

## Goal
A pure **additive data + helpers layer** for the new musical language: the mode evocative-name ↔ classical
bridge and the degree color tokens, with two-way translate helpers. **No behavior change, no UI wiring**
(applying it in the UI is L0b). This is the cheap, zero-risk first step that lets every later byte speak the
new language.

## Source of truth (do not duplicate or mutate)
- Canonical modes + intervals: `src/tonal-context.ts` → `MODE_INTERVALS` = `ionian, dorian, mixolydian,
  aeolian` (4). `SONG_GOAL_MODES` in `src/song-goal.ts` is the same 4.
- L0a covers **exactly these 4**. The design note's full 7-name vocabulary (incl. Helium/Lydian,
  Scorch/Phrygian, Freefall/Locrian) is the aspirational set; realizing the other 3 = a **separate future
  byte** that extends `MODE_INTERVALS` + `SONG_GOAL_MODES` (a behavior change — explicitly NOT in L0a).

## Scope
1. **New module** `src/grow-language.ts` (additive; imports `MODE_INTERVALS` rather than re-declaring intervals):
   - **Mode bridge** for the 4 canonical modes — for each: `{ classical, evocative, vibe, brightnessRank }`,
     with `intervals` sourced from `MODE_INTERVALS[classical]` (single source of truth — do not copy the
     arrays). Mapping (from the design note):
     - `ionian → "Sunshine"` (wide-open, easy, obviously happy) — brightnessRank per below
     - `mixolydian → "Strut"` (loose, grinning swagger — bright with grit)
     - `dorian → "Smoke"` (cool, curling, bittersweet but moving)
     - `aeolian → "Bruise"` (tender, heavy-hearted, the ache)
     - brightness order (brightest→darkest) over these 4: Sunshine > Strut > Smoke > Bruise. Use ranks that
       leave room for the future 3 (e.g. keep the full-7 order in mind), but only the 4 need ranks now.
   - **Translate helpers** (case-insensitive; lookups return `undefined` on miss, matching house lookup
     style — no throwing in pure getters):
     - `modeDisplayName(classical: SongGoalMode): string | undefined`
     - `modeClassicalId(evocative: string): SongGoalMode | undefined`
     - `modeBridge(classical: SongGoalMode)` → `{ classical, evocative, vibe, brightnessRank, intervals }`
   - **Degree colors** — `DEGREE_COLORS`: `Record<1..7, { role: string; varName: string; hex: string }>`
     using the design-note palette: 1 coral `#D85A30` (home), 2 amber `#EF9F27`, 3 green `#639922`,
     4 teal `#1D9E75`, 5 blue `#378ADD` (pillar), 6 purple `#7F77DD`, 7 pink `#D4537E`. Helpers
     `degreeColor(degree)` / `degreeRole(degree)` (1-based; out of 1..7 → `undefined`).
2. **CSS tokens** in `src/style.css`: custom properties `--degree-1` … `--degree-7` set to the 7 hexes, so
   SVG/HTML can reference one source (and a future dark-mode pass is one place). Define only; apply nowhere yet.
3. **Unit tests** (new spec, or extend an existing pure-module spec — not the Playwright smoke):
   - round-trip translate for all 4 modes (`modeClassicalId(modeDisplayName(m)) === m`, case-insensitive);
   - `modeBridge(m).intervals` deep-equals `MODE_INTERVALS[m]` for all 4;
   - brightness ranks strictly ordered Sunshine > Strut > Smoke > Bruise;
   - `DEGREE_COLORS` has 1..7, all hexes unique, all evocative mode names unique.

## Invariants / guardrails
- **Additive only.** Do NOT modify `MODE_INTERVALS`, `SONG_GOAL_MODES`, `tonal-context`, playback, scoring, or
  any UI. New module + new CSS vars + new tests only.
- **Classical ids stay canonical** under the covers; evocative names are a display/translation layer on top.
- **Deterministic, pure** helpers; no I/O, no globals (a read-only `window.growLanguage` getter is an optional
  nice-to-have for later live checks — fine to include, but keep it side-effect-free).
- **Default-preserving:** smoke count and behavior unchanged.

## Acceptance (the gauntlet — run with NO dev/preview server against `data/`)
`npm run build` (0) · `npm run smoke` (unchanged pass count) · `npm run db:smoke` (0) · `git diff --check` ·
`npm audit` (unchanged) · new unit tests green.

## Out of scope (explicitly)
- Applying names/colors anywhere in the UI → **L0b**.
- Adding lydian/phrygian/locrian to the engine → separate future byte.
- Any representation / kernel / renderer / editor work → Phase 1+.

## Handoff back to Claude
Quote the **commit sha** and paste `git show <sha> --stat`. Confirm: smoke pass count unchanged; the 4-mode
bridge round-trips; degree tokens defined. Note any mismatch you find between the design-note tables and the
engine's canonical mode set.
