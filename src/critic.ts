import type { MotifWalk, SongMotifPlan } from "./song-motif-plan";
import { SONG_MOTIF_MOVE_ROOTS, developSongMotifWalk } from "./song-motif-plan";
import { CRITIC_WEIGHTS } from "./critic-weights";

// The critic: a tiny learned model that experiences a melody and reacts.
//
// It is a critic, NOT a composer — it never writes a note. The rule system
// generates candidate developments (different walk seeds over the same motif
// plan); the critic listens to each and ranks them. Its reactions are also
// expressible in words: every feature it perceives has a voice, and occlusion
// tells us which perceptions actually moved the score.
//
// Three layers, smallest possible versions of each:
//   experience  — WALK_FEATURE_EXTRACTORS: pure functions over a walk, each
//                 asking one musical question (does the line answer its
//                 leaps? does the rhythm breathe? does it arrive?)
//   reaction    — a hand-rolled MLP (features -> tanh hidden -> sigmoid),
//                 ~200 parameters, weights shipped as data. Trained (see
//                 scripts/train-critic.ts) to tell real walks from corrupted
//                 ones — the exact pathologies this project has fought:
//                 register lurches, scrambled contours, flattened rhythm,
//                 detuned chord tones.
//   usefulness  — rankWalkCandidates / chooseCriticDevelopmentSeed pick which
//                 development of a song is performed; reactToWalk narrates.
//
// Everything is deterministic: fixed weights + same walk => same score.

export interface CriticWeightsData {
  version: string;
  // input -> hidden
  w1: readonly (readonly number[])[];
  b1: readonly number[];
  // hidden -> output
  w2: readonly number[];
  b2: number;
  // corpus feature means, the occlusion baseline ("what a typical walk does")
  featureMeans: readonly number[];
}

export interface CriticFeature {
  key: string;
  // the musical question, answered 0..1
  describe: string;
  praise: string;
  complaint: string;
  extract: (notes: readonly CriticNote[], roots: readonly number[]) => number;
}

export interface CriticNote {
  startBeat: number;
  durationBeats: number;
  degree: number;
  strong: boolean;
}

export interface CriticReaction {
  score: number;
  strengths: readonly string[];
  complaints: readonly string[];
  attributions: readonly { feature: string; delta: number }[];
}

export interface CriticCandidate {
  seed: number;
  score: number;
  logit: number;
}

const TOTAL_BEATS = 32;

function intervalsOf(notes: readonly CriticNote[]): number[] {
  return notes.slice(1).map((note, i) => note.degree - notes[i]!.degree);
}

