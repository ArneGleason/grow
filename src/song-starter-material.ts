import { generateProsodicMelody } from "./melody-prosody";
import { chooseMelodyPlan, type MelodyPlan } from "./melody-plan";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";
import type { SongLibraryStarter } from "./song-library";

const STARTER_PATTERN_BEATS = 16;
const PULSE_SUBDIVISION_BEATS = 0.5;
const BASS_SUBDIVISION_BEATS = 0.5;
const DEFAULT_ROOT_CYCLE = [0, 4, 6, 4] as const;

type StarterPulseStyle = "grounded" | "backbeat" | "syncopated" | "ticking";
type StarterBassStyle = "sparse" | "walk" | "leap" | "answer";
type StarterMelodyStyle = "spacious" | "arch" | "angular" | "spark";

export interface StarterMaterialProfile {
  pulseStyle: StarterPulseStyle;
  bassStyle: StarterBassStyle;
  melodyStyle: StarterMelodyStyle;
  density: number;
}

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
  const profile = createStarterMaterialProfile(starter, seed);
  const rootCycle = createStarterRootCycle(base, starter, seed);
  return {
    ...base,
    label: `${base.label} starter`,
    description: `${base.description} Prompt-seeded into a 16-beat ${profile.melodyStyle}/${profile.bassStyle} phrase pack.`,
    patterns: [
      createStarterPulsePattern(starter, rootCycle, seed, profile),
      createStarterBassPattern(starter, rootCycle, seed, profile),
      createStarterMelodyPattern(starter, seed, rootCycle, profile),
    ],
  };
}

export function createStarterMaterialProfile(
  starter: SongLibraryStarter,
  seed: number,
): StarterMaterialProfile {
  const text = [
    starter.sourcePrompt,
    ...starter.playerPlans.map((plan) => plan.brief),
    ...starter.goal.influenceHints,
  ].join(" ").toLowerCase();
  const energy = clamp01(starter.goal.energy);
  const surprise = clamp01(starter.goal.surpriseTarget);
  const slow = energy < 0.42 || hasAny(text, ["slow", "patient", "wide", "space", "shadow", "dub"]);
  const bright = starter.goal.brightness > 0.58 || hasAny(text, ["bright", "glass", "spark", "hook", "shine"]);
  const machine = !bright && hasAny(text, ["machine", "motor", "engine", "tick", "grid", "restless"]);
  const walking = hasAny(text, ["walk", "basement", "smoke", "dorian", "low"]);
  const seedChoice = (seed >>> 5) % 4;

  return {
    pulseStyle: machine
      ? "ticking"
      : bright
        ? "syncopated"
        : slow
          ? "grounded"
          : seedChoice === 0 ? "grounded" : seedChoice === 1 ? "backbeat" : seedChoice === 2 ? "syncopated" : "ticking",
    bassStyle: slow
      ? "sparse"
      : walking
        ? "walk"
        : bright
          ? "leap"
          : seedChoice <= 1 ? "answer" : seedChoice === 2 ? "walk" : "leap",
    melodyStyle: slow
      ? "spacious"
      : machine || surprise > 0.62
        ? "angular"
        : bright
          ? "spark"
          : seedChoice === 0 ? "arch" : seedChoice === 1 ? "spacious" : seedChoice === 2 ? "angular" : "spark",
    density: round3(Math.max(0.22, Math.min(0.92, energy * 0.62 + surprise * 0.28 + (bright ? 0.08 : 0)))),
  };
}

export function createStarterMelodyPlan(
  starter: SongLibraryStarter,
  seed: number,
  profile = createStarterMaterialProfile(starter, seed),
): MelodyPlan {
  return chooseMelodyPlan(seed ^ melodyStyleSeedSalt(profile.melodyStyle), starter.goal, {
    styleHint: profile.melodyStyle,
    totalBeats: STARTER_PATTERN_BEATS,
  });
}

