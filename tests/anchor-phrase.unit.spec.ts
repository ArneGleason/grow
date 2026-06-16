import { expect, test } from "@playwright/test";
import {
  ANCHOR_PHRASE_CAPS,
  CONNECTOR_KERNELS,
  normalizeAnchorPhrase,
  validateAnchorPhrase,
} from "../src/anchor-phrase";

const WELL_FORMED_PHRASE = {
  segments: [
    {
      anchors: [
        { degree: 1, octave: 4, startBeat: 0, durationBeats: 1, dynamics: 0.72 },
        { degree: 5, octave: 4, startBeat: 2, durationBeats: 1, dynamics: 0.66 },
      ],
      connectors: [
        { kernel: "approach", reach: 0.7, density: 0.48, bias: -0.1, pull: 0.8, color: 0.12, skew: 0.2 },
      ],
    },
    {
      anchors: [
        { degree: 3, octave: 5, startBeat: 6, durationBeats: 1.5, dynamics: 0.58 },
        { degree: 1, octave: 5, startBeat: 8, durationBeats: 2, dynamics: 0.74 },
      ],
      connectors: [
        { kernel: "orbit", reach: 0.2, density: 0.36, bias: 0.4, pull: 0.3, color: 0.05, skew: -0.3 },
      ],
    },
  ],
};

test.describe("Anchor phrase representation", () => {
  test("validates and round-trips a multi-segment phrase with a breath gap", () => {
    const result = validateAnchorPhrase(WELL_FORMED_PHRASE);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.clamps).toEqual([]);
    expect(result.phrase).toEqual(WELL_FORMED_PHRASE);
    const firstSegmentEnd = result.phrase.segments[0].anchors.at(-1)!.startBeat +
      result.phrase.segments[0].anchors.at(-1)!.durationBeats;
    const secondSegmentStart = result.phrase.segments[1].anchors[0].startBeat;
    expect(secondSegmentStart - firstSegmentEnd).toBe(3);
  });

  test("clamps out-of-range numeric fields and reports the clamps", () => {
    const result = normalizeAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 9.8, octave: -2, startBeat: -4, durationBeats: 0, dynamics: 1.8 },
            {
              degree: -3,
              octave: 10,
              startBeat: ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats + 10,
              durationBeats: 999,
              dynamics: -0.5,
            },
          ],
          connectors: [
            { kernel: "fill", reach: 2, density: -1, bias: 2, pull: -1, color: 2, skew: -2 },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.phrase.segments[0].anchors[0]).toMatchObject({
      degree: 7,
      octave: 0,
      startBeat: 0,
      durationBeats: ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      dynamics: 1,
    });
    expect(result.phrase.segments[0].anchors[1]).toMatchObject({
      degree: 1,
      octave: 8,
      startBeat: ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      durationBeats: ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      dynamics: 0,
    });
    expect(result.phrase.segments[0].connectors[0]).toMatchObject({
      reach: 1,
      density: 0,
      bias: 1,
      pull: 0,
      color: 1,
      skew: -1,
    });
    expect(result.clamps).toEqual(expect.arrayContaining([
      "segments.0.anchors.0.degree clamped to 7",
      "segments.0.anchors.0.octave clamped to 0",
      "segments.0.anchors.0.startBeat clamped to 0",
      "segments.0.anchors.0.durationBeats clamped to 0.0625",
      "segments.0.anchors.0.dynamics clamped to 1",
      "segments.0.anchors.1.startBeat clamped to 511.9375",
      "segments.0.connectors.0.reach clamped to 1",
      "segments.0.connectors.0.skew clamped to -1",
    ]));
  });

  test("rejects unknown connector kernels", () => {
    const result = validateAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, startBeat: 0, durationBeats: 1 },
            { degree: 2, startBeat: 1.5, durationBeats: 1 },
          ],
          connectors: [{ kernel: "spiral" }],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`segments.0.connectors.0.kernel must be one of ${CONNECTOR_KERNELS.join(", ")}`);
    expect(result.phrase.segments[0].connectors[0].kernel).toBe("fill");
  });

  test("rejects structural violations", () => {
    const wrongConnectorCount = validateAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, startBeat: 0, durationBeats: 1 },
            { degree: 3, startBeat: 2, durationBeats: 1 },
          ],
          connectors: [],
        },
      ],
    });
    expect(wrongConnectorCount.valid).toBe(false);
    expect(wrongConnectorCount.errors).toContain("segments.0.connectors length must equal anchors.length - 1 (1)");

    const overlap = validateAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, startBeat: 0, durationBeats: 2 },
            { degree: 5, startBeat: 1, durationBeats: 1 },
          ],
          connectors: [{ kernel: "detour" }],
        },
      ],
    });
    expect(overlap.valid).toBe(false);
    expect(overlap.errors).toContain("segments.0.anchors.1 must start at or after previous anchor end 2");

    const unsorted = validateAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 5, startBeat: 3, durationBeats: 1 },
            { degree: 1, startBeat: 2, durationBeats: 1 },
          ],
          connectors: [{ kernel: "skip" }],
        },
      ],
    });
    expect(unsorted.valid).toBe(false);
    expect(unsorted.errors).toContain("segments.0.anchors must be sorted by startBeat");

    const emptySegment = validateAnchorPhrase({ segments: [{ anchors: [], connectors: [] }] });
    expect(emptySegment.valid).toBe(false);
    expect(emptySegment.errors).toContain("segments.0.anchors must include at least one anchor");
  });

  test("preserves real rests between segments and rejects segment overlap", () => {
    const result = validateAnchorPhrase({
      segments: [
        {
          anchors: [{ degree: 1, startBeat: 0, durationBeats: 2 }],
          connectors: [],
        },
        {
          anchors: [{ degree: 5, startBeat: 5, durationBeats: 1 }],
          connectors: [],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.phrase.segments[1].anchors[0].startBeat).toBe(5);

    const overlappingSegments = validateAnchorPhrase({
      segments: [
        {
          anchors: [{ degree: 1, startBeat: 0, durationBeats: 4 }],
          connectors: [],
        },
        {
          anchors: [{ degree: 5, startBeat: 3, durationBeats: 1 }],
          connectors: [],
        },
      ],
    });
    expect(overlappingSegments.valid).toBe(false);
    expect(overlappingSegments.errors).toContain("segments.1 must start at or after previous segment end 4");
  });
});
