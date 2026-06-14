export type SectionDynamicsAction = "repeat" | "support" | "contrast" | "simplify" | "vary" | "rest";

export interface SectionDynamicsInput {
  role: string;
  sectionType: "verse" | "chorus" | "bridge";
  occurrence: number;
  localBeat: number;
  localBar: number;
  absoluteBeat: number;
  profile?: SectionDynamicsProfile;
  baseAction?: SectionDynamicsAction;
  baseShouldPlay?: boolean;
  baseVelocityMultiplier?: number;
  baseReason?: string;
}

export interface SectionDynamicsDecision {
  action: SectionDynamicsAction;
  shouldPlay: boolean;
  velocityMultiplier: number;
  tags: readonly string[];
  reason: string;
}

export interface SectionDynamicsProfile {
  id: string;
  label: string;
  verseMultiplier: number;
  chorusMultiplier: number;
  bridgeMultiplier: number;
  chorusMelodyMinimum: number;
  chorusMelodyRestFloor: number;
  chorusBassMultiplier: number;
  chorusSupportMultiplier: number;
  verseMelodyMultiplier: number;
  bridgePulseMultiplier: number;
  bridgeBassMultiplier: number;
  bridgeMelodyMultiplier: number;
  bridgeBassOddBarsOnly: boolean;
  bridgeMelodyWholeBeatsOnly: boolean;
}

export const BALANCED_SECTION_DYNAMICS_PROFILE: SectionDynamicsProfile = {
  id: "balanced",
  label: "Balanced",
  verseMultiplier: 1,
  chorusMultiplier: 1,
  bridgeMultiplier: 1,
  chorusMelodyMinimum: 1.18,
  chorusMelodyRestFloor: 0.92,
  chorusBassMultiplier: 1.14,
  chorusSupportMultiplier: 1.08,
  verseMelodyMultiplier: 0.94,
  bridgePulseMultiplier: 0.72,
  bridgeBassMultiplier: 0.78,
  bridgeMelodyMultiplier: 0.82,
  bridgeBassOddBarsOnly: true,
  bridgeMelodyWholeBeatsOnly: true,
};

export const LIFTED_SECTION_DYNAMICS_PROFILE: SectionDynamicsProfile = {
  ...BALANCED_SECTION_DYNAMICS_PROFILE,
  id: "lifted",
  label: "Lifted",
  chorusMelodyMinimum: 1.28,
  chorusMelodyRestFloor: 1.02,
  chorusBassMultiplier: 1.2,
  chorusSupportMultiplier: 1.12,
  verseMelodyMultiplier: 0.9,
  bridgePulseMultiplier: 0.66,
  bridgeBassMultiplier: 0.7,
  bridgeMelodyMultiplier: 0.76,
};

export const BREATHING_SECTION_DYNAMICS_PROFILE: SectionDynamicsProfile = {
  ...BALANCED_SECTION_DYNAMICS_PROFILE,
  id: "breathing",
  label: "Breathing",
  chorusMelodyMinimum: 1.14,
  chorusMelodyRestFloor: 0.88,
  chorusBassMultiplier: 1.08,
  chorusSupportMultiplier: 1.03,
  verseMelodyMultiplier: 0.9,
  bridgePulseMultiplier: 0.58,
  bridgeBassMultiplier: 0.64,
  bridgeMelodyMultiplier: 0.72,
  bridgeBassOddBarsOnly: true,
  bridgeMelodyWholeBeatsOnly: true,
};

export interface GoalSectionDynamicsSource {
  id: string;
  energy: number;
  sectionEmphasis: Partial<Record<"verse" | "chorus" | "bridge", number>>;
}

export function createGoalSectionDynamicsProfile(
  baseProfile: SectionDynamicsProfile,
  goal: GoalSectionDynamicsSource | undefined,
): SectionDynamicsProfile {
  if (!goal) return baseProfile;
  const energyMultiplier = 0.86 + clamp01(goal.energy) * 0.28;
  const verseMultiplier = createGoalSectionMultiplier(goal.sectionEmphasis.verse, energyMultiplier);
  const chorusMultiplier = createGoalSectionMultiplier(goal.sectionEmphasis.chorus, energyMultiplier);
  const bridgeMultiplier = createGoalSectionMultiplier(goal.sectionEmphasis.bridge, energyMultiplier);
  return {
    ...baseProfile,
    id: `${baseProfile.id}+goal-${goal.id}`,
    label: `${baseProfile.label} + Goal`,
    verseMultiplier: roundMultiplier(baseProfile.verseMultiplier * verseMultiplier),
    chorusMultiplier: roundMultiplier(baseProfile.chorusMultiplier * chorusMultiplier),
    bridgeMultiplier: roundMultiplier(baseProfile.bridgeMultiplier * bridgeMultiplier),
  };
}

