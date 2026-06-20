import type { AnchorPhrase } from "./anchor-phrase";
import { normalizeAnchorPhrase } from "./anchor-phrase";

function clampOctave(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(0, Math.min(8, Math.round(value)));
}

export function createMinimalAuthoringAnchorPhrase(baseOctave = 4): AnchorPhrase {
  const octave = clampOctave(baseOctave);
  const result = normalizeAnchorPhrase({
    segments: [
      {
        anchors: [
          { degree: 1, octave, startBeat: 0, durationBeats: 1, dynamics: 0.68 },
          { degree: 5, octave, startBeat: 2, durationBeats: 0.75, dynamics: 0.7 },
          { degree: 1, octave, startBeat: 4, durationBeats: 1, dynamics: 0.72 },
        ],
        connectors: [
          { kernel: "fill", reach: 0.4, density: 0.35, bias: 0, pull: 0.5, color: 0, skew: 0 },
          { kernel: "fill", reach: 0.45, density: 0.45, bias: 0, pull: 0.58, color: 0, skew: 0 },
        ],
      },
    ],
  });
  if (!result.valid) {
    throw new Error(`Minimal authoring phrase failed validation: ${result.errors.join("; ")}`);
  }
  return result.phrase;
}
