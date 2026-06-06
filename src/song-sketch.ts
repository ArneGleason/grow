import type { TonalContext } from "./listening";
import type { PlayerRole } from "./players";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";

export type SongSketchStatus = "draft";
export type SongSketchAssignmentStance = "anchor" | "support" | "lead" | "respond";
export type SongSketchProposalStatus = "mock" | "model";
export type SongSketchProposalKind = "preserve_space" | "tighten_roots" | "answer_motif";
export type SongSketchResponseStance = "accept" | "modify" | "resist" | "defer";

export interface SongSketchPlayerRef {
  playerId: string;
  role: PlayerRole;
}

export interface SongSketchSection {
  id: string;
  label: string;
  startBeat: number;
  durationBeats: number;
  chordPlan: readonly string[];
  rootDegrees: readonly number[];
  cue: string;
}

export interface SongSketchAssignment {
  playerId: string;
  role: PlayerRole;
  stance: SongSketchAssignmentStance;
  density: number;
  brief: string;
  constraints: readonly string[];
}

export interface SongSketch {
  id: string;
  title: string;
  status: SongSketchStatus;
  sourceSongId: SongMaterial["id"];
  proposerPlayerId: string;
  affectedPlayerIds: readonly string[];
  createdAtBeat: number;
  meter: [number, number];
  tonalContext: {
    tonic: string;
    mode: string;
    scale: readonly string[];
  };
  sections: readonly SongSketchSection[];
  assignments: readonly SongSketchAssignment[];
  openQuestions: readonly string[];
}

export interface SongSketchProposalResponse {
  playerId: string;
  role: PlayerRole;
  stance: SongSketchResponseStance;
  reason: string;
  requestedChange?: string;
}

export interface SongSketchProposal {
  id: string;
  status: SongSketchProposalStatus;
  sketchId: string;
  sourceSongId: SongMaterial["id"];
  proposedByPlayerId: string;
  targetSectionId: string;
  kind: SongSketchProposalKind;
  summary: string;
  requestedAction: string;
  chordPlan: readonly string[];
  rootDegrees: readonly number[];
  responses: readonly SongSketchProposalResponse[];
}

export interface SongSketchProposalTextResponse {
  playerId: string;
  reason: string;
  requestedChange?: string;
}

export interface SongSketchProposalText {
  summary: string;
  requestedAction: string;
  responses: readonly SongSketchProposalTextResponse[];
}

export interface SongSketchProposalTextValidation {
  valid: boolean;
  errors: string[];
}

export const SONG_SKETCH_PROPOSAL_TEXT_LIMITS = {
  summary: 220,
  requestedAction: 220,
  reason: 220,
  requestedChange: 220,
} as const;

export function createInspectOnlySongSketch(input: {
  song: SongMaterial;
  players: readonly SongSketchPlayerRef[];
  tonalContext: TonalContext;
  currentBeat: number;
  meter?: [number, number];
}): SongSketch {
  const proposer = input.players.find((player) => player.role === "melody") ?? input.players[0];
  const analysis = analyzeSongMaterial(input.song.patterns);
  const sectionRoots = createSectionRootPlans(analysis, input.players);
  const sectionDurationBeats = analysis.loopLengthBeats;
  const gatherChordPlan = sectionRoots.gather.map((degree) =>
    romanNumeralFromRootDegree(input.tonalContext, degree)
  );
  const answerChordPlan = sectionRoots.answer.map((degree) =>
    romanNumeralFromRootDegree(input.tonalContext, degree)
  );

  return {
    id: `sketch-${input.song.id}-${input.tonalContext.tonic.toLowerCase()}-${input.tonalContext.mode}`,
    title: `${input.song.label} working sketch`,
    status: "draft",
    sourceSongId: input.song.id,
    proposerPlayerId: proposer?.playerId ?? "ensemble",
    affectedPlayerIds: input.players.map((player) => player.playerId),
    createdAtBeat: roundBeat(input.currentBeat),
    meter: input.meter ?? [4, 4],
    tonalContext: {
      tonic: input.tonalContext.tonic,
      mode: input.tonalContext.mode,
      scale: [...input.tonalContext.scale],
    },
    sections: [
      {
        id: "gather",
        label: "Gather",
        startBeat: 0,
        durationBeats: sectionDurationBeats,
        chordPlan: gatherChordPlan,
        rootDegrees: sectionRoots.gather,
        cue: createGatherCue(analysis),
      },
      {
        id: "answer",
        label: "Answer",
        startBeat: sectionDurationBeats,
        durationBeats: sectionDurationBeats,
        chordPlan: answerChordPlan,
        rootDegrees: sectionRoots.answer,
        cue: createAnswerCue(analysis),
      },
    ],
    assignments: input.players.map((player) => createAssignment(player, analysis)),
    openQuestions: createOpenQuestions(analysis),
  };
}

