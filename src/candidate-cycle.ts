import type {
  CandidateDevelopmentMutation,
  CandidateDevelopmentOptions,
  CandidateDevelopmentResult,
  CandidateInput,
  CandidateKind,
  CandidateProsodyDevelopmentOperator,
  CandidateScores,
  CandidateSelectionOptions,
  CandidateSelectionResult,
  StoredCandidate,
} from "./candidate-store";
import { aggregateCandidateFitness } from "./candidate-fitness";
import {
  alterCadence,
  reFoot,
  shiftAnacrusis,
  varyContour,
  type AnacrusisVariation,
  type CadenceVariation,
  type ContourVariation,
} from "./prosody-development";
import { produceProsodyCandidates } from "./prosody-candidates";
import { scoreProsody } from "./prosody-scoring";
import type { PlayerPatternSource } from "./song-material";

export interface CandidateCycleOptions {
  seed: number;
  kind: "phrase";
  eliteLimit?: number;
  count?: number;
  branchId?: string;
}

export interface CandidateEvolutionOptions extends CandidateCycleOptions {
  generations?: number;
}

export interface CandidateCyclePersistence {
  writeCandidate(candidate: CandidateInput, branchId?: string): Promise<StoredCandidate>;
  listCandidates(options?: {
    kind?: CandidateKind;
    status?: StoredCandidate["status"];
    branchId?: string;
    limit?: number;
  }): Promise<readonly StoredCandidate[]>;
  scoreCandidate(
    candidateId: string,
    scores: CandidateScores,
    fitness: number,
    branchId?: string,
  ): Promise<StoredCandidate>;
  selectCandidates(options: CandidateSelectionOptions): Promise<CandidateSelectionResult>;
  developCandidate(options: CandidateDevelopmentOptions): Promise<CandidateDevelopmentResult>;
}

export interface CandidateCycleCandidateSummary {
  id: string;
  kind: CandidateKind;
  fitness: number;
  scores: CandidateScores;
  generation: number;
  seed: number;
  status: StoredCandidate["status"];
  parentId?: string;
}

export interface CandidateCycleChildSummary extends CandidateCycleCandidateSummary {
  parentId: string;
  mutation: CandidateDevelopmentMutation;
}

export interface CandidateCycleResult {
  kind: "phrase";
  branchId: string;
  seed: number;
  count: number;
  eliteLimit: number;
  generation: number;
  produced: readonly CandidateCycleCandidateSummary[];
  elite: readonly CandidateCycleCandidateSummary[];
  purged: readonly CandidateCycleCandidateSummary[];
  children: readonly CandidateCycleChildSummary[];
}

export interface CandidateEvolutionGenerationSummary {
  generation: number;
  seed: number;
  topFitness: number;
  meanEliteFitness: number;
  eliteCount: number;
  populationSize: number;
}

export interface CandidateEvolutionResult {
  kind: "phrase";
  branchId: string;
  seed: number;
  generations: number;
  count: number;
  eliteLimit: number;
  summaries: readonly CandidateEvolutionGenerationSummary[];
  finalElite: readonly CandidateCycleCandidateSummary[];
}

const DEFAULT_CYCLE_COUNT = 8;
const DEFAULT_ELITE_LIMIT = 3;
const DEFAULT_EVOLUTION_GENERATIONS = 3;
const MAX_CYCLE_COUNT = 64;
const MAX_ELITE_LIMIT = 24;
const MAX_EVOLUTION_GENERATIONS = 12;

