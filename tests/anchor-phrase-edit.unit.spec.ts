import { expect, test } from "@playwright/test";
import { ANCHOR_PHRASE_CAPS, type AnchorPhrase, validateAnchorPhrase } from "../src/anchor-phrase";
import {
  addAnchorToPhrase,
  editAnchorInPhrase,
  editConnectorInPhrase,
  joinSegmentsInPhrase,
  removeAnchorFromPhrase,
  splitSegmentInPhrase,
} from "../src/anchor-phrase-edit";

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

  test("applies a connector kernel and knob patch without moving anchors", () => {
    const result = editConnectorInPhrase(BASE_PHRASE, 0, 0, {
      bias: -0.4,
      density: 0.91,
      kernel: "orbit",
      pull: 0.2,
      reach: 0.7,
      skew: 0.3,
    });

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.phrase.segments[0].connectors[0]).toMatchObject({
      bias: -0.4,
      density: 0.91,
      kernel: "orbit",
      pull: 0.2,
      reach: 0.7,
      skew: 0.3,
    });
    expect(result.phrase.segments[0].anchors).toEqual(BASE_PHRASE.segments[0].anchors);
    expect(result.phrase.segments[1]).toEqual(BASE_PHRASE.segments[1]);
  });

  test("rejects an unknown connector kernel and keeps the current connector", () => {
    const result = editConnectorInPhrase(BASE_PHRASE, 0, 0, {
      kernel: "spiral",
    });

    expect(result.valid).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.errors).toContain("segments.0.connectors.0.kernel must be one of fill, detour, approach, orbit, skip");
    expect(result.phrase).toEqual(BASE_PHRASE);
  });

  test("clamps connector knobs into their safe ranges", () => {
    const result = editConnectorInPhrase(BASE_PHRASE, 1, 0, {
      bias: 2,
      color: 2,
      density: -1,
      pull: 3,
      reach: -4,
      skew: -3,
    });

    expect(result.valid).toBe(true);
    expect(result.phrase.segments[1].connectors[0]).toMatchObject({
      bias: 1,
      color: 1,
      density: 0,
      pull: 1,
      reach: 0,
      skew: -1,
    });
    expect(result.clamps).toEqual(expect.arrayContaining([
      "segments.1.connectors.0.bias clamped to 1",
      "segments.1.connectors.0.color clamped to 1",
      "segments.1.connectors.0.density clamped to 0",
      "segments.1.connectors.0.pull clamped to 1",
      "segments.1.connectors.0.reach clamped to 0",
      "segments.1.connectors.0.skew clamped to -1",
    ]));
  });

  test("reports unchanged connector patches without rewriting structure", () => {
    const result = editConnectorInPhrase(BASE_PHRASE, 0, 0, {
      bias: 0,
      density: 0.5,
      kernel: "fill",
      pull: 0.5,
      reach: 0.5,
      skew: 0,
    });

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.phrase).toEqual(BASE_PHRASE);
  });

  test("adds an anchor into available space and maintains connector counts", () => {
    const result = addAnchorToPhrase(BASE_PHRASE, 0, 4.12, {
      dynamics: 0.5,
    });

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(validateAnchorPhrase(result.phrase).valid).toBe(true);
    expect(result.phrase.segments[0].anchors).toHaveLength(3);
    expect(result.phrase.segments[0].connectors).toHaveLength(2);
    const inserted = result.phrase.segments[0].anchors[2];
    expect(inserted.startBeat).toBe(4);
    expect(inserted.startBeat + inserted.durationBeats).toBeLessThanOrEqual(
      result.phrase.segments[1].anchors[0].startBeat,
    );
    expect(result.clamps).toEqual(expect.arrayContaining([
      "segments.0.anchors.new.startBeat snapped to 4",
    ]));
  });

  test("removes an anchor and one connector while keeping the segment valid", () => {
    const added = addAnchorToPhrase(BASE_PHRASE, 0, 4);
    const result = removeAnchorFromPhrase(added.phrase, 0, 1);

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(validateAnchorPhrase(result.phrase).valid).toBe(true);
    expect(result.phrase.segments[0].anchors).toHaveLength(2);
    expect(result.phrase.segments[0].connectors).toHaveLength(1);
    expect(result.phrase.segments[0].anchors.map((anchor) => anchor.startBeat)).toEqual([0, 4]);
  });

  test("removes an empty segment when its last anchor is removed", () => {
    const split = splitSegmentInPhrase(BASE_PHRASE, 0, 1);
    const result = removeAnchorFromPhrase(split.phrase, 1, 0);

    expect(result.valid).toBe(true);
    expect(result.phrase.segments).toHaveLength(BASE_PHRASE.segments.length);
    expect(validateAnchorPhrase(result.phrase).valid).toBe(true);
  });

  test("rejects removing the phrase's only anchor", () => {
    const phrase: AnchorPhrase = {
      segments: [
        {
          anchors: [{ degree: 1, octave: 4, startBeat: 0, durationBeats: 1, dynamics: 0.7 }],
          connectors: [],
        },
      ],
    };
    const result = removeAnchorFromPhrase(phrase, 0, 0);

    expect(result.valid).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.errors).toContain("AnchorPhrase must keep at least one anchor");
    expect(result.phrase).toEqual(phrase);
  });

  test("splits a segment, drops the crossing connector, and opens a breath", () => {
    const result = splitSegmentInPhrase(BASE_PHRASE, 0, 1);

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(validateAnchorPhrase(result.phrase).valid).toBe(true);
    expect(result.phrase.segments).toHaveLength(3);
    expect(result.phrase.segments[0].anchors).toHaveLength(1);
    expect(result.phrase.segments[0].connectors).toHaveLength(0);
    expect(result.phrase.segments[1].anchors).toHaveLength(1);
    expect(result.phrase.segments[1].connectors).toHaveLength(0);
    expect(result.phrase.segments[1].anchors[0].startBeat).toBe(2.5);
    const firstEnd = result.phrase.segments[0].anchors[0].startBeat +
      result.phrase.segments[0].anchors[0].durationBeats;
    expect(result.phrase.segments[1].anchors[0].startBeat).toBeGreaterThan(firstEnd);
  });

  test("joins adjacent segments with one bridging connector", () => {
    const result = joinSegmentsInPhrase(BASE_PHRASE, 0);

    expect(result.valid).toBe(true);
    expect(result.changed).toBe(true);
    expect(validateAnchorPhrase(result.phrase).valid).toBe(true);
    expect(result.phrase.segments).toHaveLength(1);
    expect(result.phrase.segments[0].anchors).toHaveLength(4);
    expect(result.phrase.segments[0].connectors).toHaveLength(3);
    expect(result.phrase.segments[0].connectors[1].kernel).toBe("fill");
  });

  test("rejects structural edits that would break phrase caps or boundaries", () => {
    const badSplit = splitSegmentInPhrase(BASE_PHRASE, 0, 0);
    expect(badSplit.valid).toBe(false);
    expect(badSplit.changed).toBe(false);
    expect(badSplit.phrase).toEqual(BASE_PHRASE);

    const badJoin = joinSegmentsInPhrase(BASE_PHRASE, 1);
    expect(badJoin.valid).toBe(false);
    expect(badJoin.changed).toBe(false);
    expect(badJoin.phrase).toEqual(BASE_PHRASE);

    const fullPhrase: AnchorPhrase = {
      segments: [
        {
          anchors: Array.from({ length: ANCHOR_PHRASE_CAPS.maxAnchors }, (_, index) => ({
            degree: (index % 7) + 1,
            dynamics: 0.7,
            durationBeats: 0.25,
            octave: 4,
            startBeat: index * 0.5,
          })),
          connectors: Array.from({ length: ANCHOR_PHRASE_CAPS.maxAnchors - 1 }, () => ({
            kernel: "fill" as const,
            reach: 0.5,
            density: 0.5,
            bias: 0,
            pull: 0.5,
            color: 0,
            skew: 0,
          })),
        },
      ],
    };
    const badAdd = addAnchorToPhrase(fullPhrase, 0, 0.25);
    expect(badAdd.valid).toBe(false);
    expect(badAdd.changed).toBe(false);
    expect(badAdd.phrase).toEqual(fullPhrase);
  });
});
