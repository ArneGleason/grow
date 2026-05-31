import type { Player, PlayerRole } from "./players";

export interface PlayerPerformedTimingInput {
  player: Player;
  absoluteBeat: number;
  eventIndex: number;
  pitch: string;
  previousPitch?: string;
  durationBeats: number;
  baseVelocity: number;
  localDensity: number;
}

export interface PlayerPerformedTimingSnapshot {
  playerId: string;
  absoluteBeat: number;
  eventIndex: number;
  performedOffsetBeats: number;
  maximumOffsetBeats: number;
  components: {
    longCycle: number;
    mediumCycle: number;
    eventStep: number;
    dispositionPressure: number;
    sharedGroove: number;
    playerPocket: number;
    materialPressure: number;
    stumble: number;
    leapPressure: number;
    registerPressure: number;
    densityPressure: number;
  };
  summary: string;
}

interface RoleTimingProfile {
  maximumOffsetBeats: number;
  driftPeriodBeats: number;
  phrasePeriodBeats: number;
  rolePocketBeats: number;
  phrasePocketDepthBeats: number;
  materialDepthBeats: number;
  eventVariationDepthBeats: number;
  stumbleDepthBeats: number;
  stumbleChance: number;
  eventSteps: readonly number[];
}

const ROLE_TIMING_PROFILES: Record<PlayerRole, RoleTimingProfile> = {
  pulse: {
    maximumOffsetBeats: 0.008,
    driftPeriodBeats: 96,
    phrasePeriodBeats: 32,
    rolePocketBeats: 0,
    phrasePocketDepthBeats: 0,
    materialDepthBeats: 0,
    eventVariationDepthBeats: 0,
    stumbleDepthBeats: 0,
    stumbleChance: 0,
    eventSteps: [0],
  },
  bass: {
    maximumOffsetBeats: 0.018,
    driftPeriodBeats: 88,
    phrasePeriodBeats: 24,
    rolePocketBeats: 0.0035,
    phrasePocketDepthBeats: 0,
    materialDepthBeats: 0,
    eventVariationDepthBeats: 0,
    stumbleDepthBeats: 0,
    stumbleChance: 0,
    eventSteps: [0],
  },
  melody: {
    maximumOffsetBeats: 0.018,
    driftPeriodBeats: 72,
    phrasePeriodBeats: 16,
    rolePocketBeats: -0.0015,
    phrasePocketDepthBeats: 0.0008,
    materialDepthBeats: 0,
    eventVariationDepthBeats: 0,
    stumbleDepthBeats: 0,
    stumbleChance: 0,
    eventSteps: [0],
  },
  texture: {
    maximumOffsetBeats: 0.026,
    driftPeriodBeats: 104,
    phrasePeriodBeats: 32,
    rolePocketBeats: 0.002,
    phrasePocketDepthBeats: 0.003,
    materialDepthBeats: 0.004,
    eventVariationDepthBeats: 0.002,
    stumbleDepthBeats: 0.008,
    stumbleChance: 0.03,
    eventSteps: [0.12, -0.1, 0, 0.06, -0.04],
  },
  effects: {
    maximumOffsetBeats: 0.035,
    driftPeriodBeats: 120,
    phrasePeriodBeats: 40,
    rolePocketBeats: 0.003,
    phrasePocketDepthBeats: 0.005,
    materialDepthBeats: 0.006,
    eventVariationDepthBeats: 0.003,
    stumbleDepthBeats: 0.012,
    stumbleChance: 0.05,
    eventSteps: [-0.2, 0.14, 0, -0.08, 0.2, 0.04],
  },
};

