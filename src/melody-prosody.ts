import {
  normalizeAnchorPhrase,
  type Anchor,
  type AnchorPhrase,
  type Connector,
} from "./anchor-phrase";
import { renderAnchorPhrase } from "./anchor-phrase-render";
import type { PlayerPatternSource } from "./song-material";

// Melodic rhythm as prosody: a line is an *utterance* built from metrical feet
// (weak/strong long/short cells), grouped into antecedent ("question") and
// consequent ("answer") phrases, with anacrusis pickups, breath between
// phrases, an arch contour, and stress-shaped dynamics — anchoring or
// contrasting the heartbeat. Pitch is left as scale degrees (wrapped in-scale
// by noteFromScaleDegree), so this only ever shapes *rhythm + contour*, never
// an out-of-key note.

export interface ProsodicMelodyInput {
  seed: number;
  baseOctave?: number;
  bars?: number;
}

const GRID = 0.25; // 16th-note resolution
const BEATS_PER_BAR = 4;

type Stress = 0 | 1 | 2; // 0 ghost/weak, 1 mid, 2 focal

interface Cell {
  dur: number; // inter-onset / sounding length in beats
  stress: Stress;
}

// Metrical feet — the rhythmic vocabulary of speech. Each foot is a small
// long/short stress cell; phrases are sequences of feet.
const FEET: readonly (readonly Cell[])[] = [
  [{ dur: 0.5, stress: 0 }, { dur: 1.5, stress: 2 }], // iamb: weak -> STRONG (held)
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 1 }], // trochee: STRONG -> weak
  [{ dur: 0.25, stress: 0 }, { dur: 0.25, stress: 0 }, { dur: 1.0, stress: 2 }], // anapest: run into a landing
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }], // dactyl-ish
  [{ dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }], // even, talking
];

const STRESS_VELOCITY: Record<Stress, number> = { 0: 0.18, 1: 0.3, 2: 0.46 };

export function generateProsodicMelody(input: ProsodicMelodyInput): PlayerPatternSource {
  const baseOctave = input.baseOctave ?? 4;
  const phrase = generateProsodicAnchorPhrase(input);
  const normalized = normalizeAnchorPhrase(phrase);
  return renderAnchorPhrase(normalized.phrase, {
    baseOctave,
    subdivisionBeats: GRID,
  });
}

export function generateProsodicAnchorPhrase(input: ProsodicMelodyInput): AnchorPhrase {
  const baseOctave = Math.trunc(input.baseOctave ?? 4);
  const bars = input.bars ?? 4;
  const rng = mulberry32(input.seed >>> 0);
  const totalBeats = bars * BEATS_PER_BAR;
  const phraseBeats = totalBeats / 2; // antecedent + consequent

  const phrase: AnchorPhrase = {
    segments: [
      // Antecedent: arch up, hang on the dominant (a question).
      buildAnchorPhraseSegment(rng, 0, phraseBeats, baseOctave, { cadenceDegree: 4, resolve: false }),
      // Consequent: parallel rhythm, fall to the tonic on a downbeat (an answer).
      buildAnchorPhraseSegment(rng, phraseBeats, phraseBeats, baseOctave, { cadenceDegree: 0, resolve: true }),
    ],
  };
  return normalizeAnchorPhrase(phrase).phrase;
}

interface PhraseShape {
  cadenceDegree: number;
  resolve: boolean; // true -> hold the answer cadence through the phrase end
}

