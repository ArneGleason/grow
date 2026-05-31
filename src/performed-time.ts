import type { Player, PlayerRole } from "./players";

export interface PlayerPerformedTimingInput {
  player: Player;
  absoluteBeat: number;
  eventIndex: number;
  durationBeats: number;
  baseVelocity: number;
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
  const rawOffset = (
    longCycle * 0.38
    + mediumCycle * 0.26
    + eventStep
    + durationPressure
    + velocityPressure
  ) * dispositionPressure;
  const maximumOffsetBeats = profile.maximumOffsetBeats;
  const performedOffsetBeats = roundOffset(clamp(
    rawOffset * maximumOffsetBeats,
    -maximumOffsetBeats,
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
    },
    summary: summarizeTiming(performedOffsetBeats),
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

function summarizeTiming(performedOffsetBeats: number): string {
  if (performedOffsetBeats <= -0.004) return "push data";
  if (performedOffsetBeats >= 0.004) return "drag data";
  return "near-grid data";
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