export function createInspectOnlySongSketchProposal(sketch: SongSketch): SongSketchProposal {
  const targetSection = chooseProposalSection(sketch);
  const melodyAssignment = sketch.assignments.find((assignment) => assignment.role === "melody");
  const bassAssignment = sketch.assignments.find((assignment) => assignment.role === "bass");
  const kind = chooseProposalKind(targetSection, melodyAssignment, bassAssignment);

  return {
    id: `proposal-${sketch.id}-${targetSection.id}-${kind}`,
    status: "mock",
    sketchId: sketch.id,
    sourceSongId: sketch.sourceSongId,
    proposedByPlayerId: sketch.proposerPlayerId,
    targetSectionId: targetSection.id,
    kind,
    summary: createProposalSummary(kind, targetSection),
    requestedAction: createProposalAction(kind, targetSection),
    chordPlan: [...targetSection.chordPlan],
    rootDegrees: [...targetSection.rootDegrees],
    responses: sketch.assignments.map((assignment) =>
      createProposalResponse(assignment, targetSection, kind)
    ),
  };
}

export function createMockSongSketchProposalText(
  proposal: SongSketchProposal,
): SongSketchProposalText {
  return {
    summary: proposal.summary,
    requestedAction: proposal.requestedAction,
    responses: proposal.responses.map((response) => ({
      playerId: response.playerId,
      reason: response.reason,
      requestedChange: response.requestedChange,
    })),
  };
}

