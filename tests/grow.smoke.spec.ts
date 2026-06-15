import { expect, test, type Page } from "@playwright/test";
import {
  assertValidCandidate,
  scopeCandidateInputForBranch,
  validateCandidate,
  type CandidateDevelopmentOptions,
  type CandidateDevelopmentResult,
  type CandidateInput,
  type CandidateSelectionResult,
  type StoredCandidate,
} from "../src/candidate-store";
import {
  runCandidateCycle,
  runEvolution,
  type CandidateCyclePersistence,
  type CandidateCycleOptions,
  type CandidateCycleResult,
  type CandidateEvolutionOptions,
  type CandidateEvolutionResult,
} from "../src/candidate-cycle";
import {
  aggregateCandidateFitness,
  previewCandidateFitness,
} from "../src/candidate-fitness";
import {
  calculateCandidateDiversityMetrics,
  calculateMeanPairwiseProsodyDistance,
} from "../src/candidate-diversity";
import { calculatePlayerExpression } from "../src/expression";
import { createFormScore } from "../src/form-scoring";
import { FORM_VARIANTS, getFormVariant } from "../src/form-variants";
import {
  MusicalEventRecordBuffer,
  createMusicalEventPersistenceRecord,
} from "../src/musical-event-record";
import { calculatePerformedTiming } from "../src/performed-time";
import { MELODY_PLAYER, PLAYER_REGISTRY, type PlayerTasteProfile } from "../src/players";
import {
  createMelodyConsensusDecision,
  createMockMelodyCriticSelection,
  createMelodyRepairTake,
  MELODY_CHORUS_PHRASE_BEATS,
  validateMelodyCriticSelection,
  type MelodyConsensusDecision,
  type MelodyRepairTake,
} from "../src/melody-scoring";
import {
  SESSION_MODES,
  shouldSessionModeRefillLookahead,
  type SessionMode,
} from "../src/session-mode";
import {
  applySectionDynamics,
  BALANCED_SECTION_DYNAMICS_PROFILE,
  createGoalSectionDynamicsProfile,
} from "../src/section-dynamics";
import { createGoalTasteProfile } from "../src/taste";
import {
  createMockThoughtIntent,
  validateMusicalExcerpt,
  validatePlayerThoughtIntent,
  validatePlayerThoughtRequest,
  type MusicalExcerpt,
  type PlayerThoughtIntent,
  type PlayerThoughtRequest,
} from "../src/thought-protocol";
import {
  createProjectedThoughtRequest,
  getThoughtPromptProtocol,
} from "../src/thought-prompt-protocols";
import {
  SONG_MATERIALS,
  type PatternNoteSource,
  type PlayerPatternSource,
  type SongMaterial,
} from "../src/song-material";
import {
  DEFAULT_SONG_ARRANGEMENT,
  arrangeSongFormPatternEvent,
  deriveSongRootDegrees,
  deriveSongSectionRootPlans,
  getSongHarmonicContext,
  sectionAtBeat,
} from "../src/song-form";
import {
  interpretSongGoal,
  SONG_GOAL_INFLUENCE_HINTS,
  validateSongGoal,
  type SongGoal,
  type SongGoalInterpretation,
} from "../src/song-goal";
import type { SongSketch, SongSketchProposal } from "../src/song-sketch";
import type { PlayerThoughtSeed } from "../src/thought-seeds";
import { createTonalContext, DEFAULT_TONAL_CONTEXT } from "../src/tonal-context";

type TransportState = {
  status: "stopped" | "playing";
  sessionMode: SessionMode;
  songId: "lantern" | "switchback" | "glass";
  timingFeelMode: "grid" | "feel" | "wide";
  bpm: number;
  bar: number;
  currentBeat: number;
  songForm: {
    sectionType: "verse" | "chorus" | "bridge";
    occurrence: number;
    label: string;
    localBar: number;
    bars: number;
  };
  harmony: {
    sectionId: "gather" | "answer" | "bridge";
    label: string;
    rootDegree: number;
    rootDegrees: readonly number[];
    rootIndex: number;
    rootSpanBeats: number;
    strategy: "modal-root-recolor";
  };
  lookahead: {
    targetBeats: number;
    minimumBeats: number;
    scheduledThroughBeat: number;
    leadBeats: number;
    pendingSlotCount: number;
    health: "stopped" | "empty" | "thin" | "healthy";
  };
  expression: {
    latest: Array<{
      playerId: string;
      velocityMultiplier: number;
      finalVelocity: number;
      eventIndex: number;
      summary: string;
      modulators: {
        longCycle: number;
        mediumCycle: number;
        shortCycle: number;
        eventStep: number;
        crossCoupling: number;
      };
    }>;
  };
  performedTiming: {
    latest: Array<{
      playerId: string;
      absoluteBeat: number;
      eventIndex: number;
      performedOffsetBeats: number;
      maximumOffsetBeats: number;
      summary: string;
      components: {
        longCycle: number;
        mediumCycle: number;
        eventStep: number;
        dispositionPressure: number;
        leapPressure: number;
        registerPressure: number;
        densityPressure: number;
      };
    }>;
  };
};

type AudioFireTimingDiagnostic = {
  timingFeelMode: "grid" | "feel" | "wide";
  scheduledSeconds: number;
  immediateSeconds: number;
  audioTimeSeconds: number;
  clampDelaySeconds: number;
};

type SlowThinkingLoopState = {
  enabled: boolean;
  playerId: string;
  status: "idle" | "pending" | "accepted" | "invalid" | "failed" | "discarded";
  requestId?: string;
  startedAtBeat?: number;
  resolvedAtBeat?: number;
  intendedStartBeat?: number;
  committedStartBeat?: number;
  nextEligibleBeat: number;
  latencyMs?: number;
  provider: "none" | "ollama" | "mock-fallback";
  action?: string;
  validation?: { valid: boolean; errors: string[] };
  fallbackValid?: boolean;
  retargeted?: boolean;
  message: string;
};

type SlowThoughtPlayback = {
  id: string;
  requestId: string;
  playerId: string;
  action: string;
  mode: "rest" | "thin" | "shift-register";
  startBeat: number;
  endBeat: number;
  acceptedAtBeat: number;
  retargeted: boolean;
  registerShift?: number;
  summary: string;
};

type CandidateMelodyAuditionState = {
  enabled: boolean;
  message: string;
  candidateId?: string;
  branchId?: string;
  fitness?: number;
  generation?: number;
  seed?: number;
  pattern?: PlayerPatternSource;
};

type PersistenceClientState = {
  sessionId: string;
  branchId: string;
  status: "idle" | "scheduled" | "flushing" | "retrying" | "error";
  pendingCount: number;
  appendedCount: number;
  retryAttempt: number;
  lastFlushAt?: string;
  lastPagehideFlushAt?: string;
  lastError?: string;
  nextRetryAt?: string;
  lastEventTypes: readonly string[];
};

type MusicalEventBufferState = {
  capacity: number;
  pendingCount: number;
  enqueuedCount: number;
  drainedCount: number;
  droppedCount: number;
  lastDroppedEventId?: string;
};

type PersistenceDump = {
  sessions: Array<{ id: string; branchId: string; name: string }>;
  events: Array<{
    id: string;
    sessionId: string;
    branchId: string;
    seq: number;
    beat: number | null;
    type: string;
    actorId: string | null;
    sessionMode: string | null;
    payload: Record<string, unknown>;
  }>;
  candidates: StoredCandidate[];
};

type ListeningFrame = {
  eventCount: number;
  tonalContext: { tonic: string; mode: string; scale: readonly string[] };
  mix: {
    silenceRatio: number;
    brightness: number;
    transientDensity: number;
    agitation: number;
    agitationSources: {
      timingVariance: number;
      velocitySpike: number;
      densityPressure: number;
      pushDragPressure: number;
    };
  };
  recentEvents: Array<{
    playerId: string;
    kind: string;
    pitch?: string;
    absoluteBeat: number;
    eventIndex: number;
    performedOffsetBeats: number;
    performedOffsetSeconds: number;
    velocity: number;
    expression?: {
      playerId: string;
      velocityMultiplier: number;
      finalVelocity: number;
      eventIndex: number;
      summary: string;
    };
    performedTiming?: {
      playerId: string;
      performedOffsetBeats: number;
      maximumOffsetBeats: number;
      eventIndex: number;
      summary: string;
    };
    gridPitch?: string;
    performedPitch?: string;
    tags: string[];
  }>;
  players: Array<{
    id: string;
    state: string;
    recentEvents: unknown[];
    contagion: {
      level: number;
      summary: string;
      components: {
        catchPressure: number;
        damping: number;
        amplification: number;
        activity: number;
      };
    };
  }>;
};

type TerrariumVisualState = {
  agitation: number;
  roomWarmthAlpha: number;
  players: Array<{
    playerId: string;
    contagionLevel: number;
    haloAlpha: number;
    haloScale: number;
  }>;
};

type TasteEvaluation = {
  playerId: string;
  action: string;
  actionSinceBeat: number;
  affinity: number;
  summary: string;
  reasons: string[];
  metrics: {
    playerDensity: number;
    ensembleDensity: number;
    silenceRatio: number;
    brightness: number;
    pitchVariety: number;
    rhythmicStability: number;
  };
  updatedAtBeat: number;
};

type TasteProfileSnapshot = {
  playerId: string;
  role: string;
  base: PlayerTasteProfile;
  adjusted: PlayerTasteProfile;
};

type OllamaThoughtProbe = {
  status: string;
  provider: string;
  promptProtocol: string;
  requestId?: string;
  playerId?: string;
  rawResponse: string;
  validation: { valid: boolean; errors: string[] };
  intent?: PlayerThoughtIntent;
  fallbackValidation?: { valid: boolean; errors: string[] };
};

type OllamaProposalTextProbe = {
  status: string;
  provider: string;
  promptProtocol: string;
  proposalId?: string;
  sourceSongId?: string;
  rawResponse: string;
  validation: { valid: boolean; errors: string[] };
  text?: {
    summary: string;
    requestedAction: string;
    responses: Array<{
      playerId: string;
      reason: string;
      requestedChange?: string;
    }>;
  };
  fallbackValidation?: { valid: boolean; errors: string[] };
};

type OllamaMelodyCriticProbe = {
  status: string;
  provider: string;
  promptProtocol: string;
  takeId?: string;
  songId?: string;
  deterministicCandidateId?: string;
  bestCandidateId?: string;
  selectedCandidateId?: string;
  selectedScoreDeltaFromBest?: number;
  selectedScoreDeltaFromDeterministic?: number;
  rawResponse: string;
  validation: { valid: boolean; errors: string[] };
  selection?: {
    selectedCandidateId: string;
    rationale: string;
    strengths: string;
    concerns: string;
  };
  fallbackValidation?: { valid: boolean; errors: string[] };
};

async function getTransportState(page: Page): Promise<TransportState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      transport?: { getState(): TransportState };
    };
    return appWindow.transport?.getState();
  });

  if (!state) {
    throw new Error("window.transport.getState() was not available");
  }

  return state;
}

async function getPersistenceState(page: Page): Promise<PersistenceClientState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      persistence?: { getState(): PersistenceClientState };
    };
    return appWindow.persistence?.getState();
  });

  if (!state) {
    throw new Error("window.persistence.getState() was not available");
  }

  return state;
}

async function waitForPersistenceDebugApi(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const appWindow = window as unknown as {
      persistence?: { getState(): PersistenceClientState };
    };
    return Boolean(appWindow.persistence?.getState);
  }), { timeout: 5_000 }).toBe(true);
}

async function flushPersistence(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const appWindow = window as unknown as {
      persistence?: { flush(): Promise<void> };
    };
    await appWindow.persistence?.flush();
  });
}

async function flushPersistenceUntilIdle(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await flushPersistence(page);
    const state = await getPersistenceState(page);
    if (state.pendingCount === 0 && state.status !== "flushing" && state.status !== "scheduled") {
      return;
    }
  }

  const state = await getPersistenceState(page);
  throw new Error(`Persistence queue did not drain: ${state.status}, ${state.pendingCount} pending`);
}

async function getMusicalEventBufferState(page: Page): Promise<MusicalEventBufferState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      persistence?: { getMusicalEventBufferState(): MusicalEventBufferState };
    };
    return appWindow.persistence?.getMusicalEventBufferState();
  });

  if (!state) {
    throw new Error("window.persistence.getMusicalEventBufferState() was not available");
  }

  return state;
}

async function flushMusicalEvents(page: Page): Promise<number> {
  const flushedCount = await page.evaluate(() => {
    const appWindow = window as unknown as {
      persistence?: { flushMusicalEvents(): number };
    };
    return appWindow.persistence?.flushMusicalEvents();
  });

  if (flushedCount === undefined) {
    throw new Error("window.persistence.flushMusicalEvents() was not available");
  }

  return flushedCount;
}

async function flushPersistenceOnPageHide(page: Page): Promise<void> {
  await page.evaluate(() => {
    const appWindow = window as unknown as {
      persistence?: { flushOnPageHide(): void };
    };
    appWindow.persistence?.flushOnPageHide();
  });
}

async function dumpPersistence(page: Page, limit = 100): Promise<PersistenceDump> {
  const dump = await page.evaluate(async (nextLimit) => {
    const appWindow = window as unknown as {
      persistence?: { dump(limit?: number): Promise<PersistenceDump> };
    };
    return appWindow.persistence?.dump(nextLimit);
  }, limit);

  if (!dump) {
    throw new Error("window.persistence.dump() was not available");
  }

  return dump;
}

async function runCandidateCycleInApp(
  page: Page,
  options: CandidateCycleOptions,
): Promise<CandidateCycleResult> {
  const result = await page.evaluate(async (nextOptions) => {
    const appWindow = window as unknown as {
      persistence?: {
        runCandidateCycle(options: CandidateCycleOptions): Promise<CandidateCycleResult>;
      };
    };
    return appWindow.persistence?.runCandidateCycle(nextOptions);
  }, options);

  if (!result) {
    throw new Error("window.persistence.runCandidateCycle() was not available");
  }

  return result;
}

async function runEvolutionInApp(
  page: Page,
  options: CandidateEvolutionOptions,
): Promise<CandidateEvolutionResult> {
  const result = await page.evaluate(async (nextOptions) => {
    const appWindow = window as unknown as {
      persistence?: {
        runEvolution(options: CandidateEvolutionOptions): Promise<CandidateEvolutionResult>;
      };
    };
    return appWindow.persistence?.runEvolution(nextOptions);
  }, options);

  if (!result) {
    throw new Error("window.persistence.runEvolution() was not available");
  }

  return result;
}

async function listCandidatesInApp(
  page: Page,
  options: { kind?: "phrase"; status?: "alive" | "elite" | "reserved" | "purged"; branchId?: string; limit?: number },
): Promise<StoredCandidate[]> {
  const result = await page.evaluate(async (nextOptions) => {
    const appWindow = window as unknown as {
      persistence?: {
        listCandidates(options?: typeof nextOptions): Promise<StoredCandidate[]>;
      };
    };
    return appWindow.persistence?.listCandidates(nextOptions);
  }, options);

  if (!result) {
    throw new Error("window.persistence.listCandidates() was not available");
  }

  return result;
}

async function auditionEliteCandidateInApp(
  page: Page,
  options: { branchId?: string; candidateId?: string },
): Promise<CandidateMelodyAuditionState> {
  const result = await page.evaluate(async (nextOptions) => {
    const appWindow = window as unknown as {
      prosody?: {
        auditionEliteCandidate(options?: typeof nextOptions): Promise<CandidateMelodyAuditionState>;
      };
    };
    return appWindow.prosody?.auditionEliteCandidate(nextOptions);
  }, options);

  if (!result) {
    throw new Error("window.prosody.auditionEliteCandidate() was not available");
  }

  return result;
}

async function getActiveProsodyPattern(page: Page): Promise<PlayerPatternSource | undefined> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      prosody?: { getPattern(): PlayerPatternSource | undefined };
    };
    return appWindow.prosody?.getPattern();
  });
}

function createMemoryCyclePersistence(options: {
  noOpDevelopAttempts?: number;
} = {}): CandidateCyclePersistence {
  const candidates = new Map<string, StoredCandidate>();
  let serial = 0;
  let noOpDevelopAttempts = options.noOpDevelopAttempts ?? 0;
  const nextTimestamp = () => `2026-01-01T00:00:${String(serial++).padStart(4, "0")}Z`;
  const defaultBranch = "main";
  const listStored = (filters: {
    kind?: StoredCandidate["kind"];
    status?: StoredCandidate["status"];
    branchId?: string;
    limit?: number;
  } = {}) => [...candidates.values()]
    .filter((candidate) => !filters.kind || candidate.kind === filters.kind)
    .filter((candidate) => !filters.status || candidate.status === filters.status)
    .filter((candidate) => !filters.branchId || candidate.branchId === filters.branchId)
    .sort(rankStoredCandidateForTest)
    .slice(0, filters.limit ?? 500)
    .map(cloneStoredCandidateForTest);
  const findStored = (candidateId: string, branchId = defaultBranch) => {
    const candidate = candidates.get(candidateId);
    if (!candidate || candidate.branchId !== branchId) {
      throw new Error(`Missing candidate ${candidateId}`);
    }
    return candidate;
  };

  return {
    writeCandidate: async (candidate: CandidateInput, branchId = defaultBranch) => {
      const normalized = assertValidCandidate(scopeCandidateInputForBranch(candidate, branchId));
      const existing = candidates.get(normalized.id);
      if (existing) return cloneStoredCandidateForTest(existing);

      const timestamp = nextTimestamp();
      const stored: StoredCandidate = {
        ...normalized,
        branchId,
        createdAt: timestamp,
        updatedAt: timestamp,
        scores: { ...normalized.scores },
        genome: cloneJsonForTest(normalized.genome),
      };
      candidates.set(stored.id, stored);
      return cloneStoredCandidateForTest(stored);
    },
    listCandidates: async (filters) => listStored(filters),
    scoreCandidate: async (candidateId, scores, fitness, branchId = defaultBranch) => {
      const candidate = findStored(candidateId, branchId);
      candidate.scores = { ...scores };
      candidate.fitness = fitness;
      candidate.updatedAt = nextTimestamp();
      return cloneStoredCandidateForTest(candidate);
    },
    retainCandidates: async (candidateIds, branchId = defaultBranch) =>
      updateMemoryCandidateStatuses(candidates, candidateIds, branchId, "elite", nextTimestamp),
    reserveCandidates: async (candidateIds, branchId = defaultBranch) =>
      updateMemoryCandidateStatuses(candidates, candidateIds, branchId, "reserved", nextTimestamp),
    purgeCandidates: async (candidateIds, branchId = defaultBranch) =>
      updateMemoryCandidateStatuses(candidates, candidateIds, branchId, "purged", nextTimestamp),
    selectCandidates: async (selection) => {
      const branchId = selection.branchId ?? defaultBranch;
      const ranked = listStored({
        kind: selection.kind,
        branchId,
      }).filter((candidate) => candidate.status !== "purged");
      const eliteIds = new Set(ranked.slice(0, selection.eliteLimit).map((candidate) => candidate.id));
      const elite: StoredCandidate[] = [];
      const purged: StoredCandidate[] = [];

      for (const candidate of ranked) {
        const stored = findStored(candidate.id, branchId);
        if (eliteIds.has(candidate.id)) {
          stored.status = "elite";
          elite.push(cloneStoredCandidateForTest(stored));
        } else {
          stored.status = "purged";
          purged.push(cloneStoredCandidateForTest(stored));
        }
        stored.updatedAt = nextTimestamp();
      }

      return {
        kind: selection.kind,
        branchId,
        eliteLimit: selection.eliteLimit,
        evaluatedCount: ranked.length,
        elite,
        purged,
      } satisfies CandidateSelectionResult;
    },
    developCandidate: async (development: CandidateDevelopmentOptions): Promise<CandidateDevelopmentResult> => {
      const branchId = development.branchId ?? defaultBranch;
      const parent = findStored(development.parentId, branchId);
      if (parent.status !== "elite" && parent.status !== "reserved") {
        throw new Error("Parent candidate must be elite or reserved");
      }
      if (noOpDevelopAttempts > 0) {
        noOpDevelopAttempts -= 1;
        throw new Error("Candidate development did not change the genome");
      }

      const genome = development.mutation.type === "phrase.replace"
        ? development.mutation.genome
        : parent.genome;
      if (JSON.stringify(genome) === JSON.stringify(parent.genome)) {
        throw new Error("Candidate development did not change the genome");
      }

      const childInput: CandidateInput = {
        kind: "phrase",
        genome,
        scores: {},
        fitness: 0,
        parentId: parent.id,
        generation: parent.generation + 1,
        seed: development.seed ?? 0,
        status: "alive",
        createdAtBeat: development.createdAtBeat,
      };
      const child = assertValidCandidate(scopeCandidateInputForBranch(childInput, branchId));
      const existing = candidates.get(child.id);
      if (existing) {
        return {
          parent: cloneStoredCandidateForTest(parent),
          child: cloneStoredCandidateForTest(existing),
          mutation: development.mutation,
        };
      }

      const timestamp = nextTimestamp();
      const stored: StoredCandidate = {
        ...child,
        branchId,
        createdAt: timestamp,
        updatedAt: timestamp,
        scores: { ...child.scores },
        genome: cloneJsonForTest(child.genome),
      };
      candidates.set(stored.id, stored);
      return {
        parent: cloneStoredCandidateForTest(parent),
        child: cloneStoredCandidateForTest(stored),
        mutation: development.mutation,
      };
    },
  };
}

function updateMemoryCandidateStatuses(
  candidates: Map<string, StoredCandidate>,
  candidateIds: readonly string[],
  branchId: string,
  status: StoredCandidate["status"],
  nextTimestamp: () => string,
): readonly StoredCandidate[] {
  const updated: StoredCandidate[] = [];
  for (const candidateId of candidateIds) {
    const candidate = candidates.get(candidateId);
    if (!candidate || candidate.branchId !== branchId) {
      throw new Error(`Missing candidate ${candidateId}`);
    }
    candidate.status = status;
    candidate.updatedAt = nextTimestamp();
    updated.push(cloneStoredCandidateForTest(candidate));
  }
  return updated;
}

function rankStoredCandidateForTest(left: StoredCandidate, right: StoredCandidate): number {
  return right.fitness - left.fitness ||
    left.generation - right.generation ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id);
}

function cloneStoredCandidateForTest(candidate: StoredCandidate): StoredCandidate {
  return {
    ...candidate,
    scores: { ...candidate.scores },
    genome: cloneJsonForTest(candidate.genome),
  };
}

function cloneJsonForTest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function getTimingDiagnostics(page: Page): Promise<readonly AudioFireTimingDiagnostic[]> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      transport?: {
        getTimingDiagnostics(): readonly AudioFireTimingDiagnostic[];
      };
    };
    return appWindow.transport?.getTimingDiagnostics() ?? [];
  });
}

async function getListeningFrame(page: Page): Promise<ListeningFrame> {
  const frame = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getFrame(): ListeningFrame };
    };
    return appWindow.listening?.getFrame();
  });

  if (!frame) {
    throw new Error("window.listening.getFrame() was not available");
  }

  return frame;
}

async function getTerrariumVisualState(page: Page): Promise<TerrariumVisualState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      terrarium?: { getVisualState(): TerrariumVisualState | undefined };
    };
    return appWindow.terrarium?.getVisualState();
  });

  if (!state) {
    throw new Error("window.terrarium.getVisualState() was not available");
  }

  return state;
}

async function getTasteEvaluations(page: Page): Promise<readonly TasteEvaluation[]> {
  const evaluations = await page.evaluate(() => {
    const appWindow = window as unknown as {
      taste?: { getEvaluations(): readonly TasteEvaluation[] };
    };
    return appWindow.taste?.getEvaluations();
  });

  if (!evaluations) {
    throw new Error("window.taste.getEvaluations() was not available");
  }

  return evaluations;
}

