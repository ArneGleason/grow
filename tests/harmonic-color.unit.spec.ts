import { expect, test } from "@playwright/test";
import {
  colorInterplayAnswerDegree,
  colorInterplayVariation,
} from "../src/harmonic-color";
import type { MotifVariation } from "../src/motif-memory";
import {
  createTonalContext,
  noteFromScaleDegree,
  noteFromScaleDegreeWithOffset,
} from "../src/tonal-context";

function makeVariation(overrides: Partial<MotifVariation> = {}): MotifVariation {
  return {
    sourceBar: 0,
    op: "quote",
    chordRoot: 0,
    degrees: [0, 2, 4],
    rhythm: [
      { startBeat: 0, durationBeats: 0.5 },
      { startBeat: 1, durationBeats: 0.5 },
      { startBeat: 2, durationBeats: 0.5 },
    ],
    dynamics: [0.4, 0.5, 0.4],
    ...overrides,
  };
}

test.describe("interplay harmonic color", () => {
  test("keeps low-tension answers diatonic while labeling chord roles", () => {
    const colors = colorInterplayVariation(makeVariation(), {
      chordRoot: 0,
      mode: "mixolydian",
      op: "quote",
      tension: 0.3,
    });

    expect(colors.map((color) => color.chromaticOffset)).toEqual([0, 0, 0]);
    expect(colors.map((color) => color.harmonicRole)).toEqual(["root", "third", "fifth"]);
    expect(colors.at(-1)?.tags).toContain("interplay-resolution:landing");
  });

  test("adds a bounded chromatic lean in high-tension answers and resolves the landing", () => {
    const colors = colorInterplayVariation(makeVariation({
      degrees: [0, 2, 4, 5],
      rhythm: [
        { startBeat: 0, durationBeats: 0.5 },
        { startBeat: 1, durationBeats: 0.5 },
        { startBeat: 2, durationBeats: 0.5 },
        { startBeat: 3, durationBeats: 0.5 },
      ],
      dynamics: [0.4, 0.5, 0.4, 0.45],
    }), {
      chordRoot: 0,
      mode: "mixolydian",
      op: "quote",
      tension: 0.74,
    });

    expect(colors[1]).toMatchObject({
      colorRole: "tension",
      chromaticOffset: -1,
    });
    expect(colors[1]?.tags).toContain("interplay-chromatic:-1");
    expect(colors.at(-1)?.chromaticOffset).toBe(0);
    expect(colors.at(-1)?.tags).toContain("interplay-resolution:landing");
    expect(colors.every((color) => Math.abs(color.chromaticOffset) <= 1)).toBe(true);
  });

  test("renders the chromatic lean outside the current mode scale", () => {
    const tonalContext = createTonalContext("C", "mixolydian");
    const color = colorInterplayAnswerDegree({
      chordRoot: 0,
      degree: 2,
      mode: "mixolydian",
      noteCount: 4,
      noteIndex: 1,
      op: "quote",
      tension: 0.74,
    });

    const diatonicPitch = noteFromScaleDegree(tonalContext, 2, 2);
    const coloredPitch = noteFromScaleDegreeWithOffset(
      tonalContext,
      2,
      2,
      color.chromaticOffset,
    );

    expect(diatonicPitch).toBe("E2");
    expect(coloredPitch).toBe("Eb2");
    expect(tonalContext.scale).not.toContain("Eb");
  });

  test("is deterministic for the same answer context", () => {
    const variation = makeVariation({
      op: "invert",
      chordRoot: 4,
      degrees: [4, 2, 1, 3],
    });
    const context = {
      chordRoot: 4,
      mode: "dorian",
      op: variation.op,
      tension: 0.68,
    };

    expect(colorInterplayVariation(variation, context)).toEqual(
      colorInterplayVariation(variation, context),
    );
  });
});
