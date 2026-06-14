import type { PlayerPatternSource, PatternNoteSource } from "./song-material";
import { extractNotes } from "./prosody-scoring";

export type ContourVariation = 'invert' | 'retrograde' | 'transposeUp' | 'transposeDown' | 'narrow' | 'widen';
export type CadenceVariation = 'question-to-answer' | 'answer-to-question' | 'extend-cadence' | 'shift-accent';
export type AnacrusisVariation = 'add' | 'remove' | 'lengthen' | 'shorten';

const GRID = 0.25;
const TOTAL_BEATS = 16;

type Stress = 0 | 1 | 2;
interface Cell {
  dur: number;
  stress: Stress;
}

const FEET: readonly (readonly Cell[])[] = [
  [{ dur: 0.5, stress: 0 }, { dur: 1.5, stress: 2 }], // iamb
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 1 }], // trochee
  [{ dur: 0.25, stress: 0 }, { dur: 0.25, stress: 0 }, { dur: 1.0, stress: 2 }], // anapest
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }], // dactyl
  [{ dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }], // even
];

const STRESS_VELOCITY: Record<Stress, number> = { 0: 0.18, 1: 0.3, 2: 0.46 };

function clampDegree(value: number): number {
  return Math.max(-1, Math.min(8, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function beatsToBarsBeatsSixteenths(beats: number): string {
  const totalSixteenths = Math.max(1, Math.round(beats * 4));
  const bars = Math.floor(totalSixteenths / 16);
  const remainder = totalSixteenths % 16;
  const wholeBeats = Math.floor(remainder / 4);
  const sixteenths = remainder % 4;
  return `${bars}:${wholeBeats}:${sixteenths}`;
}

function mulberry32(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replaces events in a PlayerPatternSource with a list of reconstructed notes.
 */
function rebuildPatternSource(
  notes: readonly { startBeat: number; durationBeats: number; scaleDegree: number; velocity: number }[],
  baseOctave: number = 4
): PlayerPatternSource {
  const steps = Math.round(TOTAL_BEATS / GRID);
  const events: Array<PatternNoteSource | null> = new Array(steps).fill(null);
  let lastEnd = -1;

  // Sort notes by startBeat to ensure correct ordering
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);

  for (const note of sorted) {
    const index = Math.round(note.startBeat / GRID) % steps;
    if (note.startBeat < lastEnd) continue; // guard against overlap
    events[index] = {
      playerId: "melody",
      scaleDegree: clampDegree(note.scaleDegree),
      octave: baseOctave,
      duration: beatsToBarsBeatsSixteenths(note.durationBeats),
      durationBeats: round3(note.durationBeats),
      velocity: round3(note.velocity),
    };
    lastEnd = note.startBeat + note.durationBeats;
  }
  return { subdivisionBeats: GRID, events };
}

/**
 * Helper to build the body of a phrase using metrical feet, filling with original scale degrees.
 */
function buildBodyNotes(
  rng: () => number,
  startBeat: number,
  bodyBudget: number,
  degrees: number[],
  degreeIndexRef: { value: number }
): { startBeat: number; durationBeats: number; scaleDegree: number; velocity: number }[] {
  const notes: { startBeat: number; durationBeats: number; scaleDegree: number; velocity: number }[] = [];
  let pos = startBeat;

  while (pos - startBeat < bodyBudget - 0.5) {
    const foot = FEET[Math.floor(rng() * FEET.length)] ?? FEET[0];
    for (const cell of foot) {
      if (pos - startBeat >= bodyBudget) break;
      const dur = Math.min(cell.dur, bodyBudget - (pos - startBeat));
      if (dur < GRID) break;

      // Extract scale degree from original degrees (cycling if needed)
      const degree = degrees.length > 0 
        ? degrees[degreeIndexRef.value % degrees.length] 
        : 2;
      degreeIndexRef.value++;

      notes.push({
        startBeat: pos,
        durationBeats: dur,
        scaleDegree: degree,
        velocity: STRESS_VELOCITY[cell.stress],
      });
      pos += dur;
    }
  }

  return notes;
}

/**
 * B2: reFoot operator.
 * Rebuilds the rhythmic structure of the phrase using feet choices from a seed,
 * while mapping original scale degrees onto the new note positions.
 */
export function reFoot(phrase: PlayerPatternSource, seed: number): PlayerPatternSource {
  const originalNotes = extractNotes(phrase);
  if (originalNotes.length === 0) return phrase;

  const rng = mulberry32(seed >>> 0);

  // Extract scale degrees of body notes (excluding cadences)
  const anteBodyOriginal = originalNotes.filter((n) => n.startBeat < 5.5);
  const consBodyOriginal = originalNotes.filter((n) => n.startBeat >= 8 && n.startBeat < 13.5);

  const anteDegrees = anteBodyOriginal.map((n) => n.scaleDegree);
  const consDegrees = consBodyOriginal.map((n) => n.scaleDegree);

  const newNotes: { startBeat: number; durationBeats: number; scaleDegree: number; velocity: number }[] = [];

  // 1. Antecedent body
  const anteBudget = 5.5; // 8 - 1.5 (cadence hold) - 0.5 (breath)
  const anteIndexRef = { value: 0 };
  
  // Optional pickup/anacrusis at start (like generator does)
  let antePos = 0;
  if (rng() < 0.7) {
    const degree = anteDegrees.length > 0 ? anteDegrees[0] : 2;
    newNotes.push({ startBeat: 0, durationBeats: 0.25, scaleDegree: degree, velocity: STRESS_VELOCITY[0] });
    antePos = 0.25;
  }
  
  const anteBody = buildBodyNotes(rng, antePos, anteBudget - antePos, anteDegrees, anteIndexRef);
  newNotes.push(...anteBody);

  // Keep antecedent cadence note (usually around beat 6)
  const anteCadence = originalNotes.find((n) => n.startBeat >= 5.5 && n.startBeat < 8);
  if (anteCadence) {
    newNotes.push({
      startBeat: Math.max(anteCadence.startBeat, 5.5),
      durationBeats: anteCadence.durationBeats,
      scaleDegree: anteCadence.scaleDegree,
      velocity: anteCadence.velocity,
    });
  } else {
    // Fallback cadence if none existed
    newNotes.push({ startBeat: 6.0, durationBeats: 1.5, scaleDegree: 4, velocity: STRESS_VELOCITY[2] });
  }

  // 2. Consequent body
  const consBudget = 5.5; // 8 - 2.0 (cadence hold) - 0.5 (breath)
  const consIndexRef = { value: 0 };
  
  // Optional pickup/anacrusis at start
  let consPos = 8.0;
  if (rng() < 0.7) {
    const degree = consDegrees.length > 0 ? consDegrees[0] : 2;
    newNotes.push({ startBeat: 8.0, durationBeats: 0.25, scaleDegree: degree, velocity: STRESS_VELOCITY[0] });
    consPos = 8.25;
  }

  const consBody = buildBodyNotes(rng, consPos, 8.0 + consBudget - consPos, consDegrees, consIndexRef);
  newNotes.push(...consBody);

  // Keep consequent cadence note (usually around beat 13.5)
  const consCadence = originalNotes.find((n) => n.startBeat >= 13.5 && n.startBeat < 16);
  if (consCadence) {
    newNotes.push({
      startBeat: Math.max(consCadence.startBeat, 13.5),
      durationBeats: consCadence.durationBeats,
      scaleDegree: consCadence.scaleDegree,
      velocity: consCadence.velocity,
    });
  } else {
    // Fallback cadence if none existed
    newNotes.push({ startBeat: 13.5, durationBeats: 2.0, scaleDegree: 0, velocity: STRESS_VELOCITY[2] });
  }

  // Determine octave from original first event
  const baseOctave = phrase.events.find((e) => e !== null)?.octave ?? 4;
  return rebuildPatternSource(newNotes, baseOctave);
}

/**
 * B2: shiftAnacrusis operator.
 * Adds, removes, lengthens, or shortens pickup notes in both antecedent and consequent phrases.
 */
export function shiftAnacrusis(phrase: PlayerPatternSource, action: AnacrusisVariation): PlayerPatternSource {
  const originalNotes = extractNotes(phrase);
  if (originalNotes.length === 0) return phrase;

  // Find existing pickups at beat 0 and beat 8
  const getPickup = (startBeat: number) => {
    return originalNotes.find(
      (n) => n.startBeat === startBeat && n.durationBeats <= 0.5 + 0.01 && n.velocity <= 0.25
    );
  };

  const antePickup = getPickup(0);
  const consPickup = getPickup(8);

  let anteShift = 0;
  let consShift = 0;

  const modifiedNotes: { startBeat: number; durationBeats: number; scaleDegree: number; velocity: number }[] = [];

  // 1. Process antecedent (0 to 8)
  const anteBody = originalNotes.filter((n) => n.startBeat < 8);
  
  if (action === 'remove') {
    if (antePickup) {
      // Remove it, shift all other antecedent notes left by the pickup duration (0.25)
      anteShift = -antePickup.durationBeats;
      anteBody.forEach((n) => {
        if (n.startBeat > 0) {
          modifiedNotes.push({
            startBeat: Math.max(0, n.startBeat + anteShift),
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
    } else {
      // No pickup to remove, keep antecedent as is
      modifiedNotes.push(...anteBody);
    }
  } else if (action === 'add') {
    if (!antePickup && anteBody.length > 0) {
      // Add new pickup note, shift everything else right by 0.25
      const firstNote = anteBody[0];
      modifiedNotes.push({
        startBeat: 0,
        durationBeats: 0.25,
        scaleDegree: firstNote.scaleDegree,
        velocity: STRESS_VELOCITY[0],
      });
      anteShift = 0.25;
      anteBody.forEach((n) => {
        // Shift right, but truncate if it collides with cadence note
        const shiftedStart = n.startBeat + anteShift;
        if (shiftedStart < 6.0) {
          modifiedNotes.push({
            startBeat: shiftedStart,
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
      // Keep original cadence
      const cadence = anteBody.find((n) => n.startBeat >= 5.5);
      if (cadence) {
        modifiedNotes.push({
          startBeat: cadence.startBeat,
          durationBeats: cadence.durationBeats,
          scaleDegree: cadence.scaleDegree,
          velocity: cadence.velocity,
        });
      }
    } else {
      // Already has pickup or empty, keep as is
      modifiedNotes.push(...anteBody);
    }
  } else if (action === 'lengthen') {
    if (antePickup) {
      // Change pickup to 0.5, shift others right by 0.25
      modifiedNotes.push({
        startBeat: 0,
        durationBeats: 0.5,
        scaleDegree: antePickup.scaleDegree,
        velocity: antePickup.velocity,
      });
      anteShift = 0.25;
      anteBody.forEach((n) => {
        if (n.startBeat > 0) {
          const shiftedStart = n.startBeat + anteShift;
          if (shiftedStart < 6.0) {
            modifiedNotes.push({
              startBeat: shiftedStart,
              durationBeats: n.durationBeats,
              scaleDegree: n.scaleDegree,
              velocity: n.velocity,
            });
          }
        }
      });
      // Keep cadence
      const cadence = anteBody.find((n) => n.startBeat >= 5.5);
      if (cadence) {
        modifiedNotes.push({
          startBeat: cadence.startBeat,
          durationBeats: cadence.durationBeats,
          scaleDegree: cadence.scaleDegree,
          velocity: cadence.velocity,
        });
      }
    } else {
      modifiedNotes.push(...anteBody);
    }
  } else if (action === 'shorten') {
    if (antePickup && antePickup.durationBeats > 0.15) {
      // Change duration to 0.125, shift others left
      const newDur = 0.125;
      anteShift = newDur - antePickup.durationBeats;
      modifiedNotes.push({
        startBeat: 0,
        durationBeats: newDur,
        scaleDegree: antePickup.scaleDegree,
        velocity: antePickup.velocity,
      });
      anteBody.forEach((n) => {
        if (n.startBeat > 0) {
          modifiedNotes.push({
            startBeat: Math.max(newDur, n.startBeat + anteShift),
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
    } else {
      modifiedNotes.push(...anteBody);
    }
  }

  // 2. Process consequent (8 to 16)
  const consBody = originalNotes.filter((n) => n.startBeat >= 8);

  if (action === 'remove') {
    if (consPickup) {
      consShift = -consPickup.durationBeats;
      consBody.forEach((n) => {
        if (n.startBeat > 8) {
          modifiedNotes.push({
            startBeat: Math.max(8, n.startBeat + consShift),
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
    } else {
      modifiedNotes.push(...consBody);
    }
  } else if (action === 'add') {
    if (!consPickup && consBody.length > 0) {
      const firstNote = consBody[0];
      modifiedNotes.push({
        startBeat: 8.0,
        durationBeats: 0.25,
        scaleDegree: firstNote.scaleDegree,
        velocity: STRESS_VELOCITY[0],
      });
      consShift = 0.25;
      consBody.forEach((n) => {
        const shiftedStart = n.startBeat + consShift;
        if (shiftedStart < 13.5) {
          modifiedNotes.push({
            startBeat: shiftedStart,
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
      const cadence = consBody.find((n) => n.startBeat >= 13.5);
      if (cadence) {
        modifiedNotes.push({
          startBeat: cadence.startBeat,
          durationBeats: cadence.durationBeats,
          scaleDegree: cadence.scaleDegree,
          velocity: cadence.velocity,
        });
      }
    } else {
      modifiedNotes.push(...consBody);
    }
  } else if (action === 'lengthen') {
    if (consPickup) {
      modifiedNotes.push({
        startBeat: 8.0,
        durationBeats: 0.5,
        scaleDegree: consPickup.scaleDegree,
        velocity: consPickup.velocity,
      });
      consShift = 0.25;
      consBody.forEach((n) => {
        if (n.startBeat > 8) {
          const shiftedStart = n.startBeat + consShift;
          if (shiftedStart < 13.5) {
            modifiedNotes.push({
              startBeat: shiftedStart,
              durationBeats: n.durationBeats,
              scaleDegree: n.scaleDegree,
              velocity: n.velocity,
            });
          }
        }
      });
      const cadence = consBody.find((n) => n.startBeat >= 13.5);
      if (cadence) {
        modifiedNotes.push({
          startBeat: cadence.startBeat,
          durationBeats: cadence.durationBeats,
          scaleDegree: cadence.scaleDegree,
          velocity: cadence.velocity,
        });
      }
    } else {
      modifiedNotes.push(...consBody);
    }
  } else if (action === 'shorten') {
    if (consPickup && consPickup.durationBeats > 0.15) {
      const newDur = 0.125;
      consShift = newDur - consPickup.durationBeats;
      modifiedNotes.push({
        startBeat: 8.0,
        durationBeats: newDur,
        scaleDegree: consPickup.scaleDegree,
        velocity: consPickup.velocity,
      });
      consBody.forEach((n) => {
        if (n.startBeat > 8) {
          modifiedNotes.push({
            startBeat: Math.max(8 + newDur, n.startBeat + consShift),
            durationBeats: n.durationBeats,
            scaleDegree: n.scaleDegree,
            velocity: n.velocity,
          });
        }
      });
    } else {
      modifiedNotes.push(...consBody);
    }
  }

  const baseOctave = phrase.events.find((e) => e !== null)?.octave ?? 4;
  return rebuildPatternSource(modifiedNotes, baseOctave);
}

/**
 * B2: alterCadence operator.
 * Changes cadence scale degrees, durations, or start beat timings.
 */
export function alterCadence(phrase: PlayerPatternSource, action: CadenceVariation): PlayerPatternSource {
  const originalNotes = extractNotes(phrase);
  if (originalNotes.length === 0) return phrase;

  // Antecedent cadence (last note of first half)
  const anteNotes = originalNotes.filter((n) => n.startBeat < 8);
  const anteCadence = anteNotes.length > 0 ? anteNotes[anteNotes.length - 1] : null;

  // Consequent cadence (last note of second half)
  const consNotes = originalNotes.filter((n) => n.startBeat >= 8 && n.startBeat < 16);
  const consCadence = consNotes.length > 0 ? consNotes[consNotes.length - 1] : null;

  const newNotes = originalNotes.map((n) => {
    let scaleDegree = n.scaleDegree;
    let durationBeats = n.durationBeats;
    let startBeat = n.startBeat;
    let velocity = n.velocity;

    // Check if this note is the antecedent cadence
    if (anteCadence && n.startBeat === anteCadence.startBeat) {
      if (action === 'question-to-answer') {
        scaleDegree = 0; // Resolve to tonic
      } else if (action === 'extend-cadence') {
        durationBeats = 2.0;
        startBeat = Math.max(5.0, startBeat - 0.5); // shift start earlier to fit
      } else if (action === 'shift-accent') {
        // Shift start time to make it syncopated or on downbeat
        startBeat = startBeat === 6.0 ? 5.5 : 6.0;
      }
    }

    // Check if this note is the consequent cadence
    if (consCadence && n.startBeat === consCadence.startBeat) {
      if (action === 'answer-to-question') {
        scaleDegree = 4; // Suspend to dominant question
      } else if (action === 'extend-cadence') {
        durationBeats = 2.5;
        startBeat = Math.max(13.0, startBeat - 0.5);
      } else if (action === 'shift-accent') {
        startBeat = startBeat === 13.5 ? 13.0 : 13.5;
      }
    }

    return { startBeat, durationBeats, scaleDegree, velocity };
  });

  const baseOctave = phrase.events.find((e) => e !== null)?.octave ?? 4;
  return rebuildPatternSource(newNotes, baseOctave);
}

/**
 * B2: varyContour operator.
 * Preserves the rhythm exactly while transforming pitch contour scale degrees.
 */
export function varyContour(phrase: PlayerPatternSource, action: ContourVariation): PlayerPatternSource {
  const originalNotes = extractNotes(phrase);
  if (originalNotes.length === 0) return phrase;

  // Calculate average scale degree for inversion and narrow/widen contour operations
  const sumDegrees = originalNotes.reduce((sum, n) => sum + n.scaleDegree, 0);
  const avgDegree = sumDegrees / originalNotes.length;

  const length = originalNotes.length;
  const newNotes = originalNotes.map((note, idx) => {
    let scaleDegree = note.scaleDegree;

    if (action === 'invert') {
      scaleDegree = Math.round(2 * avgDegree - scaleDegree);
    } else if (action === 'retrograde') {
      // Reverse scale degrees (pair with the opposite note in index order)
      const oppositeNote = originalNotes[length - 1 - idx];
      scaleDegree = oppositeNote.scaleDegree;
    } else if (action === 'transposeUp') {
      scaleDegree = scaleDegree + 1;
    } else if (action === 'transposeDown') {
      scaleDegree = scaleDegree - 1;
    } else if (action === 'narrow') {
      scaleDegree = Math.round(avgDegree + (scaleDegree - avgDegree) * 0.5);
    } else if (action === 'widen') {
      scaleDegree = Math.round(avgDegree + (note.scaleDegree - avgDegree) * 1.5);
    }

    return {
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      scaleDegree: clampDegree(scaleDegree),
      velocity: note.velocity,
    };
  });

  const baseOctave = phrase.events.find((e) => e !== null)?.octave ?? 4;
  return rebuildPatternSource(newNotes, baseOctave);
}
