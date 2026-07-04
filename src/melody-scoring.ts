import type { TonalContext } from "./listening";
import type { Player } from "./players";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";
import {
  DEFAULT_SONG_ARRANGEMENT,
  arrangeSongFormPatternEvent,
  deriveSongRootDegrees,
  deriveSongSectionRootPlans,
  type SongHarmonicSectionId,
} from "./song-form";

export type MelodyDevelopmentMode = "raw" | "repaired";
export type MelodyFeedbackValue = "up" | "down";

export interface MelodyPhraseNote {
  stepIndex: number;
  positionBeats: number;
  scaleDegree: number;
  octave: number;
  durationBeats: number;
  velocity: number;
}

export interface MelodyCritique {
  noteIndex: number;
  range?: [number, number];
  code:
    | "off-chord-landing"
    | "unresolved-leap"
    | "weak-cadence"
    | "repeated-run"
    | "narrow-variety"
    | "one-way-stretch"
    | "exact-repeat-cell"
    | "too-expected"
    | "too-jarring";
  message: string;
}

export interface MelodyPerspective {
  playerId: string;
  label: string;
  weights: {
    landing: number;
    monotony: number;
    surprise: number;
  };
  surpriseTarget: number;
  surpriseTolerance: number;
  prior: {
    degreeCounts: ReadonlyMap<number, number>;
    intervalCounts: ReadonlyMap<number, number>;
    totalDegrees: number;
    totalIntervals: number;
  };
}

export interface MelodyPhraseScore {
  perspectiveId: string;
  perspectiveLabel: string;
  total: number;
  landing: number;
  monotony: number;
  surprise: number;
  averageSurprise: number;
  weights: MelodyPerspective["weights"];
  surpriseTarget: number;
  critiques: readonly MelodyCritique[];
}

export type MelodyRepairCandidateSource = "raw-transform" | "heuristic-repair" | "repair-alternate";
export type MelodyRepairCandidateStrategy =
  | "raw-transform"
  | "balanced-repair"
  | "lifted-hook"
  | "stepwise-hook"
  | "spacious-hook"
  | "energetic-hook"
  | "cadence-hook"
  | "local-alternate";

export interface MelodyRepairCandidate {
  id: string;
  label: string;
  source: MelodyRepairCandidateSource;
  strategy: MelodyRepairCandidateStrategy;
  strategySummary: string;
  rank: number;
  phraseKey: string;
  phrase: readonly MelodyPhraseNote[];
  events: readonly (PatternNoteSource | null)[];
  scores: readonly MelodyPhraseScore[];
  primaryScore: MelodyPhraseScore;
  changedNotes: number;
  critiqueCount: number;
  noteCount: number;
  scoreDeltaFromBest: number;
  scoreDeltaFromDeterministic: number;
  summary: string;
}

export interface MelodyCriticSelection {
  selectedCandidateId: string;
  rationale: string;
  strengths: string;
  concerns: string;
}

export interface MelodyCriticValidation {
  valid: boolean;
  errors: string[];
}

export type MelodyConsensusProposedBy = "deterministic-scorer" | "model-critic";
export type MelodyConsensusStance = "accept" | "defer" | "push";

export interface MelodyConsensusResponse {
  playerId: string;
  label: string;
  stance: MelodyConsensusStance;
  proposedCandidateId: string;
  preferredCandidateId: string;
  preferredStrategy: MelodyRepairCandidateStrategy;
  proposedScore: number;
  preferredScore: number;
  preferenceMargin: number;
  reason: string;
}

export interface MelodyConsensusDecision {
  proposedBy: MelodyConsensusProposedBy;
  proposedCandidateId: string;
  selectedBy: "band-consensus";
  selectedCandidateId: string;
  selectedStrategy: MelodyRepairCandidateStrategy;
  agreementScore: number;
  scoreDeltaFromProposed: number;
  responses: readonly MelodyConsensusResponse[];
  summary: string;
}

export interface MelodyRepairTake {
  id: string;
  songId: SongMaterial["id"];
  perspectiveId: string;
  scoringRootSection: SongHarmonicSectionId;
  scoringRootDegrees: readonly number[];
  mode: MelodyDevelopmentMode;
  deterministicCandidateId: string;
  bestCandidateId: string;
  candidates: readonly MelodyRepairCandidate[];
  rawPhrase: readonly MelodyPhraseNote[];
  repairedPhrase: readonly MelodyPhraseNote[];
  rawEvents: readonly (PatternNoteSource | null)[];
  repairedEvents: readonly (PatternNoteSource | null)[];
  rawScores: readonly MelodyPhraseScore[];
  repairedScores: readonly MelodyPhraseScore[];
  primaryRawScore: MelodyPhraseScore;
  primaryRepairedScore: MelodyPhraseScore;
  improved: boolean;
  phraseKey: string;
  rejectedCount: number;
  rememberedCount: number;
  topCritique: string;
}

export interface MelodyRepairOptions {
  song: SongMaterial;
  tonalContext: TonalContext;
  players: readonly Player[];
  perspectivePlayerId?: string;
  rejectedPhraseKeys?: ReadonlySet<string>;
  rememberedCount?: number;
  weightNudges?: ReadonlyMap<string, number>;
}

export const MELODY_CHORUS_PHRASE_BEATS = 8;
const CHORUS_START_BEAT = 32;
const CHORD_TONE_OFFSETS = [0, 2, 4] as const;
const LEAP_INTERVAL_THRESHOLD = 3;
const REPAIR_PASSES = 2;
const SCORE_EPSILON = 0.0001;
const REPAIR_REGISTER_PADDING = 1;
const MAX_REPAIR_CANDIDATES = 7;
const CONSENSUS_PROPOSAL_BIAS = 0.08;
const CONSENSUS_DEFER_MARGIN = 0.035;
const STRATEGY_AFFINITY_BY_PLAYER: Record<string, Partial<Record<MelodyRepairCandidateStrategy, number>>> = {
  pulse: {
    "balanced-repair": 0.035,
    "cadence-hook": 0.045,
    "spacious-hook": 0.075,
    "energetic-hook": -0.05,
    "lifted-hook": -0.035,
  },
  bass: {
    "spacious-hook": 0.085,
    "cadence-hook": 0.035,
    "balanced-repair": 0.02,
    "energetic-hook": -0.04,
    "lifted-hook": -0.025,
  },
  melody: {
    "lifted-hook": 0.045,
    "energetic-hook": 0.04,
    "stepwise-hook": 0.035,
    "spacious-hook": 0.035,
    "cadence-hook": 0.015,
  },
};

export const MELODY_CRITIC_TEXT_LIMITS = {
  rationale: 220,
  strengths: 180,
  concerns: 180,
} as const;

const MELODY_REPAIR_HARMONIC_SECTION: SongHarmonicSectionId = "answer";

