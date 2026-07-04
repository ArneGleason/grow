import type { TonalContext } from "./listening";
import type { SongGoalMode, SongGoalTonic } from "./song-goal";

export const DEFAULT_TONAL_CONTEXT: TonalContext = {
  tonic: "C",
  mode: "mixolydian",
  scale: ["C", "D", "E", "F", "G", "A", "Bb"],
};

const FLAT_CHROMATIC_SCALE = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

const MIN_MIDI_NOTE = 0;
const MAX_MIDI_NOTE = 127;
const MAX_CHROMATIC_OFFSET_SEMITONES = 2;

export const MODE_INTERVALS = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const satisfies Record<SongGoalMode, readonly number[]>;

export function createTonalContext(
  tonic: SongGoalTonic,
  mode: SongGoalMode,
): TonalContext {
  const tonicIndex = FLAT_CHROMATIC_SCALE.indexOf(tonic);
  if (tonicIndex < 0) return DEFAULT_TONAL_CONTEXT;
  const intervals = MODE_INTERVALS[mode];
  return {
    tonic,
    mode,
    scale: intervals.map((interval) =>
      FLAT_CHROMATIC_SCALE[(tonicIndex + interval) % FLAT_CHROMATIC_SCALE.length]
    ),
  };
}

export function noteFromScaleDegree(
  tonalContext: TonalContext,
  degree: number,
  octave: number,
): string {
  if (tonalContext.scale.length === 0) {
    throw new Error("Cannot resolve note from an empty tonal scale");
  }

  const scaleLength = tonalContext.scale.length;
  const scaleIndex = ((degree % scaleLength) + scaleLength) % scaleLength;
  const octaveOffset = Math.floor(degree / scaleLength);

  return `${tonalContext.scale[scaleIndex]}${octave + octaveOffset}`;
}

export function noteFromScaleDegreeWithChromaticOffset(
  tonalContext: TonalContext,
  degree: number,
  octave: number,
  chromaticOffsetSemitones = 0,
): string {
  const basePitch = noteFromScaleDegree(tonalContext, degree, octave);
  const offset = clampChromaticOffset(chromaticOffsetSemitones);
  return offset === 0 ? basePitch : transposePitchBySemitones(basePitch, offset);
}

export function transposePitchBySemitones(pitch: string, semitones: number): string {
  const noteNumber = pitchToMidiNumber(pitch);
  if (noteNumber === undefined) return pitch;
  return midiNumberToPitch(noteNumber + Math.trunc(semitones));
}

export function pitchToMidiNumber(pitch: string): number | undefined {
  const match = pitch.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!match) return undefined;
  const [, letter, accidental = "", octaveText] = match;
  const semitoneByPitch: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };
  const semitone = semitoneByPitch[`${letter}${accidental}`];
  const octave = Number(octaveText);
  if (semitone === undefined || !Number.isInteger(octave)) return undefined;
  return clampInteger((octave + 1) * 12 + semitone, MIN_MIDI_NOTE, MAX_MIDI_NOTE);
}

export function midiNumberToPitch(midiNumber: number): string {
  const bounded = clampInteger(Math.round(midiNumber), MIN_MIDI_NOTE, MAX_MIDI_NOTE);
  const pitchClass = FLAT_CHROMATIC_SCALE[bounded % FLAT_CHROMATIC_SCALE.length] ?? "C";
  const octave = Math.floor(bounded / FLAT_CHROMATIC_SCALE.length) - 1;
  return `${pitchClass}${octave}`;
}

function clampChromaticOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clampInteger(
    Math.trunc(value),
    -MAX_CHROMATIC_OFFSET_SEMITONES,
    MAX_CHROMATIC_OFFSET_SEMITONES,
  );
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(Math.max(minimum, Math.min(maximum, value)));
}
