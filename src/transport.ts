import type * as ToneNS from "tone";
import {
  calculatePlayerExpression,
  type PlayerExpressionSnapshot,
} from "./expression";
import type { MusicalEvent, TonalContext } from "./listening";
import {
  calculatePerformedTiming,
  type PlayerPerformedTimingSnapshot,
} from "./performed-time";
import { getPlayerById } from "./players";
import { DEFAULT_SESSION_MODE, type SessionMode } from "./session-mode";
import {
  DEFAULT_SONG_ID,
  getSongMaterial,
  type PatternNoteSource,
  type SongId,
} from "./song-material";
import type { TasteNoteDecision, TasteNoteDecisionInput } from "./taste";
import { DEFAULT_TONAL_CONTEXT, noteFromScaleDegree } from "./tonal-context";

export type TransportStatus = "stopped" | "playing";
export type LookaheadHealth = "stopped" | "empty" | "thin" | "healthy";
export type TimingFeelMode = "grid" | "feel" | "wide";

export interface GrowLookaheadState {
  targetBeats: number;
  minimumBeats: number;
  scheduledThroughBeat: number;
  leadBeats: number;
  pendingSlotCount: number;
  health: LookaheadHealth;
}

export interface GrowTransportState {
  status: TransportStatus;
  sessionMode: SessionMode;
  songId: SongId;
  timingFeelMode: TimingFeelMode;
  bpm: number;
  bar: number;
  currentBeat: number;
  lookahead: GrowLookaheadState;
  expression: {
    latest: readonly PlayerExpressionSnapshot[];
  };
  performedTiming: {
    latest: readonly PlayerPerformedTimingSnapshot[];
  };
}

export interface AudioFireTimingDiagnostic {
  playerId: string;
  absoluteBeat: number;
  eventIndex: number;
  timingFeelMode: TimingFeelMode;
  scheduledSeconds: number;
  immediateSeconds: number;
  lookaheadNowSeconds: number;
  audioTimeSeconds: number;
  clampDelaySeconds: number;
  createdAtMs: number;
}

export interface TransportHandlers {
  tick?: (state: GrowTransportState) => void;
  musicalEvent?: (event: MusicalEvent) => void;
  noteDecision?: (input: TasteNoteDecisionInput) => TasteNoteDecision | undefined;
  sessionMode?: () => SessionMode;
  shouldRefillLookahead?: () => boolean;
  songId?: () => SongId;
  timingFeelMode?: () => TimingFeelMode;
}

export interface TransportOptions {
  tonalContext?: TonalContext;
}

const BPM = 90;
const BEATS_PER_BAR = 4;
const BEAT_SNAP = 16;
const LOOKAHEAD_GRID_BEATS = 0.5;
const LOOKAHEAD_TARGET_BEATS = 8;
const LOOKAHEAD_MINIMUM_BEATS = 4;
const LOOKAHEAD_SCHEDULER_INTERVAL_MS = 250;
const AUDIO_START_TIMEOUT_MS = 3_000;
const AUDIO_FIRE_EPSILON_SECONDS = 0.003;
const MAX_PERFORMED_OFFSET_BEATS = 0.06;
const WIDE_TIMING_SCALE = 4;
const WIDE_TIMING_MAXIMUM_OFFSET_BEATS = MAX_PERFORMED_OFFSET_BEATS;
const DEFAULT_TIMING_FEEL_MODE: TimingFeelMode = "feel";
const DEFAULT_NOTE_DECISION: TasteNoteDecision = {
  action: "repeat",
  shouldPlay: true,
  velocityMultiplier: 1,
  reason: "No taste decision supplied.",
};

interface ScheduledNote extends Omit<PatternNoteSource, "scaleDegree" | "octave"> {
  pitch: string;
}

interface PlayerPattern {
  subdivisionBeats: number;
  events: Array<ScheduledNote | null>;
}

interface ScheduledSnapshot {
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
}