export function validateSongSketchProposalText(
  text: SongSketchProposalText,
  proposal: SongSketchProposal,
): SongSketchProposalTextValidation {
  const errors: string[] = [];
  validateRequiredTextField("summary", text.summary, SONG_SKETCH_PROPOSAL_TEXT_LIMITS.summary, errors);
  validateRequiredTextField(
    "requestedAction",
    text.requestedAction,
    SONG_SKETCH_PROPOSAL_TEXT_LIMITS.requestedAction,
    errors,
  );

  const expectedPlayerIds = proposal.responses.map((response) => response.playerId);
  const expectedPlayerIdSet = new Set(expectedPlayerIds);
  const seenPlayerIds = new Set<string>();

  if (!Array.isArray(text.responses)) {
    errors.push("responses must be an array");
  } else {
    if (text.responses.length !== proposal.responses.length) {
      errors.push(`responses must include exactly ${proposal.responses.length} player response(s)`);
    }
    for (const response of text.responses) {
      if (!expectedPlayerIdSet.has(response.playerId)) {
        errors.push(`responses contains unknown playerId ${response.playerId || "(blank)"}`);
        continue;
      }
      if (seenPlayerIds.has(response.playerId)) {
        errors.push(`responses contains duplicate playerId ${response.playerId}`);
      }
      seenPlayerIds.add(response.playerId);
      validateRequiredTextField(
        `responses.${response.playerId}.reason`,
        response.reason,
        SONG_SKETCH_PROPOSAL_TEXT_LIMITS.reason,
        errors,
      );
      validateOptionalTextField(
        `responses.${response.playerId}.requestedChange`,
        response.requestedChange,
        SONG_SKETCH_PROPOSAL_TEXT_LIMITS.requestedChange,
        errors,
      );
    }
  }

  for (const playerId of expectedPlayerIds) {
    if (!seenPlayerIds.has(playerId)) {
      errors.push(`responses is missing playerId ${playerId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function applySongSketchProposalText(
  proposal: SongSketchProposal,
  text: SongSketchProposalText,
  status: SongSketchProposalStatus,
): SongSketchProposal {
  const textResponsesByPlayer = new Map(text.responses.map((response) => [
    response.playerId,
    response,
  ]));
  return {
    ...proposal,
    status,
    summary: text.summary.trim(),
    requestedAction: text.requestedAction.trim(),
    chordPlan: [...proposal.chordPlan],
    rootDegrees: [...proposal.rootDegrees],
    responses: proposal.responses.map((response) => {
      const textResponse = textResponsesByPlayer.get(response.playerId);
      return {
        ...response,
        reason: textResponse?.reason.trim() ?? response.reason,
        requestedChange: textResponse
          ? normalizeOptionalText(textResponse.requestedChange)
          : response.requestedChange,
      };
    }),
  };
}

export function rootNoteFromScaleDegree(
  tonalContext: TonalContext,
  degree: number,
): string {
  if (tonalContext.scale.length === 0) return `d${degree}`;
  return tonalContext.scale[modulo(degree, tonalContext.scale.length)] ?? `d${degree}`;
}

function createAssignment(
  player: SongSketchPlayerRef,
  analysis: SongMaterialAnalysis,
): SongSketchAssignment {
  const density = getPlayerDensity(analysis, player.playerId);
  const densityLabel = describeDensity(density);

  if (player.role === "pulse") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "anchor",
      density,
      brief: `Mark the shared floor; the source loop is ${densityLabel}.`,
      constraints: ["avoid constant fill", "leave breaks intentional", createDensityConstraint(density)],
    };
  }

  if (player.role === "bass") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "support",
      density,
      brief: `Outline the chord roots; the source loop is ${densityLabel}.`,
      constraints: ["stay modal", "answer melody without taking over", createDensityConstraint(density)],
    };
  }

  if (player.role === "melody") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "lead",
      density,
      brief: `Bring one motif shaped by the source loop's ${densityLabel} melody density.`,
      constraints: ["keep register shifts bounded", "leave room for bass response", createDensityConstraint(density)],
    };
  }

  return {
    playerId: player.playerId,
    role: player.role,
    stance: "respond",
    density,
    brief: `React to the source loop's ${densityLabel} activity without forcing a new form.`,
    constraints: ["stay inspectable", "avoid private key changes", createDensityConstraint(density)],
  };
}

interface PatternOnset {
  degree: number;
  positionBeat: number;
}

interface PlayerPatternSummary {
  playerId: string;
  activeSlots: number;
  totalSlots: number;
  density: number;
  loopLengthBeats: number;
  onsets: readonly PatternOnset[];
}

interface SongMaterialAnalysis {
  loopLengthBeats: number;
  byPlayer: ReadonlyMap<string, PlayerPatternSummary>;
  fallbackRootDegrees: readonly number[];
}

function analyzeSongMaterial(patterns: readonly PlayerPatternSource[]): SongMaterialAnalysis {
  const mutableSummaries = new Map<string, {
    activeSlots: number;
    totalSlots: number;
    loopLengthBeats: number;
    onsets: PatternOnset[];
  }>();
  const degreeCounts = new Map<number, number>();
  let loopLengthBeats = 1;

  for (const pattern of patterns) {
    const patternPlayerId = getPatternPlayerId(pattern);
    const patternLengthBeats = pattern.events.length * pattern.subdivisionBeats;
    loopLengthBeats = Math.max(loopLengthBeats, patternLengthBeats);

    if (!patternPlayerId) continue;

    const summary = getMutableSummary(mutableSummaries, patternPlayerId);
    summary.totalSlots += pattern.events.length;
    summary.loopLengthBeats = Math.max(summary.loopLengthBeats, patternLengthBeats);

    pattern.events.forEach((event, index) => {
      if (!event) return;
      summary.activeSlots += 1;
      summary.onsets.push({
        degree: normalizeDegree(event.scaleDegree),
        positionBeat: index * pattern.subdivisionBeats,
      });
      degreeCounts.set(
        normalizeDegree(event.scaleDegree),
        (degreeCounts.get(normalizeDegree(event.scaleDegree)) ?? 0) + 1,
      );
    });
  }

  const byPlayer = new Map<string, PlayerPatternSummary>();
  for (const [playerId, summary] of mutableSummaries) {
    byPlayer.set(playerId, {
      playerId,
      activeSlots: summary.activeSlots,
      totalSlots: summary.totalSlots,
      density: roundRatio(summary.totalSlots === 0 ? 0 : summary.activeSlots / summary.totalSlots),
      loopLengthBeats: roundBeat(summary.loopLengthBeats),
      onsets: summary.onsets.map((onset) => ({ ...onset })),
    });
  }

  return {
    loopLengthBeats: roundBeat(loopLengthBeats),
    byPlayer,
    fallbackRootDegrees: createFallbackRootDegrees(degreeCounts),
  };
}

function getPatternPlayerId(pattern: PlayerPatternSource): string | undefined {
  return pattern.events.find((event): event is PatternNoteSource => event !== null)?.playerId;
}

function getMutableSummary(
  summaries: Map<string, {
    activeSlots: number;
    totalSlots: number;
    loopLengthBeats: number;
    onsets: PatternOnset[];
  }>,
  playerId: string,
): {
  activeSlots: number;
  totalSlots: number;
  loopLengthBeats: number;
  onsets: PatternOnset[];
} {
  const existing = summaries.get(playerId);
  if (existing) return existing;
  const nextSummary = { activeSlots: 0, totalSlots: 0, loopLengthBeats: 0, onsets: [] };
  summaries.set(playerId, nextSummary);
  return nextSummary;
}

function createSectionRootPlans(
  analysis: SongMaterialAnalysis,
  players: readonly SongSketchPlayerRef[],
): {
  gather: readonly number[];
  answer: readonly number[];
} {
  const bassPlayerId = players.find((player) => player.role === "bass")?.playerId;
  const bassSummary = bassPlayerId ? analysis.byPlayer.get(bassPlayerId) : undefined;
  const bassOnsets = bassSummary?.onsets ?? [];
  const sectionLengthBeats = bassSummary?.loopLengthBeats ?? analysis.loopLengthBeats;
  const splitBeat = sectionLengthBeats > 0 ? sectionLengthBeats / 2 : 0;
  const gather = uniqueDegreesInOrder(
    bassOnsets.filter((onset) => onset.positionBeat < splitBeat).map((onset) => onset.degree),
  );
  const answer = uniqueDegreesInOrder(
    bassOnsets.filter((onset) => onset.positionBeat >= splitBeat).map((onset) => onset.degree),
  );
  const fallback = analysis.fallbackRootDegrees.length > 0
    ? analysis.fallbackRootDegrees
    : [0];

  return {
    gather: limitPlan(gather.length > 0 ? gather : fallback),
    answer: limitPlan(answer.length > 0 ? answer : fallback),
  };
}

function createFallbackRootDegrees(degreeCounts: ReadonlyMap<number, number>): readonly number[] {
  return [...degreeCounts.entries()]
    .sort(([leftDegree, leftCount], [rightDegree, rightCount]) =>
      rightCount - leftCount || leftDegree - rightDegree
    )
    .slice(0, 4)
    .map(([degree]) => degree);
}

function uniqueDegreesInOrder(degrees: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const degree of degrees) {
    if (seen.has(degree)) continue;
    seen.add(degree);
    unique.push(degree);
  }
  return unique;
}

