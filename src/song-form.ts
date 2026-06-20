import type { TonalContext } from "./listening";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";

export type SongSectionType = "verse" | "chorus" | "bridge";

export interface SongFormSection {
  sectionType: SongSectionType;
  bars: number;
}

export interface SongArrangementSection extends SongFormSection {
  index: number;
  occurrence: number;
  label: string;
  startBeat: number;
  endBeat: number;
}

export interface SongSectionContext extends SongArrangementSection {
  formBeat: number;
  localBeat: number;
  localBar: number;
  beatInBar: number;
  totalBeats: number;
}

export type SongHarmonicSectionId = "gather" | "answer" | "bridge";

export interface SongHarmonicContext {
  sectionId: SongHarmonicSectionId;
  label: string;
  rootDegree: number;
  rootDegrees: readonly number[];
  rootIndex: number;
  rootSpanBeats: number;
  strategy: "modal-root-recolor";
}

export type ChorusDevelopmentMode = "raw" | "repaired";

export interface ChorusDevelopment {
  mode: ChorusDevelopmentMode;
  repairedEvents?: readonly (PatternNoteSource | null)[];
}

export interface SongArrangement {
  beatsPerBar: number;
  totalBeats: number;
  sections: readonly SongArrangementSection[];
}

export interface SongFormPatternEventInput {
  song: SongMaterial;
  pattern: PlayerPatternSource;
  sourceEvent: PatternNoteSource | null;
  stepIndex: number;
  absoluteBeat: number;
  tonalContext: TonalContext;
  arrangement?: SongArrangement;
  chorusDevelopment?: ChorusDevelopment;
}

export const DEFAULT_SONG_FORM: readonly SongFormSection[] = [
  { sectionType: "verse", bars: 8 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "verse", bars: 8 },
  { sectionType: "chorus", bars: 8 },
  { sectionType: "bridge", bars: 8 },
  { sectionType: "chorus", bars: 8 },
];

export const DEFAULT_SONG_FORM_BEATS_PER_BAR = 4;

const SECTION_LABELS = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
} as const satisfies Record<SongSectionType, string>;

const CHORD_TONE_OFFSETS = [0, 2, 4] as const;
const HARMONIC_ROOT_SPAN_BEATS = 4;
const CHORUS_HOOK_SLOTS: readonly (null | {
  motifIndex: number;
  durationBeats: number;
  velocity: number;
  chordToneIndex?: number;
  transposeDegrees?: number;
  rootAdvance?: number;
})[] = [
  { motifIndex: 1, chordToneIndex: 2, durationBeats: 1, velocity: 0.48 },
  null,
  { motifIndex: 2, transposeDegrees: 2, durationBeats: 0.5, velocity: 0.4 },
  { motifIndex: 3, transposeDegrees: 2, durationBeats: 0.5, velocity: 0.38 },
  { motifIndex: 4, chordToneIndex: 1, rootAdvance: 1, durationBeats: 1, velocity: 0.44 },
  null,
  { motifIndex: 5, transposeDegrees: 1, durationBeats: 0.5, velocity: 0.38 },
  null,
  { motifIndex: 6, chordToneIndex: 2, rootAdvance: 2, durationBeats: 1, velocity: 0.46 },
  null,
  { motifIndex: 7, transposeDegrees: 2, durationBeats: 0.5, velocity: 0.4 },
  { motifIndex: 8, transposeDegrees: 1, durationBeats: 0.5, velocity: 0.36 },
  { motifIndex: 0, chordToneIndex: 0, rootAdvance: 3, durationBeats: 1, velocity: 0.42 },
  null,
  { motifIndex: 2, transposeDegrees: 2, durationBeats: 0.5, velocity: 0.38 },
  null,
];

export const DEFAULT_SONG_ARRANGEMENT = createSongArrangement();