interface CommittedScheduledNote {
  note: ScheduledNote;
  snapshot: ScheduledSnapshot;
  eventIndex: number;
  performedTiming: PlayerPerformedTimingSnapshot;
  songId: SongId;
  timingFeelMode: TimingFeelMode;
}

let Tone: typeof ToneNS | null = null;
let pulseSynth: ToneNS.MembraneSynth | null = null;
let bassSynth: ToneNS.MonoSynth | null = null;
let melodySynth: ToneNS.Synth | null = null;
const scheduledEventIds = new Set<number>();
let status: TransportStatus = "stopped";
let eventSerial = 0;
let handlers: TransportHandlers = {};
let activeTonalContext: TonalContext = DEFAULT_TONAL_CONTEXT;
let activePatterns: readonly PlayerPattern[] = [];
let lookaheadTimerId = 0;
let nextScheduleBeat = 0;
let scheduledThroughBeat = 0;
const committedEventIndexes = new Map<string, number>();
const latestCommittedPitchByPlayer = new Map<string, string>();
const latestExpressionByPlayer = new Map<string, PlayerExpressionSnapshot>();
const latestPerformedTimingByPlayer = new Map<string, PlayerPerformedTimingSnapshot>();
const latestAudioFireTiming: AudioFireTimingDiagnostic[] = [];

function buildPlayerPatterns(tonalContext: TonalContext, songId: SongId): readonly PlayerPattern[] {
  return getSongMaterial(songId).patterns.map((pattern) => ({
    subdivisionBeats: pattern.subdivisionBeats,
    events: pattern.events.map((note) => note ? materializeNote(tonalContext, note) : null),
  }));
}

function materializeNote(tonalContext: TonalContext, note: PatternNoteSource): ScheduledNote {
  return {
    playerId: note.playerId,
    pitch: noteFromScaleDegree(tonalContext, note.scaleDegree, note.octave),
    duration: note.duration,
    durationBeats: note.durationBeats,
    velocity: note.velocity,
  };
}

function log(message: string): void {
  if (import.meta.env.DEV) {
    console.info(`[transport] ${message}`);
  }
}

function emitTick(): void {
  handlers.tick?.(getState());
}

function getActiveSessionMode(): SessionMode {
  return handlers.sessionMode?.() ?? DEFAULT_SESSION_MODE;
}

function shouldRefillLookahead(): boolean {
  return handlers.shouldRefillLookahead?.() ?? true;
}

function getActiveSongId(): SongId {
  return handlers.songId?.() ?? DEFAULT_SONG_ID;
}

function getTimingFeelMode(): TimingFeelMode {
  return handlers.timingFeelMode?.() ?? DEFAULT_TIMING_FEEL_MODE;
}

function getScheduledSnapshot(absoluteBeat: number): ScheduledSnapshot {
  const snappedBeat = snapBeat(absoluteBeat);
  const totalSixteenths = Math.round(snappedBeat * 4);
  const barIndex = Math.floor(totalSixteenths / 16);
  const beatIndex = Math.floor((totalSixteenths % 16) / 4);
  const sixteenthIndex = totalSixteenths % 4;

  return {
    transportPosition: `${barIndex}:${beatIndex}:${sixteenthIndex}`,
    bar: barIndex + 1,
    beat: beatIndex + 1,
    absoluteBeat: snappedBeat,
  };
}