async function getTasteProfiles(page: Page): Promise<readonly TasteProfileSnapshot[]> {
  const profiles = await page.evaluate(() => {
    const appWindow = window as unknown as {
      taste?: { getProfiles(): readonly TasteProfileSnapshot[] };
    };
    return appWindow.taste?.getProfiles();
  });

  if (!profiles) {
    throw new Error("window.taste.getProfiles() was not available");
  }

  return profiles;
}

async function getThoughtSeeds(page: Page): Promise<readonly PlayerThoughtSeed[]> {
  const seeds = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getSeeds(): readonly PlayerThoughtSeed[] };
    };
    return appWindow.thinking?.getSeeds();
  });

  if (!seeds) {
    throw new Error("window.thinking.getSeeds() was not available");
  }

  return seeds;
}

async function getThoughtRequests(page: Page): Promise<readonly PlayerThoughtRequest[]> {
  const requests = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getRequests(): readonly PlayerThoughtRequest[] };
    };
    return appWindow.thinking?.getRequests();
  });

  if (!requests) {
    throw new Error("window.thinking.getRequests() was not available");
  }

  return requests;
}

async function getMockThoughtIntents(page: Page): Promise<readonly PlayerThoughtIntent[]> {
  const intents = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getMockIntents(): readonly PlayerThoughtIntent[] };
    };
    return appWindow.thinking?.getMockIntents();
  });

  if (!intents) {
    throw new Error("window.thinking.getMockIntents() was not available");
  }

  return intents;
}

async function getSlowThinkingLoop(page: Page): Promise<SlowThinkingLoopState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getSlowLoop(playerId?: string): SlowThinkingLoopState | undefined };
    };
    return appWindow.thinking?.getSlowLoop();
  });

  if (!state) {
    throw new Error("window.thinking.getSlowLoop() was not available");
  }

  return state;
}

async function getSlowThinkingLoopForPlayer(page: Page, playerId: string): Promise<SlowThinkingLoopState> {
  const state = await page.evaluate((nextPlayerId) => {
    const appWindow = window as unknown as {
      thinking?: { getSlowLoop(playerId?: string): SlowThinkingLoopState | undefined };
    };
    return appWindow.thinking?.getSlowLoop(nextPlayerId);
  }, playerId);

  if (!state) {
    throw new Error(`window.thinking.getSlowLoop(${playerId}) was not available`);
  }

  return state;
}

async function getSlowThinkingLoops(page: Page): Promise<SlowThinkingLoopState[]> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getSlowLoops(): SlowThinkingLoopState[] };
    };
    return appWindow.thinking?.getSlowLoops() ?? [];
  });
}

async function getSlowThinkingPlayback(
  page: Page,
  playerId?: string,
): Promise<SlowThoughtPlayback | undefined> {
  return page.evaluate((nextPlayerId) => {
    const appWindow = window as unknown as {
      thinking?: { getSlowPlayback(playerId?: string): SlowThoughtPlayback | undefined };
    };
    return appWindow.thinking?.getSlowPlayback(nextPlayerId);
  }, playerId);
}

async function getSlowThinkingPlaybacks(page: Page): Promise<SlowThoughtPlayback[]> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getSlowPlaybacks(): SlowThoughtPlayback[] };
    };
    return appWindow.thinking?.getSlowPlaybacks() ?? [];
  });
}

async function getSessionMode(page: Page): Promise<SessionMode> {
  const mode = await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { getMode(): SessionMode };
    };
    return appWindow.session?.getMode();
  });

  if (!mode) {
    throw new Error("window.session.getMode() was not available");
  }

  return mode;
}

async function setSessionMode(page: Page, mode: SessionMode): Promise<void> {
  const appliedMode = await page.evaluate((nextMode) => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode(nextMode);
  }, mode);

  expect(appliedMode).toBe(mode);
}

async function getSongSketch(page: Page): Promise<SongSketch> {
  const sketch = await page.evaluate(() => {
    const appWindow = window as unknown as {
      song?: { getSketch(): SongSketch };
    };
    return appWindow.song?.getSketch();
  });

  if (!sketch) {
    throw new Error("window.song.getSketch() was not available");
  }

  return sketch;
}

async function getSongProposal(page: Page): Promise<SongSketchProposal> {
  const proposal = await page.evaluate(() => {
    const appWindow = window as unknown as {
      song?: { getProposal(): SongSketchProposal };
    };
    return appWindow.song?.getProposal();
  });

  if (!proposal) {
    throw new Error("window.song.getProposal() was not available");
  }

  return proposal;
}

async function getSongGoalResult(page: Page): Promise<SongGoalInterpretation> {
  const result = await page.evaluate(() => {
    const appWindow = window as unknown as {
      songGoal?: { getLastResult(): SongGoalInterpretation };
    };
    return appWindow.songGoal?.getLastResult();
  });

  if (!result) {
    throw new Error("window.songGoal.getLastResult() was not available");
  }

  return result;
}

async function getAppliedSongGoal(page: Page): Promise<SongGoal | undefined> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      songGoal?: { getAppliedGoal(): SongGoal | undefined };
    };
    return appWindow.songGoal?.getAppliedGoal();
  });
}

async function getMelodyRepairTake(page: Page): Promise<MelodyRepairTake> {
  const take = await page.evaluate(() => {
    const appWindow = window as unknown as {
      melodyRepair?: { getTake(): MelodyRepairTake };
    };
    return appWindow.melodyRepair?.getTake();
  });

  if (!take) {
    throw new Error("window.melodyRepair.getTake() was not available");
  }

  return take;
}

async function getMelodyRepairCandidate(page: Page): Promise<MelodyRepairTake["candidates"][number]> {
  const candidate = await page.evaluate(() => {
    const appWindow = window as unknown as {
      melodyRepair?: { getCandidate(): MelodyRepairTake["candidates"][number] };
    };
    return appWindow.melodyRepair?.getCandidate();
  });

  if (!candidate) {
    throw new Error("window.melodyRepair.getCandidate() was not available");
  }

  return candidate;
}

async function getMelodyConsensus(page: Page): Promise<MelodyConsensusDecision> {
  const consensus = await page.evaluate(() => {
    const appWindow = window as unknown as {
      melodyRepair?: { getConsensus(): MelodyConsensusDecision };
    };
    return appWindow.melodyRepair?.getConsensus();
  });

  if (!consensus) {
    throw new Error("window.melodyRepair.getConsensus() was not available");
  }

  return consensus;
}

function getSongSketchAssignmentDensity(sketch: SongSketch, playerId: string): number {
  const assignment = sketch.assignments.find((nextAssignment) => nextAssignment.playerId === playerId);
  if (!assignment) {
    throw new Error(`Song sketch did not include assignment for ${playerId}`);
  }
  return assignment.density;
}

function getSongPatternScaleDegrees(songId: TransportState["songId"], playerId: string): Set<number> {
  const song = SONG_MATERIALS.find((material) => material.id === songId);
  if (!song) {
    throw new Error(`Missing song material for ${songId}`);
  }
  return new Set(song.patterns.flatMap((pattern) =>
    pattern.events.flatMap((event) =>
      event?.playerId === playerId ? [event.scaleDegree] : []
    )
  ));
}

function getSongMaterialForTest(songId: TransportState["songId"]): SongMaterial {
  const song = SONG_MATERIALS.find((material) => material.id === songId);
  if (!song) {
    throw new Error(`Missing song material for ${songId}`);
  }
  return song;
}

function getPatternForPlayer(
  patterns: readonly PlayerPatternSource[],
  playerId: string,
): PlayerPatternSource {
  const pattern = patterns.find((candidate) =>
    candidate.events.some((event) => event?.playerId === playerId)
  );
  if (!pattern) {
    throw new Error(`Missing pattern for ${playerId}`);
  }
  return pattern;
}

function collectArrangedMelody(
  song: SongMaterial,
  pattern: PlayerPatternSource,
  sectionStartBeat: number,
): PatternNoteSource[] {
  return collectArrangedPattern(song, pattern, sectionStartBeat);
}

function collectArrangedPattern(
  song: SongMaterial,
  pattern: PlayerPatternSource,
  sectionStartBeat: number,
  durationBeats = 8,
): PatternNoteSource[] {
  const notes: PatternNoteSource[] = [];
  for (let localBeat = 0; localBeat < durationBeats; localBeat += pattern.subdivisionBeats) {
    const stepIndex = Math.round(localBeat / pattern.subdivisionBeats) % pattern.events.length;
    const sourceEvent = pattern.events[stepIndex] ?? null;
    const arrangedEvent = arrangeSongFormPatternEvent({
      song,
      pattern,
      sourceEvent,
      stepIndex,
      absoluteBeat: sectionStartBeat + localBeat,
      tonalContext: DEFAULT_TONAL_CONTEXT,
      arrangement: DEFAULT_SONG_ARRANGEMENT,
    });
    if (arrangedEvent) notes.push(arrangedEvent);
  }
  return notes;
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function getSketchSectionRootDegrees(sketch: SongSketch): number[] {
  return sketch.sections.flatMap((section) => [...section.rootDegrees]);
}

async function getRecordedEventCount(page: Page): Promise<number> {
  const eventCount = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getEvents(): readonly unknown[] };
    };
    return appWindow.listening?.getEvents().length;
  });

  if (eventCount === undefined) {
    throw new Error("window.listening.getEvents() was not available");
  }

  return eventCount;
}

async function getLatestRecordedBeat(page: Page): Promise<number> {
  const latestBeat = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getEvents(): Array<{ absoluteBeat: number }> };
    };
    return appWindow.listening?.getEvents().at(-1)?.absoluteBeat;
  });

  if (latestBeat === undefined) {
    throw new Error("No recorded musical events were available");
  }

  return latestBeat;
}

async function collectPerformedOffsets(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: {
        getEvents(): Array<{
          playerId: string;
          eventIndex: number;
          performedOffsetBeats: number;
        }>;
      };
    };
    const events = appWindow.listening?.getEvents() ?? [];
    return Object.fromEntries(
      events.map((event) => [
        `${event.playerId}:${event.eventIndex}`,
        event.performedOffsetBeats,
      ]),
    );
  });
}

async function helpPanelIsInsideSection(page: Page, helpButtonTestId: string): Promise<boolean> {
  return page.evaluate((testId) => {
    const helpButton = document.querySelector(`[data-testid="${testId}"]`);
    const helpPanel = document.querySelector("[data-testid='inspector-help-panel']");
    return Boolean(helpButton?.closest(".inspector-section")?.contains(helpPanel));
  }, helpButtonTestId);
}

test("velocity expression snapshots are deterministic and bounded", () => {
  const input = {
    player: MELODY_PLAYER,
    absoluteBeat: 12.5,
    eventIndex: 8,
    baseVelocity: 0.32,
    tasteVelocityMultiplier: 1.08,
  };
  const first = calculatePlayerExpression(input);
  const second = calculatePlayerExpression(input);
  const nextStep = calculatePlayerExpression({
    ...input,
    eventIndex: input.eventIndex + 1,
  });

  expect(first).toEqual(second);
  expect(first.velocityMultiplier).toBeGreaterThanOrEqual(0.8);
  expect(first.velocityMultiplier).toBeLessThanOrEqual(1.22);
  expect(first.finalVelocity).toBeGreaterThanOrEqual(0);
  expect(first.finalVelocity).toBeLessThanOrEqual(1);
  expect(first.summary.length).toBeGreaterThan(0);
  expect(nextStep.velocityMultiplier).not.toBe(first.velocityMultiplier);
});

test("performed timing snapshots are deterministic bounded data", () => {
  const input = {
    player: MELODY_PLAYER,
    absoluteBeat: 12.5,
    eventIndex: 8,
    pitch: "G4",
    previousPitch: "C4",
    durationBeats: 0.5,
    baseVelocity: 0.32,
    localDensity: 0.7,
  };
  const first = calculatePerformedTiming(input);
  const second = calculatePerformedTiming(input);
  const nextStep = calculatePerformedTiming({
    ...input,
    eventIndex: input.eventIndex + 1,
  });
  const nextPocket = calculatePerformedTiming({
    ...input,
    absoluteBeat: input.absoluteBeat + 0.5,
  });

  expect(first).toEqual(second);
  expect(Math.abs(first.performedOffsetBeats)).toBeLessThanOrEqual(first.maximumOffsetBeats);
  expect(first.maximumOffsetBeats).toBeLessThanOrEqual(0.035);
  expect(first.components.leapPressure).toBeGreaterThan(0);
  expect(first.components.densityPressure).toBe(0.7);
  expect(first.summary.length).toBeGreaterThan(0);
  expect(nextStep.performedOffsetBeats).toBe(first.performedOffsetBeats);
  expect(nextPocket.performedOffsetBeats).not.toBe(first.performedOffsetBeats);
});

test("musical event record payload separates grid and performed pitch", () => {
  const tonalContext = {
    tonic: "C",
    mode: "mixolydian",
    scale: ["C", "D", "E", "F", "G", "A", "Bb"],
  };
  const record = createMusicalEventPersistenceRecord({
    id: "event-shifted",
    kind: "note",
    playerId: "melody",
    instrumentId: "sine",
    transportPosition: "4:0:0",
    bar: 5,
    beat: 1,
    absoluteBeat: 16,
    eventIndex: 7,
    durationBeats: 0.5,
    performedOffsetBeats: 0.0125,
    performedOffsetSeconds: 0.0083,
    velocity: 0.44,
    pitch: "E5",
    gridPitch: "E4",
    performedPitch: "E5",
    tags: ["melody", "thought:shift_register", "register:+1"],
    createdAtMs: 1234,
  }, tonalContext);

  expect(record.type).toBe("musical.event_recorded");
  expect(record.actorId).toBe("melody");
  expect(record.beat).toBe(16);
  expect(record.payload.schemaVersion).toBe(1);
  expect(record.payload.grid).toMatchObject({
    absoluteBeat: 16,
    pitch: "E4",
    pitchClass: "E",
    octave: 4,
    scaleDegree: 2,
  });
  expect(record.payload.performed).toMatchObject({
    offsetBeats: 0.0125,
    offsetSeconds: 0.0083,
    pitch: "E5",
    pitchClass: "E",
    octave: 5,
    scaleDegree: 2,
    sounded: true,
    pitchChanged: true,
    registerShift: 1,
  });

  const restRecord = createMusicalEventPersistenceRecord({
    id: "event-rest",
    kind: "rest",
    playerId: "melody",
    instrumentId: "sine",
    transportPosition: "4:1:0",
    bar: 5,
    beat: 2,
    absoluteBeat: 17,
    eventIndex: 8,
    durationBeats: 0.5,
    performedOffsetBeats: 0,
    performedOffsetSeconds: 0,
    velocity: 0,
    pitch: undefined,
    gridPitch: "G4",
    performedPitch: undefined,
    tags: ["melody", "taste:rest"],
    createdAtMs: 1235,
  }, tonalContext);
  expect(restRecord.payload.grid.pitch).toBe("G4");
  expect(restRecord.payload.grid.scaleDegree).toBe(4);
  expect(restRecord.payload.performed.pitch).toBeUndefined();
  expect(restRecord.payload.performed.sounded).toBe(false);
  expect(restRecord.payload.performed.pitchChanged).toBe(false);
});

test("musical event record buffer drains in order and drops oldest under pressure", () => {
  const tonalContext = {
    tonic: "C",
    mode: "mixolydian",
    scale: ["C", "D", "E", "F", "G", "A", "Bb"],
  };
  const makeRecord = (sourceEventId: string, absoluteBeat: number) => createMusicalEventPersistenceRecord({
    id: sourceEventId,
    kind: "note",
    playerId: "pulse",
    instrumentId: "pulse",
    transportPosition: `0:0:${absoluteBeat}`,
    bar: 1,
    beat: absoluteBeat + 1,
    absoluteBeat,
    eventIndex: absoluteBeat,
    durationBeats: 0.5,
    performedOffsetBeats: 0,
    performedOffsetSeconds: 0,
    velocity: 0.5,
    pitch: "C2",
    gridPitch: "C2",
    performedPitch: "C2",
    tags: ["pulse"],
    createdAtMs: absoluteBeat,
  }, tonalContext);

  const buffer = new MusicalEventRecordBuffer(2);
  const first = makeRecord("event-1", 0);
  const second = makeRecord("event-2", 1);
  const third = makeRecord("event-3", 2);

  expect(buffer.enqueue(first).state.pendingCount).toBe(1);
  expect(buffer.enqueue(second).state.pendingCount).toBe(2);
  const overflow = buffer.enqueue(third);
  expect(overflow.dropped?.payload.sourceEventId).toBe("event-1");
  expect(overflow.state).toMatchObject({
    capacity: 2,
    pendingCount: 2,
    enqueuedCount: 3,
    droppedCount: 1,
    lastDroppedEventId: "event-1",
  });
  expect(buffer.drain().map((record) => record.payload.sourceEventId)).toEqual([
    "event-2",
    "event-3",
  ]);
  expect(buffer.getState()).toMatchObject({
    pendingCount: 0,
    drainedCount: 2,
    droppedCount: 1,
  });
});

test("session mode refill policy is explicit", () => {
  expect(SESSION_MODES).toEqual(["break", "solo-practice", "rehearsal", "performance"]);
  expect(Object.fromEntries(
    SESSION_MODES.map((mode) => [mode, shouldSessionModeRefillLookahead(mode)]),
  )).toEqual({
    break: false,
    "solo-practice": true,
    rehearsal: true,
    performance: true,
  });
});

test("performed offsets replay across transport restarts", async ({ page }) => {
  test.setTimeout(25_000);
  await page.goto("/");

  const button = page.getByTestId("transport-toggle");
  const captureOffsets = async (): Promise<Record<string, number>> => {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect
      .poll(async () => getRecordedEventCount(page), { timeout: 8_000 })
      .toBeGreaterThanOrEqual(10);
    const offsets = await collectPerformedOffsets(page);
    await button.click();
    await expect(button).toHaveText("Start");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBe(0);
    return offsets;
  };

  const firstRun = await captureOffsets();
  const secondRun = await captureOffsets();
  const replayedKeys = Object.keys(firstRun).filter((key) => key in secondRun);

  expect(replayedKeys.length).toBeGreaterThanOrEqual(8);
  expect(Object.fromEntries(replayedKeys.map((key) => [key, secondRun[key]]))).toEqual(
    Object.fromEntries(replayedKeys.map((key) => [key, firstRun[key]])),
  );
});

test("timing feel control can square playback to the grid", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/");

  await expect(page.getByTestId("timing-feel-current")).toHaveText("Feel");
  await expect(page.getByTestId("timing-feel-feel")).toBeChecked();
  expect((await getTransportState(page)).timingFeelMode).toBe("feel");

  await page.getByTestId("timing-feel-grid-option").click();
  await expect(page.getByTestId("timing-feel-current")).toHaveText("Grid");
  await expect(page.getByTestId("timing-feel-grid")).toBeChecked();
  expect((await getTransportState(page)).timingFeelMode).toBe("grid");
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      timing?: { getMode(): "grid" | "feel" | "wide" };
    };
    return appWindow.timing?.getMode();
  })).toBe("grid");

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBeGreaterThanOrEqual(6);

  const gridFrame = await getListeningFrame(page);
  expect(gridFrame.recentEvents.length).toBeGreaterThan(0);
  expect(gridFrame.recentEvents.every((event) => (
    event.tags.includes("timing:grid") &&
    event.performedOffsetBeats === 0 &&
    event.performedOffsetSeconds === 0 &&
    event.performedTiming?.performedOffsetBeats === 0 &&
    event.performedTiming?.summary === "square grid"
  ))).toBe(true);

  const gridTimingDiagnostics = await getTimingDiagnostics(page);
  expect(gridTimingDiagnostics.some((entry) => entry.timingFeelMode === "grid")).toBe(true);
  const futureGridDiagnostics = gridTimingDiagnostics.filter((entry) => (
    entry.timingFeelMode === "grid" &&
    entry.scheduledSeconds - entry.immediateSeconds > 0.01
  ));
  if (futureGridDiagnostics.length > 0) {
    expect(futureGridDiagnostics.every((entry) => (
      Math.abs(entry.clampDelaySeconds) < 0.0005 &&
      entry.audioTimeSeconds === entry.scheduledSeconds
    ))).toBe(true);
  }

  await page.getByTestId("timing-feel-feel-option").click();
  await expect(page.getByTestId("timing-feel-current")).toHaveText("Feel");
  await expect(page.getByTestId("timing-feel-feel")).toBeChecked();
  expect((await getTransportState(page)).timingFeelMode).toBe("feel");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) => (
      event.tags.includes("timing:audible-offset") &&
      Math.abs(event.performedOffsetBeats) > 0
    ));
  }).toBe(true);

  await page.getByTestId("timing-feel-wide-option").click();
  await expect(page.getByTestId("timing-feel-current")).toHaveText("Wide");
  await expect(page.getByTestId("timing-feel-wide")).toBeChecked();
  expect((await getTransportState(page)).timingFeelMode).toBe("wide");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) => (
      event.tags.includes("timing:wide-audition") &&
      event.tags.includes("timing:audible-offset") &&
      Math.abs(event.performedOffsetBeats) >= 0.01 &&
      event.performedTiming?.maximumOffsetBeats === 0.06
    ));
  }).toBe(true);

  await button.click();
  await expect(button).toHaveText("Start");
});

test("song material control switches deterministic loops", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/");

  await expect(page.getByTestId("song-current")).toHaveText("Lantern");
  await expect(page.getByTestId("song-lantern")).toBeChecked();
  expect((await getTransportState(page)).songId).toBe("lantern");

  await page.getByTestId("song-switchback-option").click();
  await expect(page.getByTestId("song-current")).toHaveText("Switchback");
  await expect(page.getByTestId("song-switchback")).toBeChecked();
  expect((await getTransportState(page)).songId).toBe("switchback");

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) => event.tags.includes("song:switchback"));
  }).toBe(true);

  await page.getByTestId("song-glass-option").click();
  await expect(page.getByTestId("song-current")).toHaveText("Glass");
  await expect(page.getByTestId("song-glass")).toBeChecked();
  expect((await getTransportState(page)).songId).toBe("glass");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.length > 0 &&
      frame.recentEvents.every((event) => event.tags.includes("song:glass"));
  }).toBe(true);

  await button.click();
  await expect(button).toHaveText("Start");
});

