# Claude Review: Grow Byte 13b-c2 (Musical-Event Persistence Payload + Buffer)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-07
**Reviewed commit:** `87f116d Define musical event persistence payload` on branch `codex/byte-13b-c2`
**Base:** `main` at `c33f785`
**Review branch:** `claude/byte-13b-c2-code-review`

## Verdict

**Approved - merge `codex/byte-13b-c2`.** No required fixes. This finally lands the grid-vs-performed pitch
split I have been tracking since 11c-a, as a clean schema-v1 `{grid, performed}` payload, plus a correct
fixed-capacity ring buffer with drop-oldest back-pressure and observable counters - and it stays entirely
unwired (the module is imported only by tests; the transport just sets two synchronous fields; nothing
touches SQLite or adds fetch/timer/DB work to a Tone callback). The payload carries everything replay needs
(grid truth + performed reality + `eventIndex` + stored expression/timing snapshots). db:smoke/build/audit/
diff green; app smoke **22/22**, including a real-audio assertion that a shifted note records grid octave 4
and performed octave 5.

## Validation performed

- `npm run db:smoke` -> green; `npm run build` -> clean; `npm audit` -> 0 vulns; `git diff --check` -> clean;
  `npm run smoke` -> **22/22**.
- **Unwired confirmed:** `grep` shows `musical-event-record` is imported only in `tests/grow.smoke.spec.ts`
  - not in `main.ts`, `transport.ts`, or any hot path. `PersistenceRecordType` gains
  `"musical.event_recorded"` but there is no app call site that records it. The new module is pure (payload
  builder + buffer class).
- **Transport wiring is correct:** `emitNoteEvent` now sets `gridPitch = note.pitch` (the committed
  deterministic pitch, **always**, even when suppressed), `performedPitch = shouldPlay ? performedPitch :
  undefined`, and keeps `pitch = performedPitch` as the alias. Verified live by the shift-register smoke
  (gridPitch ends "4", performedPitch/pitch end "5").

## Answers to your review-focus questions

