# Claude Review: Grow Byte 10e-v (Visual Heat)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `af7f9f2 Implement Byte 10e visual heat` (head `455f496`) on `main`
**Review branch:** `claude/byte-10e-v-code-review`

## Verdict

**Approved.** No required fixes. This makes the agitation/contagion heat *visible* - exactly the "let
the human see the build before they hear it" idea - and it does so as a clean, read-only visual layer:
the listening frame is the only heat source, nothing reads heat back into behavior, and the note-on
flash keeps full headroom on top of the contagion halo. Verified live that heat tracks the frame, is
bounded, is disposition-differentiated (the steady pulse runs visibly cooler than the responsive
melody), resets on stop, and leaves playback untouched. Findings are feel observations only.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **8/8 passed**; `git diff --check` -> clean.
- Live probe (`window.terrarium.getVisualState()` + transport):
  - **Heat math exact:** playing agitation `0.491` -> `roomWarmthAlpha 0.079` (= agitation * 0.16, matched);
    per-player `haloAlpha = 0.64 + contagion*0.28` and `haloScale = 1 + contagion*0.18` confirmed against
    live values.
  - **Disposition differentiation is now on screen:** pulse contagion `0.324` (halo 0.731 / 1.058) vs
    melody `0.456` (halo 0.768 / 1.082) - the steady anchor's halo is visibly cooler/smaller than the
    responsive melody's. `melodyHotter: true`.
  - **Bounded:** halo alpha within [0,1], scale within [1,1.6]; room wash capped at 0.16 alpha.
  - **Reset on stop:** agitation, room warmth, and all contagion return to 0.
  - **Playback untouched:** `status playing`, `health healthy`, `pending 25`, 0 off-grid notes.
  - Screenshot: a subtle warm wash over the room plus heat halos - tasteful, not garish.

## Findings

No required fixes. Observations only.

### Observation (the flash-vs-heat question, well handled) - the flash keeps full scale headroom; only its alpha swing compresses
`applyHaloHeat` (`terrarium.ts:319`) composes heat and flash cleanly:
`haloAlpha = heatBaseAlpha + flashProgress * (1 - heatBaseAlpha)` and
`haloScale = 1 + contagion*0.18 + flashProgress*0.34`. Two consequences:
- The **alpha** flash always tops out at exactly 1.0 regardless of heat (the `(1 - heatBaseAlpha)` factor
  guarantees no clip), but its *swing* shrinks as contagion raises the baseline - at full contagion the
  baseline is 0.96, so the alpha pop is only ~0.04.
- The **scale** flash always adds a full +0.34 on top of the heat scale, unclamped - so the note-on hit
  keeps full scale headroom at any heat level.
Since the +0.34 scale pop is the geometrically-guaranteed-visible cue (per the Byte 3c flash review), the
flash stays legible even when its alpha contrast compresses under heat. So the flash is **not muddied** -
nicely done. The only thing to be aware of: at very high sustained contagion the flash reads almost
entirely through scale, not brightness. Acceptable by design.

### Observation (feel) - the room warmth is currently very subtle
At the trio's typical agitation (~0.49) the room wash sits at ~0.079 alpha (cap 0.16), which reads as a
faint warmth you have to look for (confirmed in the screenshot). That is a tasteful "don't overdo it"
default, and it pairs with the Byte 10e finding that agitation is density-led and modest. If you want the
heat build to be legible at a glance, the 0.16 cap (and/or the `PLAYER_HEAT_ALPHA_BUMP`) could go a bit
higher - purely a feel/tuning dial, not a defect.

### Forward (carried from 10e) - the visual is the perfect companion for closing the contagion loop
The heat visual is read-only and safe. When a future byte wires contagion into behavior (closing the
loop), this visual becomes the ideal tuning instrument: you can watch the heat build and tune the
build/release governor (ceiling + slow decay, not a hard clamp - as in the 10e note) so the *audible*
build matches the *visible* one. Closing the loop will land hardest precisely because the build is now
visible first.

## Answers to the review focus

1. **Visual-only (no audio/taste/transport/scheduling/lookahead/Ollama dependency on heat)?** Yes -
   verified: playback intact (0 off-grid, healthy/25); `setHeat` only mutates Pixi display objects;
   nothing reads `getVisualState()` back into behavior. The diff touches only `terrarium.ts`/`main.ts`
   (render + a read-only hook) and tests/docs.
2. **`terrarium.ts` heat state / overlay / halo / clamping / reset / `getVisualState`?** All correct.
   `TerrariumHeatState` is the input shape; the warm-room overlay is a full-rect orange at
   `agitation * 0.16`; halo alpha/scale add a contagion baseline with the flash on top; `clampUnit`
   guards NaN -> 0 and bounds [0,1]; heat resets to 0 when the frame goes cold on stop (verified);
   `getVisualState()` returns the current visual values read-only.
3. **`main.ts`: only source is the listening frame; `window.terrarium.getVisualState()` read-only/debug?**
   Yes - `createTerrariumHeatState(frame)` -> `setHeat` is the only path (frame agitation + per-player
   contagion), one-directional, and the window hook just returns `getVisualState()`.
4. **Smoke meaningful but not brittle?** Yes - it asserts bounds (halo alpha [0.64,1], scale [1,1.6]),
   presence (all players, room wash), and the rest->playing transition (agitation 0 -> >0), not exact
   visual values. Retuning the heat constants won't break it.
5. **Note-on flash still has headroom / not muddied by contagion halo heat?** Yes - full scale headroom
   preserved and alpha always reaches 1.0 (observation above).
6. **Docs?** README / implementation-plan / reproducible-aliveness / LOCAL_DEV_NOTES / PROJECT_LOG are all
   updated in the diff to describe the visual-heat layer; consistent with the implementation.

## Open questions / forward notes

- Decide whether to raise the room-warmth cap / halo bump for more at-a-glance legibility (feel dial).
- When contagion drives behavior, use the build/release governor and let this visual be the tuning guide.
- Ollama (carried, Arne's steer, still pending): switch the default model to `qwen3:4b-instruct-2507-q4_K_M`
  with structured/projected JSON (a JSON-schema `format`) - resolves the Byte 9b reasoning-model
  empty-content finding. The inspector still shows the `gemma4:31b` default, as expected (not yet wired).
