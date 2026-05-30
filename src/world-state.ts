import {
  type ListeningFrame,
  type ListeningFramePlayerSource,
  type MusicalEvent,
  MusicalEventLedger,
} from "./listening";
import type { Player, PlayerRuntimeState } from "./players";

export interface RuntimePlayer {
  player: Player;
  state: PlayerRuntimeState;
}

export class GrowWorldState {
  private readonly playerStates = new Map<string, PlayerRuntimeState>();
  private readonly eventLedger = new MusicalEventLedger();

  constructor(private readonly players: readonly Player[]) {
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

  syncPlayerStates(status: "playing" | "stopped", currentBeat: number): void {
    for (const player of this.players) {
      if (status === "stopped") {
        this.playerStates.set(player.id, "waiting");
        continue;
      }

      const recentEvent = this.findLatestEventForPlayer(player.id);
      if (!recentEvent) {
        this.playerStates.set(player.id, "resting");
        continue;
      }

      const noteEnd = recentEvent.absoluteBeat + recentEvent.durationBeats;
      const isCurrentlyPerforming =
        currentBeat >= recentEvent.absoluteBeat - 0.01 && currentBeat <= noteEnd + 0.01;
      this.playerStates.set(player.id, isCurrentlyPerforming ? "performing" : "resting");
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
  }): ListeningFrame {
    const players: ListeningFramePlayerSource[] = this.getPlayers().map(({ player, state }) => ({
      id: player.id,
      role: player.role,
      state,
      tags: player.tags,
    }));

    return this.eventLedger.createFrame({
      players,
      tempo: options.tempo,
      meter: options.meter,
      currentBeat: options.currentBeat,
    });
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