export function createSongArrangement(
  form: readonly SongFormSection[] = DEFAULT_SONG_FORM,
  beatsPerBar = DEFAULT_SONG_FORM_BEATS_PER_BAR,
): SongArrangement {
  const occurrences = new Map<SongSectionType, number>();
  const sections: SongArrangementSection[] = [];
  let startBeat = 0;

  form.forEach((section, index) => {
    const occurrence = (occurrences.get(section.sectionType) ?? 0) + 1;
    occurrences.set(section.sectionType, occurrence);
    const durationBeats = section.bars * beatsPerBar;
    sections.push({
      ...section,
      index,
      occurrence,
      label: SECTION_LABELS[section.sectionType],
      startBeat,
      endBeat: startBeat + durationBeats,
    });
    startBeat += durationBeats;
  });

  return {
    beatsPerBar,
    totalBeats: Math.max(startBeat, beatsPerBar),
    sections,
  };
}

export function sectionAtBeat(
  absoluteBeat: number,
  arrangement: SongArrangement = DEFAULT_SONG_ARRANGEMENT,
): SongSectionContext {
  const formBeat = modulo(absoluteBeat, arrangement.totalBeats);
  const section = arrangement.sections.find((candidate) =>
    formBeat >= candidate.startBeat && formBeat < candidate.endBeat
  ) ?? arrangement.sections[0] ?? createFallbackSection(arrangement.beatsPerBar);
  const localBeat = roundBeat(formBeat - section.startBeat);

  return {
    ...section,
    formBeat: roundBeat(formBeat),
    localBeat,
    localBar: Math.floor(localBeat / arrangement.beatsPerBar) + 1,
    beatInBar: roundBeat(modulo(localBeat, arrangement.beatsPerBar)),
    totalBeats: arrangement.totalBeats,
  };
}

export function getSongHarmonicContext(
  song: SongMaterial,
  absoluteBeat: number,
  arrangement: SongArrangement = DEFAULT_SONG_ARRANGEMENT,
): SongHarmonicContext {
  const section = sectionAtBeat(absoluteBeat, arrangement);
  const plans = deriveSongSectionRootPlans(song);
  const sectionId = getHarmonicSectionId(section.sectionType);
  const rootDegrees = plans[sectionId].length > 0
    ? plans[sectionId]
    : deriveSongRootDegrees(song);
  const safeRoots = rootDegrees.length > 0 ? rootDegrees : [0];
  const rootIndex = Math.floor(section.localBeat / HARMONIC_ROOT_SPAN_BEATS) % safeRoots.length;

  return {
    sectionId,
    label: sectionId === "gather" ? "Gather" : sectionId === "answer" ? "Answer" : "Bridge",
    rootDegree: safeRoots[rootIndex] ?? 0,
    rootDegrees: safeRoots,
    rootIndex,
    rootSpanBeats: HARMONIC_ROOT_SPAN_BEATS,
    strategy: "modal-root-recolor",
  };
}

export function arrangeSongFormPatternEvent(
  input: SongFormPatternEventInput,
): PatternNoteSource | null {
  const context = sectionAtBeat(input.absoluteBeat, input.arrangement);
  const playerId = getPatternPlayerId(input.pattern) ?? input.sourceEvent?.playerId;
  const harmony = getSongHarmonicContext(input.song, input.absoluteBeat, input.arrangement);
  if (playerId === "pulse" || playerId === "bass") {
    return createHarmonicAccompanimentEvent(input.sourceEvent, playerId, harmony, input.song);
  }

  if (playerId !== "melody") return input.sourceEvent;

  if (input.song.draft?.melodyMode === "full-form") {
    return createFullFormMelodyEvent(input.sourceEvent, context);
  }

  if (context.sectionType === "chorus") {
    return createChorusMelodyEvent(input, context);
  }

  if (context.sectionType === "bridge") {
    return createBridgeMelodyEvent(input.sourceEvent);
  }

  return input.sourceEvent;
}

export function deriveSongRootDegrees(song: SongMaterial): readonly number[] {
  if (song.draft?.rootPlans) {
    return limitRootPlan(uniqueDegreesInOrder([
      ...song.draft.rootPlans.gather,
      ...song.draft.rootPlans.answer,
      ...song.draft.rootPlans.bridge,
    ].map(normalizeDegree)));
  }
  const bassPattern = song.patterns.find((pattern) => getPatternPlayerId(pattern) === "bass");
  const sourcePattern = bassPattern ?? song.patterns.find((pattern) => getPatternPlayerId(pattern));
  const roots = uniqueDegreesInOrder(
    sourcePattern?.events
      .filter((event): event is PatternNoteSource => event !== null)
      .map((event) => normalizeDegree(event.scaleDegree)) ?? [],
  );
  return roots.length > 0 ? roots : [0];
}

