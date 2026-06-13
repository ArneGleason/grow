import type { TonalContext } from "./listening";
import { applySectionDynamics, type SectionDynamicsProfile } from "./section-dynamics";
import type { PatternNoteSource, SongMaterial } from "./song-material";
import {
  DEFAULT_SONG_ARRANGEMENT,
  arrangeSongFormPatternEvent,
  getSongHarmonicContext,
  type ChorusDevelopment,
  type SongArrangement,
  type SongArrangementSection,
  type SongSectionType,
} from "./song-form";

export interface FormScoreMetric {
  score: number;
  summary: string;
  critiques: readonly string[];
}

export interface FormScoreSection {
  id: string;
  index: number;
  label: string;
  sectionType: SongSectionType;
  occurrence: number;
  startBeat: number;
  endBeat: number;
  durationBeats: number;
  bars: number;
  rootDegrees: readonly number[];
  energy: number;
  melodyPitchClasses: readonly number[];
  melodyNoteCount: number;
}

export interface FormScore {
  id: string;
  songId: SongMaterial["id"];
  total: number;
  harmonicMotion: FormScoreMetric;
  energyArc: FormScoreMetric;
  proportion: FormScoreMetric;
  melodicCoherence: FormScoreMetric;
  cadence: FormScoreMetric;
  sections: readonly FormScoreSection[];
  topCritique: string;
  summary: string;
}

export interface FormScoreInput {
  song: SongMaterial;
  tonalContext: TonalContext;
  arrangement?: SongArrangement;
  chorusDevelopment?: ChorusDevelopment;
  sectionDynamicsProfile?: SectionDynamicsProfile;
}

interface ArrangedFormNote extends PatternNoteSource {
  absoluteBeat: number;
  localBeat: number;
  sectionIndex: number;
  sectionType: SongSectionType;
  heardVelocity: number;
}

const CHORD_TONE_OFFSETS = [0, 2, 4] as const;
const FORM_SCORE_WEIGHTS = {
  harmonicMotion: 0.25,
  energyArc: 0.22,
  proportion: 0.18,
  melodicCoherence: 0.19,
  cadence: 0.16,
} as const;

export function createFormScore(input: FormScoreInput): FormScore {
  const arrangement = input.arrangement ?? DEFAULT_SONG_ARRANGEMENT;
  const arrangedNotes = collectArrangedFormNotes(input, arrangement);
  const sections = arrangement.sections.map((section) =>
    createFormScoreSection(section, input.song, arrangedNotes, arrangement)
  );
  const harmonicMotion = scoreHarmonicMotion(sections);
  const energyArc = scoreEnergyArc(sections);
  const proportion = scoreProportion(sections, arrangement);
  const melodicCoherence = scoreMelodicCoherence(sections);
  const cadence = scoreCadence(sections, arrangedNotes, input.song, arrangement, input.tonalContext.scale.length);
  const total = roundScore(
    harmonicMotion.score * FORM_SCORE_WEIGHTS.harmonicMotion +
      energyArc.score * FORM_SCORE_WEIGHTS.energyArc +
      proportion.score * FORM_SCORE_WEIGHTS.proportion +
      melodicCoherence.score * FORM_SCORE_WEIGHTS.melodicCoherence +
      cadence.score * FORM_SCORE_WEIGHTS.cadence,
  );
  const topCritique = [
    ...harmonicMotion.critiques,
    ...energyArc.critiques,
    ...proportion.critiques,
    ...melodicCoherence.critiques,
    ...cadence.critiques,
  ][0] ?? "No urgent form flags.";

  return {
    id: [
      "form-score",
      input.song.id,
      `beats${arrangement.totalBeats}`,
      input.sectionDynamicsProfile?.id ?? "balanced",
      sections.map((section) => section.rootDegrees.join(".")).join("-"),
      input.chorusDevelopment?.mode ?? "raw",
    ].join("-"),
    songId: input.song.id,
    total,
    harmonicMotion,
    energyArc,
    proportion,
    melodicCoherence,
    cadence,
    sections,
    topCritique,
    summary: `form ${total.toFixed(3)} | harmony ${harmonicMotion.score.toFixed(2)} | energy ${
      energyArc.score.toFixed(2)} | proportion ${proportion.score.toFixed(2)} | motif ${
      melodicCoherence.score.toFixed(2)} | cadence ${cadence.score.toFixed(2)}`,
  };
}

