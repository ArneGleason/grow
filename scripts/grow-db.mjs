#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  DEFAULT_DATABASE_PATH,
  appendEvent,
  dumpGrowDatabase,
  ensureSession,
  getSchemaVersion,
  openGrowDatabase,
  resolveDatabasePath,
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
  const database = openGrowDatabase({ databasePath });
  try {
    console.log(JSON.stringify({
      databasePath,
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
      bar: 0,
      payload: { fromMode: "break", toMode: "rehearsal" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    const dump = dumpGrowDatabase(database);
    assert(session.id === "smoke-session", "session should round-trip");
    assert(started.seq === 1, "first event should have seq 1");
    assert(modeChanged.seq === 2, "second event should have seq 2");
    assert(dump.sessions.length === 1, "dump should include one session");
    assert(dump.events.length === 2, "dump should include two events");
    assert(dump.events[0].type === "session.mode_changed", "dump should sort newest event first");
    console.log(JSON.stringify({
      ok: true,
      schemaVersion: dump.schemaVersion,
      sessionCount: dump.sessions.length,
      eventCount: dump.events.length,
      eventTypes: dump.events.map((event) => event.type).reverse(),
    }, null, 2));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
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
Byte 13b-a only initializes and inspects the local SQLite shell; the app does not write events yet.`);
}