test("song form timeline develops an in-scale chorus melody", () => {
  const arrangement = DEFAULT_SONG_ARRANGEMENT;
  expect(arrangement.totalBeats).toBe(192);
  expect(sectionAtBeat(0, arrangement)).toMatchObject({
    sectionType: "verse",
    occurrence: 1,
    localBar: 1,
  });
  expect(sectionAtBeat(32, arrangement)).toMatchObject({
    sectionType: "chorus",
    occurrence: 1,
    localBar: 1,
  });
  expect(sectionAtBeat(128, arrangement)).toMatchObject({
    sectionType: "bridge",
    occurrence: 1,
    localBar: 1,
  });
  expect(sectionAtBeat(192, arrangement)).toMatchObject({
    sectionType: "verse",
    occurrence: 1,
    localBar: 1,
  });

  const song = getSongMaterialForTest("lantern");
  const melodyPattern = getPatternForPlayer(song.patterns, "melody");
  const bassPattern = getPatternForPlayer(song.patterns, "bass");
  const pulsePattern = getPatternForPlayer(song.patterns, "pulse");
  const verseNotes = collectArrangedMelody(song, melodyPattern, 0);
  const chorusNotes = collectArrangedMelody(song, melodyPattern, 32);
  const bridgeNotes = collectArrangedMelody(song, melodyPattern, 128);
  const verseBass = collectArrangedPattern(song, bassPattern, 0);
  const chorusBass = collectArrangedPattern(song, bassPattern, 32);
  const bridgeBass = collectArrangedPattern(song, bassPattern, 128);
  const versePulse = collectArrangedPattern(song, pulsePattern, 0);
  const chorusPulse = collectArrangedPattern(song, pulsePattern, 32);
  const bridgePulse = collectArrangedPattern(song, pulsePattern, 128, 12);
  const scaleLength = DEFAULT_TONAL_CONTEXT.scale.length;
  const firstRoot = deriveSongRootDegrees(song)[0] ?? 0;
  const chordToneClasses = new Set([firstRoot, firstRoot + 2, firstRoot + 4].map((degree) =>
    modulo(degree, scaleLength)
  ));
  const rootPlans = deriveSongSectionRootPlans(song);
  const verseHarmony = getSongHarmonicContext(song, 0, arrangement);
  const chorusHarmony = getSongHarmonicContext(song, 32, arrangement);
  const bridgeHarmony = getSongHarmonicContext(song, 128, arrangement);

  expect(verseNotes.length).toBeGreaterThan(0);
  expect(chorusNotes.length).toBeGreaterThan(0);
  expect(chorusNotes.map((note) => note.scaleDegree)).not.toEqual(
    verseNotes.map((note) => note.scaleDegree),
  );
  expect(chorusNotes.every((note) =>
    DEFAULT_TONAL_CONTEXT.scale[modulo(note.scaleDegree, scaleLength)] !== undefined
  )).toBe(true);
  expect(chordToneClasses.has(modulo(chorusNotes[0].scaleDegree, scaleLength))).toBe(true);
  expect(chorusNotes.some((note) => note.durationBeats >= 1)).toBe(true);
  expect(bridgeNotes.length).toBeGreaterThan(0);
  expect(Math.max(...bridgeNotes.map((note) => note.octave))).toBe(5);
  expect(verseHarmony.rootDegrees).toEqual(rootPlans.gather);
  expect(chorusHarmony.rootDegrees).toEqual(rootPlans.answer);
  expect(bridgeHarmony.rootDegrees).toEqual(rootPlans.bridge);
  expect(verseBass.map((note) => modulo(note.scaleDegree, scaleLength))).not.toEqual(
    chorusBass.map((note) => modulo(note.scaleDegree, scaleLength)),
  );
  expect(chorusBass.map((note) => modulo(note.scaleDegree, scaleLength))).not.toEqual(
    bridgeBass.map((note) => modulo(note.scaleDegree, scaleLength)),
  );
  expect(modulo(verseBass[0]?.scaleDegree ?? -1, scaleLength)).toBe(modulo(verseHarmony.rootDegree, scaleLength));
  expect(modulo(chorusBass[0]?.scaleDegree ?? -1, scaleLength)).toBe(modulo(chorusHarmony.rootDegree, scaleLength));
  expect(modulo(bridgeBass[0]?.scaleDegree ?? -1, scaleLength)).toBe(modulo(bridgeHarmony.rootDegree, scaleLength));
  expect(new Set(versePulse.map((note) => modulo(note.scaleDegree, scaleLength)))).toEqual(
    new Set(rootPlans.gather.map((degree) => modulo(degree, scaleLength))),
  );
  expect(new Set(chorusPulse.map((note) => modulo(note.scaleDegree, scaleLength)))).toEqual(
    new Set(rootPlans.answer.map((degree) => modulo(degree, scaleLength))),
  );
  expect(new Set(bridgePulse.map((note) => modulo(note.scaleDegree, scaleLength)))).toEqual(
    new Set(rootPlans.bridge.map((degree) => modulo(degree, scaleLength))),
  );
  expect([...verseBass, ...chorusBass, ...bridgeBass].every((note) =>
    DEFAULT_TONAL_CONTEXT.scale[modulo(note.scaleDegree, scaleLength)] !== undefined
  )).toBe(true);
});

test("melody scoring repairs the chorus and scores player perspectives differently", () => {
  const song = getSongMaterialForTest("lantern");
  const take = createMelodyRepairTake({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    players: PLAYER_REGISTRY,
    perspectivePlayerId: "melody",
  });
  const scaleLength = DEFAULT_TONAL_CONTEXT.scale.length;
  const rawKey = take.rawPhrase.map((note) => `${note.stepIndex}:${note.scaleDegree}:${note.octave}`).join("|");
  const repairedKey = take.repairedPhrase.map((note) =>
    `${note.stepIndex}:${note.scaleDegree}:${note.octave}`
  ).join("|");
  const rawPositions = take.rawPhrase.map((note) => note.octave * scaleLength + note.scaleDegree);
  const repairedPositions = take.repairedPhrase.map((note) => note.octave * scaleLength + note.scaleDegree);
  const pulseScore = take.repairedScores.find((score) => score.perspectiveId === "pulse");
  const melodyScore = take.repairedScores.find((score) => score.perspectiveId === "melody");
  const deterministicCandidate = take.candidates.find((candidate) =>
    candidate.id === take.deterministicCandidateId
  );
  const bestCandidate = take.candidates.find((candidate) =>
    candidate.id === take.bestCandidateId
  );
  const alternateCandidate = take.candidates.find((candidate) =>
    candidate.source === "repair-alternate"
  );
  const strategies = new Set(take.candidates.map((candidate) => candidate.strategy));
  const spaciousCandidate = take.candidates.find((candidate) => candidate.strategy === "spacious-hook");
  const liftedCandidate = take.candidates.find((candidate) => candidate.strategy === "lifted-hook");
  const rootPlans = deriveSongSectionRootPlans(song);
  const songWideRoots = deriveSongRootDegrees(song);
  const mockCriticSelection = createMockMelodyCriticSelection(take);
  const deterministicConsensus = createMelodyConsensusDecision(take, take.deterministicCandidateId);
  const spaciousConsensus = spaciousCandidate
    ? createMelodyConsensusDecision(take, spaciousCandidate.id, "model-critic")
    : undefined;
  const liftedConsensus = liftedCandidate
    ? createMelodyConsensusDecision(take, liftedCandidate.id, "model-critic")
    : undefined;

  expect(take.improved).toBe(true);
  expect(take.scoringRootSection).toBe("answer");
  expect(take.scoringRootDegrees).toEqual(rootPlans.answer);
  expect(take.scoringRootDegrees).not.toEqual(songWideRoots);
  expect(take.primaryRepairedScore.total).toBeGreaterThan(take.primaryRawScore.total);
  expect(repairedKey).not.toEqual(rawKey);
  expect(pulseScore).toBeTruthy();
  expect(melodyScore).toBeTruthy();
  expect(pulseScore?.total).not.toBe(melodyScore?.total);
  expect(take.repairedPhrase.every((note) =>
    DEFAULT_TONAL_CONTEXT.scale[modulo(note.scaleDegree, scaleLength)] !== undefined
  )).toBe(true);
  expect(Math.min(...repairedPositions)).toBeGreaterThanOrEqual(Math.min(...rawPositions) - 1);
  expect(Math.max(...repairedPositions)).toBeLessThanOrEqual(Math.max(...rawPositions) + 1);
  expect(repairedPositions.slice(1).every((position, index) =>
    Math.abs(position - repairedPositions[index]) <= scaleLength
  )).toBe(true);
  expect(take.repairedPhrase.filter((note, index) =>
    note.positionBeats % 4 === 0 ||
    index === take.repairedPhrase.length - 1 ||
    note.positionBeats + note.durationBeats >= MELODY_CHORUS_PHRASE_BEATS
  ).every((note) => {
    const root = rootPlans.answer[Math.floor(note.positionBeats / 4) % rootPlans.answer.length] ?? 0;
    const chordClasses = [root, root + 2, root + 4].map((degree) => modulo(degree, scaleLength));
    return chordClasses.includes(modulo(note.scaleDegree, scaleLength));
  })).toBe(true);
  expect(take.primaryRepairedScore.critiques.length).toBeLessThanOrEqual(
    take.primaryRawScore.critiques.length,
  );
  expect(take.candidates.length).toBeGreaterThanOrEqual(3);
  expect(strategies.size).toBeGreaterThanOrEqual(5);
  expect([...strategies]).toEqual(expect.arrayContaining([
    "balanced-repair",
    "lifted-hook",
    "stepwise-hook",
    "spacious-hook",
  ]));
  expect(deterministicCandidate?.events).toEqual(take.repairedEvents);
  expect(deterministicCandidate?.strategy).toBe("balanced-repair");
  expect(bestCandidate).toBeTruthy();
  expect(bestCandidate?.scoreDeltaFromBest).toBe(0);
  expect(take.candidates.every((candidate) =>
    candidate.scoreDeltaFromBest <= 0 &&
    Number.isFinite(candidate.scoreDeltaFromDeterministic)
  )).toBe(true);
  expect(spaciousCandidate?.noteCount).toBeLessThan(deterministicCandidate?.noteCount ?? 0);
  expect(deterministicConsensus.responses.map((response) => response.playerId)).toEqual([
    "pulse",
    "bass",
    "melody",
  ]);
  expect(deterministicConsensus.selectedCandidateId).toBe(take.deterministicCandidateId);
  expect(spaciousConsensus?.proposedBy).toBe("model-critic");
  expect(spaciousConsensus?.selectedCandidateId).toBe(spaciousCandidate?.id);
  expect(spaciousConsensus?.responses.some((response) => response.stance === "accept")).toBe(true);
  expect(liftedConsensus?.proposedCandidateId).toBe(liftedCandidate?.id);
  expect(liftedConsensus?.selectedCandidateId).not.toBe(liftedCandidate?.id);
  expect(liftedCandidate?.phrase.some((note, index) => {
    const deterministicNote = deterministicCandidate?.phrase[index];
    if (!deterministicNote) return false;
    return note.octave * scaleLength + note.scaleDegree >
      deterministicNote.octave * scaleLength + deterministicNote.scaleDegree;
  })).toBe(true);
  expect(alternateCandidate?.phraseKey).not.toEqual(take.phraseKey);
  expect(take.candidates.every((candidate) =>
    candidate.phrase.every((note) =>
      DEFAULT_TONAL_CONTEXT.scale[modulo(note.scaleDegree, scaleLength)] !== undefined
    )
  )).toBe(true);
  expect(mockCriticSelection.selectedCandidateId).toBe(take.deterministicCandidateId);
  expect(validateMelodyCriticSelection(mockCriticSelection, take).valid).toBe(true);
  expect(validateMelodyCriticSelection({
    ...mockCriticSelection,
    selectedCandidateId: "not-a-candidate",
  }, take)).toMatchObject({
    valid: false,
  });
});

test("form score summarizes the whole song arc without changing playback", () => {
  const song = getSongMaterialForTest("lantern");
  const take = createMelodyRepairTake({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    players: PLAYER_REGISTRY,
    perspectivePlayerId: "melody",
  });
  const deterministicCandidate = take.candidates.find((candidate) =>
    candidate.id === take.deterministicCandidateId
  );
  if (!deterministicCandidate) {
    throw new Error("Expected deterministic melody candidate");
  }
  const score = createFormScore({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    chorusDevelopment: {
      mode: "repaired",
      repairedEvents: deterministicCandidate.events,
    },
  });
  const repeatedScore = createFormScore({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    chorusDevelopment: {
      mode: "repaired",
      repairedEvents: deterministicCandidate.events,
    },
  });
  const weakChorusScore = createFormScore({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    chorusDevelopment: {
      mode: "repaired",
      repairedEvents: deterministicCandidate.events.map((event) =>
        event ? { ...event, scaleDegree: event.scaleDegree + 1 } : null
      ),
    },
  });

  expect(repeatedScore).toEqual(score);
  expect(score.sections.map((section) => section.sectionType)).toEqual([
    "verse",
    "chorus",
    "verse",
    "chorus",
    "bridge",
    "chorus",
  ]);
  expect(score.total).toBeGreaterThan(0.55);
  expect(score.harmonicMotion.score).toBeGreaterThan(0.65);
  expect(score.energyArc.score).toBeGreaterThan(0.4);
  expect(score.melodicCoherence.score).toBeGreaterThan(0.4);
  expect(score.total).toBeGreaterThan(weakChorusScore.total);
  expect(score.cadence.score).toBeGreaterThan(weakChorusScore.cadence.score);
  expect(score.sections.find((section) => section.sectionType === "chorus")?.rootDegrees).toEqual(
    deriveSongSectionRootPlans(song).answer,
  );
});

test("form variants score deterministic audition forms", () => {
  const song = getSongMaterialForTest("lantern");
  const take = createMelodyRepairTake({
    song,
    tonalContext: DEFAULT_TONAL_CONTEXT,
    players: PLAYER_REGISTRY,
    perspectivePlayerId: "melody",
  });
  const deterministicCandidate = take.candidates.find((candidate) =>
    candidate.id === take.deterministicCandidateId
  );
  if (!deterministicCandidate) {
    throw new Error("Expected deterministic melody candidate");
  }
  const variantScores = FORM_VARIANTS.map((variant) => ({
    id: variant.id,
    score: createFormScore({
      song,
      tonalContext: DEFAULT_TONAL_CONTEXT,
      arrangement: variant.arrangement,
      chorusDevelopment: {
        mode: "repaired",
        repairedEvents: deterministicCandidate.events,
      },
      sectionDynamicsProfile: variant.sectionDynamicsProfile,
    }),
  }));
  const earlyHookScore = variantScores.find((entry) => entry.id === "early-hook")?.score;
  const wideReturnScore = variantScores.find((entry) => entry.id === "wide-return")?.score;

  expect(variantScores).toHaveLength(3);
  expect(new Set(variantScores.map(({ score }) => score.id)).size).toBe(variantScores.length);
  expect(new Set(variantScores.map(({ score }) => score.total)).size).toBeGreaterThan(1);
  expect(variantScores.every(({ score }) => Number.isFinite(score.total))).toBe(true);
  expect(variantScores.every(({ score }) => score.proportion.score > 0)).toBe(true);
  expect(wideReturnScore?.total).toBeGreaterThan(earlyHookScore?.total ?? 0);
  expect(wideReturnScore?.proportion.score).toBeGreaterThan(earlyHookScore?.proportion.score ?? 0);
  expect(sectionAtBeat(16, getFormVariant("classic-arc").arrangement)).toMatchObject({
    sectionType: "verse",
    occurrence: 1,
    localBar: 5,
  });
  expect(sectionAtBeat(16, getFormVariant("early-hook").arrangement)).toMatchObject({
    sectionType: "chorus",
    occurrence: 1,
    localBar: 1,
  });
  expect(getFormVariant("wide-return").arrangement.sections.at(-1)).toMatchObject({
    sectionType: "chorus",
    occurrence: 3,
    bars: 12,
  });
});

test("section dynamics policy is shared by playback and form scoring", () => {
  expect(applySectionDynamics({
    role: "melody",
    sectionType: "chorus",
    occurrence: 1,
    localBeat: 2,
    localBar: 1,
    absoluteBeat: 34,
    baseAction: "rest",
    baseShouldPlay: false,
    baseVelocityMultiplier: 0,
  })).toMatchObject({
    action: "vary",
    shouldPlay: true,
    velocityMultiplier: 1.18,
    tags: ["section:chorus", "section:developed-chorus"],
  });

  expect(applySectionDynamics({
    role: "bass",
    sectionType: "chorus",
    occurrence: 1,
    localBeat: 2,
    localBar: 1,
    absoluteBeat: 34,
    baseAction: "contrast",
    baseShouldPlay: true,
    baseVelocityMultiplier: 0.5,
  })).toMatchObject({
    action: "contrast",
    shouldPlay: true,
    velocityMultiplier: 0.57,
    tags: ["section:chorus", "section:full"],
  });

  expect(applySectionDynamics({
    role: "bass",
    sectionType: "bridge",
    occurrence: 1,
    localBeat: 4,
    localBar: 2,
    absoluteBeat: 132,
  })).toMatchObject({
    action: "simplify",
    shouldPlay: false,
    velocityMultiplier: 0,
    tags: ["section:bridge", "section:sparse"],
  });

  expect(applySectionDynamics({
    role: "melody",
    sectionType: "verse",
    occurrence: 1,
    localBeat: 1,
    localBar: 1,
    absoluteBeat: 1,
    baseAction: "support",
    baseShouldPlay: true,
    baseVelocityMultiplier: 0.5,
  })).toMatchObject({
    action: "support",
    shouldPlay: true,
    velocityMultiplier: 0.47,
    tags: ["section:verse", "section:grounded"],
  });

  const spaciousProfile = createGoalSectionDynamicsProfile(BALANCED_SECTION_DYNAMICS_PROFILE, {
    id: "goal-test",
    energy: 0.44,
    sectionEmphasis: {
      verse: 0.5,
      chorus: 0.72,
      bridge: 0.72,
    },
  });
  expect(spaciousProfile.verseMultiplier).toBe(0.983);
  expect(spaciousProfile.chorusMultiplier).toBe(1.087);
  expect(spaciousProfile.bridgeMultiplier).toBe(1.087);
  const spaciousChorusBassDecision = applySectionDynamics({
    role: "bass",
    sectionType: "chorus",
    occurrence: 1,
    localBeat: 2,
    localBar: 1,
    absoluteBeat: 34,
    baseAction: "repeat",
    baseShouldPlay: true,
    baseVelocityMultiplier: 0.5,
    profile: spaciousProfile,
  });
  expect(spaciousChorusBassDecision).toMatchObject({
    action: "repeat",
    shouldPlay: true,
  });
  expect(spaciousChorusBassDecision.velocityMultiplier).toBeCloseTo(0.61959, 5);
});

test("song goal taste profile applies bounded surprise and disposition nudges", () => {
  expect(createGoalTasteProfile(MELODY_PLAYER.taste, "melody", undefined)).toBe(MELODY_PLAYER.taste);

  const restless = createGoalTasteProfile(MELODY_PLAYER.taste, "melody", {
    id: "restless",
    surpriseTarget: 0.72,
    dispositionBias: { melody: 0.14 },
  });
  expect(restless.noveltyPreference).toBeGreaterThan(MELODY_PLAYER.taste.noveltyPreference);
  expect(restless.repetitionPreference).toBeLessThan(MELODY_PLAYER.taste.repetitionPreference);
  expect(restless.densityTarget).toBeGreaterThan(MELODY_PLAYER.taste.densityTarget);
  expect(restless.densityTolerance).toBeGreaterThan(MELODY_PLAYER.taste.densityTolerance);

  const spare = createGoalTasteProfile(MELODY_PLAYER.taste, "melody", {
    id: "spare",
    surpriseTarget: 0.14,
    dispositionBias: { melody: -0.25 },
  });
  expect(spare.noveltyPreference).toBeLessThan(MELODY_PLAYER.taste.noveltyPreference);
  expect(spare.repetitionPreference).toBeGreaterThan(MELODY_PLAYER.taste.repetitionPreference);
  expect(spare.densityTarget).toBeLessThan(MELODY_PLAYER.taste.densityTarget);
  expect(spare.densityTolerance).toBeGreaterThan(MELODY_PLAYER.taste.densityTolerance);
});

test("candidate contract validates bounded phrase genomes and clamps scores", () => {
  const phraseGenome = SONG_MATERIALS[0].patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "melody")
  );
  if (!phraseGenome) {
    throw new Error("Expected a melody phrase genome fixture");
  }

  const result = validateCandidate({
    kind: "phrase",
    genome: {
      ...phraseGenome,
      events: [
        ...phraseGenome.events,
        {
          playerId: "melody",
          scaleDegree: 99,
          octave: 12,
          duration: "8n",
          durationBeats: 99,
          velocity: 2,
        },
      ],
    },
    scores: {
      prosody: 1.25,
      coherence: 0.42,
    },
    fitness: -0.4,
    generation: 2.8,
    seed: 42.9,
    status: "alive",
    createdAtBeat: 4,
  });
  expect(result.valid).toBe(true);
  expect(result.candidate.kind).toBe("phrase");
  expect(result.candidate.scores.prosody).toBe(1);
  expect(result.candidate.fitness).toBe(0);
  expect(result.candidate.generation).toBe(2);
  expect(result.candidate.seed).toBe(42);
  expect(result.candidate.createdAtBeat).toBe(4);
  expect(result.clamps).toEqual(expect.arrayContaining([
    expect.stringContaining("scores.prosody"),
    expect.stringContaining("fitness"),
    expect.stringContaining("scaleDegree"),
    expect.stringContaining("octave"),
    expect.stringContaining("durationBeats"),
    expect.stringContaining("velocity"),
  ]));
  expect(assertValidCandidate(result.candidate).id).toBe(result.candidate.id);

  const invalid = validateCandidate({
    kind: "riff",
    genome: { freeform: "not a closed kind" },
    scores: {},
  });
  expect(invalid.valid).toBe(false);
  expect(invalid.errors).toEqual(expect.arrayContaining([
    expect.stringContaining("kind must be one of"),
  ]));
});

test("candidate fitness aggregation is pure weighted bounded scoring", () => {
  const aggregate = aggregateCandidateFitness(
    {
      landing: 1,
      monotony: 0.5,
      surprise: 0.25,
      unweightedNovelty: 1,
    },
    {
      weights: {
        landing: 2,
        monotony: 1,
        surprise: 1,
      },
    },
  );

  expect(aggregate.fitness).toBe(0.6875);
  expect(aggregate.totalWeight).toBe(4);
  expect(aggregate.ignoredScoreKeys).toEqual(["unweightedNovelty"]);
  expect(aggregate.contributions).toEqual([
    expect.objectContaining({
      key: "landing",
      score: 1,
      weight: 2,
      normalizedWeight: 0.5,
      weightedScore: 0.5,
      missing: false,
    }),
    expect.objectContaining({
      key: "monotony",
      score: 0.5,
      weight: 1,
      normalizedWeight: 0.25,
      weightedScore: 0.125,
      missing: false,
    }),
    expect.objectContaining({
      key: "surprise",
      score: 0.25,
      weight: 1,
      normalizedWeight: 0.25,
      weightedScore: 0.0625,
      missing: false,
    }),
  ]);

  const penalizedMissing = aggregateCandidateFitness(
    { landing: 1 },
    { weights: { landing: 1, cadence: 1 } },
  );
  expect(penalizedMissing.fitness).toBe(0.5);
  expect(penalizedMissing.contributions.find((entry) => entry.key === "cadence")).toMatchObject({
    score: 0,
    missing: true,
  });

  const bounded = aggregateCandidateFitness(
    { landing: 4, monotony: -1, surprise: Number.NaN },
    { weights: { landing: 1, monotony: 1, surprise: 1, ignored: -99 } },
  );
  expect(bounded.fitness).toBeCloseTo(1 / 3, 6);
  expect(bounded.contributions.map((entry) => entry.key)).toEqual(["landing", "monotony", "surprise"]);
  expect(bounded.contributions.map((entry) => entry.score)).toEqual([1, 0, 0]);

  const phraseAggregate = aggregateCandidateFitness({
    richness: 0.5,
    anacrusis: 1,
    questionAnswer: 0.25,
    anchorContrast: 0.75,
  });
  expect(phraseAggregate.fitness).toBe(0.5375);
  expect(phraseAggregate.ignoredScoreKeys).toEqual([]);
  expect(phraseAggregate.contributions.map((entry) => entry.key)).toEqual([
    "anacrusis",
    "anchorContrast",
    "questionAnswer",
    "richness",
  ]);
  expect(aggregateCandidateFitness({
    richness: 0.5,
    anacrusis: 1,
    questionAnswer: 0.25,
    anchorContrast: 0.75,
  }, { kind: "phrase" })).toEqual(phraseAggregate);

  const candidate = assertValidCandidate({
    kind: "phrase",
    genome: SONG_MATERIALS[0].patterns[0],
    scores: { landing: 0.8, cadence: 0.6 },
    fitness: 0,
    generation: 1,
    seed: 7,
  });
  const preview = previewCandidateFitness(candidate, {
    weights: { landing: 1, cadence: 1 },
  });
  expect(preview.fitness.fitness).toBe(0.7);
  expect(preview.candidate.fitness).toBe(0.7);
  expect(candidate.fitness).toBe(0);
  expect(preview.candidate).not.toBe(candidate);
});

