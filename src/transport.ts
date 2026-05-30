import type * as ToneNS from "tone";

export type TransportStatus = "stopped" | "playing";

export interface GrowTransportState {
  status: TransportStatus;
  bpm: number;
  bar: number;
  scheduledEventCount: number;
}

const BPM = 90;

let Tone: typeof ToneNS | null = null;
let synth: ToneNS.MembraneSynth | null = null;
let sequence: ToneNS.Sequence<string> | null = null;
let status: TransportStatus = "stopped";
let bar = 1;
let tickId: number | null = null;
let onTick: ((state: GrowTransportState) => void) | null = null;

function log(message: string): void {
  if (import.meta.env.DEV) {
    console.info(`[transport] ${message}`);
  }
}

function emitTick(): void {
  onTick?.(getState());
}

function setBarFromTransport(): void {
  if (!Tone) return;
  const [bars] = Tone.Transport.position.toString().split(":");
  const nextBar = Number.parseInt(bars, 10) + 1;
  bar = Number.isFinite(nextBar) && nextBar > 0 ? nextBar : 1;
  emitTick();
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
  if (sequence) {
    sequence.stop(0);
    sequence.dispose();
    sequence = null;
  }
}

export function initTransport(
  tickHandler?: (state: GrowTransportState) => void,
): GrowTransportState {
  onTick = tickHandler ?? null;
  bar = 1;
  emitTick();
  return getState();
}

export async function startTransport(): Promise<GrowTransportState> {
  const tone = await loadTone();
  await tone.start();

  if (sequence) {
    console.warn("[transport] start requested while a sequence is already active");
    return getState();
  }

  const instrument = ensureSynth(tone);
  tone.Transport.bpm.value = BPM;
  tone.Transport.timeSignature = [4, 4];
  tone.Transport.loop = false;
  tone.Transport.position = "0:0:0";
  bar = 1;

  sequence = new tone.Sequence(
    (time, note) => {
      instrument.triggerAttackRelease(note, "8n", time);
      tone.Draw.schedule(setBarFromTransport, time);
    },
    ["C2"],
    "4n",
  );
  sequence.start(0);

  if (tickId !== null) {
    tone.Transport.clear(tickId);
  }
  tickId = tone.Transport.scheduleRepeat(setBarFromTransport, "4n");

  tone.Transport.start("+0.05");
  status = "playing";
  log("started");
  emitTick();
  return getState();
}

export function stopTransport(): GrowTransportState {
  if (Tone) {
    Tone.Transport.stop(0);
  }
  if (tickId !== null) {
    Tone?.Transport.clear(tickId);
    tickId = null;
  }
  disposeSequence();
  Tone?.Transport.cancel(0);
  status = "stopped";
  bar = 1;
  if (Tone) {
    Tone.Transport.position = "0:0:0";
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
  onTick = null;
  log("disposed");
}

export function getState(): GrowTransportState {
  return {
    status,
    bpm: BPM,
    bar,
    scheduledEventCount: sequence ? 1 : 0,
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
    Tone?.Transport.stop(0);
    Tone?.Transport.cancel(0);
  });
}