function emitNoteEvent(
  committed: CommittedScheduledNote,
  decision: TasteNoteDecision,
  expression: PlayerExpressionSnapshot,
  velocity: number,
): void {
  if (status !== "playing") return;
  const { note, snapshot } = committed;
  const player = getPlayerById(note.playerId);
  if (!player) return;

  const event: MusicalEvent = {
    id: `event-${eventSerial}`,
    kind: decision.shouldPlay ? "note" : "rest",
    playerId: player.id,
    instrumentId: player.instrumentId,
    transportPosition: snapshot.transportPosition,
    bar: snapshot.bar,
    beat: snapshot.beat,
    absoluteBeat: snapshot.absoluteBeat,
    eventIndex: committed.eventIndex,
    durationBeats: note.durationBeats,
    performedOffsetBeats: committed.performedTiming.performedOffsetBeats,
    performedOffsetSeconds: beatsToSeconds(committed.performedTiming.performedOffsetBeats),
    velocity,
    pitch: decision.shouldPlay ? note.pitch : undefined,
    expression,
    performedTiming: committed.performedTiming,
    tags: [
      ...player.tags,
      `taste:${decision.action}`,
      `song:${committed.songId}`,
      "expression:velocity",
      "timing:offset-data",
      committed.timingFeelMode === "grid" ? "timing:grid" : "timing:audible-offset",
      ...(committed.timingFeelMode === "wide" ? ["timing:wide-audition"] : []),
    ],
    createdAtMs: performance.now(),
  };
  eventSerial += 1;
  handlers.musicalEvent?.(event);
}

function beatsToSeconds(beats: number): number {
  return Math.round((beats * 60 / BPM) * 10_000) / 10_000;
}

function snapBeat(value: number): number {
  return Math.round(value * BEAT_SNAP) / BEAT_SNAP;
}

function getCurrentBeat(): number {
  if (status !== "playing" || !Tone) return 0;
  const transport = Tone.getTransport();
  return Math.max(0, snapBeat(transport.ticks / transport.PPQ));
}

async function loadTone(): Promise<typeof ToneNS> {
  if (!Tone) {
    Tone = await import("tone");
  }
  return Tone;
}

async function startAudioContext(tone: typeof ToneNS): Promise<void> {
  let timeoutId = 0;
  try {
    await Promise.race([
      tone.start(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("Timed out while starting the audio context"));
        }, AUDIO_START_TIMEOUT_MS);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function ensurePulseSynth(tone: typeof ToneNS): ToneNS.MembraneSynth {
  if (!pulseSynth || pulseSynth.disposed) {
    pulseSynth = new tone.MembraneSynth({
      pitchDecay: 0.025,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.24,
        sustain: 0,
        release: 0.08,
      },
    }).toDestination();
    pulseSynth.volume.value = -13;
  }

  return pulseSynth;
}

function ensureBassSynth(tone: typeof ToneNS): ToneNS.MonoSynth {
  if (!bassSynth || bassSynth.disposed) {
    bassSynth = new tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { Q: 1, type: "lowpass", rolloff: -24, frequency: 900 },
      envelope: {
        attack: 0.012,
        decay: 0.08,
        sustain: 0.55,
        release: 0.18,
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.12,
        sustain: 0.2,
        release: 0.16,
        baseFrequency: 120,
        octaves: 2,
      },
    }).toDestination();
    bassSynth.volume.value = -17;
  }

  return bassSynth;
}

function ensureMelodySynth(tone: typeof ToneNS): ToneNS.Synth {
  if (!melodySynth || melodySynth.disposed) {
    melodySynth = new tone.Synth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.01,
        decay: 0.12,
        sustain: 0.25,
        release: 0.18,
      },
    }).toDestination();
    melodySynth.volume.value = -19;
  }

  return melodySynth;
}

function triggerScheduledNote(
  tone: typeof ToneNS,
  audioTime: number,
  committed: CommittedScheduledNote,
): void {
  const { note, snapshot } = committed;
  const player = getPlayerById(note.playerId);
  if (!player) return;

  const decision = handlers.noteDecision?.({
    playerId: note.playerId,
    role: player.role,
    pitch: note.pitch,
    absoluteBeat: snapshot.absoluteBeat,
    velocity: note.velocity,
  }) ?? DEFAULT_NOTE_DECISION;
  const expression = calculatePlayerExpression({
    player,
    absoluteBeat: snapshot.absoluteBeat,
    eventIndex: committed.eventIndex,
    baseVelocity: note.velocity,
    tasteVelocityMultiplier: decision.velocityMultiplier,
  });
  const velocity = decision.shouldPlay ? expression.finalVelocity : 0;
  const appliedExpression = {
    ...expression,
    finalVelocity: velocity,
  };
  latestExpressionByPlayer.set(note.playerId, appliedExpression);

  if (decision.shouldPlay && note.playerId === "pulse") {
    ensurePulseSynth(tone).triggerAttackRelease(note.pitch, note.duration, audioTime, velocity);
  } else if (decision.shouldPlay && note.playerId === "bass") {
    ensureBassSynth(tone).triggerAttackRelease(note.pitch, note.duration, audioTime, velocity);
  } else if (decision.shouldPlay && note.playerId === "melody") {
    ensureMelodySynth(tone).triggerAttackRelease(note.pitch, note.duration, audioTime, velocity);
  }

  emitNoteEvent(committed, decision, appliedExpression, velocity);
}