test("song goal interpreter produces bounded deterministic knobs", () => {
  const spacious = interpretSongGoal("slow bright spacious wide return with machine pulse in G dorian");
  const urgent = interpretSongGoal("urgent restless hook chorus with glass sparks");
  const falsePositiveProbe = interpretSongGoal("repair the texture and avoid crunch artifacts");

  expect(spacious.validation.valid).toBe(true);
  expect(spacious.goal.tonic).toBe("G");
  expect(spacious.goal.mode).toBe("dorian");
  expect(spacious.goal.tempoBpm).toBeLessThan(90);
  expect(spacious.goal.brightness).toBeGreaterThan(0.6);
  expect(spacious.goal.formPreference).toBe("wide-return");
  expect(spacious.goal.influenceHints).toContain("machine-hum");
  expect(spacious.goal.influenceHints.every((hint) => SONG_GOAL_INFLUENCE_HINTS.includes(hint))).toBe(true);
  expect(spacious.goal.sectionEmphasis.bridge ?? 0).toBeGreaterThan(0.6);
  expect(interpretSongGoal(spacious.goal.sourceIdea).goal).toEqual(spacious.goal);

  expect(urgent.validation.valid).toBe(true);
  expect(urgent.goal.formPreference).toBe("early-hook");
  expect(urgent.goal.energy).toBeGreaterThan(0.7);
  expect(urgent.goal.surpriseTarget).toBeGreaterThan(0.65);
  expect(urgent.goal.influenceHints).toContain("restless-hook");

  expect(falsePositiveProbe.validation.valid).toBe(true);
  expect(falsePositiveProbe.goal.tempoBpm).toBe(90);
  expect(falsePositiveProbe.goal.energy).toBe(0.52);
  expect(falsePositiveProbe.goal.formPreference).toBe("classic-arc");
  expect(falsePositiveProbe.matchedKeywords).not.toContain("air");
  expect(falsePositiveProbe.matchedKeywords).not.toContain("run");
});

test("song goal validation clamps numbers and rejects unknown vocabulary", () => {
  const result = validateSongGoal({
    status: "model",
    sourceIdea: "agent text is still only provenance",
    tonic: "H",
    mode: "hyperlocrian",
    tempoBpm: 999,
    energy: -2,
    surpriseTarget: 4,
    brightness: 2,
    formPreference: "through-composed",
    dispositionBias: {
      pulse: 2,
      alien: 0.1,
    },
    influenceHints: ["machine-hum", "freeform-guitar"],
    sectionEmphasis: {
      chorus: 2,
      outro: 0.5,
    },
    rationale: "this is display prose, not executable instruction",
  });

  expect(result.valid).toBe(false);
  expect(result.goal.tempoBpm).toBe(150);
  expect(result.goal.energy).toBe(0);
  expect(result.goal.surpriseTarget).toBe(1);
  expect(result.goal.brightness).toBe(1);
  expect(result.goal.dispositionBias.pulse).toBe(0.25);
  expect(result.goal.influenceHints).toEqual(["machine-hum"]);
  expect(result.goal.sectionEmphasis.chorus).toBe(1);
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining("tonic"),
    expect.stringContaining("mode"),
    expect.stringContaining("formPreference"),
    expect.stringContaining("unknown disposition role alien"),
    expect.stringContaining("unknown influence hint freeform-guitar"),
    expect.stringContaining("unknown section emphasis outro"),
  ]));
  expect(result.clamps.length).toBeGreaterThanOrEqual(5);
});

test("song goal setup derives a bounded tonal context", () => {
  expect(createTonalContext("G", "dorian")).toEqual({
    tonic: "G",
    mode: "dorian",
    scale: ["G", "A", "Bb", "C", "D", "E", "F"],
  });
  expect(createTonalContext("Bb", "mixolydian")).toEqual({
    tonic: "Bb",
    mode: "mixolydian",
    scale: ["Bb", "C", "D", "Eb", "F", "G", "Ab"],
  });
});

test("song goal inspector interprets prose without driving playback", async ({ page }) => {
  await page.goto("/");
  await flushPersistence(page);
  await expect(page.getByTestId("song-goal-status")).toContainText("deterministic | valid");
  await expect(page.getByTestId("song-goal-setup")).toContainText("C mixolydian");

  const beforeState = await getTransportState(page);
  await page.getByTestId("song-goal-idea-input").fill("slow bright spacious wide return with machine pulse in G dorian");
  await page.getByTestId("song-goal-interpret").click();

  await expect(page.getByTestId("song-goal-setup")).toContainText("G dorian");
  await expect(page.getByTestId("song-goal-setup")).toContainText("wide-return");
  await expect(page.getByTestId("song-goal-influences")).toContainText("machine-hum");
  await expect(page.getByTestId("song-goal-validation")).toContainText("valid; no clamps");
  const goalResult = await getSongGoalResult(page);
  expect(goalResult.validation.valid).toBe(true);
  expect(goalResult.goal.formPreference).toBe("wide-return");
  expect(goalResult.goal.mode).toBe("dorian");
  expect(goalResult.goal.tempoBpm).toBeLessThan(90);

  const repeated = await page.evaluate(() => {
    const appWindow = window as unknown as {
      songGoal?: {
        interpret(sourceIdea: string): SongGoalInterpretation;
        getVocabulary(): { influenceHints: readonly string[] };
      };
    };
    const first = appWindow.songGoal?.interpret("urgent restless hook chorus with glass sparks");
    const second = appWindow.songGoal?.interpret("urgent restless hook chorus with glass sparks");
    return { first, second, vocabulary: appWindow.songGoal?.getVocabulary() };
  });
  expect(repeated.first?.goal).toEqual(repeated.second?.goal);
  expect(repeated.first?.goal.formPreference).toBe("early-hook");
  expect(repeated.vocabulary?.influenceHints).toContain("restless-hook");

  const afterState = await getTransportState(page);
  expect(afterState.status).toBe(beforeState.status);
  expect(afterState.bpm).toBe(beforeState.bpm);
  expect(afterState.songId).toBe(beforeState.songId);
  expect(afterState.songForm.sectionType).toBe(beforeState.songForm.sectionType);
});

test("song goal setup applies tonal context tempo form and persists the structured goal", async ({ page }) => {
  await page.goto("/");
  await flushPersistence(page);
  const beforeState = await getTransportState(page);
  expect(beforeState.bpm).toBe(90);

  await page.getByTestId("song-goal-idea-input").fill("slow bright spacious wide return with machine pulse in G dorian");
  await page.getByTestId("song-goal-interpret").click();
  await expect(page.getByTestId("song-goal-setup")).toContainText("G dorian");
  await expect(page.getByTestId("song-goal-applied")).toContainText("not applied");

  await page.getByTestId("song-goal-apply").click();
  await expect(page.getByTestId("song-goal-applied")).toContainText("G dorian");
  await expect(page.getByTestId("song-goal-applied")).toContainText("75 BPM");
  await expect(page.getByTestId("song-goal-applied")).toContainText("wide-return");
  await expect(page.getByTestId("song-goal-applied")).toContainText("energy 0.44");
  await expect(page.getByTestId("song-goal-applied")).toContainText("surprise 0.42");
  await expect(page.getByTestId("song-goal-applied")).toContainText("chorus 0.72");
  await expect(page.getByTestId("song-goal-applied")).toContainText("bridge 0.72");
  await expect(page.getByTestId("song-goal-applied")).toContainText("melody -0.020");
  await expect(page.getByTestId("listening-tonal-context")).toHaveText("G dorian");
  const appliedGoal = await getAppliedSongGoal(page);
  expect(appliedGoal).toMatchObject({
    tonic: "G",
    mode: "dorian",
    tempoBpm: 75,
    formPreference: "wide-return",
  });

  const setupState = await getTransportState(page);
  expect(setupState.status).toBe("stopped");
  expect(setupState.bpm).toBe(75);
  expect(setupState.lookahead.pendingSlotCount).toBe(0);
  const activeVariant = await page.evaluate(() => {
    const appWindow = window as unknown as {
      formScore?: { getVariant(): { id: string } };
    };
    return appWindow.formScore?.getVariant().id;
  });
  expect(activeVariant).toBe("wide-return");
  const tasteProfiles = await getTasteProfiles(page);
  const pulseTasteProfile = tasteProfiles.find((profile) => profile.playerId === "pulse");
  const melodyTasteProfile = tasteProfiles.find((profile) => profile.playerId === "melody");
  expect(pulseTasteProfile).toBeTruthy();
  expect(melodyTasteProfile).toBeTruthy();
  expect(pulseTasteProfile!.adjusted.densityTarget).toBeGreaterThan(pulseTasteProfile!.base.densityTarget);
  expect(pulseTasteProfile!.adjusted.noveltyPreference).toBeGreaterThan(pulseTasteProfile!.base.noveltyPreference);
  expect(melodyTasteProfile!.adjusted.densityTarget).toBeLessThan(melodyTasteProfile!.base.densityTarget);
  const sketch = await getSongSketch(page);
  expect(sketch.tonalContext).toEqual({
    tonic: "G",
    mode: "dorian",
    scale: ["G", "A", "Bb", "C", "D", "E", "F"],
  });
  const formScore = await page.evaluate(() => {
    const appWindow = window as unknown as {
      formScore?: {
        getScore(): {
          sections: readonly { sectionType: string; energy: number }[];
        };
      };
    };
    return appWindow.formScore?.getScore();
  });
  expect(formScore).toBeTruthy();
  const verseEnergy = formScore?.sections.find((section) => section.sectionType === "verse")?.energy ?? 0;
  const chorusEnergy = formScore?.sections.find((section) => section.sectionType === "chorus")?.energy ?? 0;
  const bridgeEnergy = formScore?.sections.find((section) => section.sectionType === "bridge")?.energy ?? 0;
  expect(chorusEnergy).toBeGreaterThan(verseEnergy);
  expect(bridgeEnergy).toBeGreaterThan(0);

  await flushPersistence(page);
  const persistenceState = await getPersistenceState(page);
  const dump = await dumpPersistence(page, 200);
  const goalEvents = dump.events
    .filter((event) =>
      event.sessionId === persistenceState.sessionId &&
      event.type === "song.goal_set"
    )
    .sort((left, right) => left.seq - right.seq);
  expect(goalEvents).toHaveLength(1);
  expect(goalEvents[0].payload.goal).toMatchObject({
    tonic: "G",
    mode: "dorian",
    tempoBpm: 75,
    formPreference: "wide-return",
  });
  expect(goalEvents[0].payload.nextSetup).toMatchObject({
    tonic: "G",
    mode: "dorian",
    tempoBpm: 75,
    formVariantId: "wide-return",
  });

  await page.getByTestId("transport-toggle").click();
  await expect(page.getByTestId("transport-toggle")).toHaveText("Stop");
  await expect.poll(async () => (await getListeningFrame(page)).eventCount, { timeout: 8_000 }).toBeGreaterThan(8);
  const frame = await getListeningFrame(page);
  expect(frame.tonalContext).toEqual({
    tonic: "G",
    mode: "dorian",
    scale: ["G", "A", "Bb", "C", "D", "E", "F"],
  });
  const heardPitchClasses = frame.recentEvents
    .map((event) => event.pitch?.replace(/-?\d+$/, ""))
    .filter((pitchClass): pitchClass is string => Boolean(pitchClass));
  expect(heardPitchClasses.length).toBeGreaterThan(0);
  expect(heardPitchClasses.every((pitchClass) => frame.tonalContext.scale.includes(pitchClass))).toBe(true);

  await page.getByTestId("transport-toggle").click();
  await expect(page.getByTestId("transport-toggle")).toHaveText("Start");
});

test("form variant selector scores candidates and drives the transport form", async ({ page }) => {
  await page.goto("/");
  await flushPersistence(page);
  await expect(page.getByTestId("form-variant-current")).toContainText("Classic Arc");
  await expect(page.getByTestId("form-variant-candidates")).toContainText("Classic Arc");
  await expect(page.getByTestId("form-variant-candidates")).toContainText("Early Hook");
  await expect(page.getByTestId("form-variant-candidates")).toContainText("Wide Return");
  await expect(page.getByTestId("form-score-subscores")).toContainText("proportion");

  const initialVariants = await page.evaluate(() => {
    const appWindow = window as unknown as {
      formScore?: {
        getVariant(): { id: string };
        getVariants(): Array<{ variant: { id: string }; score: { total: number }; active: boolean; winner: boolean }>;
      };
    };
    return {
      active: appWindow.formScore?.getVariant().id,
      variants: appWindow.formScore?.getVariants() ?? [],
    };
  });
  expect(initialVariants.active).toBe("classic-arc");
  expect(initialVariants.variants).toHaveLength(3);
  expect(initialVariants.variants.filter((entry) => entry.active)).toHaveLength(1);
  expect(initialVariants.variants.filter((entry) => entry.winner)).toHaveLength(1);

  await page.getByTestId("form-variant-early-hook-option").click();
  await expect(page.getByTestId("form-variant-current")).toContainText("Early Hook");
  const selectedVariant = await page.evaluate(() => {
    const appWindow = window as unknown as {
      formScore?: { getVariant(): { id: string } };
    };
    return appWindow.formScore?.getVariant().id;
  });
  expect(selectedVariant).toBe("early-hook");

  await page.getByTestId("transport-toggle").click();
  await page.waitForFunction(() => {
    const appWindow = window as unknown as {
      transport?: { getState(): TransportState };
    };
    return (appWindow.transport?.getState().currentBeat ?? 0) >= 16.5;
  }, null, { timeout: 16_000 });
  const playingState = await getTransportState(page);
  expect(playingState.songForm).toMatchObject({
    sectionType: "chorus",
    occurrence: 1,
  });
  expect(playingState.songForm.localBar).toBeLessThanOrEqual(2);

  await page.getByTestId("transport-toggle").click();
});

test("melody repair readout supports A/B audition and remembered feedback", async ({ page }) => {
  await page.goto("/");
  await flushPersistence(page);
  await expect(page.getByTestId("melody-development-current")).toHaveText("Repaired");
  await expect(page.getByTestId("melody-score-total")).toContainText("repaired");
  await expect(page.getByTestId("melody-score-choice")).toContainText("balanced-repair");
  await expect(page.getByTestId("melody-score-roots")).toContainText("Answer");
  await expect(page.getByTestId("melody-score-perspectives")).toContainText("pulse");
  await expect(page.getByTestId("form-score-total")).toContainText("form");
  await expect(page.getByTestId("form-score-subscores")).toContainText("harmony");

  const initialTake = await getMelodyRepairTake(page);
  expect(initialTake.improved).toBe(true);

  await page.getByTestId("melody-development-raw-option").click();
  await expect(page.getByTestId("melody-development-current")).toHaveText("Raw transform");
  await expect(page.getByTestId("melody-development-raw")).toBeChecked();

  await page.getByTestId("melody-development-repaired-option").click();
  await expect(page.getByTestId("melody-development-current")).toHaveText("Repaired");
  await expect(page.getByTestId("melody-development-repaired")).toBeChecked();

  await page.getByTestId("melody-repair-down").click();
  await expect(page.getByTestId("melody-score-feedback")).toContainText("1 rejected");
  const rerolledTake = await getMelodyRepairTake(page);
  expect(rerolledTake.phraseKey).not.toEqual(initialTake.phraseKey);

  await page.getByTestId("melody-repair-up").click();
  await expect(page.getByTestId("melody-score-feedback")).toContainText("1 remembered");
  await flushPersistence(page);

  const persistenceState = await getPersistenceState(page);
  const dump = await dumpPersistence(page, 200);
  const feedbackEvents = dump.events
    .filter((event) =>
      event.sessionId === persistenceState.sessionId &&
      event.type === "song.take_feedback"
    )
    .sort((left, right) => left.seq - right.seq);

  expect(feedbackEvents.map((event) => event.payload.feedback)).toEqual(["down", "up"]);
  expect(feedbackEvents.at(-1)?.payload).toMatchObject({
    memoryStatus: "remembered-good",
    songId: "lantern",
    sectionType: "chorus",
  });
});

test("manual Ollama melody critic selects a validated local chorus candidate", async ({ page }) => {
  const proxyChatPayloads: Array<{
    baseUrl?: string;
    request?: {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
      stream?: boolean;
      format?: unknown;
      think?: boolean;
      options?: { temperature?: number; num_predict?: number };
    };
  }> = [];
  let selectedCandidateId = "";

  await page.route("**/api/ollama/chat**", async (route) => {
    proxyChatPayloads.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            selectedCandidateId,
            rationale: "Pick the alternate because its contour keeps the chorus from sounding too automatic.",
            strengths: "The contour has a clearer lift and keeps the cadence bounded.",
            concerns: "It gives up a little deterministic score margin for feel.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("melody-candidate-current")).toContainText("chorus-candidate");
  const take = await getMelodyRepairTake(page);
  const alternate = take.candidates.find((candidate) =>
    candidate.strategy === "spacious-hook" &&
    candidate.id !== take.deterministicCandidateId
  ) ?? take.candidates.find((candidate) =>
    candidate.source === "repair-alternate" &&
    candidate.strategy !== "local-alternate" &&
    candidate.id !== take.deterministicCandidateId &&
    candidate.events.some((event, index) =>
      JSON.stringify(event) !== JSON.stringify(take.repairedEvents[index] ?? null)
    )
  ) ?? take.candidates.find((candidate) => candidate.id !== take.deterministicCandidateId);
  expect(alternate).toBeTruthy();
  selectedCandidateId = alternate?.id ?? "";

  const initialCandidate = await getMelodyRepairCandidate(page);
  expect(initialCandidate.id).toBe(take.deterministicCandidateId);
  await page.getByTestId("melody-critic-send").click();
  await expect(page.getByTestId("melody-critic-status")).toContainText("model proposed");
  await expect(page.getByTestId("melody-candidate-current")).toContainText(selectedCandidateId);
  await expect(page.getByTestId("melody-score-choice")).toContainText(alternate?.strategy ?? "");
  await expect(page.getByTestId("melody-consensus-status")).toContainText("selected");
  await expect(page.getByTestId("melody-consensus-responses")).toContainText("bass");

  const activeCandidate = await getMelodyRepairCandidate(page);
  const consensus = await getMelodyConsensus(page);
  expect(consensus.proposedBy).toBe("model-critic");
  expect(consensus.proposedCandidateId).toBe(selectedCandidateId);
  expect(consensus.selectedBy).toBe("band-consensus");
  expect(consensus.selectedCandidateId).toBe(selectedCandidateId);
  expect(consensus.responses.map((response) => response.playerId)).toEqual(["pulse", "bass", "melody"]);
  expect(consensus.responses.some((response) => response.stance === "accept")).toBe(true);
  expect(activeCandidate.id).toBe(selectedCandidateId);
  expect(activeCandidate.events).toEqual(alternate?.events);
  expect(activeCandidate.id).not.toBe(take.deterministicCandidateId);
  expect(activeCandidate.strategy).toBe(alternate?.strategy);

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastMelodyCriticTest(): OllamaMelodyCriticProbe };
    };
    return appWindow.ollama?.getLastMelodyCriticTest();
  });

  expect(probe?.status).toBe("valid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.promptProtocol).toBe("melody-critic");
  expect(probe?.takeId).toBe(take.id);
  expect(probe?.bestCandidateId).toBe(take.bestCandidateId);
  expect(probe?.selectedCandidateId).toBe(selectedCandidateId);
  expect(probe?.selectedScoreDeltaFromBest).toBe(activeCandidate.scoreDeltaFromBest);
  expect(probe?.selectedScoreDeltaFromDeterministic).toBe(activeCandidate.scoreDeltaFromDeterministic);
  expect(probe?.validation.valid).toBe(true);
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect((await getTransportState(page)).status).toBe("stopped");

  expect(proxyChatPayloads).toHaveLength(1);
  const chatPayload = proxyChatPayloads[0].request ?? {};
  const formatText = JSON.stringify(chatPayload.format);
  const userMessage = chatPayload.messages?.find((message) => message.role === "user")?.content ?? "";
  const systemMessage = chatPayload.messages?.find((message) => message.role === "system")?.content ?? "";
  expect(proxyChatPayloads[0].baseUrl).toBe("http://127.0.0.1:11434");
  expect(chatPayload.model).toBe("qwen3:4b-instruct-2507-q4_K_M");
  expect(chatPayload.stream).toBe(false);
  expect(chatPayload.think).toBe(false);
  expect(chatPayload.options?.num_predict).toBeLessThanOrEqual(256);
  expect(formatText).toContain("selectedCandidateId");
  expect(formatText).toContain(selectedCandidateId);
  expect(formatText).not.toContain("scaleDegree");
  expect(formatText).not.toContain("octave");
  expect(userMessage).toContain("Candidate projection:");
  expect(userMessage).toContain('"v":"grow.melodyCritic/1"');
  expect(userMessage).toContain(selectedCandidateId);
  expect(userMessage).toContain('"strategy"');
  expect(userMessage).toContain('"scoreDeltaFromBest"');
  expect(userMessage).toContain("Do not return phrase, notes, scaleDegree, octave");
  expect(systemMessage).toContain("must not emit, rewrite, or invent notes");
});

test("manual Ollama melody critic keeps deterministic fallback for invalid candidate id", async ({ page }) => {
  await page.route("**/api/ollama/chat**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            selectedCandidateId: "not-a-real-candidate",
            rationale: "This intentionally points outside the app-owned candidate list.",
            strengths: "It should parse but fail validation.",
            concerns: "The deterministic scorer must remain active.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("melody-candidate-current")).toContainText("chorus-candidate");
  const take = await getMelodyRepairTake(page);
  await expect(page.getByTestId("melody-candidate-current")).toContainText(take.deterministicCandidateId);
  await page.getByTestId("melody-critic-send").click();
  await expect(page.getByTestId("melody-critic-status")).toContainText("invalid");
  await expect(page.getByTestId("melody-candidate-current")).toContainText(take.deterministicCandidateId);

  const activeCandidate = await getMelodyRepairCandidate(page);
  const consensus = await getMelodyConsensus(page);
  expect(activeCandidate.id).toBe(take.deterministicCandidateId);
  expect(consensus.proposedBy).toBe("deterministic-scorer");
  expect(consensus.selectedCandidateId).toBe(take.deterministicCandidateId);

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastMelodyCriticTest(): OllamaMelodyCriticProbe };
    };
    return appWindow.ollama?.getLastMelodyCriticTest();
  });

  expect(probe?.status).toBe("invalid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.validation.valid).toBe(false);
  expect(probe?.validation.errors.join(" ")).toContain("selectedCandidateId");
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect((await getTransportState(page)).status).toBe("stopped");
});

