import type { StoredCandidate } from "./candidate-store";
import type { PlayerPatternSource } from "./song-material";

const PHRASE_SCORE_KEYS = [
  "richness",
  "anacrusis",
  "questionAnswer",
  "anchorContrast",
] as const;

const SCALE_LENGTH = 7;

export interface CandidateDiversityMetrics {
  melodicInterest: number;
  intervalVariety: number;
  registerBreadth: number;
  pitchClassDiversity: number;
  novelty: number;
  interestingness: number;
}

export function calculateCandidateDiversityMetrics(
  candidate: StoredCandidate,
  keptCandidates: readonly StoredCandidate[] = [],
): CandidateDiversityMetrics {
  const phrase = candidate.genome as unknown as PlayerPatternSource;
  const positions = Array.isArray(phrase.events)
    ? phrase.events
        .filter((event): event is NonNullable<typeof event> => Boolean(event))
        .map((event) => event.octave * SCALE_LENGTH + event.scaleDegree)
    : [];
  const pitchClasses = positions.map((position) => positiveModulo(position, SCALE_LENGTH));
  const intervals = positions.slice(1).map((position, index) => position - positions[index]);
  const intervalVariety = scoreDistinctCount(intervals, Math.min(8, Math.max(1, intervals.length)));
  const registerBreadth = positions.length > 0
    ? clamp01((Math.max(...positions) - Math.min(...positions)) / 12)
    : 0;
  const pitchClassDiversity = scoreDistinctCount(pitchClasses, SCALE_LENGTH);
  const melodicInterest = clamp01(
    intervalVariety * 0.4 +
    registerBreadth * 0.3 +
    pitchClassDiversity * 0.3,
  );
  const novelty = calculateNovelty(candidate, keptCandidates);

  return {
    melodicInterest: roundTo(melodicInterest, 6),
    intervalVariety: roundTo(intervalVariety, 6),
    registerBreadth: roundTo(registerBreadth, 6),
    pitchClassDiversity: roundTo(pitchClassDiversity, 6),
    novelty: roundTo(novelty, 6),
    interestingness: roundTo(clamp01(melodicInterest * 0.75 + novelty * 0.25), 6),
  };
}

export function calculateProsodyScoreDistance(
  left: Pick<StoredCandidate, "scores">,
  right: Pick<StoredCandidate, "scores">,
): number {
  const sumSquares = PHRASE_SCORE_KEYS.reduce((sum, key) => {
    const delta = readScore(left, key) - readScore(right, key);
    return sum + delta * delta;
  }, 0);
  return roundTo(Math.sqrt(sumSquares), 6);
}

export function calculateMeanPairwiseProsodyDistance(candidates: readonly StoredCandidate[]): number {
  if (candidates.length < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      sum += calculateProsodyScoreDistance(candidates[leftIndex], candidates[rightIndex]);
      count += 1;
    }
  }
  return roundTo(sum / count, 6);
}

function calculateNovelty(
  candidate: StoredCandidate,
  keptCandidates: readonly StoredCandidate[],
): number {
  if (keptCandidates.length === 0) return 1;
  const distances = keptCandidates
    .filter((kept) => kept.id !== candidate.id)
    .map((kept) => calculateProsodyScoreDistance(candidate, kept))
    .sort((left, right) => left - right);
  if (distances.length === 0) return 1;
  const nearest = distances.slice(0, Math.min(3, distances.length));
  const meanDistance = nearest.reduce((sum, distance) => sum + distance, 0) / nearest.length;
  return clamp01(meanDistance / 0.8);
}

function readScore(candidate: Pick<StoredCandidate, "scores">, key: typeof PHRASE_SCORE_KEYS[number]): number {
  const value = candidate.scores[key];
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function scoreDistinctCount(values: readonly number[], maximum: number): number {
  if (values.length === 0 || maximum <= 0) return 0;
  return clamp01(new Set(values).size / maximum);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
