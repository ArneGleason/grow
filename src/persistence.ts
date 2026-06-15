import type {
  CandidateCapOptions,
  CandidateCapResult,
  CandidateInput,
  CandidateQueryOptions,
  CandidateScores,
  CandidateDevelopmentOptions,
  CandidateDevelopmentResult,
  CandidateSelectionOptions,
  CandidateSelectionResult,
  StoredCandidate,
} from "./candidate-store";
import { scopeCandidateInputForBranch } from "./candidate-store";

export type PersistenceRecordType =
  | "session.started"
  | "session.mode_changed"
  | "song.changed"
  | "song.goal_set"
  | "song.form_variant_changed"
  | "timing.feel_changed"
  | "song.melody_critic_selection"
  | "song.take_feedback"
  | "musical.event_recorded"
  | "candidate.created"
  | "candidate.scored"
  | "candidate.retained"
  | "candidate.reserved"
  | "candidate.purged";

export type PersistenceStatus = "idle" | "scheduled" | "flushing" | "retrying" | "error";

export interface PersistenceSessionInput {
  id?: string;
  spaceId?: string;
  branchId?: string;
  name: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PersistenceEventInput {
  id?: string;
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
  retryAttempt: number;
  lastFlushAt?: string;
  lastPagehideFlushAt?: string;
  lastError?: string;
  nextRetryAt?: string;
  lastEventTypes: readonly PersistenceRecordType[];
}

export interface PersistenceClient {
  record(event: PersistenceEventInput): PersistenceEvent;
  flush(): Promise<void>;
  flushOnPageHide(): void;
  dump(limit?: number): Promise<unknown>;
  writeCandidate(candidate: CandidateInput, branchId?: string): Promise<StoredCandidate>;
  listCandidates(options?: CandidateQueryOptions): Promise<readonly StoredCandidate[]>;
  scoreCandidate(
    candidateId: string,
    scores: CandidateScores,
    fitness: number,
    branchId?: string,
  ): Promise<StoredCandidate>;
  retainCandidates(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
  reserveCandidates(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
  purgeCandidates(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
  capCandidates(options: CandidateCapOptions): Promise<CandidateCapResult>;
  selectCandidates(options: CandidateSelectionOptions): Promise<CandidateSelectionResult>;
  developCandidate(options: CandidateDevelopmentOptions): Promise<CandidateDevelopmentResult>;
  getState(): PersistenceClientState;
}

export interface PersistenceClientOptions {
  onStateChange?: (state: PersistenceClientState) => void;
}

const APPEND_ENDPOINT = "/api/persistence/append";
const DUMP_ENDPOINT = "/api/persistence/dump";
const CANDIDATES_ENDPOINT = "/api/persistence/candidates";
const FLUSH_DELAY_MS = 100;
const MAX_BATCH_SIZE = 25;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;
const RETRY_MAX_DELAY_MS = 1_000;

export function createPersistenceClient(
  sessionInput: PersistenceSessionInput,
  options: PersistenceClientOptions = {},
): PersistenceClient {
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
    retryAttempt: 0,
    lastEventTypes: [],
  };

  const snapshotState = (): PersistenceClientState => ({
    ...state,
    lastEventTypes: [...state.lastEventTypes],
  });

  const setState = (nextState: PersistenceClientState) => {
    state = nextState;
    options.onStateChange?.(snapshotState());
  };

  const syncPendingState = () => {
    setState({
      ...state,
      pendingCount: queue.length,
    });
  };

  const scheduleFlush = (
    delayMs = FLUSH_DELAY_MS,
    status: PersistenceStatus = "scheduled",
  ) => {
    if (queue.length === 0) return;
    if (flushTimer !== undefined || flushPromise) return;
    setState({
      ...state,
      status,
      pendingCount: queue.length,
      nextRetryAt: status === "retrying"
        ? new Date(Date.now() + delayMs).toISOString()
        : undefined,
    });
    flushTimer = window.setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, delayMs);
  };

  const flush = async () => {
    if (flushPromise) return flushPromise;
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (queue.length === 0) {
      setState({
        ...state,
        status: "idle",
        pendingCount: 0,
        retryAttempt: 0,
        nextRetryAt: undefined,
      });
      return;
    }

    flushPromise = flushBatch();
    try {
      await flushPromise;
    } finally {
      flushPromise = undefined;
      if (queue.length > 0 && state.status === "retrying") {
        scheduleFlush(getRetryDelayMs(state.retryAttempt), "retrying");
      } else if (queue.length > 0 && state.status !== "error") {
        scheduleFlush();
      }
    }
  };

  const flushBatch = async () => {
    const batch = queue.slice(0, MAX_BATCH_SIZE);
    setState({
      ...state,
      status: "flushing",
      pendingCount: queue.length,
      lastError: undefined,
      nextRetryAt: undefined,
    });
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
      setState({
        ...state,
        status: "idle",
        pendingCount: queue.length,
        appendedCount: state.appendedCount + (payload.events?.length ?? batch.length),
        retryAttempt: 0,
        lastFlushAt: new Date().toISOString(),
        nextRetryAt: undefined,
        lastError: undefined,
        lastEventTypes: batch.map((event) => event.type),
      });
    } catch (error) {
      const retryAttempt = state.retryAttempt + 1;
      const lastError = error instanceof Error ? error.message : String(error);
      if (retryAttempt <= MAX_RETRY_ATTEMPTS) {
        setState({
          ...state,
          status: "retrying",
          pendingCount: queue.length,
          retryAttempt,
          lastError,
          nextRetryAt: undefined,
        });
        return;
      }
      setState({
        ...state,
        status: "error",
        pendingCount: queue.length,
        retryAttempt,
        lastError,
        nextRetryAt: undefined,
      });
    }
  };