export function applySectionDynamics(input: SectionDynamicsInput): SectionDynamicsDecision {
  const profile = input.profile ?? BALANCED_SECTION_DYNAMICS_PROFILE;
  const baseShouldPlay = input.baseShouldPlay ?? true;
  const baseAction = input.baseAction ?? "repeat";
  const baseVelocityMultiplier = input.baseVelocityMultiplier ?? 1;
  const baseReason = input.baseReason ?? "Keep the deterministic pattern.";
  const tags = [`section:${input.sectionType}`];

  if (input.sectionType === "chorus") {
    if (input.role === "melody") {
      const melodyMultiplier = Math.max(
        baseShouldPlay ? baseVelocityMultiplier : profile.chorusMelodyRestFloor,
        profile.chorusMelodyMinimum,
      ) * profile.chorusMultiplier;
      return {
        action: "vary",
        shouldPlay: true,
        velocityMultiplier: melodyMultiplier,
        tags: [...tags, "section:developed-chorus"],
        reason: `Chorus ${input.occurrence}: lifting the developed hook above taste rests.`,
      };
    }

    return {
      action: baseAction,
      shouldPlay: baseShouldPlay,
      velocityMultiplier: baseVelocityMultiplier *
        (input.role === "bass" ? profile.chorusBassMultiplier : profile.chorusSupportMultiplier) *
        profile.chorusMultiplier,
      tags: [...tags, "section:full"],
      reason: `Chorus ${input.occurrence}: fuller support under the developed hook.`,
    };
  }

  if (input.sectionType === "bridge") {
    if (input.role === "pulse") {
      const shouldPlay = isBarDownbeat(input.localBeat);
      return {
        action: "simplify",
        shouldPlay,
        velocityMultiplier: shouldPlay ? profile.bridgePulseMultiplier * profile.bridgeMultiplier : 0,
        tags: [...tags, "section:sparse"],
        reason: "Bridge: pulse marks only the bar downbeats.",
      };
    }

    if (input.role === "bass") {
      const shouldPlay = isWholeBeat(input.absoluteBeat) &&
        (!profile.bridgeBassOddBarsOnly || input.localBar % 2 === 1);
      return {
        action: "simplify",
        shouldPlay,
        velocityMultiplier: shouldPlay ? profile.bridgeBassMultiplier * profile.bridgeMultiplier : 0,
        tags: [...tags, "section:sparse"],
        reason: "Bridge: bass leaves alternate bars open.",
      };
    }

    if (input.role === "melody") {
      const shouldPlay = !profile.bridgeMelodyWholeBeatsOnly || isWholeBeat(input.absoluteBeat);
      return {
        action: "contrast",
        shouldPlay,
        velocityMultiplier: shouldPlay ? profile.bridgeMelodyMultiplier * profile.bridgeMultiplier : 0,
        tags: [...tags, "section:bridge-lifted-material"],
        reason: "Bridge: sparse committed melody lift answers the chorus.",
      };
    }
  }

  return {
    action: baseAction,
    shouldPlay: baseShouldPlay,
    velocityMultiplier: baseVelocityMultiplier *
      (input.role === "melody" ? profile.verseMelodyMultiplier : 1) *
      profile.verseMultiplier,
    tags: [...tags, "section:grounded"],
    reason: input.sectionType === "verse"
      ? `Verse ${input.occurrence}: keeping the source loop grounded.`
      : baseReason,
  };
}

function isWholeBeat(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 0.000001;
}

function isBarDownbeat(localBeat: number): boolean {
  return Math.abs(localBeat % 4) < 0.000001;
}

function createGoalSectionMultiplier(
  emphasis: number | undefined,
  energyMultiplier: number,
): number {
  const emphasisMultiplier = 0.76 + clamp01(emphasis ?? 0.5) * 0.48;
  return clamp(energyMultiplier * emphasisMultiplier, 0.65, 1.35);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}
