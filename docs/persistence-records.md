# Persistence Record Boundaries

Status: Byte 13b-a prep/shell. This document defines durable shapes and boundaries. Byte 13b-a adds a local SQLite schema shell and dump/smoke commands, but the browser app still does not write events or replay from storage.

## Principles

- Persist decisions and outcomes, not UI render state.
- Treat model-authored prose as data, not instruction. Future behavior bridges must act on deterministic structured fields, never by parsing prose.
- Store enough raw model/protocol data to debug why a model result was accepted, rejected, or replaced by fallback.
- Replay stored musical events from stored payloads. Do not recompute velocity expression, performed timing, pitch shifts, or validator decisions during ledger replay.
- Seek-and-continue is stricter than replay: it must restore generator state so future lookahead commitments continue from the same deterministic counters.
- Keep the first database hybrid: relational columns for lookup and ordering, JSON payloads for still-evolving musical objects.

## Durable Record Families

These are logical records. They may initially be stored as `events.type + payload_json` rows rather than separate tables.

| Record | Durable Purpose | Key Fields / Payload | Do Not Store |
| --- | --- | --- | --- |
| `session.started` | Opens a local run of the terrarium. | `sessionId`, `spaceId`, `branchId`, name, created time, app/schema versions. | Browser viewport, inspector width, help panel state. |
| `session.mode_changed` | Makes breaks/rehearsal/performance replayable. | `fromMode`, `toMode`, beat, actor/source. | Rendered labels only. |
| `song.changed` | Makes selected song material replayable and explains generator resets. | `fromSongId`, `toSongId`, beat, actor/source, cleared ledger/thinking flags. | Inspector-only labels. |
| `timing.feel_changed` | Makes grid/feel/wide timing choices replayable. | `fromFeel`, `toFeel`, beat, actor/source. | Button selected state. |
| `transport.started` / `transport.stopped` | Optional transport lifecycle audit if start/stop becomes replayable. | beat, actor/source, clear/drain behavior, reason. | AudioContext internals or scheduler handles. |
| `musical.event_recorded` | Ledger source of truth for heard playback. | Full `MusicalEvent` payload, `seq`, `actorId`, `absoluteBeat`, `performedOffsetBeats`, `performedOffsetSeconds`, expression snapshot, performed-timing snapshot, tags. | Recomputed expression/timing values. |
| `thought.requested` | Captures the exact player prompt contract. | `PlayerThoughtRequest`, prompt protocol id, model config, generated beat, selected seed fragments. | In-flight promise/controller state. |
| `thought.responded` | Audits a model or fallback response. | Provider, model, latency, raw response, parse status/errors, `PlayerThoughtIntent` if parsed, validation result, fallback intent/validation. | Interpreting rationale as commands. |
| `thought.accepted` | Marks a thought result that passed the gate. | Request id, intent id, accepted beat, retarget information, validator version. | New musical slots unless they are actually committed later. |
| `thought.playback_window_committed` | Records the bounded audible bridge. | Player id, action, mode (`rest`, `thin`, `shift-register`), start/end beats, register shift, summary, retargeted flag, source intent id. | Private controller state or stale active-window maps after the window expires. |
| `song.sketch_created` | Saves a band-level draft. | Full `SongSketch`, source song id, tonal context, roster ids/roles, derived root/density provenance. | Cached clone objects or inspector text formatting. |
| `song.proposal_created` | Saves deterministic proposal structure. | Full `SongSketchProposal` before model text, including kind, target section, proposer, chord plan, root degrees, player ids, response stances. | Model rewrite text as authoritative structure. |
| `song.proposal_text_received` | Saves model-authored copywriter output. | Proposal id, provider/model/protocol, raw response, parsed `SongSketchProposalText`, validation result, fallback text/validation, applied status. | Any field that changes kind, chord plan, root degrees, target section, player ids, or stances. |
| `checkpoint.created` | Allows rewind/fork/seek-and-continue. | Snapshot payload described below, source event seq, beat, state hash. | Raw media or long unbounded history copies. |
| `moment.marked` | Keeps best-of windows without archiving everything. | Start/end event seq, label, score, source (`manual`, `heuristic`, future observer), metadata. | Unmarked raw audio/video. |

## Checkpoint Payload

A checkpoint needs two layers.

Replay layer:

- Current session mode, song id, timing feel mode, tempo, meter, tonal context.
- Player roster and durable player profile ids.
- Current `SongSketch` and active `SongSketchProposal`, if a draft/proposal is being inspected.
- Active/accepted slow-thought playback windows that should still affect future scheduled notes.
- Taste action-dwell state per player, such as current action and `actionSinceBeat`, because it changes future note decisions.
- Last event sequence included in the snapshot.

