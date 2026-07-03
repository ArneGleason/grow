import { expect, test } from "@playwright/test";
import { validateAnchorPhrase } from "../src/anchor-phrase";
import { renderAnchorPhrase } from "../src/anchor-phrase-render";
import { chooseMelodyPlan, finalCadenceDegree, type MelodyPlan } from "../src/melody-plan";
import { generateProsodicAnchorPhrase, generateProsodicMelody } from "../src/melody-prosody";
import { extractNotes } from "../src/prosody-scoring";
import { createTonalContext, noteFromScaleDegree } from "../src/tonal-context";

const FIXED_PLAN: MelodyPlan = {
  seed: 1234,
  phraseStructure: "2-even",
  phraseBeats: [8, 8],
  motifScheme: "through",
  contours: ["climb", "descent"],
  cadences: { internal: [5], final: "1" },
  anacrusis: "pickup-run",
  densityFamily: "flowing",
  registerBase: 4,
};

test.describe("Prosodic anchor phrase generator", () => {
  test("generates deterministic valid anchor phrases from a melody plan", () => {
    const plan = chooseMelodyPlan(777);
    const first = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4, plan });
    const second = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4, plan });
    const validation = validateAnchorPhrase(first);

    expect(first).toEqual(second);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(first.segments).toHaveLength(plan.phraseBeats.length);
    for (const segment of first.segments) {
      expect(segment.connectors).toHaveLength(segment.anchors.length - 1);
    }
  });

  test("uses plan phrase allocations with real breaths between segments", () => {
    const plan = chooseMelodyPlan(777);
    const phrase = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4, plan });
    let expectedStart = 0;

    for (const [index, segment] of phrase.segments.entries()) {
      expect(segment.anchors[0].startBeat).toBeCloseTo(expectedStart, 3);
      const next = phrase.segments[index + 1];
      if (next) {
        const last = segment.anchors[segment.anchors.length - 1];
        expect(next.anchors[0].startBeat - (last.startBeat + last.durationBeats)).toBeGreaterThan(0);
      }
      expectedStart += plan.phraseBeats[index] ?? 0;
    }
    expect(expectedStart).toBe(16);
  });

  test("uses 1-based language degrees and plan cadences", () => {
    const phrase = generateProsodicAnchorPhrase({ seed: 1234, baseOctave: 4, bars: 4, plan: FIXED_PLAN });
    const allDegrees = phrase.segments.flatMap((segment) => segment.anchors.map((anchor) => anchor.degree));
    const first = phrase.segments[0];
    const second = phrase.segments[1];

    expect(allDegrees.every((degree) => Number.isInteger(degree) && degree >= 1 && degree <= 7)).toBe(true);
    expect(first.anchors[first.anchors.length - 1].degree).toBe(FIXED_PLAN.cadences.internal[0]);
    expect(second.anchors[second.anchors.length - 1].degree).toBe(finalCadenceDegree(FIXED_PLAN.cadences.final));
  });

  test("keeps plan anacrusis at the start of each phrase", () => {
    const phrase = generateProsodicAnchorPhrase({ seed: 42, baseOctave: 4, bars: 4, plan: FIXED_PLAN });
    const pickups = phrase.segments.map((segment) => segment.anchors.slice(0, 2));
    const firstLandings = phrase.segments.map((segment) => segment.anchors[2]);

    expect(pickups.map((anchors) => anchors.map((anchor) => anchor.startBeat))).toEqual([[0, 0.25], [8, 8.25]]);
    expect(pickups.flat().every((anchor) => anchor.durationBeats === 0.25 && anchor.dynamics < 0.25)).toBe(true);
    expect(firstLandings.map((anchor) => anchor.startBeat)).toEqual([0.75, 8.75]);
    expect(firstLandings.every((anchor) => anchor.dynamics >= 0.25)).toBe(true);
  });

  test("renders through the existing flat melody contract and stays in-scale", () => {
    const tonalContext = createTonalContext("C", "mixolydian");
    const anchorPhrase = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4, plan: FIXED_PLAN });
    const renderedFromAnchor = renderAnchorPhrase(anchorPhrase, { baseOctave: 4, subdivisionBeats: 0.25 });
    const renderedFromGenerator = generateProsodicMelody({ seed: 777, baseOctave: 4, bars: 4, plan: FIXED_PLAN });
    const notes = extractNotes(renderedFromGenerator);

    expect(renderedFromGenerator).toEqual(renderedFromAnchor);
    expect(renderedFromGenerator.subdivisionBeats).toBe(0.25);
    expect(renderedFromGenerator.events).toHaveLength(64);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      const renderedNote = noteFromScaleDegree(tonalContext, note.scaleDegree, 4);
      const pitchClass = renderedNote.replace(/\d+$/, "");
      expect(tonalContext.scale).toContain(pitchClass);
    }
  });
});
