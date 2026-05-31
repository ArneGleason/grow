import {
  type ListeningFrame,
  type ListeningFramePlayerSource,
  type MusicalEvent,
  MusicalEventLedger,
  type TonalContext,
} from "./listening";
import { RECENT_ACTIVITY_WINDOW_BEATS } from "./music-time";
import type { Player, PlayerRuntimeState } from "./players";
import { DEFAULT_SESSION_MODE, type SessionMode } from "./session-mode";
import {
  createInitialTasteEvaluation,
  decideNoteFromTaste,
  evaluatePlayerTaste,
  type PlayerTasteEvaluation,
  type TasteNoteDecision,
  type TasteNoteDecisionInput,
} from "./taste";
import {
  createMockThoughtIntent,
  createPlayerThoughtRequest,
  type PlayerThoughtIntent,
  type PlayerThoughtRequest,
} from "./thought-protocol";
import { createPlayerThoughtSeed, type PlayerThoughtSeed } from "./thought-seeds";
import { DEFAULT_TONAL_CONTEXT } from "./tonal-context";

type TransportStatus = "playing" | "stopped";

export interface RuntimePlayer {
  player: Player;
  state: PlayerRuntimeState;
}

export class GrowWorldState {
  private readonly playerStates = new Map<string, PlayerRuntimeState>();
  private readonly tasteEvaluations = new Map<string, PlayerTasteEvaluation>();
  private readonly eventLedger = new MusicalEventLedger();
  private sessionMode = DEFAULT_SESSION_MODE;

  constructor(
    private readonly players: readonly Player[],
    private readonly tonalContext: TonalContext = DEFAULT_TONAL_CONTEXT,
  ) {
    for (const player of players) {
      this.playerStates.set(player.id, "waiting");
      this.tasteEvaluations.set(player.id, createInitialTasteEvaluation(player));
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

  resetTasteEvaluations(): void {
    for (const player of this.players) {
      this.tasteEvaluations.set(player.id, createInitialTasteEvaluation(player));
    }
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

  syncTasteEvaluations(frame: ListeningFrame): void {
    for (const player of this.players) {
      this.tasteEvaluations.set(
        player.id,
        evaluatePlayerTaste(player, frame, this.tasteEvaluations.get(player.id)),
      );
    }
  }

  getTasteEvaluations(): readonly PlayerTasteEvaluation[] {
    return this.players.map((player) => (
      this.tasteEvaluations.get(player.id) ?? createInitialTasteEvaluation(player)
    ));
  }

  getTasteEvaluation(playerId: string): PlayerTasteEvaluation | undefined {
    return this.tasteEvaluations.get(playerId);
  }

  getTasteNoteDecision(input: TasteNoteDecisionInput): TasteNoteDecision {
    return decideNoteFromTaste(this.getTasteEvaluation(input.playerId), input);
  }

  getThoughtSeeds(frame: ListeningFrame): readonly PlayerThoughtSeed[] {
    return this.players.map((player) => createPlayerThoughtSeed(
      player,
      frame,
      this.getTasteEvaluation(player.id) ?? createInitialTasteEvaluation(player),
    ));
  }

  getThoughtRequests(frame: ListeningFrame): readonly PlayerThoughtRequest[] {
    return this.getThoughtSeeds(frame).map((seed) => createPlayerThoughtRequest(seed));
  }

  getMockThoughtIntents(
    frame: ListeningFrame,
    requests: readonly PlayerThoughtRequest[] = this.getThoughtRequests(frame),
  ): readonly PlayerThoughtIntent[] {
    return requests.map((request) => createMockThoughtIntent(request));
  }

  getTonalContext(): TonalContext {
    return this.tonalContext;
  }

  getSessionMode(): SessionMode {
    return this.sessionMode;
  }

  setSessionMode(mode: SessionMode): void {
    this.sessionMode = mode;
  }

  private derivePlayerState(
    playerId: string,
    status: TransportStatus,
    currentBeat: number,
  ): PlayerRuntimeState {
    if (status === "stopped") return "waiting";

    const recentEvent = this.findLatestNoteEventForPlayer(playerId);
    if (!recentEvent) return "resting";

    const windowStart = Math.max(0, currentBeat - RECENT_ACTIVITY_WINDOW_BEATS);
    return recentEvent.absoluteBeat >= windowStart ? "performing" : "resting";
  }

  private findLatestNoteEventForPlayer(playerId: string): MusicalEvent | undefined {
    const events = this.eventLedger.getEvents();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.playerId === playerId && event.kind === "note") {
        return event;
      }
    }
    return undefined;
  }
}
