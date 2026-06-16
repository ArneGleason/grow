import type { SongGoalMode } from "./song-goal";
import { MODE_INTERVALS } from "./tonal-context";

export const GROW_LANGUAGE_MODE_IDS = [
  "ionian",
  "mixolydian",
  "dorian",
  "aeolian",
] as const satisfies readonly SongGoalMode[];

export type GrowLanguageMode = typeof GROW_LANGUAGE_MODE_IDS[number];

export type GrowLanguageModeBridge = {
  classical: GrowLanguageMode;
  evocative: string;
  vibe: string;
  brightnessRank: number;
  intervals: typeof MODE_INTERVALS[GrowLanguageMode];
};

export const MODE_BRIDGES = {
  ionian: {
    classical: "ionian",
    evocative: "Sunshine",
    vibe: "wide-open, easy, obviously happy",
    brightnessRank: 6,
    intervals: MODE_INTERVALS.ionian,
  },
  mixolydian: {
    classical: "mixolydian",
    evocative: "Strut",
    vibe: "loose, grinning swagger - bright with grit",
    brightnessRank: 5,
    intervals: MODE_INTERVALS.mixolydian,
  },
  dorian: {
    classical: "dorian",
    evocative: "Smoke",
    vibe: "cool, curling, bittersweet but moving",
    brightnessRank: 4,
    intervals: MODE_INTERVALS.dorian,
  },
  aeolian: {
    classical: "aeolian",
    evocative: "Bruise",
    vibe: "tender, heavy-hearted, the ache",
    brightnessRank: 3,
    intervals: MODE_INTERVALS.aeolian,
  },
} as const satisfies Record<GrowLanguageMode, GrowLanguageModeBridge>;

export function modeBridge(classical: SongGoalMode): GrowLanguageModeBridge | undefined {
  return isGrowLanguageMode(classical) ? MODE_BRIDGES[classical] : undefined;
}

export function modeDisplayName(classical: SongGoalMode): string | undefined {
  return modeBridge(classical)?.evocative;
}

export function modeClassicalId(evocative: string): SongGoalMode | undefined {
  const normalized = normalizeLookup(evocative);
  return GROW_LANGUAGE_MODE_IDS.find((mode) =>
    normalizeLookup(MODE_BRIDGES[mode].evocative) === normalized
  );
}

export type DegreeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DegreeColor = {
  role: string;
  varName: string;
  hex: string;
};

export const DEGREE_COLORS = {
  1: { role: "home", varName: "--degree-1", hex: "#D85A30" },
  2: { role: "color", varName: "--degree-2", hex: "#EF9F27" },
  3: { role: "color", varName: "--degree-3", hex: "#639922" },
  4: { role: "pillar", varName: "--degree-4", hex: "#1D9E75" },
  5: { role: "pillar", varName: "--degree-5", hex: "#378ADD" },
  6: { role: "color", varName: "--degree-6", hex: "#7F77DD" },
  7: { role: "leans home", varName: "--degree-7", hex: "#D4537E" },
} as const satisfies Record<DegreeNumber, DegreeColor>;

export function degreeColor(degree: number): DegreeColor | undefined {
  return isDegreeNumber(degree) ? DEGREE_COLORS[degree] : undefined;
}

export function degreeRole(degree: number): string | undefined {
  return degreeColor(degree)?.role;
}

function isGrowLanguageMode(mode: SongGoalMode): mode is GrowLanguageMode {
  return (GROW_LANGUAGE_MODE_IDS as readonly SongGoalMode[]).includes(mode);
}

function isDegreeNumber(degree: number): degree is DegreeNumber {
  return Number.isInteger(degree) && degree >= 1 && degree <= 7;
}

function normalizeLookup(value: string): string {
  return value.trim().toLocaleLowerCase();
}