export function createMelodyRepairTake(options: MelodyRepairOptions): MelodyRepairTake {
  const melodyPattern = getPatternForPlayer(options.song, "melody");
  const rawEvents = collectRawChorusEvents(options.song, melodyPattern, options.tonalContext);
  const rawPhrase = phraseFromEvents(rawEvents, melodyPattern.subdivisionBeats);
  const rootDegrees = getMelodyRepairRootDegrees(options.song);
  const perspectives = options.players.map((player) =>
    createMelodyPerspective(player, options.song, options.weightNudges?.get(player.id) ?? 0)
  );
  const primaryPerspective = perspectives.find((perspective) =>
    perspective.playerId === (options.perspectivePlayerId ?? "melody")
  ) ?? perspectives[0];
  const scoreContext = {
    phraseBeats: MELODY_CHORUS_PHRASE_BEATS,
    rootDegrees,
    scaleLength: options.tonalContext.scale.length,
  };

  const primaryRawScore = scoreMelodyPhrase(rawPhrase, scoreContext, primaryPerspective);
  const repairedPhrase = repairMelodyPhrase(
    rawPhrase,
    scoreContext,
    primaryPerspective,
    options.rejectedPhraseKeys ?? new Set(),
  );
  const repairedEvents = eventsFromPhrase(rawEvents, repairedPhrase);
  const rawScores = perspectives.map((perspective) =>
    scoreMelodyPhrase(rawPhrase, scoreContext, perspective)
  );
  const repairedScores = perspectives.map((perspective) =>
    scoreMelodyPhrase(repairedPhrase, scoreContext, perspective)
  );
  const primaryRepairedScore = repairedScores.find((score) =>
    score.perspectiveId === primaryPerspective.playerId
  ) ?? scoreMelodyPhrase(repairedPhrase, scoreContext, primaryPerspective);
  const phraseKey = createPhraseKey(repairedPhrase);
  const rawCandidate = createMelodyRepairCandidate({
    source: "raw-transform",
    strategy: "raw-transform",
    label: "Raw transform",
    strategySummary: "The first deterministic chorus transform before critique or repair.",
    rank: 0,
    songId: options.song.id,
    rawPhrase,
    phrase: rawPhrase,
    events: rawEvents,
    scores: rawScores,
    primaryScore: primaryRawScore,
  });
  const deterministicCandidate = createMelodyRepairCandidate({
    source: "heuristic-repair",
    strategy: "balanced-repair",
    label: "Heuristic repair",
    strategySummary: "The scorer's balanced local repair of landing, monotony, and surprise.",
    rank: 1,
    songId: options.song.id,
    rawPhrase,
    phrase: repairedPhrase,
    events: repairedEvents,
    scores: repairedScores,
    primaryScore: primaryRepairedScore,
  });
  const candidates = createMelodyRepairCandidateSet({
    songId: options.song.id,
    rawPhrase,
    rawCandidate,
    deterministicCandidate,
    repairedPhrase,
    rawEvents,
    context: scoreContext,
    perspectives,
    primaryPerspective,
    rejectedPhraseKeys: options.rejectedPhraseKeys ?? new Set(),
  });
  const bestCandidateId = getBestMelodyRepairCandidate(candidates)?.id ?? deterministicCandidate.id;

  return {
    id: [
      "chorus-repair",
      options.song.id,
      primaryPerspective.playerId,
      phraseKey.replaceAll("|", "."),
    ].join("-"),
    songId: options.song.id,
    perspectiveId: primaryPerspective.playerId,
    scoringRootSection: MELODY_REPAIR_HARMONIC_SECTION,
    scoringRootDegrees: rootDegrees,
    mode: "repaired",
    deterministicCandidateId: deterministicCandidate.id,
    bestCandidateId,
    candidates,
    rawPhrase,
    repairedPhrase,
    rawEvents,
    repairedEvents,
    rawScores,
    repairedScores,
    primaryRawScore,
    primaryRepairedScore,
    improved: primaryRepairedScore.total > primaryRawScore.total + SCORE_EPSILON,
    phraseKey,
    rejectedCount: options.rejectedPhraseKeys?.size ?? 0,
    rememberedCount: options.rememberedCount ?? 0,
    topCritique: primaryRepairedScore.critiques[0]?.message ??
      (primaryRawScore.critiques[0]
        ? `repaired cleared raw flag: ${primaryRawScore.critiques[0].message}`
        : "No urgent repair flags."),
  };
}

function getMelodyRepairRootDegrees(song: SongMaterial): readonly number[] {
  const sectionRoots = deriveSongSectionRootPlans(song)[MELODY_REPAIR_HARMONIC_SECTION];
  return sectionRoots.length > 0 ? sectionRoots : deriveSongRootDegrees(song);
}

export function createMockMelodyCriticSelection(take: MelodyRepairTake): MelodyCriticSelection {
  const candidate = getMelodyRepairCandidate(take, take.deterministicCandidateId) ??
    take.candidates[0];
  return {
    selectedCandidateId: candidate?.id ?? take.deterministicCandidateId,
    rationale: "Deterministic scorer keeps the most balanced repaired chorus.",
    strengths: candidate
      ? `${candidate.label} scores ${candidate.primaryScore.total.toFixed(3)} with ${candidate.changedNotes} changed note(s).`
      : "The deterministic repair remains the fallback.",
    concerns: candidate?.primaryScore.critiques[0]?.message ?? "No urgent repair flags.",
  };
}

