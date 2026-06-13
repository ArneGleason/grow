# Claude Review: Grow Byte 17b-a (SongGoal Setup Plumbing + Safe Keyword Matching)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `2cdcf89 Prepare SongGoal setup plumbing` on branch `codex/byte-17b-a`
**Base:** `main` (origin/main at review time)
**Review branch:** `claude/byte-17b-a-code-review`

## Verdict

**Approved - merge `codex/byte-17b-a`.** A clean, genuinely behavior-preserving plumbing slice that does
exactly what it claims: it makes tonal context + tempo *settable through handlers* without changing any of
today's behavior (still 90 BPM / C mixolydian), closes the substring false-positive class I flagged in 17a
with a whole-token/phrase matcher, and routes every display **and** scoring/derivation path through the
active tonal context so nothing will silently stay on C when 17b-b changes the key. The SongGoal still drives
nothing. Build/db:smoke/diff green; smoke **35/35**; `npm audit` = the known 2-high Vite/esbuild advisory,
unchanged.

## Focus-point confirmations

1. **Did the token/phrase matcher close the false-positive class without making useful phrases brittle?**
   Yes - proven with a probe. `hasKeyword` now tokenizes both text and keyword (`/[a-z0-9#]+/g`) and does a
   whole-token sliding-window match, so:
   - "I need to repair the chair on the stairs" -> **no cues** (no `air`); "a crunchy ground texture" ->
     **no cues** (no `run`). The class is closed.
   - Phrases still work: "a wide return with a long final chorus" -> `wide-return`; "driving urgent rush" ->
     tempo 120; "spacious and airy" -> `dub-space` (and `spacious` was added explicitly so it no longer
     leans on `space` matching inside it). The regression test pins `repair`/`crunch` not triggering
     `air`/`run`.
   - **Tradeoff worth naming (non-blocking):** whole-token matching also narrows *recall* on inflections -
     "drifting and dreamy" now matches nothing (`drifting` != `drift`, `dreamy` != `dream`), and `airy` no
     longer hits `air`. Precision-over-recall is the right call for an inspect-only baseline/fallback, but
     if recall matters once this drives setup in 17b-b, add the common inflected forms to the cue lists (or
     a light stemmer).
2. **Is `GrowWorldState.setTonalContext()` safe enough for 17b-b, especially clone behavior?** Yes. The
   context is now a mutable private field; the constructor, `getTonalContext()`, and `setTonalContext()` all
   pass through `cloneTonalContext` (`{...ctx, scale:[...ctx.scale]}`), which fully copies the only nested
   field. So no caller can mutate internal state via a held reference, and a future `setTonalContext` cannot
   be corrupted by aliasing. Safe.
3. **Is the transport tempo/context threading behavior-preserving today?** Yes. `BPM` -> exported
   `DEFAULT_TRANSPORT_BPM` (still 90); every former `BPM` site (`beatsToSeconds`, `getWallClockBeat`,
   `scheduleWallClockFallback`, `transport.bpm.value` in start, `getState().bpm`) now reads
   `getActiveTempoBpm()`, which resolves to the handler (`() => activeTempoBpm`, init 90) or the module
   default - i.e. **90 today**, with a `Number.isFinite && > 0 else DEFAULT` guard. `getPatternStep` now reads
   `getActiveTonalContext()` (handler -> `world.getTonalContext()`, C mixolydian) instead of the module
   snapshot - same values today. `grep` confirms **no `BPM` literal remains** in transport. The one new write
   - `refreshLookaheadSchedule` now sets `transport.bpm.value = getActiveTempoBpm()` - is value-identical
   today (90) and is the correct hook for 17b-b. 35/35 + the defaults confirm no behavior drift.
