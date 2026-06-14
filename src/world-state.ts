import {
  type ListeningFrame,
  type ListeningFramePlayerSource,
  type MusicalEvent,
  MusicalEventLedger,
  type TonalContext,
} from "./listening";
import { RECENT_ACTIVITY_WINDOW_BEATS } from "./music-time";
import type { Player, PlayerRuntimeState, PlayerTasteProfile } from "./players";
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
  type ThoughtRequestLevel,
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
  private readonly thinkingPlayerIds = new Set<string>();
  private sessionMode = DEFAULT_SESSION_MODE;
  private tonalContext: TonalContext;

  constructor(
    private readonly players: readonly Player[],
    tonalContext: TonalContext = DEFAULT_TONAL_CONTEXT,
  ) {
    this.tonalContext = cloneTonalContext(tonalContext);
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

  setPlayerThinking(playerId: string, thinking: boolean): void {
    if (!this.playerStates.has(playerId)) return;
    if (thinking) {
      this.thinkingPlayerIds.add(playerId);
    } else {
      this.thinkingPlayerIds.delete(playerId);
    }
  }

  clearThinkingPlayers(): void {
    this.thinkingPlayerIds.clear();
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
      disposition: player.thinking.disposition,
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

  syncTasteEvaluations(
    frame: ListeningFrame,
    options: {
      getTasteProfile?: (player: Player) => PlayerTasteProfile;
    } = {},
  ): void {
    for (const player of this.players) {
      const tasteProfile = options.getTasteProfile?.(player) ?? player.taste;
      const tastePlayer = tasteProfile === player.taste
        ? player
        : { ...player, taste: tasteProfile };
      this.tasteEvaluations.set(
        player.id,
        evaluatePlayerTaste(tastePlayer, frame, this.tasteEvaluations.get(player.id)),
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

  getThoughtRequests(
    frame: ListeningFrame,
    options: {
      requestLevel?: ThoughtRequestLevel;
      horizonBeats?: number;
    } = {},
  ): readonly PlayerThoughtRequest[] {
    return this.getThoughtSeeds(frame).map((seed) => createPlayerThoughtRequest(seed, options));
  }

  getMockThoughtIntents(
    frame: ListeningFrame,
    requests: readonly PlayerThoughtRequest[] = this.getThoughtRequests(frame),
  ): readonly PlayerThoughtIntent[] {
    return requests.map((request) => createMockThoughtIntent(request));
  }

  getTonalContext(): TonalContext {
    return cloneTonalContext(this.tonalContext);
  }

  setTonalContext(tonalContext: TonalContext): void {
    this.tonalContext = cloneTonalContext(tonalContext);
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
    if (this.thinkingPlayerIds.has(playerId)) return "thinking";

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

function cloneTonalContext(tonalContext: TonalContext): TonalContext {
  return {
    ...tonalContext,
    scale: [...tonalContext.scale],
  };
}
