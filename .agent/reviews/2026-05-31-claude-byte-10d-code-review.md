# Claude Review: Grow Byte 10d (Audible Performed Microtiming)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `f8c8662 Implement Byte 10d audible microtiming` (range `f61c1e1..b38d114`) on `main`
**Review branch:** `claude/byte-10d-code-review`

## Verdict

**Approved.** No required fixes. This is the riskiest transport change since Byte 5 - it moves the
synth fire position to `absoluteBeat + performedOffsetBeats` - and it lands safely: grid truth is fully
preserved, both timing guards I asked for in 10c are present, the offset can never reorder notes, and
the lifecycle (start/stop, rapid cycles, break drain) is intact. The difficulty model is bounded and
caused rather than decorative. Verified all of this live. Findings are forward/creative-lens only.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **6/6 passed** (twice); `git diff --check` -> clean.
- Live probe (two start/stop runs + lifecycle stress):
  - **Grid truth preserved:** 0 off-grid notes - `absoluteBeat` stays on the 0.5 grid even though notes
    fire at offset tick positions; the event records the grid snapshot, not the performed beat.
  - **No reorder (the key safety check):** per player, the performed beat (`absoluteBeat + offset`) is
    monotonic in `eventIndex` order - **0 violations** for pulse/bass/melody.
  - **Bounded + deterministic:** 0 offsets over role max; 38 `(playerId, eventIndex)` keys compared
    across two runs, **0 mismatches** (the new leap/register/density inputs did not break determinism).
  - **Audible-offset metadata:** every event carries `timing:audible-offset`; `performedOffsetSeconds`
    matches `beats * 60 / BPM`.
  - **Difficulty wired and bounded:** leap/register/density components populate sensibly (e.g. bass with
    leap 0.42 / register 0.5 / density 0.75); resulting offsets stay tiny (subtle - see creative lens).
  - **Lifecycle clean:** after **8 rapid start/stop cycles** pending = 0; a clean window shows 0
    duplicate grid slots and pulse exactly 1x/beat; **break drains** 25 -> 0 (health `empty`), **resume**
    returns to `healthy`; stop leaves pending 0 / `stopped`.

## Findings

No required fixes. Forward and creative-lens notes only.