export function validateMelodyCriticSelection(
  selection: MelodyCriticSelection,
  take: MelodyRepairTake,
): MelodyCriticValidation {
  const errors: string[] = [];
  if (!getMelodyRepairCandidate(take, selection.selectedCandidateId)) {
    errors.push(`selectedCandidateId must match one of ${take.candidates.length} candidate id(s)`);
  }
  validateRequiredTextField("rationale", selection.rationale, MELODY_CRITIC_TEXT_LIMITS.rationale, errors);
  validateRequiredTextField("strengths", selection.strengths, MELODY_CRITIC_TEXT_LIMITS.strengths, errors);
  validateRequiredTextField("concerns", selection.concerns, MELODY_CRITIC_TEXT_LIMITS.concerns, errors);
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getMelodyRepairCandidate(
  take: MelodyRepairTake,
  candidateId: string | undefined,
): MelodyRepairCandidate | undefined {
  if (!candidateId) return undefined;
  return take.candidates.find((candidate) => candidate.id === candidateId);
}

export function getBestMelodyRepairCandidate(
  takeOrCandidates: MelodyRepairTake | readonly MelodyRepairCandidate[],
): MelodyRepairCandidate | undefined {
  const candidates: readonly MelodyRepairCandidate[] = "candidates" in takeOrCandidates
    ? takeOrCandidates.candidates
    : takeOrCandidates;
  return candidates.reduce<MelodyRepairCandidate | undefined>((best, candidate) => {
    if (!best) return candidate;
    if (candidate.primaryScore.total > best.primaryScore.total + SCORE_EPSILON) return candidate;
    if (
      Math.abs(candidate.primaryScore.total - best.primaryScore.total) <= SCORE_EPSILON &&
      candidate.id < best.id
    ) {
      return candidate;
    }
    return best;
  }, undefined);
}

export function createMelodyConsensusDecision(
  take: MelodyRepairTake,
  proposedCandidateId: string | undefined,
  proposedBy: MelodyConsensusProposedBy = "deterministic-scorer",
): MelodyConsensusDecision {
  const candidates = take.candidates.filter((candidate) =>
    candidate.source !== "raw-transform" ||
    candidate.id === proposedCandidateId ||
    candidate.id === take.deterministicCandidateId
  );
  const fallbackCandidate = getMelodyRepairCandidate(take, take.deterministicCandidateId) ??
    take.candidates[0];
  if (!fallbackCandidate) {
    throw new Error(`Melody repair take ${take.id} has no candidates`);
  }
  const proposedCandidate = getMelodyRepairCandidate(take, proposedCandidateId) ?? fallbackCandidate;
  const playerIds = getConsensusPlayerIds(take);
  const responses = playerIds.map((playerId) =>
    createMelodyConsensusResponse(playerId, candidates, proposedCandidate)
  );
  const selectedCandidate = candidates.reduce((best, candidate) => {
    const candidateScore = scoreCandidateForConsensus(candidate, playerIds, proposedCandidate.id);
    const bestScore = scoreCandidateForConsensus(best, playerIds, proposedCandidate.id);
    if (candidateScore > bestScore + SCORE_EPSILON) return candidate;
    if (Math.abs(candidateScore - bestScore) <= SCORE_EPSILON && candidate.id < best.id) return candidate;
    return best;
  }, proposedCandidate);
  const selectedAgreementScore = scoreCandidateForConsensus(selectedCandidate, playerIds, proposedCandidate.id);
  const acceptCount = responses.filter((response) => response.stance === "accept").length;
  const pushCount = responses.filter((response) => response.stance === "push").length;
  const deferCount = responses.filter((response) => response.stance === "defer").length;

  return {
    proposedBy,
    proposedCandidateId: proposedCandidate.id,
    selectedBy: "band-consensus",
    selectedCandidateId: selectedCandidate.id,
    selectedStrategy: selectedCandidate.strategy,
    agreementScore: selectedAgreementScore,
    scoreDeltaFromProposed: roundSignedScore(
      selectedCandidate.primaryScore.total - proposedCandidate.primaryScore.total,
    ),
    responses,
    summary: [
      `selected ${selectedCandidate.strategy}`,
      `from ${proposedBy} proposal ${proposedCandidate.strategy}`,
      `${acceptCount} accept`,
      `${deferCount} defer`,
      `${pushCount} push`,
    ].join(" | "),
  };
}

function getConsensusPlayerIds(take: MelodyRepairTake): readonly string[] {
  const ids = new Set<string>();
  for (const candidate of take.candidates) {
    for (const score of candidate.scores) {
      ids.add(score.perspectiveId);
    }
  }
  if (ids.size === 0) ids.add(take.perspectiveId);
  return [...ids].sort((left, right) =>
    consensusPlayerOrder(left) - consensusPlayerOrder(right) || left.localeCompare(right)
  );
}

function createMelodyConsensusResponse(
  playerId: string,
  candidates: readonly MelodyRepairCandidate[],
  proposedCandidate: MelodyRepairCandidate,
): MelodyConsensusResponse {
  const preferredCandidate = candidates.reduce((best, candidate) => {
    const candidateScore = scoreCandidateForPlayerConsensus(candidate, playerId, proposedCandidate.id);
    const bestScore = scoreCandidateForPlayerConsensus(best, playerId, proposedCandidate.id);
    if (candidateScore > bestScore + SCORE_EPSILON) return candidate;
    if (Math.abs(candidateScore - bestScore) <= SCORE_EPSILON && candidate.id < best.id) return candidate;
    return best;
  }, proposedCandidate);
  const proposedScore = scoreCandidateForPlayerConsensus(proposedCandidate, playerId, proposedCandidate.id);
  const preferredScore = scoreCandidateForPlayerConsensus(preferredCandidate, playerId, proposedCandidate.id);
  const preferenceMargin = roundSignedScore(preferredScore - proposedScore);
  const stance: MelodyConsensusStance = preferredCandidate.id === proposedCandidate.id
    ? "accept"
    : preferenceMargin <= CONSENSUS_DEFER_MARGIN
    ? "defer"
    : "push";
  const label = getCandidateScoreForPlayer(proposedCandidate, playerId)?.perspectiveLabel ?? playerId;

  return {
    playerId,
    label,
    stance,
    proposedCandidateId: proposedCandidate.id,
    preferredCandidateId: preferredCandidate.id,
    preferredStrategy: preferredCandidate.strategy,
    proposedScore,
    preferredScore,
    preferenceMargin,
    reason: createConsensusReason({
      label,
      stance,
      proposedCandidate,
      preferredCandidate,
      preferenceMargin,
    }),
  };
}

function createConsensusReason(input: {
  label: string;
  stance: MelodyConsensusStance;
  proposedCandidate: MelodyRepairCandidate;
  preferredCandidate: MelodyRepairCandidate;
  preferenceMargin: number;
}): string {
  if (input.stance === "accept") {
    return `${input.label} accepts ${input.proposedCandidate.strategy}; role score and proposal agree.`;
  }
  if (input.stance === "defer") {
    return `${input.label} hears ${input.preferredCandidate.strategy} slightly ahead (${formatSignedDelta(
      input.preferenceMargin,
    )}) but defers to the proposal.`;
  }
  return `${input.label} pushes for ${input.preferredCandidate.strategy} over ${input.proposedCandidate.strategy} (${formatSignedDelta(
    input.preferenceMargin,
  )}).`;
}

function scoreCandidateForConsensus(
  candidate: MelodyRepairCandidate,
  playerIds: readonly string[],
  proposedCandidateId: string,
): number {
  if (playerIds.length === 0) return roundScore(candidate.primaryScore.total);
  const total = playerIds.reduce((sum, playerId) =>
    sum + scoreCandidateForPlayerConsensus(candidate, playerId, proposedCandidateId), 0);
  return roundScore(total / playerIds.length);
}

function scoreCandidateForPlayerConsensus(
  candidate: MelodyRepairCandidate,
  playerId: string,
  proposedCandidateId: string,
): number {
  const score = getCandidateScoreForPlayer(candidate, playerId)?.total ?? candidate.primaryScore.total;
  const proposalBias = candidate.id === proposedCandidateId ? CONSENSUS_PROPOSAL_BIAS : 0;
  return roundScore(clamp(
    score + getPlayerStrategyAffinity(playerId, candidate.strategy) + proposalBias,
    0,
    1,
  ));
}

function getCandidateScoreForPlayer(
  candidate: MelodyRepairCandidate,
  playerId: string,
): MelodyPhraseScore | undefined {
  return candidate.scores.find((score) => score.perspectiveId === playerId);
}

function getPlayerStrategyAffinity(
  playerId: string,
  strategy: MelodyRepairCandidateStrategy,
): number {
  return STRATEGY_AFFINITY_BY_PLAYER[playerId]?.[strategy] ?? 0;
}

function consensusPlayerOrder(playerId: string): number {
  if (playerId === "pulse") return 0;
  if (playerId === "bass") return 1;
  if (playerId === "melody") return 2;
  return 99;
}

export function scoreMelodyPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  },
  perspective: MelodyPerspective,
): MelodyPhraseScore {
  const critiques: MelodyCritique[] = [];
  const landing = scoreLanding(phrase, context, critiques);
  const monotony = scoreMonotony(phrase, context.scaleLength, critiques);
  const { score: surprise, averageSurprise } = scoreSurprise(phrase, perspective, critiques);
  const total = roundScore(
    landing * perspective.weights.landing +
    monotony * perspective.weights.monotony +
    surprise * perspective.weights.surprise,
  );

  return {
    perspectiveId: perspective.playerId,
    perspectiveLabel: perspective.label,
    total,
    landing,
    monotony,
    surprise,
    averageSurprise,
    weights: perspective.weights,
    surpriseTarget: perspective.surpriseTarget,
    critiques,
  };
}

export function createPhraseKey(phrase: readonly MelodyPhraseNote[]): string {
  return phrase.map((note) =>
    [
      note.stepIndex,
      normalizeDegree(note.scaleDegree),
      note.octave,
      note.durationBeats,
      note.velocity.toFixed(3),
    ].join(":")
  ).join("|");
}

function repairMelodyPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  },
  perspective: MelodyPerspective,
  rejectedPhraseKeys: ReadonlySet<string>,
): readonly MelodyPhraseNote[] {
  let repaired = phrase.map((note) => ({ ...note }));
  for (let pass = 0; pass < REPAIR_PASSES; pass += 1) {
    const score = scoreMelodyPhrase(repaired, context, perspective);
    const flaggedIndexes = getFlaggedNoteIndexes(score.critiques, repaired.length);
    if (flaggedIndexes.length === 0) break;

    for (const noteIndex of flaggedIndexes) {
      const currentScore = scoreMelodyPhrase(repaired, context, perspective);
      const candidates = createRepairCandidates(repaired, noteIndex, context);
      let bestPhrase: readonly MelodyPhraseNote[] = repaired;
      let bestScore = currentScore.total;
      let bestKey = createPhraseKey(repaired);
      for (const candidate of candidates) {
        const candidatePhrase = replacePhraseNote(repaired, noteIndex, candidate);
        const candidateKey = createPhraseKey(candidatePhrase);
        if (rejectedPhraseKeys.has(candidateKey)) continue;
        const candidateScore = scoreMelodyPhrase(candidatePhrase, context, perspective).total;
        if (
          candidateScore > bestScore + SCORE_EPSILON ||
          (Math.abs(candidateScore - bestScore) <= SCORE_EPSILON && candidateKey < bestKey)
        ) {
          bestPhrase = candidatePhrase;
          bestScore = candidateScore;
          bestKey = candidateKey;
        }
      }
      repaired = bestPhrase.map((note) => ({ ...note }));
    }
  }

  if (!rejectedPhraseKeys.has(createPhraseKey(repaired))) return repaired;
  return chooseAlternatePhrase(repaired, context, perspective, rejectedPhraseKeys);
}

function createMelodyRepairCandidateSet(input: {
  songId: SongMaterial["id"];
  rawPhrase: readonly MelodyPhraseNote[];
  rawCandidate: MelodyRepairCandidate;
  deterministicCandidate: MelodyRepairCandidate;
  repairedPhrase: readonly MelodyPhraseNote[];
  rawEvents: readonly (PatternNoteSource | null)[];
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  };
  perspectives: readonly MelodyPerspective[];
  primaryPerspective: MelodyPerspective;
  rejectedPhraseKeys: ReadonlySet<string>;
}): readonly MelodyRepairCandidate[] {
  const seenKeys = new Set<string>();
  const candidates: MelodyRepairCandidate[] = [];

  addCandidate(input.deterministicCandidate);

  const strategicPhrases = createStrategicRepairCandidatePhrases({
    repairedPhrase: input.repairedPhrase,
    context: input.context,
    rejectedPhraseKeys: input.rejectedPhraseKeys,
    excludedPhraseKeys: new Set([
      input.deterministicCandidate.phraseKey,
      input.rawCandidate.phraseKey,
    ]),
  });

  strategicPhrases.forEach((alternative, index) => {
    const scores = input.perspectives.map((perspective) =>
      scoreMelodyPhrase(alternative.phrase, input.context, perspective)
    );
    const primaryScore = scores.find((score) => score.perspectiveId === input.primaryPerspective.playerId) ??
      scoreMelodyPhrase(alternative.phrase, input.context, input.primaryPerspective);
    addCandidate(createMelodyRepairCandidate({
      source: "repair-alternate",
      strategy: alternative.strategy,
      label: alternative.label,
      strategySummary: alternative.summary,
      rank: index + 2,
      songId: input.songId,
      rawPhrase: input.rawPhrase,
      phrase: alternative.phrase,
      events: eventsFromPhrase(input.rawEvents, alternative.phrase),
      scores,
      primaryScore,
    }));
  });

  const localAlternates = createAlternateRepairCandidatePhrases(
    input.repairedPhrase,
    input.context,
    input.primaryPerspective,
    input.rejectedPhraseKeys,
    new Set([
      input.deterministicCandidate.phraseKey,
      input.rawCandidate.phraseKey,
      ...candidates.map((candidate) => candidate.phraseKey),
    ]),
  ).slice(0, Math.max(0, MAX_REPAIR_CANDIDATES - candidates.length - 1));

  localAlternates.forEach((alternative, index) => {
    const scores = input.perspectives.map((perspective) =>
      scoreMelodyPhrase(alternative.phrase, input.context, perspective)
    );
    const primaryScore = scores.find((score) => score.perspectiveId === input.primaryPerspective.playerId) ??
      scoreMelodyPhrase(alternative.phrase, input.context, input.primaryPerspective);
    addCandidate(createMelodyRepairCandidate({
      source: "repair-alternate",
      strategy: "local-alternate",
      label: `Local alternate ${index + 1}`,
      strategySummary: "A high-scoring one-note local repair variant.",
      rank: candidates.length + index + 1,
      songId: input.songId,
      rawPhrase: input.rawPhrase,
      phrase: alternative.phrase,
      events: eventsFromPhrase(input.rawEvents, alternative.phrase),
      scores,
      primaryScore,
    }));
  });

  addCandidate(input.rawCandidate);
  return annotateCandidateScoreDeltas(candidates.slice(0, MAX_REPAIR_CANDIDATES), input.deterministicCandidate.id);

  function addCandidate(candidate: MelodyRepairCandidate): void {
    if (seenKeys.has(candidate.phraseKey)) return;
    if (candidate.source !== "raw-transform" && input.rejectedPhraseKeys.has(candidate.phraseKey)) return;
    seenKeys.add(candidate.phraseKey);
    candidates.push(candidate);
  }
}

function annotateCandidateScoreDeltas(
  candidates: readonly MelodyRepairCandidate[],
  deterministicCandidateId: string,
): readonly MelodyRepairCandidate[] {
  const best = getBestMelodyRepairCandidate(candidates);
  const deterministic = candidates.find((candidate) => candidate.id === deterministicCandidateId) ?? best;
  const bestTotal = best?.primaryScore.total ?? 0;
  const deterministicTotal = deterministic?.primaryScore.total ?? bestTotal;
  return candidates.map((candidate) => ({
    ...candidate,
    scoreDeltaFromBest: roundSignedScore(candidate.primaryScore.total - bestTotal),
    scoreDeltaFromDeterministic: roundSignedScore(candidate.primaryScore.total - deterministicTotal),
  }));
}

function createAlternateRepairCandidatePhrases(
  phrase: readonly MelodyPhraseNote[],
  context: {
    rootDegrees: readonly number[];
    scaleLength: number;
  },
  perspective: MelodyPerspective,
  rejectedPhraseKeys: ReadonlySet<string>,
  excludedPhraseKeys: ReadonlySet<string>,
): ReadonlyArray<{ key: string; score: number; phrase: readonly MelodyPhraseNote[] }> {
  const alternatives = new Map<string, { key: string; score: number; phrase: readonly MelodyPhraseNote[] }>();
  for (let noteIndex = 0; noteIndex < phrase.length; noteIndex += 1) {
    for (const candidate of createRepairCandidates(phrase, noteIndex, context)) {
      const candidatePhrase = replacePhraseNote(phrase, noteIndex, candidate);
      const key = createPhraseKey(candidatePhrase);
      if (excludedPhraseKeys.has(key) || rejectedPhraseKeys.has(key) || alternatives.has(key)) continue;
      alternatives.set(key, {
        key,
        score: scoreMelodyPhrase(candidatePhrase, {
          phraseBeats: MELODY_CHORUS_PHRASE_BEATS,
          rootDegrees: context.rootDegrees,
          scaleLength: context.scaleLength,
        }, perspective).total,
        phrase: candidatePhrase,
      });
    }
  }

  return [...alternatives.values()].sort((left, right) =>
    right.score - left.score || left.key.localeCompare(right.key)
  );
}

