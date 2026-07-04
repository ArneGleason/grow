export type PlayerRuntimeState = "waiting" | "performing" | "thinking" | "resting";

export type PlayerRole = "pulse" | "bass" | "melody" | "texture" | "effects";

export interface WorldPoint {
  x: number;
  y: number;
}

export interface PlayerVisual {
  color: number;
  accentColor: number;
  haloRadius: number;
  bodyRadius: number;
  labelOffsetY: number;
}

export interface PlayerTasteProfile {
  densityTarget: number;
  densityTolerance: number;
  repetitionPreference: number;
  brightnessPreference: "low" | "mid" | "high";
  rhythmicStabilityPreference: number;
  noveltyPreference: number;
}

export interface PlayerDisposition {
  steadiness: number;
  disruption: number;
  caution: number;
  novelty: number;
  density: number;
  responsiveness: number;
}

export interface PlayerMemoryFragment {
  id: string;
  text: string;
  tags: string[];
}

export interface PlayerInfluencePhrase {
  id: string;
  scaleDegrees: readonly number[];
}

export interface PlayerThinkingProfile {
  // Prompt-facing identity only for now; taste remains the behavior-facing rule profile.
  disposition: PlayerDisposition;
  memoryFragments: PlayerMemoryFragment[];
  influencePhrases: readonly PlayerInfluencePhrase[];
}

export interface Player {
  id: string;
  displayName: string;
  role: PlayerRole;
  soundLabel: string;
  instrumentId: string;
  position: WorldPoint;
  visual: PlayerVisual;
  taste: PlayerTasteProfile;
  thinking: PlayerThinkingProfile;
  tags: string[];
}

export const PULSE_PLAYER: Player = {
  id: "pulse",
  displayName: "pulse",
  role: "pulse",
  soundLabel: "root pulse",
  instrumentId: "membrane-pulse",
  position: { x: 480, y: 280 },
  visual: {
    color: 0x8f1d20,
    accentColor: 0xffd6a2,
    haloRadius: 28,
    bodyRadius: 17,
    labelOffsetY: 26,
  },
  taste: {
    densityTarget: 1,
    densityTolerance: 0.55,
    repetitionPreference: 0.95,
    brightnessPreference: "low",
    rhythmicStabilityPreference: 0.95,
    noveltyPreference: 0.08,
  },
  thinking: {
    disposition: {
      steadiness: 0.96,
      disruption: 0.08,
      caution: 0.8,
      novelty: 0.12,
      density: 0.44,
      responsiveness: 0.52,
    },
    memoryFragments: [
      {
        id: "pulse-clockroom",
        text: "keeps time like a clockroom fan that never quite lines up with the wall hum",
        tags: ["steady", "repeat", "whole-beat"],
      },
      {
        id: "pulse-warm-floor",
        text: "trusts warmth under the floor more than bright gestures above it",
        tags: ["low", "support", "space"],
      },
      {
        id: "pulse-quiet-oath",
        text: "believes a missing beat should feel intentional before anything gets louder",
        tags: ["rest", "caution", "space"],
      },
    ],
    influencePhrases: [
      { id: "pulse-root-stillness", scaleDegrees: [0, 0, 0, 0, 4, 0, 0, 0] },
      { id: "pulse-low-return", scaleDegrees: [0, 4, 0, 4, 0, 6, 0, 0] },
      { id: "pulse-small-steps", scaleDegrees: [0, 1, 0, 0, 6, 0, 0, 0] },
    ],
  },
  tags: ["low", "steady", "quarter-note"],
};

export const BASS_PLAYER: Player = {
  id: "bass",
  displayName: "bass",
  role: "bass",
  soundLabel: "modal bass",
  instrumentId: "mono-bass",
  position: { x: 335, y: 350 },
  visual: {
    color: 0x2f7f8f,
    accentColor: 0xc8f7ff,
    haloRadius: 30,
    bodyRadius: 18,
    labelOffsetY: 28,
  },
  taste: {
    densityTarget: 0.8,
    densityTolerance: 0.38,
    repetitionPreference: 0.72,
    brightnessPreference: "low",
    rhythmicStabilityPreference: 0.74,
    noveltyPreference: 0.24,
  },
  thinking: {
    disposition: {
      steadiness: 0.74,
      disruption: 0.22,
      caution: 0.62,
      novelty: 0.34,
      density: 0.58,
      responsiveness: 0.78,
    },
    memoryFragments: [
      {
        id: "bass-hot-water-plant",
        text: "spent a season counting valves in a hot-water fabrication plant",
        tags: ["low", "density", "support"],
      },
      {
        id: "bass-loading-dock",
        text: "likes phrases that arrive like a pallet jack turning a tight corner",
        tags: ["mixed", "vary", "rhythm"],
      },
      {
        id: "bass-shadow-choir",
        text: "hears harmony as shadows cast by whatever the melody refuses to say",
        tags: ["support", "space", "contrast"],
      },
    ],
    influencePhrases: [
      { id: "bass-valve-count", scaleDegrees: [0, 4, 6, 4, 0, 4, 0, 0] },
      { id: "bass-shadow-turn", scaleDegrees: [0, 6, 4, 5, 4, 0, 6, 0] },
      { id: "bass-corner-answer", scaleDegrees: [0, 3, 4, 0, 6, 5, 4, 0] },
    ],
  },
  tags: ["low", "support", "modal"],
};