export function deriveSongSectionRootPlans(song: SongMaterial): Record<SongHarmonicSectionId, readonly number[]> {
  if (song.draft?.rootPlans) {
    return {
      gather: limitRootPlan(song.draft.rootPlans.gather.map(normalizeDegree)),
      answer: limitRootPlan(song.draft.rootPlans.answer.map(normalizeDegree)),
      bridge: limitRootPlan(song.draft.rootPlans.bridge.map(normalizeDegree)),
    };
  }
  const bassPattern = song.patterns.find((pattern) => getPatternPlayerId(pattern) === "bass");
  const sourcePattern = bassPattern ?? song.patterns.find((pattern) => getPatternPlayerId(pattern));
  const fallback = deriveSongRootDegrees(song);
  if (!sourcePattern) {
    return {
      gather: fallback,
      answer: fallback,
      bridge: fallback,
    };
  }

  const sectionLengthBeats = Math.max(1, sourcePattern.events.length * sourcePattern.subdivisionBeats);
  const splitBeat = sectionLengthBeats / 2;
  const gather = uniqueDegreesInOrder(sourcePattern.events.flatMap((event, index) => {
    if (!event) return [];
    const positionBeat = index * sourcePattern.subdivisionBeats;
    return positionBeat < splitBeat ? [normalizeDegree(event.scaleDegree)] : [];
  }));
  const answer = uniqueDegreesInOrder(sourcePattern.events.flatMap((event, index) => {
    if (!event) return [];
    const positionBeat = index * sourcePattern.subdivisionBeats;
    return positionBeat >= splitBeat ? [normalizeDegree(event.scaleDegree)] : [];
  }));
  const gatherPlan = limitRootPlan(gather.length > 0 ? gather : fallback);
  const answerPlan = limitRootPlan(answer.length > 0 ? answer : fallback);
  const bridgePlan = createBridgeRootPlan(gatherPlan, answerPlan, fallback);

  return {
    gather: gatherPlan,
    answer: answerPlan,
    bridge: bridgePlan,
  };
}

function createHarmonicAccompanimentEvent(
  sourceEvent: PatternNoteSource | null,
  playerId: string,
  harmony: SongHarmonicContext,
  song: SongMaterial,
): PatternNoteSource | null {
  if (!sourceEvent) return null;
  const baseRoot = deriveSongRootDegrees(song)[0] ?? 0;
  const scaleDegree = playerId === "pulse"
    ? harmony.rootDegree
    : harmony.rootDegree + getBassChordOffset(sourceEvent.scaleDegree - baseRoot);
  const octave = playerId === "pulse" ? sourceEvent.octave : clampInteger(
    sourceEvent.octave + getOctaveNudge(sourceEvent.scaleDegree, scaleDegree),
    1,
    7,
  );

  return {
    ...sourceEvent,
    scaleDegree,
    octave,
  };
}

function createFullFormMelodyEvent(
  sourceEvent: PatternNoteSource | null,
  context: SongSectionContext,
): PatternNoteSource | null {
  if (!sourceEvent) return null;
  const sectionVelocity = context.sectionType === "chorus" ? 1.08 : context.sectionType === "bridge" ? 0.86 : 1;
  return {
    ...sourceEvent,
    velocity: Math.max(0.14, Math.min(0.68, sourceEvent.velocity * sectionVelocity)),
  };
}