export async function runCandidateCycle(
  options: CandidateCycleOptions,
  persistence: CandidateCyclePersistence,
): Promise<CandidateCycleResult> {
  if (options.kind !== "phrase") {
    throw new Error("Candidate cycle D1 only supports phrase candidates");
  }

  const seed = normalizeSeed(options.seed);
  const count = normalizePositiveInteger(options.count, DEFAULT_CYCLE_COUNT, MAX_CYCLE_COUNT);
  const eliteLimit = normalizePositiveInteger(options.eliteLimit, DEFAULT_ELITE_LIMIT, MAX_ELITE_LIMIT);
  const branchId = normalizeBranchId(options.branchId);
  const producedCandidates = produceProsodyCandidates({ seed, count });
  const scoredProduced: StoredCandidate[] = [];

  for (const candidate of producedCandidates) {
    const fitness = aggregateCandidateFitness(candidate.scores, { kind: candidate.kind }).fitness;
    const written = await persistence.writeCandidate(candidate, branchId);
    const scored = needsFitnessUpdate(written, candidate.scores, fitness)
      ? await persistence.scoreCandidate(written.id, candidate.scores, fitness, branchId)
      : written;
    scoredProduced.push(scored);
  }

  // Diversity seam for Track D: replace strict fitness-only selection here with
  // a novelty reservoir or fitness+novelty blend once convergence is observable.
  const shouldSelect = scoredProduced.some((candidate) => candidate.status === "alive");
  const selection = shouldSelect
    ? await persistence.selectCandidates({ kind: "phrase", eliteLimit, branchId })
    : await readExistingSelection(persistence, branchId, eliteLimit);

  const children: CandidateCycleChildSummary[] = [];
  for (const elite of selection.elite) {
    const mutation = createProsodyDevelopmentMutation(elite);
    if (!mutation) continue;

    let developed: CandidateDevelopmentResult;
    try {
      developed = await persistence.developCandidate({
        parentId: elite.id,
        branchId,
        seed: createDevelopmentSeed(elite, mutation),
        mutation,
      });
    } catch (error) {
      if (isNoOpDevelopmentError(error)) continue;
      throw error;
    }

    const scoredChild = await scoreStoredPhraseCandidate(developed.child, persistence, branchId);
    children.push({
      ...summarizeCandidate(scoredChild),
      parentId: elite.id,
      mutation: developed.mutation,
    });
  }

  const finalCandidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const finalById = new Map(finalCandidates.map((candidate) => [candidate.id, candidate]));
  const produced = scoredProduced.map((candidate) =>
    summarizeCandidate(finalById.get(candidate.id) ?? candidate)
  );
  const elite = selection.elite.map((candidate) =>
    summarizeCandidate(finalById.get(candidate.id) ?? candidate)
  );
  const purged = selection.purged.map((candidate) =>
    summarizeCandidate(finalById.get(candidate.id) ?? candidate)
  );
  const generation = Math.max(
    0,
    ...produced.map((candidate) => candidate.generation),
    ...elite.map((candidate) => candidate.generation),
    ...children.map((candidate) => candidate.generation),
  );

  return {
    kind: "phrase",
    branchId,
    seed,
    count: producedCandidates.length,
    eliteLimit,
    generation,
    produced,
    elite,
    purged,
    children,
  };
}

export async function runEvolution(
  options: CandidateEvolutionOptions,
  persistence: CandidateCyclePersistence,
): Promise<CandidateEvolutionResult> {
  if (options.kind !== "phrase") {
    throw new Error("Candidate evolution D3 only supports phrase candidates");
  }

  const seed = normalizeSeed(options.seed);
  const count = normalizePositiveInteger(options.count, DEFAULT_CYCLE_COUNT, MAX_CYCLE_COUNT);
  const eliteLimit = normalizePositiveInteger(options.eliteLimit, DEFAULT_ELITE_LIMIT, MAX_ELITE_LIMIT);
  const generations = normalizePositiveInteger(
    options.generations,
    DEFAULT_EVOLUTION_GENERATIONS,
    MAX_EVOLUTION_GENERATIONS,
  );
  const branchId = normalizeBranchId(options.branchId);
  const summaries: CandidateEvolutionGenerationSummary[] = [];

  for (let generationIndex = 0; generationIndex < generations; generationIndex += 1) {
    const generationSeed = createGenerationSeed(seed, generationIndex);
    await runCandidateCycle({
      seed: generationSeed,
      kind: "phrase",
      count,
      eliteLimit,
      branchId,
    }, persistence);
    summaries.push(await summarizeEvolutionGeneration(
      persistence,
      branchId,
      generationIndex + 1,
      generationSeed,
      eliteLimit,
    ));
  }

  const finalElite = await readRankedElite(persistence, branchId, eliteLimit);

  return {
    kind: "phrase",
    branchId,
    seed,
    generations,
    count,
    eliteLimit,
    summaries,
    finalElite: finalElite.map(summarizeCandidate),
  };
}

