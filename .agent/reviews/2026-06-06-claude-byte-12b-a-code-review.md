# Claude Review: Grow Byte 12b-a (Song Sketch Derives From Song Material)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed commit:** `4e30d5a Make song sketch derive from song material` on branch `codex/byte-12b-a`
**Base:** `main` at `1b24a0f`
**Review branch:** `claude/byte-12b-a-code-review`

## Verdict

**Approved - merge `codex/byte-12b-a`.** No required fixes. This implements the 12b-a plan precisely and a
bit better than asked: the sketch is now genuinely song-material-deep (chord roots derived from each song's
bass onsets, per-player density from active slots), it keeps a clean `rootDegrees` provenance layer
alongside the rendered roman roots, the chord vocabulary is a single canonical roman form with
**computed** accidentals (so it is mode-robust, not a hardcoded flat-seven), and `currentBeat` is correctly
isolated to `createdAtBeat` behind a content memo. Verified live that all three songs now produce materially
different sketches with correct roman resolution. Build/audit/diff green; smoke **16/16** with exactly the
provenance + cross-song + directional-invariant coverage I recommended (no prose pinning). Findings are
minor/forward only.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **16/16**; `git diff --check` -> clean.
- **Live (real app, preview), sketches are now distinct and musically honest:**
  - Lantern: gather `I-V` (deg 0,4) / answer `bVII-V` (6,4); loop 8; melody density 0.56.
  - Switchback: gather `I-bVII` (0,6) / answer `V-VI` (4,5); **loop 6** (its short syncopated loop); density 0.58.
  - Glass: gather `I` (0) / answer `IV-bVII` (3,6); loop 8; **melody density 0.31** (sparsest), bass 0.38.
  - **Roman accidentals resolve correctly across degrees/mode** (C mixolydian): `bVII`=Bb, `V`=G, `VI`=A
    (natural), `IV`=F, `I`=C. The degree->semitone vs major-scale-interval computation is right.
  - Each section's `rootDegrees` is a subset of that song's actual bass pattern degrees (provenance holds).

## Answers to your five review-focus questions

1. **`chordPlan` roman roots + `rootDegrees` structured provenance - right split?** Yes. `rootDegrees`
   (integers) is the key/transposition-independent source of truth and the right thing for smoke to assert
   against; `chordPlan` is the rendered roman projection; the inspector further resolves to note names
   (`I(C)-V(G)`). Three legible layers, each derivable from the one below it. The roman string is mildly
   redundant with `rootDegrees + tonalContext` (it could be recomputed on demand), but storing it is a
   reasonable convenience and keeps the inspector and any future reader cheap. Good split.
2. **Bass-pattern root derivation small and robust enough?** Yes - first-half / second-half of the bass
   loop, unique-in-order, capped at 4, with a frequency-based fallback (then `[0]`) when a half is empty.
   Verified across all three songs. Two small notes (below): the harmonic source is keyed by the literal
   `playerId "bass"` rather than the bass *role*, and the section split uses the bass loop length while the
   section `durationBeats` uses the global max loop length - both are fine for the current roster/material
   but are latent seams.
3. **`density` on assignments - useful structured surface or too much type growth?** Useful, not too much -
   it is a single derived number, exposed structurally so smoke can assert it (the Glass < Lantern melody-
   density invariant) without parsing briefs, and it feeds the brief text. Right call.
4. **Memoization boundary right before proposal/response lands?** Yes - content is cached by
   `(songId, tonic, mode, scale, roster)` and only `createdAtBeat` is patched per call from `currentBeat`
   (base built with `currentBeat: 0`). That is exactly the pure-content / live-metadata split I suggested,
   and it removes the 12a per-frame rebuild. One latent caution: the returned sketch is a **shallow** copy
   of the cached base, so its nested `sections`/`assignments`/`tonalContext` arrays are shared references
   with the cache - harmless today because the sketch is inspect-only and never mutated by any consumer, but
   if a future proposal/response path ever mutates a returned sketch in place it would corrupt the cache.
   Worth a one-line comment, or deep-freeze/clone when mutation becomes possible.
5. **Stayed inspect-only, no hidden path into playback?** Confirmed. `song-sketch.ts` imports only types and
   is a pure read-only analysis of `patterns` (it copies onsets, never mutates the shared `SONG_MATERIALS`
   arrays the scheduler also reads). `main.ts` reads `world.getTonalContext()`/`getPlayers()`/
   `getSongMaterial()` read-only; the memo cache is render-side module state consumed only by
   `renderSongSketch` (DOM) and `window.song.getSketch()`. Nothing touches transport, lookahead,
   slow-thinking, validators, Ollama, or persistence.

## Findings

No required fixes. Minor/forward only.

### Minor (low) - harmonic source is keyed by the literal playerId `"bass"`, not the bass role
`createSectionRootPlans` does `analysis.byPlayer.get("bass")`, while assignments are built from
`player.role`. For the current roster (`pulse`/`bass`/`melody`) this is identical, but it couples the chord
derivation to a specific id. If a future song/roster names its harmonic anchor differently (or has no
`bass` id), the plan silently falls back to the frequency heuristic. Prefer resolving the bass-*role*
player's id from the roster and looking that up, so the harmonic source tracks the role rather than a string.
Low priority; the fallback keeps it safe.

### Minor (low) - section split vs section duration use different loop lengths
The chord split point is the **bass** loop length / 2 (`bassSummary.loopLengthBeats / 2`), while each
section's `durationBeats` is the **global max** loop length (`analysis.loopLengthBeats`). They coincide for
all three current songs (bass is the longest loop, 8 or 6), so there is no visible divergence - but if a
song ever had a melody loop longer than its bass loop, the chord split and the displayed section length
would describe slightly different spans. Not a correctness bug (roots are derived from bass onsets either
way), just a conceptual seam to keep in mind when sections become more than a two-part overlay.

### Observation (good) - sections remain an honest overlay
Glass's gather is a single `I` (only one bass onset before the 2-beat split), which reads as a genuinely
spacious opening rather than a fabricated multi-chord section. This is the right restraint: the byte
proposes a two-part overlay over a one-loop song and lets sparse material produce sparse sections, instead
of inventing structure. Good.

## Merge + next slice

- **Merge `codex/byte-12b-a`.** It is the song-material-deep upgrade the 12a review asked for, verified live
  across all three songs, mode-robust, well-tested, and strictly inspect-only.
- **Next (your 12b/later):** the mock band **proposal/response** object can now sit on a meaningfully
  per-song draft. Keep it inspect-only/validated and behind the "does not drive playback" line; when a
  proposal can be *edited/returned*, that is the moment to revisit the shallow-cache caution (#4) and to
  decide whether `chordPlan` should be recomputed-on-demand vs stored.
- **Still open from prior bytes:** record grid-vs-performed pitch structurally for the eventual replay byte
  (11c-a); fold the rehearsal gate into `SESSION_MODE_POLICIES`; true material injection must move
  application to the commit/lookahead path. Validator + mock fallback stay in front of all.

## Blockers before the next byte

None.
