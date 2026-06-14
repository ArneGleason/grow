import type { PlayerPatternSource } from "./song-material";

export interface ExtractedNote {
  startBeat: number;
  durationBeats: number;
  scaleDegree: number;
  velocity: number;
  index: number;
}

export interface ProsodySubscores {
  richness: number;         // inverted-U richness of long/short note durations
  anacrusis: number;        // presence of pickup notes in antecedent & consequent
  questionAnswer: number;   // antecedent suspended "question" to consequent resolved "answer"
  anchorContrast: number;   // metrical alignment of notes on strong vs weak beats
}

export interface ProsodyScore {
  overall: number;          // composite score (0..1)
  subscores: ProsodySubscores;
}

/**
 * Extracts non-null notes from a PlayerPatternSource, calculating their absolute start beats.
 */
export function extractNotes(phrase: PlayerPatternSource): ExtractedNote[] {
  const notes: ExtractedNote[] = [];
  const subdivision = phrase.subdivisionBeats;
  for (let i = 0; i < phrase.events.length; i++) {
    const event = phrase.events[i];
    if (event) {
      notes.push({
        startBeat: i * subdivision,
        durationBeats: event.durationBeats,
        scaleDegree: event.scaleDegree,
        velocity: event.velocity,
        index: i,
      });
    }
  }
  return notes;
}

/**
 * Evaluates the rhythm variety and long/short duration contrast of the phrase.
 * Penalizes both completely even/monotonous rhythms and extremely random/chaotic ones.
 */
export function scoreRichness(notes: readonly ExtractedNote[]): number {
  if (notes.length < 2) return 0;

  // Gather durations and calculate frequencies for entropy
  // Quantize durations to the nearest 0.25 (musical grid) to avoid inflating entropy with micro-timing
  const durations = notes.map((n) => Math.round(n.durationBeats * 4) / 4);
  const counts = new Map<number, number>();
  for (const dur of durations) {
    counts.set(dur, (counts.get(dur) ?? 0) + 1);
  }

  // Calculate Shannon entropy of durations
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / notes.length;
    entropy -= p * Math.log2(p);
  }

  // Inverted-U for entropy. Target entropy is around 1.3 bits.
  // Entropy of 0 (all same duration) gets 0. Entropy of > 2.0 (too random) gets penalized.
  const targetEntropy = 1.3;
  const entropyScore = Math.max(0, 1 - Math.abs(entropy - targetEntropy) / targetEntropy);

  // Measure contrast between adjacent note durations (short-long / long-short)
  let contrastingPairs = 0;
  const totalPairs = notes.length - 1;
  for (let i = 1; i < notes.length; i++) {
    const ratio = notes[i].durationBeats / notes[i - 1].durationBeats;
    // A ratio of >= 1.5 or <= 1/1.5 represents a clear contrast (long/short transition)
    if (ratio >= 1.5 || ratio <= 1 / 1.5) {
      contrastingPairs++;
    }
  }

  const contrastRatio = contrastingPairs / totalPairs;
  // Inverted-U for contrast ratio. Target is around 0.5 (half contrasting, half similar).
  const targetContrast = 0.5;
  const contrastScore = Math.max(0, 1 - Math.abs(contrastRatio - targetContrast) / targetContrast);

  // Weighted combination
  return Math.round((entropyScore * 0.5 + contrastScore * 0.5) * 1000) / 1000;
}

/**
 * Checks if a phrase half contains an anacrusis (pickup note).
 * An anacrusis is a short note (<= 0.25 beats), low velocity (< 0.25) starting near the startBeat
 * followed immediately by a stronger note.
 */
function hasAnacrusisInWindow(notes: readonly ExtractedNote[], startBeat: number): boolean {
  const notesInHalf = notes.filter((n) => n.startBeat >= startBeat && n.startBeat < startBeat + 8);
  if (notesInHalf.length < 2) return false;

  const firstNote = notesInHalf[0];
  // Must start close to the beginning of the half
  if (firstNote.startBeat > startBeat + 0.1) return false;

  // Must be short and soft
  if (firstNote.durationBeats > 0.25 + 0.01 || firstNote.velocity > 0.25) return false;

  // The next note must be stronger (accented landing)
  const secondNote = notesInHalf[1];
  if (secondNote.startBeat <= startBeat + 0.5 && secondNote.velocity >= 0.25) {
    return true;
  }

  return false;
}

/**
 * Scores the presence of pickup notes (anacrusis) in both halves of the phrase.
 */
export function scoreAnacrusis(notes: readonly ExtractedNote[]): number {
  const anteHasAnacrusis = hasAnacrusisInWindow(notes, 0);
  const consHasAnacrusis = hasAnacrusisInWindow(notes, 8);

  let score = 0;
  if (anteHasAnacrusis) score += 0.5;
  if (consHasAnacrusis) score += 0.5;
  return score;
}

/**
 * Scores the antecedent-consequent shape:
 * - Antecedent should end with a suspended cadence (non-tonic scale degree, e.g. 4, 2, 5).
 * - Consequent should end with a resolved cadence (tonic scale degree, e.g. 0 or 7).
 */