  const flushOnPageHide = () => {
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (queue.length === 0) return;

    const batch = queue.slice(0, MAX_BATCH_SIZE);
    const body = JSON.stringify({ session, events: batch });
    const blob = new Blob([body], { type: "application/json" });
    const sentByBeacon = navigator.sendBeacon?.(APPEND_ENDPOINT, blob) ?? false;
    if (!sentByBeacon) {
      void fetch(APPEND_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }

    setState({
      ...state,
      status: "flushing",
      pendingCount: queue.length,
      lastPagehideFlushAt: new Date().toISOString(),
      lastError: undefined,
      nextRetryAt: undefined,
    });
  };

  return {
    record(event) {
      const queuedEvent: PersistenceEvent = {
        ...event,
        id: event.id ?? createId("event"),
        sessionId: session.id,
        branchId: session.branchId,
        createdAt: new Date().toISOString(),
      };
      queue.push(queuedEvent);
      if (state.status === "error") {
        setState({
          ...state,
          status: "idle",
          pendingCount: queue.length,
          retryAttempt: 0,
          nextRetryAt: undefined,
          lastError: undefined,
        });
      } else {
        syncPendingState();
      }
      scheduleFlush();
      return { ...queuedEvent };
    },
    flush,
    flushOnPageHide,
    dump: async (limit = 50) => {
      const response = await fetch(`${DUMP_ENDPOINT}?limit=${encodeURIComponent(String(limit))}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    writeCandidate: async (candidate, branchId) => {
      const candidateBranchId = branchId ?? session.branchId;
      const payload = await postPersistenceJson<{ candidate: StoredCandidate }>(
        `${CANDIDATES_ENDPOINT}/write`,
        {
          session,
          branchId: candidateBranchId,
          candidate: scopeCandidateInputForBranch(candidate, candidateBranchId),
        },
      );
      return payload.candidate;
    },
    listCandidates: async (options = {}) => {
      const searchParams = new URLSearchParams();
      if (options.kind) searchParams.set("kind", options.kind);
      if (options.status) searchParams.set("status", options.status);
      if (options.branchId) searchParams.set("branchId", options.branchId);
      if (options.limit !== undefined) searchParams.set("limit", String(options.limit));
      const query = searchParams.toString();
      const response = await fetch(`${CANDIDATES_ENDPOINT}${query ? `?${query}` : ""}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { candidates?: StoredCandidate[] };
      return payload.candidates ?? [];
    },
    scoreCandidate: async (candidateId, scores, fitness, branchId) => {
      const payload = await postPersistenceJson<{ candidate: StoredCandidate }>(
        `${CANDIDATES_ENDPOINT}/score`,
        { session, branchId, candidateId, scores, fitness },
      );
      return payload.candidate;
    },
    retainCandidates: async (candidateIds, branchId) => {
      const payload = await postPersistenceJson<{ candidates: StoredCandidate[] }>(
        `${CANDIDATES_ENDPOINT}/retain`,
        { session, branchId, candidateIds },
      );
      return payload.candidates;
    },
    reserveCandidates: async (candidateIds, branchId) => {
      const payload = await postPersistenceJson<{ candidates: StoredCandidate[] }>(
        `${CANDIDATES_ENDPOINT}/reserve`,
        { session, branchId, candidateIds },
      );
      return payload.candidates;
    },
    purgeCandidates: async (candidateIds, branchId) => {
      const payload = await postPersistenceJson<{ candidates: StoredCandidate[] }>(
        `${CANDIDATES_ENDPOINT}/purge`,
        { session, branchId, candidateIds },
      );
      return payload.candidates;
    },
    capCandidates: async (options) => {
      return postPersistenceJson<CandidateCapResult>(
        `${CANDIDATES_ENDPOINT}/cap`,
        { session, ...options },
      );
    },
    selectCandidates: async (options) => {
      return postPersistenceJson<CandidateSelectionResult>(
        `${CANDIDATES_ENDPOINT}/select`,
        { session, ...options },
      );
    },
    developCandidate: async (options) => {
      return postPersistenceJson<CandidateDevelopmentResult>(
        `${CANDIDATES_ENDPOINT}/develop`,
        { session, ...options },
      );
    },
    getState: () => ({
      ...snapshotState(),
    }),
  };
}

async function postPersistenceJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function getRetryDelayMs(retryAttempt: number): number {
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryAttempt - 1));
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
