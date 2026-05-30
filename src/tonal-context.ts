import type { TonalContext } from "./listening";

export const DEFAULT_TONAL_CONTEXT: TonalContext = {
  tonic: "C",
  mode: "mixolydian",
  scale: ["C", "D", "E", "F", "G", "A", "Bb"],
};

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
