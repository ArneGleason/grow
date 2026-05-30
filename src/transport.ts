import type * as ToneNS from "tone";
import type { MusicalEvent } from "./listening";
import { getPlayerById } from "./players";

export type TransportStatus = "stopped" | "playing";

export interface GrowTransportState {
  status: TransportStatus;
  bpm: number;
  bar: number;
  currentBeat: number;
  scheduledEventCount: number;
}

export interface TransportHandlers {
  tick?: (state: GrowTransportState) => void;
  musicalEvent?: (event: MusicalEvent) => void;
}

const BPM = 90;
const BEATS_PER_BAR = 4;
const BEAT_SNAP = 16;
const AUDIO_START_TIMEOUT_MS = 3_000;

interface ScheduledNote {
  playerId: string;
  pitch: string;
  duration: ToneNS.Unit.Time;
  durationBeats: number;
  velocity: number;
}

interface PlayerPattern {
  subdivision: ToneNS.Unit.Time;
  events: Array<ScheduledNote | null>;
}

let Tone: typeof ToneNS | null = null;
let pulseSynth: ToneNS.MembraneSynth | null = null;
let bassSynth: ToneNS.MonoSynth | null = null;
let melodySynth: ToneNS.Synth | null = null;
const scheduledSequences = new Set<ToneNS.Sequence<ScheduledNote | null>>();
let status: TransportStatus = "stopped";
let eventSerial = 0;
let handlers: TransportHandlers = {};

const PLAYER_PATTERNS: readonly PlayerPattern[] = [
  {
    subdivision: "4n",
    events: [
      {
        playerId: "pulse",
        pitch: "C2",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.74,
      },
    ],
  },
  {
    subdivision: "8n",
    events: [
      {
        playerId: "bass",
        pitch: "C2",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.54,
      },
      null,
      null,
      {
        playerId: "bass",
        pitch: "G1",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.44,
      },
      {
        playerId: "bass",
        pitch: "Bb1",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.48,
      },
      null,
      {
        playerId: "bass",
        pitch: "G1",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.42,
      },
      null,
    ],
  },
  {
    subdivision: "8n",
    events: [
      null,
      {
        playerId: "melody",
        pitch: "E4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        pitch: "G4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.32,
      },
      null,
      {
        playerId: "melody",
        pitch: "A4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        pitch: "G4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.24,
      },
      null,
      {
        playerId: "melody",
        pitch: "D4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.3,
      },
      null,
      {
        playerId: "melody",
        pitch: "C4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.26,
      },
      null,
      {
        playerId: "melody",
        pitch: "E4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.28,
      },
      {
        playerId: "melody",
        pitch: "G4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.3,
      },
      null,
      {
        playerId: "melody",
        pitch: "Bb4",
        duration: "8n",
        durationBeats: 0.5,
        velocity: 0.24,
      },
      null,
    ],
  },
];

function log(message: string): void {
  if (import.meta.env.DEV) {
    console.info(`[transport] ${message}`);
  }
}

function emitTick(): void {
  handlers.tick?.(getState());
}

function getScheduledSnapshot(tone: typeof ToneNS, scheduledTime: ToneNS.Unit.Time): {
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
} {
  const transport = tone.getTransport();
  const scheduledTicks = transport.getTicksAtTime(scheduledTime);
  const absoluteBeat = snapBeat(scheduledTicks / transport.PPQ);
  const totalSixteenths = Math.round(absoluteBeat * 4);
  const barIndex = Math.floor(totalSixteenths / 16);
  const beatIndex = Math.floor((totalSixteenths % 16) / 4);
  const sixteenthIndex = totalSixteenths % 4;

  return {
    transportPosition: `${barIndex}:${beatIndex}:${sixteenthIndex}`,
    bar: barIndex + 1,
    beat: beatIndex + 1,
    absoluteBeat,
  };
}

function emitNoteEvent(
  tone: typeof ToneNS,
  scheduledTime: ToneNS.Unit.Time,
  note: ScheduledNote,
): void {
  if (status !== "playing") return;
  const player = getPlayerById(note.playerId);
  if (!player) return;

  const snapshot = getScheduledSnapshot(tone, scheduledTime);
  const event: MusicalEvent = {
    id: `event-${eventSerial}`,
    kind: "note",
    playerId: player.id,
    instrumentId: player.instrumentId,
    transportPosition: snapshot.transportPosition,
    bar: snapshot.bar,
    beat: snapshot.beat,
    absoluteBeat: snapshot.absoluteBeat,
    durationBeats: note.durationBeats,
    velocity: note.velocity,
    pitch: note.pitch,
    tags: player.tags,
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
): void {
  if (note.playerId === "pulse") {
    ensurePulseSynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, note.velocity);
  } else if (note.playerId === "bass") {
    ensureBassSynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, note.velocity);
  } else if (note.playerId === "melody") {
    ensureMelodySynth(tone).triggerAttackRelease(note.pitch, note.duration, scheduledTime, note.velocity);
  }

  emitNoteEvent(tone, scheduledTime, note);
}

function disposeSequence(): void {
  for (const activeSequence of scheduledSequences) {
    activeSequence.stop(0);
    activeSequence.dispose();
  }
  scheduledSequences.clear();
}

export function initTransport(
  nextHandlers: TransportHandlers = {},
): GrowTransportState {
  handlers = nextHandlers;
  emitTick();
  return getState();
}

export async function startTransport(): Promise<GrowTransportState> {
  const tone = await loadTone();
  await startAudioContext(tone);

  if (scheduledSequences.size > 0) {
    console.warn("[transport] start requested while a sequence is already active");
    return getState();
  }

  ensurePulseSynth(tone);
  ensureBassSynth(tone);
  ensureMelodySynth(tone);

  const transport = tone.getTransport();
  const draw = tone.getDraw();
  transport.bpm.value = BPM;
  transport.timeSignature = [4, 4];
  transport.loop = false;
  transport.position = "0:0:0";
  status = "playing";
  eventSerial = 0;

  for (const pattern of PLAYER_PATTERNS) {
    const sequence = new tone.Sequence<ScheduledNote | null>(
      (time, note) => {
        if (!note) return;
        triggerScheduledNote(tone, time, note);
        draw.schedule(() => emitTick(), time);
      },
      pattern.events,
      pattern.subdivision,
    );
    sequence.start(0);
    scheduledSequences.add(sequence);
  }

  transport.start("+0.05");
  log("started");
  emitTick();
  return getState();
}

export function stopTransport(): GrowTransportState {
  const transport = Tone?.getTransport();
  status = "stopped";
  transport?.stop(0);
  disposeSequence();
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
    scheduledEventCount: scheduledSequences.size,
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
