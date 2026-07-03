import type { SongGoal } from "./song-goal";

export const MELODY_PHRASE_STRUCTURES = [
  "2-even",
  "2-uneven",
  "3-phrase",
  "4-short",
] as const;
export type MelodyPhraseStructure = typeof MELODY_PHRASE_STRUCTURES[number];

export const MELODY_MOTIF_SCHEMES = [
  "AAB",
  "ABA",
  "ABAB'",
  "through",
  "call-echo",
] as const;
export type MelodyMotifScheme = typeof MELODY_MOTIF_SCHEMES[number];

export const MELODY_CONTOURS = [
  "arch",
  "descent",
  "climb",
  "valley",
  "pedal-leap",
  "zigzag",
] as const;
export type MelodyContour = typeof MELODY_CONTOURS[number];

export const MELODY_ANACRUSES = [
  "none",
  "light",
  "pickup-run",
] as const;
export type MelodyAnacrusis = typeof MELODY_ANACRUSES[number];

export const MELODY_DENSITY_FAMILIES = [
  "sparse",
  "flowing",
  "busy",
] as const;
export type MelodyDensityFamily = typeof MELODY_DENSITY_FAMILIES[number];

export const MELODY_FINAL_CADENCES = [
  "1",
  "3",
  "open-on-5",
  "open-on-2",
] as const;
export type MelodyFinalCadence = typeof MELODY_FINAL_CADENCES[number];

export const MELODY_INTERNAL_CADENCES = [5, 4, 2, 7] as const;
export type MelodyInternalCadence = typeof MELODY_INTERNAL_CADENCES[number];

export type MelodyStyleHint = "spacious" | "arch" | "angular" | "spark";

export interface MelodyPlan {
  seed: number;
  phraseStructure: MelodyPhraseStructure;
  phraseBeats: readonly number[];
  motifScheme: MelodyMotifScheme;
  contours: readonly MelodyContour[];
  cadences: {
    internal: readonly MelodyInternalCadence[];
    final: MelodyFinalCadence;
  };
  anacrusis: MelodyAnacrusis;
  densityFamily: MelodyDensityFamily;
  registerBase: 3 | 4 | 5;
}

export interface MelodyPlanOptions {
  styleHint?: MelodyStyleHint;
  totalBeats?: number;
}

