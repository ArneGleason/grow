import type {
  AnacrusisVariation,
  CadenceVariation,
  ContourVariation,
} from "./prosody-development";
import type { PlayerPatternSource } from "./song-material";

export const CANDIDATE_KINDS = [
  "song",
  "phrase",
  "groove",
  "harmony",
  "form",
] as const;

export const CANDIDATE_STATUSES = [
  "alive",
  "elite",
  "reserved",
  "purged",
] as const;

export type CandidateKind = typeof CANDIDATE_KINDS[number];
export type CandidateStatus = typeof CANDIDATE_STATUSES[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type CandidateGenome = JsonValue;
export type CandidateScores = Record<string, number>;

export interface Candidate {
  id: string;
  kind: CandidateKind;
  genome: CandidateGenome;
  scores: CandidateScores;
  fitness: number;
  parentId?: string;
  generation: number;
  seed: number;
  status: CandidateStatus;
  createdAtBeat?: number;
}

export interface StoredCandidate extends Candidate {
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateInput {
  id?: string;
  kind: CandidateKind;
  genome: unknown;
  scores?: CandidateScores;
  fitness?: number;
  parentId?: string;
  generation?: number;
  seed?: number;
  status?: CandidateStatus;
  createdAtBeat?: number;
}

export interface CandidateValidationResult {
  valid: boolean;
  candidate: Candidate;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
}

export interface CandidateQueryOptions {
  kind?: CandidateKind;
  status?: CandidateStatus;
  branchId?: string;
  limit?: number;
}

export interface CandidateCapOptions {
  kind: CandidateKind;
  limit: number;
  branchId?: string;
}

export interface CandidateCapResult {
  kept: readonly StoredCandidate[];
  purged: readonly StoredCandidate[];
}

export interface CandidateSelectionOptions {
  kind: CandidateKind;
  eliteLimit: number;
  branchId?: string;
}

export interface CandidateSelectionResult {
  kind: CandidateKind;
  branchId: string;
  eliteLimit: number;
  evaluatedCount: number;
  elite: readonly StoredCandidate[];
  purged: readonly StoredCandidate[];
}

export type CandidateProsodyDevelopmentOperator =
  | { type: "reFoot"; seed: number }
  | { type: "varyContour"; action: ContourVariation }
  | { type: "alterCadence"; action: CadenceVariation }
  | { type: "shiftAnacrusis"; action: AnacrusisVariation };

export type CandidateDevelopmentMutation = {
  type: "phrase.nudge";
  scaleDegreeDelta?: number;
  octaveDelta?: number;
  velocityMultiplier?: number;
  rotateSteps?: number;
} | {
  type: "phrase.replace";
  operator: CandidateProsodyDevelopmentOperator;
  genome: PlayerPatternSource;
};

export interface CandidateDevelopmentOptions {
  parentId: string;
  mutation: CandidateDevelopmentMutation;
  branchId?: string;
  seed?: number;
  createdAtBeat?: number;
}

export interface CandidateDevelopmentResult {
  parent: StoredCandidate;
  child: StoredCandidate;
  mutation: CandidateDevelopmentMutation;
}

const DEFAULT_PHRASE_GENOME: PlayerPatternSource = {
  subdivisionBeats: 1,
  events: [null],
};

const MAX_JSON_DEPTH = 8;
const MAX_JSON_ARRAY_LENGTH = 256;
const MAX_JSON_OBJECT_KEYS = 64;
const MAX_JSON_STRING_LENGTH = 1_000;
const MAX_GENOME_JSON_LENGTH = 20_000;
const MAX_SCORE_KEYS = 32;
const MAX_SCORE_KEY_LENGTH = 48;
const MAX_GENERATION = 10_000;
const MAX_BEAT = 1_000_000;
const MAX_SEED = 0xffffffff;

export function validateCandidate(input: unknown): CandidateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clamps: string[] = [];
  const source = isRecord(input) ? input : {};
  if (!isRecord(input)) {
    errors.push("Candidate must be an object");
  }

  const kind = readKind(source.kind, errors);
  const genome = kind === "phrase"
    ? readPhraseGenome(source.genome, errors, clamps)
    : readBoundedJson(source.genome, "genome", errors, warnings);
  const scores = readScores(source.scores, errors, clamps);
  const fitness = readClampedNumber(source.fitness, 0, 0, 1, "fitness", warnings, clamps);
  const generation = readInteger(source.generation, 0, 0, MAX_GENERATION, "generation", warnings, clamps);
  const seed = readInteger(source.seed, 0, 0, MAX_SEED, "seed", warnings, clamps);
  const status = readStatus(source.status, "alive", errors);
  const parentId = readOptionalId(source.parentId, "parentId", errors);
  const createdAtBeat = readOptionalNumber(source.createdAtBeat, 0, MAX_BEAT, "createdAtBeat", warnings, clamps);

  const candidateWithoutId = {
    kind,
    genome,
    scores,
    fitness,
    parentId,
    generation,
    seed,
    status,
    createdAtBeat,
  };
  const id = readOptionalId(source.id, "id", errors) ?? createCandidateId(candidateWithoutId);
  const genomeLength = JSON.stringify(genome).length;
  if (genomeLength > MAX_GENOME_JSON_LENGTH) {
    errors.push(`genome JSON must be ${MAX_GENOME_JSON_LENGTH} characters or fewer`);
  }

  return {
    valid: errors.length === 0,
    candidate: removeUndefined({
      id,
      ...candidateWithoutId,
    }),
    errors,
    warnings,
    clamps,
  };
}

export function assertValidCandidate(input: unknown): Candidate {
  const result = validateCandidate(input);
  if (!result.valid) {
    throw new Error(`Invalid candidate: ${result.errors.join("; ")}`);
  }
  return result.candidate;
}

export function scopeCandidateIdForBranch(candidateId: string, branchId = "main"): string {
  const safeBranchId = normalizeBranchId(branchId);
  const prefix = `b${stableHash(safeBranchId)}:`;
  if (candidateId.startsWith(prefix)) return candidateId;
  const readableId = `${prefix}${candidateId}`;
  return readableId.length <= 120
    ? readableId
    : `${prefix}${stableHash(candidateId)}`;
}

export function scopeCandidateInputForBranch(candidate: CandidateInput, branchId = "main"): CandidateInput {
  const scopedCandidate = removeUndefined({
    ...candidate,
    parentId: candidate.parentId === undefined
      ? undefined
      : scopeCandidateIdForBranch(candidate.parentId, branchId),
  });
  const id = candidate.id === undefined
    ? validateCandidate(scopedCandidate).candidate.id
    : candidate.id;
  return removeUndefined({
    ...scopedCandidate,
    id: scopeCandidateIdForBranch(id, branchId),
  });
}

export function isCandidateKind(value: string): value is CandidateKind {
  return (CANDIDATE_KINDS as readonly string[]).includes(value);
}

export function isCandidateStatus(value: string): value is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

function createCandidateId(candidate: Omit<Candidate, "id">): string {
  return `candidate-${stableHash(JSON.stringify(candidate))}`;
}

function normalizeBranchId(value: string): string {
  return /^[a-zA-Z0-9:_-]{1,120}$/.test(value) ? value : "main";
}

function readKind(value: unknown, errors: string[]): CandidateKind {
  if (typeof value === "string" && isCandidateKind(value)) return value;
  errors.push(`kind must be one of ${CANDIDATE_KINDS.join(", ")}`);
  return "phrase";
}

function readStatus(value: unknown, fallback: CandidateStatus, errors: string[]): CandidateStatus {
  if (value === undefined) return fallback;
  if (typeof value === "string" && isCandidateStatus(value)) return value;
  errors.push(`status must be one of ${CANDIDATE_STATUSES.join(", ")}`);
  return fallback;
}

function readOptionalId(value: unknown, label: string, errors: string[]): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    errors.push(`${label} must be a string`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9:_-]{1,120}$/.test(trimmed)) {
    errors.push(`${label} must be 1-120 chars of letters, numbers, colon, underscore, or dash`);
    return undefined;
  }
  return trimmed;
}

