import {
  normalizeAnchorPhrase,
  type Anchor,
  type AnchorPhrase,
  type Connector,
} from "./anchor-phrase";
import { renderAnchorPhrase } from "./anchor-phrase-render";
import {
  chooseMelodyPlan,
  finalCadenceDegree,
  melodyPhraseBeats,
  type MelodyContour,
  type MelodyPlan,
} from "./melody-plan";
import type { SongGoal } from "./song-goal";
import type { PlayerPatternSource } from "./song-material";

// Melodic rhythm as prosody: a line is an *utterance* built from metrical feet,
// grouped into a seeded phrase plan. E4 moves the old fixed question/answer arch
// into plan data: phrase count, motif scheme, contour, cadence, anacrusis,
// density, and register are chosen before anchors are built.

export interface ProsodicMelodyInput {
  seed: number;
  baseOctave?: number;
  bars?: number;
  goal?: Pick<SongGoal, "brightness" | "energy" | "surpriseTarget">;
  plan?: MelodyPlan;
}

const GRID = 0.25; // 16th-note resolution
const BEATS_PER_BAR = 4;

type Stress = 0 | 1 | 2; // 0 ghost/weak, 1 mid, 2 focal

interface Cell {
  dur: number;
  stress: Stress;
}

interface SegmentBuildInput {
  baseOctave: number;
  cadenceDegree: number;
  contour: MelodyContour;
  isFinalPhrase: boolean;
  phraseBeats: number;
  phraseIndex: number;
  plan: MelodyPlan;
  rng: () => number;
  startBeat: number;
}

interface MotifMemory {
  segment: AnchorPhrase["segments"][number];
  phraseBeats: number;
}

const FEET: readonly (readonly Cell[])[] = [
  [{ dur: 0.5, stress: 0 }, { dur: 1.5, stress: 2 }],
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 1 }],
  [{ dur: 0.25, stress: 0 }, { dur: 0.25, stress: 0 }, { dur: 1.0, stress: 2 }],
  [{ dur: 1.0, stress: 2 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }],
  [{ dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }, { dur: 0.5, stress: 1 }, { dur: 0.5, stress: 0 }],
];

const STRESS_VELOCITY: Record<Stress, number> = { 0: 0.18, 1: 0.3, 2: 0.46 };

export function generateProsodicMelody(input: ProsodicMelodyInput): PlayerPatternSource {
  const baseOctave = input.baseOctave ?? input.plan?.registerBase ?? 4;
  const phrase = generateProsodicAnchorPhrase(input);
  const normalized = normalizeAnchorPhrase(phrase);
  return renderAnchorPhrase(normalized.phrase, {
    baseOctave,
    subdivisionBeats: GRID,
  });
}

export function generateProsodicAnchorPhrase(input: ProsodicMelodyInput): AnchorPhrase {
  const bars = input.bars ?? 4;
  const totalBeats = bars * BEATS_PER_BAR;
  const plan = input.plan ?? chooseMelodyPlan(input.seed, input.goal, { totalBeats });
  const phraseBeats = normalizePhraseBeats(plan, totalBeats);
  const baseOctave = Math.trunc(input.baseOctave ?? plan.registerBase);
  const rng = mulberry32((input.seed ^ plan.seed ^ 0x9e3779b9) >>> 0);
  const segments: AnchorPhrase["segments"][number][] = [];
  const motifMemory = new Map<"A" | "B", MotifMemory>();
  let startBeat = 0;

  for (let phraseIndex = 0; phraseIndex < phraseBeats.length; phraseIndex += 1) {
    const beats = phraseBeats[phraseIndex] ?? 4;
    const role = motifRoleAt(plan.motifScheme, phraseIndex);
    const isFinalPhrase = phraseIndex === phraseBeats.length - 1;
    const cadenceDegree = isFinalPhrase
      ? finalCadenceDegree(plan.cadences.final)
      : plan.cadences.internal[phraseIndex] ?? plan.cadences.internal.at(-1) ?? 5;
    const contour = plan.contours[phraseIndex] ?? plan.contours.at(-1) ?? "arch";
    const repeat = role.repeatKey ? motifMemory.get(role.repeatKey) : undefined;
    const segment = repeat
      ? repeatMotifSegment(repeat, {
        baseOctave,
        cadenceDegree,
        isFinalPhrase,
        phraseBeats: beats,
        phraseIndex,
        primeTail: role.prime,
        rng,
        startBeat,
      })
      : buildPlannedSegment({
        baseOctave,
        cadenceDegree,
        contour,
        isFinalPhrase,
        phraseBeats: beats,
        phraseIndex,
        plan,
        rng,
        startBeat,
      });

    if (role.storeKey) {
      motifMemory.set(role.storeKey, { segment, phraseBeats: beats });
    }
    segments.push(segment);
    startBeat = round3(startBeat + beats);
  }

  return normalizeAnchorPhrase({ segments }).phrase;
}

