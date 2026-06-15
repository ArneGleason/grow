import type { Candidate, CandidateKind, CandidateScores } from "./candidate-store";

export type CandidateFitnessWeights = Record<string, number>;

export interface CandidateFitnessOptions {
  kind?: CandidateKind;
  weights?: CandidateFitnessWeights;
  missingScore?: number;
}

export interface CandidateFitnessContribution {
  key: string;
  score: number;
  weight: number;
  normalizedWeight: number;
  weightedScore: number;
  missing: boolean;
}

export interface CandidateFitnessResult {
  fitness: number;
  totalWeight: number;
  missingScore: number;
  contributions: readonly CandidateFitnessContribution[];
  ignoredScoreKeys: readonly string[];
  summary: string;
}

export interface CandidateFitnessPreview {
  candidate: Candidate;
  fitness: CandidateFitnessResult;
}

// First-pass fitness weights. These are a tunable ruler, not permanent musical truth.
export const DEFAULT_CANDIDATE_FITNESS_WEIGHTS: CandidateFitnessWeights = Object.freeze({
  landing: 0.16,
  monotony: 0.12,
  surprise: 0.12,
  harmony: 0.12,
  energy: 0.08,
  proportion: 0.08,
  motif: 0.12,
  cadence: 0.12,
  goal: 0.08,
});

export const PHRASE_CANDIDATE_FITNESS_WEIGHTS: CandidateFitnessWeights = Object.freeze({
  richness: 0.3,
  anacrusis: 0.15,
  questionAnswer: 0.35,
  anchorContrast: 0.2,
});

const DEFAULT_MISSING_SCORE = 0;
const PHRASE_SCORE_KEYS = new Set(Object.keys(PHRASE_CANDIDATE_FITNESS_WEIGHTS));
const DEFAULT_SCORE_KEYS = new Set(Object.keys(DEFAULT_CANDIDATE_FITNESS_WEIGHTS));

export function aggregateCandidateFitness(
  scores: CandidateScores,
  options: CandidateFitnessOptions = {},
): CandidateFitnessResult {
  const fallbackWeights = getDefaultWeightsForScores(scores, options.kind);
  const weights = normalizeWeights(options.weights ?? fallbackWeights, fallbackWeights);
  const missingScore = clamp01(options.missingScore ?? DEFAULT_MISSING_SCORE);
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const contributions = Object.entries(weights)
    .map(([key, weight]) => {
      const hasScore = Object.prototype.hasOwnProperty.call(scores, key);
      const score = hasScore ? clamp01(scores[key]) : missingScore;
      const normalizedWeight = totalWeight > 0 ? weight / totalWeight : 0;
      return {
        key,
        score,
        weight: roundTo(weight, 6),
        normalizedWeight: roundTo(normalizedWeight, 6),
        weightedScore: roundTo(score * normalizedWeight, 6),
        missing: !hasScore,
      } satisfies CandidateFitnessContribution;
    });
  const fitness = roundTo(
    contributions.reduce((sum, contribution) => sum + contribution.weightedScore, 0),
    6,
  );
  const weightedKeys = new Set(Object.keys(weights));
  const ignoredScoreKeys = Object.keys(scores)
    .filter((key) => !weightedKeys.has(key))
    .sort((left, right) => left.localeCompare(right));

  return {
    fitness,
    totalWeight: roundTo(totalWeight, 6),
    missingScore,
    contributions,
    ignoredScoreKeys,
    summary: `fitness ${fitness.toFixed(3)} from ${contributions.length} weighted score(s)`,
  };
}

export function previewCandidateFitness(
  candidate: Candidate,
  options: CandidateFitnessOptions = {},
): CandidateFitnessPreview {
  const fitness = aggregateCandidateFitness(candidate.scores, {
    ...options,
    kind: options.kind ?? candidate.kind,
  });
  return {
    candidate: {
      ...candidate,
      scores: { ...candidate.scores },
      fitness: fitness.fitness,
    },
    fitness,
  };
}

function getDefaultWeightsForScores(
  scores: CandidateScores,
  kind?: CandidateKind,
): CandidateFitnessWeights {
  if (kind === "phrase") return PHRASE_CANDIDATE_FITNESS_WEIGHTS;

  const keys = Object.keys(scores);
  const hasPhraseScore = keys.some((key) => PHRASE_SCORE_KEYS.has(key));
  const hasDefaultScore = keys.some((key) => DEFAULT_SCORE_KEYS.has(key));
  if (hasPhraseScore && !hasDefaultScore) return PHRASE_CANDIDATE_FITNESS_WEIGHTS;

  return DEFAULT_CANDIDATE_FITNESS_WEIGHTS;
}

function normalizeWeights(
  weights: CandidateFitnessWeights,
  fallbackWeights: CandidateFitnessWeights,
): CandidateFitnessWeights {
  const normalized = Object.fromEntries(
    Object.entries(weights)
      .filter(([, weight]) => Number.isFinite(weight) && weight > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, weight]) => [key, Math.min(100, weight)]),
  );
  return Object.keys(normalized).length > 0
    ? normalized
    : { ...fallbackWeights };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundTo(Math.min(1, Math.max(0, value)), 6);
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