function createChorusMelodyEvent(
  input: SongFormPatternEventInput,
  context: SongSectionContext,
): PatternNoteSource | null {
  const phraseStep = getPhraseStep(context.localBeat, input.pattern.subdivisionBeats);
  if (
    input.chorusDevelopment?.mode === "repaired" &&
    input.chorusDevelopment.repairedEvents &&
    input.chorusDevelopment.repairedEvents.length > 0
  ) {
    const repairedEvent = input.chorusDevelopment.repairedEvents[
      phraseStep % input.chorusDevelopment.repairedEvents.length
    ] ?? null;
    return repairedEvent ? { ...repairedEvent } : null;
  }

  const hook = CHORUS_HOOK_SLOTS[phraseStep % CHORUS_HOOK_SLOTS.length];
  if (!hook) return null;

  const motif = getMotifNotes(input.pattern);
  const motifNote = motif[hook.motifIndex % motif.length] ?? input.sourceEvent;
  if (!motifNote) return null;

  const roots = deriveSongRootDegrees(input.song);
  const root = roots[getRootIndex(context.localBeat, roots, hook.rootAdvance)] ?? 0;
  const scaleLength = Math.max(1, input.tonalContext.scale.length);
  const scaleDegree = hook.chordToneIndex !== undefined
    ? root + CHORD_TONE_OFFSETS[hook.chordToneIndex]
    : motifNote.scaleDegree + (hook.transposeDegrees ?? 0);
  const octave = clampInteger(
    motifNote.octave + (scaleDegree >= scaleLength ? 0 : 1),
    1,
    7,
  );

  return {
    playerId: motifNote.playerId,
    scaleDegree,
    octave,
    duration: hook.durationBeats >= 1 ? "4n" : motifNote.duration,
    durationBeats: hook.durationBeats,
    velocity: hook.velocity,
  };
}

function createBridgeMelodyEvent(sourceEvent: PatternNoteSource | null): PatternNoteSource | null {
  if (!sourceEvent) return null;
  return {
    ...sourceEvent,
    scaleDegree: sourceEvent.scaleDegree - 2,
    octave: clampInteger(sourceEvent.octave + 1, 1, 7),
    velocity: Math.max(0.2, Math.min(0.34, sourceEvent.velocity * 0.88)),
  };
}

function getPhraseStep(localBeat: number, subdivisionBeats: number): number {
  const phraseBeat = modulo(localBeat, 8);
  return Math.round(phraseBeat / subdivisionBeats);
}

function getMotifNotes(pattern: PlayerPatternSource): readonly PatternNoteSource[] {
  return pattern.events.filter((event): event is PatternNoteSource => event !== null);
}

function getRootIndex(
  localBeat: number,
  roots: readonly number[],
  rootAdvance = 0,
): number {
  if (roots.length === 0) return 0;
  return (Math.floor(localBeat / 4) + rootAdvance) % roots.length;
}

function getHarmonicSectionId(sectionType: SongSectionType): SongHarmonicSectionId {
  if (sectionType === "chorus") return "answer";
  if (sectionType === "bridge") return "bridge";
  return "gather";
}

function createBridgeRootPlan(
  gather: readonly number[],
  answer: readonly number[],
  fallback: readonly number[],
): readonly number[] {
  const bridge = uniqueDegreesInOrder([...answer].reverse().concat(gather.slice(0, 1)));
  return limitRootPlan(bridge.length > 0 ? bridge : fallback);
}

function limitRootPlan(degrees: readonly number[]): readonly number[] {
  return degrees.slice(0, 4);
}

function getBassChordOffset(sourceOffset: number): number {
  const offsetClass = normalizeDegree(sourceOffset);
  if (offsetClass === 0) return 0;
  if (offsetClass === 6 || offsetClass === 1 || offsetClass === 2) return 2;
  return 4;
}

function getOctaveNudge(sourceDegree: number, nextDegree: number): number {
  const sourceClass = normalizeDegree(sourceDegree);
  const nextClass = normalizeDegree(nextDegree);
  const delta = nextClass - sourceClass;
  if (delta > 3) return -1;
  if (delta < -3) return 1;
  return 0;
}

function getPatternPlayerId(pattern: PlayerPatternSource): string | undefined {
  return pattern.events.find((event): event is PatternNoteSource => event !== null)?.playerId;
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

function normalizeDegree(degree: number): number {
  return modulo(degree, 7);
}

function createFallbackSection(beatsPerBar: number): SongArrangementSection {
  return {
    sectionType: "verse",
    bars: 1,
    index: 0,
    occurrence: 1,
    label: "Verse",
    startBeat: 0,
    endBeat: beatsPerBar,
  };
}

function roundBeat(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function modulo(value: number, length: number): number {
  if (length === 0) return 0;
  return ((value % length) + length) % length;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(Math.max(minimum, Math.min(maximum, value)));
}
