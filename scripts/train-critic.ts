// Trains the critic to tell real motif walks from corrupted ones, then writes
// the weights into src/critic-weights.ts. Fully deterministic: seeded corpus,
// seeded init, seeded shuffles — rerunning reproduces the same file.
//
//   npx tsx scripts/train-critic.ts
//
// The negatives are the pathologies this project has fought by hand:
// register lurches, scrambled contours, flattened or jittered rhythm, and
// long notes detuned off their chord. The critic learns the *combination*
// of perceptions that separates music-shaped from pathology-shaped.

import { writeFileSync } from "node:fs";
import {
  SONG_MOTIF_MOVE_ROOTS,
  createSeededSongMotifPlan,
  developSongMotifWalk,
} from "../src/song-motif-plan";
import {
  CRITIC_FEATURE_COUNT,
  createCriticWeights,
  featurizeWalkNotes,
  flattenWalk,
  scoreFeatures,
  trainCriticStep,
  type CriticNote,
} from "../src/critic";

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

export type Corruption = (notes: CriticNote[], rng: () => number) => void;

export const CORRUPTIONS: Record<string, Corruption> = {
  // register lurch: random notes thrown an octave away
  lurch: (notes, rng) => {
    for (const note of notes) {
      if (rng() < 0.22) note.degree += rng() < 0.5 ? 7 : -7;
    }
  },
  // contour scramble: same rhythm, intervals reshuffled
  scramble: (notes, rng) => {
    const intervals = notes.slice(1).map((n, i) => n.degree - notes[i]!.degree);
    for (let i = intervals.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [intervals[i], intervals[j]] = [intervals[j]!, intervals[i]!];
    }
    for (let i = 1; i < notes.length; i += 1) {
      notes[i]!.degree = notes[i - 1]!.degree + (intervals[i - 1] ?? 0);
    }
  },
  // rhythm flattened to one value: no vocabulary, no breath shape
  flatten: (notes) => {
    for (const note of notes) note.durationBeats = 0.5;
  },
  // rhythm jittered: durations lose their relationship to the cell
  jitter: (notes, rng) => {
    const values = [0.25, 0.5, 0.75, 1, 1.5, 2];
    for (const note of notes) {
      if (rng() < 0.6) note.durationBeats = values[Math.floor(rng() * values.length)]!;
    }
  },
  // long notes pushed off their chord: sustained wrongness
  detune: (notes, rng) => {
    for (const note of notes) {
      if (note.durationBeats >= 0.75 && rng() < 0.7) note.degree += rng() < 0.5 ? 1 : -1;
    }
  },
};

export function corruptNotes(notes: CriticNote[], rng: () => number): void {
  const kinds = Object.values(CORRUPTIONS);
  // half the negatives are mild (one corruption): the boundary must sit
  // close to real material, not out at obvious-wreckage distance
  const count = rng() < 0.55 ? 1 : 2;
  for (let i = 0; i < count; i += 1) {
    kinds[Math.floor(rng() * kinds.length)]!(notes, rng);
  }
}

interface Example {
  features: number[];
  label: 0 | 1;
}

function buildCorpus(planSeeds: readonly number[], rng: () => number): Example[] {
  const examples: Example[] = [];
  for (const planSeed of planSeeds) {
    const plan = createSeededSongMotifPlan(planSeed, {
      energy: rng(),
      brightness: rng(),
      surpriseTarget: rng(),
    });
    const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
    for (let variant = 0; variant < 3; variant += 1) {
      const walkSeed = Math.floor(rng() * 0x7fffffff);
      const clean = flattenWalk(developSongMotifWalk(plan, walkSeed));
      examples.push({ features: featurizeWalkNotes(clean, roots), label: 1 });
      const corrupted = clean.map((note) => ({ ...note }));
      corruptNotes(corrupted, rng);
      examples.push({ features: featurizeWalkNotes(corrupted, roots), label: 0 });
    }
  }
  return examples;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function accuracy(examples: readonly Example[], weights: Parameters<typeof scoreFeatures>[1]): number {
  let correct = 0;
  for (const example of examples) {
    const score = scoreFeatures(example.features, weights);
    if ((score >= 0.5 ? 1 : 0) === example.label) correct += 1;
  }
  return correct / Math.max(1, examples.length);
}

function main(): void {
  const rng = mulberry32(0x5eed);
  const trainSeeds = Array.from({ length: 220 }, (_, i) => 1000 + i * 37);
  const holdoutSeeds = Array.from({ length: 40 }, (_, i) => 900001 + i * 53);
  const train = shuffle(buildCorpus(trainSeeds, rng), rng);
  const holdout = buildCorpus(holdoutSeeds, mulberry32(0x401d));

  const featureMeans = Array.from({ length: CRITIC_FEATURE_COUNT }, (_, i) =>
    train.reduce((sum, e) => sum + (e.features[i] ?? 0), 0) / Math.max(1, train.length));

  const weights = createCriticWeights(0xc41710);
  weights.featureMeans = featureMeans;

  const epochs = 60;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const order = shuffle([...train], rng);
    for (const example of order) {
      // label smoothing keeps logits bounded so scores stay graded instead of
      // saturating — the critic must rank among good candidates, not just
      // separate good from broken
      trainCriticStep(weights, example.features, example.label === 1 ? 0.92 : 0.08, 0.06);
    }
    if (epoch % 10 === 9) {
      console.log(`epoch ${epoch + 1}: train ${accuracy(train, weights).toFixed(3)} holdout ${accuracy(holdout, weights).toFixed(3)}`);
    }
  }

  const trainAcc = accuracy(train, weights);
  const holdoutAcc = accuracy(holdout, weights);
  console.log(`final: train ${trainAcc.toFixed(3)} holdout ${holdoutAcc.toFixed(3)}`);
  if (holdoutAcc < 0.85) {
    throw new Error(`holdout accuracy ${holdoutAcc.toFixed(3)} below 0.85 — not shipping these weights`);
  }

  weights.version = "grow.critic/1";
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const body = [
    'import type { CriticWeightsData } from "./critic";',
    "",
    "// Generated by scripts/train-critic.ts — do not edit by hand.",
    `// Trained to separate real motif walks from corrupted ones (register lurch,`,
    `// contour scramble, rhythm flatten/jitter, chord detune).`,
    `// train accuracy ${trainAcc.toFixed(3)}, holdout ${holdoutAcc.toFixed(3)} over ${holdout.length} fresh examples.`,
    `export const CRITIC_WEIGHTS: CriticWeightsData = ${JSON.stringify(
      {
        version: weights.version,
        w1: weights.w1.map((row) => row.map(round)),
        b1: weights.b1.map(round),
        w2: weights.w2.map(round),
        b2: round(weights.b2),
        featureMeans: weights.featureMeans.map(round),
      },
      null,
      2,
    )};`,
    "",
  ].join("\n");
  writeFileSync(new URL("../src/critic-weights.ts", import.meta.url), body);
  console.log("wrote src/critic-weights.ts");
}

main();