function buildPhrase(
  rng: () => number,
  out: Anchor[],
  startBeat: number,
  phraseBeats: number,
  shape: PhraseShape,
): void {
  // Reserve the tail of the phrase for the cadence note + a breath.
  const cadenceHold = shape.resolve ? 2.0 : 1.5;
  const breath = 0.5;
  const cadenceStart = shape.resolve
    ? startBeat + phraseBeats - cadenceHold - breath
    : snapToBeat(startBeat + phraseBeats - cadenceHold - breath);
  const bodyEnd = cadenceStart - GRID;

  // Anacrusis: a light pickup before the first strong landing. It is an anchor
  // because L2 needs to see it, but the run-in shape belongs to the connector.
  let degree = 2; // start mid-scale
  let direction = 1;
  let peak = 4 + Math.floor(rng() * 3); // 4..6, a modest high point
  out.push(anchorFromEngineDegree(degree, 4, startBeat, 0.25, STRESS_VELOCITY[0]));

  degree = stepToward(degree, peak, 1);
  out.push(anchorFromEngineDegree(degree, 4, startBeat + 0.5, 0.75, STRESS_VELOCITY[2]));

  let pos = startBeat + 1.25;
  while (pos < bodyEnd - 0.5) {
    const foot = FEET[Math.floor(rng() * FEET.length)] ?? FEET[0];
    for (const cell of foot) {
      if (pos >= bodyEnd - 0.25) break;
      const dur = Math.min(cell.dur, bodyEnd - pos);
      if (cell.stress === 2 && dur >= GRID) {
        out.push(anchorFromEngineDegree(degree, 4, pos, dur * 0.96, STRESS_VELOCITY[cell.stress]));
      }
      pos += dur;
      // arch: step toward the peak, turn around once reached
      if (degree >= peak) direction = -1;
      if (degree <= 0) direction = 1;
      const stepSize = cell.stress === 2 && rng() < 0.4 ? 2 : 1; // occasional leap to a focal note
      degree = clampDegree(degree + direction * stepSize);
    }
  }

  // Cadence: dominant question, then tonic answer.
  out.push(anchorFromEngineDegree(shape.cadenceDegree, 4, cadenceStart, cadenceHold, STRESS_VELOCITY[2]));
}

function buildAnchorPhraseSegment(
  rng: () => number,
  startBeat: number,
  phraseBeats: number,
  baseOctave: number,
  shape: PhraseShape,
): AnchorPhrase["segments"][number] {
  const anchors: Anchor[] = [];
  buildPhrase(rng, anchors, startBeat, phraseBeats, shape);
  const articulatedAnchors = shape.resolve
    ? stretchFinalAnchorToPhraseEnd(anchors, startBeat + phraseBeats, baseOctave)
    : anchors.map((anchor) => ({ ...anchor, octave: baseOctave }));
  return {
    anchors: articulatedAnchors,
    connectors: connectorsForAnchors(articulatedAnchors),
  };
}

function stretchFinalAnchorToPhraseEnd(
  anchors: readonly Anchor[],
  phraseEndBeat: number,
  baseOctave: number,
): readonly Anchor[] {
  return anchors.map((anchor, index) => {
    if (index !== anchors.length - 1) return { ...anchor, octave: baseOctave };
    return {
      ...anchor,
      octave: baseOctave,
      durationBeats: round3(Math.max(GRID, phraseEndBeat - anchor.startBeat)),
    };
  });
}

function connectorsForAnchors(anchors: readonly Anchor[]): readonly Connector[] {
  return anchors.slice(0, -1).map((anchor, index) => {
    const next = anchors[index + 1];
    if (index === 0) {
      return connector("approach", {
        density: 0.72,
        reach: 0.42,
        bias: next.degree >= anchor.degree ? -0.4 : 0.4,
        pull: 0.85,
        skew: 0.12,
      });
    }
    if (index === anchors.length - 2) {
      return connector("approach", {
        density: 0.1,
        reach: 0.62,
        bias: next.degree >= anchor.degree ? -0.6 : 0.6,
        pull: 1,
        skew: 1,
      });
    }
    return connector("fill", {
      density: 0.45 + (index % 2) * 0.18,
      reach: 0.5,
      bias: next.degree >= anchor.degree ? 0.2 : -0.2,
      pull: 0.46,
      skew: index % 2 === 0 ? 0.12 : -0.1,
    });
  });
}

function connector(
  kernel: Connector["kernel"],
  values: Partial<Omit<Connector, "kernel">>,
): Connector {
  return {
    kernel,
    reach: values.reach ?? 0.5,
    density: values.density ?? 0.5,
    bias: values.bias ?? 0,
    pull: values.pull ?? 0.5,
    color: values.color ?? 0,
    skew: values.skew ?? 0,
  };
}

function anchorFromEngineDegree(
  scaleDegree: number,
  octave: number,
  startBeat: number,
  durationBeats: number,
  velocity: number,
): Anchor {
  return {
    degree: scaleDegree + 1,
    octave,
    startBeat: round3(startBeat),
    durationBeats: round3(durationBeats),
    dynamics: round3(velocity),
  };
}

function stepToward(value: number, target: number, by: number): number {
  if (value < target) return clampDegree(value + by);
  if (value > target) return clampDegree(value - by);
  return value;
}

function clampDegree(value: number): number {
  return Math.max(0, Math.min(6, value));
}

function snapToBeat(beat: number): number {
  return Math.round(beat);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function mulberry32(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
