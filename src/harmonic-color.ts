import type { MotifVariation, MotifVariationOp } from "./motif-memory";
import { MODE_INTERVALS } from "./tonal-context";

export type InterplayColorRole = "anchor" | "chord-tone" | "passing" | "tension";
export type InterplayHarmonicRole = "root" | "third" | "fifth" | "non-chord";
export type InterplayChromaticOffset = -1 | 0 | 1;

export interface InterplayColorDecision {
  chromaticOffset: InterplayChromaticOffset;
  colorRole: InterplayColorRole;
  harmonicRole: InterplayHarmonicRole;
  tags: readonly string[];
  velocityMultiplier: number;
}

export interface InterplayColorContext {
  chordRoot: number;
  mode: string;
  op: MotifVariationOp;
  tension: number;
}

export function colorInterplayVariation(
  variation: MotifVariation,
  context: InterplayColorContext,
): readonly InterplayColorDecision[] {
  return variation.degrees.map((degree, index) =>
    colorInterplayAnswerDegree({
      ...context,
      degree,
      noteCount: variation.degrees.length,
      noteIndex: index,
    })
  );
}

export function colorInterplayAnswerDegree(input: InterplayColorContext & {
  degree: number;
  noteCount: number;
  noteIndex: number;
}): InterplayColorDecision {
  const harmonicRole = getHarmonicRole(input.degree, input.chordRoot);
  const isLanding = input.noteIndex === Math.max(0, input.noteCount - 1);
  const chromaticOffset = shouldLeanChromatic(input, harmonicRole, isLanding)
    ? chooseChromaticOffset(input.degree, input.mode, input.op, input.chordRoot)
    : 0;
  const colorRole = getColorRole(harmonicRole, chromaticOffset, isLanding);
  const tags = [
    `interplay-color:${colorRole}`,
    `interplay-harmony:${harmonicRole}`,
    ...(chromaticOffset === 0 ? [] : [`interplay-chromatic:${formatSigned(chromaticOffset)}`]),
    ...(isLanding ? ["interplay-resolution:landing"] : []),
  ];

  return {
    chromaticOffset,
    colorRole,
    harmonicRole,
    tags,
    velocityMultiplier: chromaticOffset === 0 ? 1 : 1.08,
  };
}

function shouldLeanChromatic(
  input: {
    noteCount: number;
    noteIndex: number;
    tension: number;
  },
  harmonicRole: InterplayHarmonicRole,
  isLanding: boolean,
): boolean {
  if (isLanding || input.noteCount <= 1) return false;
  const leanIndex = input.noteCount === 2 ? 0 : 1;
  if (input.noteIndex !== leanIndex) return false;
  if (input.tension >= 0.62) return true;
  return input.tension >= 0.48 && harmonicRole === "non-chord";
}

function getColorRole(
  harmonicRole: InterplayHarmonicRole,
  chromaticOffset: InterplayChromaticOffset,
  isLanding: boolean,
): InterplayColorRole {
  if (chromaticOffset !== 0) return "tension";
  if (isLanding && harmonicRole === "root") return "anchor";
  if (harmonicRole === "root" || harmonicRole === "third" || harmonicRole === "fifth") return "chord-tone";
  return "passing";
}

function getHarmonicRole(degree: number, chordRoot: number): InterplayHarmonicRole {
  const relative = normalizeDegree(Math.trunc(degree) - Math.trunc(chordRoot));
  if (relative === 0) return "root";
  if (relative === 2) return "third";
  if (relative === 4) return "fifth";
  return "non-chord";
}

function chooseChromaticOffset(
  degree: number,
  mode: string,
  op: MotifVariationOp,
  chordRoot: number,
): InterplayChromaticOffset {
  const preferred = ((Math.trunc(degree) + Math.trunc(chordRoot) + op.length) % 2 === 0)
    ? 1
    : -1;
  const alternate = preferred === 1 ? -1 : 1;
  if (createsOutsideColor(degree, mode, preferred)) return preferred;
  if (createsOutsideColor(degree, mode, alternate)) return alternate;
  return preferred;
}

function createsOutsideColor(degree: number, mode: string, offset: InterplayChromaticOffset): boolean {
  const intervals = getModeIntervals(mode);
  const scaleDegree = normalizeDegree(degree);
  const baseSemitone = intervals[scaleDegree] ?? 0;
  const coloredSemitone = normalizeSemitone(baseSemitone + offset);
  return !intervals.some((interval) => normalizeSemitone(interval) === coloredSemitone);
}

function getModeIntervals(mode: string): readonly number[] {
  const intervalsByMode: Record<string, readonly number[]> = MODE_INTERVALS;
  return intervalsByMode[mode] ?? MODE_INTERVALS.mixolydian;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function normalizeSemitone(semitone: number): number {
  return ((Math.trunc(semitone) % 12) + 12) % 12;
}

function formatSigned(offset: InterplayChromaticOffset): string {
  return offset > 0 ? `+${offset}` : `${offset}`;
}
