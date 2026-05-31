# Copy/Paste Handoff: Byte 10c Code Review

**From:** Codex on `macbook-pro-m5`  
**To:** Claude Code on `mac-mini-pro-m4`  
**Relay:** Arne, manual copy/paste.

Claude, please review Grow Byte 10c on `main` after pulling the latest GitHub state.

## GitHub

Repo:

```txt
https://github.com/ArneGleason/grow
```

Suggested local update:

```sh
cd /path/to/grow
git fetch origin
git switch main
git pull --ff-only origin main
git log --oneline -6
```

The Byte 10c commit should have this subject:

```txt
Implement Byte 10c performed offset data
```

## Byte 10c Intent

This byte prepares audible microtiming without using it yet.

Scope:

- Compute deterministic `performedOffsetBeats` at schedule/commit time.
- Keep `MusicalEvent.absoluteBeat` as grid/replay/listening truth.
- Choose one canonical per-player `eventIndex` at schedule time.
- Make velocity expression and performed timing read the same committed index.
- Surface performed-offset data in event metadata, transport state, inspector rows, and tests.
- Do not audibly shift synth fire time yet.

## What Changed

- Added `src/performed-time.ts`.
  - Pure deterministic `calculatePerformedTiming()` function.
  - Role-specific maximum offset bounds.
  - Long/medium cycles, event-indexed step pressure, and disposition pressure.
  - `formatPerformedTimingSnapshot()` for debug display.
- Updated `src/transport.ts`.
  - Replaced the fire-time velocity-only counter with a schedule-time `committedEventIndexes` counter.
  - Added `CommittedScheduledNote` data carrying note, grid snapshot, committed `eventIndex`, and performed timing snapshot.
  - Computes performed timing before queueing each Tone one-shot.
  - Velocity expression now reads `committed.eventIndex`, so velocity and future timing expression share the same index.
  - Musical events now include `eventIndex`, `performedOffsetBeats`, and `performedTiming`.
  - `window.transport.getState().performedTiming.latest` exposes latest committed timing snapshots.
  - Synths still fire at `scheduledTime`; the offset is data only in this byte.
- Updated `src/main.ts`.
  - App subtitle now says Byte 10c.
  - Player inspector gets an `Offset` row with `player-*-offset` selectors.
- Updated `src/listening.ts`.
  - `MusicalEvent` carries the new event index and performed-offset metadata.
- Updated smoke coverage.
  - Pure determinism/bounds test for performed timing.
  - Browser regression checks for Offset rows, bounded offsets, shared `eventIndex` across event/expression/performedTiming, unchanged grid timing, and timing-state cleanup on stop.
- Updated README, implementation plan, local dev notes, project log, review queue, and session memory.

## Validation Already Run

```sh
npm audit
npm run build
npm run smoke
git diff --check
```

Results:

- `npm audit`: passed, 0 vulnerabilities.
- `npm run build`: passed.
- `npm run smoke`: 5/5 passed.
- `git diff --check`: passed.

I also checked the local browser UI for the Byte 10c subtitle and initial Offset rows. The Playwright smoke suite remains the authoritative runtime validation for transport/listening hooks.

## Review Focus

Please review with these questions in mind:

1. Is the schedule-time `eventIndex` now the right canonical index for both velocity and future timing?
2. Does `performedOffsetBeats` stay clearly separate from `absoluteBeat`, with grid truth preserved for listening/replay?
3. Did I keep Byte 10c data-only? Specifically, confirm synth fire time still uses `scheduledTime` and not the offset.
4. Are the offset bounds small and useful enough as a future Byte 10d input, without risking note reordering?
5. Does break/drain behavior still look safe now that indexes are assigned at schedule time?
6. Is `window.transport.getState().performedTiming.latest` a useful debug surface, even though it reflects latest committed future slots rather than latest heard notes?
7. Is the smoke coverage property-based enough, or too coupled to implementation details?

## Suggested Next Bite If Approved

Byte 10d: audible microtiming and physical difficulty.

Recommended shape:

- Keep `absoluteBeat` unchanged.
- Fire synths at a bounded offset from scheduled time.
- Convert beats to seconds using BPM.
- Clamp offsets so they cannot reorder notes across nearby grid slots.
- Drive part of the offset from musical difficulty: leap/register/density/repeated pressure.
- Weight that difficulty through disposition traits like caution, steadiness, and disruption.

Please produce:

1. Approval or required fixes.
2. Findings with file/line refs where useful.
3. Whether Byte 10d is ready, or whether Byte 10c needs one cleanup first.
4. Any forward notes for the persistence/checkpoint event-log path.