test("manual Ollama thought probe is inspectable with a mocked local endpoint", async ({ page }) => {
  let directOllamaRequestCount = 0;
  const proxyChatPayloads: Array<{
    baseUrl?: string;
    request?: {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
      stream?: boolean;
      format?: unknown;
      think?: boolean;
      options?: { temperature?: number; num_predict?: number };
    };
  }> = [];

  await page.route("http://127.0.0.1:11434/**", async (route) => {
    directOllamaRequestCount += 1;
    await route.fulfill({
      status: 418,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "browser should use local proxy" }),
    });
  });

  await page.route("**/api/ollama/tags**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("baseUrl")).toBe("http://127.0.0.1:11434");
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({ models: [{ name: "qwen3:4b-instruct-2507-q4_K_M" }] }),
    });
  });

  await page.route("**/api/ollama/chat**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("baseUrl")).toBe("http://127.0.0.1:11434");
    proxyChatPayloads.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            id: "mocked-local-intent",
            responseLevel: "variation_intent",
            action: "vary_motif",
            confidence: 0.72,
            target: { startAfterBeats: 1, durationBeats: 1 },
            musicalIdea: {
              label: "mocked local turn",
              origin: "imagined",
              durationBeats: 1,
              steps: [{
                kind: "note",
                positionBeats: 0,
                durationBeats: 0.5,
                scaleDegree: 2,
                octave: 4,
                velocity: 0.55,
                tags: ["ollama"],
              }],
              tags: ["ollama-intent"],
            },
            rationale: "Use one bright in-scale answer.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-health-check").click();
  await expect(page.getByTestId("ollama-health-status")).toContainText("ready");
  await expect(page.getByTestId("ollama-latency")).toContainText("ms");

  await page.getByTestId("ollama-send-thought").click();
  await expect(page.getByTestId("ollama-parse-result")).toHaveText("ok");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("valid");
  await expect(page.getByTestId("ollama-raw-response")).toContainText("mocked local turn");
  await expect(page.getByTestId("ollama-fallback-status")).toContainText("mock fallback valid");

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastThoughtTest(): OllamaThoughtProbe };
    };
    return appWindow.ollama?.getLastThoughtTest();
  });

  expect(probe?.status).toBe("valid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.promptProtocol).toBe("projected-json");
  expect(probe?.validation.valid).toBe(true);
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect(probe?.intent?.musicalIdea.steps[0]?.pitch).toBe("E4");
  expect(probe?.intent?.musicalIdea.sourceStartBeat).not.toBe(999);
  expect((await getTransportState(page)).lookahead.pendingSlotCount).toBe(0);
  expect((await getTransportState(page)).status).toBe("stopped");
  expect(directOllamaRequestCount).toBe(0);

  expect(proxyChatPayloads).toHaveLength(1);
  const [proxyChatPayload] = proxyChatPayloads;
  const chatPayload = proxyChatPayload.request ?? {};
  const userMessage = chatPayload.messages?.find((message) => message.role === "user")?.content ?? "";
  expect(proxyChatPayload.baseUrl).toBe("http://127.0.0.1:11434");
  expect(chatPayload.model).toBe("qwen3:4b-instruct-2507-q4_K_M");
  expect(chatPayload.stream).toBe(false);
  expect(chatPayload.think).toBe(false);
  expect(chatPayload.options?.num_predict).toBeLessThanOrEqual(512);
  expect(JSON.stringify(chatPayload.format)).not.toContain('"pitch"');
  expect(chatPayload.format).toMatchObject({
    type: "object",
    additionalProperties: false,
    properties: {
      requestId: { enum: [probe?.requestId] },
      playerId: { enum: [probe?.playerId] },
      registerDelta: { type: "integer", enum: [-1, 0, 1] },
    },
    allOf: [{
      if: {
        properties: {
          action: { const: "shift_register" },
        },
        required: ["action"],
      },
      then: {
        required: ["registerDelta"],
      },
    }],
  });
  expect(userMessage).toContain("Request projection:");
  expect(userMessage).toContain('"v":"grow.thought/1"');
  expect(userMessage).toContain('"motif"');
  expect(userMessage).toContain("registerDelta");
  expect(userMessage).toContain("top-level registerDelta");
  expect(userMessage).toContain("Do not only mention registerDelta in rationale");
  expect(userMessage).toContain('"action":"shift_register","registerDelta":1');
  expect(userMessage).toContain("Do not include pitch");
  expect(userMessage).not.toContain("Request JSON:");
  expect(userMessage).not.toContain('"seed"');
  expect(userMessage).not.toContain('"sourceStartBeat"');
});

test("manual Ollama thought probe keeps mock fallback when proxy chat fails", async ({ page }) => {
  await page.route("**/api/ollama/chat**", async (route) => {
    await route.fulfill({
      status: 503,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({ error: "offline for smoke" }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-send-thought").click();
  await expect(page.getByTestId("ollama-parse-result")).toHaveText("error (1)");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("invalid (1)");
  await expect(page.getByTestId("ollama-fallback-status")).toContainText("mock fallback valid");
  await expect(page.getByTestId("ollama-errors")).toContainText("HTTP 503");

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastThoughtTest(): OllamaThoughtProbe };
    };
    return appWindow.ollama?.getLastThoughtTest();
  });

  expect(probe?.status).toBe("failed");
  expect(probe?.provider).toBe("mock-fallback");
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect((await getTransportState(page)).status).toBe("stopped");
});

test("manual Ollama thought probe keeps mock fallback for invalid model JSON", async ({ page }) => {
  await page.route("**/api/ollama/chat**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            id: "invalid-scale-degree-intent",
            responseLevel: "variation_intent",
            action: "vary_motif",
            confidence: 0.78,
            target: { startAfterBeats: 1, durationBeats: 1 },
            musicalIdea: {
              label: "bad degree but parseable",
              origin: "imagined",
              durationBeats: 1,
              steps: [{
                kind: "note",
                positionBeats: 0,
                durationBeats: 0.5,
                scaleDegree: 99,
                octave: 4,
                velocity: 0.55,
                tags: ["ollama", "invalid"],
              }],
              tags: ["ollama-intent"],
            },
            rationale: "This intentionally exceeds the tonal scale.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-send-thought").click();
  await expect(page.getByTestId("ollama-parse-result")).toHaveText("ok");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("invalid (1)");
  await expect(page.getByTestId("ollama-fallback-status")).toContainText("mock fallback valid");
  await expect(page.getByTestId("ollama-errors")).toContainText("scaleDegree must be within tonal scale");

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastThoughtTest(): OllamaThoughtProbe };
    };
    return appWindow.ollama?.getLastThoughtTest();
  });

  expect(probe?.status).toBe("invalid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.parse.status).toBe("ok");
  expect(probe?.validation.valid).toBe(false);
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect(probe?.intent?.musicalIdea.steps[0]?.pitch).toBeUndefined();
  expect((await getTransportState(page)).status).toBe("stopped");
});

test("manual Ollama proposal text probe rewrites text without changing proposal structure", async ({ page }) => {
  const proxyChatPayloads: Array<{
    baseUrl?: string;
    request?: {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
      stream?: boolean;
      format?: unknown;
      think?: boolean;
      options?: { temperature?: number; num_predict?: number };
    };
  }> = [];

  await page.route("**/api/ollama/chat**", async (route) => {
    proxyChatPayloads.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            summary: "Model answer: make the back half feel like an intentional cue.",
            requestedAction: "Model text: let Answer snap the bVII-V cue into focus.",
            responses: [
              {
                playerId: "pulse",
                reason: "Keep the floor steady so the cue lands without extra fill.",
              },
              {
                playerId: "bass",
                reason: "Name the roots plainly and let the motion speak.",
              },
              {
                playerId: "melody",
                reason: "Answer after the bass cue so the sparse turn feels chosen.",
                requestedChange: "Leave one clean breath before the answering phrase.",
              },
            ],
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("mock/");
  const beforeProposal = await getSongProposal(page);

  await page.getByTestId("ollama-send-proposal").click();
  await expect(page.getByTestId("ollama-proposal-text-status")).toContainText("model text valid");
  await expect(page.getByTestId("ollama-proposal-raw-response")).toContainText("Model answer");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("model/");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("snap the bVII-V cue");
  await expect(page.getByTestId("song-sketch-responses")).toContainText("Leave one clean breath");

  const afterProposal = await getSongProposal(page);
  expect(afterProposal.status).toBe("model");
  expect(afterProposal.id).toBe(beforeProposal.id);
  expect(afterProposal.kind).toBe(beforeProposal.kind);
  expect(afterProposal.targetSectionId).toBe(beforeProposal.targetSectionId);
  expect(afterProposal.proposedByPlayerId).toBe(beforeProposal.proposedByPlayerId);
  expect(afterProposal.chordPlan).toEqual(beforeProposal.chordPlan);
  expect(afterProposal.rootDegrees).toEqual(beforeProposal.rootDegrees);
  expect(afterProposal.responses.map((response) => response.playerId)).toEqual(
    beforeProposal.responses.map((response) => response.playerId),
  );
  expect(afterProposal.responses.map((response) => response.stance)).toEqual(
    beforeProposal.responses.map((response) => response.stance),
  );
  expect(afterProposal.responses.find((response) => response.playerId === "melody")?.reason).toContain(
    "sparse turn feels chosen",
  );

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastProposalTextTest(): OllamaProposalTextProbe };
    };
    return appWindow.ollama?.getLastProposalTextTest();
  });

  expect(probe?.status).toBe("valid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.promptProtocol).toBe("song-proposal-text");
  expect(probe?.proposalId).toBe(beforeProposal.id);
  expect(probe?.validation.valid).toBe(true);
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect((await getTransportState(page)).lookahead.pendingSlotCount).toBe(0);
  expect((await getTransportState(page)).status).toBe("stopped");

  expect(proxyChatPayloads).toHaveLength(1);
  const chatPayload = proxyChatPayloads[0].request ?? {};
  const formatText = JSON.stringify(chatPayload.format);
  const userMessage = chatPayload.messages?.find((message) => message.role === "user")?.content ?? "";
  expect(proxyChatPayloads[0].baseUrl).toBe("http://127.0.0.1:11434");
  expect(chatPayload.model).toBe("qwen3:4b-instruct-2507-q4_K_M");
  expect(chatPayload.stream).toBe(false);
  expect(chatPayload.think).toBe(false);
  expect(chatPayload.options?.num_predict).toBeLessThanOrEqual(384);
  expect(formatText).not.toContain('"kind"');
  expect(formatText).not.toContain('"stance"');
  expect(formatText).not.toContain('"chordPlan"');
  expect(formatText).not.toContain('"rootDegrees"');
  expect(formatText).toContain('"playerId"');
  expect(userMessage).toContain("Proposal projection:");
  expect(userMessage).toContain('"kind":"tighten_roots"');
  expect(userMessage).toContain('"chordPlan"');
  expect(userMessage).toContain("Do not return kind, status, role, stance");
});

test("manual Ollama proposal text probe keeps mock fallback for invalid model text", async ({ page }) => {
  await page.route("**/api/ollama/chat**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            summary: "Bad proposal text fixture",
            requestedAction: "This omits one player and duplicates another.",
            responses: [
              { playerId: "pulse", reason: "First pulse response." },
              { playerId: "pulse", reason: "Duplicate pulse response." },
            ],
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("mock/");
  const beforeProposal = await getSongProposal(page);
  await page.getByTestId("ollama-send-proposal").click();
  await expect(page.getByTestId("ollama-proposal-text-status")).toContainText("invalid");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("mock/");

  const afterProposal = await getSongProposal(page);
  expect(afterProposal.status).toBe("mock");
  expect(afterProposal.summary).toBe(beforeProposal.summary);
  expect(afterProposal.requestedAction).toBe(beforeProposal.requestedAction);

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastProposalTextTest(): OllamaProposalTextProbe };
    };
    return appWindow.ollama?.getLastProposalTextTest();
  });

  expect(probe?.status).toBe("invalid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.validation.valid).toBe(false);
  expect(probe?.validation.errors.join(" | ")).toContain("duplicate playerId pulse");
  expect(probe?.validation.errors.join(" | ")).toContain("missing playerId bass");
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect((await getTransportState(page)).status).toBe("stopped");
});

test("slow thinking loop asks melody once and compiles a bounded rest", async ({ page }) => {
  let chatRequestCount = 0;

  await page.route("**/api/ollama/tags**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({ models: [{ name: "qwen3:4b-instruct-2507-q4_K_M" }] }),
    });
  });

  await page.route("**/api/ollama/chat**", async (route) => {
    chatRequestCount += 1;
    const payload = JSON.parse(route.request().postData() ?? "{}") as {
      request?: { messages?: Array<{ role?: string; content?: string }> };
    };
    const userMessage = payload.request?.messages?.find((message) => message.role === "user")?.content ?? "";
    const requestedPlayer = userMessage.includes('"player":"bass"') ? "bass" : "melody";
    expect(userMessage).toContain(`"player":"${requestedPlayer}"`);
    expect(userMessage).toContain('"rest"');
    expect(userMessage).toContain('"simplify"');
    expect(userMessage).toContain('"change_density"');
    expect(userMessage).not.toContain('"vary_motif"');
    if (requestedPlayer === "melody") {
      expect(userMessage).toContain('"shift_register"');
    } else {
      expect(userMessage).not.toContain('"shift_register"');
    }
    const content = requestedPlayer === "melody"
      ? {
        id: "slow-loop-melody-intent",
        responseLevel: "play_intent",
        action: "rest",
        confidence: 0.74,
        target: { startAfterBeats: 2, durationBeats: 2 },
        musicalIdea: {
          label: "slow loop rest",
          origin: "imagined",
          durationBeats: 2,
          steps: [{
            kind: "rest",
            positionBeats: 0,
            durationBeats: 2,
            tags: ["slow-loop"],
          }],
          tags: ["slow-loop-intent"],
        },
        rationale: "Take a short breath so the bass can show the floor.",
      }
      : {
        id: "slow-loop-bass-intent",
        responseLevel: "play_intent",
        action: "change_density",
        confidence: 0.68,
        target: { startAfterBeats: 2, durationBeats: 2 },
        musicalIdea: {
          label: "slow loop bass thin",
          origin: "imagined",
          durationBeats: 2,
          steps: [{
            kind: "rest",
            positionBeats: 0,
            durationBeats: 1,
            tags: ["slow-loop"],
          }],
          tags: ["slow-loop-intent"],
        },
        rationale: "Leave a little room around the root.",
      };
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify(content),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-health-check").click();
  await expect(page.getByTestId("ollama-health-status")).toContainText("ready");

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");

  await expect.poll(async () => (await getSlowThinkingLoop(page)).status).toBe("accepted");
  const slowLoop = await getSlowThinkingLoop(page);
  expect(chatRequestCount).toBeGreaterThanOrEqual(1);
  expect(slowLoop.playerId).toBe("melody");
  expect(slowLoop.provider).toBe("ollama");
  expect(slowLoop.action).toBe("rest");
  expect(slowLoop.validation?.valid).toBe(true);
  expect(slowLoop.fallbackValid).toBe(true);
  expect(slowLoop.committedStartBeat).toBeGreaterThan(slowLoop.startedAtBeat ?? 0);
  await expect(page.getByTestId("thought-slow-melody-status")).toContainText("accepted rest");
  await expect.poll(async () => (await getSlowThinkingPlayback(page))?.mode).toBe("rest");
  const playback = await getSlowThinkingPlayback(page);
  expect(playback?.playerId).toBe("melody");
  expect(playback?.startBeat).toBeGreaterThanOrEqual(slowLoop.committedStartBeat ?? 0);
  expect(playback?.endBeat).toBeGreaterThan(playback?.startBeat ?? 0);
  await expect(page.getByTestId("thought-slow-melody-status")).toContainText("rest");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) =>
      event.playerId === "melody" &&
      event.kind === "rest" &&
      event.absoluteBeat >= (playback?.startBeat ?? Infinity) &&
      event.absoluteBeat < (playback?.endBeat ?? -Infinity)
    );
  }, { timeout: 10_000 }).toBe(true);
  expect((await getTransportState(page)).status).toBe("playing");

  await button.click();
  await expect(button).toHaveText("Start");
});

test("slow thinking loop compiles a bounded register shift for existing melody notes", async ({ page }) => {
  let chatRequestCount = 0;

  await page.route("**/api/ollama/tags**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({ models: [{ name: "qwen3:4b-instruct-2507-q4_K_M" }] }),
    });
  });

  await page.route("**/api/ollama/chat**", async (route) => {
    chatRequestCount += 1;
    const payload = JSON.parse(route.request().postData() ?? "{}") as {
      request?: { messages?: Array<{ role?: string; content?: string }> };
    };
    const userMessage = payload.request?.messages?.find((message) => message.role === "user")?.content ?? "";
    const requestedPlayer = userMessage.includes('"player":"bass"') ? "bass" : "melody";
    expect(userMessage).toContain(`"player":"${requestedPlayer}"`);
    if (requestedPlayer === "melody") {
      expect(userMessage).toContain('"shift_register"');
    } else {
      expect(userMessage).not.toContain('"shift_register"');
    }
    const content = requestedPlayer === "melody"
      ? {
        id: "slow-loop-register-intent",
        responseLevel: "variation_intent",
        action: "shift_register",
        registerDelta: 1,
        confidence: 0.76,
        target: { startAfterBeats: 2, durationBeats: 2 },
        musicalIdea: {
          label: "slow loop register lift",
          origin: "imagined",
          durationBeats: 2,
          steps: [{
            kind: "note",
            positionBeats: 0,
            durationBeats: 0.5,
            scaleDegree: 2,
            octave: 5,
            velocity: 0.52,
            tags: ["slow-loop", "register-up"],
          }],
          tags: ["slow-loop-intent", "register"],
        },
        rationale: "Lift the melody above the bass for a short answer.",
      }
      : {
        id: "slow-loop-bass-intent",
        responseLevel: "play_intent",
        action: "change_density",
        confidence: 0.68,
        target: { startAfterBeats: 2, durationBeats: 2 },
        musicalIdea: {
          label: "slow loop bass thin",
          origin: "imagined",
          durationBeats: 2,
          steps: [{
            kind: "rest",
            positionBeats: 0,
            durationBeats: 1,
            tags: ["slow-loop"],
          }],
          tags: ["slow-loop-intent"],
        },
        rationale: "Leave a little room around the root.",
      };
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify(content),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-health-check").click();
  await expect(page.getByTestId("ollama-health-status")).toContainText("ready");

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");

  await expect.poll(async () => (await getSlowThinkingLoop(page)).status).toBe("accepted");
  const slowLoop = await getSlowThinkingLoop(page);
  expect(chatRequestCount).toBeGreaterThanOrEqual(1);
  expect(slowLoop.playerId).toBe("melody");
  expect(slowLoop.provider).toBe("ollama");
  expect(slowLoop.action).toBe("shift_register");
  expect(slowLoop.validation?.valid).toBe(true);
  expect(slowLoop.fallbackValid).toBe(true);
  await expect.poll(async () => (await getSlowThinkingPlayback(page))?.mode).toBe("shift-register");
  const playback = await getSlowThinkingPlayback(page);
  expect(playback?.playerId).toBe("melody");
  expect(playback?.registerShift).toBe(1);
  expect(playback?.startBeat).toBeGreaterThanOrEqual(slowLoop.committedStartBeat ?? 0);
  await expect(page.getByTestId("thought-slow-melody-status")).toContainText("shift +1");
  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) =>
      event.playerId === "melody" &&
      event.kind === "note" &&
      event.pitch?.endsWith("5") &&
      event.absoluteBeat >= (playback?.startBeat ?? Infinity) &&
      event.absoluteBeat < (playback?.endBeat ?? -Infinity) &&
      event.tags.includes("thought:shift_register") &&
      event.tags.includes("register:+1")
    );
  }, { timeout: 10_000 }).toBe(true);
  const shiftedFrame = await getListeningFrame(page);
  const shiftedEvent = shiftedFrame.recentEvents.find((event) =>
    event.playerId === "melody" &&
    event.kind === "note" &&
    event.absoluteBeat >= (playback?.startBeat ?? Infinity) &&
    event.absoluteBeat < (playback?.endBeat ?? -Infinity) &&
    event.tags.includes("thought:shift_register")
  );
  expect(shiftedEvent?.gridPitch?.endsWith("4")).toBe(true);
  expect(shiftedEvent?.performedPitch?.endsWith("5")).toBe(true);
  expect(shiftedEvent?.pitch).toBe(shiftedEvent?.performedPitch);
  expect((await getTransportState(page)).status).toBe("playing");

  await button.click();
  await expect(button).toHaveText("Start");
});

test("slow thinking loops keep independent melody and bass playback windows", async ({ page }) => {
  const requestedPlayers: string[] = [];

  await page.route("**/api/ollama/tags**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({ models: [{ name: "qwen3:4b-instruct-2507-q4_K_M" }] }),
    });
  });

  await page.route("**/api/ollama/chat**", async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}") as {
      request?: {
        format?: unknown;
        messages?: Array<{ role?: string; content?: string }>;
      };
    };
    const systemMessage = payload.request?.messages?.find((message) => message.role === "system")?.content ?? "";
    const userMessage = payload.request?.messages?.find((message) => message.role === "user")?.content ?? "";
    const playerId = userMessage.includes('"player":"bass"') ? "bass" : "melody";
    requestedPlayers.push(playerId);
    if (playerId === "bass") {
      expect(userMessage).toContain('"allowedActions":["rest","simplify","change_density"]');
      expect(systemMessage).not.toContain("registerDelta");
      expect(userMessage).not.toContain("registerDelta");
      expect(JSON.stringify(payload.request?.format)).not.toContain("registerDelta");
      expect(JSON.stringify(payload.request?.format)).not.toContain("shift_register");
    } else {
      expect(systemMessage).toContain("top-level registerDelta");
      expect(userMessage).toContain("top-level registerDelta");
    }

    const isBass = playerId === "bass";
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-grow-ollama-proxy": "smoke",
      },
      body: JSON.stringify({
        model: "qwen3:4b-instruct-2507-q4_K_M",
        message: {
          role: "assistant",
          content: JSON.stringify({
            id: `slow-loop-${playerId}-intent`,
            responseLevel: "play_intent",
            action: isBass ? "change_density" : "rest",
            confidence: isBass ? 0.68 : 0.72,
            target: { startAfterBeats: isBass ? 4 : 8, durationBeats: 4 },
            musicalIdea: {
              label: isBass ? "bass anchored thinning" : "melody long breath",
              origin: "imagined",
              durationBeats: 4,
              steps: [{
                kind: "rest",
                positionBeats: 0,
                durationBeats: 1,
                tags: ["slow-loop", playerId],
              }],
              tags: ["slow-loop-intent", playerId],
            },
            rationale: isBass
              ? "Leave the floor on the downbeats and thin the turning notes."
              : "Hold a longer breath so the bass can answer.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-health-check").click();
  await expect(page.getByTestId("ollama-health-status")).toContainText("ready");

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");

  await expect.poll(async () => (await getSlowThinkingLoopForPlayer(page, "melody")).status).toBe("accepted");
  await expect.poll(async () => (await getSlowThinkingLoopForPlayer(page, "bass")).status, {
    timeout: 12_000,
  }).toBe("accepted");

  expect(requestedPlayers.slice(0, 2)).toEqual(["melody", "bass"]);
  const loops = await getSlowThinkingLoops(page);
  expect(loops.map((loop) => loop.playerId).sort()).toEqual(["bass", "melody"]);
  expect(loops.every((loop) => loop.validation?.valid)).toBe(true);

  const melodyPlayback = await getSlowThinkingPlayback(page, "melody");
  const bassPlayback = await getSlowThinkingPlayback(page, "bass");
  expect(melodyPlayback?.mode).toBe("rest");
  expect(bassPlayback?.mode).toBe("thin");
  const playbacks = await getSlowThinkingPlaybacks(page);
  expect(playbacks.map((playback) => playback.playerId).sort()).toEqual(["bass", "melody"]);
  expect(playbacks.find((playback) => playback.playerId === "melody")?.id).toBe(melodyPlayback?.id);
  expect(playbacks.find((playback) => playback.playerId === "bass")?.id).toBe(bassPlayback?.id);

  await expect(page.getByTestId("thought-slow-melody-status")).toContainText("rest");
  await expect(page.getByTestId("thought-slow-bass-status")).toContainText("thin");

  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) =>
      event.playerId === "melody" &&
      event.kind === "rest" &&
      event.absoluteBeat >= (melodyPlayback?.startBeat ?? Infinity) &&
      event.absoluteBeat < (melodyPlayback?.endBeat ?? -Infinity) &&
      event.tags.includes("thought:rest")
    );
  }, { timeout: 12_000 }).toBe(true);

  await expect.poll(async () => {
    const frame = await getListeningFrame(page);
    return frame.recentEvents.some((event) =>
      event.playerId === "bass" &&
      event.kind === "rest" &&
      event.absoluteBeat >= (bassPlayback?.startBeat ?? Infinity) &&
      event.absoluteBeat < (bassPlayback?.endBeat ?? -Infinity) &&
      event.tags.includes("thought:change_density")
    );
  }, { timeout: 12_000 }).toBe(true);

  await button.click();
  await expect(button).toHaveText("Start");
});

test("local Ollama proxy rejects non-local targets", async ({ request }) => {
  const response = await request.get("/api/ollama/tags?baseUrl=http://example.com:11434");

  expect(response.status()).toBe(400);
  expect(response.headers()["x-grow-ollama-proxy"]).toBe("vite-dev");
  const payload = await response.json() as { error?: string };
  expect(payload.error).toBe("Ollama proxy only supports localhost targets");
});