function clampAudioFireTime(tone: typeof ToneNS, performedTime: ToneNS.Unit.Time): number {
  const scheduledSeconds = Number(performedTime);
  const fallbackSeconds = tone.immediate() + AUDIO_FIRE_EPSILON_SECONDS;
  if (!Number.isFinite(scheduledSeconds)) return fallbackSeconds;
  return Math.max(scheduledSeconds, fallbackSeconds);
}

function recordAudioFireTiming(
  tone: typeof ToneNS,
  committed: CommittedScheduledNote,
  scheduledSeconds: number,
  audioTimeSeconds: number,
): void {
  latestAudioFireTiming.push({
    playerId: committed.note.playerId,
    absoluteBeat: committed.snapshot.absoluteBeat,
    eventIndex: committed.eventIndex,
    timingFeelMode: committed.timingFeelMode,
    scheduledSeconds,
    immediateSeconds: tone.immediate(),
    lookaheadNowSeconds: tone.now(),
    audioTimeSeconds,
    clampDelaySeconds: Number.isFinite(scheduledSeconds)
      ? audioTimeSeconds - scheduledSeconds
      : 0,
    createdAtMs: performance.now(),
  });
  if (latestAudioFireTiming.length > 96) {
    latestAudioFireTiming.splice(0, latestAudioFireTiming.length - 96);
  }
}

function getFirstFutureGridBeat(currentBeat: number): number {
  return snapBeat(
    Math.ceil(
      (currentBeat + MAX_PERFORMED_OFFSET_BEATS + Number.EPSILON) / LOOKAHEAD_GRID_BEATS,
    ) * LOOKAHEAD_GRID_BEATS,
  );
}

function isPatternStepDue(pattern: PlayerPattern, absoluteBeat: number): boolean {
  const step = absoluteBeat / pattern.subdivisionBeats;
  return Math.abs(step - Math.round(step)) < 0.000001;
}

function getPatternStep(pattern: PlayerPattern, absoluteBeat: number): ScheduledNote | null | undefined {
  if (!isPatternStepDue(pattern, absoluteBeat)) return undefined;
  const step = Math.round(absoluteBeat / pattern.subdivisionBeats);
  const stepIndex = step % pattern.events.length;
  return pattern.events[stepIndex];
}

function getNextCommittedEventIndex(playerId: string): number {
  const eventIndex = committedEventIndexes.get(playerId) ?? 0;
  committedEventIndexes.set(playerId, eventIndex + 1);
  return eventIndex;
}

function calculateLocalDensity(absoluteBeat: number): number {
  const fromBeat = Math.max(0, snapBeat(absoluteBeat - LOOKAHEAD_GRID_BEATS));
  const toBeat = snapBeat(absoluteBeat + LOOKAHEAD_GRID_BEATS);
  let possibleSteps = 0;
  let noteSteps = 0;

  for (
    let beat = fromBeat;
    beat <= toBeat + Number.EPSILON;
    beat = snapBeat(beat + LOOKAHEAD_GRID_BEATS)
  ) {
    for (const pattern of activePatterns) {
      const note = getPatternStep(pattern, beat);
      if (note === undefined) continue;
      possibleSteps += 1;
      if (note) noteSteps += 1;
    }
  }

  return possibleSteps === 0 ? 0 : noteSteps / possibleSteps;
}

