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
    leapPressure: number;
    registerPressure: number;
    densityPressure: number;
  };
  summary: string;
}

interface RoleTimingProfile {
  maximumOffsetBeats: number;
  longPeriodBeats: number;
  mediumPeriodBeats: number;
  eventSteps: readonly number[];
}

const ROLE_TIMING_PROFILES: Record<PlayerRole, RoleTimingProfile> = {
  pulse: {
    maximumOffsetBeats: 0.008,
    longPeriodBeats: 40,
    mediumPeriodBeats: 13,
    eventSteps: [0.08, -0.04, 0, 0.03, -0.06],
  },
  bass: {
    maximumOffsetBeats: 0.018,
    longPeriodBeats: 34,
    mediumPeriodBeats: 11,
    eventSteps: [-0.16, 0.08, 0, 0.13, -0.09, 0.04],
  },
  melody: {
    maximumOffsetBeats: 0.03,
    longPeriodBeats: 29,
    mediumPeriodBeats: 7,
    eventSteps: [0.18, -0.22, 0.08, -0.04, 0.16, -0.1, 0.02],
  },
  texture: {
    maximumOffsetBeats: 0.026,
    longPeriodBeats: 45,
    mediumPeriodBeats: 17,
    eventSteps: [0.12, -0.1, 0, 0.06, -0.04],
  },
  effects: {
    maximumOffsetBeats: 0.035,
    longPeriodBeats: 48,
    mediumPeriodBeats: 19,
    eventSteps: [-0.2, 0.14, 0, -0.08, 0.2, 0.04],
  },
};

export function calculatePerformedTiming(
  input: PlayerPerformedTimingInput,
): PlayerPerformedTimingSnapshot {
  const profile = ROLE_TIMING_PROFILES[input.player.role];
  const longCycle = cycleValue(input.player.id, "offset-long", input.absoluteBeat, profile.longPeriodBeats);
  const mediumCycle = cycleValue(input.player.id, "offset-medium", input.absoluteBeat, profile.mediumPeriodBeats);
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
  const difficultyDrag = difficultyPressure * (0.1 + disposition.caution * 0.12);
  const difficultyPush = leapPressure * disposition.disruption * 0.08;
  const rawOffset = (
    longCycle * 0.38
    + mediumCycle * 0.26
    + eventStep
    + durationPressure
    + velocityPressure
    + difficultyDrag
    - difficultyPush
  ) * dispositionPressure;
  const maximumOffsetBeats = profile.maximumOffsetBeats;
  const performedOffsetBeats = roundOffset(clamp(
    rawOffset * maximumOffsetBeats,
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
      leapPressure,
      registerPressure,
      densityPressure,
    },
    summary: summarizeTiming(performedOffsetBeats, difficultyPressure),
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

function summarizeTiming(performedOffsetBeats: number, difficultyPressure: number): string {
  const cause = difficultyPressure >= 0.45 ? " from difficulty" : "";
  if (performedOffsetBeats <= -0.004) return `push data${cause}`;
  if (performedOffsetBeats >= 0.004) return `drag data${cause}`;
  return "near-grid data";
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