function createStrategicRepairCandidatePhrases(input: {
  repairedPhrase: readonly MelodyPhraseNote[];
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  };
  rejectedPhraseKeys: ReadonlySet<string>;
  excludedPhraseKeys: ReadonlySet<string>;
}): ReadonlyArray<{
  strategy: MelodyRepairCandidateStrategy;
  label: string;
  summary: string;
  phrase: readonly MelodyPhraseNote[];
}> {
  const strategies = [
    {
      strategy: "lifted-hook" as const,
      label: "Lifted hook",
      summary: "A brighter hook that aims accented notes at upper chord tones.",
      phrase: createLiftedHookPhrase(input.repairedPhrase, input.context),
    },
    {
      strategy: "stepwise-hook" as const,
      label: "Stepwise hook",
      summary: "A smoother singable line that limits most moves to neighboring tones.",
      phrase: createStepwiseHookPhrase(input.repairedPhrase, input.context),
    },
    {
      strategy: "spacious-hook" as const,
      label: "Spacious hook",
      summary: "A leaner chorus that keeps only the strongest notes and lets them breathe.",
      phrase: createSpaciousHookPhrase(input.repairedPhrase),
    },
    {
      strategy: "energetic-hook" as const,
      label: "Energetic hook",
      summary: "A busier answer that pushes neighbor motion and brighter attack.",
      phrase: createEnergeticHookPhrase(input.repairedPhrase, input.context),
    },
    {
      strategy: "cadence-hook" as const,
      label: "Cadence hook",
      summary: "A landing-focused line that makes section starts and the final note settle.",
      phrase: createCadenceHookPhrase(input.repairedPhrase, input.context),
    },
  ];
  const seenKeys = new Set(input.excludedPhraseKeys);
  const options: Array<{
    strategy: MelodyRepairCandidateStrategy;
    label: string;
    summary: string;
    phrase: readonly MelodyPhraseNote[];
  }> = [];

  for (const strategy of strategies) {
    const key = createPhraseKey(strategy.phrase);
    if (seenKeys.has(key) || input.rejectedPhraseKeys.has(key)) continue;
    seenKeys.add(key);
    options.push(strategy);
  }

  return options;
}

function createLiftedHookPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    rootDegrees: readonly number[];
    scaleLength: number;
  },
): readonly MelodyPhraseNote[] {
  const bounds = extendRegisterBounds(getPhraseRegisterBounds(phrase, context.scaleLength), 0, 2);
  return phrase.map((note, index) => {
    const root = rootForPosition(note.positionBeats, context.rootDegrees);
    const targetClass = isAccent(note.positionBeats) || index === 0
      ? root + 4
      : note.scaleDegree + 1;
    const nextNote = moveNoteToDegree(note, nearestDegree(note.scaleDegree + 1, targetClass, context.scaleLength), {
      bounds,
      scaleLength: context.scaleLength,
    });
    return {
      ...nextNote,
      velocity: roundVelocity(nextNote.velocity + 0.08),
    };
  });
}

function createStepwiseHookPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    rootDegrees: readonly number[];
    scaleLength: number;
  },
): readonly MelodyPhraseNote[] {
  const bounds = getPhraseRegisterBounds(phrase, context.scaleLength);
  const nextPhrase: MelodyPhraseNote[] = [];
  for (let index = 0; index < phrase.length; index += 1) {
    const note = phrase[index];
    if (!note) continue;
    const previous = nextPhrase[index - 1];
    if (!previous) {
      nextPhrase.push(moveNoteToDegree(
        note,
        nearestDegree(note.scaleDegree, rootForPosition(note.positionBeats, context.rootDegrees) + 2, context.scaleLength),
        { bounds, scaleLength: context.scaleLength },
      ));
      continue;
    }

    const root = rootForPosition(note.positionBeats, context.rootDegrees);
    const stepTargets = [
      previous.scaleDegree - 1,
      previous.scaleDegree,
      previous.scaleDegree + 1,
      nearestDegree(previous.scaleDegree, root + 2, context.scaleLength),
      nearestDegree(previous.scaleDegree, root + 4, context.scaleLength),
    ];
    const target = stepTargets.sort((left, right) =>
      Math.abs(left - note.scaleDegree) - Math.abs(right - note.scaleDegree) ||
      Math.abs(left - previous.scaleDegree) - Math.abs(right - previous.scaleDegree) ||
      left - right
    )[0] ?? note.scaleDegree;
    const nextNote = moveNoteToDegree(note, target, { bounds, scaleLength: context.scaleLength });
    nextPhrase.push({
      ...nextNote,
      velocity: roundVelocity(nextNote.velocity - 0.02),
    });
  }
  return nextPhrase;
}

function createSpaciousHookPhrase(
  phrase: readonly MelodyPhraseNote[],
): readonly MelodyPhraseNote[] {
  if (phrase.length <= 3) return phrase.map((note) => ({ ...note }));
  const finalIndex = phrase.length - 1;
  const spacious = phrase.flatMap((note, index) => {
    const keep = index === 0 ||
      index === finalIndex ||
      (isAccent(note.positionBeats) && index % 2 === 0) ||
      index % 4 === 0;
    if (!keep) return [];
    return [{
      ...note,
      durationBeats: Math.min(1, Math.max(note.durationBeats, 1)),
      velocity: roundVelocity(note.velocity + 0.04),
    }];
  });
  if (spacious.length < phrase.length) return spacious;
  return phrase.filter((_, index) => index === 0 || index === finalIndex || index % 2 === 0).map((note) => ({
    ...note,
    durationBeats: Math.min(1, Math.max(note.durationBeats, 1)),
    velocity: roundVelocity(note.velocity + 0.04),
  }));
}

function createEnergeticHookPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    rootDegrees: readonly number[];
    scaleLength: number;
  },
): readonly MelodyPhraseNote[] {
  const bounds = extendRegisterBounds(getPhraseRegisterBounds(phrase, context.scaleLength), 1, 1);
  return phrase.map((note, index) => {
    const root = rootForPosition(note.positionBeats, context.rootDegrees);
    const target = isAccent(note.positionBeats)
      ? nearestDegree(note.scaleDegree, root + (index % 4 === 0 ? 4 : 2), context.scaleLength)
      : note.scaleDegree + (index % 2 === 0 ? 1 : -1);
    const nextNote = moveNoteToDegree(note, target, { bounds, scaleLength: context.scaleLength });
    return {
      ...nextNote,
      durationBeats: Math.min(note.durationBeats, 0.5),
      velocity: roundVelocity(nextNote.velocity + 0.11),
    };
  });
}

function createCadenceHookPhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  },
): readonly MelodyPhraseNote[] {
  const bounds = getPhraseRegisterBounds(phrase, context.scaleLength);
  const finalIndex = phrase.length - 1;
  const nextPhrase = phrase.map((note, index) => {
    const root = rootForPosition(note.positionBeats, context.rootDegrees);
    if (index === finalIndex || isPhraseFinal(note, context.phraseBeats)) {
      return moveNoteToDegree(note, nearestDegree(note.scaleDegree, root, context.scaleLength), {
        bounds,
        scaleLength: context.scaleLength,
      });
    }
    if (isAccent(note.positionBeats)) {
      return moveNoteToDegree(note, nearestDegree(note.scaleDegree, root + 2, context.scaleLength), {
        bounds,
        scaleLength: context.scaleLength,
      });
    }
    return { ...note };
  });
  const finalNote = nextPhrase[finalIndex];
  const penultimate = nextPhrase[finalIndex - 1];
  if (finalNote && penultimate) {
    const approach = finalNote.scaleDegree + (penultimate.scaleDegree >= finalNote.scaleDegree ? 1 : -1);
    nextPhrase[finalIndex - 1] = moveNoteToDegree(penultimate, approach, {
      bounds,
      scaleLength: context.scaleLength,
    });
  }
  return nextPhrase;
}

function moveNoteToDegree(
  note: MelodyPhraseNote,
  scaleDegree: number,
  context: {
    bounds: { min: number; max: number };
    scaleLength: number;
  },
): MelodyPhraseNote {
  return clampNoteToRegister({
    ...note,
    scaleDegree,
    octave: clampInteger(note.octave + octaveNudge(note.scaleDegree, scaleDegree, context.scaleLength), 1, 7),
  }, context.bounds, context.scaleLength);
}