test("persistence records low-frequency decisions off the audio path", async ({ page, request }) => {
  await page.goto("/");
  await flushPersistence(page);
  await expect.poll(async () => (await getPersistenceState(page)).appendedCount).toBeGreaterThanOrEqual(1);

  await setSessionMode(page, "break");
  await page.evaluate(() => {
    const appWindow = window as unknown as {
      song?: { setId(nextSongId: string): string };
      timing?: { setMode(mode: string): string };
    };
    appWindow.song?.setId("glass");
    appWindow.timing?.setMode("grid");
  });
  await flushPersistence(page);

  const persistenceState = await getPersistenceState(page);
  expect(persistenceState.status).toBe("idle");
  expect(persistenceState.pendingCount).toBe(0);
  expect(persistenceState.appendedCount).toBeGreaterThanOrEqual(4);
  expect(persistenceState.retryAttempt).toBe(0);
  expect(persistenceState.lastError).toBeUndefined();
  await expect(page.getByTestId("persistence-status")).toContainText("idle");

  const statusResponse = await request.get("/api/persistence/status");
  expect(statusResponse.status()).toBe(200);
  expect(statusResponse.headers()["x-grow-persistence"]).toBe("vite-dev");

  const dump = await dumpPersistence(page, 200);
  const sessionEvents = dump.events
    .filter((event) => event.sessionId === persistenceState.sessionId)
    .sort((left, right) => left.seq - right.seq);
  expect(sessionEvents.map((event) => event.type)).toEqual([
    "session.started",
    "session.mode_changed",
    "song.changed",
    "timing.feel_changed",
  ]);
  expect(sessionEvents.every((event) => event.beat !== null)).toBe(true);
  expect(sessionEvents[0].payload).toMatchObject({
    source: "browser:init",
    sessionMode: "rehearsal",
    songId: "lantern",
    timingFeelMode: "feel",
  });
  expect(sessionEvents[1].payload).toMatchObject({
    fromMode: "rehearsal",
    toMode: "break",
  });
  expect(sessionEvents[2].payload).toMatchObject({
    fromSongId: "lantern",
    toSongId: "glass",
    clearedLedger: true,
  });
  expect(sessionEvents[3].payload).toMatchObject({
    fromFeel: "feel",
    toFeel: "grid",
    refreshedLookahead: true,
  });

  await setSessionMode(page, "rehearsal");
  await flushPersistenceOnPageHide(page);
  const pagehideState = await getPersistenceState(page);
  expect(pagehideState.lastPagehideFlushAt).toBeTruthy();
  expect(pagehideState.pendingCount).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("persistence-status")).toContainText("flushing");
});

test("candidate store writes queries scores retains and caps audited phrase candidates", async ({ request }) => {
  const sessionId = `candidate-store-${Date.now().toString(36)}`;
  const branchId = `${sessionId}-branch`;
  const session = {
    id: sessionId,
    name: "Candidate store smoke",
    branchId,
    metadata: { byte: "A1" },
  };
  const phraseGenome = SONG_MATERIALS[0].patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "melody")
  );
  if (!phraseGenome) {
    throw new Error("Expected a melody phrase genome fixture");
  }

  const writeResponse = await request.post("/api/persistence/candidates/write", {
    data: {
      session,
      candidate: {
        id: `${sessionId}-alpha`,
        kind: "phrase",
        genome: phraseGenome,
        generation: 0,
        seed: 101,
        status: "alive",
        createdAtBeat: 12,
      },
    },
  });
  expect(writeResponse.status()).toBe(200);
  expect(writeResponse.headers()["x-grow-persistence"]).toBe("vite-dev");
  const written = await writeResponse.json() as { candidate: StoredCandidate };
  const alphaId = written.candidate.id;
  expect(written.candidate).toMatchObject({
    id: scopeCandidateInputForBranch({
      id: `${sessionId}-alpha`,
      kind: "phrase",
      genome: phraseGenome,
    }, branchId).id,
    kind: "phrase",
    status: "alive",
    createdAtBeat: 12,
  });

  const scoreResponse = await request.post("/api/persistence/candidates/score", {
    data: {
      session,
      candidateId: written.candidate.id,
      scores: { prosody: 1.2, coherence: 0.64 },
      fitness: 0.88,
    },
  });
  expect(scoreResponse.status()).toBe(200);
  const scored = await scoreResponse.json() as { candidate: StoredCandidate };
  expect(scored.candidate.scores.prosody).toBe(1);
  expect(scored.candidate.fitness).toBe(0.88);

  const retainResponse = await request.post("/api/persistence/candidates/retain", {
    data: {
      session,
      candidateIds: [written.candidate.id],
    },
  });
  expect(retainResponse.status()).toBe(200);
  const retained = await retainResponse.json() as { candidates: StoredCandidate[] };
  expect(retained.candidates[0].status).toBe("elite");

  const writeLowerResponse = await request.post("/api/persistence/candidates/write", {
    data: {
      session,
      candidate: {
        id: `${sessionId}-beta`,
        kind: "phrase",
        genome: phraseGenome,
        scores: { prosody: 0.1 },
        fitness: 0.1,
        generation: 0,
        seed: 102,
        status: "alive",
      },
    },
  });
  expect(writeLowerResponse.status()).toBe(200);
  const writtenLower = await writeLowerResponse.json() as { candidate: StoredCandidate };
  const betaId = writtenLower.candidate.id;

  const capResponse = await request.post("/api/persistence/candidates/cap", {
    data: {
      session,
      kind: "phrase",
      limit: 1,
    },
  });
  expect(capResponse.status()).toBe(200);
  const capped = await capResponse.json() as { kept: StoredCandidate[]; purged: StoredCandidate[] };
  expect(capped.kept.map((candidate) => candidate.id)).toEqual([alphaId]);
  expect(capped.purged.map((candidate) => candidate.id)).toEqual([betaId]);
  expect(capped.purged[0].status).toBe("purged");

  const listResponse = await request.get(`/api/persistence/candidates?kind=phrase&branchId=${branchId}&limit=10`);
  expect(listResponse.status()).toBe(200);
  const listed = await listResponse.json() as { candidates: StoredCandidate[] };
  expect(listed.candidates.some((candidate) => candidate.id === alphaId)).toBe(true);
  expect(listed.candidates.some((candidate) => candidate.id === betaId)).toBe(true);

  const dumpResponse = await request.get("/api/persistence/dump?limit=500");
  expect(dumpResponse.status()).toBe(200);
  const dump = await dumpResponse.json() as PersistenceDump;
  const auditTypes = dump.events
    .filter((event) => event.sessionId === sessionId && event.type.startsWith("candidate."))
    .sort((left, right) => left.seq - right.seq)
    .map((event) => event.type);
  expect(auditTypes).toEqual([
    "candidate.created",
    "candidate.scored",
    "candidate.retained",
    "candidate.created",
    "candidate.purged",
  ]);
  expect(dump.candidates.find((candidate) => candidate.id === alphaId)?.status).toBe("elite");
  expect(dump.candidates.find((candidate) => candidate.id === betaId)?.status).toBe("purged");
});

test("candidate selection promotes top candidates per kind and purges overflow", async ({ request }) => {
  const sessionId = `candidate-selection-${Date.now().toString(36)}`;
  const branchId = `${sessionId}-branch`;
  const session = {
    id: sessionId,
    name: "Candidate selection smoke",
    branchId,
    metadata: { byte: "A3" },
  };
  const phraseGenome = SONG_MATERIALS[0].patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "melody")
  );
  if (!phraseGenome) {
    throw new Error("Expected a melody phrase genome fixture");
  }
  const scopedId = (suffix: string) => scopeCandidateInputForBranch({
    id: `${sessionId}-${suffix}`,
    kind: "phrase",
    genome: phraseGenome,
  }, branchId).id ?? "";
  const writeCandidate = async (
    suffix: string,
    fitness: number,
    generation: number,
    status: "alive" | "elite" = "alive",
  ) => {
    const response = await request.post("/api/persistence/candidates/write", {
      data: {
        session,
        candidate: {
          id: `${sessionId}-${suffix}`,
          kind: "phrase",
          genome: phraseGenome,
          scores: { landing: fitness, cadence: fitness },
          fitness,
          generation,
          seed: 200 + generation,
          status,
        },
      },
    });
    expect(response.status()).toBe(200);
  };

  await writeCandidate("best-young", 0.9, 0);
  await writeCandidate("best-older", 0.9, 2);
  await writeCandidate("middle", 0.7, 0);
  await writeCandidate("stale-elite", 0.4, 0, "elite");

  const selectResponse = await request.post("/api/persistence/candidates/select", {
    data: {
      session,
      kind: "phrase",
      eliteLimit: 2,
    },
  });
  expect(selectResponse.status()).toBe(200);
  const selection = await selectResponse.json() as CandidateSelectionResult;
  expect(selection).toMatchObject({
    kind: "phrase",
    branchId,
    eliteLimit: 2,
    evaluatedCount: 4,
  });
  expect(selection.elite.map((candidate) => candidate.id)).toEqual([
    scopedId("best-young"),
    scopedId("best-older"),
  ]);
  expect(selection.elite.every((candidate) => candidate.status === "elite")).toBe(true);
  expect(selection.purged.map((candidate) => candidate.id)).toEqual([
    scopedId("middle"),
    scopedId("stale-elite"),
  ]);
  expect(selection.purged.every((candidate) => candidate.status === "purged")).toBe(true);

  const listResponse = await request.get(`/api/persistence/candidates?kind=phrase&branchId=${branchId}&limit=10`);
  expect(listResponse.status()).toBe(200);
  const listed = await listResponse.json() as { candidates: StoredCandidate[] };
  const statusById = Object.fromEntries(
    listed.candidates.map((candidate) => [candidate.id, candidate.status]),
  );
  expect(statusById[scopedId("best-young")]).toBe("elite");
  expect(statusById[scopedId("best-older")]).toBe("elite");
  expect(statusById[scopedId("middle")]).toBe("purged");
  expect(statusById[scopedId("stale-elite")]).toBe("purged");

  const dumpResponse = await request.get("/api/persistence/dump?limit=800");
  expect(dumpResponse.status()).toBe(200);
  const dump = await dumpResponse.json() as PersistenceDump;
  const selectionEvents = dump.events
    .filter((event) => event.sessionId === sessionId && ["candidate.retained", "candidate.purged"].includes(event.type))
    .sort((left, right) => left.seq - right.seq);
  expect(selectionEvents.map((event) => event.type)).toEqual([
    "candidate.retained",
    "candidate.retained",
    "candidate.purged",
    "candidate.purged",
  ]);
  expect(selectionEvents.map((event) => event.payload.reason)).toEqual([
    "selection",
    "selection",
    "selection",
    "selection",
  ]);
  expect(selectionEvents.map((event) => event.payload.rank)).toEqual([1, 2, 3, 4]);
});

test("candidate development deep-clones elite phrase genomes into child candidates", async ({ request }) => {
  const sessionId = `candidate-development-${Date.now().toString(36)}`;
  const branchId = `${sessionId}-branch`;
  const session = {
    id: sessionId,
    name: "Candidate development smoke",
    branchId,
    metadata: { byte: "A4" },
  };
  const phraseGenome = SONG_MATERIALS[0].patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "melody")
  );
  if (!phraseGenome) {
    throw new Error("Expected a melody phrase genome fixture");
  }
  const parentId = `${sessionId}-elite-parent`;
  const writeResponse = await request.post("/api/persistence/candidates/write", {
    data: {
      session,
      candidate: {
        id: parentId,
        kind: "phrase",
        genome: phraseGenome,
        scores: { landing: 0.9 },
        fitness: 0.9,
        generation: 3,
        seed: 501,
        status: "elite",
        createdAtBeat: 48,
      },
    },
  });
  expect(writeResponse.status()).toBe(200);
  const written = await writeResponse.json() as { candidate: StoredCandidate };
  const scopedParentId = written.candidate.id;
  const parentGenomeBefore = JSON.stringify(written.candidate.genome);

  const mutation = {
    type: "phrase.nudge" as const,
    scaleDegreeDelta: 2,
    velocityMultiplier: 1.25,
  };
  const developResponse = await request.post("/api/persistence/candidates/develop", {
    data: {
      session,
      parentId: scopedParentId,
      mutation,
      seed: 777,
    },
  });
  expect(developResponse.status()).toBe(200);
  const developed = await developResponse.json() as CandidateDevelopmentResult;
  expect(developed.parent.id).toBe(scopedParentId);
  expect(developed.child).toMatchObject({
    kind: "phrase",
    parentId: scopedParentId,
    generation: 4,
    seed: 777,
    status: "alive",
    fitness: 0,
    scores: {},
    createdAtBeat: 48,
  });
  expect(developed.child.id).not.toBe(parentId);
  expect(JSON.stringify(developed.child.genome)).not.toBe(parentGenomeBefore);
  expect(developed.mutation).toMatchObject(mutation);

  const childEvents = (developed.child.genome as PlayerPatternSource).events;
  const parentEvents = (written.candidate.genome as PlayerPatternSource).events;
  const firstChildNote = childEvents.find((event): event is NonNullable<typeof event> => event !== null);
  const firstParentNote = parentEvents.find((event): event is NonNullable<typeof event> => event !== null);
  expect(firstChildNote).toBeTruthy();
  expect(firstParentNote).toBeTruthy();
  expect(firstChildNote?.scaleDegree).toBe((firstParentNote?.scaleDegree ?? 0) + 2);
  expect(firstChildNote?.velocity).toBeGreaterThan(firstParentNote?.velocity ?? 0);

  const repeatDevelopResponse = await request.post("/api/persistence/candidates/develop", {
    data: {
      session,
      parentId: scopedParentId,
      mutation,
      seed: 777,
    },
  });
  expect(repeatDevelopResponse.status()).toBe(200);
  const repeated = await repeatDevelopResponse.json() as CandidateDevelopmentResult;
  expect(repeated.child.id).toBe(developed.child.id);

  const listResponse = await request.get(`/api/persistence/candidates?kind=phrase&branchId=${branchId}&limit=10`);
  expect(listResponse.status()).toBe(200);
  const listed = await listResponse.json() as { candidates: StoredCandidate[] };
  const listedParent = listed.candidates.find((candidate) => candidate.id === scopedParentId);
  const listedChild = listed.candidates.find((candidate) => candidate.id === developed.child.id);
  expect(JSON.stringify(listedParent?.genome)).toBe(parentGenomeBefore);
  expect(listedChild?.parentId).toBe(scopedParentId);

  const dumpResponse = await request.get("/api/persistence/dump?limit=800");
  expect(dumpResponse.status()).toBe(200);
  const dump = await dumpResponse.json() as PersistenceDump;
  const childCreatedEvents = dump.events.filter((event) =>
    event.sessionId === sessionId &&
    event.type === "candidate.created" &&
    event.payload.candidateId === developed.child.id
  );
  expect(childCreatedEvents).toHaveLength(1);
  expect(childCreatedEvents[0].payload).toMatchObject({
    reason: "development",
    parentId: scopedParentId,
    mutation,
  });

  const nonEliteWrite = await request.post("/api/persistence/candidates/write", {
    data: {
      session,
      candidate: {
        id: `${sessionId}-alive-parent`,
        kind: "phrase",
        genome: phraseGenome,
        generation: 0,
        seed: 502,
        status: "alive",
      },
    },
  });
  expect(nonEliteWrite.status()).toBe(200);
  const nonElite = await nonEliteWrite.json() as { candidate: StoredCandidate };
  const rejectedDevelop = await request.post("/api/persistence/candidates/develop", {
    data: {
      session,
      parentId: nonElite.candidate.id,
      mutation,
    },
  });
  expect(rejectedDevelop.status()).toBe(400);
});

test("candidate cycle produces scores selects elites develops children and stays idempotent", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const uniqueSeed = 1_000_000 + Math.trunc(Date.now() % 1_000_000);
  const branchId = `candidate-cycle-${uniqueSeed}`;
  const options = {
    seed: uniqueSeed,
    kind: "phrase" as const,
    count: 5,
    eliteLimit: 2,
    branchId,
  };

  const first = await runCandidateCycleInApp(page, options);
  expect(first).toMatchObject({
    kind: "phrase",
    branchId,
    seed: uniqueSeed,
    count: 5,
    eliteLimit: 2,
  });
  expect(first.produced).toHaveLength(5);
  expect(first.elite).toHaveLength(2);
  expect(first.purged).toHaveLength(3);
  expect(first.children).toHaveLength(2);

  const producedStatuses = first.produced.map((candidate) => candidate.status).sort();
  expect(producedStatuses).toEqual(["elite", "elite", "purged", "purged", "purged"]);
  const eliteIds = new Set(first.elite.map((candidate) => candidate.id));
  const purgedIds = new Set(first.purged.map((candidate) => candidate.id));
  for (const candidate of first.produced) {
    const aggregate = aggregateCandidateFitness(candidate.scores, { kind: "phrase" });
    const expectedFitness = aggregate.fitness;
    expect(candidate.fitness).toBeCloseTo(expectedFitness, 4);
    expect(aggregate.ignoredScoreKeys).toEqual([]);
    if (candidate.status === "elite") {
      expect(eliteIds.has(candidate.id)).toBe(true);
    }
    if (candidate.status === "purged") {
      expect(purgedIds.has(candidate.id)).toBe(true);
    }
  }
  expect(new Set(first.produced.map((candidate) => candidate.fitness)).size).toBeGreaterThan(1);
  expect(Math.min(...first.elite.map((candidate) => candidate.fitness))).toBeGreaterThanOrEqual(
    Math.max(...first.purged.map((candidate) => candidate.fitness)),
  );

  for (const child of first.children) {
    const parent = first.elite.find((candidate) => candidate.id === child.parentId);
    expect(parent).toBeTruthy();
    expect(child.status).toBe("alive");
    expect(child.generation).toBe((parent?.generation ?? 0) + 1);
    expect(child.fitness).toBeGreaterThan(0);
    expect(child.fitness).toBeCloseTo(aggregateCandidateFitness(child.scores, { kind: "phrase" }).fitness, 4);
    expect(Object.keys(child.scores).sort()).toEqual([
      "anacrusis",
      "anchorContrast",
      "questionAnswer",
      "richness",
    ]);
    expect(child.mutation.type).toBe("phrase.replace");
    if (child.mutation.type !== "phrase.replace") {
      throw new Error("Expected D1b child to use phrase.replace");
    }
    expect(child.mutation.operator.type).toEqual(expect.stringMatching(
      /^(reFoot|varyContour|alterCadence|shiftAnacrusis)$/,
    ));
  }

  const firstDump = await dumpPersistence(page, 2_000);
  for (const child of first.children) {
    const parent = firstDump.candidates.find((candidate) => candidate.id === child.parentId);
    const storedChild = firstDump.candidates.find((candidate) => candidate.id === child.id);
    expect(parent).toBeTruthy();
    expect(storedChild).toBeTruthy();
    expect(JSON.stringify(storedChild?.genome)).not.toBe(JSON.stringify(parent?.genome));
  }
  const firstEvents = firstDump.events.filter((event) =>
    event.branchId === branchId && event.type.startsWith("candidate.")
  );
  expect(firstEvents.filter((event) => event.type === "candidate.created")).toHaveLength(7);
  const scoredEventCandidateIds = firstEvents
    .filter((event) => event.type === "candidate.scored")
    .map((event) => event.payload.candidateId);
  expect(scoredEventCandidateIds).toEqual(expect.arrayContaining(
    first.children.map((child) => child.id),
  ));
  expect(firstEvents.filter((event) => event.type === "candidate.retained")).toHaveLength(2);
  expect(firstEvents.filter((event) => event.type === "candidate.purged")).toHaveLength(3);
  expect(firstEvents.filter((event) =>
    event.type === "candidate.created" && event.payload.reason === "development"
  )).toHaveLength(2);
  expect(firstEvents.filter((event) =>
    ["candidate.retained", "candidate.purged"].includes(event.type)
  ).map((event) => event.payload.reason)).toEqual([
    "selection",
    "selection",
    "selection",
    "selection",
    "selection",
  ]);

  const second = await runCandidateCycleInApp(page, options);
  expect(second).toEqual(first);
  const secondDump = await dumpPersistence(page, 2_000);
  const secondEvents = secondDump.events.filter((event) =>
    event.branchId === branchId && event.type.startsWith("candidate.")
  );
  expect(secondEvents.filter((event) => event.type === "candidate.created")).toHaveLength(7);
  expect(secondEvents.filter((event) => event.type === "candidate.retained")).toHaveLength(2);
  expect(secondEvents.filter((event) => event.type === "candidate.purged")).toHaveLength(3);
  const secondScoredCandidateIds = secondEvents
    .filter((event) => event.type === "candidate.scored")
    .map((event) => String(event.payload.candidateId));
  expect(secondScoredCandidateIds).toEqual(expect.arrayContaining(
    first.children.map((child) => child.id),
  ));
  expect(new Set(secondScoredCandidateIds).size).toBe(secondScoredCandidateIds.length);
  const secondMutationSignatures = secondEvents
    .filter((event) => event.type !== "candidate.scored")
    .map((event) => `${event.type}:${event.payload.candidateId}:${event.payload.reason ?? ""}`);
  expect(new Set(secondMutationSignatures).size).toBe(secondMutationSignatures.length);
});

test("candidate cycle skips no-op development without aborting selection", async () => {
  const result = await runCandidateCycle({
    seed: 8128,
    kind: "phrase",
    count: 3,
    eliteLimit: 1,
    branchId: "memory-no-op",
  }, createMemoryCyclePersistence({ noOpDevelopAttempts: 1 }));

  expect(result.elite).toHaveLength(1);
  expect(result.children).toHaveLength(0);
  expect(result.produced.some((candidate) => candidate.status === "elite")).toBe(true);
});

test("candidate evolution is deterministic against fresh stores", async () => {
  const options = {
    seed: 4242,
    kind: "phrase" as const,
    generations: 4,
    count: 5,
    eliteLimit: 2,
    branchId: "memory-evolution",
  };

  const first = await runEvolution(options, createMemoryCyclePersistence());
  const second = await runEvolution(options, createMemoryCyclePersistence());

  expect(first).toEqual(second);
  expect(first.summaries).toHaveLength(4);
  for (let index = 1; index < first.summaries.length; index += 1) {
    expect(first.summaries[index].topFitness).toBeGreaterThanOrEqual(
      first.summaries[index - 1].topFitness,
    );
  }
  expect(first.finalElite).toHaveLength(2);
});

test("candidate evolution scores children and keeps top fitness nondecreasing", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const uniqueSeed = 3_000_000 + Math.trunc(Date.now() % 1_000_000);
  const branchId = `candidate-evolution-${uniqueSeed}`;
  const result = await runEvolutionInApp(page, {
    seed: uniqueSeed,
    kind: "phrase",
    generations: 4,
    count: 5,
    eliteLimit: 2,
    branchId,
  });

  expect(result).toMatchObject({
    kind: "phrase",
    branchId,
    seed: uniqueSeed,
    generations: 4,
    count: 5,
    eliteLimit: 2,
  });
  expect(result.summaries).toHaveLength(4);
  expect(result.finalElite).toHaveLength(2);

  for (let index = 1; index < result.summaries.length; index += 1) {
    expect(result.summaries[index].topFitness).toBeGreaterThanOrEqual(
      result.summaries[index - 1].topFitness,
    );
  }
  for (const summary of result.summaries) {
    expect(summary.topFitness).toBeGreaterThan(0);
    expect(summary.meanEliteFitness).toBeGreaterThan(0);
    expect(summary.eliteCount).toBe(2);
    expect(summary.populationSize).toBeGreaterThanOrEqual(2);
  }

  const candidates = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const children = candidates.filter((candidate) => Boolean(candidate.parentId));
  expect(children.length).toBeGreaterThan(0);
  for (const child of children) {
    expect(child.fitness).toBeGreaterThan(0);
    expect(child.fitness).toBeCloseTo(aggregateCandidateFitness(child.scores, { kind: "phrase" }).fitness, 4);
    expect(Object.keys(child.scores).sort()).toEqual([
      "anacrusis",
      "anchorContrast",
      "questionAnswer",
      "richness",
    ]);
  }
});