export function calculatePerformedTiming(
  input: PlayerPerformedTimingInput,
): PlayerPerformedTimingSnapshot {
  const profile = ROLE_TIMING_PROFILES[input.player.role];
  const longCycle = cycleValue("ensemble", "tempo-drift", input.absoluteBeat, profile.driftPeriodBeats);
  const mediumCycle = cycleValue(input.player.id, "phrase-pocket", input.absoluteBeat, profile.phrasePeriodBeats);
  const eventStep = profile.eventSteps[input.eventIndex % profile.eventSteps.length];
  const disposition = input.player.thinking.disposition;
  const dispositionPressure = clamp(
    0.5
      + disposition.disruption * 0.32
      + (1 - disposition.steadiness) * 0.24
      - disposition.caution * 0.18,
    0.25,
    1,
  );
  const durationPressure = input.durationBeats <= 0.5 ? 0.08 : 0;
  const velocityPressure = input.baseVelocity >= 0.5 ? 0.08 : -0.04;
  const leapPressure = calculateLeapPressure(input.previousPitch, input.pitch);
  const registerPressure = calculateRegisterPressure(input.player.role, input.pitch);
  const densityPressure = clamp(input.localDensity, 0, 1);
  const difficultyPressure = clamp(
    leapPressure * 0.48 + registerPressure * 0.24 + densityPressure * 0.28,
    0,
    1,
  );
  const tempoDrift = longCycle * 0.0035;
  const sharedGroove = calculateSharedGroove(input.absoluteBeat);
  const playerPocket = calculatePlayerPocket(input.player.role, input.absoluteBeat, profile, mediumCycle);
  const materialPressure = calculateMaterialPressure(
    difficultyPressure,
    leapPressure,
    durationPressure,
    velocityPressure,
    disposition.caution,
    disposition.disruption,
    profile.materialDepthBeats,
  );
  const eventVariation = eventStep * profile.eventVariationDepthBeats * dispositionPressure;
  const stumble = calculateStumble(input.player.id, input.eventIndex, profile);
  const rawOffset = tempoDrift
    + sharedGroove
    + playerPocket
    + materialPressure
    + eventVariation
    + stumble;
  const maximumOffsetBeats = profile.maximumOffsetBeats;
  const performedOffsetBeats = roundOffset(clamp(
    rawOffset,
    -Math.min(maximumOffsetBeats, input.absoluteBeat),
    maximumOffsetBeats,
  ));

  return {
    playerId: input.player.id,
    absoluteBeat: input.absoluteBeat,
    eventIndex: input.eventIndex,
    performedOffsetBeats,
    maximumOffsetBeats,
    components: {
      longCycle,
      mediumCycle,
      eventStep,
      dispositionPressure,
      sharedGroove,
      playerPocket,
      materialPressure,
      stumble,
      leapPressure,
      registerPressure,
      densityPressure,
    },
    summary: summarizeTiming(performedOffsetBeats, sharedGroove + playerPocket, materialPressure, stumble),
  };
}

export function formatPerformedTimingSnapshot(
  snapshot: PlayerPerformedTimingSnapshot | undefined,
): string {
  if (!snapshot) return "waiting";
  const signedOffset = snapshot.performedOffsetBeats >= 0
    ? `+${snapshot.performedOffsetBeats.toFixed(3)}`
    : snapshot.performedOffsetBeats.toFixed(3);
  return `${signedOffset} beats (${snapshot.summary})`;
}

function summarizeTiming(
  performedOffsetBeats: number,
  groovePocket: number,
  materialPressure: number,
  stumble: number,
): string {
  if (Math.abs(stumble) >= 0.004) {
    return stumble < 0 ? "rare stumble push" : "rare stumble drag";
  }
  if (Math.abs(materialPressure) >= 0.0035) {
    return materialPressure < 0 ? "groove with pressure push" : "groove with pressure drag";
  }
  if (Math.abs(groovePocket) >= 0.004) {
    return groovePocket < 0 ? "ahead in pocket" : "behind in pocket";
  }
  if (performedOffsetBeats <= -0.004) return "gentle push";
  if (performedOffsetBeats >= 0.004) return "gentle drag";
  return "near-grid pocket";
}