export function chooseMelodyPlan(
  seed: number,
  goal?: Pick<SongGoal, "brightness" | "energy" | "surpriseTarget">,
  options: MelodyPlanOptions = {},
): MelodyPlan {
  const normalizedSeed = seed >>> 0;
  const rng = mulberry32(normalizedSeed || 1);
  const styleHint = options.styleHint;
  const phraseStructure = pickWeighted(MELODY_PHRASE_STRUCTURES, rng, (value) =>
    styleWeight(value, styleHint, {
      spacious: ["2-uneven", "3-phrase"],
      arch: ["2-even", "2-uneven"],
      angular: ["3-phrase", "4-short"],
      spark: ["4-short", "3-phrase"],
    }) + (goal?.energy !== undefined && goal.energy > 0.7 && value === "4-short" ? 2 : 0)
  );
  const phraseBeats = melodyPhraseBeats(phraseStructure, options.totalBeats ?? 16);
  const motifScheme = pickWeighted(MELODY_MOTIF_SCHEMES, rng, (value) =>
    styleWeight(value, styleHint, {
      spacious: ["call-echo", "through"],
      arch: ["AAB", "ABA"],
      angular: ["through", "ABAB'"],
      spark: ["ABAB'", "AAB"],
    }) + (goal?.surpriseTarget !== undefined && goal.surpriseTarget > 0.65 && value === "through" ? 2 : 0)
  );
  const phraseCount = phraseBeats.length;
  const contours = Array.from({ length: phraseCount }, (_, index) =>
    pickWeighted(MELODY_CONTOURS, rng, (value) =>
      styleWeight(value, styleHint, {
        spacious: ["descent", "valley"],
        arch: ["arch", "climb"],
        angular: ["zigzag", "pedal-leap"],
        spark: ["climb", "zigzag"],
      }) + (index > 0 && value !== "arch" ? 0.5 : 0)
    )
  );
  const internal = Array.from({ length: Math.max(0, phraseCount - 1) }, () =>
    pickWeighted(MELODY_INTERNAL_CADENCES, rng, (value) =>
      value === 7 && goal?.brightness !== undefined && goal.brightness < 0.35 ? 2.6 : 1
    )
  );
  const final = pickWeighted(MELODY_FINAL_CADENCES, rng, (value) => {
    if (goal?.surpriseTarget !== undefined && goal.surpriseTarget > 0.65) {
      return value.startsWith("open") ? 3 : 1;
    }
    if (goal?.brightness !== undefined && goal.brightness > 0.68) {
      return value === "3" || value === "open-on-5" ? 2.5 : 1;
    }
    return value === "1" ? 2 : 1;
  });
  const anacrusis = pickWeighted(MELODY_ANACRUSES, rng, (value) =>
    styleWeight(value, styleHint, {
      spacious: ["none", "light"],
      arch: ["light"],
      angular: ["light", "pickup-run"],
      spark: ["pickup-run"],
    }) + (goal?.energy !== undefined && goal.energy > 0.72 && value === "pickup-run" ? 2 : 0)
  );
  const densityFamily = pickWeighted(MELODY_DENSITY_FAMILIES, rng, (value) => {
    const style = styleWeight(value, styleHint, {
      spacious: ["sparse"],
      arch: ["flowing"],
      angular: ["busy"],
      spark: ["busy", "flowing"],
    });
    if (goal?.energy !== undefined && goal.energy > 0.72 && value === "busy") return style + 2;
    if (goal?.energy !== undefined && goal.energy < 0.4 && value === "sparse") return style + 2;
    return style;
  });
  const registerBase = pickWeighted([3, 4, 5] as const, rng, (value) => {
    if (styleHint === "spark" && value === 5) return 4;
    if (styleHint === "spacious" && value === 3) return 2.5;
    if (goal?.brightness !== undefined && goal.brightness > 0.7 && value === 5) return 2.5;
    if (goal?.brightness !== undefined && goal.brightness < 0.35 && value === 3) return 2.5;
    return value === 4 ? 1.5 : 1;
  });

  return {
    seed: normalizedSeed,
    phraseStructure,
    phraseBeats,
    motifScheme,
    contours,
    cadences: { internal, final },
    anacrusis,
    densityFamily,
    registerBase,
  };
}

export function melodyPhraseBeats(
  structure: MelodyPhraseStructure,
  totalBeats = 16,
): readonly number[] {
  const beats = Math.max(4, totalBeats);
  const ratios = phraseStructureRatios(structure);
  const raw = ratios.map((ratio) => roundBeat(beats * ratio));
  const sumBeforeLast = raw.slice(0, -1).reduce((sum, value) => sum + value, 0);
  return raw.map((value, index) =>
    index === raw.length - 1 ? roundBeat(Math.max(1, beats - sumBeforeLast)) : Math.max(1, value)
  );
}

export function finalCadenceDegree(cadence: MelodyFinalCadence): 1 | 2 | 3 | 5 {
  switch (cadence) {
    case "1":
      return 1;
    case "3":
      return 3;
    case "open-on-5":
      return 5;
    case "open-on-2":
      return 2;
  }
}

function phraseStructureRatios(structure: MelodyPhraseStructure): readonly number[] {
  switch (structure) {
    case "2-even":
      return [0.5, 0.5];
    case "2-uneven":
      return [0.375, 0.625];
    case "3-phrase":
      return [0.25, 0.25, 0.5];
    case "4-short":
      return [0.25, 0.25, 0.25, 0.25];
  }
}

function styleWeight<T extends string | number>(
  value: T,
  styleHint: MelodyStyleHint | undefined,
  preferences: Partial<Record<MelodyStyleHint, readonly T[]>>,
): number {
  if (!styleHint) return 1;
  return preferences[styleHint]?.includes(value) ? 3 : 1;
}

function pickWeighted<T extends string | number>(
  values: readonly T[],
  rng: () => number,
  weightFor: (value: T) => number,
): T {
  const weights = values.map((value) => Math.max(0.001, weightFor(value)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = rng() * total;
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return values[index]!;
  }
  return values[values.length - 1]!;
}

function roundBeat(value: number): number {
  return Math.round(value * 4) / 4;
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
