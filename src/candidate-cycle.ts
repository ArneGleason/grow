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
import {
  calculateCandidateDiversityMetrics,
  calculateMeanPairwiseProsodyDistance,
  calculateProsodyScoreDistance,
} from "./candidate-diversity";
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
import {
  createAnchorPhraseCandidateGenomeFromPattern,
  isAnchorPhraseCandidateGenome,
  normalizePhraseCandidateGenome,
  renderPhraseCandidateGenome,
} from "./phrase-candidate-genome";
import type { PlayerPatternSource } from "./song-material";

export interface CandidateCycleOptions {
  seed: number;
  kind: "phrase";
  eliteLimit?: number;
  count?: number;
  branchId?: string;
  diversity?: CandidateDiversityOptions;
}

export interface CandidateEvolutionOptions extends CandidateCycleOptions {
  generations?: number;
  startGenerationIndex?: number;
}

export interface CandidateDiversityOptions {
  enabled?: boolean;
  fitnessEliteLimit?: number;
  minDistance?: number;
  reservoirLimit?: number;
  reservoirParentFraction?: number;
  interestingnessThreshold?: number;
}

export interface CandidateDiversityConfig {
  enabled: boolean;
  fitnessEliteLimit: number;
  minDistance: number;
  reservoirLimit: number;
  reservoirParentFraction: number;
  interestingnessThreshold: number;
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
  retainCandidates?(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
  reserveCandidates?(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
  purgeCandidates?(candidateIds: readonly string[], branchId?: string): Promise<readonly StoredCandidate[]>;
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
  reserved?: readonly CandidateCycleCandidateSummary[];
  purged: readonly CandidateCycleCandidateSummary[];
  children: readonly CandidateCycleChildSummary[];
  diversity?: CandidateCycleDiversitySummary;
}

export interface CandidateEvolutionGenerationSummary {
  generation: number;
  seed: number;
  topFitness: number;
  meanEliteFitness: number;
  eliteCount: number;
  populationSize: number;
  eliteMeanDistance?: number;
  reservedCount?: number;
  reservedParentChildCount?: number;
  reservoirMeanInterestingness?: number;
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
  finalReserved?: readonly CandidateCycleCandidateSummary[];
  diversity?: CandidateDiversityConfig;
}

export interface CandidateCycleDiversitySummary extends CandidateDiversityConfig {
  evaluatedCount: number;
  eliteMeanDistance: number;
  reservedCount: number;
  reservoirMeanInterestingness: number;
}

interface CandidateCycleSelectionResult {
  kind: "phrase";
  branchId: string;
  eliteLimit: number;
  evaluatedCount: number;
  elite: readonly StoredCandidate[];
  reserved: readonly StoredCandidate[];
  purged: readonly StoredCandidate[];
  diversity?: CandidateCycleDiversitySummary;
}

const DEFAULT_CYCLE_COUNT = 8;
const DEFAULT_ELITE_LIMIT = 3;
const DEFAULT_EVOLUTION_GENERATIONS = 3;
const MAX_CYCLE_COUNT = 64;
const MAX_ELITE_LIMIT = 24;
const MAX_EVOLUTION_GENERATIONS = 500;
const STORED_CANDIDATE_FITNESS_PLACES = 4;
const DEFAULT_DIVERSITY_MIN_DISTANCE = 0.18;
const DEFAULT_RESERVOIR_LIMIT = 2;
const DEFAULT_RESERVOIR_PARENT_FRACTION = 0.5;
const DEFAULT_INTERESTINGNESS_THRESHOLD = 0.42;

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
  const diversity = normalizeDiversityOptions(options.diversity, eliteLimit);
  const producedCandidates = produceProsodyCandidates({ seed, count });
  const scoredProduced: StoredCandidate[] = [];

  for (const candidate of producedCandidates) {
    const fitness = normalizeStoredCandidateFitness(
      aggregateCandidateFitness(candidate.scores, { kind: candidate.kind }).fitness,
    );
    const written = await persistence.writeCandidate(candidate, branchId);
    const scored = needsFitnessUpdate(written, candidate.scores, fitness)
      ? await persistence.scoreCandidate(written.id, candidate.scores, fitness, branchId)
      : written;
    scoredProduced.push(scored);
  }

  const shouldSelect = scoredProduced.some((candidate) => candidate.status === "alive");
  const selection = shouldSelect
    ? diversity.enabled
      ? await selectDiverseCandidates(persistence, branchId, eliteLimit, diversity)
      : await adaptSelectionResult(await persistence.selectCandidates({ kind: "phrase", eliteLimit, branchId }))
    : diversity.enabled
      ? await readExistingDiverseSelection(persistence, branchId, eliteLimit, diversity)
      : await adaptSelectionResult(await readExistingSelection(persistence, branchId, eliteLimit));

  const children: CandidateCycleChildSummary[] = [];
  const reservedParents = chooseReservedDevelopmentParents(selection.reserved, selection.elite.length, diversity);
  for (const parent of [...selection.elite, ...reservedParents]) {
    const mutation = createProsodyDevelopmentMutation(parent);
    if (!mutation) continue;

    let developed: CandidateDevelopmentResult;
    try {
      developed = await persistence.developCandidate({
        parentId: parent.id,
        branchId,
        seed: createDevelopmentSeed(parent, mutation),
        mutation,
      });
    } catch (error) {
      if (isNoOpDevelopmentError(error)) continue;
      throw error;
    }

    const scoredChild = await scoreStoredPhraseCandidate(developed.child, persistence, branchId);
    children.push({
      ...summarizeCandidate(scoredChild),
      parentId: parent.id,
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
  const reserved = selection.reserved.map((candidate) =>
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
    ...(diversity.enabled ? { reserved, diversity: selection.diversity } : {}),
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
  const startGenerationIndex = normalizeNonnegativeInteger(options.startGenerationIndex, 0, 1_000_000);
  const branchId = normalizeBranchId(options.branchId);
  const diversity = normalizeDiversityOptions(options.diversity, eliteLimit);
  const summaries: CandidateEvolutionGenerationSummary[] = [];

  for (let generationIndex = 0; generationIndex < generations; generationIndex += 1) {
    const absoluteGenerationIndex = startGenerationIndex + generationIndex;
    const generationSeed = createGenerationSeed(seed, absoluteGenerationIndex);
    const cycle = await runCandidateCycle({
      seed: generationSeed,
      kind: "phrase",
      count,
      eliteLimit,
      branchId,
      ...(diversity.enabled ? { diversity } : {}),
    }, persistence);
    summaries.push(await summarizeEvolutionGeneration(
      persistence,
      branchId,
      absoluteGenerationIndex + 1,
      generationSeed,
      eliteLimit,
      cycle,
    ));
  }

  const finalElite = await readRankedElite(persistence, branchId, eliteLimit);
  const finalReserved = diversity.enabled
    ? await readRankedReserved(persistence, branchId, diversity.reservoirLimit)
    : [];

  return {
    kind: "phrase",
    branchId,
    seed,
    generations,
    count,
    eliteLimit,
    summaries,
    finalElite: finalElite.map(summarizeCandidate),
    ...(diversity.enabled ? {
      finalReserved: finalReserved.map(summarizeCandidate),
      diversity,
    } : {}),
  };
}

async function scoreStoredPhraseCandidate(
  candidate: StoredCandidate,
  persistence: CandidateCyclePersistence,
  branchId: string,
): Promise<StoredCandidate> {
  const score = scoreProsody(renderPhraseCandidateGenome(candidate.genome), [4, 4]);
  const scores = { ...score.subscores };
  const fitness = normalizeStoredCandidateFitness(aggregateCandidateFitness(scores, { kind: "phrase" }).fitness);
  return needsFitnessUpdate(candidate, scores, fitness)
    ? persistence.scoreCandidate(candidate.id, scores, fitness, branchId)
    : candidate;
}

async function selectDiverseCandidates(
  persistence: CandidateCyclePersistence,
  branchId: string,
  eliteLimit: number,
  diversity: CandidateDiversityConfig,
): Promise<CandidateCycleSelectionResult> {
  const retainCandidates = requireStatusMutator(persistence.retainCandidates, "retainCandidates");
  const reserveCandidates = requireStatusMutator(persistence.reserveCandidates, "reserveCandidates");
  const purgeCandidates = requireStatusMutator(persistence.purgeCandidates, "purgeCandidates");
  const candidates = (await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  }))
    .filter((candidate) => candidate.status !== "purged")
    .sort(rankCandidate);
  const eliteTargets = chooseDiverseElite(candidates, eliteLimit, diversity);
  const eliteTargetIds = new Set(eliteTargets.map((candidate) => candidate.id));
  const eliteFloor = eliteTargets.length > 0
    ? Math.min(...eliteTargets.map((candidate) => candidate.fitness))
    : 0;
  const reservedTargets = chooseReservoir(candidates, eliteTargets, eliteFloor, diversity);
  const reservedTargetIds = new Set(reservedTargets.map((candidate) => candidate.id));
  const purgeTargets = candidates.filter((candidate) =>
    !eliteTargetIds.has(candidate.id) && !reservedTargetIds.has(candidate.id)
  );

  const retained = await updateStatusIfNeeded(
    retainCandidates,
    eliteTargets
      .filter((candidate) => candidate.status !== "elite")
      .map((candidate) => candidate.id),
    branchId,
  );
  const reserved = await updateStatusIfNeeded(
    reserveCandidates,
    reservedTargets
      .filter((candidate) => candidate.status !== "reserved")
      .map((candidate) => candidate.id),
    branchId,
  );
  const purged = await updateStatusIfNeeded(
    purgeCandidates,
    purgeTargets
      .filter((candidate) => candidate.status !== "purged")
      .map((candidate) => candidate.id),
    branchId,
  );
  const finalCandidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const finalById = new Map(finalCandidates.map((candidate) => [candidate.id, candidate]));
  const finalElite = eliteTargets
    .map((candidate) => finalById.get(candidate.id) ?? retained.find((item) => item.id === candidate.id) ?? candidate)
    .sort(rankCandidate);
  const finalReserved = reservedTargets
    .map((candidate) => finalById.get(candidate.id) ?? reserved.find((item) => item.id === candidate.id) ?? candidate)
    .sort(rankReservoirCandidate(finalElite));

  return {
    kind: "phrase",
    branchId,
    eliteLimit,
    evaluatedCount: candidates.length,
    elite: finalElite,
    reserved: finalReserved,
    purged,
    diversity: {
      ...diversity,
      evaluatedCount: candidates.length,
      eliteMeanDistance: calculateMeanPairwiseProsodyDistance(finalElite),
      reservedCount: finalReserved.length,
      reservoirMeanInterestingness: finalReserved.length > 0
        ? roundTo(finalReserved.reduce((sum, candidate) =>
            sum + calculateCandidateDiversityMetrics(candidate, finalElite).interestingness, 0) / finalReserved.length, 6)
        : 0,
    },
  };
}

function chooseDiverseElite(
  candidates: readonly StoredCandidate[],
  eliteLimit: number,
  diversity: CandidateDiversityConfig,
): readonly StoredCandidate[] {
  const kept: StoredCandidate[] = [];
  const fitnessEliteLimit = Math.min(eliteLimit, diversity.fitnessEliteLimit);
  for (const candidate of candidates.slice(0, fitnessEliteLimit)) {
    kept.push(candidate);
  }
  for (const candidate of candidates) {
    if (kept.length >= eliteLimit) break;
    if (kept.some((elite) => elite.id === candidate.id)) continue;
    const nearestDistance = kept.length > 0
      ? Math.min(...kept.map((elite) => calculateProsodyScoreDistance(candidate, elite)))
      : Number.POSITIVE_INFINITY;
    if (nearestDistance >= diversity.minDistance) {
      kept.push(candidate);
    }
  }
  return kept;
}

function chooseReservoir(
  candidates: readonly StoredCandidate[],
  eliteTargets: readonly StoredCandidate[],
  eliteFloor: number,
  diversity: CandidateDiversityConfig,
): readonly StoredCandidate[] {
  const eliteIds = new Set(eliteTargets.map((candidate) => candidate.id));
  return candidates
    .filter((candidate) => !eliteIds.has(candidate.id))
    .filter((candidate) => candidate.fitness < eliteFloor)
    .map((candidate) => ({
      candidate,
      metrics: calculateCandidateDiversityMetrics(candidate, eliteTargets),
    }))
    .filter((entry) => entry.metrics.interestingness >= diversity.interestingnessThreshold)
    .sort((left, right) =>
      right.metrics.interestingness - left.metrics.interestingness ||
      right.metrics.novelty - left.metrics.novelty ||
      left.candidate.fitness - right.candidate.fitness ||
      rankCandidate(left.candidate, right.candidate)
    )
    .slice(0, diversity.reservoirLimit)
    .map((entry) => entry.candidate);
}

function chooseReservedDevelopmentParents(
  reserved: readonly StoredCandidate[],
  eliteCount: number,
  diversity: CandidateDiversityConfig,
): readonly StoredCandidate[] {
  if (!diversity.enabled || diversity.reservoirParentFraction <= 0 || reserved.length === 0) return [];
  const targetCount = Math.max(1, Math.ceil(eliteCount * diversity.reservoirParentFraction));
  return reserved.slice(0, Math.min(reserved.length, targetCount));
}

function adaptSelectionResult(selection: CandidateSelectionResult): CandidateCycleSelectionResult {
  return {
    kind: "phrase",
    branchId: selection.branchId,
    eliteLimit: selection.eliteLimit,
    evaluatedCount: selection.evaluatedCount,
    elite: selection.elite,
    reserved: [],
    purged: selection.purged,
  };
}

function requireStatusMutator(
  mutator: CandidateCyclePersistence["retainCandidates"],
  label: string,
): NonNullable<CandidateCyclePersistence["retainCandidates"]> {
  if (mutator) return mutator;
  throw new Error(`D4 diversity selection requires persistence.${label}`);
}

function updateStatusIfNeeded(
  mutator: NonNullable<CandidateCyclePersistence["retainCandidates"]>,
  candidateIds: readonly string[],
  branchId: string,
): Promise<readonly StoredCandidate[]> {
  return candidateIds.length > 0 ? mutator(candidateIds, branchId) : Promise.resolve([]);
}

async function summarizeEvolutionGeneration(
  persistence: CandidateCyclePersistence,
  branchId: string,
  generation: number,
  seed: number,
  eliteLimit: number,
  cycle: CandidateCycleResult,
): Promise<CandidateEvolutionGenerationSummary> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const activeCandidates = candidates.filter((candidate) => candidate.status !== "purged");
  const elite = await readRankedElite(persistence, branchId, eliteLimit);
  const reserved = await readRankedReserved(persistence, branchId, 500);
  const topFitness = activeCandidates.reduce(
    (best, candidate) => Math.max(best, candidate.fitness),
    0,
  );
  const meanEliteFitness = elite.length > 0
    ? elite.reduce((sum, candidate) => sum + candidate.fitness, 0) / elite.length
    : 0;

  const reservedParentIds = new Set(reserved.map((candidate) => candidate.id));
  const reservoirMeanInterestingness = reserved.length > 0
    ? reserved.reduce((sum, candidate) =>
        sum + calculateCandidateDiversityMetrics(candidate, elite).interestingness, 0) / reserved.length
    : 0;

  const summary: CandidateEvolutionGenerationSummary = {
    generation,
    seed,
    topFitness: roundTo(topFitness, 6),
    meanEliteFitness: roundTo(meanEliteFitness, 6),
    eliteCount: elite.length,
    populationSize: activeCandidates.length,
  };

  if (cycle.diversity) {
    return {
      ...summary,
      eliteMeanDistance: calculateMeanPairwiseProsodyDistance(elite),
      reservedCount: reserved.length,
      reservedParentChildCount: cycle.children.filter((child) =>
        reservedParentIds.has(child.parentId)
      ).length,
      reservoirMeanInterestingness: roundTo(reservoirMeanInterestingness, 6),
    };
  }

  return summary;
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

async function readRankedReserved(
  persistence: CandidateCyclePersistence,
  branchId: string,
  reservoirLimit: number,
  elite: readonly StoredCandidate[] = [],
): Promise<readonly StoredCandidate[]> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    status: "reserved",
    branchId,
    limit: 500,
  });
  return [...candidates].sort(rankReservoirCandidate(elite)).slice(0, reservoirLimit);
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

async function readExistingDiverseSelection(
  persistence: CandidateCyclePersistence,
  branchId: string,
  eliteLimit: number,
  diversity: CandidateDiversityConfig,
): Promise<CandidateCycleSelectionResult> {
  const elite = await readRankedElite(persistence, branchId, eliteLimit);
  const reserved = await readRankedReserved(persistence, branchId, diversity.reservoirLimit, elite);
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    branchId,
    limit: 500,
  });
  const purged = candidates
    .filter((candidate) => candidate.status === "purged")
    .sort(rankCandidate);
  return {
    kind: "phrase",
    branchId,
    eliteLimit,
    evaluatedCount: candidates.filter((candidate) => candidate.status !== "purged").length,
    elite,
    reserved,
    purged,
    diversity: {
      ...diversity,
      evaluatedCount: candidates.filter((candidate) => candidate.status !== "purged").length,
      eliteMeanDistance: calculateMeanPairwiseProsodyDistance(elite),
      reservedCount: reserved.length,
      reservoirMeanInterestingness: reserved.length > 0
        ? roundTo(reserved.reduce((sum, candidate) =>
            sum + calculateCandidateDiversityMetrics(candidate, elite).interestingness, 0) / reserved.length, 6)
        : 0,
    },
  };
}