4. **Any stale `DEFAULT_TONAL_CONTEXT` / hardcoded C-mixolydian path that will bite in 17b-b?** No - this is
   the audit done thoroughly. The `DEFAULT_TONAL_CONTEXT` import is gone from `main.ts`; all four display
   paths (`formatMelodyScoreRoots`, `formatFormScoreSection`, `formatSongHarmony` x2) and the hardcoded
   `<dd>C mixolydian</dd>` (now `unknown`, filled on first render) read `world.getTonalContext()`.
   Critically, the **scoring/derivation** paths track it too: `getCurrentFormScore` (`tonalContext:
   world.getTonalContext()`), `getCurrentMelodyRepairTake` (`world.getTonalContext()`), and the listening
   frame all use the active context, and their cache keys include `tonic/mode/scale` so they recompute on a
   key change. The only remaining `DEFAULT_TONAL_CONTEXT` references are legitimate defaults (the definition,
   the world constructor default, the transport-init fallback). So when 17b-b calls `setTonalContext`,
   display + form score + melody repair + materialization all move together - no path stays on C.
5. **Any timing risk from active tempo in wall-clock fallback / `beatsToSeconds()` before tempo changes
   apply?** Not today (everything is 90). For 17b-b the important correctness note is below - it is about
   *how* the change is applied, not a defect here.

## The 17b-b correctness note (carry this into the next byte)

A tempo or key change must be applied **through `refreshLookaheadSchedule` (or a stop->start)**, not by
flipping `activeTempoBpm` / calling `setTonalContext` alone while playing. `getActiveTempoBpm()` /
`getActiveTonalContext()` are read *live*, so if you mutate them without a refresh, already-committed
in-flight material (scheduled in old-tempo seconds, materialized in the old context) keeps its old timing/key
while only new material changes - an audible seam. `refreshLookaheadSchedule` does the right things: it
re-sets `transport.bpm.value`, clears `scheduledEventIds` (via `transport.clear`), rebuilds `activePatterns`
(so `getPatternStep` picks up the new context live), and resets the committed-index/expression/timing maps -
so routing changes through it is clean.

One tidiness sub-note: `refreshLookaheadSchedule` does **not** `clearTimeout` the `wallClockFallbackTimers`
(only `disposeLookaheadSchedule` does). This is **safe** because the fallback handler guards with
`scheduledEventIds.has(eventId)` (16a) and self-deletes, so stale-tempo timers fire as inert no-ops. But
since 17b-b will change tempo via refresh, consider also clearing `wallClockFallbackTimers` in
`refreshLookaheadSchedule` so no old-tempo timer lingers until it fires - belt and suspenders.

## Findings (all non-blocking)

- **Recall narrowed on inflections** (focus 1) - add inflected cue forms or a light stemmer if recall matters
  when the interpreter drives setup.
- **`matchedKeywords` has cosmetic duplicates** - it pushes once per scanning pass, so a word like `spacious`
  appears 3x and the inspector's "N cues" count is inflated. Dedupe for polish.
- **`getTonalContext()` now clones on every call**, including the per-step transport handler path used in
  `getPatternStep`. The clone is tiny (one object + a ~7-element array) and this runs off the audio callback
  (lookahead scheduling), so the allocation is negligible - noting only for completeness.
- Carry-forward (unchanged): fallback `status` check + dev-flag gating (16a); Vite 8 / esbuild advisory;
  dead `MusicalEventRecordBuffer`; consensus-affinity-from-disposition.

## On verification approach

Behavior-preserving plumbing, so I verified by: reading the full diff; `grep`-proving no `BPM` literal and no
stale `DEFAULT_TONAL_CONTEXT` display/derivation path remain (only legit defaults); confirming the four
display + the form-score + melody-repair + listening paths all read `world.getTonalContext()` with
context-aware caches; a token-matcher probe proving the false-positive class is closed and the phrase/recall
behavior; and 35/35 incl. the new `repair`/`crunch` regression. The defaults make today's values identical to
prior (90 / C mixolydian), so no live audio capture was needed (it would only re-confirm unchanged playback).

## Merge + next slice

- **Merge `codex/byte-17b-a`.** The plumbing is in place, behavior is preserved, the matcher is precise, and
  the tonal-context audit is complete - 17b-b can change key/tempo/form knowing every consumer tracks it.
- **Next: Byte 17b-b** - explicit Apply/Audition Goal Setup. Apply validated setup fields via
  `setTonalContext` + active tempo + form preference **through `refreshLookaheadSchedule`** at a setup
  boundary; persist `song.goal_set`. Keep **measure-before-drive** (audition, do not silently impose), clear
  `wallClockFallbackTimers` on the refresh for tidiness, and consider adding inflected cue forms.

## Blockers before the next byte

None.
