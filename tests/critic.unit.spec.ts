import { expect, test } from "@playwright/test";
import {
  SONG_MOTIF_MOVE_ROOTS,
  createSeededSongMotifPlan,
  developSongMotifWalk,
} from "../src/song-motif-plan";
import {
  CRITIC_FEATURE_COUNT,
  WALK_FEATURE_EXTRACTORS,
  chooseCriticDevelopmentSeed,
  createCriticReport,
  deriveCandidateSeeds,
  featurizeWalkNotes,
  flattenWalk,
  reactToWalk,
  scoreFeatures,
  type CriticNote,
} from "../src/critic";
import { CRITIC_WEIGHTS } from "../src/critic-weights";

const GOAL = { energy: 0.5, brightness: 0.5, surpriseTarget: 0.5 };

// fresh seeds, far from both the training range and the training holdout
const FRESH_SEEDS = [5_000_003, 5_100_019, 5_200_007, 5_300_011, 5_400_021, 5_500_009, 5_600_017, 5_700_013];

function mulberry32(seedValue: number): () => number {
  let a = seedValue >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the same pathologies the critic was trained against, re-stated independently
function lurch(notes: CriticNote[], rng: () => number): void {
  for (const note of notes) if (rng() < 0.25) note.degree += rng() < 0.5 ? 7 : -7;
}

function scramble(notes: CriticNote[], rng: () => number): void {
  const intervals = notes.slice(1).map((n, i) => n.degree - notes[i]!.degree);
  for (let i = intervals.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [intervals[i], intervals[j]] = [intervals[j]!, intervals[i]!];
  }
  for (let i = 1; i < notes.length; i += 1) notes[i]!.degree = notes[i - 1]!.degree + (intervals[i - 1] ?? 0);
}

test.describe("Critic", () => {
  test("shipped weights are trained and deterministic", () => {
    expect(CRITIC_WEIGHTS.version).toBe("grow.critic/1");
    expect(CRITIC_WEIGHTS.w1).toHaveLength(10);
    expect(CRITIC_WEIGHTS.featureMeans).toHaveLength(CRITIC_FEATURE_COUNT);
    const plan = createSeededSongMotifPlan(FRESH_SEEDS[0]!, GOAL);
    const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
    const notes = flattenWalk(developSongMotifWalk(plan, 4242));
    const a = scoreFeatures(featurizeWalkNotes(notes, roots));
    const b = scoreFeatures(featurizeWalkNotes(notes, roots));
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });

  test("the critic prefers real walks to corrupted ones on fresh material", () => {
    let wins = 0;
    let pairs = 0;
    for (const seed of FRESH_SEEDS) {
      const plan = createSeededSongMotifPlan(seed, GOAL);
      const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
      for (let variant = 0; variant < 3; variant += 1) {
        const clean = flattenWalk(developSongMotifWalk(plan, seed + variant * 101));
        const cleanScore = scoreFeatures(featurizeWalkNotes(clean, roots));
        const rng = mulberry32(seed + variant);
        const corrupted = clean.map((note) => ({ ...note }));
        if (variant % 2 === 0) lurch(corrupted, rng);
        else scramble(corrupted, rng);
        const corruptScore = scoreFeatures(featurizeWalkNotes(corrupted, roots));
        pairs += 1;
        if (cleanScore > corruptScore) wins += 1;
      }
    }
    expect(wins / pairs).toBeGreaterThanOrEqual(0.85);
  });

  test("reactions are worded from the feature vocabulary and grounded in attributions", () => {
    const plan = createSeededSongMotifPlan(FRESH_SEEDS[1]!, GOAL);
    const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
    const reaction = reactToWalk(developSongMotifWalk(plan, 777), roots);
    expect(reaction.attributions).toHaveLength(CRITIC_FEATURE_COUNT);
    const vocabulary = new Set(WALK_FEATURE_EXTRACTORS.flatMap((f) => [f.praise, f.complaint]));
    for (const line of [...reaction.strengths, ...reaction.complaints]) {
      expect(vocabulary.has(line)).toBe(true);
    }
    // a lurched walk should draw complaints, and score lower
    const notes = flattenWalk(developSongMotifWalk(plan, 777));
    const wrecked = notes.map((n) => ({ ...n }));
    lurch(wrecked, mulberry32(9));
    lurch(wrecked, mulberry32(10));
    const cleanScore = scoreFeatures(featurizeWalkNotes(notes, roots));
    const wreckedScore = scoreFeatures(featurizeWalkNotes(wrecked, roots));
    expect(wreckedScore).toBeLessThan(cleanScore);
  });

  test("the development seam is deterministic and chooses from the audition table", () => {
    const plan = createSeededSongMotifPlan(FRESH_SEEDS[2]!, GOAL);
    const chosenA = chooseCriticDevelopmentSeed(plan, 424242);
    const chosenB = chooseCriticDevelopmentSeed(plan, 424242);
    expect(chosenA).toBe(chosenB);
    expect(deriveCandidateSeeds(424242)).toContain(chosenA);
    const report = createCriticReport(plan, 424242);
    expect(report.chosenSeed).toBe(chosenA);
    expect(report.candidates).toHaveLength(5);
    expect(report.candidates[0]!.logit).toBeGreaterThanOrEqual(report.candidates[4]!.logit);
    // the critic has graded opinions among good candidates, not one saturated yes
    expect(new Set(report.candidates.map((c) => c.logit)).size).toBeGreaterThanOrEqual(2);
    expect(report.reaction.score).toBeGreaterThan(0);
  });
});