async function scoreStoredPhraseCandidate(
  candidate: StoredCandidate,
  persistence: CandidateCyclePersistence,
  branchId: string,
): Promise<StoredCandidate> {
  const score = scoreProsody(candidate.genome as unknown as PlayerPatternSource, [4, 4]);
  const scores = { ...score.subscores };
  const fitness = aggregateCandidateFitness(scores, { kind: "phrase" }).fitness;
  return needsFitnessUpdate(candidate, scores, fitness)
    ? persistence.scoreCandidate(candidate.id, scores, fitness, branchId)
    : candidate;
}

async function summarizeEvolutionGeneration(
  persistence: CandidateCyclePersistence,
  branchId: string,
  generation: number,
  seed: number,
  eliteLimit: number,
): Promise<CandidateEvolutionGenerationSummary> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const activeCandidates = candidates.filter((candidate) => candidate.status !== "purged");
  const elite = await readRankedElite(persistence, branchId, eliteLimit);
  const topFitness = activeCandidates.reduce(
    (best, candidate) => Math.max(best, candidate.fitness),
    0,
  );
  const meanEliteFitness = elite.length > 0
    ? elite.reduce((sum, candidate) => sum + candidate.fitness, 0) / elite.length
    : 0;

  return {
    generation,
    seed,
    topFitness: roundTo(topFitness, 6),
    meanEliteFitness: roundTo(meanEliteFitness, 6),
    eliteCount: elite.length,
    populationSize: activeCandidates.length,
  };
}

async function readRankedElite(
  persistence: CandidateCyclePersistence,
  branchId: string,
  eliteLimit: number,
): Promise<readonly StoredCandidate[]> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    status: "elite",
    branchId,
    limit: 500,
  });
  return [...candidates].sort(rankCandidate).slice(0, eliteLimit);
}

function createGenerationSeed(seed: number, generationIndex: number): number {
  return hashText(`${seed}:d3-generation:${generationIndex}`);
}

function isNoOpDevelopmentError(error: unknown): boolean {
  return error instanceof Error && /did not change the genome|unchanged genome|no-op/i.test(error.message);
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

async function readExistingSelection(
  persistence: CandidateCyclePersistence,
  branchId: string,
  eliteLimit: number,
): Promise<CandidateSelectionResult> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const ranked = [...candidates]
    .filter((candidate) => candidate.status !== "purged")
    .sort(rankCandidate);
  const elite = ranked
    .filter((candidate) => candidate.status === "elite")
    .slice(0, eliteLimit);
  const purged = candidates
    .filter((candidate) => candidate.status === "purged")
    .sort(rankCandidate);
  return {
    kind: "phrase",
    branchId,
    eliteLimit,
    evaluatedCount: ranked.length,
    elite,
    purged,
  };
}

function createProsodyDevelopmentMutation(elite: StoredCandidate): CandidateDevelopmentMutation | undefined {
  const phrase = elite.genome as unknown as PlayerPatternSource;
  const choices = createProsodyDevelopmentChoices(elite, phrase);
  const original = stableJson(phrase);
  for (const choice of choices) {
    if (stableJson(choice.genome) !== original) {
      return {
        type: "phrase.replace",
        operator: choice.operator,
        genome: choice.genome,
      };
    }
  }

  const fallback = varyContour(phrase, "transposeUp");
  if (stableJson(fallback) === original) return undefined;

  return {
    type: "phrase.replace",
    operator: { type: "varyContour", action: "transposeUp" },
    genome: fallback,
  };
}