function createMelodyRepairCandidate(input: {
  source: MelodyRepairCandidateSource;
  strategy: MelodyRepairCandidateStrategy;
  label: string;
  strategySummary: string;
  rank: number;
  songId: SongMaterial["id"];
  rawPhrase: readonly MelodyPhraseNote[];
  phrase: readonly MelodyPhraseNote[];
  events: readonly (PatternNoteSource | null)[];
  scores: readonly MelodyPhraseScore[];
  primaryScore: MelodyPhraseScore;
}): MelodyRepairCandidate {
  const phraseKey = createPhraseKey(input.phrase);
  const changedNotes = countChangedNotes(input.rawPhrase, input.phrase);
  const topCritique = input.primaryScore.critiques[0]?.message ?? "no urgent critique";
  return {
    id: `chorus-candidate-${input.songId}-${hashString(phraseKey).toString(36)}`,
    label: input.label,
    source: input.source,
    strategy: input.strategy,
    strategySummary: input.strategySummary,
    rank: input.rank,
    phraseKey,
    phrase: input.phrase.map((note) => ({ ...note })),
    events: input.events.map((event) => event ? { ...event } : null),
    scores: input.scores.map(cloneMelodyPhraseScore),
    primaryScore: cloneMelodyPhraseScore(input.primaryScore),
    changedNotes,
    critiqueCount: input.primaryScore.critiques.length,
    noteCount: input.phrase.length,
    scoreDeltaFromBest: 0,
    scoreDeltaFromDeterministic: 0,
    summary: [
      `${input.label}: ${input.primaryScore.total.toFixed(3)}`,
      input.strategy,
      `${changedNotes} changed`,
      topCritique,
    ].join(" | "),
  };
}

function chooseAlternatePhrase(
  phrase: readonly MelodyPhraseNote[],
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  },
  perspective: MelodyPerspective,
  rejectedPhraseKeys: ReadonlySet<string>,
): readonly MelodyPhraseNote[] {
  const alternatives: Array<{ key: string; score: number; phrase: readonly MelodyPhraseNote[] }> = [];
  for (let noteIndex = 0; noteIndex < phrase.length; noteIndex += 1) {
    for (const candidate of createRepairCandidates(phrase, noteIndex, context)) {
      const candidatePhrase = replacePhraseNote(phrase, noteIndex, candidate);
      const key = createPhraseKey(candidatePhrase);
      if (rejectedPhraseKeys.has(key)) continue;
      alternatives.push({
        key,
        score: scoreMelodyPhrase(candidatePhrase, context, perspective).total,
        phrase: candidatePhrase,
      });
    }
  }

  alternatives.sort((left, right) =>
    right.score - left.score || left.key.localeCompare(right.key)
  );
  return alternatives[0]?.phrase ?? phrase;
}