function collectArrangedFormNotes(
  input: FormScoreInput,
  arrangement: SongArrangement,
): readonly ArrangedFormNote[] {
  const notes: ArrangedFormNote[] = [];
  for (const section of arrangement.sections) {
    for (const pattern of input.song.patterns) {
      for (
        let localBeat = 0;
        localBeat < section.endBeat - section.startBeat;
        localBeat += pattern.subdivisionBeats
      ) {
        const absoluteBeat = section.startBeat + localBeat;
        const stepIndex = Math.round(absoluteBeat / pattern.subdivisionBeats) % pattern.events.length;
        const sourceEvent = pattern.events[stepIndex] ?? null;
        const arrangedEvent = arrangeSongFormPatternEvent({
          song: input.song,
          pattern,
          sourceEvent,
          stepIndex,
          absoluteBeat,
          tonalContext: input.tonalContext,
          arrangement,
          chorusDevelopment: input.chorusDevelopment,
        });
        if (!arrangedEvent) continue;
        const sectionNote = applySectionEnergyEstimate(
          arrangedEvent,
          section,
          localBeat,
          absoluteBeat,
          input.sectionDynamicsProfile,
        );
        if (sectionNote) notes.push(sectionNote);
      }
    }
  }
  return notes;
}

function applySectionEnergyEstimate(
  note: PatternNoteSource,
  section: SongArrangementSection,
  localBeat: number,
  absoluteBeat: number,
  profile: SectionDynamicsProfile | undefined,
): ArrangedFormNote | undefined {
  const dynamics = applySectionDynamics({
    role: note.playerId,
    sectionType: section.sectionType,
    occurrence: section.occurrence,
    localBeat,
    localBar: Math.floor(localBeat / 4) + 1,
    absoluteBeat,
    profile,
  });

  if (!dynamics.shouldPlay) return undefined;
  return {
    ...note,
    absoluteBeat,
    localBeat,
    sectionIndex: section.index,
    sectionType: section.sectionType,
    heardVelocity: roundScore(note.velocity * dynamics.velocityMultiplier),
  };
}

function createFormScoreSection(
  section: SongArrangementSection,
  song: SongMaterial,
  arrangedNotes: readonly ArrangedFormNote[],
  arrangement: SongArrangement,
): FormScoreSection {
  const notes = arrangedNotes.filter((note) => note.sectionIndex === section.index);
  const melodyPitchClasses = uniqueNumbers(notes.filter((note) => note.playerId === "melody").map((note) =>
    normalizeDegree(note.scaleDegree)
  ));
  const rootDegrees = collectSectionRoots(song, section, arrangement);
  const durationBeats = Math.max(1, section.endBeat - section.startBeat);
  const energy = roundScore(notes.reduce((sum, note) => {
    const roleWeight = note.playerId === "melody" ? 1.15 : note.playerId === "bass" ? 1 : 0.72;
    return sum + note.heardVelocity * note.durationBeats * roleWeight;
  }, 0) / durationBeats);

  return {
    id: `${section.sectionType}-${section.occurrence}`,
    index: section.index,
    label: `${section.label} ${section.occurrence}`,
    sectionType: section.sectionType,
    occurrence: section.occurrence,
    startBeat: section.startBeat,
    endBeat: section.endBeat,
    durationBeats,
    bars: section.bars,
    rootDegrees,
    energy,
    melodyPitchClasses,
    melodyNoteCount: notes.filter((note) => note.playerId === "melody").length,
  };
}

function scoreProportion(
  sections: readonly FormScoreSection[],
  arrangement: SongArrangement,
): FormScoreMetric {
  const critiques: string[] = [];
  const firstChorus = sections.find((section) => section.sectionType === "chorus");
  const bridge = sections.find((section) => section.sectionType === "bridge");
  const finalChorus = [...sections].reverse().find((section) => section.sectionType === "chorus");
  const verseBeats = sections
    .filter((section) => section.sectionType === "verse")
    .reduce((sum, section) => sum + section.durationBeats, 0);
  const chorusBeats = sections
    .filter((section) => section.sectionType === "chorus")
    .reduce((sum, section) => sum + section.durationBeats, 0);
  const totalBeats = Math.max(1, arrangement.totalBeats);
  const firstChorusRatio = firstChorus ? firstChorus.startBeat / totalBeats : 1;
  const finalChorusRatio = finalChorus ? finalChorus.durationBeats / totalBeats : 0;
  const bridgeRatio = bridge ? bridge.durationBeats / totalBeats : 0;
  const chorusVerseRatio = chorusBeats / Math.max(1, verseBeats);

  const hookArrivalScore = bandScore(firstChorusRatio, 0.12, 0.24, 0.18);
  const finalPayoffScore = bandScore(finalChorusRatio, 0.18, 0.31, 0.25);
  const bridgeBreathScore = bandScore(bridgeRatio, 0.11, 0.2, 0.15);
  const chorusBalanceScore = bandScore(chorusVerseRatio, 1.25, 2.6, 1.9);

  if (hookArrivalScore < 0.7) critiques.push("First chorus arrives at a less satisfying proportion of the form.");
  if (finalPayoffScore < 0.7) critiques.push("Final chorus does not have enough room to feel like payoff.");
  if (bridgeBreathScore < 0.7) critiques.push("Bridge feels clipped or overextended for this form length.");
  if (chorusBalanceScore < 0.7) critiques.push("Verse and chorus time are out of balance.");

  return {
    score: roundScore(
      hookArrivalScore * 0.25 +
        finalPayoffScore * 0.34 +
        bridgeBreathScore * 0.21 +
        chorusBalanceScore * 0.2,
    ),
    summary: `hook ${(firstChorusRatio * 100).toFixed(0)}%, final ${
      finalChorus?.bars ?? 0} bars, bridge ${bridge?.bars ?? 0} bars, chorus/verse ${
      chorusVerseRatio.toFixed(2)}x`,
    critiques,
  };
}

