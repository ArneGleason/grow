import {
  type ListeningFrame,
  type ListeningFramePlayerSource,
  type MusicalEvent,
  MusicalEventLedger,
  type TonalContext,
} from "./listening";
import type { Player, PlayerRuntimeState } from "./players";

type TransportStatus = "playing" | "stopped";

export interface RuntimePlayer {
  player: Player;
  state: PlayerRuntimeState;
}

export const DEFAULT_TONAL_CONTEXT: TonalContext = {
  tonic: "C",
  mode: "mixolydian",
  scale: ["C", "D", "E", "F", "G", "A", "Bb"],
};

const POSTURE_WINDOW_BEATS = 8;

export class GrowWorldState {
  private readonly playerStates = new Map<string, PlayerRuntimeState>();
  private readonly eventLedger = new MusicalEventLedger();

  constructor(
    private readonly players: readonly Player[],
    private readonly tonalContext: TonalContext = DEFAULT_TONAL_CONTEXT,
  ) {
    for (const player of players) {
      this.playerStates.set(player.id, "waiting");
    }
  }

  getPlayers(): readonly RuntimePlayer[] {
    return this.players.map((player) => ({
      player,
      state: this.getPlayerState(player.id),
    }));
  }

  getPlayerState(playerId: string): PlayerRuntimeState {
    return this.playerStates.get(playerId) ?? "waiting";
  }

  setPlayerState(playerId: string, state: PlayerRuntimeState): void {
    if (!this.playerStates.has(playerId)) return;
    this.playerStates.set(playerId, state);
  }

  syncPlayerStates(status: TransportStatus, currentBeat: number): void {
    for (const player of this.players) {
      this.playerStates.set(player.id, this.derivePlayerState(player.id, status, currentBeat));
    }
  }

  recordMusicalEvent(event: MusicalEvent): void {
    this.eventLedger.record(event);
  }

  clearMusicalEvents(): void {
    this.eventLedger.clear();
  }

  getMusicalEvents(): readonly MusicalEvent[] {
    return this.eventLedger.getEvents();
  }

  getListeningFrame(options: {
    tempo: number;
    meter: [number, number];
    currentBeat?: number;
    transportStatus?: TransportStatus;
  }): ListeningFrame {
    const players: ListeningFramePlayerSource[] = this.getPlayers().map(({ player, state }) => ({
      id: player.id,
      role: player.role,
      state: options.transportStatus && options.currentBeat !== undefined
        ? this.derivePlayerState(player.id, options.transportStatus, options.currentBeat)
        : state,
      tags: player.tags,
    }));

    return this.eventLedger.createFrame({
      players,
      tempo: options.tempo,
      meter: options.meter,
      tonalContext: this.tonalContext,
      currentBeat: options.currentBeat,
    });
  }

  getTonalContext(): TonalContext {
    return this.tonalContext;
  }

  private derivePlayerState(
    playerId: string,
    status: TransportStatus,
    currentBeat: number,
  ): PlayerRuntimeState {
    if (status === "stopped") return "waiting";

    const recentEvent = this.findLatestEventForPlayer(playerId);
    if (!recentEvent) return "resting";

    const windowStart = Math.max(0, currentBeat - POSTURE_WINDOW_BEATS);
    return recentEvent.absoluteBeat >= windowStart ? "performing" : "resting";
  }

  private findLatestEventForPlayer(playerId: string): MusicalEvent | undefined {
    const events = this.eventLedger.getEvents();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.playerId === playerId) {
        return event;
      }
    }
    return undefined;
  }
}
