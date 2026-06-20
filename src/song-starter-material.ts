import { getFormVariant } from "./form-variants";
import type {
  PatternNoteSource,
  PlayerPatternSource,
  SongMaterial,
  SongMaterialDraftMetadata,
} from "./song-material";
import type { SongLibraryStarter } from "./song-library";
import {
  sectionAtBeat,
  type SongArrangement,
  type SongHarmonicSectionId,
  type SongSectionContext,
} from "./song-form";

const PULSE_SUBDIVISION_BEATS = 1;
const BASS_SUBDIVISION_BEATS = 0.5;
const MELODY_SUBDIVISION_BEATS = 0.5;
const DEFAULT_ROOT_CYCLE = [0, 4, 6, 4] as const;

const MODE_ROOT_CYCLES = {
  ionian: [0, 4, 5, 3],
  dorian: [0, 3, 4, 6],
  mixolydian: [0, 4, 6, 4],
  aeolian: [0, 5, 3, 6],
  lydian: [0, 4, 1, 5],
  phrygian: [0, 1, 4, 3],
} as const satisfies Record<string, readonly number[]>;

interface DraftDimensions {
  energy: number;
  surprise: number;
  rupture: number;
  hush: number;
  asymmetry: number;
  momentum: number;
  relationTags: readonly string[];
}

export function createSongStarterMaterial(base: SongMaterial, starter: SongLibraryStarter): SongMaterial {
  const seed = starter.materialSeed ?? hashStarterMaterialKey(`${starter.sourcePrompt}:${base.id}`);
  const arrangement = getFormVariant(starter.goal.formPreference).arrangement;
  const dimensions = createDraftDimensions(starter, seed);
  const rootPlans = createDraftRootPlans(starter, seed, dimensions);
  const phraseBeats = arrangement.totalBeats;
  return {
    ...base,
    label: `${base.label} wild draft`,
    description: `${base.description} Prompt-seeded into a full-form relational draft.`,
    draft: {
      kind: "starter-full-form",
      phraseBeats,
      relationTags: dimensions.relationTags,
      melodyMode: "full-form",
      rootPlans,
    },
    patterns: [
      createStarterPulsePattern(starter, arrangement, dimensions, seed),
      createStarterBassPattern(starter, arrangement, dimensions, seed),
      createStarterMelodyPattern(starter, arrangement, dimensions, rootPlans, seed),
    ],
  };
}

