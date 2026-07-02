From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Byte E2 ready for review - bass answer tension/color

Branch: `codex/byte-e2-tension-color`
Base: stacked on the Byte E1 branch (`codex/byte-e1-interplay`) after Arne confirmed `Bass answers melody ON` is better by ear.
Commit: see relay/final response for the exact SHA after commit creation.

What changed:

- Added pure `src/harmonic-color.ts`.
  - Labels answer notes against the current chord root as root/third/fifth/non-chord.
  - Adds bounded deterministic `chromaticOffset` in the closed set `-1 | 0 | 1`.
  - Low-tension verse answers stay diatonic.
  - High-tension non-landing answer notes get one outside-scale lean.
  - Final landings resolve with no chromatic offset.
- Extended `PatternNoteSource` with optional `chromaticOffset`.
  - This is only a materialization hint; integer `scaleDegree` remains the motif/interplay contract.
  - `noteFromScaleDegreeWithOffset()` resolves the final pitch in `transport.materializeNote()`.
- Integrated color only through the existing E1 bass answer writer.
  - No new scheduler/audio path.
  - Bass answers still enter via `bassPhrasing -> buildPlayerPatterns() -> refreshLookaheadSchedule()`.
  - Answer tags now include `interplay-color:*`, `interplay-harmony:*`, and `interplay-chromatic:+/-1` when rendered outside the mode.
  - `window.interplay.getState()` now includes per-answer `colors` and `chromaticNoteCount`.
- Moved the listening experiment UI into the stage as an overlay.
  - Same switch, feedback controls, instructions, and test ids.
  - Prevents the experiment strip from shrinking the terrarium canvas below the app-shell smoke threshold.
- Added a follow-up `Answer color` A/B switch after Arne heard the new color but wanted to compare against the same answer without relying on memory.
  - `Bass answers melody` still controls whether answers exist.
  - `Answer color` controls only chromatic offsets on those same answer degrees.
  - `window.interplay.setColorEnabled()` mirrors the visible switch.
  - `song.interplay_color_toggled` records the experiment state without training or changing music.

Validation:

- `npm run build` green.
- `npm run unit:harmonic-color` green, 4/4.
- `npm run unit:motif-memory` green, 7/7.
- Focused interplay smoke green; it waits for the chorus answer and asserts a rendered bass answer pitch outside the current mode scale.
- Updated focused interplay smoke also replays the same chorus answer with color off and asserts the same answer degrees produce no chromatic tags and only in-scale answer pitches.
- App-shell smoke green after the stage-overlay move.
- Full `npm run smoke` green, 79/79.
- `git diff --check` green.
- `npm audit` still reports the existing esbuild low and Vite high advisories; I did not patch dependencies inside this musical byte.

Review focus:

- Listen A/B with the switch. The expected audible change is not a new chord engine yet: the chorus bass answer should briefly lean blue/sour outside the mode and then settle, while the verse answer remains cleaner/diatonic.
- Use the separate `Answer color` switch for the direct comparison Arne requested: answer on/color on vs answer on/color off.
- Confirm `chromaticOffset` does not become a raw-pitch backdoor. Motif variation should still be provable from integer degrees, and transport should remain the sole pitch resolver.
- Confirm E2 did not land chord voicings, vote training, surprisal/corpus ear, persistence of answers, pulse interplay, or evolution re-aim early.
