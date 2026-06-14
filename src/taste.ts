import type { ListeningFrame } from "./listening";
import type { Player, PlayerRole, PlayerTasteProfile } from "./players";

export type TasteAction = "repeat" | "support" | "contrast" | "simplify" | "vary" | "rest";

export type BrightnessPreference = "low" | "mid" | "high";

export interface PlayerTasteEvaluation {
  playerId: string;
  role: PlayerRole;
  action: TasteAction;
  actionSinceBeat: number;
  affinity: number;
  summary: string;
  reasons: string[];
  metrics: {
    playerDensity: number;
    ensembleDensity: number;
    silenceRatio: number;
    brightness: number;
    pitchVariety: number;
    rhythmicStability: number;
  };
  updatedAtBeat: number;
}

export interface TasteNoteDecisionInput {
  playerId: string;
  role: PlayerRole;
  pitch: string;
  absoluteBeat: number;
  velocity: number;
}

export interface TasteNoteDecision {
  action: TasteAction;
  shouldPlay: boolean;
  velocityMultiplier: number;
  pitch?: string;
  tags?: string[];
  reason: string;
}

const DEFAULT_DECISION: TasteNoteDecision = {
  action: "repeat",
  shouldPlay: true,
  velocityMultiplier: 1,
  reason: "No taste evaluation yet; keep the deterministic pattern.",
};

export interface GoalTasteSource {
  id: string;
  surpriseTarget: number;
  dispositionBias: Partial<Record<PlayerRole, number>>;
}

const MIN_ACTION_DWELL_BEATS = 4;
const BASELINE_GOAL_SURPRISE = 0.42;

export function createGoalTasteProfile(
  baseProfile: PlayerTasteProfile,
  playerRole: PlayerRole,
  goal: GoalTasteSource | undefined,
): PlayerTasteProfile {
  if (!goal) return baseProfile;
  const surpriseDelta = clamp(goal.surpriseTarget, 0, 1) - BASELINE_GOAL_SURPRISE;
  const roleBias = clamp(goal.dispositionBias[playerRole] ?? 0, -0.25, 0.25);
  const noveltyShift = surpriseDelta * 0.36 + Math.max(0, roleBias) * 0.16;
  const densityShift = roleBias * 0.4;
  return {
    ...baseProfile,
    densityTarget: roundTaste(clamp(baseProfile.densityTarget + densityShift, 0.1, 1.2)),
    densityTolerance: roundTaste(clamp(baseProfile.densityTolerance + Math.abs(roleBias) * 0.08, 0.18, 0.7)),
    noveltyPreference: roundTaste(clamp(baseProfile.noveltyPreference + noveltyShift, 0, 1)),
    repetitionPreference: roundTaste(clamp(baseProfile.repetitionPreference - noveltyShift * 0.72, 0, 1)),
  };
}

export function createInitialTasteEvaluation(player: Player): PlayerTasteEvaluation {
  return {
    playerId: player.id,
    role: player.role,
    action: "repeat",
    actionSinceBeat: 0,
    affinity: 0.5,
    summary: "Listening for a shape.",
    reasons: ["No recent listening frame yet."],
    metrics: {
      playerDensity: 0,
      ensembleDensity: 0,
      silenceRatio: 1,
      brightness: 0,
      pitchVariety: 0,
      rhythmicStability: 0.5,
    },
    updatedAtBeat: 0,
  };
}

export function evaluatePlayerTaste(
  player: Player,
  frame: ListeningFrame,
  previousEvaluation?: PlayerTasteEvaluation,
): PlayerTasteEvaluation {
  if (frame.eventCount === 0) {
    return {
      ...createInitialTasteEvaluation(player),
      updatedAtBeat: frame.timeWindow.toBeat,
    };
  }

  const framePlayer = frame.players.find((candidate) => candidate.id === player.id);
  const playerEvents = framePlayer?.recentEvents.filter((event) => event.kind === "note") ?? [];
  const playerDensity = framePlayer?.density ?? 0;
  const ensembleDensity = frame.mix.transientDensity;
  const silenceRatio = frame.mix.silenceRatio;
  const brightness = frame.mix.brightness;
  const pitchVariety = calculatePitchVariety(playerEvents, frame.tonalContext.scale.length);
  const rhythmicStability = calculateRhythmicStability(playerEvents);
  const action = chooseAction({
    player,
    playerDensity,
    ensembleDensity,
    silenceRatio,
    brightness,
    pitchVariety,
    rhythmicStability,
  });
  const affinity = calculateAffinity({
    profile: player.taste,
    playerDensity,
    brightness,
    pitchVariety,
    rhythmicStability,
  });

  const candidate: PlayerTasteEvaluation = {
    playerId: player.id,
    role: player.role,
    action,
    actionSinceBeat: frame.timeWindow.toBeat,
    affinity,
    summary: summarizeAction(action, player, {
      ensembleDensity,
      silenceRatio,
      pitchVariety,
      rhythmicStability,
    }),
    reasons: buildReasons(player, action, {
      playerDensity,
      ensembleDensity,
      silenceRatio,
      brightness,
      pitchVariety,
      rhythmicStability,
    }),
    metrics: {
      playerDensity,
      ensembleDensity,
      silenceRatio,
      brightness,
      pitchVariety,
      rhythmicStability,
    },
    updatedAtBeat: frame.timeWindow.toBeat,
  };

  return stabilizeAction(candidate, previousEvaluation);
}

