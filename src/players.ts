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

export interface Player {
  id: string;
  displayName: string;
  role: PlayerRole;
  soundLabel: string;
  instrumentId: string;
  position: WorldPoint;
  state: PlayerRuntimeState;
  visual: PlayerVisual;
  tags: string[];
}

export const PULSE_PLAYER: Player = {
  id: "pulse",
  displayName: "pulse",
  role: "pulse",
  soundLabel: "C2 beat",
  instrumentId: "membrane-pulse",
  position: { x: 480, y: 280 },
  state: "waiting",
  visual: {
    color: 0x8f1d20,
    accentColor: 0xffd6a2,
    haloRadius: 28,
    bodyRadius: 17,
    labelOffsetY: 26,
  },
  tags: ["low", "steady", "quarter-note"],
};

export const PLAYER_REGISTRY: readonly Player[] = [PULSE_PLAYER];

export function getPlayerById(playerId: string): Player | undefined {
  return PLAYER_REGISTRY.find((player) => player.id === playerId);
}