function limitPlan(degrees: readonly number[]): readonly number[] {
  return degrees.slice(0, 4);
}

function romanNumeralFromRootDegree(tonalContext: TonalContext, degree: number): string {
  if (tonalContext.scale.length === 0) return `d${degree}`;
  const degreeIndex = modulo(degree, tonalContext.scale.length);
  const baseRoman = ROMAN_ROOTS[degreeIndex] ?? `d${degreeIndex + 1}`;
  const tonicSemitone = pitchClassToSemitone(tonalContext.tonic);
  const rootSemitone = pitchClassToSemitone(rootNoteFromScaleDegree(tonalContext, degree));
  const majorInterval = MAJOR_SCALE_INTERVALS[degreeIndex];
  if (
    tonicSemitone === undefined ||
    rootSemitone === undefined ||
    majorInterval === undefined
  ) {
    return baseRoman;
  }

  const interval = modulo(rootSemitone - tonicSemitone, 12);
  const alteration = normalizeSemitoneDelta(interval - majorInterval);
  return `${formatAlteration(alteration)}${baseRoman}`;
}

function createGatherCue(analysis: SongMaterialAnalysis): string {
  const melodyDensity = getPlayerDensity(analysis, "melody");
  if (melodyDensity < 0.4) {
    return "Hold the loop's air open so the sparse melody becomes intentional.";
  }
  return "Establish the loop's root motion and let the main motif be noticed.";
}