export const KEYBOARD_PLAYER: Player = {
  id: "keyboard",
  displayName: "keyboard",
  role: "texture",
  soundLabel: "voice-led chords",
  instrumentId: "soft-keyboard",
  position: { x: 505, y: 420 },
  visual: {
    color: 0x5f6fb8,
    accentColor: 0xdfe5ff,
    haloRadius: 31,
    bodyRadius: 18,
    labelOffsetY: 28,
  },
  taste: {
    densityTarget: 0.62,
    densityTolerance: 0.3,
    repetitionPreference: 0.82,
    brightnessPreference: "mid",
    rhythmicStabilityPreference: 0.82,
    noveltyPreference: 0.28,
  },
  thinking: {
    disposition: {
      steadiness: 0.82,
      disruption: 0.14,
      caution: 0.7,
      novelty: 0.26,
      density: 0.42,
      responsiveness: 0.58,
    },
    memoryFragments: [
      {
        id: "keyboard-parlor-hammers",
        text: "keeps old parlor-piano hammers wrapped in felt so the vocal has a room",
        tags: ["mid", "support", "chords"],
      },
      {
        id: "keyboard-window-chords",
        text: "likes chords that move like light crossing a kitchen window",
        tags: ["harmony", "motion", "warm"],
      },
      {
        id: "keyboard-left-hand-oath",
        text: "promises the left hand will not compete with a bass that already knows the floor",
        tags: ["space", "support", "caution"],
      },
    ],
    influencePhrases: [
      { id: "keyboard-close-voice", scaleDegrees: [0, 2, 4, 2, 5, 4, 1, 0] },
      { id: "keyboard-suspended-window", scaleDegrees: [0, 3, 4, 6, 5, 3, 4, 0] },
      { id: "keyboard-gentle-turn", scaleDegrees: [2, 4, 3, 1, 2, 5, 4, 0] },
    ],
  },
  tags: ["mid", "support", "chords"],
};

export const MELODY_PLAYER: Player = {
  id: "melody",
  displayName: "melody",
  role: "melody",
  soundLabel: "modal line",
  instrumentId: "simple-melody",
  position: { x: 625, y: 220 },
  visual: {
    color: 0xd5ae3c,
    accentColor: 0xfff1a6,
    haloRadius: 26,
    bodyRadius: 15,
    labelOffsetY: 25,
  },
  taste: {
    densityTarget: 0.85,
    densityTolerance: 0.32,
    repetitionPreference: 0.42,
    brightnessPreference: "high",
    rhythmicStabilityPreference: 0.58,
    noveltyPreference: 0.58,
  },
  thinking: {
    disposition: {
      steadiness: 0.46,
      disruption: 0.36,
      caution: 0.34,
      novelty: 0.72,
      density: 0.64,
      responsiveness: 0.66,
    },
    memoryFragments: [
      {
        id: "melody-elevator-chimes",
        text: "learned contour from broken elevator chimes in a glass atrium",
        tags: ["bright", "rising", "vary"],
      },
      {
        id: "melody-storm-window",
        text: "likes storms because they hide uneven rhythm inside a steady room",
        tags: ["mixed", "disruption", "rhythm"],
      },
      {
        id: "melody-paper-lantern",
        text: "keeps a paper-lantern tune for moments when the band gets too crowded",
        tags: ["rest", "space", "high"],
      },
    ],
    influencePhrases: [
      { id: "melody-elevator-contour", scaleDegrees: [2, 4, 5, 4, 1, 0, 2, 4] },
      { id: "melody-lantern-hook", scaleDegrees: [4, 6, 4, 2, 0, 2, 5, 4] },
      { id: "melody-storm-answer", scaleDegrees: [5, 4, 2, 3, 5, 6, 4, 2] },
    ],
  },
  tags: ["mid", "motif", "modal"],
};

export const PLAYER_REGISTRY: readonly Player[] = [
  PULSE_PLAYER,
  BASS_PLAYER,
  KEYBOARD_PLAYER,
  MELODY_PLAYER,
];

export function getPlayerById(playerId: string): Player | undefined {
  return PLAYER_REGISTRY.find((player) => player.id === playerId);
}