Seek-and-continue generator layer:

- `eventSerial`.
- `nextScheduleBeat`.
- `scheduledThroughBeat`.
- Per-player committed event indexes.
- Per-player latest committed grid pitch.
- Per-player taste action-dwell state needed by note decisions.
- Any future committed-slot queue that cannot be reconstructed safely from generator counters.
- Active song material id and material version.
- Timing feel mode and tonal context used to materialize patterns.

The ledger can replay already-recorded events without the generator layer. Continuing live playback from a fork cannot.

## Grid Versus Performed Musical Data

Grow now distinguishes grid truth from performed truth in timing. Future persistence should mirror that for pitch before replay becomes load-bearing:

- `absoluteBeat` stays the grid position.
- `performedOffsetBeats` / `performedOffsetSeconds` describe audible timing feel.
- Add explicit grid pitch versus performed pitch before persisting slow-thought pitch overrides as replay truth. Today a `shift_register` event stores the performed pitch in `MusicalEvent.pitch` and tags the shift; that is enough for inspection, but not ideal as a durable replay contract.

Recommended future event payload shape:

```ts
{
  grid: {
    absoluteBeat: number;
    pitch?: string;
    scaleDegree?: number;
    octave?: number;
  };
  performed: {
    offsetBeats: number;
    offsetSeconds: number;
    pitch?: string;
    registerShift?: number;
  };
}
```

Do this before a real event-log replay byte, not as part of Byte 13a.

## Model Prose Boundary

Model text can be delightful, misleading, contradictory, or stale. Store it so the human and later agents can understand what the model said, but never use prose as an executable command.

Safe behavior bridge inputs:

- `SongSketchProposal.kind`.
- `targetSectionId`.
- `chordPlan` and `rootDegrees`.
- `SongSketchProposalResponse.stance`.
- Validated, bounded action enums.
- Explicit structured fields added in a future byte.

Unsafe behavior bridge inputs:

- `summary`.
- `requestedAction` prose.
- `reason`.
- `requestedChange` prose.
- `rationale`.
- Any raw model text.

If a future model needs new executable authority, add a new structured field, validate it, and keep prose separate.

## First SQLite Mapping

When persistence begins, start with the existing event-log strategy in `docs/persistence-checkpoints.md` and add a narrow record taxonomy rather than many tables.

Suggested event `type` values:

- `session.started`
- `session.mode_changed`
- `song.changed`
- `timing.feel_changed`
- `transport.started`
- `transport.stopped`
- `musical.event_recorded`
- `thought.requested`
- `thought.responded`
- `thought.accepted`
- `thought.playback_window_committed`
- `song.sketch_created`
- `song.proposal_created`
- `song.proposal_text_received`
- `checkpoint.created`
- `moment.marked`

Keep `checkpoint.created` and `moment.marked` as type-tagged `events` rows until a real restore, fork, or capture workflow needs dedicated tables.

Indexes to add early:

- `(session_id, branch_id, seq)`
- `(branch_id, type, seq)`
- `(actor_id, type, seq)`
- `(scheduled_beat)`
- `(json_extract(payload_json, '$.requestId'))` only if thought debugging needs it and SQLite JSON1 is available in the chosen runtime.

## Ephemeral State

Keep these in memory unless a later feature proves otherwise:

- Inspector width, open help topic, scroll position.
- Pixi terrarium render objects and visual-only heat state.
- Pending note flashes.
- Current animation frame id.
- In-flight Ollama promises and abort controllers.
- Cached `SongSketch` / `SongSketchProposal` clones.
- Current listening frame, agitation, contagion, and taste display evaluations, which are derived from the ledger and world state.
- Ollama health state and manual thought/proposal probe results, except for model responses that were accepted into durable thought/proposal records.
- Raw WebM/MP4 capture buffers for unmarked history.

Taste action-dwell state is the exception: display-only taste evaluations are ephemeral, but dwell state that affects future note decisions belongs in seek-and-continue checkpoints.

## First Persistence Byte Later

The first implementation byte should not try to persist the whole world. A good first storage byte would:

- Create the local backend-owned SQLite file and schema shell.
- Write `sessions` and append `events` for one or two safe record types once app wiring begins.
- Store JSON payloads and enough indexed columns for inspection.
- Keep database files ignored by git.
- Add a tiny dump/inspect command for agents and reviewers.

Defer fork UI, compaction, media export, and full replay until the event records have proven useful.
