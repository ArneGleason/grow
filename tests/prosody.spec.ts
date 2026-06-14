import { expect, test } from "@playwright/test";
import { generateProsodicMelody } from "../src/melody-prosody";
import { scoreProsody, extractNotes } from "../src/prosody-scoring";
import { reFoot, shiftAnacrusis, alterCadence, varyContour } from "../src/prosody-development";
import type { PlayerPatternSource } from "../src/song-material";

test.describe("Track B1: Prosody Scoring Unit Tests", () => {
  test("scoreProsody calculates overall and subscores for a generated prosodic melody", () => {
    const phrase = generateProsodicMelody({ seed: 12345, baseOctave: 4, bars: 4 });
    const score = scoreProsody(phrase, [4, 4]);

    // Check structure
    expect(score).toBeDefined();
    expect(typeof score.overall).toBe("number");
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1.0);

    const sub = score.subscores;
    expect(sub).toBeDefined();
    expect(sub.richness).toBeGreaterThanOrEqual(0);
    expect(sub.richness).toBeLessThanOrEqual(1.0);
    expect(sub.anacrusis).toBeGreaterThanOrEqual(0);
    expect(sub.anacrusis).toBeLessThanOrEqual(1.0);
    expect(sub.questionAnswer).toBeGreaterThanOrEqual(0);
    expect(sub.questionAnswer).toBeLessThanOrEqual(1.0);
    expect(sub.anchorContrast).toBeGreaterThanOrEqual(0);
    expect(sub.anchorContrast).toBeLessThanOrEqual(1.0);
  });

  test("richness subscore detects even rhythms vs varied rhythms (inverted-U)", () => {
    // 1. Create a perfectly even, monotonous rhythm (all 1.0 beat quarter notes)
    const evenPhrase: PlayerPatternSource = {
      subdivisionBeats: 0.25,
      events: Array.from({ length: 64 }, (_, idx) => {
        if (idx % 4 === 0) {
          return {
            playerId: "melody",
            scaleDegree: 0,
            octave: 4,
            duration: "4n",
            durationBeats: 1.0,
            velocity: 0.3,
          };
        }
        return null;
      }),
    };

    const scoreEven = scoreProsody(evenPhrase, [4, 4]);
    // Should penalize perfectly even rhythms (richness score should be low)
    expect(scoreEven.subscores.richness).toBeLessThan(0.3);

    // 2. Create a phrase with a mix of durations (0.5, 1.5, 1.0)
    const variedPhrase = generateProsodicMelody({ seed: 42, baseOctave: 4, bars: 4 });
    const scoreVaried = scoreProsody(variedPhrase, [4, 4]);
    // Varied rhythm should have significantly higher richness score
    expect(scoreVaried.subscores.richness).toBeGreaterThan(0.6);
  });

  test("anacrusis subscore detects presence and absence of pickup notes", () => {
    // Seed 4 produces pickups in both antecedent and consequent phrases
    const phrase = generateProsodicMelody({ seed: 4, baseOctave: 4, bars: 4 });
    const score = scoreProsody(phrase, [4, 4]);
    expect(score.subscores.anacrusis).toBe(1.0);

    // Remove anacrusis using the development operator
    const removedPhrase = shiftAnacrusis(phrase, "remove");
    const scoreRemoved = scoreProsody(removedPhrase, [4, 4]);

    // Anacrusis score should drop to 0 after removing it
    expect(scoreRemoved.subscores.anacrusis).toBe(0.0);
    expect(score.overall).toBeGreaterThan(scoreRemoved.overall);
  });

  test("questionAnswer subscore detects question (dominant) and answer (tonic) cadences", () => {
    const phrase = generateProsodicMelody({ seed: 777, baseOctave: 4, bars: 4 });
    const notes = extractNotes(phrase);

    const anteNotes = notes.filter((n) => n.startBeat < 8);
    const consNotes = notes.filter((n) => n.startBeat >= 8);

    const lastAnte = anteNotes[anteNotes.length - 1];
    const lastCons = consNotes[consNotes.length - 1];

    // The generator should construct Antecedent ending on non-tonic (4) and Consequent ending on tonic (0)
    expect(lastAnte.scaleDegree).toBe(4);
    expect(lastCons.scaleDegree).toBe(0);

    const score = scoreProsody(phrase, [4, 4]);
    // High QA score since it fits question-answer structure
    expect(score.subscores.questionAnswer).toBeGreaterThanOrEqual(0.8);
  });

  test("anchorContrast subscore measures alignment with metrical beats", () => {
    // Create a phrase fully aligned with downbeats (beat 0, 4, 8, 12)
    const lockedPhrase: PlayerPatternSource = {
      subdivisionBeats: 0.25,
      events: Array.from({ length: 64 }, (_, idx) => {
        if (idx === 0 || idx === 16 || idx === 32 || idx === 48) {
          return {
            playerId: "melody",
            scaleDegree: 0,
            octave: 4,
            duration: "2n",
            durationBeats: 2.0,
            velocity: 0.46,
          };
        }
        return null;
      }),
    };

    const scoreLocked = scoreProsody(lockedPhrase, [4, 4]);

    // Create a highly syncopated phrase (notes only on weak subdivisions: 0.25, 4.25, 8.25, 12.25)
    const syncopatedPhrase: PlayerPatternSource = {
      subdivisionBeats: 0.25,
      events: Array.from({ length: 64 }, (_, idx) => {
        if (idx === 1 || idx === 17 || idx === 33 || idx === 49) {
          return {
            playerId: "melody",
            scaleDegree: 0,
            octave: 4,
            duration: "2n",
            durationBeats: 2.0,
            velocity: 0.46,
          };
        }
        return null;
      }),
    };

    const scoreSyncopated = scoreProsody(syncopatedPhrase, [4, 4]);
    // The locked phrase should have different anchorContrast score than highly syncopated one
    expect(scoreLocked.subscores.anchorContrast).not.toBe(scoreSyncopated.subscores.anchorContrast);
  });
});