function createAnswerCue(analysis: SongMaterialAnalysis): string {
  const bassDensity = getPlayerDensity(analysis, "bass");
  if (bassDensity < 0.4) {
    return "Answer with restraint; the bass pattern is already leaving large gaps.";
  }
  return "Answer from the loop's back half and decide where density should relax.";
}

function createOpenQuestions(analysis: SongMaterialAnalysis): readonly string[] {
  const melodyDensity = getPlayerDensity(analysis, "melody");
  const bassRoots = analysis.byPlayer.get("bass")?.onsets.map((onset) => onset.degree) ?? [];
  return [
    melodyDensity < 0.4
      ? "How much silence can the melody keep before the answer needs motion?"
      : "Which melodic cell should become the repeatable motif?",
    bassRoots.length > 3
      ? "Which bass root change is the cue everyone should recognize?"
      : "Should the bass roots stay spacious or pull the loop forward?",
    "What cue tells the group this draft is ready to practice?",
  ];
}

function chooseProposalSection(sketch: SongSketch): SongSketchSection {
  return sketch.sections.find((section) => section.id === "answer") ??
    sketch.sections[0] ??
    createEmptySection();
}

function chooseProposalKind(
  section: SongSketchSection,
  melodyAssignment: SongSketchAssignment | undefined,
  bassAssignment: SongSketchAssignment | undefined,
): SongSketchProposalKind {
  if ((melodyAssignment?.density ?? 0) < 0.4) return "preserve_space";
  if ((bassAssignment?.density ?? 0) > 0.45 || section.rootDegrees.length > 2) {
    return "tighten_roots";
  }
  return "answer_motif";
}

function createProposalSummary(
  kind: SongSketchProposalKind,
  section: SongSketchSection,
): string {
  if (kind === "preserve_space") {
    return `Try ${section.label} as a spacious answer instead of filling the gaps.`;
  }
  if (kind === "tighten_roots") {
    return `Try ${section.label} with the root changes treated as explicit cues.`;
  }
  return `Try ${section.label} as a motif answer over the current root plan.`;
}

function createProposalAction(
  kind: SongSketchProposalKind,
  section: SongSketchSection,
): string {
  const plan = section.chordPlan.join("-");
  if (kind === "preserve_space") {
    return `Keep ${section.label} sparse over ${plan}.`;
  }
  if (kind === "tighten_roots") {
    return `Practice ${section.label} root cues over ${plan}.`;
  }
  return `Trade a short motif across ${section.label} over ${plan}.`;
}

