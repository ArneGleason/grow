# Claude Review: Grow Byte 5 (Lookahead Buffer)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `6a8a730 Implement Byte 5 lookahead buffer` on `main`
**Review branch:** `claude/byte-5-code-review`

## Verdict

**Approve.** No required fixes before Byte 6. The one-shot lookahead queue is a clean, well-bounded
first representation of the delayed-now model, the Tone lifecycle cleanup is solid (verified at the
behavior level, not just the bookkeeping), event timing stays exactly on the half-beat grid, and the
taste/rest semantics survived the rework intact. Findings are all low / naming / forward-looking.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **3/3 passed**; `git diff --check` -> clean.
- Live browser probe (`window.transport` / `window.listening` / `window.taste`):
  - **No scheduling leak (behavior-level, instance-independent):** after **8 rapid start/stop cycles**
    then ~9 beats of play, **0 duplicate `(playerId, absoluteBeat)` slots** and **pulse fires exactly
    1x/beat** (a leaked/orphaned scheduler would double-fire). App pending count returns to **0** after
    every stop.
  - **Lookahead steady-state healthy:** lead oscillates ~7.3-8.0 beats (refills toward the 8 target each
    250ms), `scheduledThroughBeat` advances, ~25 pending items, well under the 40 cap.
  - **Health model behaves:** `healthy` from the first sample (the immediate pre-fill avoids a spurious
    `empty`/`thin` at startup); `stopped` after stop.
  - **Grid timing exact:** 0 off-grid notes; emitted `absoluteBeat` stays on the half-beat grid.
  - **Rests clean:** rest events carry `pitch: undefined` and `velocity: 0`, excluded from
    sound/flash/density/silence/posture.
  - **Posture stable** (`performing,performing,performing`); in-scale preserved; melody held-action
    summary observed ("Holding contrast for phrasing before rest.").

Note on method: a direct read of the Tone transport's internal timeline was unreliable here - a
dynamic `import('/node_modules/.vite/deps/tone.js')` resolves a *separate* Tone module instance from
the app's `import("tone")` (Vite serves deps with a `?v=hash` query), so its transport showed
`state: stopped, bpm: 120` while the app played. The leak check above is therefore behavior-level
(duplicate-slot / per-beat-rate), which is instance-independent and the ground truth.

## Findings (ordered by severity)

### Low (naming, answers focus #6) - `scheduledEventCount` meaning shifted and now duplicates `scheduledItemCount`
`transport.ts:602` exposes top-level `scheduledEventCount` and `getLookaheadState` exposes
`lookahead.scheduledItemCount`; both equal `scheduledEventIds.size` (the smoke even asserts they are
equal). Two names for one number. Also, `scheduledEventCount`'s meaning silently changed from "number
of repeating sequencers (was always 3)" to "pending one-shot slots (~15-30, fluctuating)". Any reader
or tool carrying the old mental model will be misled. Before Byte 6 adds session-mode state, consider
consolidating to a single field and/or renaming to something like `pendingScheduledNotes`.
Relatedly, the status line shows `buffer healthy 7.6/8 ... scheduled 25` while the Listening panel
shows `Events 25` - two different 25s (pending one-shots vs recent recorded events in the window) that
can read as the same quantity. Disambiguating those labels now will save confusion in Byte 6.
(Also minor: the status line/health use "buffer" while the inspector section is titled "Lookahead" -
pick one term.)

### Low (forward) - the lookahead scheduler is driven by wall-clock `setInterval`
`transport.ts:498` drives refills with `setInterval(250ms)`. Browsers throttle (and some pause)
background-tab timers. With an 8-beat (~5.3s) lead it tolerates moderate throttling, and the failure
mode is safe: the catch-up branch (`transport.ts:478`) skips past-due grid beats rather than
duplicating, already-scheduled notes still fire on Tone's independent audio clock, and the health
readout surfaces the drain as `thin`/`empty`. So a backgrounded tab would drain the buffer and drop
*new* notes for a few seconds, then recover on foreground - acceptable for Byte 5, worth knowing as
the scheduler matures.