test("candidate ids are branch-scoped across same-seed evolution runs", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const seed = 4242;
  const stamp = Date.now().toString(36);
  const branchA = `candidate-scope-a-${stamp}`;
  const branchB = `candidate-scope-b-${stamp}`;
  const options = {
    seed,
    kind: "phrase" as const,
    generations: 3,
    count: 5,
    eliteLimit: 2,
  };

  const firstA = await runEvolutionInApp(page, { ...options, branchId: branchA });
  const firstB = await runEvolutionInApp(page, { ...options, branchId: branchB });
  expect(firstA.summaries).toHaveLength(3);
  expect(firstB.summaries).toHaveLength(3);
  expect(firstA.finalElite).toHaveLength(2);
  expect(firstB.finalElite).toHaveLength(2);

  const candidatesA = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId: branchA,
    limit: 500,
  });
  const candidatesB = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId: branchB,
    limit: 500,
  });
  expect(candidatesA.length).toBeGreaterThan(0);
  expect(candidatesB.length).toBeGreaterThan(0);
  const candidateIdsA = new Set(candidatesA.map((candidate) => candidate.id));
  const candidateIdsB = new Set(candidatesB.map((candidate) => candidate.id));
  expect([...candidateIdsA].filter((candidateId) => candidateIdsB.has(candidateId))).toEqual([]);
  expect(candidatesA.every((candidate) => candidate.branchId === branchA)).toBe(true);
  expect(candidatesB.every((candidate) => candidate.branchId === branchB)).toBe(true);
  expect(candidatesA.some((candidate) =>
    Boolean(candidate.parentId) && candidateIdsA.has(candidate.parentId ?? "")
  )).toBe(true);
  expect(candidatesB.some((candidate) =>
    Boolean(candidate.parentId) && candidateIdsB.has(candidate.parentId ?? "")
  )).toBe(true);

  const beforeRepeatDump = await dumpPersistence(page, 5_000);
  const beforeRepeatEvents = beforeRepeatDump.events.filter((event) =>
    event.branchId === branchA && event.type.startsWith("candidate.")
  );
  await runEvolutionInApp(page, { ...options, branchId: branchA });
  const afterRepeatDump = await dumpPersistence(page, 5_000);
  const afterRepeatEvents = afterRepeatDump.events.filter((event) =>
    event.branchId === branchA && event.type.startsWith("candidate.")
  );
  expect(afterRepeatEvents).toHaveLength(beforeRepeatEvents.length);
});

test("matched diversity experiments can run same seed in one store", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const seed = 515151;
  const stamp = Date.now().toString(36);
  const offBranch = `candidate-ab-off-${stamp}`;
  const onBranch = `candidate-ab-on-${stamp}`;
  const baseOptions = {
    seed,
    kind: "phrase" as const,
    generations: 4,
    count: 5,
    eliteLimit: 3,
  };
  const diversity = {
    enabled: true,
    fitnessEliteLimit: 1,
    minDistance: 0.12,
    reservoirLimit: 2,
    reservoirParentFraction: 0.5,
    interestingnessThreshold: 0.35,
  };

  const strict = await runEvolutionInApp(page, { ...baseOptions, branchId: offBranch });
  const diverse = await runEvolutionInApp(page, { ...baseOptions, branchId: onBranch, diversity });

  expect(strict.branchId).toBe(offBranch);
  expect(diverse.branchId).toBe(onBranch);
  expect(strict.diversity).toBeUndefined();
  expect(diverse.diversity).toMatchObject(diversity);
  expect(strict.summaries).toHaveLength(4);
  expect(diverse.summaries).toHaveLength(4);
  expect(strict.finalElite).toHaveLength(3);
  expect(diverse.finalElite).toHaveLength(3);
  expect(diverse.summaries.every((summary) => summary.eliteMeanDistance !== undefined)).toBe(true);

  const strictCandidates = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId: offBranch,
    limit: 500,
  });
  const diverseCandidates = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId: onBranch,
    limit: 500,
  });
  const strictIds = new Set(strictCandidates.map((candidate) => candidate.id));
  const diverseIds = new Set(diverseCandidates.map((candidate) => candidate.id));
  expect([...strictIds].filter((candidateId) => diverseIds.has(candidateId))).toEqual([]);
  expect(strictCandidates.some((candidate) => candidate.status === "elite")).toBe(true);
  expect(diverseCandidates.some((candidate) => candidate.status === "elite")).toBe(true);
});

test("candidate evolution stays D3-identical when diversity is disabled", async () => {
  const options = {
    seed: 4242,
    kind: "phrase" as const,
    generations: 4,
    count: 5,
    eliteLimit: 2,
    branchId: "memory-evolution-default-off",
  };

  const baseline = await runEvolution(options, createMemoryCyclePersistence());
  const disabled = await runEvolution({
    ...options,
    diversity: {
      enabled: false,
      fitnessEliteLimit: 1,
      minDistance: 0.9,
      reservoirLimit: 4,
      reservoirParentFraction: 1,
      interestingnessThreshold: 0,
    },
  }, createMemoryCyclePersistence());

  expect(disabled).toEqual(baseline);
});

test("candidate evolution can preserve a diverse elite and breed a latent reservoir", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const diversity = {
    enabled: true,
    fitnessEliteLimit: 1,
    minDistance: 0.12,
    reservoirLimit: 2,
    reservoirParentFraction: 0.5,
    interestingnessThreshold: 0.35,
  };
  const candidateSeeds = [515151, 606060, 707070, 9091];
  let branchId = "";
  let result: CandidateEvolutionResult | undefined;
  for (const seed of candidateSeeds) {
    branchId = `candidate-diversity-${seed}-${Date.now().toString(36)}`;
    const candidateResult = await runEvolutionInApp(page, {
      seed,
      kind: "phrase",
      generations: 5,
      count: 5,
      eliteLimit: 3,
      branchId,
      diversity,
    });
    if (
      candidateResult.summaries.some((summary) => (summary.reservedCount ?? 0) > 0) &&
      candidateResult.summaries.some((summary) => (summary.reservedParentChildCount ?? 0) > 0)
    ) {
      result = candidateResult;
      break;
    }
  }

  if (!result) {
    throw new Error("Expected one D4 seed to create a reservoir");
  }

  expect(result.diversity).toMatchObject(diversity);
  expect(result.summaries).toHaveLength(5);
  for (let index = 1; index < result.summaries.length; index += 1) {
    expect(result.summaries[index].topFitness).toBeGreaterThanOrEqual(
      result.summaries[index - 1].topFitness,
    );
  }
  expect(result.summaries.some((summary) => (summary.reservedCount ?? 0) > 0)).toBe(true);
  expect(result.summaries.some((summary) => (summary.reservedParentChildCount ?? 0) > 0)).toBe(true);
  expect(result.summaries.slice(1).every((summary) =>
    (summary.eliteMeanDistance ?? 0) >= diversity.minDistance
  )).toBe(true);
  expect(result.finalReserved?.length).toBeGreaterThan(0);

  const candidates = await listCandidatesInApp(page, {
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const elite = candidates.filter((candidate) => candidate.status === "elite");
  const reserved = candidates.filter((candidate) => candidate.status === "reserved");
  expect(elite).toHaveLength(3);
  expect(reserved.length).toBeGreaterThan(0);
  expect(calculateMeanPairwiseProsodyDistance(elite)).toBeGreaterThanOrEqual(diversity.minDistance);

  const eliteFloor = Math.min(...elite.map((candidate) => candidate.fitness));
  expect(reserved.some((candidate) =>
    candidate.fitness < eliteFloor &&
    calculateCandidateDiversityMetrics(candidate, elite).interestingness >= diversity.interestingnessThreshold
  )).toBe(true);

  const reservedParentIds = new Set(reserved.map((candidate) => candidate.id));
  expect(candidates.some((candidate) =>
    Boolean(candidate.parentId) && reservedParentIds.has(candidate.parentId ?? "")
  )).toBe(true);
});

test("elite phrase candidates can be auditioned as the active melody phrasing", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const uniqueSeed = 2_000_000 + Math.trunc(Date.now() % 1_000_000);
  const branchId = `candidate-audition-${uniqueSeed}`;
  const cycle = await runCandidateCycleInApp(page, {
    seed: uniqueSeed,
    kind: "phrase",
    count: 5,
    eliteLimit: 2,
    branchId,
  });

  const audition = await auditionEliteCandidateInApp(page, { branchId });
  expect(audition.enabled).toBe(true);
  expect(audition.branchId).toBe(branchId);
  expect(audition.candidateId).toBe(cycle.elite[0].id);

  const eliteCandidates = await listCandidatesInApp(page, {
    kind: "phrase",
    status: "elite",
    branchId,
    limit: 5,
  });
  const selected = eliteCandidates.find((candidate) => candidate.id === audition.candidateId);
  expect(selected).toBeTruthy();

  const activePattern = await getActiveProsodyPattern(page);
  expect(activePattern).toEqual(selected?.genome);
  expect(audition.pattern).toEqual(selected?.genome);

  const button = page.getByTestId("transport-toggle");
  await button.click();
  await expect(button).toHaveText("Stop");
  await expect.poll(async () => page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: {
        getEvents(): Array<{ playerId: string; kind: string }>;
      };
    };
    return appWindow.listening?.getEvents()
      .filter((event) => event.playerId === "melody" && event.kind === "note").length ?? 0;
  }), { timeout: 8_000 }).toBeGreaterThan(0);

  await button.click();
  await expect(button).toHaveText("Start");

  const cleared = await page.evaluate(() => {
    const appWindow = window as unknown as {
      prosody?: {
        clearCandidateAudition(): CandidateMelodyAuditionState;
        getPattern(): PlayerPatternSource | undefined;
      };
    };
    const state = appWindow.prosody?.clearCandidateAudition();
    return {
      state,
      pattern: appWindow.prosody?.getPattern(),
    };
  });
  expect(cleared.state?.enabled).toBe(false);
  expect(cleared.pattern).toBeUndefined();
});

test("persistence records musical events through an off-callback buffer", async ({ page }) => {
  await page.goto("/");
  await flushPersistenceUntilIdle(page);

  const button = page.getByTestId("transport-toggle");
  const playSpan = async () => {
    const before = await getMusicalEventBufferState(page);
    await button.click();
    await expect(button).toHaveText("Stop");

    await expect.poll(async () => (await getMusicalEventBufferState(page)).enqueuedCount, {
      timeout: 8_000,
    }).toBeGreaterThan(before.enqueuedCount + 6);
    await expect(page.getByTestId("musical-event-buffer-status")).toContainText("heard");

    await button.click();
    await expect(button).toHaveText("Start");
    const stoppedBufferState = await getMusicalEventBufferState(page);
    expect(stoppedBufferState.pendingCount).toBe(0);
    expect(stoppedBufferState.drainedCount).toBeGreaterThan(before.drainedCount);
    expect(stoppedBufferState.droppedCount).toBe(0);
    await flushPersistenceUntilIdle(page);
    return stoppedBufferState;
  };

  const firstSpanBufferState = await playSpan();
  const stoppedBufferState = await playSpan();
  expect(stoppedBufferState.drainedCount).toBeGreaterThan(firstSpanBufferState.drainedCount);
  const persistenceState = await getPersistenceState(page);
  const dump = await dumpPersistence(page, 1_000);
  const musicalEvents = dump.events
    .filter((event) =>
      event.sessionId === persistenceState.sessionId &&
      event.type === "musical.event_recorded"
    )
    .sort((left, right) => left.seq - right.seq);

  expect(musicalEvents.length).toBe(stoppedBufferState.drainedCount);
  expect(new Set(musicalEvents.map((event) => event.id)).size).toBe(musicalEvents.length);
  const idDetails = musicalEvents.map((event) => {
    const tail = event.id.replace(`musical-${persistenceState.sessionId}-span-`, "");
    const [spanSerial, sourceSerial] = tail.split("-event-").map(Number);
    return { spanSerial, sourceSerial };
  });
  expect(idDetails.every(({ spanSerial, sourceSerial }) =>
    Number.isFinite(spanSerial) && Number.isFinite(sourceSerial)
  )).toBe(true);
  expect([...new Set(idDetails.map(({ spanSerial }) => spanSerial))]).toEqual([1, 2]);
  for (const spanSerial of [1, 2]) {
    const sourceSerials = idDetails
      .filter((details) => details.spanSerial === spanSerial)
      .map((details) => details.sourceSerial);
    expect(sourceSerials.length).toBeGreaterThan(6);
    expect(sourceSerials).toEqual([...sourceSerials].sort((left, right) => left - right));
  }

  const firstMusicalPayload = musicalEvents[0].payload as {
    schemaVersion?: number;
    sourceEventId?: string;
    grid?: {
      absoluteBeat?: number;
      pitch?: string;
      pitchClass?: string;
      scaleDegree?: number;
    };
    performed?: {
      offsetBeats?: number;
      offsetSeconds?: number;
      sounded?: boolean;
      pitch?: string;
      pitchClass?: string;
    };
    expression?: { eventIndex?: number };
    performedTiming?: { eventIndex?: number; performedOffsetBeats?: number };
    tags?: string[];
  };
  expect(firstMusicalPayload.schemaVersion).toBe(1);
  expect(firstMusicalPayload.sourceEventId).toMatch(/^event-\d+$/);
  expect(firstMusicalPayload.grid?.absoluteBeat).toBeGreaterThanOrEqual(0);
  expect(firstMusicalPayload.grid?.pitch).toBeTruthy();
  expect(firstMusicalPayload.grid?.pitchClass).toBeTruthy();
  expect(firstMusicalPayload.grid?.scaleDegree).toBeGreaterThanOrEqual(0);
  expect(typeof firstMusicalPayload.performed?.offsetBeats).toBe("number");
  expect(typeof firstMusicalPayload.performed?.offsetSeconds).toBe("number");
  expect(firstMusicalPayload.performed?.sounded).toBe(true);
  expect(firstMusicalPayload.performed?.pitch).toBeTruthy();
  expect(firstMusicalPayload.expression?.eventIndex).toBe(firstMusicalPayload.performedTiming?.eventIndex);
  expect(firstMusicalPayload.tags).toContain("timing:offset-data");
});

test("persistence failure stays soft and retries are bounded", async ({ page }) => {
  let appendAttempts = 0;
  await page.route("**/api/persistence/append", async (route) => {
    appendAttempts += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "persistence offline" }),
    });
  });

  await page.goto("/");
  await waitForPersistenceDebugApi(page);

  await expect.poll(async () => (await getPersistenceState(page)).status, {
    timeout: 8_000,
  }).toBe("error");

  const failedState = await getPersistenceState(page);
  expect(appendAttempts).toBe(4);
  expect(failedState.pendingCount).toBeGreaterThanOrEqual(1);
  expect(failedState.retryAttempt).toBe(4);
  expect(failedState.lastError).toBe("HTTP 503");
  await expect(page.getByTestId("persistence-status")).toContainText("error");

  await setSessionMode(page, "break");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Break");
  const recoveredState = await getPersistenceState(page);
  expect(recoveredState.pendingCount).toBeGreaterThanOrEqual(failedState.pendingCount);
  expect(["scheduled", "flushing", "retrying", "error"]).toContain(recoveredState.status);
});

test("inspector help icons explain current controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("inspector-help-panel")).toBeHidden();

  await page.getByTestId("help-ollama").click();
  await expect(page.getByTestId("inspector-help-panel")).toBeVisible();
  await expect(page.getByTestId("inspector-help-title")).toHaveText("Ollama");
  await expect(page.getByTestId("inspector-help-body")).toContainText("local model boundary");
  await expect(page.getByTestId("help-ollama")).toHaveAttribute("aria-expanded", "true");
  expect(await helpPanelIsInsideSection(page, "help-ollama")).toBe(true);

  await page.getByTestId("help-lookahead").click();
  await expect(page.getByTestId("inspector-help-title")).toHaveText("Lookahead");
  await expect(page.getByTestId("inspector-help-body")).toContainText("delayed-now buffer");
  await expect(page.getByTestId("help-ollama")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("help-lookahead")).toHaveAttribute("aria-expanded", "true");
  expect(await helpPanelIsInsideSection(page, "help-lookahead")).toBe(true);

  await page.getByTestId("inspector-help-close").click();
  await expect(page.getByTestId("inspector-help-panel")).toBeHidden();
  await expect(page.getByTestId("help-lookahead")).toHaveAttribute("aria-expanded", "false");
});

test("stage resizer changes the inspector width within bounds", async ({ page }) => {
  await page.goto("/");

  const stage = page.getByTestId("stage");
  const inspector = page.getByTestId("player-inspector");
  const resizer = page.getByTestId("stage-resizer");
  const stageBox = await stage.boundingBox();
  const initialInspectorBox = await inspector.boundingBox();
  const resizerBox = await resizer.boundingBox();

  expect(stageBox).not.toBeNull();
  expect(initialInspectorBox).not.toBeNull();
  expect(resizerBox).not.toBeNull();

  if (!stageBox || !initialInspectorBox || !resizerBox) return;

  await page.mouse.move(
    resizerBox.x + resizerBox.width / 2,
    resizerBox.y + resizerBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizerBox.x - 120, resizerBox.y + resizerBox.height / 2);
  await page.mouse.up();

  const widenedInspectorBox = await inspector.boundingBox();
  expect(widenedInspectorBox).not.toBeNull();
  expect(widenedInspectorBox?.width).toBeGreaterThan(initialInspectorBox.width + 60);
  expect(widenedInspectorBox?.width).toBeLessThanOrEqual(stageBox.width * 0.5 + 2);

  await resizer.focus();
  await page.keyboard.press("Home");
  const narrowedInspectorBox = await inspector.boundingBox();
  expect(narrowedInspectorBox).not.toBeNull();
  expect(narrowedInspectorBox?.width).toBeLessThan(widenedInspectorBox?.width ?? Infinity);
  await expect(resizer).toHaveAttribute("aria-valuenow", "280");
});