function createProposalResponse(
  assignment: SongSketchAssignment,
  section: SongSketchSection,
  kind: SongSketchProposalKind,
): SongSketchProposalResponse {
  if (assignment.role === "pulse") {
    return {
      playerId: assignment.playerId,
      role: assignment.role,
      stance: section.rootDegrees.length > 2 ? "modify" : "accept",
      reason: section.rootDegrees.length > 2
        ? "Too many root cues can blur the shared floor."
        : "The section cue is simple enough to mark cleanly.",
      requestedChange: section.rootDegrees.length > 2
        ? "Limit the first pass to the clearest two roots."
        : undefined,
    };
  }

  if (assignment.role === "bass") {
    return {
      playerId: assignment.playerId,
      role: assignment.role,
      stance: kind === "tighten_roots" ? "accept" : "modify",
      reason: kind === "tighten_roots"
        ? "The proposal gives the bass root plan a clear job."
        : "The bass wants the root motion stated before the answer loosens.",
      requestedChange: kind === "tighten_roots"
        ? undefined
        : "Name the bass cue before the melody answers it.",
    };
  }

  if (assignment.role === "melody") {
    const sparseMelody = assignment.density < 0.4;
    return {
      playerId: assignment.playerId,
      role: assignment.role,
      stance: sparseMelody && kind !== "preserve_space" ? "resist" : "accept",
      reason: sparseMelody
        ? "The melody's source material depends on silence staying audible."
        : "The melody can turn the section into a repeatable answer.",
      requestedChange: sparseMelody && kind !== "preserve_space"
        ? "Let the answer keep at least one empty beat between phrases."
        : undefined,
    };
  }

  return {
    playerId: assignment.playerId,
    role: assignment.role,
    stance: "defer",
    reason: "This player has no section-specific rule yet.",
  };
}

function createEmptySection(): SongSketchSection {
  return {
    id: "empty",
    label: "Empty",
    startBeat: 0,
    durationBeats: 0,
    chordPlan: ["I"],
    rootDegrees: [0],
    cue: "No section is available yet.",
  };
}

function getPlayerDensity(analysis: SongMaterialAnalysis, playerId: string): number {
  return analysis.byPlayer.get(playerId)?.density ?? 0;
}

function describeDensity(density: number): string {
  if (density < 0.4) return "sparse";
  if (density > 0.7) return "active";
  return "moderate";
}

function createDensityConstraint(density: number): string {
  return `source density ${density.toFixed(2)}`;
}

function validateRequiredTextField(
  field: string,
  value: string,
  maximumLength: number,
  errors: string[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be non-empty text`);
    return;
  }
  if (value.trim().length > maximumLength) {
    errors.push(`${field} must be ${maximumLength} characters or fewer`);
  }
}

function validateOptionalTextField(
  field: string,
  value: string | undefined,
  maximumLength: number,
  errors: string[],
): void {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push(`${field} must be text when present`);
    return;
  }
  if (value.trim().length > maximumLength) {
    errors.push(`${field} must be ${maximumLength} characters or fewer`);
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDegree(degree: number): number {
  return Math.max(0, Math.trunc(degree));
}

function pitchClassToSemitone(note: string): number | undefined {
  return NOTE_SEMITONES.get(note.trim().replace(/\d+$/, ""));
}

function normalizeSemitoneDelta(delta: number): number {
  let normalized = ((delta % 12) + 12) % 12;
  if (normalized > 6) normalized -= 12;
  return normalized;
}

function formatAlteration(alteration: number): string {
  if (alteration === 0) return "";
  const symbol = alteration < 0 ? "b" : "#";
  return symbol.repeat(Math.abs(alteration));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundBeat(value: number): number {
  return Math.round(value * 100) / 100;
}

const ROMAN_ROOTS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const NOTE_SEMITONES = new Map<string, number>([
  ["C", 0],
  ["B#", 0],
  ["C#", 1],
  ["Db", 1],
  ["D", 2],
  ["D#", 3],
  ["Eb", 3],
  ["E", 4],
  ["Fb", 4],
  ["E#", 5],
  ["F", 5],
  ["F#", 6],
  ["Gb", 6],
  ["G", 7],
  ["G#", 8],
  ["Ab", 8],
  ["A", 9],
  ["A#", 10],
  ["Bb", 10],
  ["B", 11],
  ["Cb", 11],
]);
