import type {
  CandidateDevelopmentMutation,
  CandidateDevelopmentOptions,
  CandidateDevelopmentResult,
  CandidateInput,
  CandidateKind,
  CandidateScores,
  CandidateSelectionOptions,
  CandidateSelectionResult,
  StoredCandidate,
} from "./candidate-store";
import { aggregateCandidateFitness } from "./candidate-fitness";
import { produceProsodyCandidates } from "./prosody-candidates";

export interface CandidateCycleOptions {
  seed: number;
  kind: "phrase";
  eliteLimit?: number;
  count?: number;
  branchId?: string;
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

const DEFAULT_CYCLE_COUNT = 8;
const DEFAULT_ELITE_LIMIT = 3;
const MAX_CYCLE_COUNT = 64;
const MAX_ELITE_LIMIT = 24;

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
    const fitness = aggregateCandidateFitness(candidate.scores).fitness;
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
    const mutation = createPhraseNudgeMutation(elite);
    const developed = await persistence.developCandidate({
      parentId: elite.id,
      branchId,
      seed: createDevelopmentSeed(elite, mutation),
      mutation,
    });
    children.push({
      ...summarizeCandidate(developed.child),
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

function createPhraseNudgeMutation(elite: StoredCandidate): CandidateDevelopmentMutation {
  const hash = hashText(`${elite.id}:${elite.seed}:${elite.generation}:d1-phrase-nudge`);
  const scaleDegreeDeltas = [-2, -1, 1, 2] as const;
  const velocityMultipliers = [0.88, 0.94, 1.06, 1.12] as const;
  const rotateSteps = [-1, 0, 1, 2] as const;
  return {
    type: "phrase.nudge",
    scaleDegreeDelta: scaleDegreeDeltas[hash % scaleDegreeDeltas.length],
    velocityMultiplier: velocityMultipliers[(hash >>> 3) % velocityMultipliers.length],
    rotateSteps: rotateSteps[(hash >>> 6) % rotateSteps.length],
  };
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
  if (Math.abs(candidate.fitness - fitness) > 0.0001) return true;
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
