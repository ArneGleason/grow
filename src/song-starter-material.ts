import type { Anchor, AnchorPhrase, Connector } from "./anchor-phrase";
import { renderAnchorPhrase } from "./anchor-phrase-render";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";
import type { SongLibraryStarter } from "./song-library";

const STARTER_PATTERN_BEATS = 16;
const PULSE_SUBDIVISION_BEATS = 1;
const BASS_SUBDIVISION_BEATS = 0.5;
const MELODY_SUBDIVISION_BEATS = 0.25;
const DEFAULT_ROOT_CYCLE = [0, 4, 6, 4] as const;

const MODE_ROOT_CYCLES = {
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
  const connectorProfile = createConnectorStarterProfile(starter, seed);
  return {
    ...base,
    label: `${base.label} starter`,
    description: `${base.description} Prompt-seeded into a connector-first 16-beat phrase pack (${connectorProfile.summary}).`,
    patterns: [
      createStarterPulsePattern(starter, rootCycle, seed),
      createStarterBassPattern(starter, rootCycle, seed),
      createStarterMelodyPattern(starter, rootCycle, connectorProfile, seed),
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
  roots: readonly number[],
  profile: ConnectorStarterProfile,
  seed: number,
): PlayerPatternSource {
  if (!isPlayerEnabled(starter, "melody")) {
    return {
      subdivisionBeats: MELODY_SUBDIVISION_BEATS,
      events: Array.from({ length: STARTER_PATTERN_BEATS / MELODY_SUBDIVISION_BEATS }, () => null),
    };
  }
  const phrase = createConnectorFirstStarterAnchorPhrase({
    roots,
    seed,
    baseOctave: starter.goal.energy > 0.7 ? 5 : 4,
    energy: starter.goal.energy,
    surprise: starter.goal.surpriseTarget,
    profile,
  });
  const melody = renderAnchorPhrase(phrase, {
    baseOctave: starter.goal.energy > 0.7 ? 5 : 4,
    playerId: "melody",
    subdivisionBeats: MELODY_SUBDIVISION_BEATS,
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

export interface ConnectorStarterProfile {
  blueNoteIntent: boolean;
  chromaticIntent: boolean;
  glideIntent: boolean;
  density: number;
  summary: string;
}

interface ConnectorFirstStarterInput {
  roots: readonly number[];
  seed: number;
  baseOctave: number;
  energy: number;
  surprise: number;
  profile: ConnectorStarterProfile;
}

export function createConnectorFirstStarterAnchorPhrase(input: ConnectorFirstStarterInput): AnchorPhrase {
  const roots = input.roots.length > 0 ? input.roots : DEFAULT_ROOT_CYCLE;
  const baseOctave = Math.max(3, Math.min(5, Math.trunc(input.baseOctave)));
  const energy = clamp01(input.energy);
  const surprise = clamp01(input.surprise);
  const profile = input.profile;
  const highPoint = normalizeDegree((roots[1] ?? 4) + (profile.blueNoteIntent ? 2 : 1));
  const questionCadence = normalizeDegree(roots[1] ?? 4);
  const answerCadence = normalizeDegree(roots[3] ?? 0);
  const tail = normalizeDegree(roots[0] ?? 0);
  const anchorDynamics = 0.44 + energy * 0.24;

  const firstSegmentAnchors = [
    starterAnchor(roots[0] ?? 0, baseOctave, 0, 0.75, anchorDynamics - 0.08),
    starterAnchor(highPoint, baseOctave + (energy > 0.68 ? 1 : 0), 3, 0.5, anchorDynamics),
    starterAnchor(questionCadence, baseOctave, 6.5, 1.0, anchorDynamics + 0.04),
  ];
  const secondSegmentAnchors = [
    starterAnchor(normalizeDegree((roots[2] ?? 6) + (seedBit(input.seed, 3) ? 1 : -1)), baseOctave, 8.5, 0.5, anchorDynamics - 0.1),
    starterAnchor(normalizeDegree((roots[2] ?? 6) + (profile.chromaticIntent ? 3 : 2)), baseOctave + 1, 11.25, 0.5, anchorDynamics + 0.02),
    starterAnchor(answerCadence, baseOctave, 14, 0.75, anchorDynamics + 0.03),
    starterAnchor(tail, baseOctave, 15.25, 0.75, anchorDynamics + 0.06),
  ];

  return {
    segments: [
      {
        anchors: firstSegmentAnchors,
        connectors: [
          starterConnector(profile.glideIntent ? "skip" : "fill", profile, {
            density: 0.78 + profile.density * 0.12,
            reach: profile.glideIntent ? 0.9 : 0.48,
            bias: surprise > 0.52 ? 0.3 : -0.2,
            pull: 0.48,
            skew: -0.12,
          }),
          starterConnector(profile.blueNoteIntent ? "detour" : "approach", profile, {
            density: profile.blueNoteIntent ? 0.72 : 0.56,
            reach: profile.blueNoteIntent ? 0.92 : 0.55,
            bias: profile.blueNoteIntent ? -0.7 : 0.15,
            pull: 0.82,
            skew: 0.22,
          }),
        ],
      },
      {
        anchors: secondSegmentAnchors,
        connectors: [
          starterConnector(profile.chromaticIntent ? "detour" : "fill", profile, {
            density: 0.72 + profile.density * 0.16,
            reach: profile.chromaticIntent ? 1 : 0.58,
            bias: profile.chromaticIntent ? 0.8 : -0.15,
            pull: 0.44,
            skew: -0.18,
          }),
          starterConnector(profile.glideIntent ? "skip" : "fill", profile, {
            density: profile.glideIntent ? 0.62 : 0.7,
            reach: profile.glideIntent ? 1 : 0.5,
            bias: 0.35,
            pull: 0.58,
            skew: 0.1,
          }),
          starterConnector("approach", profile, {
            density: 0.5,
            reach: profile.blueNoteIntent ? 0.85 : 0.48,
            bias: profile.blueNoteIntent ? -0.6 : -0.25,
            pull: 1,
            skew: 0.42,
          }),
        ],
      },
    ],
  };
}

function createConnectorStarterProfile(starter: SongLibraryStarter, seed: number): ConnectorStarterProfile {
  const text = [
    starter.sourcePrompt,
    ...starter.playerPlans.map((plan) => plan.brief),
    ...starter.goal.influenceHints,
  ].join(" ").toLowerCase();
  const blueNoteIntent = /\b(blues|bluesy|blue note|bent|bend|smear|dirty|worry|worried)\b/.test(text);
  const chromaticIntent = blueNoteIntent ||
    /\b(chromatic|outside|passing|enclosure|slip|slide|crawl)\b/.test(text);
  const glideIntent = /\b(glide|gliss|glissando|portamento|slide|swoop|sweep)\b/.test(text);
  const density = clamp01(starter.goal.surpriseTarget * 0.7 + starter.goal.energy * 0.3 + (seedBit(seed, 7) ? 0.08 : 0));
  const palette = [
    "modal core",
    chromaticIntent ? "chromatic connector intent" : undefined,
    blueNoteIntent ? "blue-note inflection intent" : undefined,
    glideIntent ? "glide/portamento intent" : undefined,
  ].filter((part): part is string => Boolean(part)).join(" + ");
  return {
    blueNoteIntent,
    chromaticIntent,
    glideIntent,
    density,
    summary: `${palette}; sparse anchors, dense connectors`,
  };
}

function starterAnchor(
  engineDegree: number,
  octave: number,
  startBeat: number,
  durationBeats: number,
  dynamics: number,
): Anchor {
  return {
    degree: normalizeDegree(engineDegree) + 1,
    octave,
    startBeat,
    durationBeats,
    dynamics: round3(Math.max(0.16, Math.min(0.82, dynamics))),
  };
}

function starterConnector(
  kernel: Connector["kernel"],
  profile: ConnectorStarterProfile,
  values: Partial<Omit<Connector, "kernel">>,
): Connector {
  return {
    kernel,
    reach: values.reach ?? 0.5,
    density: Math.max(0, Math.min(1, values.density ?? profile.density)),
    bias: Math.max(-1, Math.min(1, values.bias ?? 0)),
    pull: Math.max(0, Math.min(1, values.pull ?? 0.5)),
    color: profile.chromaticIntent || profile.blueNoteIntent ? 1 : 0,
    skew: Math.max(-1, Math.min(1, values.skew ?? 0)),
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