function commitScheduledNote(note: ScheduledNote, snapshot: ScheduledSnapshot): CommittedScheduledNote | undefined {
  const player = getPlayerById(note.playerId);
  if (!player) return undefined;

  const eventIndex = getNextCommittedEventIndex(note.playerId);
  const previousPitch = latestCommittedPitchByPlayer.get(note.playerId);
  const songId = getActiveSongId();
  const timingFeelMode = getTimingFeelMode();
  const calculatedTiming = calculatePerformedTiming({
    player,
    absoluteBeat: snapshot.absoluteBeat,
    eventIndex,
    pitch: note.pitch,
    previousPitch,
    durationBeats: note.durationBeats,
    baseVelocity: note.velocity,
    localDensity: calculateLocalDensity(snapshot.absoluteBeat),
  });
  const performedTiming = applyTimingFeelMode(calculatedTiming, timingFeelMode);
  latestCommittedPitchByPlayer.set(note.playerId, note.pitch);
  latestPerformedTimingByPlayer.set(note.playerId, performedTiming);

  return {
    note,
    snapshot,
    eventIndex,
    performedTiming,
    songId,
    timingFeelMode,
  };
}

function applyTimingFeelMode(
  timing: PlayerPerformedTimingSnapshot,
  timingFeelMode: TimingFeelMode,
): PlayerPerformedTimingSnapshot {
  if (timingFeelMode === "feel") return timing;
  if (timingFeelMode === "wide") return widenTimingFeel(timing);
  return {
    ...timing,
    performedOffsetBeats: 0,
    components: {
      ...timing.components,
      sharedGroove: 0,
      playerPocket: 0,
      materialPressure: 0,
      stumble: 0,
    },
    summary: "square grid",
  };
}

function widenTimingFeel(timing: PlayerPerformedTimingSnapshot): PlayerPerformedTimingSnapshot {
  const performedOffsetBeats = roundBeatOffset(clampBeatOffset(
    timing.performedOffsetBeats * WIDE_TIMING_SCALE,
    -Math.min(WIDE_TIMING_MAXIMUM_OFFSET_BEATS, timing.absoluteBeat),
    WIDE_TIMING_MAXIMUM_OFFSET_BEATS,
  ));

  return {
    ...timing,
    performedOffsetBeats,
    maximumOffsetBeats: WIDE_TIMING_MAXIMUM_OFFSET_BEATS,
    components: {
      ...timing.components,
      sharedGroove: roundBeatOffset(timing.components.sharedGroove * WIDE_TIMING_SCALE),
      playerPocket: roundBeatOffset(timing.components.playerPocket * WIDE_TIMING_SCALE),
      materialPressure: roundBeatOffset(timing.components.materialPressure * WIDE_TIMING_SCALE),
      stumble: roundBeatOffset(timing.components.stumble * WIDE_TIMING_SCALE),
    },
    summary: `wide audition: ${timing.summary}`,
  };
}

