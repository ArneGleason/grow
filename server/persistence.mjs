import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const CURRENT_SCHEMA_VERSION = 1;
export const DEFAULT_DATABASE_PATH = "data/grow.sqlite3";

export const INITIAL_RECORD_TYPES = Object.freeze([
  "session.started",
  "session.mode_changed",
  "song.changed",
  "timing.feel_changed",
  "musical.event_recorded",
]);

export function resolveDatabasePath(databasePath = process.env.GROW_DB_PATH ?? DEFAULT_DATABASE_PATH) {
  if (databasePath === ":memory:") return databasePath;
  return resolve(process.cwd(), databasePath);
}

export function openGrowDatabase(options = {}) {
  const databasePath = resolveDatabasePath(options.databasePath);
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (databasePath !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL");
  }
  if (options.initialize !== false) {
    initializeGrowDatabase(database);
  }
  return database;
}

export function initializeGrowDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL DEFAULT 'main',
      branch_id TEXT NOT NULL DEFAULT 'main',
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL DEFAULT 'main',
      seq INTEGER NOT NULL,
      tick INTEGER NOT NULL DEFAULT 0,
      bar REAL,
      scheduled_bar REAL,
      actor_id TEXT,
      session_mode TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, branch_id, seq)
    );

    CREATE INDEX IF NOT EXISTS events_session_branch_seq_idx
      ON events(session_id, branch_id, seq);

    CREATE INDEX IF NOT EXISTS events_branch_type_seq_idx
      ON events(branch_id, type, seq);

    CREATE INDEX IF NOT EXISTS events_actor_type_seq_idx
      ON events(actor_id, type, seq);

    CREATE INDEX IF NOT EXISTS events_scheduled_bar_idx
      ON events(scheduled_bar);
  `);

  database.prepare(`
    INSERT INTO schema_meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(CURRENT_SCHEMA_VERSION));
}

export function getSchemaVersion(database) {
  const row = database.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get();
  return row ? Number(row.value) : null;
}

export function ensureSession(database, session) {
  const now = session.createdAt ?? new Date().toISOString();
  const id = session.id ?? randomUUID();
  const spaceId = session.spaceId ?? "main";
  const branchId = session.branchId ?? "main";
  const name = session.name ?? "Grow session";
  const metadataJson = stableJson(session.metadata ?? {});

  database.prepare(`
    INSERT INTO sessions (id, space_id, branch_id, name, created_at, updated_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
  `).run(id, spaceId, branchId, name, now, now, metadataJson);

  return getSession(database, id);
}

export function getSession(database, sessionId) {
  const row = database.prepare(`
    SELECT
      id,
      space_id AS spaceId,
      branch_id AS branchId,
      name,
      created_at AS createdAt,
      updated_at AS updatedAt,
      metadata_json AS metadataJson
    FROM sessions
    WHERE id = ?
  `).get(sessionId);
  return row ? parseSessionRow(row) : null;
}

export function listSessions(database, options = {}) {
  const limit = normalizeLimit(options.limit, 20);
  const rows = database.prepare(`
    SELECT
      id,
      space_id AS spaceId,
      branch_id AS branchId,
      name,
      created_at AS createdAt,
      updated_at AS updatedAt,
      metadata_json AS metadataJson
    FROM sessions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  return rows.map(parseSessionRow);
}

export function appendEvent(database, event) {
  if (!event.sessionId) {
    throw new Error("appendEvent requires sessionId");
  }
  if (!event.type || typeof event.type !== "string") {
    throw new Error("appendEvent requires a string type");
  }

  return withImmediateTransaction(database, () => {
    const session = getSession(database, event.sessionId);
    if (!session) {
      throw new Error(`Cannot append event for missing session: ${event.sessionId}`);
    }

    const branchId = event.branchId ?? session.branchId ?? "main";
    const seqRow = database.prepare(`
      SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq
      FROM events
      WHERE session_id = ? AND branch_id = ?
    `).get(event.sessionId, branchId);
    const seq = Number(seqRow.nextSeq);
    const createdAt = event.createdAt ?? new Date().toISOString();
    const eventId = event.id ?? randomUUID();

    database.prepare(`
      INSERT INTO events (
        id,
        session_id,
        branch_id,
        seq,
        tick,
        bar,
        scheduled_bar,
        actor_id,
        session_mode,
        type,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      event.sessionId,
      branchId,
      seq,
      event.tick ?? 0,
      event.bar ?? null,
      event.scheduledBar ?? null,
      event.actorId ?? null,
      event.sessionMode ?? null,
      event.type,
      stableJson(event.payload ?? {}),
      createdAt,
    );

    database.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(createdAt, event.sessionId);
    return readEventById(database, eventId);
  });
}

export function readEvents(database, options = {}) {
  const clauses = [];
  const params = [];
  if (options.sessionId) {
    clauses.push("session_id = ?");
    params.push(options.sessionId);
  }
  if (options.branchId) {
    clauses.push("branch_id = ?");
    params.push(options.branchId);
  }
  if (options.type) {
    clauses.push("type = ?");
    params.push(options.type);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = normalizeLimit(options.limit, 50);
  const rows = database.prepare(`
    SELECT
      id,
      session_id AS sessionId,
      branch_id AS branchId,
      seq,
      tick,
      bar,
      scheduled_bar AS scheduledBar,
      actor_id AS actorId,
      session_mode AS sessionMode,
      type,
      payload_json AS payloadJson,
      created_at AS createdAt
    FROM events
    ${where}
    ORDER BY created_at DESC, seq DESC
    LIMIT ?
  `).all(...params, limit);
  return rows.map(parseEventRow);
}

export function dumpGrowDatabase(database, options = {}) {
  return {
    schemaVersion: getSchemaVersion(database),
    sessions: listSessions(database, { limit: options.sessionLimit ?? 20 }),
    events: readEvents(database, { limit: options.eventLimit ?? options.limit ?? 50 }),
  };
}

function readEventById(database, eventId) {
  const row = database.prepare(`
    SELECT
      id,
      session_id AS sessionId,
      branch_id AS branchId,
      seq,
      tick,
      bar,
      scheduled_bar AS scheduledBar,
      actor_id AS actorId,
      session_mode AS sessionMode,
      type,
      payload_json AS payloadJson,
      created_at AS createdAt
    FROM events
    WHERE id = ?
  `).get(eventId);
  return row ? parseEventRow(row) : null;
}

function withImmediateTransaction(database, work) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function parseSessionRow(row) {
  return {
    id: row.id,
    spaceId: row.spaceId,
    branchId: row.branchId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: JSON.parse(row.metadataJson),
  };
}

function parseEventRow(row) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    branchId: row.branchId,
    seq: row.seq,
    tick: row.tick,
    bar: row.bar,
    scheduledBar: row.scheduledBar,
    actorId: row.actorId,
    sessionMode: row.sessionMode,
    type: row.type,
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  };
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 500);
}

function stableJson(value) {
  return JSON.stringify(value ?? {});
}