function normalizePhraseBeats(plan: MelodyPlan, totalBeats: number): readonly number[] {
  const planTotal = plan.phraseBeats.reduce((sum, value) => sum + value, 0);
  if (Math.abs(planTotal - totalBeats) < 0.001) return plan.phraseBeats;
  return melodyPhraseBeats(plan.phraseStructure, totalBeats);
}

function buildPlannedSegment(input: SegmentBuildInput): AnchorPhrase["segments"][number] {
  const anchors: Anchor[] = [];
  const cadenceHold = Math.min(input.isFinalPhrase ? 2 : 1.25, Math.max(0.5, input.phraseBeats * 0.24));
  const breath = input.isFinalPhrase ? 0 : Math.min(0.5, input.phraseBeats * 0.12);
  const cadenceStart = round3(Math.max(
    input.startBeat + GRID,
    input.startBeat + input.phraseBeats - cadenceHold - breath,
  ));
  const bodyStart = addAnacrusisAnchors(input, anchors);
  const bodyEnd = Math.max(bodyStart + GRID, cadenceStart - GRID);
  const bodyCount = bodyAnchorCount(input.plan.densityFamily, input.phraseBeats);
  const startDegree = startDegreeForPhrase(input);

  for (let index = 0; index < bodyCount; index += 1) {
    const progress = bodyCount === 1 ? 0.5 : index / Math.max(1, bodyCount - 1);
    const startBeat = round3(lerp(bodyStart, bodyEnd, progress));
    if (startBeat >= cadenceStart - GRID) continue;
    const foot = FEET[Math.floor(input.rng() * FEET.length)] ?? FEET[0];
    const stress = foot[index % foot.length]?.stress ?? 1;
    const degree = contourDegree(input.contour, progress, startDegree, input.cadenceDegree, index);
    anchors.push(anchorFromLanguageDegree(
      degree,
      octaveForDegree(input.baseOctave, degree, input.contour, index),
      startBeat,
      Math.min(1, Math.max(GRID, (bodyEnd - bodyStart) / Math.max(1, bodyCount + 1))),
      STRESS_VELOCITY[stress],
    ));
  }

  anchors.push(anchorFromLanguageDegree(
    input.cadenceDegree,
    input.baseOctave,
    cadenceStart,
    input.isFinalPhrase
      ? Math.max(GRID, input.startBeat + input.phraseBeats - cadenceStart)
      : cadenceHold,
    STRESS_VELOCITY[2],
  ));

  const sortedAnchors = sortAndDedupeAnchors(anchors);
  return {
    anchors: sortedAnchors,
    connectors: connectorsForAnchors(sortedAnchors, input.plan.densityFamily),
  };
}

function addAnacrusisAnchors(input: SegmentBuildInput, anchors: Anchor[]): number {
  const startDegree = startDegreeForPhrase(input);
  if (input.plan.anacrusis === "none") {
    anchors.push(anchorFromLanguageDegree(startDegree, input.baseOctave, input.startBeat, 0.5, STRESS_VELOCITY[1]));
    return round3(input.startBeat + 0.75);
  }
  anchors.push(anchorFromLanguageDegree(startDegree, input.baseOctave, input.startBeat, 0.25, STRESS_VELOCITY[0]));
  if (input.plan.anacrusis === "pickup-run") {
    anchors.push(anchorFromLanguageDegree(
      clampLanguageDegree(startDegree + 1),
      input.baseOctave,
      input.startBeat + 0.25,
      0.25,
      STRESS_VELOCITY[0],
    ));
  }
  const landingBeat = input.plan.anacrusis === "pickup-run" ? input.startBeat + 0.75 : input.startBeat + 0.5;
  anchors.push(anchorFromLanguageDegree(
    contourDegree(input.contour, 0.16, startDegree, input.cadenceDegree, 0),
    input.baseOctave,
    landingBeat,
    0.75,
    STRESS_VELOCITY[2],
  ));
  return round3(landingBeat + 0.95);
}