function roundBeatOffset(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clampBeatOffset(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getPerformedTransportPosition(tone: typeof ToneNS, committed: CommittedScheduledNote): string {
  const transport = tone.getTransport();
  const performedBeat = Math.max(
    0,
    committed.snapshot.absoluteBeat + committed.performedTiming.performedOffsetBeats,
  );
  const minimumFutureTicks = transport.state === "started"
    ? Math.ceil(transport.ticks + 1)
    : 0;
  const ticks = Math.max(0, minimumFutureTicks, Math.round(performedBeat * transport.PPQ));
  return `${ticks}i`;
}

function schedulePatternNote(
  tone: typeof ToneNS,
  committed: CommittedScheduledNote,
): void {
  const transport = tone.getTransport();
  const draw = tone.getDraw();
  let eventId = -1;
  eventId = transport.scheduleOnce((time) => {
    scheduledEventIds.delete(eventId);
    if (status !== "playing") return;
    const audioTime = clampAudioFireTime(tone, time);
    recordAudioFireTiming(tone, committed, Number(time), audioTime);
    triggerScheduledNote(tone, audioTime, committed);
    draw.schedule(() => emitTick(), audioTime);
  }, getPerformedTransportPosition(tone, committed));
  scheduledEventIds.add(eventId);
}

function scheduleLookahead(tone: typeof ToneNS): void {
  if (status !== "playing") return;
  if (!shouldRefillLookahead()) return;

  const currentBeat = getCurrentBeat();
  if (nextScheduleBeat < currentBeat) {
    nextScheduleBeat = getFirstFutureGridBeat(currentBeat);
  }

  const scheduleUntilBeat = snapBeat(currentBeat + LOOKAHEAD_TARGET_BEATS);
  while (nextScheduleBeat <= scheduleUntilBeat) {
    const snapshot = getScheduledSnapshot(nextScheduleBeat);
    for (const pattern of activePatterns) {
      const note = getPatternStep(pattern, snapshot.absoluteBeat);
      if (note) {
        const committed = commitScheduledNote(note, snapshot);
        if (committed) {
          schedulePatternNote(tone, committed);
        }
      }
    }
    scheduledThroughBeat = snapshot.absoluteBeat;
    nextScheduleBeat = snapBeat(nextScheduleBeat + LOOKAHEAD_GRID_BEATS);
  }
}

function startLookaheadScheduler(tone: typeof ToneNS): void {
  scheduleLookahead(tone);
  lookaheadTimerId = window.setInterval(() => {
    scheduleLookahead(tone);
    emitTick();
  }, LOOKAHEAD_SCHEDULER_INTERVAL_MS);
}

function disposeLookaheadSchedule(tone: typeof ToneNS | null = Tone): void {
  if (lookaheadTimerId !== 0) {
    window.clearInterval(lookaheadTimerId);
    lookaheadTimerId = 0;
  }

  const transport = tone?.getTransport();
  if (transport) {
    for (const eventId of scheduledEventIds) {
      transport.clear(eventId);
    }
  }
  scheduledEventIds.clear();
  activePatterns = [];
  nextScheduleBeat = 0;
  scheduledThroughBeat = 0;
  committedEventIndexes.clear();
  latestCommittedPitchByPlayer.clear();
  latestExpressionByPlayer.clear();
  latestPerformedTimingByPlayer.clear();
  latestAudioFireTiming.length = 0;
}

export function initTransport(
  nextHandlers: TransportHandlers = {},
  options: TransportOptions = {},
): GrowTransportState {
  handlers = nextHandlers;
  activeTonalContext = options.tonalContext ?? DEFAULT_TONAL_CONTEXT;
  emitTick();
  return getState();
}

export async function startTransport(): Promise<GrowTransportState> {
  const tone = await loadTone();
  await startAudioContext(tone);

  if (status === "playing" || scheduledEventIds.size > 0 || lookaheadTimerId !== 0) {
    console.warn("[transport] start requested while lookahead scheduling is already active");
    return getState();
  }

  ensurePulseSynth(tone);
  ensureBassSynth(tone);
  ensureMelodySynth(tone);

  const transport = tone.getTransport();
  transport.bpm.value = BPM;
  transport.timeSignature = [4, 4];
  transport.loop = false;
  transport.position = "0:0:0";
  status = "playing";
  eventSerial = 0;
  committedEventIndexes.clear();
  latestCommittedPitchByPlayer.clear();
  latestExpressionByPlayer.clear();
  latestPerformedTimingByPlayer.clear();
  latestAudioFireTiming.length = 0;
  nextScheduleBeat = 0;
  scheduledThroughBeat = 0;
  activePatterns = buildPlayerPatterns(activeTonalContext, getActiveSongId());
  startLookaheadScheduler(tone);

  transport.start("+0.05");
  log("started");
  emitTick();
  return getState();
}

export function stopTransport(): GrowTransportState {
  const transport = Tone?.getTransport();
  status = "stopped";
  transport?.stop(0);
  disposeLookaheadSchedule(Tone);
  transport?.cancel(0);
  if (transport) {
    transport.position = "0:0:0";
  }
  log("stopped");
  emitTick();
  return getState();
}

export function refreshLookaheadSchedule(): GrowTransportState {
  if (!Tone || status !== "playing") {
    emitTick();
    return getState();
  }

  const transport = Tone.getTransport();
  for (const eventId of scheduledEventIds) {
    transport.clear(eventId);
  }
  scheduledEventIds.clear();
  activePatterns = buildPlayerPatterns(activeTonalContext, getActiveSongId());
  const currentBeat = getCurrentBeat();
  nextScheduleBeat = getFirstFutureGridBeat(currentBeat);
  scheduledThroughBeat = currentBeat;
  committedEventIndexes.clear();
  latestCommittedPitchByPlayer.clear();
  latestExpressionByPlayer.clear();
  latestPerformedTimingByPlayer.clear();
  latestAudioFireTiming.length = 0;
  scheduleLookahead(Tone);
  emitTick();
  return getState();
}

export function disposeTransport(): void {
  stopTransport();
  if (pulseSynth && !pulseSynth.disposed) {
    pulseSynth.dispose();
  }
  if (bassSynth && !bassSynth.disposed) {
    bassSynth.dispose();
  }
  if (melodySynth && !melodySynth.disposed) {
    melodySynth.dispose();
  }
  pulseSynth = null;
  bassSynth = null;
  melodySynth = null;
  handlers = {};
  log("disposed");
}

export function getState(): GrowTransportState {
  const currentBeat = getCurrentBeat();
  return {
    status,
    sessionMode: getActiveSessionMode(),
    songId: getActiveSongId(),
    timingFeelMode: getTimingFeelMode(),
    bpm: BPM,
    bar: Math.floor(currentBeat / BEATS_PER_BAR) + 1,
    currentBeat,
    lookahead: getLookaheadState(currentBeat),
    expression: {
      latest: [...latestExpressionByPlayer.values()],
    },
    performedTiming: {
      latest: [...latestPerformedTimingByPlayer.values()],
    },
  };
}

export function getTimingDiagnostics(): readonly AudioFireTimingDiagnostic[] {
  return latestAudioFireTiming;
}

function getLookaheadState(currentBeat: number): GrowLookaheadState {
  const leadBeats = status === "playing"
    ? Math.max(0, snapBeat(scheduledThroughBeat - currentBeat))
    : 0;
  const pendingSlotCount = status === "playing" ? scheduledEventIds.size : 0;
  let health: LookaheadHealth = "stopped";

  if (status === "playing") {
    if (pendingSlotCount === 0 || leadBeats <= 0) {
      health = "empty";
    } else if (leadBeats < LOOKAHEAD_MINIMUM_BEATS) {
      health = "thin";
    } else {
      health = "healthy";
    }
  }

  return {
    targetBeats: LOOKAHEAD_TARGET_BEATS,
    minimumBeats: LOOKAHEAD_MINIMUM_BEATS,
    scheduledThroughBeat: status === "playing" ? scheduledThroughBeat : 0,
    leadBeats,
    pendingSlotCount,
    health,
  };
}

declare global {
  interface Window {
    transport?: {
      init: typeof initTransport;
      start: typeof startTransport;
      stop: typeof stopTransport;
      dispose: typeof disposeTransport;
      refreshLookahead: typeof refreshLookaheadSchedule;
      getState: typeof getState;
      getTimingDiagnostics: typeof getTimingDiagnostics;
    };
  }
}

window.transport = {
  init: initTransport,
  start: startTransport,
  stop: stopTransport,
  dispose: disposeTransport,
  refreshLookahead: refreshLookaheadSchedule,
  getState,
  getTimingDiagnostics,
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeTransport();
    Tone?.getTransport().stop(0);
    Tone?.getTransport().cancel(0);
  });
}