export function decideNoteFromTaste(
  evaluation: PlayerTasteEvaluation | undefined,
  input: TasteNoteDecisionInput,
): TasteNoteDecision {
  if (!evaluation) return DEFAULT_DECISION;

  switch (evaluation.action) {
    case "rest": {
      const shouldRest = input.role === "melody" && !isWholeBeat(input.absoluteBeat);
      return shouldRest
        ? {
          action: "rest",
          shouldPlay: false,
          velocityMultiplier: 0,
          reason: "Making room because the recent frame is crowded.",
        }
        : {
          action: "rest",
          shouldPlay: true,
          velocityMultiplier: 0.82,
          reason: "Playing only the grounded notes while making room.",
        };
    }
    case "simplify": {
      const shouldDrop = input.role !== "pulse" && !isWholeBeat(input.absoluteBeat);
      return shouldDrop
        ? {
          action: "simplify",
          shouldPlay: false,
          velocityMultiplier: 0,
          reason: "Skipping an offbeat to thin the texture.",
        }
        : {
          action: "simplify",
          shouldPlay: true,
          velocityMultiplier: 0.88,
          reason: "Keeping the line quieter and plainer.",
        };
    }
    case "support":
      return {
        action: "support",
        shouldPlay: true,
        velocityMultiplier: input.role === "bass" ? 1.08 : 1.02,
        reason: "Leaning in to support a sparse frame.",
      };
    case "contrast":
      return {
        action: "contrast",
        shouldPlay: true,
        velocityMultiplier: input.role === "melody" ? 1.06 : 0.96,
        reason: "Adding a little contrast against the current balance.",
      };
    case "vary":
      return {
        action: "vary",
        shouldPlay: true,
        velocityMultiplier: isWholeBeat(input.absoluteBeat) ? 1.08 : 0.94,
        reason: "Keeping the pattern but nudging the accents.",
      };
    case "repeat":
      return {
        action: "repeat",
        shouldPlay: true,
        velocityMultiplier: 1,
        reason: "The current fit is comfortable; repeat the part.",
      };
  }
}

function chooseAction(input: {
  player: Player;
  playerDensity: number;
  ensembleDensity: number;
  silenceRatio: number;
  brightness: number;
  pitchVariety: number;
  rhythmicStability: number;
}): TasteAction {
  const { player } = input;

  if (player.role === "pulse") return "repeat";

  if (
    player.role === "melody" &&
    input.playerDensity > 0 &&
    input.ensembleDensity > player.taste.densityTarget + player.taste.densityTolerance &&
    input.silenceRatio < 0.22
  ) {
    return "rest";
  }

  if (input.playerDensity > player.taste.densityTarget + player.taste.densityTolerance) {
    return "simplify";
  }

  if (input.playerDensity < player.taste.densityTarget - player.taste.densityTolerance) {
    return "support";
  }

  if (
    input.pitchVariety < player.taste.noveltyPreference * 0.75 ||
    1 - input.pitchVariety > player.taste.repetitionPreference + 0.25
  ) {
    return "vary";
  }

  if (brightnessDistance(input.brightness, player.taste.brightnessPreference) > 0.45) {
    return "contrast";
  }

  return "repeat";
}

function stabilizeAction(
  candidate: PlayerTasteEvaluation,
  previousEvaluation: PlayerTasteEvaluation | undefined,
): PlayerTasteEvaluation {
  if (previousEvaluation && isInitialEvaluation(previousEvaluation)) {
    return {
      ...candidate,
      actionSinceBeat: candidate.updatedAtBeat,
    };
  }

  if (!previousEvaluation || previousEvaluation.action === candidate.action) {
    return {
      ...candidate,
      actionSinceBeat: previousEvaluation?.actionSinceBeat ?? candidate.updatedAtBeat,
    };
  }

  const actionAgeBeats = candidate.updatedAtBeat - previousEvaluation.actionSinceBeat;
  if (actionAgeBeats >= MIN_ACTION_DWELL_BEATS) {
    return {
      ...candidate,
      actionSinceBeat: candidate.updatedAtBeat,
    };
  }

  return {
    ...candidate,
    action: previousEvaluation.action,
    actionSinceBeat: previousEvaluation.actionSinceBeat,
    summary: `Holding ${previousEvaluation.action} for phrasing before ${candidate.action}.`,
    reasons: [
      ...candidate.reasons,
      `held ${previousEvaluation.action} for ${Math.max(0, actionAgeBeats).toFixed(1)} of ${MIN_ACTION_DWELL_BEATS} beats`,
    ],
  };
}

