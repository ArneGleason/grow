import type { PatternNoteSource, PlayerPatternSource } from "./song-material";
import { MODE_ROOT_CYCLES } from "./song-starter-material";

export type MotifVariationOp = "quote" | "invert" | "thin";

export interface MotifRhythmStep {
  startBeat: number;
  durationBeats: number;
}

export interface Motif {
  id: string;
  playerId: string;
  barIndex: number;
  degrees: readonly number[];
  rhythm: readonly MotifRhythmStep[];
  dynamics: readonly number[];
}

export interface MotifMemory {
  capacity: number;
  pool: readonly Motif[];
}

export interface MotifCaptureOptions {
  beatsPerBar?: number;
  maxNotes?: number;
  minNotes?: number;
}

export interface MotifVariationContext {
  chordRoot: number;
  maxNotes?: number;
  subdivisionBeats?: number;
  tension?: number;
}

export interface MotifVariation {
  sourceBar: number;
  op: MotifVariationOp;
  chordRoot: number;
  degrees: readonly number[];
  rhythm: readonly MotifRhythmStep[];
  dynamics: readonly number[];
}

const DEFAULT_MEMORY_CAPACITY = 16;
const DEFAULT_BEATS_PER_BAR = 4;
const DEFAULT_MIN_MOTIF_NOTES = 2;
const DEFAULT_MAX_MOTIF_NOTES = 6;
const DEFAULT_BASS_SUBDIVISION_BEATS = 0.5;
export const DEFAULT_INTERPLAY_SEED = 0xe10a11;

export function createMotifMemory(capacity = DEFAULT_MEMORY_CAPACITY): MotifMemory {
  return {
    capacity: Math.max(1, Math.trunc(capacity)),
    pool: [],
  };
}

export function capture(
  pattern: PlayerPatternSource,
  barIndex: number,
  options: MotifCaptureOptions = {},
): Motif | undefined {
  const beatsPerBar = positiveNumber(options.beatsPerBar, DEFAULT_BEATS_PER_BAR);
  const minNotes = Math.max(1, Math.trunc(options.minNotes ?? DEFAULT_MIN_MOTIF_NOTES));
  const maxNotes = Math.max(minNotes, Math.trunc(options.maxNotes ?? DEFAULT_MAX_MOTIF_NOTES));
  const playerId = getPatternPlayerId(pattern);
  if (!playerId || pattern.events.length === 0 || pattern.subdivisionBeats <= 0) return undefined;

  const startBeat = Math.max(0, Math.trunc(barIndex)) * beatsPerBar;
  const captured: Array<{
    degree: number;
    rhythm: MotifRhythmStep;
    dynamic: number;
  }> = [];

  for (
    let offsetBeat = 0;
    offsetBeat < beatsPerBar - Number.EPSILON;
    offsetBeat = roundBeat(offsetBeat + pattern.subdivisionBeats)
  ) {
    const absoluteBeat = roundBeat(startBeat + offsetBeat);
    const stepIndex = Math.round(absoluteBeat / pattern.subdivisionBeats) % pattern.events.length;
    const event = pattern.events[stepIndex] ?? null;
    if (!event || event.playerId !== playerId) continue;
    captured.push({
      degree: Math.trunc(event.scaleDegree),
      rhythm: {
        startBeat: roundBeat(offsetBeat),
        durationBeats: roundBeat(
          clamp(event.durationBeats, pattern.subdivisionBeats, beatsPerBar),
        ),
      },
      dynamic: roundUnit(event.velocity),
    });
  }

  if (captured.length < minNotes) return undefined;
  const notes = captured.slice(0, maxNotes);
  const safeBarIndex = Math.max(0, Math.trunc(barIndex));

  return {
    id: `${playerId}-bar-${safeBarIndex}`,
    playerId,
    barIndex: safeBarIndex,
    degrees: notes.map((note) => note.degree),
    rhythm: notes.map((note) => note.rhythm),
    dynamics: notes.map((note) => note.dynamic),
  };
}

export function remember(memory: MotifMemory, motif: Motif | undefined): MotifMemory {
  if (!motif) return cloneMotifMemory(memory);
  const capacity = Math.max(1, Math.trunc(memory.capacity));
  const pool = [...memory.pool.map(cloneMotif), cloneMotif(motif)].slice(-capacity);
  return {
    capacity,
    pool,
  };
}

export function latest(memory: MotifMemory, playerId: string): Motif | undefined {
  for (let index = memory.pool.length - 1; index >= 0; index -= 1) {
    const motif = memory.pool[index];
    if (motif?.playerId === playerId) return cloneMotif(motif);
  }
  return undefined;
}

export function vary(
  motif: Motif,
  op: MotifVariationOp,
  context: MotifVariationContext,
): MotifVariation {
  const selectedIndexes = selectIndexesForVariation(motif, op, context.maxNotes);
  const selectedDegrees = selectedIndexes.map((index) => Math.trunc(motif.degrees[index] ?? 0));
  const transformed = transformDegrees(selectedDegrees, op);
  const degrees = transposeTowardChordRoot(transformed, context.chordRoot);
  const rhythm = simplifyRhythm(
    selectedIndexes.map((index) => motif.rhythm[index] ?? { startBeat: 0, durationBeats: 0.5 }),
    degrees.length,
    positiveNumber(context.subdivisionBeats, DEFAULT_BASS_SUBDIVISION_BEATS),
  );
  const dynamics = selectedIndexes.map((index) => roundUnit(motif.dynamics[index] ?? 0.4));

  return {
    sourceBar: motif.barIndex,
    op,
    chordRoot: normalizeDegree(context.chordRoot),
    degrees,
    rhythm,
    dynamics,
  };
}

