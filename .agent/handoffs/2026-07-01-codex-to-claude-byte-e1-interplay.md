# Codex to Claude Byte E1 Handoff: Interplay MVP

From: Codex on `macbook-pro-m5`
To: Claude Code (architect/reviewer) on `mac-mini-pro-m4`
Relay: Arne, manual
Date: 2026-07-01
Branch: `codex/byte-e1-interplay`
Base: `origin/main` at `b2daca6c0173110a62319de79a29d92532045626`
Commit: see routing message / branch HEAD after commit

## Summary

Byte E1 is implemented as the first audible interplay slice. Generated starter/library songs now build a bass answer source from the melody's resolved previous-bar motifs. Hidden canned template songs remain default-off controls. The change is deliberately performance-time only: no persistence/schema, scorer, model, evolution, or new audio/scheduler path moved.

## Implementation Notes

- Added pure `src/motif-memory.ts`: bounded pool, `capture()`, `remember()`, `latest()`, deterministic `chooseVariationOp(seed, bar)`, `chordRootAtBar()`, and `vary()` for `quote`, `invert`, and `thin`. Output stays integer scale degrees.
- Exported `MODE_ROOT_CYCLES` from `src/song-starter-material.ts` so E1 derives tonic/contrast roots from the same mode-root vocabulary.
- Added `TransportHandlers.bassPhrasing` / `BassPhrasingInput` next to the existing melody phrasing hook. `buildPlayerPatterns()` resolves active melody source first, then lets bass receive an override pattern.
- In `src/main.ts`, generated songs build a full-form bass answer pattern from the resolved melody form using `arrangeSongFormPatternEvent()`; section tension (verse low, chorus high, bridge middle, blended with SongGoal section emphasis when present) controls answer density and register.
- Answer notes carry `interplay:bass-answer`, source/target bar, op, root, and degree tags. `song-form` lets only those answer notes bypass the old bass harmonic recolor, because E1 has already targeted the answer to the two-chord root.
- Added `window.interplay.getState()` and `setEnabled()`. State includes enabled/defaultEnabled/override, mode, bounded pool, all answer summaries, and lastAnswer. Generated starter songs default on; canned/base songs default off; explicit toggle overrides for A/B.

## Validation

- `npm run build` green.
- `npx playwright test --config=playwright.unit.config.ts` green: 51/51, including new `tests/motif-memory.unit.spec.ts`.
- Focused interplay smoke green.
- Full serial smoke green twice on non-clean store: `npm run smoke -- --workers=1` -> 79/79, then 79/79.
- `npm run db:smoke` green.
- `git diff --check` green.
- `npm audit` unchanged: known esbuild low and Vite high advisories remain.

## Review Focus

- Listen for the core claim: with interplay on, the bass should audibly answer the melody's previous bar; with interplay off, generated songs fall back to the starter bass.
- Confirm the relation through `window.interplay.getState()`: bar N melody motif -> `vary(motif, chooseVariationOp(seed, N), chordRootAtBar(N+1))` -> bass bar N+1. The smoke also asserts heard bass events carry the exact resulting degree tags.
- Confirm canned/base template songs are default-off controls.
- Confirm no new scheduler/audio path: answer material enters as a bass pattern source and changes apply through `refreshLookaheadSchedule()`.
- Carry forward for E2: chords/voicings/color/tension tones are still absent; E1 is a root target, not a harmony engine.

## Ear Note

Tool limitation: I cannot literally monitor the Mac speakers from this session. The testable musical claim is that the on-path bass notes in target bar 1 exactly match the pure variation of melody source bar 0, and chorus answers become denser/higher than verse answers; Arne/Claude should do the final by-ear A/B on the toggle.
