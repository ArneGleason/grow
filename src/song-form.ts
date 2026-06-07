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

export function arrangeSongFormPatternEvent(
  input: SongFormPatternEventInput,
): PatternNoteSource | null {
  const context = sectionAtBeat(input.absoluteBeat, input.arrangement);
  const playerId = getPatternPlayerId(input.pattern) ?? input.sourceEvent?.playerId;
  if (playerId !== "melody") return input.sourceEvent;

  if (context.sectionType === "chorus") {
    return createChorusMelodyEvent(input, context);
  }

  if (context.sectionType === "bridge") {
    return createBridgeMelodyEvent(input.sourceEvent);
  }

  return input.sourceEvent;
}

export function deriveSongRootDegrees(song: SongMaterial): readonly number[] {
  const bassPattern = song.patterns.find((pattern) => getPatternPlayerId(pattern) === "bass");
  const sourcePattern = bassPattern ?? song.patterns.find((pattern) => getPatternPlayerId(pattern));
  const roots = uniqueDegreesInOrder(
    sourcePattern?.events
      .filter((event): event is PatternNoteSource => event !== null)
      .map((event) => normalizeDegree(event.scaleDegree)) ?? [],
  );
  return roots.length > 0 ? roots : [0];
}

function createChorusMelodyEvent(
  input: SongFormPatternEventInput,
  context: SongSectionContext,
): PatternNoteSource | null {
  const phraseStep = getPhraseStep(context.localBeat, input.pattern.subdivisionBeats);
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