function createRepairCandidates(
  phrase: readonly MelodyPhraseNote[],
  noteIndex: number,
  context: {
    rootDegrees: readonly number[];
    scaleLength: number;
  },
): readonly MelodyPhraseNote[] {
  const note = phrase[noteIndex];
  if (!note) return [];
  const registerBounds = getPhraseRegisterBounds(phrase, context.scaleLength);
  const root = rootForPosition(note.positionBeats, context.rootDegrees);
  const chordCandidates = CHORD_TONE_OFFSETS.map((offset) =>
    nearestDegree(note.scaleDegree, root + offset, context.scaleLength)
  );
  const previous = phrase[noteIndex - 1];
  const next = phrase[noteIndex + 1];
  const contourDegree = previous && next
    ? Math.round((previous.scaleDegree + next.scaleDegree) / 2)
    : note.scaleDegree;
  const degrees = [
    note.scaleDegree - 1,
    note.scaleDegree + 1,
    ...chordCandidates,
    contourDegree,
    note.scaleDegree + 2,
    note.scaleDegree - 2,
  ];
  const candidates: MelodyPhraseNote[] = [];
  const seen = new Set<string>();

  for (const degree of degrees) {
    const candidate = {
      ...note,
      scaleDegree: degree,
      octave: clampInteger(note.octave + octaveNudge(note.scaleDegree, degree, context.scaleLength), 1, 7),
    };
    const boundedCandidate = clampNoteToRegister(candidate, registerBounds, context.scaleLength);
    const key = `${boundedCandidate.scaleDegree}:${boundedCandidate.octave}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(boundedCandidate);
  }

  for (const octaveDelta of [-1, 1]) {
    const candidate = clampNoteToRegister({
      ...note,
      octave: clampInteger(note.octave + octaveDelta, 1, 7),
    }, registerBounds, context.scaleLength);
    const key = `${candidate.scaleDegree}:${candidate.octave}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return candidates;
}

function scoreLanding(
  phrase: readonly MelodyPhraseNote[],
  context: {
    phraseBeats: number;
    rootDegrees: readonly number[];
    scaleLength: number;
  },
  critiques: MelodyCritique[],
): number {
  if (phrase.length === 0) return 0;
  let checks = 0;
  let penalties = 0;

  for (let index = 0; index < phrase.length; index += 1) {
    const note = phrase[index];
    const important = isAccent(note.positionBeats) || isPhraseFinal(note, context.phraseBeats);
    if (important) {
      checks += 1;
      if (!isChordTone(note.scaleDegree, rootForPosition(note.positionBeats, context.rootDegrees), context.scaleLength)) {
        penalties += 1;
        critiques.push({
          noteIndex: index,
          code: "off-chord-landing",
          message: `note ${index + 1}: off-chord landing on an accented or final beat`,
        });
      }
    }

    const previous = phrase[index - 1];
    const next = phrase[index + 1];
    if (previous && next) {
      const leap = melodicPosition(note, context.scaleLength) -
        melodicPosition(previous, context.scaleLength);
      const resolution = melodicPosition(next, context.scaleLength) -
        melodicPosition(note, context.scaleLength);
      if (Math.abs(leap) >= LEAP_INTERVAL_THRESHOLD) {
        checks += 1;
        if (!(Math.sign(resolution) === -Math.sign(leap) && Math.abs(resolution) <= 2)) {
          penalties += 1;
          critiques.push({
            noteIndex: index,
            code: "unresolved-leap",
            message: `note ${index + 1}: unresolved leap should turn back by step`,
          });
        }
      }
    }
  }

  const finalNote = phrase.at(-1);
  if (finalNote) {
    checks += 1;
    const root = rootForPosition(finalNote.positionBeats, context.rootDegrees);
    const finalClass = normalizeDegree(finalNote.scaleDegree, context.scaleLength);
    if (
      finalClass !== normalizeDegree(root, context.scaleLength) &&
      finalClass !== normalizeDegree(root + 2, context.scaleLength)
    ) {
      penalties += 1;
      critiques.push({
        noteIndex: phrase.length - 1,
        code: "weak-cadence",
        message: `note ${phrase.length}: cadence does not settle on root or third`,
      });
    }
  }

  return roundScore(1 - penalties / Math.max(1, checks));
}

function scoreMonotony(
  phrase: readonly MelodyPhraseNote[],
  scaleLength: number,
  critiques: MelodyCritique[],
): number {
  if (phrase.length <= 2) return 0.5;
  const intervals = phrase.slice(1).map((note, index) =>
    melodicPosition(note, scaleLength) - melodicPosition(phrase[index], scaleLength)
  );
  let penalty = 0;
  const uniquePitchClasses = new Set(phrase.map((note) => normalizeDegree(note.scaleDegree, scaleLength))).size;
  const varietyRatio = uniquePitchClasses / Math.max(1, phrase.length);

  if (varietyRatio < 0.38) {
    penalty += 0.28;
    critiques.push({
      noteIndex: 0,
      range: [1, phrase.length],
      code: "narrow-variety",
      message: `1-${phrase.length}: narrow pitch-class variety`,
    });
  }

  const repeatedRunStart = findRepeatedIntervalRun(intervals);
  if (repeatedRunStart >= 0) {
    penalty += 0.24;
    critiques.push({
      noteIndex: repeatedRunStart,
      range: [repeatedRunStart + 1, repeatedRunStart + 4],
      code: "repeated-run",
      message: `${repeatedRunStart + 1}-${repeatedRunStart + 4}: repeated interval run`,
    });
  }

  const oneWayStart = findOneWayStretch(intervals);
  if (oneWayStart >= 0) {
    penalty += 0.22;
    critiques.push({
      noteIndex: oneWayStart,
      range: [oneWayStart + 1, oneWayStart + 5],
      code: "one-way-stretch",
      message: `${oneWayStart + 1}-${oneWayStart + 5}: long one-direction stretch`,
    });
  }

  if (hasExactRepeatCell(phrase, scaleLength)) {
    penalty += 0.18;
    critiques.push({
      noteIndex: 0,
      range: [1, phrase.length],
      code: "exact-repeat-cell",
      message: "phrase repeats a cell too exactly",
    });
  }

  return roundScore(Math.max(0, 1 - penalty));
}

function scoreSurprise(
  phrase: readonly MelodyPhraseNote[],
  perspective: MelodyPerspective,
  critiques: MelodyCritique[],
): { score: number; averageSurprise: number } {
  if (phrase.length === 0) return { score: 0, averageSurprise: 0 };
  const surprises = phrase.map((note, index) => noteSurprise(note, phrase[index - 1], perspective));
  surprises.forEach((surprise, index) => {
    if (surprise < perspective.surpriseTarget * 0.42) {
      critiques.push({
        noteIndex: index,
        code: "too-expected",
        message: `note ${index + 1}: too expected for ${perspective.label}`,
      });
    } else if (surprise > Math.min(1, perspective.surpriseTarget + perspective.surpriseTolerance * 1.5)) {
      critiques.push({
        noteIndex: index,
        code: "too-jarring",
        message: `note ${index + 1}: too abrupt for ${perspective.label}`,
      });
    }
  });
  const averageSurprise = roundScore(
    surprises.reduce((sum, surprise) => sum + surprise, 0) / Math.max(1, surprises.length),
  );
  const distance = Math.abs(averageSurprise - perspective.surpriseTarget);
  return {
    averageSurprise,
    score: roundScore(Math.max(0, 1 - distance / perspective.surpriseTolerance)),
  };
}

function noteSurprise(
  note: MelodyPhraseNote,
  previous: MelodyPhraseNote | undefined,
  perspective: MelodyPerspective,
): number {
  const degreeClass = normalizeDegree(note.scaleDegree);
  const degreeCount = perspective.prior.degreeCounts.get(degreeClass) ?? 0;
  const degreeProbability = (degreeCount + 1) / (perspective.prior.totalDegrees + 7);
  const interval = previous
    ? clampInteger(melodicPosition(note) - melodicPosition(previous), -14, 14)
    : 0;
  const intervalCount = perspective.prior.intervalCounts.get(interval) ?? 0;
  const intervalProbability = (intervalCount + 1) / (perspective.prior.totalIntervals + 29);
  return roundScore(clamp((-Math.log2(degreeProbability * intervalProbability)) / 10, 0, 1));
}

function createMelodyPerspective(
  player: Player,
  song: SongMaterial,
  feedbackNudge: number,
): MelodyPerspective {
  const disposition = player.thinking.disposition;
  const landingWeight = Math.max(
    0.1,
    0.34 + disposition.caution * 0.2 + disposition.steadiness * 0.12 - feedbackNudge * 0.5,
  );
  const monotonyWeight = Math.max(
    0.1,
    0.24 + disposition.novelty * 0.18 + disposition.responsiveness * 0.08 + feedbackNudge * 0.2,
  );
  const surpriseWeight = Math.max(
    0.1,
    0.26 + disposition.novelty * 0.18 + disposition.disruption * 0.12 + feedbackNudge * 0.6,
  );
  const weightSum = landingWeight + monotonyWeight + surpriseWeight;
  const surpriseTarget = clamp(
    0.18 + disposition.novelty * 0.32 + disposition.disruption * 0.18 - disposition.caution * 0.08 +
      feedbackNudge,
    0.14,
    0.72,
  );

  return {
    playerId: player.id,
    label: player.displayName,
    weights: {
      landing: roundScore(landingWeight / weightSum),
      monotony: roundScore(monotonyWeight / weightSum),
      surprise: roundScore(surpriseWeight / weightSum),
    },
    surpriseTarget: roundScore(surpriseTarget),
    surpriseTolerance: roundScore(0.24 + player.thinking.disposition.disruption * 0.1),
    prior: buildPrior(player, song),
  };
}

function buildPrior(player: Player, song: SongMaterial): MelodyPerspective["prior"] {
  const degreeCounts = new Map<number, number>();
  const intervalCounts = new Map<number, number>();
  let totalDegrees = 0;
  let totalIntervals = 0;

  for (const phrase of player.thinking.influencePhrases) {
    addPriorDegrees(phrase.scaleDegrees);
  }

  for (const pattern of song.patterns) {
    addPriorDegrees(pattern.events.flatMap((event) => event ? [event.scaleDegree] : []));
  }

  function addPriorDegrees(degrees: readonly number[]): void {
    for (let index = 0; index < degrees.length; index += 1) {
      const degree = normalizeDegree(degrees[index]);
      degreeCounts.set(degree, (degreeCounts.get(degree) ?? 0) + 1);
      totalDegrees += 1;
      if (index <= 0) continue;
      const interval = clampInteger(degrees[index] - degrees[index - 1], -14, 14);
      intervalCounts.set(interval, (intervalCounts.get(interval) ?? 0) + 1);
      totalIntervals += 1;
    }
  }

  return {
    degreeCounts,
    intervalCounts,
    totalDegrees,
    totalIntervals,
  };
}

function collectRawChorusEvents(
  song: SongMaterial,
  melodyPattern: PlayerPatternSource,
  tonalContext: TonalContext,
): readonly (PatternNoteSource | null)[] {
  const events: Array<PatternNoteSource | null> = [];
  const stepCount = Math.round(MELODY_CHORUS_PHRASE_BEATS / melodyPattern.subdivisionBeats);
  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    const localBeat = stepIndex * melodyPattern.subdivisionBeats;
    const absoluteBeat = CHORUS_START_BEAT + localBeat;
    const sourceIndex = Math.round(absoluteBeat / melodyPattern.subdivisionBeats) % melodyPattern.events.length;
    events.push(arrangeSongFormPatternEvent({
      song,
      pattern: melodyPattern,
      sourceEvent: melodyPattern.events[sourceIndex] ?? null,
      stepIndex: sourceIndex,
      absoluteBeat,
      tonalContext,
      arrangement: DEFAULT_SONG_ARRANGEMENT,
      chorusDevelopment: { mode: "raw" },
    }));
  }
  return events;
}

function phraseFromEvents(
  events: readonly (PatternNoteSource | null)[],
  subdivisionBeats: number,
): readonly MelodyPhraseNote[] {
  return events.flatMap((event, index) => event ? [{
    stepIndex: index,
    positionBeats: index * subdivisionBeats,
    scaleDegree: event.scaleDegree,
    octave: event.octave,
    durationBeats: event.durationBeats,
    velocity: event.velocity,
  }] : []);
}

function eventsFromPhrase(
  rawEvents: readonly (PatternNoteSource | null)[],
  phrase: readonly MelodyPhraseNote[],
): readonly (PatternNoteSource | null)[] {
  const events = rawEvents.map((event) => event ? { ...event } : null);
  const phraseStepIndexes = new Set(phrase.map((note) => note.stepIndex));
  for (let index = 0; index < events.length; index += 1) {
    if (events[index] && !phraseStepIndexes.has(index)) {
      events[index] = null;
    }
  }
  for (const note of phrase) {
    const event = events[note.stepIndex];
    if (!event) continue;
    events[note.stepIndex] = {
      ...event,
      scaleDegree: note.scaleDegree,
      octave: note.octave,
      durationBeats: note.durationBeats,
      velocity: note.velocity,
      duration: note.durationBeats >= 1 ? "4n" : event.duration,
    };
  }
  return events;
}