### Creative lens (the most interesting) - difficulty currently drags by default and is subtle
The difficulty response is `+ difficultyDrag - difficultyPush`, where `difficultyDrag` is
caution-weighted (`difficultyPressure * (0.1 + caution*0.12)`) and `difficultyPush` only fires for
disruptive players (`leapPressure * disruption * 0.08`). So the *default* physical response to hard
material is **drag** (slow into it carefully), with **push** (rush) reserved for disruptive players.
That is a defensible model - but it is the opposite of the original anecdote that seeded this idea ("a
player rushes a difficult entry just to get their fingers to the right place"), where the rush *was* the
default physical response. Worth a deliberate choice: should the baseline difficulty response lean push
(rush, the anecdote) or drag (careful)? Right now it leans drag. Separately, the difficulty contribution
is **subtle** - live, leap/register/density moved the offset by only ~0.002 beat (~1 ms) versus the
long/medium cycles + eventStep, which dominate. It is correct and bounded, but if you want to *feel* "the
player rushed that leap," the difficulty weighting could be raised (still within the +/-0.035 beat cap).
Both points are character/tuning, not defects.

### Forward (checkpoint/persistence) - one more piece of generator state to capture
Byte 10d adds `latestCommittedPitchByPlayer` (used for leap pressure), so the reproducible *generator*
state a seek-and-continue checkpoint must capture is now: per-player `committedEventIndexes`,
`latestCommittedPitchByPlayer`, plus `nextScheduleBeat` / `scheduledThroughBeat` (and `eventSerial`).
Replay-from-ledger remains fully self-contained - each event now stores `absoluteBeat` (grid truth),
`performedOffsetBeats`, `performedOffsetSeconds`, and `performedTiming`. Worth listing this generator-
state set explicitly in `docs/persistence-checkpoints.md` so the snapshot schema captures it when
checkpointing lands.

### Nit (DRY) - pitch parsing is now duplicated in three modules
`performed-time.ts` (`parsePitch`/`pitchHeight`), `thought-seeds.ts` (`pitchHeight`), and
`thought-protocol.ts` (`parsePitch`/`getScaleDegree`) each carry a near-identical pitch->semitone/octave
parser and semitone table. A shared `music-theory` util (pitch class + octave + semitone) would
consolidate them and keep the accidental/enharmonic table in one place. Low priority.

### Observation (carried from 10c) - the two `latest` debug surfaces still differ in recency
`performedTiming.latest` reflects the latest *committed* (future, ~8 notes ahead) slot while
`expression.latest` reflects the latest *heard* note. Still fine; the 10c suggestion to label the
inspector rows ("Offset - next committed" vs "Dynamics - just played") stands.

## Answers to the five review questions

1. **Does audible scheduling preserve grid truth?** Yes - verified: 0 off-grid `absoluteBeat`; the event
   records `snapshot.absoluteBeat` (grid), not the performed beat; listening ordering is grid-stable
   because the bounded offset can't reorder notes (0 per-player reorder violations); replay provenance is
   grid `absoluteBeat` plus a separate `performedOffsetBeats`/`Seconds`.
2. **Are tick scheduling, the live-playhead guard, and the callback clamp safe across start/stop, break
   drains, and timing drift?** Yes. `getPerformedTransportPosition` clamps to `max(0, ceil(ticks+1),
   round(performedBeat*PPQ))` (no scheduling behind the playhead), `getFirstFutureGridBeat` reserves
   `MAX_PERFORMED_OFFSET_BEATS` headroom on catch-up, and `clampAudioFireTime` fires at
   `max(scheduledSeconds, now+epsilon)` for late callbacks. Verified: 8 rapid cycles leak-free, break
   drain intact, clean stop.
3. **Is the difficulty model useful and bounded, not decorative or sloppy?** Yes - leap (0.48-weighted),
   role-relative register (0.24), local density (0.28), split into caution-weighted drag and
   disruption*leap push, all clamped; final offset capped at +/-0.035 beat with 0 reorders. Bounded and
   caused. (It is currently *subtle* and drags-by-default - creative-lens note above.)
4. **Is any event/state for future persistence or seek-and-continue missing?** Events are complete for
   ledger replay. For seek-and-continue, add `latestCommittedPitchByPlayer` to the generator-state set
   already noted in 10c (forward note above). Nothing missing for replay-from-ledger.
5. **Is the replay smoke strong without being timing-flaky?** Yes - it compares `performedOffsetBeats`
   by `playerId:eventIndex` across a restart, which asserts deterministic *data* (not wall-clock
   behavior), so it is robust. Verified live with 0 mismatches over 38 keys.

## Open questions / forward notes

- **Ollama model switch (Arne's note, for the next Ollama byte):** switch the default from `gemma4:*`
  to **`qwen3:4b-instruct-2507-q4_K_M` with structured/"projected-json" output.** This directly resolves
  my Byte 9b finding: `gemma4:26b` was a *reasoning* model whose `message.thinking` starved
  `message.content` (the real probe returned empty). A small *instruct* model with schema-constrained
  JSON output should produce parseable, bounded intents that pass `validatePlayerThoughtIntent`. When
  that byte lands: update `DEFAULT_OLLAMA_MODEL`/`.env.example`, switch `/api/chat` to structured output
  (Ollama `format` as a JSON schema rather than the bare `"json"` string), and keep the deterministic
  mock as the offline fallback.
- **Microtiming feel tuning (optional):** decide push-vs-drag default and difficulty weight (above).
- **Persistence doc:** record the generator-state set for checkpointing.

## Next bite

Byte 10d completes the audible reproducible-aliveness timing layer cleanly. Natural next directions:
the agitation/contagion loop from `reproducible-aliveness.md` (micro-timing variance -> a frame
`agitation` metric -> disposition-weighted spread), or returning to the Ollama path with the new
instruct model. Either is unblocked.