function createProsodyDevelopmentMutation(elite: StoredCandidate): CandidateDevelopmentMutation | undefined {
  const phrase = renderPhraseCandidateGenome(elite.genome);
  const choices = createProsodyDevelopmentChoices(elite, phrase);
  const original = isAnchorPhraseCandidateGenome(elite.genome)
    ? stableJson(normalizePhraseCandidateGenome(elite.genome))
    : stableJson(phrase);
  for (const choice of choices) {
    const genome = createAnchorPhraseCandidateGenomeFromPattern(choice.genome);
    if (stableJson(genome) !== original) {
      return {
        type: "phrase.replace",
        operator: choice.operator,
        genome,
      };
    }
  }

  const fallback = varyContour(phrase, "transposeUp");
  const fallbackGenome = createAnchorPhraseCandidateGenomeFromPattern(fallback);
  if (stableJson(fallbackGenome) === original) return undefined;

  return {
    type: "phrase.replace",
    operator: { type: "varyContour", action: "transposeUp" },
    genome: fallbackGenome,
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
  if (Math.abs(candidate.fitness - normalizeStoredCandidateFitness(fitness)) > 0.0000005) return true;
  return stableJson(candidate.scores) !== stableJson(scores);
}

function normalizeStoredCandidateFitness(value: number): number {
  return roundTo(value, STORED_CANDIDATE_FITNESS_PLACES);
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

function rankReservoirCandidate(
  elite: readonly StoredCandidate[],
): (left: StoredCandidate, right: StoredCandidate) => number {
  return (left, right) => {
    const leftMetrics = calculateCandidateDiversityMetrics(left, elite);
    const rightMetrics = calculateCandidateDiversityMetrics(right, elite);
    return rightMetrics.interestingness - leftMetrics.interestingness ||
      rightMetrics.novelty - leftMetrics.novelty ||
      left.fitness - right.fitness ||
      rankCandidate(left, right);
  };
}

function normalizeDiversityOptions(
  options: CandidateDiversityOptions | undefined,
  eliteLimit: number,
): CandidateDiversityConfig {
  const enabled = options?.enabled === true;
  return {
    enabled,
    fitnessEliteLimit: enabled
      ? normalizePositiveInteger(options?.fitnessEliteLimit, 1, Math.max(1, eliteLimit))
      : 1,
    minDistance: enabled
      ? normalizeUnitishNumber(options?.minDistance, DEFAULT_DIVERSITY_MIN_DISTANCE, 0, 2)
      : DEFAULT_DIVERSITY_MIN_DISTANCE,
    reservoirLimit: enabled
      ? normalizePositiveInteger(options?.reservoirLimit, DEFAULT_RESERVOIR_LIMIT, MAX_ELITE_LIMIT)
      : 0,
    reservoirParentFraction: enabled
      ? normalizeUnitishNumber(options?.reservoirParentFraction, DEFAULT_RESERVOIR_PARENT_FRACTION, 0, 1)
      : 0,
    interestingnessThreshold: enabled
      ? normalizeUnitishNumber(options?.interestingnessThreshold, DEFAULT_INTERESTINGNESS_THRESHOLD, 0, 1)
      : DEFAULT_INTERESTINGNESS_THRESHOLD,
  };
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

function normalizeNonnegativeInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(maximum, Math.trunc(value));
}

function normalizeUnitishNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
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
