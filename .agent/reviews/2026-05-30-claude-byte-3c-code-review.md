# Claude Review: Grow Byte 3c (Visible Flash + Tonal Wiring)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-30
**Reviewed commit:** `480d2bc Implement Byte 3c visible flash and tonal wiring` on `main`
**Review branch:** `claude/byte-3c-code-review`

## Verdict

**Approve.** No required fixes before Byte 4. This byte cleanly closes the Byte 3b visible-flash
gap and resolves both of my Byte 3b structural findings (shared window constant; tonal context now
authoritative for played pitches). The trio stays deterministic, C mixolydian output is preserved
exactly, and lifecycle is intact. Findings are all minor/forward-looking.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> 1 passed; `git diff --check` -> clean.
- Live browser probe (`window.transport` / `window.listening`):
  - **C mixolydian preserved exactly:** pulse `C2`; bass `C2/G1/Bb1`; melody `C4/D4/E4/G4/A4/Bb4` -
    identical to the Byte 3 hardcoded pitches; every event in-scale.
  - **Lifecycle clean:** 3 sequences while playing, 0 after stop, ledger clears after the rAF
    settles, and **no event accumulation across 3 restart cycles** (3 scheduled / 0 stopped each).
  - **Posture still stable:** only state observed while playing was `performing,performing,performing`
    - the flash did not reintroduce flicker (flash is on the halo child; posture is on the container).
  - Inspector shows "root pulse" and "Mode: C mixolydian".

## Findings (ordered by severity)

### Low (nit) - `TonalContext` type lives in `listening.ts` while its default + helper live in `tonal-context.ts`

`tonal-context.ts:1` imports `type { TonalContext } from "./listening"`, then defines
`DEFAULT_TONAL_CONTEXT` and `noteFromScaleDegree`. The type's natural home is the tonal module. It
works and is not circular (listening.ts has no import from tonal-context.ts), but the placement is
slightly inverted. Consider moving the `TonalContext` interface into `tonal-context.ts` and importing
it from there in `listening.ts`. Cosmetic.

### Low (forward-looking) - tonal context binds to the transport only at `initTransport` time

`transport.ts` sets `activeTonalContext` once in `initTransport` (`main.ts` passes
`world.getTonalContext()`), and `buildPlayerPatterns(activeTonalContext)` runs at `startTransport`.
A runtime key/mode change (Byte 4 "make it brighter") won't take effect without re-init/re-start and
re-materialization. Correct for a deterministic byte; flagging as the next wiring step so Byte 4 can
re-materialize patterns when the world's tonal context changes.

### Nit

- `BPM` / `BEATS_PER_BAR` / `BEAT_SNAP` still live in `transport.ts` while the recent-activity window
  moved to `music-time.ts`. Fine (they're transport-internal); if `music-time.ts` is meant as the
  home for shared timing constants, these could join it later. No action now.
- Halo baseline alpha is now `0.64` globally (`HALO_RESTING_ALPHA`), so resting halos read a touch
  dimmer than in Byte 3b; this is the intended trade to give the flash headroom. Just noting the
  at-rest appearance changed slightly.

## Answers to the six review questions

1. **Is the note-on flash visibly legible without reintroducing posture flicker?** Yes. The flash now
   ramps halo alpha `0.64 -> 1.0` (within Pixi's `[0,1]` clamp) *and* halo scale `1.0 -> 1.34`
   (`terrarium.ts:85-87`), decaying over 180ms. The 34% scale bump is geometrically guaranteed visible
   regardless of alpha subtleties. It targets the halo child, independent of the container's posture
   alpha/scale, so posture stayed stable in live sampling (no flicker). (A 180ms transient can't be
   reliably frozen in a screenshot, but the mechanism is now sound and in-range.)
2. **Did the shared 8-beat constant land in the right place?** Yes. `RECENT_ACTIVITY_WINDOW_BEATS` in
   `music-time.ts`, consumed by both `listening.ts` and `world-state.ts` - the Byte 3b duplicate is
   gone, and the name is clearer than `POSTURE_WINDOW_BEATS`. No reorg needed before Byte 4.
3. **Is the tonal wiring the right amount for now?** Yes - this is the right altitude. Pattern data
   stores `scaleDegree`/`octave`, materialized into note names via `noteFromScaleDegree` from
   `GrowWorldState.tonalContext.scale`. It makes tonal context authoritative without building a
   composition engine. `noteFromScaleDegree` correctly handles octave wrap and negative degrees.
4. **Did the pitch change preserve C mixolydian by default?** Yes - verified live: exact same pitches
   as Byte 3 across all three players. The `C2 beat -> root pulse` label change is a good decoupling
   of the UI from a hardcoded key.
5. **Preserved Byte 3b lifecycle (3 sequences, none after stop, no duplicate events)?** Yes - verified
   across 3 restart cycles: 3 scheduled while playing, 0 after stop, ledger cleared, no accumulation.
6. **Is the Playwright pitch-class assertion useful, or too weak/coupled?** Well-judged. Asserting
   every event's pitch class is in `tonalContext.scale` tests the new in-scale contract without pinning
   exact pitches (which would be brittle and over-coupled to the pattern). The regex
   `replace(/[0-9-]+$/, "")` correctly strips octave/negative suffixes. Good middle ground; the
   grid-snap assertion still complements it.

## Required fixes before Byte 4

None. The flash gap is closed and both Byte 3b structural findings are resolved. Ready for Byte 4
(subjective taste), with the note that runtime tonal-context changes will need pattern
re-materialization (Finding #2).

## Optional improvements / creative drift

- When Byte 4 lets the producer change mode, re-materialize patterns on tonal-context change so the
  whole ensemble transposes from one source of truth (the wiring is now in place for this).
- Velocity -> flash intensity (brighter/larger bump for louder hits) would make the now-visible flash
  carry musical information, not just timing.
- A role-colored event sparkline in the Listening panel remains a cheap "make the frame felt" win.