test.describe("Track B2: Prosody Development Operators Unit Tests", () => {
  test("reFoot reconstructs rhythm while preserving pitch contours and scale degrees", () => {
    const phrase = generateProsodicMelody({ seed: 12, baseOctave: 4, bars: 4 });
    const originalNotes = extractNotes(phrase);

    // Run reFoot with a different seed
    const developed = reFoot(phrase, 9999);
    const developedNotes = extractNotes(developed);

    expect(developedNotes.length).toBeGreaterThan(0);
    
    // Check that scale degrees are drawn from the original set
    const originalDegrees = new Set(originalNotes.map((n) => n.scaleDegree));
    for (const note of developedNotes) {
      expect(originalDegrees.has(note.scaleDegree)).toBe(true);
      expect(note.scaleDegree).toBeGreaterThanOrEqual(-1);
      expect(note.scaleDegree).toBeLessThanOrEqual(8);
    }

    // Verify rhythm differs (not identical notes list)
    const originalStarts = originalNotes.map((n) => n.startBeat);
    const developedStarts = developedNotes.map((n) => n.startBeat);
    expect(developedStarts).not.toEqual(originalStarts);
  });

  test("shiftAnacrusis adds, removes, lengthens, and shortens pickups correctly", () => {
    const phrase = generateProsodicMelody({ seed: 4, baseOctave: 4, bars: 4 });
    
    // 1. Remove pickup
    const removed = shiftAnacrusis(phrase, "remove");
    const notesRemoved = extractNotes(removed);
    // There should be no note at beat 0 with short duration & low velocity
    const pickupAfter = notesRemoved.find((n) => n.startBeat === 0 && n.durationBeats <= 0.25);
    expect(pickupAfter).toBeUndefined();

    // 2. Add pickup back (to a phrase that doesn't have it)
    if (!pickupAfter) {
      const added = shiftAnacrusis(removed, "add");
      const notesAdded = extractNotes(added);
      const pickupNew = notesAdded.find((n) => n.startBeat === 0 && n.durationBeats === 0.25);
      expect(pickupNew).toBeDefined();
      expect(pickupNew?.velocity).toBe(0.18);
    }

    // 3. Lengthen pickup
    const lengthened = shiftAnacrusis(phrase, "lengthen");
    const notesLengthened = extractNotes(lengthened);
    const pickupLengthened = notesLengthened.find((n) => n.startBeat === 0);
    expect(pickupLengthened?.durationBeats).toBe(0.5);

    // 4. Shorten pickup
    const shortened = shiftAnacrusis(lengthened, "shorten");
    const notesShortened = extractNotes(shortened);
    const pickupShortened = notesShortened.find((n) => n.startBeat === 0);
    expect(pickupShortened?.durationBeats).toBe(0.125);
  });

  test("alterCadence alters cadence note properties deterministically", () => {
    const phrase = generateProsodicMelody({ seed: 45, baseOctave: 4, bars: 4 });

    // 1. Question to Answer: antecedent cadence note changes from 4 to 0
    const qa = alterCadence(phrase, "question-to-answer");
    const notesQA = extractNotes(qa);
    const anteCadenceQA = notesQA.filter((n) => n.startBeat < 8).pop();
    expect(anteCadenceQA?.scaleDegree).toBe(0);

    // 2. Answer to Question: consequent cadence note changes from 0 to 4
    const aq = alterCadence(phrase, "answer-to-question");
    const notesAQ = extractNotes(aq);
    const consCadenceAQ = notesAQ.filter((n) => n.startBeat >= 8).pop();
    expect(consCadenceAQ?.scaleDegree).toBe(4);

    // 3. Extend cadence: check duration increases
    const originalNotes = extractNotes(phrase);
    const originalAnteCadence = originalNotes.filter((n) => n.startBeat < 8).pop();
    const extended = alterCadence(phrase, "extend-cadence");
    const notesExtended = extractNotes(extended);
    const anteCadenceExt = notesExtended.filter((n) => n.startBeat < 8).pop();
    expect(anteCadenceExt?.durationBeats).toBeGreaterThan(originalAnteCadence?.durationBeats ?? 0);
  });

  test("varyContour performs pitch-only transforms, preserving rhythm exactly", () => {
    const phrase = generateProsodicMelody({ seed: 67, baseOctave: 4, bars: 4 });
    const originalNotes = extractNotes(phrase);

    const testContourAction = (action: any) => {
      const varied = varyContour(phrase, action);
      const notes = extractNotes(varied);

      // Rhythm MUST be preserved exactly
      expect(notes.length).toBe(originalNotes.length);
      for (let i = 0; i < notes.length; i++) {
        expect(notes[i].startBeat).toBe(originalNotes[i].startBeat);
        expect(notes[i].durationBeats).toBe(originalNotes[i].durationBeats);
        expect(notes[i].velocity).toBe(originalNotes[i].velocity);
        // Pitch degree must stay bounded in-scale
        expect(notes[i].scaleDegree).toBeGreaterThanOrEqual(-1);
        expect(notes[i].scaleDegree).toBeLessThanOrEqual(8);
      }
      return notes;
    };

    // 1. Invert
    testContourAction("invert");

    // 2. Retrograde
    const notesRetro = testContourAction("retrograde");
    // The scale degrees should be in reverse order compared to original
    for (let i = 0; i < notesRetro.length; i++) {
      expect(notesRetro[i].scaleDegree).toBe(originalNotes[originalNotes.length - 1 - i].scaleDegree);
    }

    // 3. Transpose Up/Down
    const notesUp = testContourAction("transposeUp");
    for (let i = 0; i < notesUp.length; i++) {
      expect(notesUp[i].scaleDegree).toBe(Math.min(8, originalNotes[i].scaleDegree + 1));
    }

    const notesDown = testContourAction("transposeDown");
    for (let i = 0; i < notesDown.length; i++) {
      expect(notesDown[i].scaleDegree).toBe(Math.max(-1, originalNotes[i].scaleDegree - 1));
    }

    // 4. Narrow/Widen
    testContourAction("narrow");
    testContourAction("widen");
  });
});
