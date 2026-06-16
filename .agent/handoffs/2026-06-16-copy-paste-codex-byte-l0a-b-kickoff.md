# Kickoff: Byte L0a-b — name the other two realizable modes (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` *after L0a merges* (it builds directly on `src/grow-language.ts`).
State your base sha in the handoff back.
**Context:** L0a review (`.agent/reviews/2026-06-16-claude-codex-l0a-grow-language-code-review.md`) found that
main realizes **6** modes, not 4 — my L0a kickoff under-counted. L0a named the 4 it was asked to; this byte
names the remaining two realizable ones so the upcoming skin (L0b) never renders `undefined`.

## Goal
Extend the L0a vocabulary to cover **all six engine-realizable modes**. Still a pure-additive data byte — no
behavior change, no UI wiring.

## Scope
1. In `src/grow-language.ts`, add to `GROW_LANGUAGE_MODE_IDS` and `MODE_BRIDGES`:
   - `lydian → "Helium"` — vibe: *"weightless, fizzy, floats off the ground"* — `brightnessRank: 7` —
     `intervals: MODE_INTERVALS.lydian`.
   - `phrygian → "Scorch"` — vibe: *"smouldering, tense, a little dangerous"* — `brightnessRank: 2` —
     `intervals: MODE_INTERVALS.phrygian`.
   - Resulting brightness order (bright→dark): Helium(7) > Sunshine(6) > Strut(5) > Smoke(4) > Bruise(3) >
     Scorch(2). (1 stays reserved for the future Freefall/Locrian.)
2. **Reconcile degree `role` labels** with the design note (now aligned to your L0a choice): keep
   1 `home` · 4 `pillar` · 5 `pillar` · 7 `leans home` · 2/3/6 `color`. (No change needed if that's already
   what you shipped — just confirm.)
3. Update `tests/grow-language.unit.spec.ts`:
   - round-trip now covers all 6 modes;
   - `modeDisplayName("lydian") === "Helium"`, `modeDisplayName("phrygian") === "Scorch"` (no longer
     `undefined`);
   - `locrian`/`"Freefall"` still return `undefined`;
   - `modeBridge(m).intervals` deep-equals `MODE_INTERVALS[m]` for all 6;
   - brightness strictly ordered across all 6; evocative names still unique.

## Invariants / guardrails
- **Additive only** — do NOT modify `MODE_INTERVALS`, `SONG_GOAL_MODES`, `tonal-context`, playback, scoring, or
  any UI. Only `grow-language.ts` + its unit spec change.
- **Single source of truth** — intervals come from `MODE_INTERVALS`; no copied arrays.
- Deterministic, pure helpers; `undefined` on miss; case-insensitive lookups (unchanged).
- **Default-preserving** — smoke count + behavior unchanged.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · `npm run unit:grow-language` (green, expanded) · `npm run smoke` (unchanged count) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged).

## Out of scope (explicitly)
- `locrian`/Freefall and any `MODE_INTERVALS`/`SONG_GOAL_MODES` change → separate behavior-change byte.
- Applying names/colors in the UI → **L0b**.
- Any representation / kernel / renderer / editor work → Phase 1+.

## Handoff back
Quote the commit sha + `git show <sha> --stat`. Confirm: all 6 modes round-trip; lydian→Helium /
phrygian→Scorch resolve; locrian still `undefined`; smoke count unchanged.
