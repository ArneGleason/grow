#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  DEFAULT_DATABASE_PATH,
  appendEvent,
  databaseExists,
  dumpGrowDatabase,
  ensureSession,
  getSchemaVersion,
  listCandidates,
  openGrowDatabase,
  resolveDatabasePath,
  scoreCandidate,
  selectCandidates,
  writeCandidate,
} from "../server/persistence.mjs";

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);

try {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else if (command === "init") {
    runInit(args);
  } else if (command === "dump") {
    runDump(args);
  } else if (command === "smoke") {
    runSmoke();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function runInit(rawArgs) {
  const { values } = parseCliArgs(rawArgs);
  const databasePath = resolveDatabasePath(values.db);
  const database = openGrowDatabase({ databasePath });
  try {
    console.log(JSON.stringify({
      ok: true,
      databasePath,
      schemaVersion: getSchemaVersion(database),
    }, null, 2));
  } finally {
    database.close();
  }
}

function runDump(rawArgs) {
  const { values } = parseCliArgs(rawArgs);
  const databasePath = resolveDatabasePath(values.db);
  if (!databaseExists(values.db)) {
    console.log(JSON.stringify({
      databasePath,
      initialized: false,
      schemaVersion: null,
      sessions: [],
      events: [],
      message: "No database found; run npm run db:init first.",
    }, null, 2));
    return;
  }

  const database = openGrowDatabase({ databasePath });
  try {
    console.log(JSON.stringify({
      databasePath,
      initialized: true,
      ...dumpGrowDatabase(database, { limit: values.limit }),
    }, null, 2));
  } finally {
    database.close();
  }
}

function runSmoke() {
  const directory = mkdtempSync(join(tmpdir(), "grow-db-"));
  const databasePath = join(directory, "grow.sqlite3");
  const database = openGrowDatabase({ databasePath });
  try {
    const now = "2026-01-01T00:00:00.000Z";
    const session = ensureSession(database, {
      id: "smoke-session",
      name: "Persistence smoke",
      createdAt: now,
      metadata: { byte: "13b-a" },
    });
    const started = appendEvent(database, {
      sessionId: session.id,
      type: "session.started",
      payload: { source: "db:smoke" },
      createdAt: now,
    });
    const modeChanged = appendEvent(database, {
      sessionId: session.id,
      type: "session.mode_changed",
      sessionMode: "rehearsal",
      beat: 0,
      payload: { fromMode: "break", toMode: "rehearsal" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    const candidate = writeCandidate(database, {
      sessionId: session.id,
      candidate: {
        id: "phrase-smoke-a",
        kind: "phrase",
        genome: createSmokePhraseGenome(0),
        generation: 0,
        seed: 11,
        status: "alive",
        createdAtBeat: 0,
      },
      createdAt: "2026-01-01T00:00:02.000Z",
    });
    const scored = scoreCandidate(database, {
      sessionId: session.id,
      candidateId: candidate.id,
      scores: { melody: 1.2, groove: 0.42 },
      fitness: 0.9,
      updatedAt: "2026-01-01T00:00:03.000Z",
    });
    writeCandidate(database, {
      sessionId: session.id,
      candidate: {
        id: "phrase-smoke-b",
        kind: "phrase",
        genome: createSmokePhraseGenome(2),
        scores: { melody: 0.1 },
        fitness: 0.1,
        generation: 0,
        seed: 12,
        status: "alive",
      },
      createdAt: "2026-01-01T00:00:05.000Z",
    });
    const selected = selectCandidates(database, {
      sessionId: session.id,
      kind: "phrase",
      eliteLimit: 1,
      updatedAt: "2026-01-01T00:00:06.000Z",
    });
    const dump = dumpGrowDatabase(database);
    const phraseCandidates = listCandidates(database, { kind: "phrase", limit: 10 });
    assert(session.id === "smoke-session", "session should round-trip");
    assert(started.seq === 1, "first event should have seq 1");
    assert(modeChanged.seq === 2, "second event should have seq 2");
    assert(dump.sessions.length === 1, "dump should include one session");
    assert(dump.events.length === 7, "dump should include decision and candidate audit events");
    assert(dump.events[0].type === "candidate.purged", "dump should sort newest event first");
    assert(scored.scores.melody === 1, "scores should clamp to 1");
    assert(selected.elite[0].status === "elite", "selection should mark top candidate elite");
    assert(selected.purged.length === 1, "selection should purge one lower-fitness candidate");
    assert(phraseCandidates.length === 2, "candidate query should include both phrase candidates");
    assert(dump.candidates.length === 2, "dump should include candidate rows");
    console.log(JSON.stringify({
      ok: true,
      schemaVersion: dump.schemaVersion,
      sessionCount: dump.sessions.length,
      eventCount: dump.events.length,
      candidateCount: dump.candidates.length,
      eventTypes: dump.events.map((event) => event.type).reverse(),
      candidateStatuses: dump.candidates.map((row) => `${row.id}:${row.status}`).sort(),
    }, null, 2));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function createSmokePhraseGenome(offset) {
  return {
    subdivisionBeats: 0.5,
    events: [
      {
        playerId: "melody",
        scaleDegree: offset,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.3,
      },
      null,
    ],
  };
}

function parseCliArgs(rawArgs) {
  return parseArgs({
    args: rawArgs,
    options: {
      db: { type: "string", default: DEFAULT_DATABASE_PATH },
      limit: { type: "string", default: "50" },
    },
    allowPositionals: false,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(`Persistence smoke failed: ${message}`);
}

function printHelp() {
  console.log(`Grow persistence shell

Usage:
  node scripts/grow-db.mjs init [--db data/grow.sqlite3]
  node scripts/grow-db.mjs dump [--db data/grow.sqlite3] [--limit 50]
  node scripts/grow-db.mjs smoke

The default database path can also be set with GROW_DB_PATH.
The dev app writes low-frequency decision records, musical events, and candidate-store rows through /api/persistence/*.`);
}
