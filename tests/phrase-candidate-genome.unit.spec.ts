import { expect, test } from "@playwright/test";
import { DEMO_ANCHOR_PHRASE } from "../src/anchor-phrase-render";
import { validateCandidate } from "../src/candidate-store";
import {
  createAnchorPhraseCandidateGenome,
  createAnchorPhraseCandidateGenomeFromPattern,
  isAnchorPhraseCandidateGenome,
  renderPhraseCandidateGenome,
} from "../src/phrase-candidate-genome";
import { generateProsodicMelody } from "../src/melody-prosody";
import { extractNotes, scoreProsody } from "../src/prosody-scoring";
import { noteFromScaleDegree, DEFAULT_TONAL_CONTEXT } from "../src/tonal-context";

test.describe("phrase candidate anchor genomes", () => {
  test("validates a native anchor phrase genome and renders it to the flat phrase contract", () => {
    const genome = createAnchorPhraseCandidateGenome(DEMO_ANCHOR_PHRASE);
    const validation = validateCandidate({
      kind: "phrase",
      genome,
      scores: {},
      fitness: 0,
      generation: 0,
      seed: 1,
      status: "alive",
    });

    expect(validation.valid).toBe(true);
    expect(isAnchorPhraseCandidateGenome(validation.candidate.genome)).toBe(true);

    const rendered = renderPhraseCandidateGenome(validation.candidate.genome);
    const notes = extractNotes(rendered);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      const pitch = noteFromScaleDegree(DEFAULT_TONAL_CONTEXT, note.scaleDegree, 4).replace(/\d+$/, "");
      expect(DEFAULT_TONAL_CONTEXT.scale).toContain(pitch);
    }
  });

  test("wraps a legacy flat pattern as anchors without changing the prosody score", () => {
    const flat = generateProsodicMelody({ seed: 2026, baseOctave: 4, bars: 4 });
    const genome = createAnchorPhraseCandidateGenomeFromPattern(flat);
    const rendered = renderPhraseCandidateGenome(genome);

    expect(isAnchorPhraseCandidateGenome(genome)).toBe(true);
    expect(rendered.subdivisionBeats).toBe(flat.subdivisionBeats);
    expect(resolvedNoteStream(rendered)).toEqual(resolvedNoteStream(flat));
    expect(scoreProsody(rendered, [4, 4])).toEqual(scoreProsody(flat, [4, 4]));
  });

  test("keeps legacy flat phrase genomes valid for old data and manual fixtures", () => {
    const flat = generateProsodicMelody({ seed: 99, baseOctave: 4, bars: 4 });
    const validation = validateCandidate({
      kind: "phrase",
      genome: flat,
      scores: {},
      fitness: 0,
      generation: 0,
      seed: 99,
      status: "alive",
    });

    expect(validation.valid).toBe(true);
    expect(isAnchorPhraseCandidateGenome(validation.candidate.genome)).toBe(false);
    expect(renderPhraseCandidateGenome(validation.candidate.genome)).toEqual(flat);
  });
});

function resolvedNoteStream(pattern: ReturnType<typeof generateProsodicMelody>) {
  return extractNotes(pattern).map((note) => ({
    startBeat: note.startBeat,
    durationBeats: note.durationBeats,
    pitch: noteFromScaleDegree(DEFAULT_TONAL_CONTEXT, note.scaleDegree, pattern.events[note.index]?.octave ?? 4),
    velocity: note.velocity,
  }));
}
