import type * as ToneNS from "tone";
import type { MusicalEvent } from "./listening";
import { PULSE_PLAYER } from "./players";

export type TransportStatus = "stopped" | "playing";

export interface GrowTransportState {
  status: TransportStatus;
  bpm: number;
  bar: number;
  scheduledEventCount: number;
}

export interface TransportHandlers {
  tick?: (state: GrowTransportState) => void;
  musicalEvent?: (event: MusicalEvent) => void;
}

const BPM = 90;

let Tone: typeof ToneNS | null = null;
let synth: ToneNS.MembraneSynth | null = null;
let sequence: ToneNS.Sequence<string> | null = null;
const scheduledSequences = new Set<ToneNS.Sequence<string>>();
let status: TransportStatus = "stopped";
let bar = 1;
let eventSerial = 0;
let handlers: TransportHandlers = {};

function log(message: string): void {
  if (import.meta.env.DEV) {
    console.info(`[transport] ${message}`);
  }
}

function emitTick(): void {
  handlers.tick?.(getState());
}

function setBarFromTransport(tone: typeof ToneNS): void {
  if (status !== "playing") return;
  const [bars] = tone.getTransport().position.toString().split(":");
  const nextBar = Number.parseInt(bars, 10) + 1;
  bar = Number.isFinite(nextBar) && nextBar > 0 ? nextBar : 1;
  emitTick();
}

function getTransportSnapshot(tone: typeof ToneNS): {
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
} {
  const transportPosition = tone.getTransport().position.toString();
  const [barsRaw = "0", beatsRaw = "0", sixteenthsRaw = "0"] = transportPosition.split(":");
  const bars = Number.parseInt(barsRaw, 10);
  const beats = Number.parseInt(beatsRaw, 10);
  const sixteenths = Number.parseFloat(sixteenthsRaw);
  const safeBars = Number.isFinite(bars) ? bars : 0;
  const safeBeats = Number.isFinite(beats) ? beats : 0;
  const safeSixteenths = Number.isFinite(sixteenths) ? sixteenths : 0;

  return {
    transportPosition,
    bar: safeBars + 1,
    beat: safeBeats + 1,
    absoluteBeat: safeBars * 4 + safeBeats + safeSixteenths / 4,
  };
}

function emitPulseEvent(tone: typeof ToneNS, note: string): void {
  if (status !== "playing") return;
  const snapshot = getTransportSnapshot(tone);
  const event: MusicalEvent = {
    id: `event-${eventSerial}`,
    kind: "note",
    playerId: PULSE_PLAYER.id,
    instrumentId: PULSE_PLAYER.instrumentId,
    transportPosition: snapshot.transportPosition,
    bar: snapshot.bar,
    beat: snapshot.beat,
    absoluteBeat: snapshot.absoluteBeat,
    durationBeats: 0.5,
    velocity: 0.74,
    pitch: note,
    tags: PULSE_PLAYER.tags,
    createdAtMs: performance.now(),
  };
  eventSerial += 1;
  handlers.musicalEvent?.(event);
}

async function loadTone(): Promise<typeof ToneNS> {
  if (!Tone) {
    Tone = await import("tone");
  }
  return Tone;
}

function ensureSynth(tone: typeof ToneNS): ToneNS.MembraneSynth {
  if (!synth || synth.disposed) {
    synth = new tone.MembraneSynth({
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
    synth.volume.value = -12;
  }

  return synth;
}

function disposeSequence(): void {
  for (const activeSequence of scheduledSequences) {
    activeSequence.stop(0);
    activeSequence.dispose();
  }
  scheduledSequences.clear();
  sequence = null;
}

export function initTransport(
  nextHandlers: TransportHandlers = {},
): GrowTransportState {
  handlers = nextHandlers;
  bar = 1;
  emitTick();
  return getState();
}

export async function startTransport(): Promise<GrowTransportState> {
  const tone = await loadTone();
  await tone.start();

  if (scheduledSequences.size > 0) {
    console.warn("[transport] start requested while a sequence is already active");
    return getState();
  }

  const instrument = ensureSynth(tone);
  const transport = tone.getTransport();
  const draw = tone.getDraw();
  transport.bpm.value = BPM;
  transport.timeSignature = [4, 4];
  transport.loop = false;
  transport.position = "0:0:0";
  bar = 1;

  sequence = new tone.Sequence(
    (time, note) => {
      instrument.triggerAttackRelease(note, "8n", time);
      emitPulseEvent(tone, note);
      draw.schedule(() => setBarFromTransport(tone), time);
    },
    ["C2"],
    "4n",
  );
  sequence.start(0);
  scheduledSequences.add(sequence);

  transport.start("+0.05");
  status = "playing";
  log("started");
  emitTick();
  return getState();
}

export function stopTransport(): GrowTransportState {
  const transport = Tone?.getTransport();
  transport?.stop(0);
  disposeSequence();
  transport?.cancel(0);
  status = "stopped";
  bar = 1;
  if (transport) {
    transport.position = "0:0:0";
  }
  log("stopped");
  emitTick();
  return getState();
}

export function disposeTransport(): void {
  stopTransport();
  if (synth && !synth.disposed) {
    synth.dispose();
  }
  synth = null;
  handlers = {};
  log("disposed");
}

export function getState(): GrowTransportState {
  return {
    status,
    bpm: BPM,
    bar,
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
