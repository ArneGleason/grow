import type { PlayerPatternSource, PatternNoteSource } from "./song-material";

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

interface PlacedNote {
  startBeat: number;
  durBeats: number;
  scaleDegree: number;
  velocity: number;
}

export function generateProsodicMelody(input: ProsodicMelodyInput): PlayerPatternSource {
  const baseOctave = input.baseOctave ?? 4;
  const bars = input.bars ?? 4;
  const rng = mulberry32(input.seed >>> 0);
  const totalBeats = bars * BEATS_PER_BAR;
  const phraseBeats = totalBeats / 2; // antecedent + consequent

  const notes: PlacedNote[] = [];
  // Antecedent: arch up, hang on the dominant (a question).
  buildPhrase(rng, notes, 0, phraseBeats, { cadenceDegree: 4, resolve: false });
  // Consequent: parallel rhythm, fall to the tonic on a downbeat (an answer).
  buildPhrase(rng, notes, phraseBeats, phraseBeats, { cadenceDegree: 0, resolve: true });

  return placeOnGrid(notes, totalBeats, baseOctave);
}

interface PhraseShape {
  cadenceDegree: number;
  resolve: boolean; // true -> land the cadence squarely on a downbeat (anchor)
}

function buildPhrase(
  rng: () => number,
  out: PlacedNote[],
  startBeat: number,
  phraseBeats: number,
  shape: PhraseShape,
): void {
  // Reserve the tail of the phrase for the cadence note + a breath.
  const cadenceHold = shape.resolve ? 2.0 : 1.5;
  const breath = 0.5;
  const bodyBudget = phraseBeats - cadenceHold - breath;

  // Anacrusis: a light pickup before the first strong landing.
  let pos = startBeat;
  let degree = 2; // start mid-scale
  // contour: rise across the antecedent body toward a peak, then the cadence falls.
  let direction = 1;
  let peak = 4 + Math.floor(rng() * 3); // 4..6, a modest high point

  // optional pickup foot (anapest) to lean into the phrase
  if (rng() < 0.7) {
    out.push({ startBeat: pos, durBeats: 0.25, scaleDegree: degree, velocity: STRESS_VELOCITY[0] });
    pos += 0.25;
    degree = stepToward(degree, peak, 1);
  }

  while (pos - startBeat < bodyBudget - 0.5) {
    const foot = FEET[Math.floor(rng() * FEET.length)] ?? FEET[0];
    for (const cell of foot) {
      if (pos - startBeat >= bodyBudget) break;
      const dur = Math.min(cell.dur, bodyBudget - (pos - startBeat));
      if (dur < GRID) break;
      out.push({
        startBeat: pos,
        durBeats: dur * 0.96, // articulate slightly
        scaleDegree: degree,
        velocity: STRESS_VELOCITY[cell.stress],
      });
      pos += dur;
      // arch: step toward the peak, turn around once reached
      if (degree >= peak) direction = -1;
      if (degree <= 0) direction = 1;
      const stepSize = cell.stress === 2 && rng() < 0.4 ? 2 : 1; // occasional leap to a focal note
      degree = clampDegree(degree + direction * stepSize);
    }
  }

  // Cadence: anchor the answer on the phrase's final downbeat; let the question
  // hang slightly off it.
  const cadenceStart = shape.resolve
    ? startBeat + phraseBeats - cadenceHold - breath // lands on a bar downbeat for resolve
    : snapToBeat(startBeat + phraseBeats - cadenceHold - breath - 0.5);
  out.push({
    startBeat: Math.max(pos, cadenceStart),
    durBeats: cadenceHold,
    scaleDegree: shape.cadenceDegree,
    velocity: STRESS_VELOCITY[2],
  });
}

function placeOnGrid(
  notes: readonly PlacedNote[],
  totalBeats: number,
  baseOctave: number,
): PlayerPatternSource {
  const steps = Math.round(totalBeats / GRID);
  const events: Array<PatternNoteSource | null> = new Array(steps).fill(null);
  let lastEnd = -1;
  for (const note of notes) {
    const index = Math.round(note.startBeat / GRID) % steps;
    if (note.startBeat < lastEnd) continue; // guard against overlap
    events[index] = {
      playerId: "melody",
      scaleDegree: note.scaleDegree,
      octave: baseOctave,
      duration: beatsToBarsBeatsSixteenths(note.durBeats),
      durationBeats: round3(note.durBeats),
      velocity: round3(note.velocity),
    };
    lastEnd = note.startBeat + note.durBeats;
  }
  return { subdivisionBeats: GRID, events };
}

function stepToward(value: number, target: number, by: number): number {
  if (value < target) return clampDegree(value + by);
  if (value > target) return clampDegree(value - by);
  return value;
}

function clampDegree(value: number): number {
  return Math.max(-1, Math.min(8, value));
}

function snapToBeat(beat: number): number {
  return Math.round(beat);
}

function beatsToBarsBeatsSixteenths(beats: number): string {
  const totalSixteenths = Math.max(1, Math.round(beats * 4));
  const bars = Math.floor(totalSixteenths / 16);
  const remainder = totalSixteenths % 16;
  const wholeBeats = Math.floor(remainder / 4);
  const sixteenths = remainder % 4;
  return `${bars}:${wholeBeats}:${sixteenths}`;
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
