# Claude Review: Grow Byte 16a (Audible Harmonic Motion)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-12
**Reviewed commit:** `1f89aa3 Add audible harmonic motion` on branch `codex/byte-16a`
**Base:** `main` at `13674d2`
**Review branch:** `claude/byte-16a-code-review`

## Verdict

**Approved - merge `codex/byte-16a`.** The chorus/verse/bridge now have *audibly different, song-derived
harmony* (pulse plays the moving section root, bass plays a chord tone over it), committed through the
lookahead material path, all staying inside C mixolydian (modal-root-recolor - not a key change). And the
part Codex flagged for scrutiny - the new wall-clock fallback timer - is **safe against duplicate emission**,
verified empirically in the exact environment that exercises it. Build/audit/db:smoke/diff green; smoke
**28/28**. A few non-blocking notes below; the audit advisory is pre-existing and dev-only.

## The wall-clock fallback timer (the flagged risk) - clean

The duplicate-emission guard is correct, and I verified it where it actually fires (the preview clock stalls,
so the fallback path drove playback):

- **0 duplicate emissions across 191 live events** - `0` duplicate `(player, absoluteBeat)` pairs and `0`
  duplicate `sourceEventId`s. Each note fired exactly once even with the fallback active.
- **Mechanism is sound:** the shared `scheduledEventIds` set is the single "has this fired" source of truth.
  Whichever path fires first deletes the id and cancels the other - the Tone callback `clearWallClockFallback`s
  the timer; the fallback `transport.clear(eventId)`s the Tone event - and the fallback's
  `if (!scheduledEventIds.has(eventId)) return` blocks a double. Single-threaded JS, so no interleave.
- **Inert in real audio:** the fallback is scheduled ~250 ms *after* the note's wall-clock time, so when the
  audio clock runs normally the Tone callback always fires first and clears it. It only activates on a genuine
  audio-clock stall (headless/preview).
- **Torn down on lifecycle:** `disposeLookaheadSchedule` clears all fallback timers + scheduled events on
  stop/song-change/dispose. Verified live: **0 orphan emissions** in the 1.5 s after stop.

## Review-focus confirmations

- **Verse/chorus/bridge harmonic distinction (by "ear"/event stream):** confirmed. Live, pulse plays roots
  **C/G in the verse** and **G/Bb in the chorus**; bass chord tones differ too (E present in verse, F in
  chorus). The harmony is genuinely different per section because verse uses the `gather` root plan and
  chorus the `answer` plan, both derived from the song's bass.
- **Committed via lookahead, not fire-time:** confirmed - the recolor happens in `arrangeSongFormPatternEvent`
  (the same lookahead materialization path as the chorus melody), so pulse/bass roots are committed grid
  material (`grid==performed`), not a fire-time taste override.
- **In-scale (modal-root-recolor):** confirmed - **0 out-of-scale pitch classes** across all sounded events;
  every recolored pulse/bass note stays in C mixolydian. Roots move *within* the mode.
- **Melody coherence over moving roots:** coherent for 16a - everything is diatonic (in C mixolydian), so
  there are no clashes/wrong notes, and in fact the chorus melody hook (C/G/Bb-centered) overlaps the chorus
  `answer` roots (G/Bb) well because both derive from the same song's bass harmony. The real (mild) tension -
  the melody scorer (15a-c) lands chord tones against the *static* root plan while harmony now moves per bar -
  is correctly deferred to a chord-aware-scoring follow-up, not a 16a expansion.
- **Lifecycle safety (start/stop/song switch):** confirmed - no orphan emission after stop; harmony updates
  per song on switch (lantern roots `[0,4]`, glass `[0]`, switchback `[0,6]`, each from its own bass pattern).

## Notes (non-blocking)

- **Fallback handler lacks an explicit `status === "playing"` check.** The Tone callback has one; the fallback
  handler relies entirely on `scheduledEventIds` being cleared on stop/dispose (which I verified is safe - 0
  orphan emissions). For symmetry and cheap defense-in-depth, add `if (status !== "playing") return` at the
  top of the fallback timeout handler.
- **The fallback is a test/preview-environment workaround living in production transport code.** It is inert
  in real audio and the duplicate guard is solid, but it adds a second scheduling authority + a per-note
  `setTimeout` to the most critical path. Consider gating it behind a dev/headless flag (or at minimum
  documenting that it must remain inert in real playback) so it can never subtly affect real-audio timing
  later. It also slightly complicates the "Tone is the single scheduling authority" invariant - worth keeping
  an eye on.
- **`npm audit` now reports 2 high (esbuild, transitive via vite).** These are **dev-server** advisories
  (RCE via `NPM_CONFIG_REGISTRY` in a Deno module; arbitrary file read on the Windows dev server), **not
  introduced by 16a** (`package.json`/lock untouched), and the fix is a breaking jump to Vite 8. Reasonable to
  defer, but since it is now *high* severity, I would track a planned Vite 8 migration rather than deferring
  indefinitely.
- Carry-forward (unchanged): dead code `MusicalEventRecordBuffer`; consensus affinity table vs dispositions
  (15c-a note).

## Merge + next slice

- **Merge `codex/byte-16a`.** Audible, song-derived, in-scale harmonic motion, committed correctly, with a
  duplicate-safe fallback that is inert in real audio.
- **Next, your instinct is right:** **chord-aware melody scoring** - feed the moving section root into the
  melody scorer's landing/chord-tone checks so the chorus repair/consensus values notes that land on the
  *current* chord, not the static root. That closes the one mild tension this byte introduces and makes the
  melody and harmony actively reinforce each other. (And fold in the fallback `status` check + the Vite 8
  decision when convenient.)
- **Still open:** form-level scoring; section/slow-thought precedence; consensus-affinity-from-disposition.

## Blockers before the next byte

None.
