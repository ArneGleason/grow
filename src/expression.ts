import type { Player, PlayerRole } from "./players";

export interface PlayerExpressionInput {
  player: Player;
  absoluteBeat: number;
  eventIndex: number;
  baseVelocity: number;
  tasteVelocityMultiplier: number;
}

export interface PlayerExpressionSnapshot {
  playerId: string;
  absoluteBeat: number;
  eventIndex: number;
  velocityMultiplier: number;
  finalVelocity: number;
  modulators: {
    longCycle: number;
    mediumCycle: number;
    shortCycle: number;
    eventStep: number;
    crossCoupling: number;
  };
  summary: string;
}

interface RoleExpressionProfile {
  minimumMultiplier: number;
  maximumMultiplier: number;
  longPeriodBeats: number;
  mediumPeriodBeats: number;
  shortPeriodBeats: number;
  eventSteps: readonly number[];
  longDepth: number;
  mediumDepth: number;
  shortDepth: number;
  stepDepth: number;
  couplingDepth: number;
}

const ROLE_PROFILES: Record<PlayerRole, RoleExpressionProfile> = {
  pulse: {
    minimumMultiplier: 0.9,
    maximumMultiplier: 1.1,
    longPeriodBeats: 32,
    mediumPeriodBeats: 11,
    shortPeriodBeats: 5,
    eventSteps: [0.98, 1.02, 1, 1.04, 0.97],
    longDepth: 0.035,
    mediumDepth: 0.028,
    shortDepth: 0.018,
    stepDepth: 0.45,
    couplingDepth: 0.018,
  },
  bass: {
    minimumMultiplier: 0.84,
    maximumMultiplier: 1.16,
    longPeriodBeats: 28,
    mediumPeriodBeats: 13,
    shortPeriodBeats: 6,
    eventSteps: [1.05, 0.92, 1, 1.09, 0.96, 1.02],
    longDepth: 0.052,
    mediumDepth: 0.04,
    shortDepth: 0.024,
    stepDepth: 0.52,
    couplingDepth: 0.026,
  },
  melody: {
    minimumMultiplier: 0.8,
    maximumMultiplier: 1.22,
    longPeriodBeats: 24,
    mediumPeriodBeats: 9,
    shortPeriodBeats: 4.5,
    eventSteps: [0.9, 1.08, 0.98, 1.13, 0.94, 1.02, 1.1],
    longDepth: 0.064,
    mediumDepth: 0.052,
    shortDepth: 0.034,
    stepDepth: 0.58,
    couplingDepth: 0.032,
  },
  texture: {
    minimumMultiplier: 0.82,
    maximumMultiplier: 1.18,
    longPeriodBeats: 36,
    mediumPeriodBeats: 15,
    shortPeriodBeats: 7,
    eventSteps: [0.96, 1.04, 1, 0.93, 1.08],
    longDepth: 0.06,
    mediumDepth: 0.036,
    shortDepth: 0.02,
    stepDepth: 0.42,
    couplingDepth: 0.024,
  },
  effects: {
    minimumMultiplier: 0.78,
    maximumMultiplier: 1.24,
    longPeriodBeats: 40,
    mediumPeriodBeats: 17,
    shortPeriodBeats: 5.5,
    eventSteps: [1.08, 0.88, 1, 1.14, 0.94, 1.04],
    longDepth: 0.07,
    mediumDepth: 0.045,
    shortDepth: 0.03,
    stepDepth: 0.55,
    couplingDepth: 0.035,
  },
};

export function calculatePlayerExpression(input: PlayerExpressionInput): PlayerExpressionSnapshot {
  const profile = ROLE_PROFILES[input.player.role];
  const longCycle = cycleValue(input.player.id, "long", input.absoluteBeat, profile.longPeriodBeats);
  const mediumCycle = cycleValue(input.player.id, "medium", input.absoluteBeat, profile.mediumPeriodBeats);
  const shortCycle = cycleValue(input.player.id, "short", input.absoluteBeat, profile.shortPeriodBeats);
  const eventStep = profile.eventSteps[input.eventIndex % profile.eventSteps.length] - 1;
  const crossCoupling = longCycle * mediumCycle;
  const dispositionBreath = 0.78 + input.player.thinking.disposition.novelty * 0.24;
  const rawMultiplier = 1
    + longCycle * profile.longDepth * dispositionBreath
    + mediumCycle * profile.mediumDepth
    + shortCycle * profile.shortDepth
    + eventStep * profile.stepDepth
    + crossCoupling * profile.couplingDepth;
  const velocityMultiplier = clamp(rawMultiplier, profile.minimumMultiplier, profile.maximumMultiplier);
  const finalVelocity = clamp(
    input.baseVelocity * input.tasteVelocityMultiplier * velocityMultiplier,
    0,
    1,
  );

  return {
    playerId: input.player.id,
    absoluteBeat: input.absoluteBeat,
    eventIndex: input.eventIndex,
    velocityMultiplier,
    finalVelocity,
    modulators: {
      longCycle,
      mediumCycle,
      shortCycle,
      eventStep,
      crossCoupling,
    },
    summary: summarizeExpression(velocityMultiplier, eventStep),
  };
}

export function formatExpressionSnapshot(snapshot: PlayerExpressionSnapshot | undefined): string {
  if (!snapshot) return "waiting";
  return `x${snapshot.velocityMultiplier.toFixed(2)} -> ${snapshot.finalVelocity.toFixed(2)} (${snapshot.summary})`;
}

function summarizeExpression(velocityMultiplier: number, eventStep: number): string {
  const shape = velocityMultiplier >= 1.07
    ? "leaning in"
    : velocityMultiplier <= 0.93
      ? "pulling back"
      : "breathing";
  const step = eventStep >= 0.04
    ? "accent step"
    : eventStep <= -0.04
      ? "soft step"
      : "even step";

  return `${shape}, ${step}`;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