export function scoreQuestionAnswer(notes: readonly ExtractedNote[]): number {
  const anteNotes = notes.filter((n) => n.startBeat < 8);
  const consNotes = notes.filter((n) => n.startBeat >= 8 && n.startBeat < 16);

  if (anteNotes.length === 0 || consNotes.length === 0) return 0;

  const lastAnte = anteNotes[anteNotes.length - 1];
  const lastCons = consNotes[consNotes.length - 1];

  const scaleLength = 7;
  const antePc = ((lastAnte.scaleDegree % scaleLength) + scaleLength) % scaleLength;
  const consPc = ((lastCons.scaleDegree % scaleLength) + scaleLength) % scaleLength;

  // Antecedent question cadence check (should NOT end on tonic pitch-class 0)
  let anteScore = 0;
  if (antePc === 4) {
    anteScore = 1.0; // perfect dominant suspension
  } else if (antePc === 2 || antePc === 5) {
    anteScore = 0.8; // good secondary question degrees
  } else if (antePc === 0) {
    anteScore = 0.1; // resolved too early!
  } else {
    anteScore = 0.5; // neutral
  }

  // Consequent answer cadence check (should end on tonic pitch-class 0)
  let consScore = 0;
  if (consPc === 0) {
    // lands on tonic
    consScore = 1.0;
  } else {
    consScore = 0.1;
  }

  // Verify that the consequent answer lands on a strong beat or is held long
  let resolveBonus = 1.0;
  if (lastCons.durationBeats < 1.0) {
    resolveBonus *= 0.5; // cadences should be held
  }
  const beatInBar = lastCons.startBeat % 4;
  if (beatInBar !== 0 && beatInBar !== 1.5 && beatInBar !== 2.0 && beatInBar !== 1.0) {
    // If it starts on a highly syncopated subdivision, penalize resolution slightly
    resolveBonus *= 0.8;
  }

  return Math.round((anteScore * 0.5 + consScore * 0.5 * resolveBonus) * 1000) / 1000;
}

/**
 * Helper to calculate metrical weight of a beat position in a 4/4 meter.
 * 0 (downbeat) -> 1.0
 * 2 (backbeat) -> 0.8
 * 1, 3 (weak beats) -> 0.5
 * 0.5, 1.5, 2.5, 3.5 (eighths) -> 0.25
 * subdivisions (sixteenths) -> 0.1
 */
function getMetricalWeight(beat: number): number {
  const pos = Math.round((beat % 4) * 100) / 100;
  if (pos === 0) return 1.0;
  if (pos === 2) return 0.8;
  if (pos === 1 || pos === 3) return 0.5;
  if (pos % 1 === 0.5) return 0.25;
  return 0.1;
}

/**
 * Scores the metrical alignment of note onsets.
 * Locks to strong beats (anchoring) vs pulls against them (contrast).
 * Returns a score representing the balance: we want a mix of anchors and syncopated contrasts.
 */
export function scoreAnchorContrast(notes: readonly ExtractedNote[]): number {
  if (notes.length === 0) return 0;

  const anteNotes = notes.filter((n) => n.startBeat < 8);
  const consNotes = notes.filter((n) => n.startBeat >= 8 && n.startBeat < 16);

  const anteCadence = anteNotes.length > 0 ? anteNotes[anteNotes.length - 1] : null;
  const consCadence = consNotes.length > 0 ? consNotes[consNotes.length - 1] : null;

  let focalWeightSum = 0;
  let focalAlignmentSum = 0;

  let connectiveWeightSum = 0;
  let connectiveAlignmentSum = 0;

  for (const note of notes) {
    const isCadence = note === anteCadence || note === consCadence;
    const importance = note.durationBeats * note.velocity;
    const metricalW = getMetricalWeight(note.startBeat);

    // Consider note focal if it's a cadence or structurally important (long/loud)
    if (isCadence || importance > 0.5) {
      const weight = isCadence ? 2.0 : importance;
      focalWeightSum += weight;
      focalAlignmentSum += metricalW * weight;
    } else {
      // Connective notes
      connectiveWeightSum += 1.0;
      connectiveAlignmentSum += metricalW;
    }
  }

  const focalScore = focalWeightSum > 0 ? focalAlignmentSum / focalWeightSum : 0;

  let connectiveScore = 0;
  if (connectiveWeightSum > 0) {
    const connectiveAlignment = connectiveAlignmentSum / connectiveWeightSum;
    // Target is around 0.4 (a healthy mix of weak beats and subdivisions for drive/contrast)
    const target = 0.4;
    connectiveScore = Math.max(0, 1 - Math.abs(connectiveAlignment - target) / 0.5);
  }

  // Weight anchoring of focal notes slightly higher than the presence of contrast
  const score = (focalScore * 0.6) + (connectiveScore * 0.4);

  return Math.round(score * 1000) / 1000;
}

/**
 * Pure function scoring a prosodic melody phrase.
 */
export function scoreProsody(phrase: PlayerPatternSource, meter: [number, number]): ProsodyScore {
  if (meter[0] !== 4 || meter[1] !== 4) {
    console.warn(`scoreProsody: phrase geometry hardcoded to 16 beats, 4/4 meter. Different meters (${meter[0]}/${meter[1]}) may mis-score silently.`);
  }

  const notes = extractNotes(phrase);

  const subscores: ProsodySubscores = {
    richness: scoreRichness(notes),
    anacrusis: scoreAnacrusis(notes),
    questionAnswer: scoreQuestionAnswer(notes),
    anchorContrast: scoreAnchorContrast(notes),
  };

  // Overall score is a weighted average of subscores.
  // Cadence shape (question/answer) and richness are the most important elements of prosody.
  const overall = Math.round(
    (subscores.richness * 0.3 +
      subscores.anacrusis * 0.15 +
      subscores.questionAnswer * 0.35 +
      subscores.anchorContrast * 0.2) *
      1000
  ) / 1000;

  return {
    overall,
    subscores,
  };
}