function collectSectionRoots(
  song: SongMaterial,
  section: SongArrangementSection,
  arrangement: SongArrangement,
): readonly number[] {
  const roots: number[] = [];
  for (let localBeat = 0; localBeat < section.endBeat - section.startBeat; localBeat += 4) {
    roots.push(normalizeDegree(getSongHarmonicContext(song, section.startBeat + localBeat, arrangement).rootDegree));
  }
  return uniqueNumbers(roots);
}

function scoreHarmonicMotion(sections: readonly FormScoreSection[]): FormScoreMetric {
  const critiques: string[] = [];
  const uniqueRoots = uniqueNumbers(sections.flatMap((section) => section.rootDegrees));
  const signatures = sections.map((section) => section.rootDegrees.join("."));
  const adjacentChanges = signatures.slice(1).filter((signature, index) => signature !== signatures[index]).length;
  const changeRatio = sections.length > 1 ? adjacentChanges / (sections.length - 1) : 0;
  const bridgeIndex = sections.findIndex((section) => section.sectionType === "bridge");
  const bridge = sections[bridgeIndex];
  const bridgeDistinct = bridge
    ? signatures[bridgeIndex] !== signatures[bridgeIndex - 1] &&
      signatures[bridgeIndex] !== signatures[bridgeIndex + 1]
    : false;
  const rootCoverage = clamp((uniqueRoots.length - 1) / 3, 0, 1);
  const bridgeScore = bridgeDistinct ? 1 : 0.35;

  if (uniqueRoots.length < 3) critiques.push("Harmony uses too few distinct roots across the form.");
  if (changeRatio < 0.6) critiques.push("Adjacent sections do not move harmonically enough.");
  if (bridge && !bridgeDistinct) critiques.push("Bridge roots do not contrast the surrounding sections.");

  return {
    score: roundScore(rootCoverage * 0.4 + changeRatio * 0.38 + bridgeScore * 0.22),
    summary: `${uniqueRoots.length} roots, ${(changeRatio * 100).toFixed(0)}% section changes`,
    critiques,
  };
}

function scoreEnergyArc(sections: readonly FormScoreSection[]): FormScoreMetric {
  const critiques: string[] = [];
  const verse = sections.find((section) => section.sectionType === "verse");
  const chorus = sections.find((section) => section.sectionType === "chorus");
  const bridge = sections.find((section) => section.sectionType === "bridge");
  const finalChorus = [...sections].reverse().find((section) => section.sectionType === "chorus");
  if (!verse || !chorus || !bridge || !finalChorus) {
    return {
      score: 0.35,
      summary: "missing verse/chorus/bridge shape",
      critiques: ["Form score needs verse, chorus, and bridge sections."],
    };
  }

  const liftScore = thresholdScore(chorus.energy - verse.energy, Math.max(0.015, verse.energy * 0.18));
  const bridgeContrastScore = thresholdScore(chorus.energy - bridge.energy, Math.max(0.015, chorus.energy * 0.22));
  const returnScore = thresholdScore(finalChorus.energy - bridge.energy, Math.max(0.015, chorus.energy * 0.18));
  if (liftScore < 0.7) critiques.push("Chorus does not lift enough above the verse.");
  if (bridgeContrastScore < 0.7) critiques.push("Bridge does not contrast the chorus energy enough.");
  if (returnScore < 0.7) critiques.push("Final chorus does not clearly return from the bridge.");

  return {
    score: roundScore((liftScore + bridgeContrastScore + returnScore) / 3),
    summary: `verse ${verse.energy.toFixed(2)} -> chorus ${chorus.energy.toFixed(2)} -> bridge ${
      bridge.energy.toFixed(2)} -> final ${finalChorus.energy.toFixed(2)}`,
    critiques,
  };
}