function isInitialEvaluation(evaluation: PlayerTasteEvaluation): boolean {
  return evaluation.summary === "Listening for a shape.";
}

function calculateAffinity(input: {
  profile: PlayerTasteProfile;
  playerDensity: number;
  brightness: number;
  pitchVariety: number;
  rhythmicStability: number;
}): number {
  const densityFit = 1 - Math.min(1, Math.abs(input.playerDensity - input.profile.densityTarget));
  const brightnessFit = 1 - brightnessDistance(input.brightness, input.profile.brightnessPreference);
  const noveltyFit = 1 - Math.min(1, Math.abs(input.pitchVariety - input.profile.noveltyPreference));
  const repetitionFit = 1 - Math.min(
    1,
    Math.abs((1 - input.pitchVariety) - input.profile.repetitionPreference),
  );
  const stabilityFit = 1 - Math.min(
    1,
    Math.abs(input.rhythmicStability - input.profile.rhythmicStabilityPreference),
  );

  return clamp01((densityFit + brightnessFit + noveltyFit + repetitionFit + stabilityFit) / 5);
}

function calculatePitchVariety(events: readonly { pitch?: string }[], scaleLength: number): number {
  if (events.length === 0 || scaleLength === 0) return 0;
  const pitchClasses = new Set(
    events
      .map((event) => event.pitch?.replace(/[0-9-]+$/, ""))
      .filter((pitchClass): pitchClass is string => Boolean(pitchClass)),
  );

  return clamp01(pitchClasses.size / scaleLength);
}

function calculateRhythmicStability(events: readonly { absoluteBeat: number }[]): number {
  if (events.length < 2) return 0.5;
  const offsets = new Set(events.map((event) => (event.absoluteBeat % 1).toFixed(2)));

  return clamp01(1 - (offsets.size - 1) / 4);
}

function summarizeAction(
  action: TasteAction,
  player: Player,
  metrics: {
    ensembleDensity: number;
    silenceRatio: number;
    pitchVariety: number;
    rhythmicStability: number;
  },
): string {
  switch (action) {
    case "rest":
      return "Hearing crowding; leaving space between grounded notes.";
    case "simplify":
      return "The part feels busy; thinning the offbeats.";
    case "support":
      return "The room feels open; leaning in to hold it together.";
    case "contrast":
      return "The balance feels tilted; adding a small counterweight.";
    case "vary":
      return "The pattern feels too familiar; nudging accents for interest.";
    case "repeat":
      return player.role === "pulse"
        ? "Keeping the common pulse steady."
        : `Comfortable with density ${metrics.ensembleDensity.toFixed(2)} and silence ${metrics.silenceRatio.toFixed(2)}.`;
  }
}

function buildReasons(
  player: Player,
  action: TasteAction,
  metrics: {
    playerDensity: number;
    ensembleDensity: number;
    silenceRatio: number;
    brightness: number;
    pitchVariety: number;
    rhythmicStability: number;
  },
): string[] {
  const reasons = [
    `density ${metrics.playerDensity.toFixed(2)} vs target ${player.taste.densityTarget.toFixed(2)}`,
    `ensemble density ${metrics.ensembleDensity.toFixed(2)}`,
    `silence ${metrics.silenceRatio.toFixed(2)}`,
    `pitch variety ${metrics.pitchVariety.toFixed(2)}`,
    `repetition ${(1 - metrics.pitchVariety).toFixed(2)} vs taste ${player.taste.repetitionPreference.toFixed(2)}`,
  ];

  if (action === "repeat") {
    reasons.push(`rhythmic stability ${metrics.rhythmicStability.toFixed(2)}`);
  } else if (action === "contrast") {
    reasons.push(`brightness ${metrics.brightness.toFixed(2)} vs ${player.taste.brightnessPreference}`);
  } else {
    reasons.push(`action ${action} chosen from current fit`);
  }

  return reasons;
}

function brightnessDistance(brightness: number, preference: BrightnessPreference): number {
  const target = preference === "low" ? 0.18 : preference === "mid" ? 0.5 : 0.82;
  return Math.min(1, Math.abs(brightness - target));
}

function isWholeBeat(beat: number): boolean {
  return Math.abs(beat - Math.round(beat)) < 0.000001;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTaste(value: number): number {
  return Math.round(value * 1000) / 1000;
}