function readPhraseGenome(
  value: unknown,
  errors: string[],
  clamps: string[],
): CandidateGenome {
  if (!isRecord(value)) {
    errors.push("phrase genome must be a PlayerPatternSource object");
    return DEFAULT_PHRASE_GENOME as unknown as CandidateGenome;
  }
  const subdivisionBeats = readClampedNumber(
    value.subdivisionBeats,
    DEFAULT_PHRASE_GENOME.subdivisionBeats,
    0.125,
    4,
    "genome.subdivisionBeats",
    [],
    clamps,
  );
  const rawEvents = Array.isArray(value.events) ? value.events : DEFAULT_PHRASE_GENOME.events;
  if (!Array.isArray(value.events)) {
    errors.push("phrase genome events must be an array");
  }
  const events = rawEvents.slice(0, 128).map((event, index) =>
    event === null
      ? null
      : readPatternNote(event, index, errors, clamps)
  );
  if (rawEvents.length > 128) {
    clamps.push("phrase genome events clamped to 128 steps");
  }
  if (events.length === 0) {
    errors.push("phrase genome must include at least one event slot");
    events.push(null);
  }
  return {
    subdivisionBeats,
    events,
  } satisfies PlayerPatternSource as unknown as CandidateGenome;
}

function readPatternNote(
  value: unknown,
  index: number,
  errors: string[],
  clamps: string[],
): NonNullable<PlayerPatternSource["events"][number]> | null {
  if (!isRecord(value)) {
    errors.push(`phrase genome event ${index} must be null or an object`);
    return null;
  }
  const playerId = typeof value.playerId === "string" && value.playerId.trim().length > 0
    ? value.playerId.trim().slice(0, 48)
    : "melody";
  const duration = typeof value.duration === "string" && value.duration.trim().length > 0
    ? value.duration.trim().slice(0, 16)
    : "8n";
  return {
    playerId,
    scaleDegree: readInteger(value.scaleDegree, 0, -28, 28, `genome.events.${index}.scaleDegree`, [], clamps),
    octave: readInteger(value.octave, 4, 0, 8, `genome.events.${index}.octave`, [], clamps),
    duration,
    durationBeats: readClampedNumber(
      value.durationBeats,
      0.5,
      0.0625,
      8,
      `genome.events.${index}.durationBeats`,
      [],
      clamps,
    ),
    velocity: readClampedNumber(value.velocity, 0.3, 0, 1, `genome.events.${index}.velocity`, [], clamps),
  };
}