### Low (forward, carried) - lookahead commits pitch/timing ahead but the rest/velocity decision is still live
The one-shot captures the pattern `note` (pitch/duration/velocity) and `snapshot` (timing) at
schedule time, but calls `handlers.noteDecision` (taste) at *fire* time (`transport.ts:419`). So the
delayed-now "commitment" is currently partial: timing and pitch are committed up to 8 beats ahead, but
play/rest/velocity is decided at the audible moment. That is a sensible split for a deterministic byte
(taste stays responsive), and the `scheduledItemCount` correctly counts potential notes including ones
that may become rests. Worth flagging only because the stated direction is "commit future material then
perform it later" - the fuller commitment (deciding rest at schedule time, or letting players revise a
committed queue) is a later step, not this one.

## Answers to the six review questions

1. **Is the one-shot lookahead queue a good first representation of delayed-now?** Yes. Replacing three
   long-lived `Tone.Sequence` objects with a 250ms scheduler that fills an 8-beat queue of one-shots is
   the right shape: it makes "scheduled-through beat" and "lead" concrete and inspectable, and it is the
   natural seat for future per-player committed material. `nextScheduleBeat` advances monotonically so
   no grid beat is scheduled twice.
2. **Tone lifecycle cleanup - dangling interval / orphaned events / accumulation?** Clean. `stopTransport`
   sets `status="stopped"` first (so any in-flight one-shot returns early), clears the interval, clears
   each pending event via `transport.clear(eventId)`, then `transport.cancel(0)` as a belt-and-suspenders
   sweep, and resets bookkeeping. The start guard blocks double-start. Behavior-level check across 8
   rapid cycles: no duplicate slots, exactly 1 pulse/beat, pending count -> 0. No leak.
3. **Event timing exact for replay foundations?** Yes - 0 off-grid notes; the single snapshot (snapped
   to the 1/16 grid) drives both the scheduleOnce position and the emitted `absoluteBeat`, so they stay
   consistent and on the half-beat grid.
4. **Taste/rest semantics intact?** Yes - rests remain ledger events with `pitch: undefined` / velocity 0,
   produce no sound, no flash, and are excluded from active density/silence/mix and posture. Verified live.
5. **Is the buffer health model right-sized?** Yes. `stopped`/`empty`/`thin`/`healthy` with an 8-beat
   target and 4-beat minimum maps cleanly to the time-and-lookahead doc (2-bar target / 1-bar floor).
   Steady-state sits at `healthy` (~7.5-8 lead); `thin`/`empty` are reserved as genuine warning states
   for a stalled scheduler, which is the right semantics.
6. **UI/test naming that will confuse before Byte 6?** The `scheduledEventCount` / `scheduledItemCount`
   duplication and meaning-shift, the two "25"s (`scheduled` vs `Events`), and "buffer" vs "Lookahead"
   wording (Finding #1). Worth tidying before session modes add more state and more labels.

## Required fixes before Byte 6

None. Recommended (low effort): consolidate/rename the duplicated scheduled-count surface and
disambiguate the status-line vs listening "events"/"scheduled" labels (Finding #1) before Byte 6
session modes layer on more state.

## Optional improvements / creative drift

- Session modes (Byte 6) will want the buffer to *intentionally* drain (a break = let lead fall to
  `empty` and pause), so the existing `thin`/`empty` states are a natural hook - a break could be
  "stop refilling and let the queue run dry," which the health model already represents.
- Once players can think (Ollama later), the lookahead queue becomes the commit point: a player could
  revise or replace its not-yet-fired slots. Keeping the queue addressable per player/beat now would
  ease that.
- A small timeline strip showing scheduled-but-unplayed slots vs played events would make the
  delayed-now gap visible - the single most evocative way to *show* "the players are thinking ahead."