function repeatMotifSegment(
  memory: MotifMemory,
  input: {
    baseOctave: number;
    cadenceDegree: number;
    isFinalPhrase: boolean;
    phraseBeats: number;
    phraseIndex: number;
    primeTail: boolean;
    rng: () => number;
    startBeat: number;
  },
): AnchorPhrase["segments"][number] {
  const sourceAnchors = memory.segment.anchors;
  const sourceStart = sourceAnchors[0]?.startBeat ?? 0;
  const sourceEnd = Math.max(
    sourceStart + GRID,
    ...sourceAnchors.map((anchor) => anchor.startBeat + anchor.durationBeats),
  );
  const sourceSpan = Math.max(GRID, sourceEnd - sourceStart);
  const transposition = ((input.phraseIndex + Math.floor(input.rng() * 3)) % 3) - 1;
  const anchors = sourceAnchors.map((anchor, index) => {
    const progress = (anchor.startBeat - sourceStart) / sourceSpan;
    const isTail = index >= sourceAnchors.length - 2;
    const degree = isTail && input.primeTail
      ? clampLanguageDegree(input.cadenceDegree + transposition)
      : clampLanguageDegree(anchor.degree + transposition);
    const startBeat = round3(input.startBeat + progress * input.phraseBeats);
    const durationBeats = index === sourceAnchors.length - 1 && input.isFinalPhrase
      ? Math.max(GRID, input.startBeat + input.phraseBeats - startBeat)
      : Math.max(GRID, Math.min(anchor.durationBeats, input.phraseBeats * 0.35));
    return {
      ...anchor,
      degree,
      octave: input.baseOctave + (anchor.octave - (sourceAnchors[0]?.octave ?? input.baseOctave)),
      startBeat,
      durationBeats: round3(durationBeats),
    };
  });
  if (anchors.length > 0) {
    const finalAnchor = anchors[anchors.length - 1]!;
    anchors[anchors.length - 1] = {
      ...finalAnchor,
      degree: input.cadenceDegree,
      durationBeats: input.isFinalPhrase
        ? round3(Math.max(GRID, input.startBeat + input.phraseBeats - finalAnchor.startBeat))
        : finalAnchor.durationBeats,
    };
  }
  const sortedAnchors = sortAndDedupeAnchors(anchors);
  return {
    anchors: sortedAnchors,
    connectors: connectorsForAnchors(sortedAnchors, "flowing"),
  };
}

function motifRoleAt(
  scheme: MelodyPlan["motifScheme"],
  phraseIndex: number,
): { prime: boolean; repeatKey?: "A" | "B"; storeKey?: "A" | "B" } {
  switch (scheme) {
    case "AAB":
      return phraseIndex === 0
        ? { prime: false, storeKey: "A" }
        : phraseIndex === 1
          ? { prime: false, repeatKey: "A" }
          : { prime: false, storeKey: "B" };
    case "ABA":
      return phraseIndex === 0
        ? { prime: false, storeKey: "A" }
        : phraseIndex === 1
          ? { prime: false, storeKey: "B" }
          : { prime: false, repeatKey: "A" };
    case "ABAB'":
      if (phraseIndex === 0) return { prime: false, storeKey: "A" };
      if (phraseIndex === 1) return { prime: false, storeKey: "B" };
      return phraseIndex % 2 === 0
        ? { prime: false, repeatKey: "A" }
        : { prime: true, repeatKey: "B" };
    case "call-echo":
      return phraseIndex === 0
        ? { prime: false, storeKey: "A" }
        : phraseIndex === 1
          ? { prime: false, repeatKey: "A" }
          : { prime: true, storeKey: "B" };
    case "through":
      return { prime: false };
  }
}

function bodyAnchorCount(family: MelodyPlan["densityFamily"], phraseBeats: number): number {
  switch (family) {
    case "sparse":
      return Math.max(1, Math.round(phraseBeats / 4));
    case "flowing":
      return Math.max(2, Math.round(phraseBeats / 2.2));
    case "busy":
      return Math.max(3, Math.round(phraseBeats / 1.45));
  }
}

function startDegreeForPhrase(input: Pick<SegmentBuildInput, "contour" | "phraseIndex" | "plan">): number {
  const offset = input.phraseIndex % 3;
  switch (input.contour) {
    case "descent":
      return 6 - offset;
    case "climb":
      return 1 + offset;
    case "valley":
      return 4;
    case "pedal-leap":
      return input.phraseIndex % 2 === 0 ? 1 : 5;
    case "zigzag":
      return 3 + offset;
    case "arch":
      return 2 + offset;
  }
}