function isChordToneOf(degree: number, root: number): boolean {
  const rel = (((degree - root) % 7) + 7) % 7;
  return rel === 0 || rel === 2 || rel === 4;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Each extractor answers one musical question with a number in [0, 1].
// The net learns how the answers combine — including non-monotonic taste
// like "some repetition is a motif, total repetition is a drone".
export const WALK_FEATURE_EXTRACTORS: readonly CriticFeature[] = [
  {
    key: "stepwise",
    describe: "how much of the line moves by step",
    praise: "the line flows by step",
    complaint: "the motion is jumpy",
    extract: (notes) => {
      const iv = intervalsOf(notes);
      return iv.length ? iv.filter((i) => Math.abs(i) <= 2).length / iv.length : 0;
    },
  },
  {
    key: "leap-density",
    describe: "how often the line leaps a fourth or more",
    praise: "leaps are spent sparingly",
    complaint: "too many wide leaps",
    extract: (notes) => {
      const iv = intervalsOf(notes);
      return iv.length ? clamp01((iv.filter((i) => Math.abs(i) >= 4).length / iv.length) * 4) : 0;
    },
  },
  {
    key: "gap-fill",
    describe: "whether a leap is answered by a step back",
    praise: "leaps are answered",
    complaint: "leaps are left hanging",
    extract: (notes) => {
      const iv = intervalsOf(notes);
      let leaps = 0;
      let filled = 0;
      iv.forEach((interval, i) => {
        if (Math.abs(interval) >= 3 && i + 1 < iv.length) {
          leaps += 1;
          const next = iv[i + 1]!;
          if (next !== 0 && Math.sign(next) === -Math.sign(interval) && Math.abs(next) <= 2) filled += 1;
        }
      });
      return leaps ? filled / leaps : 1;
    },
  },
  {
    key: "register-span",
    describe: "how wide a range the whole line covers",
    praise: "it stays in a singable range",
    complaint: "the register wanders",
    extract: (notes) => {
      const degrees = notes.map((n) => n.degree);
      return clamp01((Math.max(...degrees) - Math.min(...degrees)) / 14);
    },
  },
  {
    key: "tessitura",
    describe: "how tightly the line hugs its home register",
    praise: "the voice sits comfortably",
    complaint: "notes stray far from home",
    extract: (notes) => {
      const degrees = [...notes.map((n) => n.degree)].sort((a, b) => a - b);
      const median = degrees[Math.floor(degrees.length / 2)] ?? 0;
      const spread = notes.reduce((sum, n) => sum + Math.abs(n.degree - median), 0) / Math.max(1, notes.length);
      return clamp01(1 - spread / 5);
    },
  },
  {
    key: "contour-variety",
    describe: "how varied the up/down shapes are",
    praise: "the contour keeps surprising",
    complaint: "the shape is monotonous",
    extract: (notes) => {
      const iv = intervalsOf(notes).map((i) => Math.sign(i));
      const trigrams = new Map<string, number>();
      for (let i = 0; i + 2 < iv.length; i += 1) {
        const key = `${iv[i]},${iv[i + 1]},${iv[i + 2]}`;
        trigrams.set(key, (trigrams.get(key) ?? 0) + 1);
      }
      const total = [...trigrams.values()].reduce((a, b) => a + b, 0);
      if (!total) return 0;
      let entropy = 0;
      for (const count of trigrams.values()) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
      return clamp01(entropy / Math.log2(27));
    },
  },
  {
    key: "rhythm-variety",
    describe: "how many different note lengths are spoken",
    praise: "the rhythm has vocabulary",
    complaint: "every note is the same length",
    extract: (notes) => clamp01((new Set(notes.map((n) => n.durationBeats)).size - 1) / 4),
  },
  {
    key: "rhythm-flow",
    describe: "how often a duration repeats its neighbor",
    praise: "the rhythm holds a groove",
    complaint: "the rhythm never settles",
    extract: (notes) => {
      const durations = notes.map((n) => n.durationBeats);
      if (durations.length < 2) return 0;
      let same = 0;
      for (let i = 1; i < durations.length; i += 1) if (durations[i] === durations[i - 1]) same += 1;
      return same / (durations.length - 1);
    },
  },
  {
    key: "density",
    describe: "how many notes fill the frame",
    praise: "the density feels intentional",
    complaint: "the note count fights the frame",
    extract: (notes) => clamp01(notes.length / 56),
  },
  {
    key: "breath",
    describe: "how much of the frame is left unsung",
    praise: "the line breathes",
    complaint: "there is no air between phrases",
    extract: (notes) => {
      const sung = notes.reduce((sum, n) => sum + n.durationBeats, 0);
      return clamp01(1 - sung / TOTAL_BEATS);
    },
  },
  {
    key: "syncopation",
    describe: "how much starts off the beat",
    praise: "the phrasing plays with the beat",
    complaint: "everything lands squarely on the grid",
    extract: (notes) => notes.length ? notes.filter((n) => n.startBeat % 1 !== 0).length / notes.length : 0,
  },
  {
    key: "motif-coherence",
    describe: "how much the bars speak the same cell",
    praise: "one idea develops",
    complaint: "the bars don't share an idea",
    extract: (notes) => {
      const bars = new Map<number, number[]>();
      for (let i = 1; i < notes.length; i += 1) {
        const bar = Math.floor(notes[i]!.startBeat / 4);
        if (!bars.has(bar)) bars.set(bar, []);
        bars.get(bar)!.push(Math.sign(notes[i]!.degree - notes[i - 1]!.degree));
      }
      const signatures = [...bars.values()].filter((s) => s.length >= 2).map((s) => s.slice(0, 3).join(","));
      if (signatures.length < 2) return 0;
      let matches = 0;
      let pairs = 0;
      for (let i = 0; i < signatures.length; i += 1) {
        for (let j = i + 1; j < signatures.length; j += 1) {
          pairs += 1;
          if (signatures[i] === signatures[j]) matches += 1;
        }
      }
      return pairs ? matches / pairs : 0;
    },
  },
  {
    key: "arrival",
    describe: "whether the last note lands long and at home",
    praise: "it arrives",
    complaint: "it just stops",
    extract: (notes, roots) => {
      const last = notes[notes.length - 1];
      if (!last) return 0;
      const homeRoot = roots[roots.length - 1] ?? 0;
      return 0.5 * (last.durationBeats >= 1 ? 1 : last.durationBeats / 1) +
        0.5 * (isChordToneOf(last.degree, homeRoot) ? 1 : 0);
    },
  },
  {
    key: "peak-placement",
    describe: "where the highest moment sits in the frame",
    praise: "the climax is well placed",
    complaint: "the peak lands in the wrong place",
    extract: (notes) => {
      if (notes.length < 2) return 0;
      let peakIndex = 0;
      notes.forEach((n, i) => {
        if (n.degree > notes[peakIndex]!.degree) peakIndex = i;
      });
      const position = peakIndex / (notes.length - 1);
      return clamp01(1 - Math.abs(position - 0.65) / 0.65);
    },
  },
  {
    key: "chord-discipline",
    describe: "whether long notes belong to their bar's chord",
    praise: "long notes agree with the harmony",
    complaint: "long notes fight the chord",
    extract: (notes, roots) => {
      const long = notes.filter((n) => n.durationBeats >= 0.75);
      if (!long.length) return 1;
      const agreeing = long.filter((n) => {
        const root = roots[Math.floor(n.startBeat / 4) % Math.max(1, roots.length)] ?? 0;
        return isChordToneOf(n.degree, root);
      });
      return agreeing.length / long.length;
    },
  },
  {
    key: "strong-alignment",
    describe: "whether the emphasized notes carry the downbeats",
    praise: "the accents mean something",
    complaint: "the emphasis is arbitrary",
    extract: (notes) => {
      const strong = notes.filter((n) => n.strong);
      if (!strong.length) return 0;
      return strong.filter((n) => n.startBeat % 4 === 0).length / strong.length;
    },
  },
];

export const CRITIC_FEATURE_COUNT = WALK_FEATURE_EXTRACTORS.length;

export function flattenWalk(walk: MotifWalk): CriticNote[] {
  return walk.bars
    .flat()
    .map((note) => ({
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      degree: note.degree,
      strong: note.strong,
    }))
    .sort((a, b) => a.startBeat - b.startBeat);
}

export function featurizeWalkNotes(notes: readonly CriticNote[], roots: readonly number[]): number[] {
  return WALK_FEATURE_EXTRACTORS.map((feature) => {
    const value = feature.extract(notes, roots);
    return Number.isFinite(value) ? clamp01(value) : 0;
  });
}

// ---- the net -----------------------------------------------------------------

export interface MutableCriticWeights {
  version: string;
  w1: number[][];
  b1: number[];
  w2: number[];
  b2: number;
  featureMeans: number[];
}

export function createCriticWeights(seed: number, hidden = 10): MutableCriticWeights {
  const rng = mulberry32(seed || 1);
  const scale = 1 / Math.sqrt(CRITIC_FEATURE_COUNT);
  return {
    version: "grow.critic/1",
    w1: Array.from({ length: hidden }, () =>
      Array.from({ length: CRITIC_FEATURE_COUNT }, () => (rng() * 2 - 1) * scale)),
    b1: Array.from({ length: hidden }, () => 0),
    w2: Array.from({ length: hidden }, () => (rng() * 2 - 1) * scale),
    b2: 0,
    featureMeans: Array.from({ length: CRITIC_FEATURE_COUNT }, () => 0.5),
  };
}

function forward(features: readonly number[], weights: CriticWeightsData): { hidden: number[]; logit: number; output: number } {
  const hidden = weights.w1.map((row, h) => {
    let sum = weights.b1[h] ?? 0;
    for (let i = 0; i < features.length; i += 1) sum += (row[i] ?? 0) * (features[i] ?? 0);
    return Math.tanh(sum);
  });
  let logit = weights.b2;
  for (let h = 0; h < hidden.length; h += 1) logit += (weights.w2[h] ?? 0) * hidden[h]!;
  return { hidden, logit, output: 1 / (1 + Math.exp(-logit)) };
}

export function scoreFeatures(features: readonly number[], weights: CriticWeightsData = CRITIC_WEIGHTS): number {
  return forward(features, weights).output;
}

// The pre-sigmoid opinion. Sigmoid saturates for anything clearly
// music-shaped, so ranking among GOOD candidates and attributing reactions
// happen here, where differences survive.
export function logitOfFeatures(features: readonly number[], weights: CriticWeightsData = CRITIC_WEIGHTS): number {
  return forward(features, weights).logit;
}

// Apply d(loss)/d(logit) through the net for one example. With BCE+sigmoid
// that gradient is simply (output - label); with a preference pair it is the
// pair probability error, signed per side.
function applyLogitGradient(
  weights: MutableCriticWeights,
  features: readonly number[],
  hidden: readonly number[],
  dLogit: number,
  learningRate: number,
): void {
  for (let h = 0; h < weights.w2.length; h += 1) {
    const dHidden = dLogit * weights.w2[h]! * (1 - hidden[h]! * hidden[h]!);
    weights.w2[h] = weights.w2[h]! - learningRate * dLogit * hidden[h]!;
    for (let i = 0; i < features.length; i += 1) {
      weights.w1[h]![i] = weights.w1[h]![i]! - learningRate * dHidden * (features[i] ?? 0);
    }
    weights.b1[h] = weights.b1[h]! - learningRate * dHidden;
  }
  weights.b2 -= learningRate * dLogit;
}

// One SGD step on binary cross-entropy; returns the pre-step prediction.
export function trainCriticStep(
  weights: MutableCriticWeights,
  features: readonly number[],
  label: number,
  learningRate = 0.05,
): number {
  const { hidden, output } = forward(features, weights);
  applyLogitGradient(weights, features, hidden, output - label, learningRate);
  return output;
}

// ---- taste: the personal net that learns from preferences --------------------
//
// Two nets, so learning taste cannot break grammar: the shipped grammar
// critic stays frozen; a small taste net starts near-neutral and learns only
// from preference pairs ("this development over that one"). The combined
// opinion is the sum of their logits.

export function createTasteWeights(seed = 0x7a57e): MutableCriticWeights {
  const weights = createCriticWeights(seed);
  weights.version = "grow.criticTaste/1";
  // zero-init the output layer only: the taste opinion starts EXACTLY neutral
  // (logit 0, ranking untouched) while the hidden layer keeps healthy random
  // weights so gradients flow from the first preference pair.
  for (let h = 0; h < weights.w2.length; h += 1) weights.w2[h] = 0;
  return weights;
}

let activeTasteWeights: MutableCriticWeights | null = null;

// The app registers the listener's local taste profile here; ranking then
// hears grammar + taste. Tests and headless runs leave it unset (grammar
// only), which keeps material generation deterministic for them.
export function setActiveTasteWeights(weights: MutableCriticWeights | null): void {
  activeTasteWeights = weights;
}

export function getActiveTasteWeights(): MutableCriticWeights | null {
  return activeTasteWeights;
}

function combinedLogit(features: readonly number[], weights: CriticWeightsData, taste: CriticWeightsData | null): number {
  const grammar = forward(features, weights).logit;
  return taste ? grammar + forward(features, taste).logit : grammar;
}

// RankNet-style step: nudge the taste net so the preferred side wins the
// pair. Gradient flows ONLY into taste — grammar is frozen. Returns the
// pre-step probability that the preferred side wins.
export function trainTastePreferenceStep(
  taste: MutableCriticWeights,
  preferredFeatures: readonly number[],
  otherFeatures: readonly number[],
  grammar: CriticWeightsData = CRITIC_WEIGHTS,
  learningRate = 0.15,
): number {
  const preferred = forward(preferredFeatures, taste);
  const other = forward(otherFeatures, taste);
  const delta = (forward(preferredFeatures, grammar).logit + preferred.logit) -
    (forward(otherFeatures, grammar).logit + other.logit);
  const p = 1 / (1 + Math.exp(-delta));
  const dLogit = p - 1;
  applyLogitGradient(taste, preferredFeatures, preferred.hidden, dLogit, learningRate);
  applyLogitGradient(taste, otherFeatures, other.hidden, -dLogit, learningRate);
  return p;
}

// Teach a preference between two developments of the same plan.
export function teachPreferenceForPlan(
  taste: MutableCriticWeights,
  plan: SongMotifPlan,
  preferredSeed: number,
  otherSeed: number,
  grammar: CriticWeightsData = CRITIC_WEIGHTS,
): number {
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  const preferredFeatures = featurizeWalkNotes(flattenWalk(developSongMotifWalk(plan, preferredSeed)), roots);
  const otherFeatures = featurizeWalkNotes(flattenWalk(developSongMotifWalk(plan, otherSeed)), roots);
  return trainTastePreferenceStep(taste, preferredFeatures, otherFeatures, grammar);
}

export function serializeTasteWeights(taste: MutableCriticWeights): string {
  return JSON.stringify(taste);
}

export function deserializeTasteWeights(raw: string): MutableCriticWeights | null {
  try {
    const parsed = JSON.parse(raw) as MutableCriticWeights;
    if (parsed?.version !== "grow.criticTaste/1") return null;
    if (!Array.isArray(parsed.w1) || parsed.w1.length === 0) return null;
    if (parsed.w1.some((row) => !Array.isArray(row) || row.length !== CRITIC_FEATURE_COUNT)) return null;
    if (!Array.isArray(parsed.w2) || parsed.w2.length !== parsed.w1.length) return null;
    if (!Array.isArray(parsed.b1) || parsed.b1.length !== parsed.w1.length) return null;
    if (typeof parsed.b2 !== "number" || !Number.isFinite(parsed.b2)) return null;
    if (!Array.isArray(parsed.featureMeans)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---- reactions ---------------------------------------------------------------

// Occlusion: re-score with each perception replaced by "what a typical walk
// does" (the corpus mean). The delta is how much that perception actually
// moved this reaction — model-grounded, not a canned rule.
export function reactToWalkNotes(
  notes: readonly CriticNote[],
  roots: readonly number[],
  weights: CriticWeightsData = CRITIC_WEIGHTS,
): CriticReaction {
  const features = featurizeWalkNotes(notes, roots);
  const score = scoreFeatures(features, weights);
  const logit = logitOfFeatures(features, weights);
  const attributions = WALK_FEATURE_EXTRACTORS.map((feature, index) => {
    const occluded = [...features];
    occluded[index] = weights.featureMeans[index] ?? 0.5;
    return { feature: feature.key, delta: logit - logitOfFeatures(occluded, weights) };
  });
  const ranked = [...attributions].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const voiced = (delta: number, index: number): string => {
    const feature = WALK_FEATURE_EXTRACTORS.find((f) => f.key === ranked[index]!.feature)!;
    return delta > 0 ? feature.praise : feature.complaint;
  };
  const strengths: string[] = [];
  const complaints: string[] = [];
  ranked.forEach((attribution, index) => {
    if (Math.abs(attribution.delta) < 0.2) return;
    if (attribution.delta > 0 && strengths.length < 3) strengths.push(voiced(attribution.delta, index));
    if (attribution.delta < 0 && complaints.length < 3) complaints.push(voiced(attribution.delta, index));
  });
  return { score, strengths, complaints, attributions };
}

export function reactToWalk(
  walk: MotifWalk,
  roots: readonly number[],
  weights: CriticWeightsData = CRITIC_WEIGHTS,
): CriticReaction {
  return reactToWalkNotes(flattenWalk(walk), roots, weights);
}

// ---- the seam: ranking candidate developments ---------------------------------

export function rankWalkCandidates(
  plan: SongMotifPlan,
  candidateSeeds: readonly number[],
  weights: CriticWeightsData = CRITIC_WEIGHTS,
): CriticCandidate[] {
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  const taste = activeTasteWeights;
  const scored = candidateSeeds.map((seed) => {
    const features = featurizeWalkNotes(flattenWalk(developSongMotifWalk(plan, seed)), roots);
    const logit = combinedLogit(features, weights, taste);
    return { seed, score: 1 / (1 + Math.exp(-logit)), logit };
  });
  // ranked in logit space (sigmoid saturates for anything music-shaped);
  // stable: ties keep candidate order, so the material seed wins when equal
  return scored
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => b.candidate.logit - a.candidate.logit || a.index - b.index)
    .map((entry) => entry.candidate);
}

export function deriveCandidateSeeds(materialSeed: number, candidateCount = 5): number[] {
  const rng = mulberry32(((materialSeed >>> 0) ^ 0xc71c1c) || 1);
  const seeds = [materialSeed];
  while (seeds.length < candidateCount) {
    seeds.push(Math.floor(rng() * 0x7fffffff));
  }
  return seeds;
}

// The audible seam: audition a handful of developments of the same plan and
// perform the one the critic prefers. Deterministic — the candidate list is
// derived from the material seed and the weights are data.
export function chooseCriticDevelopmentSeed(
  plan: SongMotifPlan,
  materialSeed: number,
  candidateCount = 5,
  weights: CriticWeightsData = CRITIC_WEIGHTS,
): number {
  const seeds = deriveCandidateSeeds(materialSeed, candidateCount);
  return rankWalkCandidates(plan, seeds, weights)[0]?.seed ?? materialSeed;
}

export interface CriticReport {
  version: string;
  chosenSeed: number;
  candidates: readonly CriticCandidate[];
  reaction: CriticReaction;
}

// Everything the critic has to say about a song's development, in one call:
// the audition table, which development it chose, and its worded reaction.
export function createCriticReport(
  plan: SongMotifPlan,
  materialSeed: number,
  candidateCount = 5,
  weights: CriticWeightsData = CRITIC_WEIGHTS,
): CriticReport {
  const candidates = rankWalkCandidates(plan, deriveCandidateSeeds(materialSeed, candidateCount), weights);
  const chosenSeed = candidates[0]?.seed ?? materialSeed;
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  return {
    version: weights.version,
    chosenSeed,
    candidates,
    reaction: reactToWalk(developSongMotifWalk(plan, chosenSeed), roots, weights),
  };
}

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