function createStarterPulsePattern(
  starter: SongLibraryStarter,
  arrangement: SongArrangement,
  dimensions: DraftDimensions,
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "pulse");
  const events = Array.from({ length: arrangement.totalBeats / PULSE_SUBDIVISION_BEATS }, (_, beat): PatternNoteSource | null => {
    if (!enabled) return null;
    const context = sectionAtBeat(beat, arrangement);
    if (!shouldPulsePlay(context, dimensions, seed)) return null;
    const downbeat = isNear(context.beatInBar, 0);
    const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
    const velocity = downbeat
      ? 0.58 + dimensions.energy * 0.18 + (finalReturn ? 0.08 : 0)
      : 0.36 + dimensions.momentum * 0.24;
    return createNote("pulse", 0, 2, velocity, 0.5);
  });
  return {
    subdivisionBeats: PULSE_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterBassPattern(
  starter: SongLibraryStarter,
  arrangement: SongArrangement,
  dimensions: DraftDimensions,
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "bass");
  const events = Array.from({ length: arrangement.totalBeats / BASS_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    if (!enabled) return null;
    const beat = slot * BASS_SUBDIVISION_BEATS;
    const context = sectionAtBeat(beat, arrangement);
    const halfBeatInBar = Math.round(context.beatInBar / BASS_SUBDIVISION_BEATS);
    const sourceDegree = getBassSourceDegree(context, halfBeatInBar, dimensions, seed);
    if (sourceDegree === undefined) return null;
    const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
    const velocity = context.sectionType === "bridge"
      ? 0.34 + dimensions.rupture * 0.08
      : context.sectionType === "chorus"
      ? 0.46 + dimensions.energy * 0.12 + (finalReturn ? 0.06 : 0)
      : 0.4 + dimensions.momentum * 0.08;
    const octave = sourceDegree === 0 ? 2 : 1;
    return createNote("bass", sourceDegree, octave, velocity, sourceDegree === 0 ? 0.75 : 0.5);
  });
  return {
    subdivisionBeats: BASS_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterMelodyPattern(
  starter: SongLibraryStarter,
  arrangement: SongArrangement,
  dimensions: DraftDimensions,
  rootPlans: SongMaterialDraftMetadata["rootPlans"],
  seed: number,
): PlayerPatternSource {
  if (!isPlayerEnabled(starter, "melody")) {
    return {
      subdivisionBeats: MELODY_SUBDIVISION_BEATS,
      events: Array.from({ length: arrangement.totalBeats / MELODY_SUBDIVISION_BEATS }, () => null),
    };
  }
  const motif = createMelodyMotif(seed, dimensions);
  const baseOctave = dimensions.energy > 0.72 ? 5 : 4;
  const events = Array.from({ length: arrangement.totalBeats / MELODY_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    const beat = slot * MELODY_SUBDIVISION_BEATS;
    const context = sectionAtBeat(beat, arrangement);
    const halfBeatInBar = Math.round(context.beatInBar / MELODY_SUBDIVISION_BEATS);
    const degree = getMelodyDegree(context, halfBeatInBar, motif, rootPlans, dimensions, seed);
    if (degree === undefined) return null;
    const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
    const octave = clampInteger(
      baseOctave +
        (context.sectionType === "chorus" ? 1 : 0) +
        (context.sectionType === "bridge" && dimensions.rupture > 0.62 ? 1 : 0) -
        (context.sectionType === "bridge" && dimensions.hush > 0.55 ? 1 : 0),
      2,
      6,
    );
    const velocity = context.sectionType === "chorus"
      ? 0.34 + dimensions.energy * 0.16 + (finalReturn ? 0.08 : 0)
      : context.sectionType === "bridge"
      ? 0.22 + dimensions.rupture * 0.12
      : 0.26 + dimensions.momentum * 0.12;
    const durationBeats = context.sectionType === "chorus" && (halfBeatInBar === 0 || halfBeatInBar === 5)
      ? 1
      : 0.5;
    return createNote("melody", degree, octave, velocity, durationBeats);
  });
  return {
    subdivisionBeats: MELODY_SUBDIVISION_BEATS,
    events,
  };
}

function createDraftDimensions(starter: SongLibraryStarter, seed: number): DraftDimensions {
  const prompt = starter.sourcePrompt.toLowerCase();
  const energy = clamp01(starter.goal.energy);
  const surprise = clamp01(starter.goal.surpriseTarget);
  const rupture = clamp01(Math.max(
    surprise * 0.72 + seededUnit(seed, 2) * 0.28,
    hasAny(prompt, ["broken", "fracture", "unstable", "strange", "off beat", "uneasy", "danger", "scorch"]) ? 0.72 : 0,
  ));
  const hush = clamp01(Math.max(
    1 - energy,
    hasAny(prompt, ["quiet", "hushed", "space", "empty", "lonely", "distant", "slow"]) ? 0.68 : 0,
  ));
  const asymmetry = clamp01(Math.max(
    surprise * 0.55 + seededUnit(seed, 7) * 0.45,
    hasAny(prompt, ["crooked", "lurch", "machinery", "basement", "restless", "gear"]) ? 0.66 : 0,
  ));
  const momentum = clamp01(energy * 0.72 + (1 - hush) * 0.28);
  return {
    energy,
    surprise,
    rupture,
    hush,
    asymmetry,
    momentum,
    relationTags: [
      "full-form-memory",
      hush > 0.55 ? "breath-debt" : "continuous-thread",
      rupture > 0.6 ? "bridge-rupture" : "bridge-shadow",
      asymmetry > 0.58 ? "asymmetric-roles" : "stable-roles",
      momentum > 0.62 ? "return-acceleration" : "return-softening",
    ],
  };
}

function createDraftRootPlans(
  starter: SongLibraryStarter,
  seed: number,
  dimensions: DraftDimensions,
): SongMaterialDraftMetadata["rootPlans"] {
  const modeRoots = MODE_ROOT_CYCLES[starter.goal.mode] ?? DEFAULT_ROOT_CYCLE;
  const rotated = rotate(modeRoots, seed % modeRoots.length);
  const colorRoot = rotated[2] ?? modeRoots[2] ?? 6;
  const liftRoot = modeRoots[(seed >>> 4) % modeRoots.length] ?? 4;
  const ruptureRoot = normalizeDegree((colorRoot ?? 0) + (dimensions.rupture > 0.55 ? 3 : 2));
  return {
    gather: [
      0,
      rotated[1] ?? modeRoots[1] ?? 4,
      colorRoot,
      dimensions.asymmetry > 0.58 ? liftRoot : rotated[1] ?? 4,
    ].map(normalizeDegree),
    answer: [
      colorRoot,
      rotated[3] ?? modeRoots[3] ?? 4,
      dimensions.momentum > 0.58 ? 0 : liftRoot,
      rotated[1] ?? modeRoots[1] ?? 4,
    ].map(normalizeDegree),
    bridge: [
      ruptureRoot,
      normalizeDegree((rotated[1] ?? 4) + 2),
      dimensions.hush > 0.58 ? 0 : normalizeDegree((colorRoot ?? 6) - 2),
      0,
    ],
  };
}

function shouldPulsePlay(context: SongSectionContext, dimensions: DraftDimensions, seed: number): boolean {
  const beat = Math.round(context.beatInBar);
  const bar = context.localBar - 1;
  const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
  if (context.sectionType === "bridge") {
    return beat === 0 && (bar % 2 === 0 || dimensions.rupture > 0.66) ||
      beat === 3 && dimensions.asymmetry > 0.65 && seedBit(seed, bar);
  }
  if (context.sectionType === "chorus") {
    return beat === 0 || beat === 2 || (finalReturn && (beat === 1 || beat === 3));
  }
  return beat === 0 ||
    (beat === 2 && (bar % 2 === 1 || dimensions.momentum > 0.62)) ||
    (beat === 3 && dimensions.asymmetry > 0.64 && bar % 4 === 2);
}

function getBassSourceDegree(
  context: SongSectionContext,
  halfBeatInBar: number,
  dimensions: DraftDimensions,
  seed: number,
): number | undefined {
  const bar = context.localBar - 1;
  const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
  if (context.sectionType === "bridge") {
    if (halfBeatInBar === 0 && (bar % 2 === 0 || dimensions.rupture > 0.62)) return 0;
    if (halfBeatInBar === 5 && dimensions.rupture > 0.58) return seedBit(seed, bar) ? 6 : 1;
    if (halfBeatInBar === 7 && dimensions.asymmetry > 0.62) return 2;
    return undefined;
  }
  if (context.sectionType === "chorus") {
    if (halfBeatInBar === 0) return 0;
    if (halfBeatInBar === 3 || (finalReturn && halfBeatInBar === 2)) return 4;
    if (halfBeatInBar === 5 && (dimensions.energy > 0.48 || finalReturn)) return 2;
    if (halfBeatInBar === 7) return seedBit(seed, bar + context.occurrence) ? 6 : 1;
    return undefined;
  }
  if (halfBeatInBar === 0) return 0;
  if (halfBeatInBar === 5 && (dimensions.momentum > 0.48 || bar % 2 === 1)) return 4;
  if (halfBeatInBar === 7 && dimensions.asymmetry > 0.52 && bar % 4 !== 3) return seedBit(seed, bar) ? 6 : 1;
  return undefined;
}

function getMelodyDegree(
  context: SongSectionContext,
  halfBeatInBar: number,
  motif: readonly number[],
  rootPlans: SongMaterialDraftMetadata["rootPlans"],
  dimensions: DraftDimensions,
  seed: number,
): number | undefined {
  const bar = context.localBar - 1;
  const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
  const breathDebt = context.sectionType === "verse" && bar % 4 === 3 && dimensions.hush > 0.42;
  if (breathDebt && halfBeatInBar !== 7) return undefined;
  if (!shouldMelodyPlay(context, halfBeatInBar, dimensions, seed)) return undefined;
  const root = getRootForContext(context, rootPlans);
  const motifIndex = Math.abs(
    Math.floor(context.formBeat / 2) + halfBeatInBar + context.occurrence + (seed % motif.length),
  ) % motif.length;
  const motifDegree = motif[motifIndex] ?? 0;
  if (context.sectionType === "bridge") {
    return root - motifDegree + (dimensions.rupture > 0.65 ? 3 : 1);
  }
  if (finalReturn && halfBeatInBar >= 5) {
    return root + motifDegree + 1;
  }
  return root + motifDegree;
}

function shouldMelodyPlay(
  context: SongSectionContext,
  halfBeatInBar: number,
  dimensions: DraftDimensions,
  seed: number,
): boolean {
  const bar = context.localBar - 1;
  const finalReturn = context.sectionType === "chorus" && context.occurrence >= 3;
  if (context.sectionType === "bridge") {
    return halfBeatInBar === 0 && (bar % 2 === 0 || dimensions.rupture > 0.7) ||
      halfBeatInBar === 5 && dimensions.rupture > 0.52 && seedBit(seed, bar + 5);
  }
  if (context.sectionType === "chorus") {
    return halfBeatInBar === 0 ||
      halfBeatInBar === 2 ||
      halfBeatInBar === 5 ||
      halfBeatInBar === 7 ||
      (finalReturn && halfBeatInBar === 3);
  }
  return halfBeatInBar === 1 ||
    halfBeatInBar === 3 ||
    (halfBeatInBar === 6 && (dimensions.momentum > 0.5 || seedBit(seed, bar))) ||
    (halfBeatInBar === 7 && dimensions.asymmetry > 0.62);
}

function createMelodyMotif(seed: number, dimensions: DraftDimensions): readonly number[] {
  const brightTurn = dimensions.energy > 0.6 ? 5 : 4;
  const uneasyTurn = dimensions.rupture > 0.62 ? 6 : 1;
  return [
    0,
    2,
    brightTurn,
    4,
    uneasyTurn,
    3,
    dimensions.hush > 0.58 ? 1 : 5,
    seedBit(seed, 11) ? 6 : 2,
  ];
}

function getRootForContext(
  context: SongSectionContext,
  rootPlans: SongMaterialDraftMetadata["rootPlans"],
): number {
  const sectionId = getHarmonicSectionId(context.sectionType);
  const roots = rootPlans[sectionId];
  return roots[Math.floor(context.localBeat / 4) % roots.length] ?? 0;
}

function getHarmonicSectionId(sectionType: SongSectionContext["sectionType"]): SongHarmonicSectionId {
  if (sectionType === "chorus") return "answer";
  if (sectionType === "bridge") return "bridge";
  return "gather";
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

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function seedBit(seed: number, index: number): boolean {
  return ((seed >>> (index % 24)) & 1) === 1;
}

function seededUnit(seed: number, salt: number): number {
  const value = Math.imul(seed ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return value / 0xffffffff;
}

function rotate(values: readonly number[], by: number): readonly number[] {
  if (values.length === 0) return values;
  const offset = ((by % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(Math.max(minimum, Math.min(maximum, value)));
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function isNear(value: number, target: number): boolean {
  return Math.abs(value - target) < 0.000001;
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
