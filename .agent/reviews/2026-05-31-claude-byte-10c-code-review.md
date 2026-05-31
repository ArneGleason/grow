# Claude Review: Grow Byte 10c (Performed-Offset Data Model)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `991d393 Implement Byte 10c performed offset data` on `main`
**Review branch:** `claude/byte-10c-code-review`

## Verdict

**Approve.** No required fixes; **Byte 10d is ready** with no 10c cleanup needed. This resolves my Byte
10b forward notes exactly: a single canonical `eventIndex` is now assigned at schedule/commit time and
shared by velocity expression and performed timing; `performedOffsetBeats` is computed deterministically
at commit, bounded well under the grid spacing, and is genuinely data-only (the synth still fires at
`scheduledTime`). Grid truth is preserved and break/drain is, if anything, cleaner than before. Verified
all of this live.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **5/5 passed**; `git diff --check` -> clean.
- Live probe (two start/stop runs, reading `MusicalEvent` + transport state):
  - **Shared canonical index (the core 10c goal):** every event satisfies `eventIndex ===
    expression.eventIndex === performedTiming.eventIndex`.
  - **Bounded / no reorder risk:** 0 offsets exceeded their role max; max role bound is 0.035 beats vs a
    0.5-beat grid (and a 0.25-beat half-gap), so even worst-case opposite offsets on adjacent notes can't
    cross. Melody offsets varied within +/-0.03 (spread ~0.016).
  - **Grid unchanged / data-only:** 0 off-grid notes; the synth fires at `scheduledTime` and
    `performedOffsetBeats` never reaches `triggerAttackRelease`.
  - **Deterministic / replayable:** 38 `(playerId, eventIndex)` keys compared across two runs, 0 mismatches.
  - **Debug-surface temporal mismatch (expected):** `expression.latest` indexes {pulse 11, bass 11,
    melody 13} (just heard) vs `performedTiming.latest` {pulse 19, bass 19, melody 22} (committed ~8 ahead).

## Findings

No required fixes. Forward notes only.

### Low (review #6) - the two `latest` debug surfaces reflect different moments
`latestPerformedTimingByPlayer` is set in `commitScheduledNote` (schedule time, ~8 notes in the future),
while `latestExpressionByPlayer` is set in `triggerScheduledNote` (fire time, the just-heard note).
Verified live: the timing-latest index runs ~8 ahead of the expression-latest index. The *per-event*
index sharing is correct (and smoke-asserted); only the live `getState().*.latest` surfaces differ in
recency. Harmless, but a viewer comparing a player's `Dynamics` row (just played) and `Offset` row (next
committed) is looking at two different moments. Recommend labeling the inspector rows accordingly (e.g.
"Offset (next committed)" vs "Dynamics (just played)"), or capturing a "latest heard offset" at fire time
if you'd rather they align. Not blocking.

### Forward (10d) - guard the fire time when you start using the offset
When 10d fires at `scheduledTime + offset`: convert beats to seconds via BPM
(`offsetSeconds = performedOffsetBeats * 60 / BPM`), and **clamp the final fire time** so it can never
precede `now` (a negative/push offset on a note committed close to the current beat could otherwise land
in the past and fire immediately) nor cross a neighbor. Concretely: `fireTime = Math.max(now + epsilon,
scheduledTime + offsetSeconds)`. With today's tiny bounds (<=0.035 beat) and an ~8-beat lookahead this
never triggers in practice, but the guard makes a future bound increase safe by construction rather than
by luck.

### Forward (10d) - this is where difficulty becomes audible and caused
`durationPressure`/`velocityPressure` are mild seeds; the module is already shaped (`dispositionPressure`
exists, using disruption/steadiness/caution) for the full difficulty model. 10d should add leap size,
register jump, and local density, weighted through disposition - that is what makes "the player rushes the
hard leap" read as caused rather than decorative (`reproducible-aliveness.md` already names it). The
incommensurate timing periods here (40/13, 34/11, 29/7, 45/17, 48/19) correctly avoid the harmonic lock I
flagged on 10b's melody - good.

### Forward (persistence/checkpoint event-log path)
This byte gets the data shape right for the event log: `absoluteBeat` stays grid/listening/replay truth
and `performedOffsetBeats` is a separate performed-layer field on the event - exactly the grid-truth /
performed-truth split `reproducible-aliveness.md` calls for. **Replay-from-ledger is fully self-contained**
now: each event stores `eventIndex`, `performedOffsetBeats`, `performedTiming`, and `expression`, so a
re-render uses stored values rather than recomputing. The one thing a future **seek-to-checkpoint-and-
continue-generating** must capture is the generator state: per-player `committedEventIndexes` plus
`nextScheduleBeat`/`scheduledThroughBeat`, so committal resumes coherently from the checkpoint. Worth
recording in `docs/persistence-checkpoints.md` as the "transport generator state" a snapshot must include
alongside the event log.

## Answers to the seven review questions

1. **Schedule-time `eventIndex` the right canonical index for velocity and future timing?** Yes - verified
   shared per-event across event/expression/performedTiming; assigned once in `commitScheduledNote`. This
   is the clean resolution of the 10b reconciliation concern.
2. **`performedOffsetBeats` clearly separate from `absoluteBeat`, grid truth preserved?** Yes - distinct
   field; 0 off-grid notes; `absoluteBeat` unchanged and still drives listening/replay.
3. **Kept data-only (synth fires at `scheduledTime`)?** Yes - confirmed in code and by 0 off-grid; the
   offset never reaches `triggerAttackRelease`.
4. **Offset bounds small/useful, no reorder risk?** Yes - 0.008-0.035 beat by role (~5-23 ms at 90 BPM):
   musically meaningful for 10d, and far under the 0.25-beat half-gap so reordering is impossible.
5. **Break/drain safe with schedule-time indexes?** Yes - the index advances only in `commitScheduledNote`,
   which `scheduleLookahead` skips during break; draining notes use their pre-assigned committed index.
   Cleaner than the 10b fire-time counter (a note's velocity/timing is now fixed at commit, not at fire).
6. **Is `performedTiming.latest` a useful debug surface despite reflecting future slots?** Yes, useful;
   just note it is ~8 notes ahead of `expression.latest` - label the rows (finding above).
7. **Smoke property-based or over-coupled?** Property-based: it asserts determinism (same input equal,
   next index not equal), the reorder-safety invariant (`|offset| <= maximumOffsetBeats`), the global cap
   (`<= 0.035`), and row rendering/cleanup - not exact offset values. Retuning the cycles won't break it.

## Is Byte 10d ready, or does 10c need a cleanup first?

Ready. No 10c cleanup required. 10d just needs to: fire at `scheduledTime + offsetSeconds` with the
clamp guard (forward note), keep `absoluteBeat`/ordering/listening grid-stable, and grow the difficulty
model through disposition. The data model 10d needs is already in place and verified.

## Forward notes for the persistence/checkpoint event-log path

- Store both `absoluteBeat` (grid truth) and `performedOffsetBeats` (performed layer) per event - done.
- A snapshot/checkpoint must also capture transport generator state to resume generation: per-player
  `committedEventIndexes`, `nextScheduleBeat`, `scheduledThroughBeat` (and `eventSerial`).
- Replay-from-ledger needs none of that (events are self-contained); only live seek-and-continue does.
- Add a replay assertion in 10d that a re-run reproduces the same `performedOffsetBeats` per event, the
  same way 10b/10c lock velocity and offset determinism.
