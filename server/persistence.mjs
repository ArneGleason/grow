import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const CURRENT_SCHEMA_VERSION = 3;
export const DEFAULT_DATABASE_PATH = "data/grow.sqlite3";

export const INITIAL_RECORD_TYPES = Object.freeze([
  "session.started",
  "session.mode_changed",
  "song.changed",
  "timing.feel_changed",
  "musical.event_recorded",
  "candidate.created",
  "candidate.scored",
  "candidate.retained",
  "candidate.reserved",
  "candidate.purged",
]);

const CANDIDATE_KINDS = Object.freeze(["song", "phrase", "groove", "harmony", "form"]);
const CANDIDATE_STATUSES = Object.freeze(["alive", "elite", "reserved", "purged"]);
const MAX_CANDIDATE_LIMIT = 500;
const MAX_SCORE_KEYS = 32;

export function resolveDatabasePath(databasePath = process.env.GROW_DB_PATH ?? DEFAULT_DATABASE_PATH) {
  if (databasePath === ":memory:") return databasePath;
  return resolve(process.cwd(), databasePath);
}

export function databaseExists(databasePath = process.env.GROW_DB_PATH ?? DEFAULT_DATABASE_PATH) {
  const resolvedPath = resolveDatabasePath(databasePath);
  return resolvedPath === ":memory:" || existsSync(resolvedPath);
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
      beat REAL,
      scheduled_beat REAL,
      actor_id TEXT,
      session_mode TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, branch_id, seq)
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL DEFAULT 'main',
      kind TEXT NOT NULL,
      genome_json TEXT NOT NULL,
      scores_json TEXT NOT NULL DEFAULT '{}',
      fitness REAL NOT NULL DEFAULT 0,
      parent_id TEXT,
      generation INTEGER NOT NULL DEFAULT 0,
      seed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'alive',
      created_at_beat REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  migrateGrowDatabase(database);

  database.exec(`
    CREATE INDEX IF NOT EXISTS events_session_branch_seq_idx
      ON events(session_id, branch_id, seq);

    CREATE INDEX IF NOT EXISTS events_branch_type_seq_idx
      ON events(branch_id, type, seq);

    CREATE INDEX IF NOT EXISTS events_actor_type_seq_idx
      ON events(actor_id, type, seq);

    CREATE INDEX IF NOT EXISTS events_scheduled_beat_idx
      ON events(scheduled_beat);

    CREATE INDEX IF NOT EXISTS candidates_branch_kind_status_fitness_idx
      ON candidates(branch_id, kind, status, fitness DESC);

    CREATE INDEX IF NOT EXISTS candidates_parent_idx
      ON candidates(parent_id);
  `);

  database.prepare(`
    INSERT INTO schema_meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(CURRENT_SCHEMA_VERSION));
}

function migrateGrowDatabase(database) {
  const sessionColumns = getTableColumnNames(database, "sessions");
  if (sessionColumns.length > 0) {
    addColumnIfMissing(database, "sessions", sessionColumns, "branch_id", "TEXT NOT NULL DEFAULT 'main'");
    addColumnIfMissing(database, "sessions", sessionColumns, "metadata_json", "TEXT NOT NULL DEFAULT '{}'");
  }

  const eventColumns = getTableColumnNames(database, "events");
  if (eventColumns.length > 0) {
    addColumnIfMissing(database, "events", eventColumns, "beat", "REAL");
    addColumnIfMissing(database, "events", eventColumns, "scheduled_beat", "REAL");
    const migratedEventColumns = getTableColumnNames(database, "events");
    if (migratedEventColumns.includes("bar")) {
      database.exec("UPDATE events SET beat = bar WHERE beat IS NULL AND bar IS NOT NULL");
    }
    if (migratedEventColumns.includes("scheduled_bar")) {
      database.exec(`
        UPDATE events
        SET scheduled_beat = scheduled_bar
        WHERE scheduled_beat IS NULL AND scheduled_bar IS NOT NULL
      `);
    }
  }

  const candidateColumns = getTableColumnNames(database, "candidates");
  if (candidateColumns.length > 0) {
    addColumnIfMissing(database, "candidates", candidateColumns, "created_at_beat", "REAL");
  }
}

function getTableColumnNames(database, tableName) {
  return database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
}

function addColumnIfMissing(database, tableName, columnNames, columnName, definition) {
  if (columnNames.includes(columnName)) return;
  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  columnNames.push(columnName);
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
  return appendEvents(database, [event])[0];
}

export function appendEvents(database, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }
  for (const event of events) {
    validateEventInput(event);
  }

  return withImmediateTransaction(database, () => appendEventsInTransaction(database, events));
}

function appendEventsInTransaction(database, events) {
  const sessionsById = new Map();
  const nextSeqBySessionBranch = new Map();
  const appendedEvents = [];
  for (const event of events) {
    const existingEvent = event.id ? readEventById(database, event.id) : null;
    if (existingEvent) {
      appendedEvents.push(existingEvent);
      continue;
    }

    let session = sessionsById.get(event.sessionId);
    if (!session) {
      session = getSession(database, event.sessionId);
      if (!session) {
        throw new Error(`Cannot append event for missing session: ${event.sessionId}`);
      }
      sessionsById.set(event.sessionId, session);
    }

    const branchId = event.branchId ?? session.branchId ?? "main";
    const sessionBranchKey = `${event.sessionId}:${branchId}`;
    let seq = nextSeqBySessionBranch.get(sessionBranchKey);
    if (seq === undefined) {
      const seqRow = database.prepare(`
        SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq
        FROM events
        WHERE session_id = ? AND branch_id = ?
      `).get(event.sessionId, branchId);
      seq = Number(seqRow.nextSeq);
    }

    const createdAt = event.createdAt ?? new Date().toISOString();
    const eventId = event.id ?? randomUUID();

    database.prepare(`
      INSERT INTO events (
        id,
        session_id,
        branch_id,
        seq,
        tick,
        beat,
        scheduled_beat,
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
      event.beat ?? null,
      event.scheduledBeat ?? null,
      event.actorId ?? null,
      event.sessionMode ?? null,
      event.type,
      stableJson(event.payload ?? {}),
      createdAt,
    );

    database.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(createdAt, event.sessionId);
    nextSeqBySessionBranch.set(sessionBranchKey, seq + 1);
    const appendedEvent = readEventById(database, eventId);
    if (appendedEvent) {
      appendedEvents.push(appendedEvent);
    }
  }

  return appendedEvents;
}

