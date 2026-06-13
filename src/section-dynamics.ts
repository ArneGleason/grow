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

export function applySectionDynamics(input: SectionDynamicsInput): SectionDynamicsDecision {
  const profile = input.profile ?? BALANCED_SECTION_DYNAMICS_PROFILE;
  const baseShouldPlay = input.baseShouldPlay ?? true;
  const baseAction = input.baseAction ?? "repeat";
  const baseVelocityMultiplier = input.baseVelocityMultiplier ?? 1;
  const baseReason = input.baseReason ?? "Keep the deterministic pattern.";
  const tags = [`section:${input.sectionType}`];

  if (input.sectionType === "chorus") {
    if (input.role === "melody") {
      return {
        action: "vary",
        shouldPlay: true,
        velocityMultiplier: Math.max(
          baseShouldPlay ? baseVelocityMultiplier : profile.chorusMelodyRestFloor,
          profile.chorusMelodyMinimum,
        ),
        tags: [...tags, "section:developed-chorus"],
        reason: `Chorus ${input.occurrence}: lifting the developed hook above taste rests.`,
      };
    }

    return {
      action: baseAction,
      shouldPlay: baseShouldPlay,
      velocityMultiplier: baseVelocityMultiplier *
        (input.role === "bass" ? profile.chorusBassMultiplier : profile.chorusSupportMultiplier),
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
        velocityMultiplier: shouldPlay ? profile.bridgePulseMultiplier : 0,
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
        velocityMultiplier: shouldPlay ? profile.bridgeBassMultiplier : 0,
        tags: [...tags, "section:sparse"],
        reason: "Bridge: bass leaves alternate bars open.",
      };
    }

    if (input.role === "melody") {
      const shouldPlay = !profile.bridgeMelodyWholeBeatsOnly || isWholeBeat(input.absoluteBeat);
      return {
        action: "contrast",
        shouldPlay,
        velocityMultiplier: shouldPlay ? profile.bridgeMelodyMultiplier : 0,
        tags: [...tags, "section:bridge-lifted-material"],
        reason: "Bridge: sparse committed melody lift answers the chorus.",
      };
    }
  }

  return {
    action: baseAction,
    shouldPlay: baseShouldPlay,
    velocityMultiplier: baseVelocityMultiplier * (input.role === "melody" ? profile.verseMelodyMultiplier : 1),
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
