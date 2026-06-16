# Kickoff: Byte L0b — apply the language skin (evocative mode names + degree colors) (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` *after L0a-b merges*. State your base sha in the handoff back.
**Design refs:** `.agent/handoffs/2026-06-16-claude-grow-language-design-note.md` + `...-roadmap.md`. This is
**Phase 0, byte L0b** — the first byte that *shows* the language. Builds on `src/grow-language.ts` (L0a/L0a-b).

## Goal
Make the existing UI **speak the new language**: show the musical mode by its evocative name (classical name +
key a hover away), and surface the degree colors. **Display-only, read-only, layer-don't-replace.** No
playback/scoring/representation/behavior change; no new panels on the stage; keep it calm.

## Scope

### 1. Evocative mode names in the two mode readouts (required)
The musical mode currently renders as `${tonic} ${mode}` in exactly two places:
- `control-key-readout` — set at ~`src/main.ts:2693` (`controlKeyReadout.textContent = ...`)
- `listening-tonal-context` — set at ~`src/main.ts:2580` (`listeningTonalContext.textContent = ...`)

For both, using the L0a helpers (read-only import):
- **Visible text** = `${tonic} ${modeDisplayName(mode) ?? mode}` → e.g. `C Strut`. **Fallback to the classical
  name** if `modeDisplayName` returns `undefined` (e.g. a future locrian) — never blank.
- **`title` attribute** (hover bridge) = e.g. `Strut · Mixolydian · key of C` (evocative · Classical · key).
  If unnamed: `Mixolydian · key of C`.
- **`data-mode-classical="${mode}"`** on each readout element — the canonical machine-readable value, so tests
  and future tooling assert the classical id deterministically while the visible text is evocative.

Do **not** touch the `session-mode` / `timing-feel` / `melody-development` / `form-variant` controls — those
are different concepts, not the musical mode. (The `${goal.tonic} ${goal.mode}` strings at ~1389/1409/2552 are
log/section summaries — out of scope for L0b; leave them.)

### 2. Degree color legend (required, calm placement)
A small **static** legend inside the **inspect drawer** (reference material belongs in the drawer, keeps the
stage calm): seven swatches driven by `var(--degree-1..7)`, each labeled with its degree number + role from
`DEGREE_COLORS`/`degreeRole` (1 home · 2 color · 3 color · 4 pillar · 5 pillar · 6 color · 7 leans home).
Additive element, `data-testid="degree-color-legend"`. No note→degree mapping, no new logic — just the palette
made visible/learnable. (Per-note/per-event coloring needs notes rendered as elements; that comes in Phase 1.)

### 3. Smoke assertions
Update any existing smoke assertion that checks the classical readout text (e.g. `"C mixolydian"`): assert the
**canonical value via `data-mode-classical`** and/or the **evocative visible text**. Keep all existing testids.
**Do not add or remove tests** — smoke count stays unchanged (70).

## Invariants / guardrails
- **Display-only.** Import and *read* from `grow-language.ts` (`modeDisplayName`, `DEGREE_COLORS`,
  `degreeRole`). No change to tonal/playback/scoring/SongGoal/representation.
- **Graceful fallback** for unnamed modes → classical name visible, never blank.
- **Layer-don't-replace / calm:** the readouts only gain evocative text + `title` + `data-mode-classical`;
  the legend lives in the drawer. The canonical classical id stays machine-accessible.
- **Drawer still collapses** (UI-1 behavior) with the legend mounted inside it.
- Deterministic; no new globals required.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · `npm run smoke` (70, unchanged count) · `npm run db:smoke` (0) · `git diff --check` ·
`npm audit` (unchanged) · `npm run unit:grow-language` still green.
I will additionally **live-verify in the browser** during review: readouts show `C Strut` etc., hover shows
the classical bridge, `data-mode-classical` is the classical id, switching song/mode updates the evocative
name, the legend shows 7 correct colors, and the drawer still opens/closes.

## Out of scope (explicitly)
- Per-note / per-event / stage degree coloring (needs notes-as-elements) → Phase 1 (or a later L0c).
- Naming/realizing locrian/Freefall → separate behavior-change byte.
- `session-mode`/`timing-feel`/`melody-development`/`form-variant` controls — untouched.
- Any representation / kernel / renderer / editor work → Phase 1+.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: smoke count unchanged and which assertions you
updated; both readouts show evocative names with classical+key on hover and `data-mode-classical` set; the
degree legend renders 7 correct colors inside the drawer; the drawer still collapses.
