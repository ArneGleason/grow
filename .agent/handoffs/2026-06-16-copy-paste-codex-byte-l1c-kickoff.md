# Kickoff: Byte L1c — the orbit + skip kernels (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` *after L1b (and L1a/L0b) merge*. State your base sha in the handoff back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` + roadmap. Builds on
`src/anchor-phrase-render.ts` (L1b). This is **Phase 1, byte L1c** — completes the connector vocabulary.

## Goal
Implement the two kernels L1b left as fallbacks — `orbit` (currently → `fill`) and `skip` (currently → `[]`).
Same rails as L1b: **in-scale by construction, deterministic, bounded, ghosted, within the connector window.**
Leave `fill`/`approach`/`detour` unchanged.

## The two kernels (function + knobs; algorithm is yours)
- **orbit** — *decorate in place* (turn / mordent / trill). Oscillate around the **`from` anchor's degree**
  (the note being decorated), alternating upper/lower neighbours at `reach` scale-steps (reach ≈ 1 = adjacent
  neighbour). `density` = how many oscillations (low ≈ a single mordent/turn; high ≈ a trill). `bias` picks the
  leading neighbour (upper if `bias` > 0, lower if `bias` < 0; alternate near 0). It does **not** traverse to
  `to` — `to` is reached by its own anchor; orbit is the ornament that fills the window. (Distinct from
  `detour`, which departs the A→B *line* and returns toward B.)
- **skip** — *leap through a set* (arpeggiation). Traverse `from → to` by **leaps through a tone subset**
  rather than steps — default the scale's chord tones (every other scale degree, i.e. thirds). `density` = how
  many leap-notes; `bias`/`reach` shape direction/spread. The emitted notes outline an arpeggio between the
  anchors. (Distinct from `fill`, which moves by adjacent steps.)
- For both: only emit **integer scale degrees** (neighbours/chord-tones are integer degrees;
  `noteFromScaleDegree` wraps them in-scale — never a raw pitch). `skew` nudges timing within the window;
  `color` stays **stored but unrendered** (diatonic only); connector notes stay **ghosted** (reuse
  `connectorNote`'s velocity treatment).

## Wiring
- Add `renderOrbitConnector` / `renderSkipConnector` and point `KERNEL_RENDERERS.orbit` / `.skip` at them
  (remove the `fill`/`[]` fallbacks). Reuse the existing `connectorSlots` / `selectSlots` / `connectorNote` /
  budget machinery so the 16-note cap, windowing, snapping, and ghosting are unchanged.
- Optional (nice): extend `DEMO_ANCHOR_PHRASE` (or add a second demo) so an `orbit` and a `skip` connector are
  exercised in `renderDemo()` — helps the eventual editor/audition show them off. Keep the existing demo's
  shape if you'd rather add a separate `DEMO_ANCHOR_PHRASE_KERNELS` export.

## Unit tests (extend `tests/anchor-phrase-render.unit.spec.ts`)
- **orbit:** oscillates around the `from` degree (emitted degrees cluster at `fromDegree ± reach`, alternating),
  notes in-window, in-scale, `density` raises the count, `bias` sets the leading neighbour; **no longer
  identical to a `fill` render** of the same phrase.
- **skip:** emits **leaps** (interval between successive emitted degrees is larger than a `fill`'s adjacent
  steps / hits non-adjacent scale degrees), notes in-window, in-scale, `density` raises the count; **no longer
  empty**.
- both deterministic (same input → identical output) and budget-capped (≤ 16 per connector);
- regression: `fill`/`approach`/`detour` outputs unchanged for an existing phrase.

## Invariants / guardrails
- In-scale by construction (integer degrees only); deterministic (no RNG); bounded (16-note budget); connector
  notes strictly between anchors and ghosted; **additive** — only `anchor-phrase-render.ts` (+ its unit spec,
  maybe the demo). No transport/player/scoring/representation change.

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · `npm run unit:anchor-phrase-render` (green, expanded) · `npm run unit:anchor-phrase`
(green) · `npm run smoke` (unchanged count) · `npm run db:smoke` (0) · `git diff --check` · `npm audit`
(unchanged). I'll additionally **reconstruct the orbit/skip renders** via the `window.anchorPhrase` getter
(confirm oscillation vs arpeggiation, in-scale, in-window, deterministic).

## Out of scope (explicitly)
- Chromatic `color` rendering (still deferred). Live-audition wiring (editor/audition byte). Generators
  emitting the representation + candidate-store (L1d). Editor/UI (L2+). Other players.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: orbit oscillates / skip arpeggiates (one line each on
behavior), unit spec green (and that fill/approach/detour are unchanged), smoke unchanged; whether you extended
the demo phrase.
