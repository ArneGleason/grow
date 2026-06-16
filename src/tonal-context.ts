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