export function chooseVariationOp(seed: number, barIndex: number): MotifVariationOp {
  const value = mixUnsigned(seed, Math.trunc(barIndex));
  const ops: readonly MotifVariationOp[] = ["quote", "invert", "thin"];
  return ops[value % ops.length] ?? "quote";
}

export function chordRootAtBar(barIndex: number, mode = "mixolydian"): number {
  const cycles: Record<string, readonly number[]> = MODE_ROOT_CYCLES;
  const cycle = cycles[mode] ?? MODE_ROOT_CYCLES.mixolydian;
  const tonic = normalizeDegree(cycle[0] ?? 0);
  const contrast = normalizeDegree(cycle[2] ?? cycle[1] ?? 4);
  return Math.trunc(barIndex) % 2 === 0 ? tonic : contrast;
}

export function cloneMotifMemory(memory: MotifMemory): MotifMemory {
  return {
    capacity: memory.capacity,
    pool: memory.pool.map(cloneMotif),
  };
}

function selectIndexesForVariation(
  motif: Motif,
  op: MotifVariationOp,
  maxNotes: number | undefined,
): number[] {
  const sourceIndexes = motif.degrees.map((_, index) => index);
  const limit = Math.max(1, Math.min(sourceIndexes.length, Math.trunc(maxNotes ?? sourceIndexes.length)));
  if (op === "thin") {
    return selectStrongestIndexes(motif, Math.min(3, limit));
  }
  if (limit >= sourceIndexes.length) return sourceIndexes;
  return sampleContourIndexes(sourceIndexes.length, limit);
}

function selectStrongestIndexes(motif: Motif, count: number): number[] {
  return motif.degrees
    .map((_, index) => ({
      index,
      strength: (motif.dynamics[index] ?? 0) * 2 + (motif.rhythm[index]?.durationBeats ?? 0),
    }))
    .sort((left, right) => right.strength - left.strength || left.index - right.index)
    .slice(0, count)
    .map((entry) => entry.index)
    .sort((left, right) => left - right);
}

function sampleContourIndexes(length: number, count: number): number[] {
  if (count >= length) {
    return Array.from({ length }, (_, index) => index);
  }
  if (count === 1) return [0];
  const indexes = new Set<number>([0, length - 1]);
  for (let step = 1; indexes.size < count; step += 1) {
    indexes.add(Math.round((step * (length - 1)) / (count - 1)));
  }
  return [...indexes].sort((left, right) => left - right).slice(0, count);
}

function transformDegrees(degrees: readonly number[], op: MotifVariationOp): readonly number[] {
  if (degrees.length === 0) return [];
  if (op !== "invert") return degrees.map((degree) => Math.trunc(degree));
  const pivot = Math.trunc(degrees[0] ?? 0);
  return degrees.map((degree) => pivot - (Math.trunc(degree) - pivot));
}

function transposeTowardChordRoot(
  degrees: readonly number[],
  chordRoot: number,
): readonly number[] {
  if (degrees.length === 0) return [];
  const firstClass = normalizeDegree(degrees[0] ?? 0);
  const targetClass = normalizeDegree(chordRoot);
  let delta = targetClass - firstClass;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  return degrees.map((degree) => Math.trunc(degree + delta));
}

function simplifyRhythm(
  rhythm: readonly MotifRhythmStep[],
  count: number,
  subdivisionBeats: number,
): readonly MotifRhythmStep[] {
  if (count <= 0) return [];
  const snapped = rhythm.slice(0, count).map((step) => ({
    startBeat: clamp(
      roundToGrid(step.startBeat, subdivisionBeats),
      0,
      DEFAULT_BEATS_PER_BAR - subdivisionBeats,
    ),
    durationBeats: clamp(
      roundToGrid(step.durationBeats, subdivisionBeats),
      subdivisionBeats,
      1,
    ),
  }));
  if (hasStrictlyIncreasingStarts(snapped)) return snapped.map(roundRhythmStep);
  return fallbackBassRhythm(count, subdivisionBeats).map(roundRhythmStep);
}

function fallbackBassRhythm(count: number, subdivisionBeats: number): readonly MotifRhythmStep[] {
  const span = DEFAULT_BEATS_PER_BAR - subdivisionBeats;
  return Array.from({ length: count }, (_, index) => {
    const startBeat = count === 1
      ? 0
      : roundToGrid((span * index) / (count - 1), subdivisionBeats);
    return {
      startBeat: clamp(startBeat, 0, span),
      durationBeats: subdivisionBeats,
    };
  });
}

function hasStrictlyIncreasingStarts(steps: readonly MotifRhythmStep[]): boolean {
  for (let index = 1; index < steps.length; index += 1) {
    if ((steps[index]?.startBeat ?? 0) <= (steps[index - 1]?.startBeat ?? 0)) {
      return false;
    }
  }
  return true;
}

function getPatternPlayerId(pattern: PlayerPatternSource): string | undefined {
  return pattern.events.find((event): event is PatternNoteSource => event !== null)?.playerId;
}

function cloneMotif(motif: Motif): Motif {
  return {
    id: motif.id,
    playerId: motif.playerId,
    barIndex: motif.barIndex,
    degrees: [...motif.degrees],
    rhythm: motif.rhythm.map((step) => ({ ...step })),
    dynamics: [...motif.dynamics],
  };
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function mixUnsigned(seed: number, barIndex: number): number {
  let value = (seed >>> 0) ^ Math.imul((barIndex + 1) >>> 0, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function roundRhythmStep(step: MotifRhythmStep): MotifRhythmStep {
  return {
    startBeat: roundBeat(step.startBeat),
    durationBeats: roundBeat(step.durationBeats),
  };
}

function roundToGrid(value: number, grid: number): number {
  return roundBeat(Math.round(value / grid) * grid);
}

function roundBeat(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function roundUnit(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}