function createStarterPulsePattern(
  starter: SongLibraryStarter,
  roots: readonly number[],
  seed: number,
  profile: StarterMaterialProfile,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "pulse");
  const energy = clamp01(starter.goal.energy);
  const events = Array.from({ length: STARTER_PATTERN_BEATS / PULSE_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    if (!enabled) return null;
    const beat = slot * PULSE_SUBDIVISION_BEATS;
    const halfBeatInBar = slot % 8;
    const bar = Math.floor(beat / 4);
    if (!shouldPlayStarterPulse(profile.pulseStyle, halfBeatInBar, bar, seed)) return null;
    const downbeat = halfBeatInBar === 0;
    const offbeat = halfBeatInBar % 2 === 1;
    return createNote(
      "pulse",
      roots[bar % roots.length] ?? 0,
      2,
      downbeat ? 0.72 + energy * 0.08 : offbeat ? 0.34 + energy * 0.12 : 0.46 + energy * 0.18,
      offbeat ? 0.25 : 0.5,
      [`starter:pulse:${profile.pulseStyle}`],
    );
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
  profile: StarterMaterialProfile,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "bass");
  const energy = clamp01(starter.goal.energy);
  const events = Array.from({ length: STARTER_PATTERN_BEATS / BASS_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    if (!enabled) return null;
    const beat = slot * BASS_SUBDIVISION_BEATS;
    const halfBeatInBar = slot % 8;
    const bar = Math.floor(beat / 4);
    const root = roots[bar % roots.length] ?? 0;
    const nextRoot = roots[(bar + 1) % roots.length] ?? root;
    const degree = starterBassDegreeAt(profile.bassStyle, halfBeatInBar, bar, root, nextRoot, seed);
    if (degree === undefined) return null;
    const lowRoot = halfBeatInBar === 0;
    return createNote(
      "bass",
      degree,
      lowRoot ? 2 : 1,
      lowRoot ? 0.5 + energy * 0.12 : 0.32 + energy * 0.12,
      profile.bassStyle === "sparse" && lowRoot ? 1 : 0.5,
      [`starter:bass:${profile.bassStyle}`],
    );
  });
  return {
    subdivisionBeats: BASS_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterMelodyPattern(
  starter: SongLibraryStarter,
  seed: number,
  roots: readonly number[],
  profile: StarterMaterialProfile,
): PlayerPatternSource {
  if (!isPlayerEnabled(starter, "melody")) {
    return {
      subdivisionBeats: 0.25,
      events: Array.from({ length: STARTER_PATTERN_BEATS / 0.25 }, () => null),
    };
  }
  const plan = createStarterMelodyPlan(starter, seed, profile);
  const melody = generateProsodicMelody({
    seed: seed ^ melodyStyleSeedSalt(profile.melodyStyle),
    baseOctave: plan.registerBase,
    bars: STARTER_PATTERN_BEATS / 4,
    goal: starter.goal,
    plan,
  });
  const velocityScale = 0.88 + clamp01(starter.goal.energy) * 0.28;
  let noteOrdinal = 0;
  return {
    subdivisionBeats: melody.subdivisionBeats,
    events: melody.events.map((event, index) => {
      const beat = index * melody.subdivisionBeats;
      const bar = Math.floor(beat / 4);
      const root = roots[bar % roots.length] ?? 0;
      if (!event) {
        return createStarterMelodyPickup(profile, root, index, beat, seed);
      }
      noteOrdinal += 1;
      if (shouldDropStarterMelodyNote(profile, event, noteOrdinal, index, seed)) return null;
      return transformStarterMelodyNote(event, {
        beat,
        noteOrdinal,
        plan,
        profile,
        root,
        seed,
        velocityScale,
      });
    }),
  };
}

function shouldPlayStarterPulse(
  style: StarterPulseStyle,
  halfBeatInBar: number,
  bar: number,
  seed: number,
): boolean {
  switch (style) {
    case "grounded":
      return halfBeatInBar === 0 || (bar % 2 === 1 && halfBeatInBar === 4);
    case "backbeat":
      return halfBeatInBar === 0 || halfBeatInBar === 4 || (bar % 2 === 1 && halfBeatInBar === 6);
    case "syncopated":
      return halfBeatInBar === 0 || halfBeatInBar === 3 || (halfBeatInBar === 5 && seedBit(seed, bar));
    case "ticking":
      return halfBeatInBar === 0 || halfBeatInBar === 2 || halfBeatInBar === 4 || halfBeatInBar === 6;
  }
}

function starterBassDegreeAt(
  style: StarterBassStyle,
  halfBeatInBar: number,
  bar: number,
  root: number,
  nextRoot: number,
  seed: number,
): number | undefined {
  switch (style) {
    case "sparse":
      if (halfBeatInBar === 0) return root;
      if (halfBeatInBar === 7 && bar % 2 === 1) return approachDegree(root, nextRoot, seedBit(seed, bar) ? 1 : -1);
      return undefined;
    case "walk":
      if (halfBeatInBar === 0) return root;
      if (halfBeatInBar === 2) return root + 1;
      if (halfBeatInBar === 4) return root + 2;
      if (halfBeatInBar === 6) return approachDegree(root, nextRoot, seedBit(seed, bar) ? 1 : -1);
      return undefined;
    case "leap":
      if (halfBeatInBar === 0) return root;
      if (halfBeatInBar === 3) return root + 4;
      if (halfBeatInBar === 5) return nextRoot + 2;
      if (halfBeatInBar === 7) return approachDegree(root, nextRoot, seedBit(seed, bar + 3) ? 1 : -1);
      return undefined;
    case "answer":
      if (halfBeatInBar === 0) return root;
      if (halfBeatInBar === 4 && bar % 2 === 0) return root + 4;
      if (halfBeatInBar === 5 && bar % 2 === 1) return root + 2;
      if (halfBeatInBar === 7) return approachDegree(root, nextRoot, seedBit(seed, bar + 5) ? 1 : -1);
      return undefined;
  }
}

interface StarterMelodyTransformInput {
  beat: number;
  noteOrdinal: number;
  plan: MelodyPlan;
  profile: StarterMaterialProfile;
  root: number;
  seed: number;
  velocityScale: number;
}

function transformStarterMelodyNote(
  event: PatternNoteSource,
  input: StarterMelodyTransformInput,
): PatternNoteSource {
  const style = input.profile.melodyStyle;
  const durationBeats = style === "spacious"
    ? round3(Math.min(2, event.durationBeats * 1.35))
    : event.durationBeats;
  return {
    ...event,
    duration: durationForBeats(durationBeats),
    durationBeats,
    velocity: round3(Math.max(0.16, Math.min(0.68, event.velocity * input.velocityScale * starterMelodyVelocityMultiplier(style, input.noteOrdinal)))),
    tags: [
      ...(event.tags ?? []),
      `starter:melody:${style}`,
      `starter:plan:${input.plan.phraseStructure}`,
      `starter:motif:${input.plan.motifScheme}`,
    ],
  };
}

function shouldDropStarterMelodyNote(
  profile: StarterMaterialProfile,
  event: PatternNoteSource,
  noteOrdinal: number,
  index: number,
  seed: number,
): boolean {
  if (profile.melodyStyle !== "spacious") return false;
  if (event.velocity >= 0.42) return false;
  return ((seed + index + noteOrdinal) % 3) !== 0;
}

function createStarterMelodyPickup(
  profile: StarterMaterialProfile,
  root: number,
  index: number,
  beat: number,
  seed: number,
): PatternNoteSource | null {
  const slotInBeat = index % 4;
  const beatInBar = Math.floor(beat) % 4;
  if (profile.melodyStyle === "spark" && slotInBeat === 3 && (index + seed) % 5 === 0) {
    return createNote("melody", root + 4 + ((index >>> 2) % 2), 5, 0.2 + profile.density * 0.18, 0.25, [
      "starter:melody:spark",
      "starter:pickup",
    ]);
  }
  if (profile.melodyStyle === "angular" && beatInBar === 3 && slotInBeat === 2 && seedBit(seed, index)) {
    return createNote("melody", root + (index % 2 === 0 ? 5 : -2), 4, 0.22 + profile.density * 0.14, 0.25, [
      "starter:melody:angular",
      "starter:pickup",
    ]);
  }
  return null;
}

function starterMelodyVelocityMultiplier(style: StarterMelodyStyle, noteOrdinal: number): number {
  switch (style) {
    case "spacious":
      return noteOrdinal % 2 === 0 ? 0.82 : 0.94;
    case "arch":
      return 1;
    case "angular":
      return noteOrdinal % 3 === 0 ? 1.18 : 0.96;
    case "spark":
      return noteOrdinal % 2 === 0 ? 1.14 : 1.02;
  }
}

function melodyStyleSeedSalt(style: StarterMelodyStyle): number {
  switch (style) {
    case "spacious":
      return 0x5150;
    case "arch":
      return 0xa4c1;
    case "angular":
      return 0x4a62;
    case "spark":
      return 0x5a9d;
  }
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
  tags: readonly string[] = [],
): PatternNoteSource {
  return {
    playerId,
    scaleDegree,
    octave,
    duration: durationForBeats(durationBeats),
    durationBeats,
    velocity: round3(Math.max(0.12, Math.min(0.9, velocity))),
    tags,
  };
}

function durationForBeats(durationBeats: number): PatternNoteSource["duration"] {
  return durationBeats >= 1 ? "4n" : durationBeats >= 0.5 ? "8n" : "16n";
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

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function hashStarterMaterialKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