function scoreMelodicCoherence(sections: readonly FormScoreSection[]): FormScoreMetric {
  const critiques: string[] = [];
  const verse = sections.find((section) => section.sectionType === "verse");
  const chorus = sections.find((section) => section.sectionType === "chorus");
  const bridge = sections.find((section) => section.sectionType === "bridge");
  if (!verse || !chorus || !bridge) {
    return {
      score: 0.35,
      summary: "missing melodic comparison sections",
      critiques: ["Melodic coherence needs verse, chorus, and bridge material."],
    };
  }

  const chorusOverlap = jaccard(verse.melodyPitchClasses, chorus.melodyPitchClasses);
  const bridgeOverlap = jaccard(verse.melodyPitchClasses, bridge.melodyPitchClasses);
  const chorusScore = bandScore(chorusOverlap, 0.28, 0.82, 0.54);
  const bridgeScore = bandScore(bridgeOverlap, 0.18, 0.72, 0.38);
  const noteContinuity = thresholdScore(Math.min(chorus.melodyNoteCount, bridge.melodyNoteCount), 4);

  if (chorusScore < 0.65) critiques.push("Chorus motif is either too unrelated to the verse or too exact.");
  if (bridgeScore < 0.65) critiques.push("Bridge motif does not balance contrast with recognizable DNA.");
  if (noteContinuity < 0.65) critiques.push("One section has too little melody material to read as a phrase.");

  return {
    score: roundScore(chorusScore * 0.45 + bridgeScore * 0.35 + noteContinuity * 0.2),
    summary: `verse/chorus overlap ${chorusOverlap.toFixed(2)}, verse/bridge ${bridgeOverlap.toFixed(2)}`,
    critiques,
  };
}

function scoreCadence(
  sections: readonly FormScoreSection[],
  notes: readonly ArrangedFormNote[],
  song: SongMaterial,
  arrangement: SongArrangement,
  scaleLength: number,
): FormScoreMetric {
  const critiques: string[] = [];
  let checks = 0;
  let hits = 0;

  for (const section of sections) {
    const sectionNotes = notes.filter((note) => note.sectionIndex === section.index);
    const melodyNotes = sectionNotes.filter((note) => note.playerId === "melody");
    const bassStart = sectionNotes.find((note) => note.playerId === "bass" || note.playerId === "pulse");
    const importantMelody = uniqueNotes([
      melodyNotes[0],
      melodyNotes.at(-1),
    ]);

    for (const note of importantMelody) {
      checks += 1;
      const root = getSongHarmonicContext(song, note.absoluteBeat, arrangement).rootDegree;
      if (isChordTone(note.scaleDegree, root, scaleLength)) {
        hits += 1;
      } else {
        critiques.push(`${section.label}: melody arrival misses the active chord tone.`);
      }
    }

    if (bassStart) {
      checks += 1;
      const root = getSongHarmonicContext(song, bassStart.absoluteBeat, arrangement).rootDegree;
      if (normalizeDegree(bassStart.scaleDegree, scaleLength) === normalizeDegree(root, scaleLength)) {
        hits += 1;
      } else {
        critiques.push(`${section.label}: low support does not state the section root at entry.`);
      }
    }
  }

  return {
    score: roundScore(hits / Math.max(1, checks)),
    summary: `${hits}/${checks} section arrivals on chord/root targets`,
    critiques,
  };
}

function uniqueNotes(notes: Array<ArrangedFormNote | undefined>): readonly ArrangedFormNote[] {
  const seen = new Set<string>();
  const unique: ArrangedFormNote[] = [];
  for (const note of notes) {
    if (!note) continue;
    const key = `${note.absoluteBeat}:${note.playerId}:${note.scaleDegree}:${note.octave}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(note);
  }
  return unique;
}

function isChordTone(scaleDegree: number, rootDegree: number, scaleLength: number): boolean {
  const noteClass = normalizeDegree(scaleDegree, scaleLength);
  return CHORD_TONE_OFFSETS.some((offset) =>
    normalizeDegree(rootDegree + offset, scaleLength) === noteClass
  );
}

function jaccard(left: readonly number[], right: readonly number[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return roundScore(intersection / union.size);
}

function thresholdScore(value: number, target: number): number {
  return roundScore(clamp(value / Math.max(0.0001, target), 0, 1));
}

function bandScore(value: number, min: number, max: number, ideal: number): number {
  if (value < min) return roundScore(clamp(value / Math.max(0.0001, min), 0, 1) * 0.75);
  if (value > max) return roundScore(clamp((1 - value) / Math.max(0.0001, 1 - max), 0, 1) * 0.75);
  const spread = Math.max(ideal - min, max - ideal, 0.0001);
  return roundScore(1 - Math.abs(value - ideal) / spread * 0.35);
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function normalizeDegree(degree: number, scaleLength = 7): number {
  return modulo(degree, Math.max(1, scaleLength));
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000) / 1_000;
}