function contourDegree(
  contour: MelodyContour,
  progress: number,
  startDegree: number,
  cadenceDegree: number,
  index: number,
): number {
  switch (contour) {
    case "descent":
      return clampLanguageDegree(Math.round(lerp(Math.max(startDegree, 5), cadenceDegree, progress)));
    case "climb":
      return clampLanguageDegree(Math.round(lerp(Math.min(startDegree, 2), Math.max(cadenceDegree, 5), progress)));
    case "valley":
      return clampLanguageDegree(progress < 0.5
        ? Math.round(lerp(startDegree, 1, progress * 2))
        : Math.round(lerp(1, cadenceDegree, (progress - 0.5) * 2)));
    case "pedal-leap":
      return clampLanguageDegree(index % 2 === 0 ? startDegree : startDegree + 4);
    case "zigzag":
      return clampLanguageDegree(startDegree + (index % 2 === 0 ? 2 : -2));
    case "arch":
      return clampLanguageDegree(progress < 0.55
        ? Math.round(lerp(startDegree, 6, progress / 0.55))
        : Math.round(lerp(6, cadenceDegree, (progress - 0.55) / 0.45)));
  }
}

function octaveForDegree(
  baseOctave: number,
  degree: number,
  contour: MelodyContour,
  index: number,
): number {
  if (contour === "pedal-leap" && index % 2 === 1) return baseOctave + 1;
  if (degree >= 6 && (contour === "arch" || contour === "climb" || contour === "zigzag")) return baseOctave + 1;
  return baseOctave;
}

function connectorsForAnchors(
  anchors: readonly Anchor[],
  densityFamily: MelodyPlan["densityFamily"],
): readonly Connector[] {
  return anchors.slice(0, -1).map((anchor, index) => {
    const next = anchors[index + 1];
    if (index === 0) {
      return connector("approach", {
        density: densityFamily === "busy" ? 0.82 : 0.62,
        reach: 0.42,
        bias: next.degree >= anchor.degree ? -0.4 : 0.4,
        pull: 0.85,
        skew: 0.12,
      });
    }
    if (index === anchors.length - 2) {
      return connector("approach", {
        density: densityFamily === "sparse" ? 0.05 : 0.18,
        reach: 0.62,
        bias: next.degree >= anchor.degree ? -0.6 : 0.6,
        pull: 1,
        skew: 1,
      });
    }
    return connector(index % 3 === 0 ? "detour" : "fill", {
      density: densityFamily === "busy" ? 0.72 : densityFamily === "flowing" ? 0.52 : 0.24,
      reach: 0.5,
      bias: next.degree >= anchor.degree ? 0.2 : -0.2,
      pull: 0.46,
      skew: index % 2 === 0 ? 0.12 : -0.1,
    });
  });
}

function connector(
  kernel: Connector["kernel"],
  values: Partial<Omit<Connector, "kernel">>,
): Connector {
  return {
    kernel,
    reach: values.reach ?? 0.5,
    density: values.density ?? 0.5,
    bias: values.bias ?? 0,
    pull: values.pull ?? 0.5,
    color: values.color ?? 0,
    skew: values.skew ?? 0,
  };
}

function anchorFromLanguageDegree(
  degree: number,
  octave: number,
  startBeat: number,
  durationBeats: number,
  velocity: number,
): Anchor {
  return {
    degree: clampLanguageDegree(degree),
    octave,
    startBeat: round3(startBeat),
    durationBeats: round3(Math.max(GRID, durationBeats)),
    dynamics: round3(Math.max(0.12, Math.min(0.78, velocity))),
  };
}

function sortAndDedupeAnchors(anchors: readonly Anchor[]): readonly Anchor[] {
  const sorted = [...anchors].sort((left, right) => left.startBeat - right.startBeat);
  const result: Anchor[] = [];
  let previousEnd = -Infinity;
  for (const anchor of sorted) {
    const startBeat = Math.max(anchor.startBeat, previousEnd);
    const safeAnchor = {
      ...anchor,
      startBeat: round3(startBeat),
      durationBeats: round3(Math.max(GRID, anchor.durationBeats)),
    };
    result.push(safeAnchor);
    previousEnd = safeAnchor.startBeat + safeAnchor.durationBeats;
  }
  return result;
}

function clampLanguageDegree(value: number): number {
  return Math.max(1, Math.min(7, value));
}

function lerp(left: number, right: number, progress: number): number {
  return left + (right - left) * Math.max(0, Math.min(1, progress));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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
