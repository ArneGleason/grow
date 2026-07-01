import { generateProsodicMelody } from "./melody-prosody";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";
import type { SongLibraryStarter } from "./song-library";

const STARTER_PATTERN_BEATS = 16;
const PULSE_SUBDIVISION_BEATS = 1;
const BASS_SUBDIVISION_BEATS = 0.5;
const DEFAULT_ROOT_CYCLE = [0, 4, 6, 4] as const;

export const MODE_ROOT_CYCLES = {
  ionian: [0, 4, 5, 3],
  dorian: [0, 3, 4, 6],
  mixolydian: [0, 4, 6, 4],
  aeolian: [0, 5, 3, 6],
  lydian: [0, 4, 1, 5],
  phrygian: [0, 1, 4, 3],
} as const satisfies Record<string, readonly number[]>;

export function createSongStarterMaterial(base: SongMaterial, starter: SongLibraryStarter): SongMaterial {
  const seed = starter.materialSeed ?? hashStarterMaterialKey(`${starter.sourcePrompt}:${base.id}`);
  const rootCycle = createStarterRootCycle(base, starter, seed);
  return {
    ...base,
    label: `${base.label} starter`,
    description: `${base.description} Prompt-seeded into a 16-beat phrase pack.`,
    patterns: [
      createStarterPulsePattern(starter, rootCycle, seed),
      createStarterBassPattern(starter, rootCycle, seed),
      createStarterMelodyPattern(starter, seed),
    ],
  };
}

function createStarterPulsePattern(
  starter: SongLibraryStarter,
  roots: readonly number[],
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "pulse");
  const energy = clamp01(starter.goal.energy);
  const restless = starter.goal.surpriseTarget > 0.58;
  const events = Array.from({ length: STARTER_PATTERN_BEATS }, (_, beat): PatternNoteSource | null => {
    if (!enabled) return null;
    const beatInBar = beat % 4;
    const bar = Math.floor(beat / 4);
    const downbeat = beatInBar === 0;
    const backbeat = beatInBar === 2 && (energy >= 0.42 || bar % 2 === 1);
    const syncCue = restless && beatInBar === (seedBit(seed, beat) ? 3 : 1) && bar % 2 === 1;
    if (!downbeat && !backbeat && !syncCue) return null;
    return createNote("pulse", roots[bar % roots.length] ?? 0, 2, downbeat ? 0.75 : 0.46 + energy * 0.22, 0.5);
  });
  return {
    subdivisionBeats: PULSE_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterBassPattern(
  starter: SongLibraryStarter,
  roots: readonly number[],
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "bass");
  const energy = clamp01(starter.goal.energy);
  const spacious = energy < 0.42 ||
    (starter.goal.sectionEmphasis.bridge ?? 0) > (starter.goal.sectionEmphasis.chorus ?? 0);
  const events = Array.from({ length: STARTER_PATTERN_BEATS / BASS_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    if (!enabled) return null;
    const beat = slot * BASS_SUBDIVISION_BEATS;
    const halfBeatInBar = slot % 8;
    const bar = Math.floor(beat / 4);
    const root = roots[bar % roots.length] ?? 0;
    const nextRoot = roots[(bar + 1) % roots.length] ?? root;
    if (halfBeatInBar === 0) {
      return createNote("bass", root, 2, 0.5 + energy * 0.1, 0.75);
    }
    if (!spacious && halfBeatInBar === 3) {
      return createNote("bass", root + 4, 1, 0.36 + energy * 0.1, 0.5);
    }
    if (halfBeatInBar === 5 && (energy >= 0.52 || seedBit(seed, bar))) {
      return createNote("bass", root + 2, 1, 0.34 + energy * 0.08, 0.5);
    }
    if (halfBeatInBar === 7 && (!spacious || bar % 2 === 1)) {
      return createNote("bass", approachDegree(root, nextRoot, seedBit(seed, slot) ? 1 : -1), 1, 0.32, 0.5);
    }
    return null;
  });
  return {
    subdivisionBeats: BASS_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterMelodyPattern(
  starter: SongLibraryStarter,
  seed: number,
): PlayerPatternSource {
  if (!isPlayerEnabled(starter, "melody")) {
    return {
      subdivisionBeats: 0.25,
      events: Array.from({ length: STARTER_PATTERN_BEATS / 0.25 }, () => null),
    };
  }
  const melody = generateProsodicMelody({
    seed,
    baseOctave: starter.goal.energy > 0.7 ? 5 : 4,
    bars: STARTER_PATTERN_BEATS / 4,
  });
  const velocityScale = 0.88 + clamp01(starter.goal.energy) * 0.28;
  return {
    subdivisionBeats: melody.subdivisionBeats,
    events: melody.events.map((event) =>
      event
        ? {
          ...event,
          velocity: round3(Math.max(0.16, Math.min(0.62, event.velocity * velocityScale))),
        }
        : null
    ),
  };
}

function createStarterRootCycle(base: SongMaterial, starter: SongLibraryStarter, seed: number): readonly number[] {
  const baseRoots = deriveBaseRoots(base);
  const modeRoots = MODE_ROOT_CYCLES[starter.goal.mode] ?? DEFAULT_ROOT_CYCLE;
  const rotation = baseRoots.length > 0 ? seed % baseRoots.length : 0;
  const rotatedBase = rotate(baseRoots, rotation);
  const combined = [
    0,
    rotatedBase[1] ?? modeRoots[1] ?? 4,
    modeRoots[(seed >>> 3) % modeRoots.length] ?? 6,
    rotatedBase[2] ?? modeRoots[3] ?? 4,
  ];
  return combined.map(normalizeDegree);
}

function deriveBaseRoots(base: SongMaterial): readonly number[] {
  const bass = base.patterns.find((pattern) => pattern.events.some((event) => event?.playerId === "bass"));
  const roots = uniqueDegrees(
    (bass ?? base.patterns[0])?.events
      .filter((event): event is PatternNoteSource => event !== null)
      .map((event) => normalizeDegree(event.scaleDegree)) ?? [],
  );
  return roots.length > 0 ? roots : DEFAULT_ROOT_CYCLE;
}

function isPlayerEnabled(starter: SongLibraryStarter, playerId: string): boolean {
  const plan = starter.playerPlans.find((candidate) => candidate.playerId === playerId);
  return plan ? plan.enabled : true;
}

function createNote(
  playerId: string,
  scaleDegree: number,
  octave: number,
  velocity: number,
  durationBeats: number,
): PatternNoteSource {
  return {
    playerId,
    scaleDegree,
    octave,
    duration: durationBeats >= 1 ? "4n" : "8n",
    durationBeats,
    velocity: round3(Math.max(0.12, Math.min(0.9, velocity))),
  };
}

function approachDegree(fromDegree: number, toDegree: number, direction: 1 | -1): number {
  const from = normalizeDegree(fromDegree);
  const to = normalizeDegree(toDegree);
  if (from === to) return from + direction;
  const upward = (to - from + 7) % 7;
  const downward = (from - to + 7) % 7;
  return upward <= downward ? to - 1 : to + 1;
}

function seedBit(seed: number, index: number): boolean {
  return ((seed >>> (index % 24)) & 1) === 1;
}

function rotate(values: readonly number[], by: number): readonly number[] {
  if (values.length === 0) return values;
  const offset = ((by % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function uniqueDegrees(degrees: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const degree of degrees) {
    const normalized = normalizeDegree(degree);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function hashStarterMaterialKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
