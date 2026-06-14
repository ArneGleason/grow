import type { Candidate } from "./candidate-store";
import { validateCandidate } from "./candidate-store";
import { generateProsodicMelody } from "./melody-prosody";
import { 
  reFoot, 
  shiftAnacrusis, 
  alterCadence, 
  varyContour,
  type ContourVariation,
  type CadenceVariation,
  type AnacrusisVariation
} from "./prosody-development";
import { scoreProsody } from "./prosody-scoring";
import type { PlayerPatternSource } from "./song-material";

const CONTOUR_ACTIONS: ContourVariation[] = ['invert', 'retrograde', 'transposeUp', 'transposeDown', 'narrow', 'widen'];
const CADENCE_ACTIONS: CadenceVariation[] = ['question-to-answer', 'answer-to-question', 'extend-cadence', 'shift-accent'];
const ANACRUSIS_ACTIONS: AnacrusisVariation[] = ['add', 'remove', 'lengthen', 'shorten'];

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

export interface ProsodyCandidateInput {
  seed: number;
  count?: number;
}

export function produceProsodyCandidates(input: ProsodyCandidateInput): Candidate[] {
  const count = input.count ?? 5;
  const rng = mulberry32(input.seed >>> 0);
  
  if (count <= 0) return [];

  const candidates: Candidate[] = [];
  
  // 1. Generate base phrase
  const basePhrase = generateProsodicMelody({ seed: input.seed });
  const baseScore = scoreProsody(basePhrase, [4, 4]);
  
  const baseId = `phrase_${input.seed}_base`;
  
  const baseCandidate: Candidate = {
    id: baseId,
    kind: "phrase",
    genome: basePhrase as any,
    scores: { ...baseScore.subscores },
    fitness: baseScore.overall,
    generation: 0,
    seed: input.seed,
    status: "alive"
  };
  
  const baseVal = validateCandidate(baseCandidate);
  if (baseVal.valid) {
    candidates.push(baseVal.candidate);
  }

  // 2. Spawn distinct variants
  // We apply operators, varying operator/arg by a seeded sequence.
  // The operators are applied to the base phrase.
  let attempts = 0;
  const maxAttempts = (count - 1) * 10;
  
  // To ensure they are distinct, we track genomes as JSON strings.
  const seenGenomes = new Set<string>();
  seenGenomes.add(JSON.stringify(basePhrase));
  
  while (candidates.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Pick operator
    const operatorType = Math.floor(rng() * 4);
    let variantPhrase: PlayerPatternSource;
    
    if (operatorType === 0) {
      // reFoot
      const footSeed = Math.floor(rng() * 100000);
      variantPhrase = reFoot(basePhrase, footSeed);
    } else if (operatorType === 1) {
      // varyContour
      const action = CONTOUR_ACTIONS[Math.floor(rng() * CONTOUR_ACTIONS.length)];
      variantPhrase = varyContour(basePhrase, action);
    } else if (operatorType === 2) {
      // alterCadence
      const action = CADENCE_ACTIONS[Math.floor(rng() * CADENCE_ACTIONS.length)];
      variantPhrase = alterCadence(basePhrase, action);
    } else {
      // shiftAnacrusis
      const action = ANACRUSIS_ACTIONS[Math.floor(rng() * ANACRUSIS_ACTIONS.length)];
      variantPhrase = shiftAnacrusis(basePhrase, action);
    }
    
    const genomeStr = JSON.stringify(variantPhrase);
    if (seenGenomes.has(genomeStr)) {
      continue;
    }
    seenGenomes.add(genomeStr);
    
    const varScore = scoreProsody(variantPhrase, [4, 4]);
    const varId = `phrase_${input.seed}_var_${attempts}`;
    
    const varCandidate: Candidate = {
      id: varId,
      kind: "phrase",
      genome: variantPhrase as any,
      scores: { ...varScore.subscores },
      fitness: varScore.overall,
      generation: 1, // >=1 for variants
      parentId: baseId,
      seed: input.seed,
      status: "alive"
    };
    
    const valResult = validateCandidate(varCandidate);
    if (valResult.valid) {
      candidates.push(valResult.candidate);
    }
  }

  return candidates;
}
