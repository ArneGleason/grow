export type PersistenceRecordType =
  | "session.started"
  | "session.mode_changed"
  | "song.changed"
  | "timing.feel_changed";

export type PersistenceStatus = "idle" | "scheduled" | "flushing" | "error";

export interface PersistenceSessionInput {
  id?: string;
  spaceId?: string;
  branchId?: string;
  name: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistenceEventInput {
  type: PersistenceRecordType;
  beat?: number;
  tick?: number;
  actorId?: string;
  sessionMode?: string;
  payload?: Record<string, unknown>;
}

export interface PersistenceEvent extends PersistenceEventInput {
  id: string;
  sessionId: string;
  branchId: string;
  createdAt: string;
}

export interface PersistenceClientState {
  sessionId: string;
  branchId: string;
  status: PersistenceStatus;
  pendingCount: number;
  appendedCount: number;
  lastFlushAt?: string;
  lastError?: string;
  lastEventTypes: readonly PersistenceRecordType[];
}

export interface PersistenceClient {
  record(event: PersistenceEventInput): PersistenceEvent;
  flush(): Promise<void>;
  dump(limit?: number): Promise<unknown>;
  getState(): PersistenceClientState;
}

const APPEND_ENDPOINT = "/api/persistence/append";
const DUMP_ENDPOINT = "/api/persistence/dump";
const FLUSH_DELAY_MS = 100;
const MAX_BATCH_SIZE = 25;

export function createPersistenceClient(sessionInput: PersistenceSessionInput): PersistenceClient {
  const session = {
    id: sessionInput.id ?? createId("session"),
    spaceId: sessionInput.spaceId ?? "main",
    branchId: sessionInput.branchId ?? "main",
    name: sessionInput.name,
    createdAt: sessionInput.createdAt ?? new Date().toISOString(),
    metadata: sessionInput.metadata ?? {},
  };
  const queue: PersistenceEvent[] = [];
  let flushTimer: number | undefined;
  let flushPromise: Promise<void> | undefined;
  let state: PersistenceClientState = {
    sessionId: session.id,
    branchId: session.branchId,
    status: "idle",
    pendingCount: 0,
    appendedCount: 0,
    lastEventTypes: [],
  };

  const syncPendingState = () => {
    state = {
      ...state,
      pendingCount: queue.length,
    };
  };

  const scheduleFlush = () => {
    if (flushTimer !== undefined || flushPromise) return;
    state = {
      ...state,
      status: "scheduled",
      pendingCount: queue.length,
    };
    flushTimer = window.setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, FLUSH_DELAY_MS);
  };

  const flush = async () => {
    if (flushPromise) return flushPromise;
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (queue.length === 0) {
      state = { ...state, status: "idle", pendingCount: 0 };
      return;
    }

    flushPromise = flushBatch();
    try {
      await flushPromise;
    } finally {
      flushPromise = undefined;
      if (queue.length > 0 && state.status !== "error") {
        scheduleFlush();
      }
    }
  };

  const flushBatch = async () => {
    const batch = queue.slice(0, MAX_BATCH_SIZE);
    state = {
      ...state,
      status: "flushing",
      pendingCount: queue.length,
      lastError: undefined,
    };
    try {
      const response = await fetch(APPEND_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, events: batch }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { events?: unknown[] };
      queue.splice(0, batch.length);
      state = {
        ...state,
        status: "idle",
        pendingCount: queue.length,
        appendedCount: state.appendedCount + (payload.events?.length ?? batch.length),
        lastFlushAt: new Date().toISOString(),
        lastEventTypes: batch.map((event) => event.type),
      };
    } catch (error) {
      state = {
        ...state,
        status: "error",
        pendingCount: queue.length,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  };

  return {
    record(event) {
      const queuedEvent: PersistenceEvent = {
        ...event,
        id: createId("event"),
        sessionId: session.id,
        branchId: session.branchId,
        createdAt: new Date().toISOString(),
      };
      queue.push(queuedEvent);
      syncPendingState();
      scheduleFlush();
      return { ...queuedEvent };
    },
    flush,
    dump: async (limit = 50) => {
      const response = await fetch(`${DUMP_ENDPOINT}?limit=${encodeURIComponent(String(limit))}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    getState: () => ({
      ...state,
      lastEventTypes: [...state.lastEventTypes],
    }),
  };
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
