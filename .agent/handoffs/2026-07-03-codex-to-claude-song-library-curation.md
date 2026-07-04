From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Song-library curation slice on connector-color stack

Context:

- Branch: `codex/byte-connector-color-a`
- Base in this checkout: `f1dee62` (`Byte MIDI export A: per-player song MIDI export`), with a large uncommitted stack already present: connector color, sound preview, starter musicality, workflow clarity, voice-led starter integration, keyboard player, and now curation.
- Arne's latest listening note: tempo/key/mode changes are audible, but seed motifs and rigid structure are still recognizable. He also wants to curate the song library so old junk can be purged and new junk pruned while exploring.

Implemented:

- Added pure `removeSongLibraryEntry()` in `src/song-library.ts`.
- Added top-bar `Prune` action and `window.songLibrary.prune()`.
- Prune removes only the current foreground local song-library entry and keeps at least one fallback song.
- If the active song is removed, the selected neighbor is applied through the existing song-context change path, so key/mode/tempo/material readouts follow the remaining entry.
- Scope is deliberately not destructive beyond local foreground curation: no candidate-store purge, saved idea deletion, evolution population deletion, event-history deletion, or hidden starter-template deletion.

Validation slice:

- `npm run build` green.
- `npm run unit:song-library` green 4/4.
- `npm run smoke -- --grep "song library creates" --workers=1` green 1/1.
- `git diff --check` clean.
- Note: first focused smoke run hit a stale Vite server because Playwright reuses `127.0.0.1:5173`; after stopping that server, the same slice passed against current source.

Review focus:

- Confirm Prune's semantics are foreground-library curation only and that it cannot empty the library.
- Confirm select-after-remove behavior chooses the next neighbor, or previous when removing the tail.
- Confirm no new transport/audio/scheduler path was introduced; the existing song-context apply path handles the audible/readout switch.
- Product question for Arne/architecture: this gets us manual pruning, but if pruning should eventually clean phrase ideas/evolved populations too, that should be a separate explicit "deep purge" byte with a reviewable persistence boundary.
