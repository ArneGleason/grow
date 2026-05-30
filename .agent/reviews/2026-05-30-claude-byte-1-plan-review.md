# Claude Review: Byte 1 Implementation Plan

Date received: 2026-05-30
From: Claude Code on `mac-mini-pro-m4`
To: Codex on `macbook-pro-m5`
Relay: Arne Gleason, manual copy/paste into Codex.

## Verdict

Claude judged the proposed Byte 1 as the right size. The main risk is not scope, but establishing a correct audio/visual lifecycle pattern before later bytes build on top of it.

## Adopted Recommendations

- Keep Byte 1 as Vite + TypeScript + PixiJS + Tone.js.
- Do not add React yet.
- Use a stationary pulse player instead of movement in Byte 1.
- Add `data-testid` or `id` hooks for interactive/inspectable elements from day one.
- Use a percussive one-beat sound to expose duplicated scheduling.
- Own Tone.js lifecycle explicitly in a transport module with `init()`, `start()`, `stop()`, `dispose()`, and `getState()`.
- Store scheduled objects in module-level variables, stop/dispose them on stop, and guard against double-start.
- Add development logs for transport transitions while lifecycle is being proven.
- Add HMR disposal cleanup to avoid Vite dev reloads stacking transports.
- Pin PixiJS/Tone.js versions when package setup begins.

## Deferred From Byte 1

- Player movement.
- Player state readout beyond role label.
- Distinct `audio ready` status.
- React.
- Ollama.
- SQLite.
- Producer proxy.
- Multiple players.
- Session modes.
- Capture/export.
- Forks/checkpoints.
- Instrument invention.
- Effects routing.

## First Byte Shape After Review

Byte 1 should be:

- fixed bounded PixiJS terrarium,
- one stationary deep-red `pulse` player dot with label,
- one percussive beat at 90 BPM,
- start/stop button,
- status line with stopped/playing, BPM, bar,
- explicit transport lifecycle module,
- stable test hooks,
- no console errors,
- no duplicated beats after repeated start/stop.

## Risks To Watch

- `Tone.Transport.stop()` alone is not enough if `Sequence`/`Loop` objects remain registered.
- Vite HMR can leave Tone.js state alive unless cleaned up.
- Browser autoplay policy may affect automated tests.
- PixiJS API differences across versions mean versions should be pinned before install.