function calculateSharedGroove(absoluteBeat: number): number {
  const halfBeatIndex = Math.round(mod(absoluteBeat, 4) * 2) % 8;
  const barPocketByHalfBeat = [
    0,
    0.006,
    -0.001,
    0.004,
    0.001,
    0.006,
    -0.001,
    0.004,
  ];
  return barPocketByHalfBeat[halfBeatIndex] ?? 0;
}

function calculatePlayerPocket(
  role: PlayerRole,
  absoluteBeat: number,
  profile: RoleTimingProfile,
  phraseCycle: number,
): number {
  const phrasePosition = mod(absoluteBeat, 8) / 8;
  const phraseEdge = phrasePosition <= 0.125
    ? -0.6
    : phrasePosition >= 0.875
      ? 0.55
      : 0;
  const rolePhraseShape = role === "melody"
    ? phraseEdge
    : role === "bass"
      ? Math.max(0, phraseEdge)
      : phraseEdge * 0.25;
  return profile.rolePocketBeats
    + phraseCycle * profile.phrasePocketDepthBeats
    + rolePhraseShape * profile.phrasePocketDepthBeats;
}

function calculateMaterialPressure(
  difficultyPressure: number,
  leapPressure: number,
  durationPressure: number,
  velocityPressure: number,
  caution: number,
  disruption: number,
  materialDepthBeats: number,
): number {
  const difficultyDrag = difficultyPressure * (0.45 + caution * 0.35);
  const difficultyPush = leapPressure * disruption * 0.5;
  const phrasePush = (durationPressure + Math.max(0, velocityPressure)) * 0.25;
  return (difficultyDrag - difficultyPush - phrasePush) * materialDepthBeats;
}

function calculateStumble(playerId: string, eventIndex: number, profile: RoleTimingProfile): number {
  const gate = seededPhase(`${playerId}:stumble-gate:${eventIndex}`);
  if (gate > profile.stumbleChance) return 0;
  const direction = seededPhase(`${playerId}:stumble-direction:${eventIndex}`) >= 0.5 ? 1 : -1;
  const depth = 0.55 + seededPhase(`${playerId}:stumble-depth:${eventIndex}`) * 0.45;
  return direction * depth * profile.stumbleDepthBeats;
}

function calculateLeapPressure(previousPitch: string | undefined, pitch: string): number {
  const previousHeight = pitchHeight(previousPitch);
  const currentHeight = pitchHeight(pitch);
  if (previousHeight === undefined || currentHeight === undefined) return 0;
  return clamp(Math.abs(currentHeight - previousHeight) / 12, 0, 1);
}

function calculateRegisterPressure(role: PlayerRole, pitch: string): number {
  const parsedPitch = parsePitch(pitch);
  if (!parsedPitch) return 0;
  const targetOctaveByRole: Record<PlayerRole, number> = {
    pulse: 2,
    bass: 2,
    melody: 4,
    texture: 4,
    effects: 4,
  };
  return clamp(Math.abs(parsedPitch.octave - targetOctaveByRole[role]) / 2, 0, 1);
}

function pitchHeight(pitch?: string): number | undefined {
  const parsedPitch = parsePitch(pitch);
  if (!parsedPitch) return undefined;
  return parsedPitch.octave * 12 + parsedPitch.semitone;
}

function parsePitch(pitch?: string): { octave: number; semitone: number } | undefined {
  const match = pitch?.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!match) return undefined;
  const [, letter, accidental = "", octave] = match;
  const semitoneByPitch: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };
  const semitone = semitoneByPitch[`${letter}${accidental}`];
  if (semitone === undefined) return undefined;
  return { octave: Number(octave), semitone };
}

function cycleValue(playerId: string, lane: string, absoluteBeat: number, periodBeats: number): number {
  const phase = seededPhase(`${playerId}:${lane}`);
  const radians = ((absoluteBeat / periodBeats) + phase) * Math.PI * 2;
  return Math.sin(radians);
}

function seededPhase(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function roundOffset(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
