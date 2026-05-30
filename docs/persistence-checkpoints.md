# Persistence, Checkpoints, and Forking

## Recommendation

Use SQLite through the local backend as Grow's first durable world store.

The browser should own rendering and audio scheduling. The backend should own:

- Ollama calls.
- SQLite persistence.
- Checkpoints and forks.
- Best-moment metadata.
- Later media export or conversion, if needed.

This fits the browser-first plan because Grow already needs a local backend for Ollama, and SQLite gives us durable local storage without running a separate database service.

## Why Not One Giant JSON Blob

A single world JSON file is tempting and may still be useful for export, but it should not be the main working store.

Problems with one mutable blob:

- Hard to rewind without copying the whole file repeatedly.
- Hard to fork from a point in time.
- Easy to corrupt or partially write.
- Hard to query for moments, players, instruments, or decisions.
- Hard to purge rolling history cleanly.
- Hard for another agent to review changes because every small change rewrites everything.

## Core Model

Use an append-only event log plus periodic snapshots.

Events describe what happened:

- Player moved.
- Player chose a role.
- Note or pattern played.
- Instrument or effect preset created.
- Producer instruction given.
- Tempo, key, or mode changed.
- Moment marked.
- Player thought/decision completed.
- Material committed to a future playback window.

Snapshots describe state at a point:

- World bounds and session state.
- Player positions, memories, roles, instruments, relationships to producer instructions.
- Active instruments and effect chains.
- Current tempo, key, mode, transport position.
- Any deterministic random seed or clock information needed for replay.

To rewind, load a snapshot and replay later events. To fork, create a new branch from a snapshot or event sequence and append new events there.

## Practical First Schema

Keep the first schema hybrid: relational metadata plus JSON payloads.

Do not over-normalize every instrument and behavior yet. Store the key indexes as columns, and keep flexible state in JSON payloads until the shape stabilizes.

Treat the schema below as the target shape, not the first implementation. The first playable terrarium should run in memory so the project can learn what state is actually worth preserving.

When persistence begins, start with a smaller version:

```sql
create table sessions (
  id text primary key,
  name text not null,
  created_at text not null,
  updated_at text not null
);

create table events (
  id text primary key,
  session_id text not null references sessions(id),
  branch_id text not null default 'main',
  seq integer not null,
  tick integer not null,
  bar real,
  scheduled_bar real,
  actor_id text,
  type text not null,
  payload_json text not null,
  created_at text not null,
  unique(session_id, branch_id, seq)
);
```

This keeps the fork extension point (`branch_id`) without requiring branch management, snapshots, or moments on day one. `bar` can record when an event was created or observed; `scheduled_bar` can record when committed musical material should actually perform.

Add `moments` when manual marking exists. Add `snapshots` when replay from long histories becomes slow or when checkpoints become an actual user workflow. Add `worlds` and full `branches` when forks need names, parentage, and UI.

## Target Schema

```sql
create table worlds (
  id text primary key,
  name text not null,
  created_at text not null,
  updated_at text not null
);

create table branches (
  id text primary key,
  world_id text not null references worlds(id),
  name text not null,
  parent_branch_id text references branches(id),
  forked_from_snapshot_id text,
  forked_from_event_seq integer,
  created_at text not null,
  updated_at text not null
);

create table events (
  id text primary key,
  branch_id text not null references branches(id),
  seq integer not null,
  tick integer not null,
  bar real,
  scheduled_bar real,
  actor_id text,
  type text not null,
  payload_json text not null,
  created_at text not null,
  unique(branch_id, seq)
);

create table snapshots (
  id text primary key,
  branch_id text not null references branches(id),
  event_seq integer not null,
  tick integer not null,
  bar real,
  state_json text not null,
  state_hash text,
  created_at text not null,
  unique(branch_id, event_seq)
);

create table moments (
  id text primary key,
  branch_id text not null references branches(id),
  start_event_seq integer not null,
  end_event_seq integer not null,
  label text,
  score real,
  source text not null,
  metadata_json text not null,
  created_at text not null
);
```

This schema supports:

- Ordinary forward play.
- Rewind to a checkpoint.
- Fork from a checkpoint.
- Best-moment marking.
- Automatic moment scoring.
- Compact session export.
- Delayed-now replay where decisions and scheduled performance time are distinct.

## Snapshot Strategy

Start simple:

- Begin with no snapshots in the first playable prototype.
- Write events continuously once SQLite persistence is introduced.
- Write snapshots every N events, every N bars, or before major user actions.
- Keep snapshots small enough to load quickly.
- Keep enough events between snapshots to preserve good replay detail.
- Use transactions so a snapshot and its surrounding metadata are committed safely.

A good first setting:

- Snapshot every 8 or 16 bars during active sessions.
- Snapshot immediately before a fork.
- Snapshot immediately before a manual "keep this" moment if needed.

## Forking

A fork is a new branch with a pointer back to where it began.

Forking should be designed for early and implemented later. Keep `branch_id` on events from the first persistence pass, but defer fork UI and full branch metadata until playing with the terrarium reveals a real need to branch.

Example:

```txt
world: first-terrarium
  branch: main-session
    events 1..2000
    snapshot at 1600
  branch: sparse-remix
    parent: main-session
    forked from event 1600
    events 1..450 on sparse-remix
```

The fork should not copy the entire event history at first. It should reference the parent point, then store only new branch events. If this gets too complex, a later compaction step can materialize a fork into its own baseline snapshot.

## Best-Moments Capture

The event log can double as the source for best-moments replay:

- Rolling recent events stay in SQLite during a session.
- Unmarked old events can be pruned or compacted.
- Marked moments keep a start/end event sequence and enough snapshots to replay.
- Exported moments can be rendered later to WebM or MP4.

This avoids keeping raw media for everything.

## Browser Storage Alternative

IndexedDB could work for a browser-only prototype, but Grow already expects a local backend for Ollama. SQLite is easier to inspect, back up, migrate, and share across local agents.

The browser can keep hot UI state in memory. The backend SQLite database should be the durable source for sessions, checkpoints, forks, and moments.

## Git Safety

Do not commit local database files by default.

Suggested ignored paths:

```txt
data/*.sqlite
data/*.sqlite3
data/*.db
data/*.db-shm
data/*.db-wal
```

Commit schema migrations, seed fixtures, and small test databases only when intentionally created for tests.