test("Grow exposes session modes, starts three players, hears events, and cleans up the transport", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");

  const button = page.getByTestId("transport-toggle");
  const status = page.getByTestId("transport-status");
  const canvasFrame = page.getByTestId("terrarium-container");
  const canvas = page.getByTestId("terrarium-canvas");

  await expect(page.locator(".brand__subtitle")).toHaveText(
    "A song idea becomes bounded knobs",
  );
  await expect(button).toHaveText("Start");
  await expect(status).toContainText(
    "mode rehearsal | song Lantern | section verse 1, bar 1/8 | stopped | 90 BPM | bar 1 | beat 0.0 | lookahead stopped 0.0/8 | pending slots 0",
  );
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  await expect(page.getByTestId("session-mode-rehearsal")).toBeChecked();
  await expect(page.getByTestId("song-current")).toHaveText("Lantern");
  await expect(page.getByTestId("song-lantern")).toBeChecked();
  await expect(page.getByTestId("song-harmony-current")).toContainText("Gather");
  await expect(page.getByTestId("song-harmony-current")).toContainText("C-G");
  await expect(page.getByTestId("timing-feel-current")).toHaveText("Feel");
  await expect(page.getByTestId("timing-feel-feel")).toBeChecked();
  await expect(page.getByTestId("song-sketch-title")).toHaveText("Lantern working sketch (draft)");
  await expect(page.getByTestId("song-sketch-proposer")).toHaveText("melody -> pulse, bass, melody");
  await expect(page.getByTestId("song-sketch-sections")).toContainText("Gather 0-8: I(C)-V(G)");
  await expect(page.getByTestId("song-sketch-assignments")).toContainText("bass support");
  await expect(page.getByTestId("song-sketch-proposal")).toContainText("mock/");
  await expect(page.getByTestId("song-sketch-responses")).toContainText("bass");
  await expect(page.getByTestId("song-sketch-questions")).not.toHaveText("none");
  await expect(page.getByTestId("melody-development-current")).toHaveText("Repaired");
  await expect(page.getByTestId("melody-candidate-current")).toContainText("balanced-repair");
  await expect(page.getByTestId("melody-score-total")).toContainText("deterministic");
  await expect(page.getByTestId("melody-critic-status")).toContainText("idle");
  await expect(page.getByTestId("melody-consensus-status")).toContainText("deterministic-scorer");
  await expect(page.getByTestId("melody-score-perspectives")).toContainText("melody");
  const songSketch = await getSongSketch(page);
  expect(songSketch.id).toBe("sketch-lantern-c-mixolydian");
  expect(songSketch.status).toBe("draft");
  expect(songSketch.sourceSongId).toBe("lantern");
  expect(songSketch.proposerPlayerId).toBe("melody");
  expect([...songSketch.affectedPlayerIds].sort()).toEqual(["bass", "melody", "pulse"]);
  expect(songSketch.tonalContext.mode).toBe("mixolydian");
  expect(songSketch.sections).toHaveLength(2);
  expect(songSketch.assignments).toHaveLength(3);
  expect(songSketch.openQuestions.length).toBeGreaterThan(0);
  expect(songSketch.sections[0].chordPlan).toEqual(["I", "V"]);
  expect(songSketch.sections[0].rootDegrees).toEqual([0, 4]);
  const lanternBassDegrees = getSongPatternScaleDegrees("lantern", "bass");
  expect(getSketchSectionRootDegrees(songSketch).every((degree) => lanternBassDegrees.has(degree))).toBe(true);
  const lanternProposal = await getSongProposal(page);
  const lanternAnswer = songSketch.sections.find((section) => section.id === lanternProposal.targetSectionId);
  expect(lanternProposal.status).toBe("mock");
  expect(lanternProposal.sketchId).toBe(songSketch.id);
  expect(lanternProposal.sourceSongId).toBe("lantern");
  expect(lanternProposal.proposedByPlayerId).toBe(songSketch.proposerPlayerId);
  expect(lanternProposal.kind).toBe("tighten_roots");
  expect(lanternProposal.rootDegrees).toEqual(lanternAnswer?.rootDegrees);
  expect(lanternProposal.chordPlan).toEqual(lanternAnswer?.chordPlan);
  expect(lanternProposal.responses.map((response) => response.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(lanternProposal.responses.every((response) => (
    songSketch.affectedPlayerIds.includes(response.playerId)
  ))).toBe(true);
  const clonedChord = await page.evaluate(() => {
    const appWindow = window as unknown as {
      song?: { getSketch(): SongSketch };
    };
    const sketch = appWindow.song?.getSketch();
    if (!sketch) return "missing";
    (sketch.sections[0] as unknown as { chordPlan: string[] }).chordPlan[0] = "MUTATED";
    return appWindow.song?.getSketch().sections[0].chordPlan[0] ?? "missing";
  });
  expect(clonedChord).toBe("I");
  await page.getByTestId("song-glass-option").click();
  const glassSketch = await getSongSketch(page);
  expect(glassSketch.sourceSongId).toBe("glass");
  expect(glassSketch.sections[0].chordPlan).not.toEqual(songSketch.sections[0].chordPlan);
  expect(getSongSketchAssignmentDensity(glassSketch, "melody")).toBeLessThan(
    getSongSketchAssignmentDensity(songSketch, "melody"),
  );
  const glassBassDegrees = getSongPatternScaleDegrees("glass", "bass");
  expect(getSketchSectionRootDegrees(glassSketch).every((degree) => glassBassDegrees.has(degree))).toBe(true);
  const glassProposal = await getSongProposal(page);
  expect(glassProposal.sourceSongId).toBe("glass");
  expect(glassProposal.kind).toBe("preserve_space");
  expect(glassProposal.responses).toHaveLength(3);
  await page.getByTestId("song-lantern-option").click();
  await expect(page.getByTestId("song-current")).toHaveText("Lantern");
  expect(await getSessionMode(page)).toBe("rehearsal");
  expect((await getTransportState(page)).sessionMode).toBe("rehearsal");
  expect((await getTransportState(page)).songId).toBe("lantern");
  expect((await getTransportState(page)).timingFeelMode).toBe("feel");
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { getModes(): Array<{ id: string }> };
    };
    return appWindow.session?.getModes().map((mode) => mode.id).join(",");
  })).toBe("break,solo-practice,rehearsal,performance");
  await page.getByTestId("session-mode-break-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Break");
  await expect(page.getByTestId("session-mode-break")).toBeChecked();
  await expect(status).toContainText("mode break | song Lantern | section verse 1, bar 1/8 | stopped");
  expect(await getSessionMode(page)).toBe("break");
  expect((await getTransportState(page)).sessionMode).toBe("break");
  await expect.poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount).toBe(0);
  await page.getByTestId("session-mode-performance-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Performance");
  await expect(status).toContainText("mode performance | song Lantern | section verse 1, bar 1/8 | stopped");
  expect(await getSessionMode(page)).toBe("performance");
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode("solo-practice");
  })).toBe("solo-practice");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Solo practice");
  await expect(page.getByTestId("session-mode-solo-practice")).toBeChecked();
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode("not-a-mode");
  })).toBe("solo-practice");
  await page.getByTestId("session-mode-rehearsal-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  expect(await getSessionMode(page)).toBe("rehearsal");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("player-pulse-name")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-role")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-sound")).toHaveText("root pulse");
  await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-taste-action")).toHaveText("repeat");
  await expect(page.getByTestId("player-pulse-taste-summary")).toContainText("Listening");
  await expect(page.getByTestId("player-pulse-expression")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-offset")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-contagion")).toHaveText("0.00 (quiet)");
  await expect(page.getByTestId("player-bass-name")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-role")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-sound")).toHaveText("modal bass");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-taste-action")).toHaveText("repeat");
  await expect(page.getByTestId("player-melody-name")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-role")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-sound")).toHaveText("modal line");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-expression")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-offset")).toHaveText("waiting");
  await expect(page.getByTestId("thought-seed-pulse-focus")).not.toHaveText("");
  await expect(page.getByTestId("thought-seed-bass-fragments")).not.toHaveText("");
  await expect(page.getByTestId("thought-seed-melody-motif")).toContainText("resting");
  await expect(page.getByTestId("thought-request-melody-level")).toContainText("in_song_short");
  await expect(page.getByTestId("thought-intent-melody-action")).not.toHaveText("none");
  await expect(page.getByTestId("ollama-base-url-input")).toHaveValue("http://127.0.0.1:11434");
  await expect(page.getByTestId("ollama-model-input")).toHaveValue("qwen3:4b-instruct-2507-q4_K_M");
  await expect(page.getByTestId("ollama-protocol-status")).toHaveText("projected-json (Projected JSON)");
  await expect(page.getByTestId("ollama-health-status")).toContainText("unknown");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("idle");
  await expect(page.getByTestId("ollama-primer-summary")).toContainText("scaleDegree");
  await expect(page.getByTestId("ollama-primer-summary")).toContainText("registerDelta");
  const primer = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getSessionPrimer(): string };
    };
    return appWindow.ollama?.getSessionPrimer();
  });
  expect(primer).toContain("scaleDegree is a pitch-class index");
  expect(primer).toContain("top-level registerDelta as -1, 0, or 1");
  expect(primer).toContain("Do not only mention registerDelta in rationale");
  expect(primer).toContain('"action":"shift_register","registerDelta":1');
  expect(primer).toContain("system owns sourceStartBeat");
  const influenceProbePrompt = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getInfluenceProbePrompt(playerId?: string): string };
    };
    return appWindow.ollama?.getInfluenceProbePrompt("melody");
  });
  expect(influenceProbePrompt).toContain("influence_probe");
  expect(influenceProbePrompt).toContain("abstract transferable technique");
  const initialThoughtSeeds = await getThoughtSeeds(page);
  expect(initialThoughtSeeds.map((seed) => seed.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialThoughtSeeds.every((seed) => seed.selectedFragments.length === 2)).toBe(true);
  expect(initialThoughtSeeds.every((seed) => seed.disposition.length > 0)).toBe(true);
  expect(initialThoughtSeeds.every((seed) => seed.recentMotif.displayExcerpt === "resting")).toBe(true);
  expect(initialThoughtSeeds.every((seed) => validateMusicalExcerpt(seed.recentMotif.excerpt).valid)).toBe(true);
  const initialThoughtRequests = await getThoughtRequests(page);
  const initialHookIntents = await getMockThoughtIntents(page);
  const initialMockIntents = initialThoughtRequests.map((request) => createMockThoughtIntent(request));
  const projectedMelodyRequest = createProjectedThoughtRequest(
    initialThoughtRequests.find((request) => request.playerId === "melody") ?? initialThoughtRequests[0],
  );
  const projectedPrompt = getThoughtPromptProtocol("projected-json").createUserPrompt(
    initialThoughtRequests.find((request) => request.playerId === "melody") ?? initialThoughtRequests[0],
  );
  const initialBassRequest = initialThoughtRequests.find((request) => request.playerId === "bass") ??
    initialThoughtRequests[0];
  const projectedBassPrompt = getThoughtPromptProtocol("projected-json").createUserPrompt(
    {
      ...initialBassRequest,
      allowedActions: ["rest", "simplify", "change_density"],
    },
  );
  expect(initialThoughtRequests.map((request) => request.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialThoughtRequests.every((request) => request.requestLevel === "in_song_short")).toBe(true);
  expect(initialThoughtRequests.every((request) => request.seed.playerId === request.playerId)).toBe(true);
  expect(initialThoughtRequests.every((request) => validatePlayerThoughtRequest(request).valid)).toBe(true);
  expect(projectedMelodyRequest.v).toBe("grow.thought/1");
  expect(projectedMelodyRequest.player).toBe("melody");
  expect(projectedMelodyRequest.memory.length).toBe(2);
  expect(Array.isArray(projectedMelodyRequest.motif)).toBe(true);
  expect(JSON.stringify(projectedMelodyRequest)).not.toContain("sourceStartBeat");
  expect(projectedPrompt).toContain("Request projection:");
  expect(projectedPrompt).toContain("top-level registerDelta");
  expect(projectedPrompt).toContain('"action":"shift_register","registerDelta":1');
  expect(projectedPrompt).not.toContain("Request JSON:");
  expect(projectedBassPrompt).not.toContain("registerDelta");
  expect(projectedBassPrompt).not.toContain("shift_register");
  expect(initialHookIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialMockIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialMockIntents.every((intent) => {
    const request = initialThoughtRequests.find((candidate) => candidate.id === intent.requestId);
    return request ? validatePlayerThoughtIntent(intent, request).valid : false;
  })).toBe(true);
  await expect(page.getByTestId("listening-tonal-context")).toHaveText("C mixolydian");
  await expect(page.getByTestId("listening-event-count")).toHaveText("0");
  await expect(page.getByTestId("listening-agitation")).toHaveText("0.00 (density)");
  await expect(page.getByTestId("lookahead-health")).toHaveText("stopped");
  await expect(page.getByTestId("lookahead-lead")).toHaveText("0.0 / 8 beats");
  await expect(page.getByTestId("lookahead-through")).toHaveText("beat 0.0");
  await expect(page.getByTestId("lookahead-pending-slots")).toHaveText("0");
  await expect(page.getByTestId("song-section-current")).toHaveText("Verse 1, bar 1/8");

  const frameBox = await canvasFrame.boundingBox();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(400);
  expect(box?.height).toBeGreaterThan(340);
  expect(Math.abs((box?.width ?? 0) - (frameBox?.width ?? 0))).toBeLessThan(2);
  expect(Math.abs((box?.height ?? 0) - (frameBox?.height ?? 0))).toBeLessThan(2);
  const initialVisualState = await getTerrariumVisualState(page);
  expect(initialVisualState.agitation).toBe(0);
  expect(initialVisualState.roomWarmthAlpha).toBe(0);
  expect(initialVisualState.players.map((player) => player.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialVisualState.players.every((player) => (
    player.contagionLevel === 0
    && player.haloAlpha >= 0.64
    && player.haloAlpha <= 1
    && player.haloScale >= 1
    && player.haloScale <= 1.6
  ))).toBe(true);

  await button.click();
  await expect(button).toHaveText("Stop");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await expect(page.getByTestId("lookahead-health")).toHaveText("healthy");
  const playingState = await getTransportState(page);
  expect(playingState.songForm).toMatchObject({
    sectionType: "verse",
    occurrence: 1,
    localBar: 1,
  });
  await expect(page.getByTestId("song-section-current")).toContainText("Verse 1");
  expect(playingState.lookahead.targetBeats).toBe(8);
  expect(playingState.lookahead.minimumBeats).toBe(4);
  expect(playingState.lookahead.leadBeats).toBeGreaterThanOrEqual(
    playingState.lookahead.minimumBeats,
  );
  expect(playingState.lookahead.leadBeats).toBeLessThanOrEqual(
    playingState.lookahead.targetBeats + 0.5,
  );
  expect(playingState.lookahead.scheduledThroughBeat).toBeGreaterThanOrEqual(8);
  expect(playingState.lookahead.pendingSlotCount).toBeLessThanOrEqual(40);
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBeGreaterThan(0);
  await expect(page.getByTestId("listening-latest-event")).toContainText("note");
  await expect
    .poll(async () => {
      const frame = await getListeningFrame(page);
      return [...new Set(frame.recentEvents.map((event) => event.playerId))].sort().join(",");
    })
    .toBe("bass,melody,pulse");
  await expect
    .poll(async () => (await getTransportState(page)).expression.latest.length)
    .toBe(3);
  await expect
    .poll(async () => (await getTransportState(page)).performedTiming.latest.length)
    .toBe(3);
  await expect
    .poll(async () => (await getListeningFrame(page)).mix.agitation)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await getTerrariumVisualState(page)).agitation)
    .toBeGreaterThan(0);
  await expect(page.getByTestId("player-pulse-expression")).toContainText("x");
  await expect(page.getByTestId("player-pulse-offset")).toContainText("beats");
  await expect(page.getByTestId("player-melody-contagion")).toContainText("heat");
  await expect(page.getByTestId("listening-agitation")).toContainText("(");

  const frame = await getListeningFrame(page);
  const visualState = await getTerrariumVisualState(page);
  expect(visualState.agitation).toBeGreaterThan(0);
  expect(visualState.agitation).toBeLessThanOrEqual(1);
  expect(visualState.roomWarmthAlpha).toBeGreaterThan(0);
  expect(visualState.roomWarmthAlpha).toBeLessThanOrEqual(0.16);
  expect(visualState.players.map((player) => player.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(visualState.players.every((player) => (
    player.contagionLevel >= 0
    && player.contagionLevel <= 1
    && player.haloAlpha >= 0.64
    && player.haloAlpha <= 1
    && player.haloScale >= 1
    && player.haloScale <= 1.6
  ))).toBe(true);
  expect(visualState.players.some((player) => player.contagionLevel > 0)).toBe(true);
  expect(visualState.players.some((player) => player.haloScale > 1)).toBe(true);
  const expressionState = await getTransportState(page);
  expect(expressionState.expression.latest.map((expression) => expression.playerId).sort()).toEqual([
    "bass",
    "melody",
    "pulse",
  ]);
  expect(expressionState.expression.latest.every((expression) => (
    expression.velocityMultiplier >= 0.78
    && expression.velocityMultiplier <= 1.24
    && expression.finalVelocity >= 0
    && expression.finalVelocity <= 1
    && expression.summary.length > 0
  ))).toBe(true);
  expect(expressionState.performedTiming.latest.map((timing) => timing.playerId).sort()).toEqual([
    "bass",
    "melody",
    "pulse",
  ]);
  expect(expressionState.performedTiming.latest.every((timing) => (
    Math.abs(timing.performedOffsetBeats) <= timing.maximumOffsetBeats
    && timing.maximumOffsetBeats <= 0.035
    && timing.summary.length > 0
  ))).toBe(true);
  expect(frame.tonalContext).toEqual({
    tonic: "C",
    mode: "mixolydian",
    scale: ["C", "D", "E", "F", "G", "A", "Bb"],
  });
  expect(frame.mix.silenceRatio).toBeGreaterThanOrEqual(0);
  expect(frame.mix.silenceRatio).toBeLessThanOrEqual(1);
  expect(frame.mix.brightness).toBeGreaterThanOrEqual(0);
  expect(frame.mix.brightness).toBeLessThanOrEqual(1);
  expect(frame.mix.transientDensity).toBeGreaterThan(0);
  expect(frame.mix.agitation).toBeGreaterThan(0);
  expect(frame.mix.agitation).toBeLessThanOrEqual(1);
  expect(Object.values(frame.mix.agitationSources).every((value) => value >= 0 && value <= 1)).toBe(true);
  expect(frame.players.map((player) => player.id).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(frame.players.every((player) => (
    player.contagion.level >= 0
    && player.contagion.level <= 1
    && player.contagion.summary.length > 0
    && Object.values(player.contagion.components).every((value) => value >= 0 && value <= 1)
  ))).toBe(true);
  expect(frame.players.some((player) => player.contagion.level > 0)).toBe(true);
  expect(frame.players.find((player) => player.id === "pulse")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "bass")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "melody")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.map((player) => player.state)).toEqual(["performing", "performing", "performing"]);
  expect(
    frame.recentEvents.every((event) => {
      if (!event.pitch) return true;
      const pitchClass = event.pitch.replace(/[0-9-]+$/, "");
      return frame.tonalContext.scale.includes(pitchClass);
    }),
  ).toBe(true);
  expect(
    frame.recentEvents.every((event) => {
      const snappedHalfBeat = event.absoluteBeat * 2;
      return Math.abs(snappedHalfBeat - Math.round(snappedHalfBeat)) < 0.000001;
    }),
  ).toBe(true);
  expect(frame.recentEvents.every((event) => event.velocity >= 0 && event.velocity <= 1)).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("expression:velocity"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("timing:offset-data"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("timing:audible-offset"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.expression && event.expression.velocityMultiplier !== 1)).toBe(true);
  expect(frame.recentEvents.every((event) => Number.isInteger(event.eventIndex) && event.eventIndex >= 0)).toBe(true);
  expect(frame.recentEvents.every((event) => {
    if (!event.expression || !event.performedTiming) return false;
    return event.expression.eventIndex === event.eventIndex
      && event.performedTiming.eventIndex === event.eventIndex
      && event.performedTiming.performedOffsetBeats === event.performedOffsetBeats
      && event.performedOffsetSeconds === Math.round((event.performedOffsetBeats * 60 / 90) * 10_000) / 10_000
      && Math.abs(event.performedOffsetBeats) <= event.performedTiming.maximumOffsetBeats
      && Math.abs(event.performedOffsetBeats) <= 0.035;
  })).toBe(true);
  await expect
    .poll(async () => {
      const seeds = await getThoughtSeeds(page);
      return seeds.find((seed) => seed.playerId === "melody")?.recentMotif.eventCount ?? 0;
    })
    .toBeGreaterThan(0);
  const activeThoughtSeeds = await getThoughtSeeds(page);
  const melodySeed = activeThoughtSeeds.find((seed) => seed.playerId === "melody");
  expect(melodySeed?.promptFocus.length).toBeGreaterThan(0);
  expect(melodySeed?.listeningSummary.eventCount).toBeGreaterThan(0);
  expect(melodySeed?.recentMotif.displayExcerpt).not.toBe("resting");
  expect(melodySeed?.recentMotif.excerpt.steps.length).toBeGreaterThan(0);
  expect(melodySeed?.recentMotif.excerpt.steps.every((step, index, steps) => (
    index === 0 || step.positionBeats >= steps[index - 1].positionBeats
  ))).toBe(true);
  expect(melodySeed?.recentMotif.excerpt.steps.every((step) => step.positionBeats >= 0)).toBe(true);
  const activeThoughtRequests = await getThoughtRequests(page);
  const activeHookIntents = await getMockThoughtIntents(page);
  const activeMockIntents = activeThoughtRequests.map((request) => createMockThoughtIntent(request));
  const melodyRequest = activeThoughtRequests.find((request) => request.playerId === "melody");
  const melodyIntent = activeMockIntents.find((intent) => intent.playerId === "melody");
  expect(activeHookIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(melodyRequest?.excerpts[0].steps.length).toBeGreaterThan(0);
  expect(melodyRequest && validatePlayerThoughtRequest(melodyRequest).valid).toBe(true);
  expect(melodyRequest && melodyIntent && validatePlayerThoughtIntent(melodyIntent, melodyRequest).valid).toBe(true);
  expect(melodyIntent?.musicalIdea.origin).toBe("imagined");
  if (!melodyRequest || !melodyIntent) {
    throw new Error("Expected melody thought protocol objects");
  }
  const parsedRawThought = await page.evaluate((rawResponse) => {
    const appWindow = window as unknown as {
      ollama?: {
        parseThoughtResponse(rawResponse: string, playerId?: string): {
          status: string;
          intent?: PlayerThoughtIntent;
        };
      };
    };
    return appWindow.ollama?.parseThoughtResponse(rawResponse, "melody");
  }, JSON.stringify({
    ...melodyIntent,
    musicalIdea: {
      ...melodyIntent.musicalIdea,
      sourceStartBeat: 999,
    },
  }));
  expect(parsedRawThought?.status).toBe("ok");
  expect(parsedRawThought?.intent?.musicalIdea.sourceStartBeat).not.toBe(999);
  expect(parsedRawThought?.intent?.musicalIdea.sourceStartBeat).toBeGreaterThanOrEqual(0);
  const outOfRangeDegreeExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      scaleDegree: melodyRequest.constraints.tonalContext.scale.length,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(outOfRangeDegreeExcerpt).errors).toContain(
    "step 0 scaleDegree must be within tonal scale",
  );
  const outOfScalePitchExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "F#4",
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(outOfScalePitchExcerpt).errors).toContain(
    "step 0 pitch must belong to tonal scale",
  );
  const disagreeingPitchAndDegreeExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "C4",
      scaleDegree: 1,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(disagreeingPitchAndDegreeExcerpt).errors).toContain(
    "step 0 pitch and scaleDegree disagree",
  );
  const disagreeingPitchAndOctaveExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "C4",
      scaleDegree: 0,
      octave: 5,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(disagreeingPitchAndOctaveExcerpt).errors).toContain(
    "step 0 pitch and octave disagree",
  );
  const tooLongIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    musicalIdea: {
      ...melodyIntent.musicalIdea,
      durationBeats: melodyRequest.constraints.maxDurationBeats + 1,
    },
  };
  expect(validatePlayerThoughtIntent(tooLongIntent, melodyRequest).errors).toContain(
    "musical idea duration exceeds request constraint",
  );
  const missingRegisterDeltaIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    action: "shift_register",
    registerDelta: undefined,
  };
  expect(validatePlayerThoughtIntent(missingRegisterDeltaIntent, melodyRequest).errors).toContain(
    "shift_register requires registerDelta",
  );
  const outOfRangeRegisterDeltaIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    action: "shift_register",
    registerDelta: 2,
  };
  expect(validatePlayerThoughtIntent(outOfRangeRegisterDeltaIntent, melodyRequest).errors).toContain(
    "registerDelta must be -1, 0, or 1",
  );
  const noOpRegisterDeltaIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    action: "shift_register",
    registerDelta: 0,
  };
  expect(validatePlayerThoughtIntent(noOpRegisterDeltaIntent, melodyRequest).valid).toBe(true);
  const strayRegisterDeltaIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    action: "rest",
    registerDelta: 1,
  };
  expect(validatePlayerThoughtIntent(strayRegisterDeltaIntent, melodyRequest).errors).toContain(
    "registerDelta is only allowed for shift_register",
  );
  expect(melodyRequest && JSON.stringify(createMockThoughtIntent(melodyRequest))).toBe(
    melodyRequest && JSON.stringify(createMockThoughtIntent(melodyRequest)),
  );

  await expect
    .poll(async () => {
      const evaluations = await getTasteEvaluations(page);
      return evaluations.map((evaluation) => evaluation.playerId).sort().join(",");
    })
    .toBe("bass,melody,pulse");
  const evaluations = await getTasteEvaluations(page);
  expect(evaluations.every((evaluation) => evaluation.summary.length > 0)).toBe(true);
  expect(evaluations.every((evaluation) => evaluation.reasons.length > 0)).toBe(true);
  expect(evaluations.every((evaluation) => evaluation.affinity >= 0 && evaluation.affinity <= 1)).toBe(true);
  expect(evaluations.map((evaluation) => evaluation.action)).toContain("repeat");
  await expect(page.getByTestId("player-melody-taste-summary")).not.toHaveText("Listening for a shape.");

  await expect
    .poll(async () => {
      const tasteFrame = await getListeningFrame(page);
      return tasteFrame.recentEvents.some((event) => event.kind === "rest");
    }, { timeout: 7_000 })
    .toBe(true);
  const tasteFrame = await getListeningFrame(page);
  expect(tasteFrame.recentEvents.some((event) => event.tags.some((tag) => tag.startsWith("taste:")))).toBe(true);
  const melodyActions = new Set<string>();
  for (let sample = 0; sample < 6; sample += 1) {
    const sampledEvaluations = await getTasteEvaluations(page);
    melodyActions.add(sampledEvaluations.find((evaluation) => evaluation.playerId === "melody")?.action ?? "");
    await page.waitForTimeout(250);
  }
  expect(melodyActions.size).toBeLessThanOrEqual(2);

  await page.waitForTimeout(650);
  const postureFrame = await getListeningFrame(page);
  expect(postureFrame.players.map((player) => player.state)).toEqual([
    "performing",
    "performing",
    "performing",
  ]);

  await setSessionMode(page, "break");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Break");
  await expect(page.getByTestId("session-mode-break")).toBeChecked();
  await expect(status).toContainText("mode break | song Lantern | section verse");
  const breakStartCount = await getRecordedEventCount(page);
  expect(breakStartCount).toBeGreaterThan(0);
  const breakStartBeat = await getLatestRecordedBeat(page);
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount, { timeout: 9_000 })
    .toBe(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("empty");
  const drainedEventCount = await getRecordedEventCount(page);
  expect(drainedEventCount).toBeGreaterThanOrEqual(breakStartCount);
  const drainedBeat = await getLatestRecordedBeat(page);
  expect(drainedBeat).toBeGreaterThanOrEqual(breakStartBeat);
  await page.waitForTimeout(1_000);
  expect(await getRecordedEventCount(page)).toBe(drainedEventCount);
  expect(await getLatestRecordedBeat(page)).toBe(drainedBeat);

  await setSessionMode(page, "rehearsal");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  await expect(status).toContainText("mode rehearsal | song Lantern | section verse");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await expect
    .poll(async () => getLatestRecordedBeat(page))
    .toBeGreaterThan(drainedBeat);

  await setSessionMode(page, "performance");
  await expect(status).toContainText("mode performance | song Lantern | section verse");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await setSessionMode(page, "solo-practice");
  await expect(status).toContainText("mode solo practice | song Lantern | section verse");
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await setSessionMode(page, "rehearsal");

  await button.click();
  await expect(button).toHaveText("Start");
  await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBe(0);
  await expect.poll(async () => (await getTransportState(page)).expression.latest.length).toBe(0);
  await expect.poll(async () => (await getTransportState(page)).performedTiming.latest.length).toBe(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("stopped");
  await expect(page.getByTestId("lookahead-pending-slots")).toHaveText("0");
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBe(0);
  await expect.poll(async () => (await getTerrariumVisualState(page)).agitation).toBe(0);

  for (let index = 0; index < 10; index += 1) {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBeGreaterThan(0);
    const cycleState = await getTransportState(page);
    expect(cycleState.lookahead.health).toBe("healthy");
    expect(cycleState.lookahead.pendingSlotCount).toBeLessThanOrEqual(40);

    await page.waitForTimeout(150);

    await button.click();
    await expect(button).toHaveText("Start");
    await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBe(0);
    await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("stopped");
  }

  await expect(status).toContainText(
    "mode rehearsal | song Lantern | section verse 1, bar 1/8 | stopped | 90 BPM | bar 1 | beat 0.0 | lookahead stopped 0.0/8 | pending slots 0",
  );
  await expect.poll(async () => (await getTransportState(page)).status).toBe("stopped");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