export function writeCandidate(database, request) {
  const session = getRequiredSession(database, request.sessionId);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const candidate = normalizeCandidateInput(request.candidate, branchId);
  const createdAt = request.createdAt ?? new Date().toISOString();

  return withImmediateTransaction(database, () => {
    const existingCandidate = readCandidateById(database, candidate.id);
    if (existingCandidate) return existingCandidate;

    database.prepare(`
      INSERT INTO candidates (
        id,
        branch_id,
        kind,
        genome_json,
        scores_json,
        fitness,
        parent_id,
        generation,
        seed,
        status,
        created_at_beat,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.id,
      branchId,
      candidate.kind,
      stableJson(candidate.genome),
      stableJson(candidate.scores),
      candidate.fitness,
      candidate.parentId ?? null,
      candidate.generation,
      candidate.seed,
      candidate.status,
      candidate.createdAtBeat ?? null,
      createdAt,
      createdAt,
    );

    const storedCandidate = readCandidateById(database, candidate.id);
    appendEventsInTransaction(database, [
      createCandidateAuditEvent("candidate.created", session.id, branchId, storedCandidate, createdAt),
    ]);
    return storedCandidate;
  });
}

export function scoreCandidate(database, request) {
  const session = getRequiredSession(database, request.sessionId);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const candidateId = requireCandidateId(request.candidateId);
  const scores = normalizeScores(request.scores);
  const fitness = clampFiniteNumber(request.fitness, 0, 1, "fitness");
  const updatedAt = request.updatedAt ?? new Date().toISOString();

  return withImmediateTransaction(database, () => {
    const existingCandidate = readCandidateById(database, candidateId);
    if (!existingCandidate) {
      throw new Error(`Cannot score missing candidate: ${candidateId}`);
    }
    if (existingCandidate.branchId !== branchId) {
      throw new Error("Cannot score a candidate from another branch");
    }
    database.prepare(`
      UPDATE candidates
      SET scores_json = ?,
          fitness = ?,
          updated_at = ?
      WHERE id = ?
    `).run(stableJson(scores), fitness, updatedAt, candidateId);

    const storedCandidate = readCandidateById(database, candidateId);
    appendEventsInTransaction(database, [
      createCandidateAuditEvent("candidate.scored", session.id, branchId, storedCandidate, updatedAt),
    ]);
    return storedCandidate;
  });
}

export function retainCandidates(database, request) {
  return setCandidateStatus(database, request, "elite", "candidate.retained");
}

export function purgeCandidates(database, request) {
  return setCandidateStatus(database, request, "purged", "candidate.purged");
}

export function reserveCandidates(database, request) {
  return setCandidateStatus(database, request, "reserved", "candidate.reserved");
}

export function capCandidates(database, request) {
  const session = getRequiredSession(database, request.sessionId);
  const kind = normalizeCandidateKind(request.kind);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const limit = normalizeLimit(request.limit, 50);
  const updatedAt = request.updatedAt ?? new Date().toISOString();

  return withImmediateTransaction(database, () => {
    const candidates = listCandidates(database, {
      branchId,
      kind,
      includePurged: false,
      limit: MAX_CANDIDATE_LIMIT,
      order: "fitness",
    });
    const kept = candidates.slice(0, limit);
    const overflow = candidates.slice(limit);
    const purged = updateCandidateStatusesInTransaction(
      database,
      overflow.map((candidate) => candidate.id),
      "purged",
      updatedAt,
      branchId,
    );
    if (purged.length > 0) {
      appendEventsInTransaction(
        database,
        purged.map((candidate) =>
          createCandidateAuditEvent("candidate.purged", session.id, branchId, candidate, updatedAt, {
            reason: "cap",
            limit,
          })
        ),
      );
    }
    return {
      kept,
      purged,
    };
  });
}

export function selectCandidates(database, request) {
  const session = getRequiredSession(database, request.sessionId);
  const kind = normalizeCandidateKind(request.kind);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const eliteLimit = normalizeLimit(request.eliteLimit, 10);
  const updatedAt = request.updatedAt ?? new Date().toISOString();

  return withImmediateTransaction(database, () => {
    const candidates = listCandidates(database, {
      branchId,
      kind,
      includePurged: false,
      limit: MAX_CANDIDATE_LIMIT,
      order: "fitness",
    });
    const eliteTargets = candidates.slice(0, eliteLimit);
    const overflow = candidates.slice(eliteLimit);
    const rankById = new Map(candidates.map((candidate, index) => [candidate.id, index + 1]));
    const retained = updateCandidateStatusesInTransaction(
      database,
      eliteTargets
        .filter((candidate) => candidate.status !== "elite")
        .map((candidate) => candidate.id),
      "elite",
      updatedAt,
      branchId,
    );
    const purged = updateCandidateStatusesInTransaction(
      database,
      overflow.map((candidate) => candidate.id),
      "purged",
      updatedAt,
      branchId,
    );
    const auditEvents = [
      ...retained.map((candidate) =>
        createCandidateAuditEvent("candidate.retained", session.id, branchId, candidate, updatedAt, {
          reason: "selection",
          eliteLimit,
          rank: rankById.get(candidate.id),
        })
      ),
      ...purged.map((candidate) =>
        createCandidateAuditEvent("candidate.purged", session.id, branchId, candidate, updatedAt, {
          reason: "selection",
          eliteLimit,
          rank: rankById.get(candidate.id),
        })
      ),
    ];
    if (auditEvents.length > 0) {
      appendEventsInTransaction(database, auditEvents);
    }

    return {
      kind,
      branchId,
      eliteLimit,
      evaluatedCount: candidates.length,
      elite: eliteTargets
        .map((candidate) => readCandidateById(database, candidate.id))
        .filter(Boolean),
      purged,
    };
  });
}

export function developCandidate(database, request) {
  const session = getRequiredSession(database, request.sessionId);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const parentId = requireCandidateId(request.parentId, "parentId");
  const mutation = normalizeCandidateDevelopmentMutation(request.mutation);
  const updatedAt = request.createdAt ?? new Date().toISOString();

  return withImmediateTransaction(database, () => {
    const parent = readCandidateById(database, parentId);
    if (!parent) {
      throw new Error(`Cannot develop missing candidate: ${parentId}`);
    }
    if (parent.branchId !== branchId) {
      throw new Error("Cannot develop a candidate from another branch");
    }
    if (parent.status !== "elite" && parent.status !== "reserved") {
      throw new Error("Candidate development requires an elite or reserved parent");
    }
    if (parent.kind !== "phrase") {
      throw new Error("Candidate development currently supports phrase genomes only");
    }

    const childGenome = applyCandidateDevelopmentMutation(parent.genome, mutation);
    if (stableJson(childGenome) === stableJson(parent.genome)) {
      throw new Error("Candidate development mutation did not change the genome");
    }
    const childSeed = request.seed === undefined
      ? deriveChildSeed(parent, mutation)
      : clampInteger(request.seed, 0, 0xffffffff, "seed");
    const child = normalizeCandidateInput({
      kind: parent.kind,
      genome: childGenome,
      scores: {},
      fitness: 0,
      parentId: parent.id,
      generation: parent.generation + 1,
      seed: childSeed,
      status: "alive",
      createdAtBeat: request.createdAtBeat ?? parent.createdAtBeat,
    }, branchId);
    const existingChild = readCandidateById(database, child.id);
    if (existingChild) {
      return {
        parent,
        child: existingChild,
        mutation,
      };
    }

    database.prepare(`
      INSERT INTO candidates (
        id,
        branch_id,
        kind,
        genome_json,
        scores_json,
        fitness,
        parent_id,
        generation,
        seed,
        status,
        created_at_beat,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      child.id,
      branchId,
      child.kind,
      stableJson(child.genome),
      stableJson(child.scores),
      child.fitness,
      child.parentId ?? null,
      child.generation,
      child.seed,
      child.status,
      child.createdAtBeat ?? null,
      updatedAt,
      updatedAt,
    );

    const storedChild = readCandidateById(database, child.id);
    appendEventsInTransaction(database, [
      createCandidateAuditEvent("candidate.created", session.id, branchId, storedChild, updatedAt, {
        reason: "development",
        parentId: parent.id,
        mutation,
      }),
    ]);
    return {
      parent,
      child: storedChild,
      mutation,
    };
  });
}

export function listCandidates(database, options = {}) {
  const clauses = [];
  const params = [];
  if (options.branchId) {
    clauses.push("branch_id = ?");
    params.push(options.branchId);
  }
  if (options.kind) {
    clauses.push("kind = ?");
    params.push(normalizeCandidateKind(options.kind));
  }
  if (options.status) {
    clauses.push("status = ?");
    params.push(normalizeCandidateStatus(options.status));
  } else if (options.includePurged === false) {
    clauses.push("status != 'purged'");
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = normalizeLimit(options.limit, 50);
  const orderBy = options.order === "fitness"
    ? "fitness DESC, generation ASC, created_at ASC, id ASC"
    : "updated_at DESC, created_at DESC, id ASC";
  const rows = database.prepare(`
    SELECT
      id,
      branch_id AS branchId,
      kind,
      genome_json AS genomeJson,
      scores_json AS scoresJson,
      fitness,
      parent_id AS parentId,
      generation,
      seed,
      status,
      created_at_beat AS createdAtBeat,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM candidates
    ${where}
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(...params, limit);
  return rows.map(parseCandidateRow);
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
      beat,
      scheduled_beat AS scheduledBeat,
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
    candidates: listCandidates(database, { limit: options.candidateLimit ?? options.limit ?? 50 }),
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
      beat,
      scheduled_beat AS scheduledBeat,
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

function readCandidateById(database, candidateId) {
  const row = database.prepare(`
    SELECT
      id,
      branch_id AS branchId,
      kind,
      genome_json AS genomeJson,
      scores_json AS scoresJson,
      fitness,
      parent_id AS parentId,
      generation,
      seed,
      status,
      created_at_beat AS createdAtBeat,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM candidates
    WHERE id = ?
  `).get(candidateId);
  return row ? parseCandidateRow(row) : null;
}

function setCandidateStatus(database, request, status, auditType) {
  const session = getRequiredSession(database, request.sessionId);
  const branchId = request.branchId ?? session.branchId ?? "main";
  const candidateIds = normalizeCandidateIds(request.candidateIds);
  const updatedAt = request.updatedAt ?? new Date().toISOString();
  return withImmediateTransaction(database, () => {
    const candidates = updateCandidateStatusesInTransaction(database, candidateIds, status, updatedAt, branchId);
    appendEventsInTransaction(
      database,
      candidates.map((candidate) =>
        createCandidateAuditEvent(auditType, session.id, branchId, candidate, updatedAt)
      ),
    );
    return candidates;
  });
}

function updateCandidateStatusesInTransaction(database, candidateIds, status, updatedAt, branchId) {
  const normalizedStatus = normalizeCandidateStatus(status);
  const candidates = [];
  for (const candidateId of candidateIds) {
    const existingCandidate = readCandidateById(database, candidateId);
    if (!existingCandidate) {
      throw new Error(`Cannot update missing candidate: ${candidateId}`);
    }
    if (existingCandidate.branchId !== branchId) {
      throw new Error("Cannot update a candidate from another branch");
    }
    database.prepare(`
      UPDATE candidates
      SET status = ?,
          updated_at = ?
      WHERE id = ?
    `).run(normalizedStatus, updatedAt, candidateId);
    const candidate = readCandidateById(database, candidateId);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function createCandidateAuditEvent(type, sessionId, branchId, candidate, createdAt, extraPayload = {}) {
  return {
    sessionId,
    branchId,
    type,
    actorId: "candidate-store",
    payload: {
      candidateId: candidate.id,
      kind: candidate.kind,
      status: candidate.status,
      fitness: candidate.fitness,
      parentId: candidate.parentId,
      generation: candidate.generation,
      seed: candidate.seed,
      candidate,
      ...extraPayload,
    },
    createdAt,
  };
}

function getRequiredSession(database, sessionId) {
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("Candidate store requires sessionId");
  }
  const session = getSession(database, sessionId);
  if (!session) {
    throw new Error(`Candidate store requires existing session: ${sessionId}`);
  }
  return session;
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

function validateEventInput(event) {
  if (!event.sessionId) {
    throw new Error("appendEvent requires sessionId");
  }
  if (!event.type || typeof event.type !== "string") {
    throw new Error("appendEvent requires a string type");
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
    beat: row.beat,
    scheduledBeat: row.scheduledBeat,
    actorId: row.actorId,
    sessionMode: row.sessionMode,
    type: row.type,
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  };
}

function parseCandidateRow(row) {
  const candidate = {
    id: row.id,
    branchId: row.branchId,
    kind: row.kind,
    genome: JSON.parse(row.genomeJson),
    scores: JSON.parse(row.scoresJson),
    fitness: row.fitness,
    parentId: row.parentId ?? undefined,
    generation: row.generation,
    seed: row.seed,
    status: row.status,
    createdAtBeat: row.createdAtBeat ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return candidate;
}

function normalizeCandidateInput(input, branchId = "main") {
  if (!isRecord(input)) {
    throw new Error("Candidate must be an object");
  }
  const kind = normalizeCandidateKind(input.kind);
  const genome = normalizeCandidateGenome(kind, input.genome);
  const scores = normalizeScores(input.scores ?? {});
  const fitness = clampFiniteNumber(input.fitness ?? 0, 0, 1, "fitness");
  const generation = clampInteger(input.generation ?? 0, 0, 10_000, "generation");
  const seed = clampInteger(input.seed ?? 0, 0, 0xffffffff, "seed");
  const status = normalizeCandidateStatus(input.status ?? "alive");
  const parentId = input.parentId === undefined
    ? undefined
    : scopeCandidateIdForBranch(requireCandidateId(input.parentId, "parentId"), branchId);
  const createdAtBeat = input.createdAtBeat === undefined
    ? undefined
    : clampFiniteNumber(input.createdAtBeat, 0, 1_000_000, "createdAtBeat");
  const candidateWithoutId = removeUndefined({
    kind,
    genome,
    scores,
    fitness,
    parentId,
    generation,
    seed,
    status,
    createdAtBeat,
  });
  const id = scopeCandidateIdForBranch(
    input.id === undefined
      ? `candidate-${stableHash(stableJson(candidateWithoutId))}`
      : requireCandidateId(input.id),
    branchId,
  );
  const candidate = removeUndefined({
    id,
    ...candidateWithoutId,
  });
  const genomeLength = stableJson(candidate.genome).length;
  if (genomeLength > 20_000) {
    throw new Error("Candidate genome JSON exceeds 20000 characters");
  }
  return candidate;
}

function scopeCandidateIdForBranch(candidateId, branchId = "main") {
  const safeBranchId = normalizeBranchId(branchId);
  const prefix = `b${stableHash(safeBranchId)}:`;
  if (candidateId.startsWith(prefix)) return candidateId;
  const readableId = `${prefix}${candidateId}`;
  return readableId.length <= 120
    ? readableId
    : `${prefix}${stableHash(candidateId)}`;
}

function normalizeBranchId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9:_-]{1,120}$/.test(value) ? value : "main";
}

function normalizeCandidateGenome(kind, genome) {
  if (kind === "phrase") {
    return normalizePhraseGenome(genome);
  }
  return normalizeBoundedJson(genome, "genome");
}

function normalizePhraseGenome(genome) {
  if (!isRecord(genome)) {
    throw new Error("Phrase candidate genome must be a PlayerPatternSource object");
  }
  const rawEvents = Array.isArray(genome.events) ? genome.events : null;
  if (!rawEvents) {
    throw new Error("Phrase candidate genome events must be an array");
  }
  const events = rawEvents.slice(0, 128).map((event, index) => {
    if (event === null) return null;
    if (!isRecord(event)) {
      throw new Error(`Phrase candidate event ${index} must be null or an object`);
    }
    return {
      playerId: typeof event.playerId === "string" && event.playerId.trim().length > 0
        ? event.playerId.trim().slice(0, 48)
        : "melody",
      scaleDegree: clampInteger(event.scaleDegree ?? 0, -28, 28, `genome.events.${index}.scaleDegree`),
      octave: clampInteger(event.octave ?? 4, 0, 8, `genome.events.${index}.octave`),
      duration: typeof event.duration === "string" && event.duration.trim().length > 0
        ? event.duration.trim().slice(0, 16)
        : "8n",
      durationBeats: clampFiniteNumber(event.durationBeats ?? 0.5, 0.0625, 8, `genome.events.${index}.durationBeats`),
      velocity: clampFiniteNumber(event.velocity ?? 0.3, 0, 1, `genome.events.${index}.velocity`),
    };
  });
  if (events.length === 0) {
    throw new Error("Phrase candidate genome must include at least one event slot");
  }
  return {
    subdivisionBeats: clampFiniteNumber(genome.subdivisionBeats ?? 1, 0.125, 4, "genome.subdivisionBeats"),
    events,
  };
}

function normalizeBoundedJson(value, label, depth = 0) {
  if (depth > 8) {
    throw new Error(`${label} exceeds max JSON depth`);
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return roundTo(value, 6);
  }
  if (typeof value === "string") return value.slice(0, 1_000);
  if (Array.isArray(value)) {
    return value.slice(0, 256).map((item, index) => normalizeBoundedJson(item, `${label}.${index}`, depth + 1));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 64)
        .map(([key, item]) => [key.slice(0, 80), normalizeBoundedJson(item, `${label}.${key}`, depth + 1)]),
    );
  }
  throw new Error(`${label} must be JSON-serializable`);
}

function normalizeScores(value) {
  if (!isRecord(value)) {
    throw new Error("Candidate scores must be an object");
  }
  return Object.fromEntries(
    Object.entries(value).slice(0, MAX_SCORE_KEYS).map(([key, rawValue]) => {
      const scoreKey = key.trim().slice(0, 48);
      if (!/^[a-zA-Z0-9_.:-]+$/.test(scoreKey)) {
        throw new Error(`Candidate score key is not allowed: ${key}`);
      }
      return [scoreKey, clampFiniteNumber(rawValue, 0, 1, `scores.${scoreKey}`)];
    }),
  );
}

function normalizeCandidateKind(value) {
  if (typeof value === "string" && CANDIDATE_KINDS.includes(value)) return value;
  throw new Error(`Candidate kind must be one of ${CANDIDATE_KINDS.join(", ")}`);
}

function normalizeCandidateStatus(value) {
  if (typeof value === "string" && CANDIDATE_STATUSES.includes(value)) return value;
  throw new Error(`Candidate status must be one of ${CANDIDATE_STATUSES.join(", ")}`);
}

function requireCandidateId(value, label = "candidateId") {
  if (typeof value !== "string" || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.trim())) {
    throw new Error(`${label} must be 1-120 chars of letters, numbers, colon, underscore, or dash`);
  }
  return value.trim();
}

function normalizeCandidateIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("candidateIds must be a non-empty array");
  }
  return value.map((candidateId) => requireCandidateId(candidateId));
}

function normalizeCandidateDevelopmentMutation(value) {
  if (!isRecord(value)) {
    throw new Error("Candidate development mutation must be an object");
  }
  if (value.type === "phrase.replace") {
    return {
      type: "phrase.replace",
      operator: normalizeProsodyDevelopmentOperator(value.operator),
      genome: normalizePhraseGenome(value.genome),
    };
  }
  if (value.type !== "phrase.nudge") {
    throw new Error("Candidate development mutation type must be phrase.nudge or phrase.replace");
  }
  const mutation = {
    type: "phrase.nudge",
    scaleDegreeDelta: clampInteger(value.scaleDegreeDelta ?? 0, -7, 7, "mutation.scaleDegreeDelta"),
    octaveDelta: clampInteger(value.octaveDelta ?? 0, -2, 2, "mutation.octaveDelta"),
    velocityMultiplier: clampFiniteNumber(value.velocityMultiplier ?? 1, 0.25, 2, "mutation.velocityMultiplier"),
    rotateSteps: clampInteger(value.rotateSteps ?? 0, -128, 128, "mutation.rotateSteps"),
  };
  if (
    mutation.scaleDegreeDelta === 0 &&
    mutation.octaveDelta === 0 &&
    mutation.velocityMultiplier === 1 &&
    mutation.rotateSteps === 0
  ) {
    throw new Error("Candidate development mutation must change at least one bounded knob");
  }
  return mutation;
}

function applyCandidateDevelopmentMutation(genome, mutation) {
  if (mutation.type === "phrase.replace") {
    return normalizePhraseGenome(deepCloneJson(mutation.genome));
  }

  const childGenome = deepCloneJson(genome);
  if (!isRecord(childGenome) || !Array.isArray(childGenome.events)) {
    throw new Error("Phrase development requires a PlayerPatternSource genome");
  }
  childGenome.events = rotateArray(
    childGenome.events.map((event) => {
      if (event === null) return null;
      if (!isRecord(event)) return event;
      return {
        ...event,
        scaleDegree: clampInteger(
          readFiniteNumber(event.scaleDegree, 0) + mutation.scaleDegreeDelta,
          -28,
          28,
          "child.scaleDegree",
        ),
        octave: clampInteger(
          readFiniteNumber(event.octave, 4) + mutation.octaveDelta,
          0,
          8,
          "child.octave",
        ),
        velocity: clampFiniteNumber(
          readFiniteNumber(event.velocity, 0) * mutation.velocityMultiplier,
          0,
          1,
          "child.velocity",
        ),
      };
    }),
    mutation.rotateSteps,
  );
  return normalizePhraseGenome(childGenome);
}

function normalizeProsodyDevelopmentOperator(value) {
  if (!isRecord(value)) {
    throw new Error("Prosody development operator must be an object");
  }
  if (value.type === "reFoot") {
    return {
      type: "reFoot",
      seed: clampInteger(value.seed ?? 0, 0, 0xffffffff, "operator.seed"),
    };
  }
  if (value.type === "varyContour") {
    return {
      type: "varyContour",
      action: normalizeOneOf(value.action, [
        "invert",
        "retrograde",
        "transposeUp",
        "transposeDown",
        "narrow",
        "widen",
      ], "operator.action"),
    };
  }
  if (value.type === "alterCadence") {
    return {
      type: "alterCadence",
      action: normalizeOneOf(value.action, [
        "question-to-answer",
        "answer-to-question",
        "extend-cadence",
        "shift-accent",
      ], "operator.action"),
    };
  }
  if (value.type === "shiftAnacrusis") {
    return {
      type: "shiftAnacrusis",
      action: normalizeOneOf(value.action, [
        "add",
        "remove",
        "lengthen",
        "shorten",
      ], "operator.action"),
    };
  }
  throw new Error("Prosody development operator type must be reFoot, varyContour, alterCadence, or shiftAnacrusis");
}

function normalizeOneOf(value, allowedValues, label) {
  if (typeof value === "string" && allowedValues.includes(value)) return value;
  throw new Error(`${label} must be one of ${allowedValues.join(", ")}`);
}

function rotateArray(value, steps) {
  if (value.length === 0) return value;
  const offset = ((steps % value.length) + value.length) % value.length;
  if (offset === 0) return value;
  return [
    ...value.slice(value.length - offset),
    ...value.slice(0, value.length - offset),
  ];
}

function deriveChildSeed(parent, mutation) {
  return parseInt(stableHash(`${parent.id}:${parent.seed}:${parent.generation}:${stableJson(mutation)}`), 36);
}

function readFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 500);
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  return JSON.stringify(value ?? {});
}

function clampFiniteNumber(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return roundTo(Math.min(maximum, Math.max(minimum, value)), 4);
}

function clampInteger(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function roundTo(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
