import { expect, test } from "@playwright/test";
import { validateAnchorPhrase } from "../src/anchor-phrase";
import { renderAnchorPhrase } from "../src/anchor-phrase-render";
import { generateProsodicAnchorPhrase, generateProsodicMelody } from "../src/melody-prosody";
import { extractNotes } from "../src/prosody-scoring";
import { createTonalContext, noteFromScaleDegree } from "../src/tonal-context";

test.describe("Prosodic anchor phrase generator", () => {
  test("generates deterministic valid anchor phrases", () => {
    const first = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4 });
    const second = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4 });
    const validation = validateAnchorPhrase(first);

    expect(first).toEqual(second);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(first.segments).toHaveLength(2);
    for (const segment of first.segments) {
      expect(segment.connectors).toHaveLength(segment.anchors.length - 1);
    }
  });

  test("keeps antecedent and consequent as two segments with a real breath", () => {
    const phrase = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4 });
    const [antecedent, consequent] = phrase.segments;
    const anteLast = antecedent.anchors[antecedent.anchors.length - 1];
    const consFirst = consequent.anchors[0];

    expect(antecedent.anchors.length).toBeGreaterThanOrEqual(3);
    expect(consequent.anchors.length).toBeGreaterThanOrEqual(3);
    expect(consFirst.startBeat - (anteLast.startBeat + anteLast.durationBeats)).toBeGreaterThan(0);
    expect(consFirst.startBeat).toBe(8);
  });

  test("uses 1-based language degrees with dominant question and home answer cadences", () => {
    const phrase = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4 });
    const [antecedent, consequent] = phrase.segments;
    const allDegrees = phrase.segments.flatMap((segment) => segment.anchors.map((anchor) => anchor.degree));

    expect(allDegrees.every((degree) => Number.isInteger(degree) && degree >= 1 && degree <= 7)).toBe(true);
    expect(antecedent.anchors[antecedent.anchors.length - 1].degree).toBe(5);
    expect(consequent.anchors[consequent.anchors.length - 1].degree).toBe(1);
  });

  test("keeps a light anacrusis anchor at the start of each phrase", () => {
    const phrase = generateProsodicAnchorPhrase({ seed: 42, baseOctave: 4, bars: 4 });
    const pickups = phrase.segments.map((segment) => segment.anchors[0]);
    const firstLandings = phrase.segments.map((segment) => segment.anchors[1]);

    expect(pickups.map((anchor) => anchor.startBeat)).toEqual([0, 8]);
    expect(pickups.every((anchor) => anchor.durationBeats === 0.25 && anchor.dynamics < 0.25)).toBe(true);
    expect(firstLandings.map((anchor) => anchor.startBeat)).toEqual([0.5, 8.5]);
    expect(firstLandings.every((anchor) => anchor.dynamics >= 0.25)).toBe(true);
  });

  test("renders through the existing flat melody contract and stays in-scale", () => {
    const tonalContext = createTonalContext("C", "mixolydian");
    const anchorPhrase = generateProsodicAnchorPhrase({ seed: 777, baseOctave: 4, bars: 4 });
    const renderedFromAnchor = renderAnchorPhrase(anchorPhrase, { baseOctave: 4, subdivisionBeats: 0.25 });
    const renderedFromGenerator = generateProsodicMelody({ seed: 777, baseOctave: 4, bars: 4 });
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
