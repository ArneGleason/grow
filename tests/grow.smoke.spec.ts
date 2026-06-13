import { expect, test, type Page } from "@playwright/test";
import { calculatePlayerExpression } from "../src/expression";
import {
  MusicalEventRecordBuffer,
  createMusicalEventPersistenceRecord,
} from "../src/musical-event-record";
import { calculatePerformedTiming } from "../src/performed-time";
import { MELODY_PLAYER, PLAYER_REGISTRY } from "../src/players";
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
import type { SongSketch, SongSketchProposal } from "../src/song-sketch";
import type { PlayerThoughtSeed } from "../src/thought-seeds";
import { DEFAULT_TONAL_CONTEXT } from "../src/tonal-context";

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

test("melody repair readout supports A/B audition and remembered feedback", async ({ page }) => {
  await page.goto("/");
  await flushPersistence(page);
  await expect(page.getByTestId("melody-development-current")).toHaveText("Repaired");
  await expect(page.getByTestId("melody-score-total")).toContainText("repaired");
  await expect(page.getByTestId("melody-score-choice")).toContainText("balanced-repair");
  await expect(page.getByTestId("melody-score-roots")).toContainText("Answer");
  await expect(page.getByTestId("melody-score-perspectives")).toContainText("pulse");

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
    "Chorus scoring follows the moving roots",
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