function getPatternForPlayer(song: SongMaterial, playerId: string): PlayerPatternSource {
  const pattern = song.patterns.find((candidate) =>
    candidate.events.some((event) => event?.playerId === playerId)
  );
  if (!pattern) {
    throw new Error(`Missing ${playerId} pattern for song ${song.id}`);
  }
  return pattern;
}

function getFlaggedNoteIndexes(critiques: readonly MelodyCritique[], noteCount: number): readonly number[] {
  const indexes = new Set<number>();
  for (const critique of critiques) {
    if (critique.range) {
      for (let index = critique.range[0] - 1; index < critique.range[1]; index += 1) {
        if (index >= 0 && index < noteCount) indexes.add(index);
      }
    } else if (critique.noteIndex >= 0 && critique.noteIndex < noteCount) {
      indexes.add(critique.noteIndex);
    }
  }
  return [...indexes].sort((left, right) => left - right);
}

function replacePhraseNote(
  phrase: readonly MelodyPhraseNote[],
  noteIndex: number,
  note: MelodyPhraseNote,
): readonly MelodyPhraseNote[] {
  return phrase.map((candidate, index) => index === noteIndex ? { ...note } : { ...candidate });
}

function countChangedNotes(
  rawPhrase: readonly MelodyPhraseNote[],
  candidatePhrase: readonly MelodyPhraseNote[],
): number {
  const rawByStep = new Map(rawPhrase.map((note) => [note.stepIndex, note]));
  const candidateSteps = new Set(candidatePhrase.map((note) => note.stepIndex));
  let changed = 0;
  for (const raw of rawPhrase) {
    if (!candidateSteps.has(raw.stepIndex)) {
      changed += 1;
    }
  }
  for (const note of candidatePhrase) {
    const raw = rawByStep.get(note.stepIndex);
    if (
      !raw ||
      raw.scaleDegree !== note.scaleDegree ||
      raw.octave !== note.octave ||
      raw.durationBeats !== note.durationBeats ||
      Math.abs(raw.velocity - note.velocity) > 0.0001
    ) {
      changed += 1;
    }
  }
  return changed;
}

function cloneMelodyPhraseScore(score: MelodyPhraseScore): MelodyPhraseScore {
  return {
    ...score,
    weights: { ...score.weights },
    critiques: score.critiques.map((critique) => ({
      ...critique,
      range: critique.range ? [critique.range[0], critique.range[1]] : undefined,
    })),
  };
}

function rootForPosition(positionBeats: number, roots: readonly number[]): number {
  if (roots.length === 0) return 0;
  return roots[Math.floor(positionBeats / 4) % roots.length] ?? roots[0] ?? 0;
}

function isChordTone(scaleDegree: number, rootDegree: number, scaleLength: number): boolean {
  const noteClass = normalizeDegree(scaleDegree, scaleLength);
  return CHORD_TONE_OFFSETS.some((offset) =>
    normalizeDegree(rootDegree + offset, scaleLength) === noteClass
  );
}

function getPhraseRegisterBounds(
  phrase: readonly MelodyPhraseNote[],
  scaleLength: number,
): { min: number; max: number } {
  if (phrase.length === 0) {
    return {
      min: 0,
      max: scaleLength * 7,
    };
  }
  const positions = phrase.map((note) => melodicPosition(note, scaleLength));
  return {
    min: Math.min(...positions) - REPAIR_REGISTER_PADDING,
    max: Math.max(...positions) + REPAIR_REGISTER_PADDING,
  };
}

function extendRegisterBounds(
  bounds: { min: number; max: number },
  below: number,
  above: number,
): { min: number; max: number } {
  return {
    min: bounds.min - below,
    max: bounds.max + above,
  };
}

function clampNoteToRegister(
  note: MelodyPhraseNote,
  bounds: { min: number; max: number },
  scaleLength: number,
): MelodyPhraseNote {
  let nextNote = { ...note };
  let position = melodicPosition(nextNote, scaleLength);
  while (position < bounds.min && nextNote.octave < 7) {
    nextNote = { ...nextNote, octave: nextNote.octave + 1 };
    position = melodicPosition(nextNote, scaleLength);
  }
  while (position > bounds.max && nextNote.octave > 1) {
    nextNote = { ...nextNote, octave: nextNote.octave - 1 };
    position = melodicPosition(nextNote, scaleLength);
  }
  return nextNote;
}

function melodicPosition(note: MelodyPhraseNote, scaleLength = 7): number {
  return note.octave * Math.max(1, scaleLength) + note.scaleDegree;
}

function nearestDegree(currentDegree: number, targetClass: number, scaleLength: number): number {
  let bestDegree = currentDegree;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let octaveOffset = -2; octaveOffset <= 2; octaveOffset += 1) {
    const candidate = normalizeDegree(targetClass, scaleLength) + octaveOffset * scaleLength;
    const distance = Math.abs(candidate - currentDegree);
    if (distance < bestDistance || (distance === bestDistance && candidate < bestDegree)) {
      bestDegree = candidate;
      bestDistance = distance;
    }
  }
  return bestDegree;
}

function octaveNudge(fromDegree: number, toDegree: number, scaleLength: number): number {
  if (scaleLength <= 0) return 0;
  return Math.trunc(toDegree / scaleLength) - Math.trunc(fromDegree / scaleLength);
}

function isAccent(positionBeats: number): boolean {
  return Math.abs(positionBeats - Math.round(positionBeats)) < 0.000001;
}

function isPhraseFinal(note: MelodyPhraseNote, phraseBeats: number): boolean {
  return note.positionBeats + note.durationBeats >= phraseBeats - 0.000001;
}

function findRepeatedIntervalRun(intervals: readonly number[]): number {
  for (let index = 0; index <= intervals.length - 3; index += 1) {
    if (
      intervals[index] !== 0 &&
      intervals[index] === intervals[index + 1] &&
      intervals[index] === intervals[index + 2]
    ) {
      return index;
    }
  }
  return -1;
}

function findOneWayStretch(intervals: readonly number[]): number {
  for (let index = 0; index <= intervals.length - 4; index += 1) {
    const signs = intervals.slice(index, index + 4).map(Math.sign);
    if (signs.every((sign) => sign > 0) || signs.every((sign) => sign < 0)) {
      return index;
    }
  }
  return -1;
}

function hasExactRepeatCell(phrase: readonly MelodyPhraseNote[], scaleLength: number): boolean {
  if (phrase.length < 6 || phrase.length % 2 !== 0) return false;
  const half = phrase.length / 2;
  const left = phrase.slice(0, half).map((note) => normalizeDegree(note.scaleDegree, scaleLength)).join(",");
  const right = phrase.slice(half).map((note) => normalizeDegree(note.scaleDegree, scaleLength)).join(",");
  return left === right;
}

function normalizeDegree(degree: number, scaleLength = 7): number {
  return modulo(degree, Math.max(1, scaleLength));
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(clamp(value, minimum, maximum));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000) / 1_000;
}

function roundSignedScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function formatSignedDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function roundVelocity(value: number): number {
  return Math.round(clamp(value, 0.08, 0.72) * 1_000) / 1_000;
}

function validateRequiredTextField(
  field: string,
  value: string,
  maxLength: number,
  errors: string[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} is required`);
    return;
  }
  if (value.trim().length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or fewer`);
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}
