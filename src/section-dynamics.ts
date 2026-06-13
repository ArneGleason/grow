export type SectionDynamicsAction = "repeat" | "support" | "contrast" | "simplify" | "vary" | "rest";

export interface SectionDynamicsInput {
  role: string;
  sectionType: "verse" | "chorus" | "bridge";
  occurrence: number;
  localBeat: number;
  localBar: number;
  absoluteBeat: number;
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

export function applySectionDynamics(input: SectionDynamicsInput): SectionDynamicsDecision {
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
        velocityMultiplier: Math.max(baseShouldPlay ? baseVelocityMultiplier : 0.92, 1.18),
        tags: [...tags, "section:developed-chorus"],
        reason: `Chorus ${input.occurrence}: lifting the developed hook above taste rests.`,
      };
    }

    return {
      action: baseAction,
      shouldPlay: baseShouldPlay,
      velocityMultiplier: baseVelocityMultiplier * (input.role === "bass" ? 1.14 : 1.08),
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
        velocityMultiplier: shouldPlay ? 0.72 : 0,
        tags: [...tags, "section:sparse"],
        reason: "Bridge: pulse marks only the bar downbeats.",
      };
    }

    if (input.role === "bass") {
      const shouldPlay = isWholeBeat(input.absoluteBeat) && input.localBar % 2 === 1;
      return {
        action: "simplify",
        shouldPlay,
        velocityMultiplier: shouldPlay ? 0.78 : 0,
        tags: [...tags, "section:sparse"],
        reason: "Bridge: bass leaves alternate bars open.",
      };
    }

    if (input.role === "melody") {
      const shouldPlay = isWholeBeat(input.absoluteBeat);
      return {
        action: "contrast",
        shouldPlay,
        velocityMultiplier: shouldPlay ? 0.82 : 0,
        tags: [...tags, "section:bridge-lifted-material"],
        reason: "Bridge: sparse committed melody lift answers the chorus.",
      };
    }
  }

  return {
    action: baseAction,
    shouldPlay: baseShouldPlay,
    velocityMultiplier: baseVelocityMultiplier * (input.role === "melody" ? 0.94 : 1),
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
