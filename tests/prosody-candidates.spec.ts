import { test, expect } from "@playwright/test";
import { produceProsodyCandidates } from "../src/prosody-candidates";
import { validateCandidate } from "../src/candidate-store";
import {
  isAnchorPhraseCandidateGenome,
  renderPhraseCandidateGenome,
} from "../src/phrase-candidate-genome";
import { scoreProsody } from "../src/prosody-scoring";

test.describe("produceProsodyCandidates (Track B4)", () => {
  test("returns exactly N candidates, all kind 'phrase', all valid", () => {
    const candidates = produceProsodyCandidates({ seed: 42, count: 5 });
    
    expect(candidates).toHaveLength(5);
    for (const c of candidates) {
      expect(c.kind).toBe("phrase");
      expect(c.status).toBe("alive");
      expect(isAnchorPhraseCandidateGenome(c.genome)).toBe(true);
      
      const validation = validateCandidate(c);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    }
  });

  test("determinism: same seed yields identical ids, genomes, and scores", () => {
    const candidates1 = produceProsodyCandidates({ seed: 101, count: 4 });
    const candidates2 = produceProsodyCandidates({ seed: 101, count: 4 });
    
    expect(candidates1).toHaveLength(4);
    expect(candidates2).toHaveLength(4);
    
    expect(candidates1).toEqual(candidates2);
  });

  test("candidates are distinct (operators actually spread them)", () => {
    const candidates = produceProsodyCandidates({ seed: 777, count: 6 });
    
    // Check IDs
    const ids = new Set(candidates.map((c) => c.id));
    expect(ids.size).toBe(candidates.length);
    
    // Check Genomes
    const genomes = new Set(candidates.map((c) => JSON.stringify(c.genome)));
    expect(genomes.size).toBe(candidates.length);
  });

  test("variants carry parentId and generation >= 1, base has no parentId and generation 0", () => {
    const candidates = produceProsodyCandidates({ seed: 99, count: 3 });
    
    // First candidate is the base
    const base = candidates[0];
    expect(base.generation).toBe(0);
    expect(base.parentId).toBeUndefined();
    
    // Rest are variants
    for (let i = 1; i < candidates.length; i++) {
      const variant = candidates[i];
      expect(variant.generation).toBeGreaterThanOrEqual(1);
      expect(variant.parentId).toBe(base.id);
    }
  });

  test("scores contain the 4 prosody subscores and fitness matches overall score", () => {
    const candidates = produceProsodyCandidates({ seed: 55, count: 2 });
    
    for (const c of candidates) {
      const score = scoreProsody(renderPhraseCandidateGenome(c.genome), [4, 4]);
      
      expect(c.fitness).toBe(score.overall);
      expect(c.scores).toEqual(expect.objectContaining({
        anchorContrast: score.subscores.anchorContrast,
        richness: score.subscores.richness,
        anacrusis: score.subscores.anacrusis,
        questionAnswer: score.subscores.questionAnswer,
      }));
      
      // Also ensure they are strictly equal (we just cloned subscores)
      expect(c.scores).toEqual(score.subscores);
    }
  });
});