function createProsodyDevelopmentChoices(
  elite: StoredCandidate,
  phrase: PlayerPatternSource,
): readonly {
  operator: CandidateProsodyDevelopmentOperator;
  genome: PlayerPatternSource;
}[] {
  const hash = hashText(`${elite.id}:${elite.seed}:${elite.generation}:d1b-prosody`);
  const contourActions: readonly ContourVariation[] = [
    "invert",
    "retrograde",
    "transposeUp",
    "transposeDown",
    "narrow",
    "widen",
  ];
  const cadenceActions: readonly CadenceVariation[] = [
    "question-to-answer",
    "answer-to-question",
    "extend-cadence",
    "shift-accent",
  ];
  const anacrusisActions: readonly AnacrusisVariation[] = [
    "add",
    "remove",
    "lengthen",
    "shorten",
  ];
  const reFootSeed = hashText(`${elite.id}:${elite.seed}:reFoot`);
  const choices = [
    {
      operator: { type: "reFoot", seed: reFootSeed },
      genome: reFoot(phrase, reFootSeed),
    },
    {
      operator: {
        type: "varyContour",
        action: contourActions[(hash >>> 3) % contourActions.length],
      },
      genome: varyContour(phrase, contourActions[(hash >>> 3) % contourActions.length]),
    },
    {
      operator: {
        type: "alterCadence",
        action: cadenceActions[(hash >>> 7) % cadenceActions.length],
      },
      genome: alterCadence(phrase, cadenceActions[(hash >>> 7) % cadenceActions.length]),
    },
    {
      operator: {
        type: "shiftAnacrusis",
        action: anacrusisActions[(hash >>> 11) % anacrusisActions.length],
      },
      genome: shiftAnacrusis(phrase, anacrusisActions[(hash >>> 11) % anacrusisActions.length]),
    },
  ] satisfies readonly {
    operator: CandidateProsodyDevelopmentOperator;
    genome: PlayerPatternSource;
  }[];
  return rotateArray(choices, hash % choices.length);
}

function createDevelopmentSeed(
  elite: StoredCandidate,
  mutation: CandidateDevelopmentMutation,
): number {
  return hashText(`${elite.id}:${elite.seed}:${elite.generation}:${stableJson(mutation)}:d1-child`);
}

function needsFitnessUpdate(
  candidate: StoredCandidate,
  scores: CandidateScores,
  fitness: number,
): boolean {
  if (Math.abs(candidate.fitness - fitness) > 0.0000005) return true;
  return stableJson(candidate.scores) !== stableJson(scores);
}

function summarizeCandidate(candidate: StoredCandidate): CandidateCycleCandidateSummary {
  return {
    id: candidate.id,
    kind: candidate.kind,
    fitness: candidate.fitness,
    scores: { ...candidate.scores },
    generation: candidate.generation,
    seed: candidate.seed,
    status: candidate.status,
    parentId: candidate.parentId,
  };
}

function rankCandidate(left: StoredCandidate, right: StoredCandidate): number {
  return right.fitness - left.fitness ||
    left.generation - right.generation ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id);
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(0xffffffff, Math.max(0, Math.trunc(value)));
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(maximum, Math.trunc(value));
}

function normalizeBranchId(value: string | undefined): string {
  if (!value) return "main";
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(value) ? value : "main";
}

function rotateArray<T>(value: readonly T[], steps: number): readonly T[] {
  if (value.length === 0) return value;
  const offset = ((steps % value.length) + value.length) % value.length;
  if (offset === 0) return value;
  return [
    ...value.slice(value.length - offset),
    ...value.slice(0, value.length - offset),
  ];
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
