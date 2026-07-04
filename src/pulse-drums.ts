export type PulseDrumId =
  | "kick"
  | "snare"
  | "closed-hat"
  | "open-hat"
  | "low-tom"
  | "mid-tom"
  | "high-tom";

export interface PulseDrumHit {
  id: PulseDrumId;
  label: string;
  midiNote: number;
  synthPitch?: string;
  velocityMultiplier: number;
  durationSeconds: number;
  tags: readonly string[];
}

export interface PulseDrumInput {
  absoluteBeat: number;
  scaleDegree: number;
  velocity: number;
}

const GM_DRUMS: Record<PulseDrumId, Omit<PulseDrumHit, "tags">> = {
  kick: {
    id: "kick",
    label: "Kick",
    midiNote: 36,
    synthPitch: "C1",
    velocityMultiplier: 1.1,
    durationSeconds: 0.16,
  },
  snare: {
    id: "snare",
    label: "Snare",
    midiNote: 38,
    velocityMultiplier: 0.84,
    durationSeconds: 0.12,
  },
  "closed-hat": {
    id: "closed-hat",
    label: "Closed hat",
    midiNote: 42,
    velocityMultiplier: 0.38,
    durationSeconds: 0.045,
  },
  "open-hat": {
    id: "open-hat",
    label: "Open hat",
    midiNote: 46,
    velocityMultiplier: 0.46,
    durationSeconds: 0.1,
  },
  "low-tom": {
    id: "low-tom",
    label: "Low tom",
    midiNote: 45,
    synthPitch: "G1",
    velocityMultiplier: 0.72,
    durationSeconds: 0.13,
  },
  "mid-tom": {
    id: "mid-tom",
    label: "Mid tom",
    midiNote: 47,
    synthPitch: "C2",
    velocityMultiplier: 0.68,
    durationSeconds: 0.11,
  },
  "high-tom": {
    id: "high-tom",
    label: "High tom",
    midiNote: 50,
    synthPitch: "G2",
    velocityMultiplier: 0.62,
    durationSeconds: 0.095,
  },
};

export function selectPulseDrumHit(input: PulseDrumInput): PulseDrumHit {
  const beatInBar = positiveModulo(Math.round(input.absoluteBeat), 4);
  const degreeClass = positiveModulo(input.scaleDegree, 7);
  const id = selectPulseDrumId(beatInBar, degreeClass, input.velocity);
  const hit = GM_DRUMS[id];
  return {
    ...hit,
    tags: ["pulse:drum-kit", `drum:${hit.id}`, `gm:${hit.midiNote}`],
  };
}

function selectPulseDrumId(beatInBar: number, degreeClass: number, velocity: number): PulseDrumId {
  if (beatInBar === 0) return "kick";
  if (beatInBar === 2) return "snare";
  if (degreeClass === 4 || degreeClass === 5) return beatInBar === 3 ? "low-tom" : "mid-tom";
  if (degreeClass === 6 || velocity > 0.78) return "open-hat";
  if (degreeClass === 1 || degreeClass === 2) return "high-tom";
  return "closed-hat";
}

function positiveModulo(value: number, length: number): number {
  return ((Math.trunc(value) % length) + length) % length;
}
