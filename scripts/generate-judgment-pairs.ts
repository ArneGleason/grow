// Generates near-decision development pairs for judgment labeling: for many
// diverse plans, take the grammar critic's top audition candidates whose
// logits nearly tie — the decisions where the shipped critic is effectively
// guessing — and render both walks as compact notation for a strong judge
// (human or LLM) to label. Deterministic.
//
//   npx tsx scripts/generate-judgment-pairs.ts <outfile>

import { writeFileSync } from "node:fs";
import {
  SONG_MOTIF_MOVE_ROOTS,
  createSeededSongMotifPlan,
  developSongMotifWalk,
} from "../src/song-motif-plan";
import {
  deriveCandidateSeeds,
  featurizeWalkNotes,
  flattenWalk,
  logitOfFeatures,
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

// Compact, judgeable notation: per bar `b<i>[root]: deg/dur deg/dur ...`
// with ~ marking a gap of half a beat or more before the note.
function notate(planSeed: number, walkSeed: number): string {
  const plan = createSeededSongMotifPlan(planSeed, GOAL(planSeed));
  const walk = developSongMotifWalk(plan, walkSeed);
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  return walk.bars
    .map((bar, barIndex) => {
      let cursor = barIndex * 4;
      const tokens = bar.map((note) => {
        const gap = note.startBeat - cursor >= 0.5 ? "~" : "";
        cursor = note.startBeat + note.durationBeats;
        return `${gap}${note.degree}/${note.durationBeats}`;
      });
      return `b${barIndex}[${roots[barIndex]}]: ${tokens.join(" ")}`;
    })
    .join("  ");
}

import { judgmentGoalForSeed as GOAL } from "./judgment-shared";

function main(): void {
  const outfile = process.argv[2] ?? "judgment-pairs.json";
  const rng = mulberry32(0x9a1e5);
  const pairs: unknown[] = [];
  let planSeed = 20001;
  while (pairs.length < 240 && planSeed < 200000) {
    planSeed += 173;
    const plan = createSeededSongMotifPlan(planSeed, GOAL(planSeed));
    const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
    const candidates = deriveCandidateSeeds(planSeed).map((seed) => ({
      seed,
      logit: logitOfFeatures(featurizeWalkNotes(flattenWalk(developSongMotifWalk(plan, seed)), roots)),
    })).sort((a, b) => b.logit - a.logit);
    const [first, second] = [candidates[0]!, candidates[1]!];
    // near-decision only: where the grammar critic is effectively guessing
    if (Math.abs(first.logit - second.logit) > 0.5) continue;
    const flip = rng() < 0.5;
    const [a, b] = flip ? [second, first] : [first, second];
    pairs.push({
      id: `p${pairs.length}`,
      planSeed,
      move: plan.move,
      peakBar: plan.peakBar,
      cell: `${plan.cellSteps.join(",")} @ ${plan.cellRhythm.join(",")}`,
      A: { seed: a.seed, notation: notate(planSeed, a.seed) },
      B: { seed: b.seed, notation: notate(planSeed, b.seed) },
    });
  }
  writeFileSync(outfile, JSON.stringify(pairs, null, 1));
  console.log(`wrote ${pairs.length} pairs to ${outfile}`);
}

main();
