import type { TonalContext } from "./listening";
import type { PlayerRole } from "./players";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";

export type SongSketchStatus = "draft";
export type SongSketchAssignmentStance = "anchor" | "support" | "lead" | "respond";

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

export function createInspectOnlySongSketch(input: {
  song: SongMaterial;
  players: readonly SongSketchPlayerRef[];
  tonalContext: TonalContext;
  currentBeat: number;
  meter?: [number, number];
}): SongSketch {
  const proposer = input.players.find((player) => player.role === "melody") ?? input.players[0];
  const analysis = analyzeSongMaterial(input.song.patterns);
  const sectionRoots = createSectionRootPlans(analysis);
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
        durationBeats: analysis.loopLengthBeats,
        chordPlan: gatherChordPlan,
        rootDegrees: sectionRoots.gather,
        cue: createGatherCue(analysis),
      },
      {
        id: "answer",
        label: "Answer",
        startBeat: analysis.loopLengthBeats,
        durationBeats: analysis.loopLengthBeats,
        chordPlan: answerChordPlan,
        rootDegrees: sectionRoots.answer,
        cue: createAnswerCue(analysis),
      },
    ],
    assignments: input.players.map((player) => createAssignment(player, analysis)),
    openQuestions: createOpenQuestions(analysis),
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

function createSectionRootPlans(analysis: SongMaterialAnalysis): {
  gather: readonly number[];
  answer: readonly number[];
} {
  const bassSummary = analysis.byPlayer.get("bass");
  const bassOnsets = bassSummary?.onsets ?? [];
  const splitBeat = bassSummary && bassSummary.loopLengthBeats > 0
    ? bassSummary.loopLengthBeats / 2
    : 0;
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