function readScores(value: unknown, errors: string[], clamps: string[]): CandidateScores {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    errors.push("scores must be an object keyed by score name");
    return {};
  }
  const scores: CandidateScores = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, MAX_SCORE_KEYS)) {
    const safeKey = key.trim().slice(0, MAX_SCORE_KEY_LENGTH);
    if (!/^[a-zA-Z0-9_.:-]+$/.test(safeKey)) {
      errors.push(`score key ${key} is not allowed`);
      continue;
    }
    scores[safeKey] = readClampedNumber(rawValue, 0, 0, 1, `scores.${safeKey}`, [], clamps);
  }
  if (Object.keys(value).length > MAX_SCORE_KEYS) {
    clamps.push(`scores clamped to ${MAX_SCORE_KEYS} keys`);
  }
  return scores;
}

function readBoundedJson(
  value: unknown,
  label: string,
  errors: string[],
  warnings: string[],
  depth = 0,
): CandidateGenome {
  if (depth > MAX_JSON_DEPTH) {
    errors.push(`${label} exceeds max JSON depth ${MAX_JSON_DEPTH}`);
    return null;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      warnings.push(`${label} non-finite number replaced with 0`);
      return 0;
    }
    return roundTo(value, 6);
  }
  if (typeof value === "string") return value.slice(0, MAX_JSON_STRING_LENGTH);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_JSON_ARRAY_LENGTH)
      .map((item, index) => readBoundedJson(item, `${label}.${index}`, errors, warnings, depth + 1));
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, MAX_JSON_OBJECT_KEYS);
    const normalized: Record<string, CandidateGenome> = {};
    for (const [key, item] of entries) {
      normalized[key.slice(0, 80)] = readBoundedJson(item, `${label}.${key}`, errors, warnings, depth + 1);
    }
    return normalized;
  }
  errors.push(`${label} must be JSON-serializable`);
  return null;
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  const clamped = Math.min(maximum, Math.max(minimum, Math.trunc(value)));
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${clamped}`);
  }
  return clamped;
}

function readOptionalNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return readClampedNumber(value, minimum, minimum, maximum, label, warnings, clamps);
}

function readClampedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  const clamped = Math.min(maximum, Math.max(minimum, value));
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${roundTo(clamped, 4)}`);
  }
  return roundTo(clamped, 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
