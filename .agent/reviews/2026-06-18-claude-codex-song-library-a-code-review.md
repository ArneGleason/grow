# Claude Review: Song Library + active starter material (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-18
**Reviewed commit:** `b2daca6` on `origin/codex/byte-song-library-a` (sha confirmed)
**Base:** `origin/main` `4c271e8` (verified ancestor — fast-forwardable)
**Review branch:** `claude/codex-song-library-a-code-review`

## Verdict

**Approved — fast-forward merge `codex/byte-song-library-a`.** A big, well-integrated arc (~2000 lines) that
moves the app from exposed canned songs to a user song library, and — the part that matters most — makes
starter songs drive **real active `SongMaterial`**: a deterministic 4-bar phrase pack with moving harmony, a
walking bass, a varied pulse, and the prosodic melody. It's **in-scale by construction, transport-safe, and the
default canned fallback is intact.** Gauntlet: **build 0 · 6 unit suites · db:smoke 0 · diff clean · smoke
78/78** · audit unchanged. **Live-verified end to end.**

## Focus-point confirmations (code + live)

1. **Starter material is real and breaks the 2-bar loop (at least somewhat).** Live: creating a starter (prompt
   → generate → create) yielded `Switchback starter` active material spanning **16 beats** with **moving roots
   per bar `[0, 0, 4, 6]`** (mode-aware `MODE_ROOT_CYCLES`), a **16-note walking bass** (roots + fifths +
   diatonic approach tones, octave-climbing), a **9-hit pulse** (downbeats + backbeats/syncs), and a **19-note
   prosodic melody** — vs the canned default's 1-note pulse / 4-note bass / 9-note melody. Honest framing: it's
   deterministic keyword material, not composed structure — but it's a clear step up. ✓
2. **In-scale by construction.** `song-starter-material.ts` only ever emits integer `scaleDegree`s (normalized;
   high/negative degrees wrap in-scale via `noteFromScaleDegree`); melody reuses `generateProsodicMelody`. Live:
   `allInScale: true` for pulse/bass/melody. ✓
3. **Deterministic + bounded.** Seeded (`materialSeed` / FNV hash); all variation from seed bits + goal params,
   no RNG; 16-beat pattern; velocities clamped. ✓
4. **Transport-safe — no new scheduling/audio path.** `transport.ts` adds an optional `songMaterial` handler;
   `getActiveSongMaterial = handlers.songMaterial?.() ?? getSongMaterial(songId)`. `buildPlayerPatterns`,
   `arrangeSongFormPatternEvent`, and `getState().harmony` now read `getActiveSongMaterial` — the **same**
   `buildPlayerPatterns → getPatternStep → materializeNote → lookahead` path, just sourced from active material.
   No new audio path. ✓
5. **Default fallback intact.** Live: the untitled song (`baseSongId: lantern`, no starter) plays the **canned**
   Lantern material; the transport `?? getSongMaterial` is a second safety net. ✓
6. **Sketch / form-score / harmony read active material.** `getState().harmony` + song-form arrangement use
   `getActiveSongMaterial()`, so inspectors describe what's heard, not stale hidden templates. ✓

## Findings (non-blocking — accurate carry-forwards Codex flagged)

- **Deterministic keyword material, not Ollama-composed** song structure. (Expected for this arc; the next
  bigger musical problem.)
- **Player checkboxes gate material presence** per player (disabled → silent), but aren't a live runtime roster.
- **Harmonic / tempo / form evolution over time** remains the next real musical frontier (this is a static
  4-bar pack per song, not an evolving arrangement).
- Bass occasionally climbs into octave-crossing degrees (8, 10) — in-scale + deterministic; a voicing nuance,
  not a defect.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. Mergeable as the wrap-up of the Song Library arc. Cleared to pivot to the next, bolder musical hypothesis
(harmonic/tempo/form evolution over time looks like the highest-value frontier).
