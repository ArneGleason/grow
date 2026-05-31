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

export interface Player {
  id: string;
  displayName: string;
  role: PlayerRole;
  soundLabel: string;
  instrumentId: string;
  position: WorldPoint;
  visual: PlayerVisual;
  taste: PlayerTasteProfile;
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
  tags: ["low", "support", "modal"],
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
  tags: ["mid", "motif", "modal"],
};

export const PLAYER_REGISTRY: readonly Player[] = [
  PULSE_PLAYER,
  BASS_PLAYER,
  MELODY_PLAYER,
];

export function getPlayerById(playerId: string): Player | undefined {
  return PLAYER_REGISTRY.find((player) => player.id === playerId);
}