1. **Is the grid/performed payload durable enough for replay?** Yes. `grid` holds the deterministic truth
   (`transportPosition`/`bar`/`beat`/`absoluteBeat` + grid pitch/pitchClass/octave/scaleDegree) and
   `performed` holds the audible reality (offset timing, `sounded`, `pitchChanged`, performed pitch fields,
   `registerShift`), and the payload also carries `eventIndex` and the full `expression`/`performedTiming`
   snapshots - so a ledger replay can reproduce the exact sound without recomputing anything (the 13a "don't
   recompute on replay" rule), while seek-and-continue has the `eventIndex` it needs to keep the deterministic
   generator going. This resolves my 11c-a note structurally: the register shift is now first-class
   (grid `E4` vs performed `E5`, plus an explicit `registerShift`), not recoverable only by tag-parsing. One
   small note: `scaleDegree` is derived from the tonal context *at record time* (`scale.indexOf`), which is a
   snapshot - fine, since the grid pitch string is the authoritative field and tonal context is constant
   today; just be aware the degree is contextual, not absolute.
2. **Is keeping `MusicalEvent.pitch` as the performed alias acceptable?** Yes. Listening/taste read `pitch`,
   and (a) `pitchVariety` uses pitch *class* (octave-stripped), so a register shift does not change it, and
   (b) any octave/brightness metric should reflect what is actually *heard*, which is the performed pitch -
   so performed is the correct value for `pitch`. Making `gridPitch`/`performedPitch` additive keeps every
   existing consumer working with no churn. The only cost is that `pitch` and `performedPitch` are now
   identical (mild redundancy); fine as a compatibility alias - consider deprecating `pitch` in favor of
   `performedPitch` once consumers migrate, but not now.
3. **Is drop-oldest the right first back-pressure policy?** Acceptable as a first policy, and importantly it
   is **observable** (`droppedCount`, `lastDroppedEventId`, `enqueuedCount`/`drainedCount`), which is the
   property that matters most. The thing to carry into the replay byte: *any* drop (oldest or newest) breaks
   contiguous-stream replay, so the eventual replay reader must treat a drop as an **explicit discontinuity**
   (detect via `droppedCount` and/or per-player `eventIndex`/`absoluteBeat` gaps), not assume contiguity -
   and you may want to persist a gap/discontinuity marker so the break is visible in SQLite, not only in the
   in-memory buffer state. The default capacity 256 (~10 s at realistic event rates) and configurability are
   reasonable; drop-oldest (keep the live tail, lose old history) is a defensible choice for a live terrarium
   as long as drops are surfaced.
4. **Does this byte avoid SQLite wiring and audio-callback fetch/timer/DB work?** Yes - confirmed by import
   grep and by reading the transport change (it only assigns two string fields synchronously). The buffer and
   payload builder are never invoked from `handleMusicalEvent` or any Tone callback in this byte.

## Findings

No required fixes. Forward notes for the wiring byte (13b-c).

### Forward (13b-c) - keep the audio-callback push minimal; decide where the payload is built
`handleMusicalEvent` runs on the Tone scheduler callback path, and `createMusicalEventRecordPayload` does
real (pure) work per event - two `describePitch` regex/`indexOf` passes, a tag scan, spreads, array copies.
That is CPU-only (no I/O), so building the payload in the callback is *acceptable*, but the cleanest pattern
is to make the callback do the absolute minimum - push the already-built `MusicalEvent` (plus a tonal-context
snapshot) into the ring, and let the **flusher** build the payload off the callback. Measure, and prefer
the minimal-callback shape; either way, the only hard rule (which this byte already respects) is no I/O in
the callback.

### Forward (13b-c) - define the ring <-> retry-queue interaction
This byte's ring buffer and the 13b-c1 persistence client's retained/retry queue are two different
back-pressure mechanisms. Decide explicitly: a batch the flusher `drain`s and then fails to POST should go
into the client's **idempotent retained queue** (13b-c1), *not* back into the ring (which would risk a second
drop and reordering). The idempotent `appendEvents` (skip-by-`sourceEventId`/client id) is what makes a
re-POST safe; make sure the persisted record's id is the stable `sourceEventId` so retries dedupe.

### Forward (13b-c) - stop/cleanup flush-or-discard, and seq semantics
On transport stop/cleanup, decide deliberately whether the ring is flushed or discarded, and assert it (it
currently has `clear()`, which is discard). Also note: the persisted `seq` (server-assigned per
session/branch) will be contiguous *on write*, so a dropped source event shows up as a gap in
`eventIndex`/`absoluteBeat` continuity, **not** as a `seq` gap - the replay reader should key continuity
checks off the source-stream fields, not the persisted `seq`.

## Merge + next slice

- **Merge `codex/byte-13b-c2`.** It is the right payload contract (resolves the 11c-a pitch split), a correct
  observable ring buffer, and safely unwired.
- **Byte 13b-c (wire it):** `handleMusicalEvent` -> synchronous ring enqueue (minimal callback work, no I/O);
  a separate timer/idle flusher that `drain`s and batches through the idempotent `appendEvents`; failed
  batches go to the retained/idempotent queue (not back to the ring); a deliberate stop/cleanup
  flush-or-discard; and tests proving (a) no `/api/persistence` fetch is initiated from inside a scheduler
  callback, (b) ordering/`eventIndex` continuity under high event rates, (c) drops are surfaced (inspector
  line + detectable discontinuity), and (d) stop behavior. Surface buffer `droppedCount`/`pendingCount` in
  the persistence inspector row.
- **Still open from prior bytes:** fold the rehearsal gate into `SESSION_MODE_POLICIES`; material injection
  must move to the commit/lookahead path; proposal-to-playback stays a bounded/reversible future byte on
  structured fields only. (The grid-vs-performed pitch split is now done - good to retire that one.)

## Blockers before the next byte

None.
