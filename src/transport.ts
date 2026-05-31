import type * as ToneNS from "tone";
import type { MusicalEvent, TonalContext } from "./listening";
import { getPlayerById } from "./players";
import type { TasteNoteDecision, TasteNoteDecisionInput } from "./taste";
import { DEFAULT_TONAL_CONTEXT, noteFromScaleDegree } from "./tonal-context";

export type TransportStatus = "stopped" | "playing";
export type LookaheadHealth = "stopped" | "empty" | "thin" | "healthy";

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
  bpm: number;
  bar: number;
  currentBeat: number;
  lookahead: GrowLookaheadState;
}

export interface TransportHandlers {
  tick?: (state: GrowTransportState) => void;
  musicalEvent?: (event: MusicalEvent) => void;
  noteDecision?: (input: TasteNoteDecisionInput) => TasteNoteDecision | undefined;
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
const DEFAULT_NOTE_DECISION: TasteNoteDecision = {
  action: "repeat",
  shouldPlay: true,
  velocityMultiplier: 1,
  reason: "No taste decision supplied.",
};

interface PatternNote {
  playerId: string;
  scaleDegree: number;
  octave: number;
  duration: ToneNS.Unit.Time;
  durationBeats: number;
  velocity: number;
}

interface ScheduledNote extends Omit<PatternNote, "scaleDegree" | "octave"> {
  pitch: string;
}

interface PlayerPattern {
  subdivisionBeats: number;
  events: Array<ScheduledNote | null>;
}

interface PlayerPatternSource {
  subdivisionBeats: number;
  events: Array<PatternNote | null>;
}

interface ScheduledSnapshot {
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
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

const PLAYER_PATTERN_SOURCES: readonly PlayerPatternSource[] = [
  {
    subdivisionBeats: 1,
    events: [
      {
        playerId: "pulse",
        scaleDegree: 0,
        octave: 2,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.74,
      },
    ],
  },
  {
    subdivisionBeats: 0.5,
    events: [
      {
        playerId: "bass",
        scaleDegree: 0,
        octave: 2,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.54,
      },
      null,
      null,
      {
        playerId: "bass",
        scaleDegree: 4,
        octave: 1,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.44,
      },
      {
        playerId: "bass",
        scaleDegree: 6,
        octave: 1,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.48,
      },
      null,
      {
        playerId: "bass",
        scaleDegree: 4,
        octave: 1,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.42,
      },
      null,
    ],
  },
  {
    subdivisionBeats: 0.5,
    events: [
      null,
      {
        playerId: "melody",
        scaleDegree: 2,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        scaleDegree: 4,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.32,
      },
      null,
      {
        playerId: "melody",
        scaleDegree: 5,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        scaleDegree: 4,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.24,
      },
      null,
      {
        playerId: "melody",
        scaleDegree: 1,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.3,
      },
      null,
      {
        playerId: "melody",
        scaleDegree: 0,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.26,
      },
      null,
      {
        playerId: "melody",
        scaleDegree: 2,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        scaleDegree: 4,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.3,
      },
      null,
      {
        playerId: "melody",
        scaleDegree: 6,
        octave: 4,
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.24,
      },
      null,
    ],
  },
];

function buildPlayerPatterns(tonalContext: TonalContext): readonly PlayerPattern[] {
  return PLAYER_PATTERN_SOURCES.map((pattern) => ({
    subdivisionBeats: pattern.subdivisionBeats,
    events: pattern.events.map((note) => note ? materializeNote(tonalContext, note) : null),
  }));
}

function materializeNote(tonalContext: TonalContext, note: PatternNote): ScheduledNote {
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
  snapshot: {
    transportPosition: string;
    bar: number;
    beat: number;
    absoluteBeat: number;
  },
  note: ScheduledNote,
  decision: TasteNoteDecision,
): void {
  if (status !== "playing") return;
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
    durationBeats: note.durationBeats,
    velocity: decision.shouldPlay
      ? Math.max(0, Math.min(1, note.velocity * decision.velocityMultiplier))
      : 0,
    pitch: decision.shouldPlay ? note.pitch : undefined,
    tags: [...player.tags, `taste:${decision.action}`],
    createdAtMs: performance.now(),
  };
  eventSerial += 1;
  handlers.musicalEvent?.(event);
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
  scheduledTime: ToneNS.Unit.Time,
  note: ScheduledNote,
  snapshot: ScheduledSnapshot,
): void {
  const player = getPlayerById(note.playerId);
  if (!player) return;

  const decision = handlers.noteDecision?.({
    playerId: note.playerId,
    role: player.role,
    pitch: note.pitch,
    absoluteBeat: snapshot.absoluteBeat,
    velocity: note.velocity,
  }) ?? DEFAULT_NOTE_DECISION;
  const velocity = Math.max(0, Math.min(1, note.velocity * decision.velocityMultiplier));

  if (decision.shouldPlay && note.playerId === "pulse") {
    ensurePulseSynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, velocity);
  } else if (decision.shouldPlay && note.playerId === "bass") {
    ensureBassSynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, velocity);
  } else if (decision.shouldPlay && note.playerId === "melody") {
    ensureMelodySynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, velocity);
  }

  emitNoteEvent(snapshot, note, decision);
}

function getFirstFutureGridBeat(currentBeat: number): number {
  return snapBeat(
    Math.ceil((currentBeat + Number.EPSILON) / LOOKAHEAD_GRID_BEATS) * LOOKAHEAD_GRID_BEATS,
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

function schedulePatternNote(
  tone: typeof ToneNS,
  note: ScheduledNote,
  snapshot: ScheduledSnapshot,
): void {
  const transport = tone.getTransport();
  const draw = tone.getDraw();
  let eventId = -1;
  eventId = transport.scheduleOnce((time) => {
    scheduledEventIds.delete(eventId);
    if (status !== "playing") return;
    triggerScheduledNote(tone, time, note, snapshot);
    draw.schedule(() => emitTick(), time);
  }, snapshot.transportPosition);
  scheduledEventIds.add(eventId);
}

function scheduleLookahead(tone: typeof ToneNS): void {
  if (status !== "playing") return;

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
        schedulePatternNote(tone, note, snapshot);
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
  nextScheduleBeat = 0;
  scheduledThroughBeat = 0;
  activePatterns = buildPlayerPatterns(activeTonalContext);
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
    bpm: BPM,
    bar: Math.floor(currentBeat / BEATS_PER_BAR) + 1,
    currentBeat,
    lookahead: getLookaheadState(currentBeat),
  };
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
      getState: typeof getState;
    };
  }
}

window.transport = {
  init: initTransport,
  start: startTransport,
  stop: stopTransport,
  dispose: disposeTransport,
  getState,
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeTransport();
    Tone?.getTransport().stop(0);
    Tone?.getTransport().cancel(0);
  });
}
