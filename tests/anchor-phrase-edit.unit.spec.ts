import { expect, test } from "@playwright/test";
import { ANCHOR_PHRASE_CAPS, type AnchorPhrase } from "../src/anchor-phrase";
import { editAnchorInPhrase } from "../src/anchor-phrase-edit";

const BASE_PHRASE: AnchorPhrase = {
  segments: [
    {
      anchors: [
        { degree: 1, octave: 4, startBeat: 0, durationBeats: 1, dynamics: 0.7 },
        { degree: 5, octave: 4, startBeat: 2, durationBeats: 1, dynamics: 0.66 },
      ],
      connectors: [
        { kernel: "fill", reach: 0.5, density: 0.5, bias: 0, pull: 0.5, color: 0, skew: 0 },
      ],
    },
    {
      anchors: [
        { degree: 3, octave: 5, startBeat: 6, durationBeats: 1, dynamics: 0.58 },
        { degree: 1, octave: 5, startBeat: 8, durationBeats: 1, dynamics: 0.74 },
      ],
      connectors: [
        { kernel: "approach", reach: 0.7, density: 0.5, bias: -0.2, pull: 0.8, color: 0, skew: 0 },
      ],
    },
  ],
};

test.describe("anchor phrase anchor edits", () => {
  test("applies a valid patch through one mutation path", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 0, 1, {
      degree: 6,
      dynamics: 0.42,
      octave: 5,
      startBeat: 2.25,
    });

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.phrase.segments[0].anchors[1]).toMatchObject({
      degree: 6,
      dynamics: 0.42,
      octave: 5,
      startBeat: 2.25,
    });
  });

  test("clamps pitch and dynamics into the safe anchor envelope", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 0, 0, {
      degree: 99,
      dynamics: -1,
      octave: 12,
    });

    expect(result.valid).toBe(true);
    expect(result.phrase.segments[0].anchors[0]).toMatchObject({
      degree: 7,
      dynamics: 0,
      octave: 8,
    });
    expect(result.clamps).toEqual(expect.arrayContaining([
      "segments.0.anchors.0.degree clamped to 7",
      "segments.0.anchors.0.dynamics clamped to 0",
      "segments.0.anchors.0.octave clamped to 8",
    ]));
  });

  test("snaps time edits and prevents overlap within a segment", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 0, 0, {
      startBeat: 1.91,
      durationBeats: 4,
    });

    const edited = result.phrase.segments[0].anchors[0];
    const next = result.phrase.segments[0].anchors[1];
    expect(result.valid).toBe(true);
    expect(edited.startBeat).toBeLessThan(next.startBeat);
    expect(edited.startBeat + edited.durationBeats).toBeLessThanOrEqual(next.startBeat);
    expect(edited.startBeat % 0.25).toBe(0);
    expect(result.clamps.join("\n")).toContain("segments.0.anchors.0.startBeat");
    expect(result.clamps.join("\n")).toContain("segments.0.anchors.0.durationBeats");
  });

  test("keeps anchors from crossing the inter-segment breath", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 0, 1, {
      startBeat: 5.75,
      durationBeats: 4,
    });

    const edited = result.phrase.segments[0].anchors[1];
    const nextSegmentStart = result.phrase.segments[1].anchors[0].startBeat;
    expect(result.valid).toBe(true);
    expect(edited.startBeat + edited.durationBeats).toBeLessThanOrEqual(nextSegmentStart);
  });

  test("rejects missing anchors without mutating the phrase", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 12, 0, { degree: 2 });

    expect(result.valid).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.errors).toContain("segments.12.anchors.0 does not exist");
    expect(result.phrase).toEqual(BASE_PHRASE);
  });

  test("preserves minimum anchor duration under heavy clamping", () => {
    const result = editAnchorInPhrase(BASE_PHRASE, 0, 0, {
      durationBeats: -1,
    });

    expect(result.valid).toBe(true);
    expect(result.phrase.segments[0].anchors[0].durationBeats).toBe(
      ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
    );
  });
});
