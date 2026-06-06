import type {
  OllamaConfig,
  OllamaHealthState,
  OllamaThoughtTestResult,
} from "./ollama";
import { runOllamaThoughtTest } from "./ollama";
import type { PlayerThoughtIntent, PlayerThoughtRequest, ValidationResult } from "./thought-protocol";
import type { GrowTransportState } from "./transport";

export type SlowThinkingStatus = "idle" | "pending" | "accepted" | "invalid" | "failed" | "discarded";

export interface SlowThinkingLoopState {
  enabled: boolean;
  playerId: string;
  status: SlowThinkingStatus;
  requestId?: string;
  startedAtBeat?: number;
  resolvedAtBeat?: number;
  intendedStartBeat?: number;
  committedStartBeat?: number;
  nextEligibleBeat: number;
  latencyMs?: number;
  provider: OllamaThoughtTestResult["provider"];
  action?: string;
  validation?: ValidationResult;
  fallbackValid?: boolean;
  retargeted?: boolean;
  message: string;
}

export interface AcceptedSlowThought {
  id: string;
  playerId: string;
  requestId: string;
  intent: PlayerThoughtIntent;
  acceptedAtBeat: number;
  intendedStartBeat: number;
  committedStartBeat: number;
  retargeted: boolean;
}

export interface SlowThinkingControllerOptions {
  playerId: string;
  intervalBeats: number;
  initialDelayBeats?: number;
  lateMarginBeats: number;
  boundaryBeats: number;
  getConfig(): OllamaConfig;
  getHealth(): OllamaHealthState;
  getRequest(playerId: string): PlayerThoughtRequest;
  setPlayerThinking(playerId: string, thinking: boolean): void;
  getTransportState(): GrowTransportState;
  onStateChange?(): void;
  onAccepted?(accepted: AcceptedSlowThought): void;
}

export class SlowThinkingController {
  private state: SlowThinkingLoopState;
  private controller: AbortController | null = null;
  private runSerial = 0;

  constructor(private readonly options: SlowThinkingControllerOptions) {
    this.state = this.createInitialState();
  }

  getState(): SlowThinkingLoopState {
    return { ...this.state };
  }

  evaluate(state: GrowTransportState = this.options.getTransportState()): void {
    if (!this.state.enabled) return;

    if (!this.canRun(state)) {
      if (this.state.status === "pending") {
        this.cancel("cancelled because playback, mode, or Ollama readiness changed");
      }
      return;
    }

    if (this.state.status === "pending") return;
    if (state.currentBeat + Number.EPSILON < this.state.nextEligibleBeat) return;

    this.start(state);
  }

  cancel(message: string, state: GrowTransportState = this.options.getTransportState()): void {
    if (!this.controller && this.state.status !== "pending") return;
    if (this.controller) {
      this.runSerial += 1;
      this.controller.abort();
      this.controller = null;
    }
    this.options.setPlayerThinking(this.state.playerId, false);
    this.state = {
      ...this.state,
      status: "discarded",
      resolvedAtBeat: state.currentBeat,
      nextEligibleBeat: state.currentBeat + this.options.intervalBeats,
      message,
    };
    this.options.onStateChange?.();
  }

  private createInitialState(): SlowThinkingLoopState {
    return {
      enabled: true,
      playerId: this.options.playerId,
      status: "idle",
      nextEligibleBeat: this.options.initialDelayBeats ?? 0,
      provider: "none",
      message: "waiting for playback and ready Ollama",
    };
  }

  private canRun(state: GrowTransportState): boolean {
    return state.status === "playing" &&
      state.sessionMode === "rehearsal" &&
      this.options.getHealth().status === "ready";
  }

  private start(state: GrowTransportState): void {
    const config = this.options.getConfig();
    const request = this.options.getRequest(this.options.playerId);
    const controller = new AbortController();
    const runId = this.runSerial + 1;
    this.runSerial = runId;
    this.controller = controller;
    this.options.setPlayerThinking(request.playerId, true);
    this.state = {
      enabled: true,
      playerId: request.playerId,
      status: "pending",
      requestId: request.id,
      startedAtBeat: state.currentBeat,
      nextEligibleBeat: state.currentBeat + this.options.intervalBeats,
      provider: "ollama",
      message: "waiting for local model",
    };
    this.options.onStateChange?.();

    void runOllamaThoughtTest(request, config, { signal: controller.signal })
      .then((result) => {
        if (runId !== this.runSerial) return;
        this.state = this.createResolvedState(request, result, this.options.getTransportState());
        const accepted = this.createAcceptedHandoff(request, result, this.state);
        if (accepted) {
          this.options.onAccepted?.(accepted);
        }
      })
      .catch((error) => {
        if (runId !== this.runSerial) return;
        this.state = {
          ...this.state,
          status: "failed",
          resolvedAtBeat: this.options.getTransportState().currentBeat,
          provider: "mock-fallback",
          fallbackValid: false,
          message: error instanceof Error ? error.message : String(error),
        };
      })
      .finally(() => {
        if (runId !== this.runSerial) return;
        this.controller = null;
        this.options.setPlayerThinking(request.playerId, false);
        this.options.onStateChange?.();
      });
  }

  private createResolvedState(
    request: PlayerThoughtRequest,
    result: OllamaThoughtTestResult,
    state: GrowTransportState,
  ): SlowThinkingLoopState {
    const baseState = {
      enabled: true,
      playerId: request.playerId,
      requestId: request.id,
      startedAtBeat: request.generatedAtBeat,
      resolvedAtBeat: state.currentBeat,
      nextEligibleBeat: Math.max(
        state.currentBeat + this.options.intervalBeats,
        request.generatedAtBeat + this.options.intervalBeats,
      ),
      latencyMs: result.latencyMs,
      provider: result.provider,
      action: result.intent?.action,
      validation: result.validation,
      fallbackValid: result.fallbackValidation?.valid,
    } satisfies Omit<SlowThinkingLoopState, "status" | "message">;

    if (result.status === "valid" && result.intent) {
      const intendedStartBeat = request.generatedAtBeat + result.intent.target.startAfterBeats;
      const isLate = intendedStartBeat <= state.currentBeat + this.options.lateMarginBeats;
      const committedStartBeat = isLate
        ? this.getNextMusicalBoundaryBeat(state.currentBeat)
        : intendedStartBeat;
      return {
        ...baseState,
        status: "accepted",
        intendedStartBeat,
        committedStartBeat,
        retargeted: isLate,
        message: isLate
          ? `validated ${result.intent.action}; retargeted after late arrival`
          : `validated ${result.intent.action}; held for future commit`,
      };
    }

    if (result.status === "invalid") {
      return {
        ...baseState,
        status: "invalid",
        message: "model parsed but validator rejected it",
      };
    }

    return {
      ...baseState,
      status: "failed",
      message: result.message,
    };
  }

  private createAcceptedHandoff(
    request: PlayerThoughtRequest,
    result: OllamaThoughtTestResult,
    state: SlowThinkingLoopState,
  ): AcceptedSlowThought | undefined {
    if (state.status !== "accepted" || !result.intent) return undefined;
    if (state.intendedStartBeat === undefined || state.committedStartBeat === undefined) return undefined;
    return {
      id: `accepted-${request.id}-${Math.round(state.committedStartBeat * 1000)}`,
      playerId: request.playerId,
      requestId: request.id,
      intent: result.intent,
      acceptedAtBeat: state.resolvedAtBeat ?? request.generatedAtBeat,
      intendedStartBeat: state.intendedStartBeat,
      committedStartBeat: state.committedStartBeat,
      retargeted: state.retargeted ?? false,
    };
  }

  private getNextMusicalBoundaryBeat(currentBeat: number): number {
    return Math.ceil((currentBeat + this.options.lateMarginBeats) / this.options.boundaryBeats) *
      this.options.boundaryBeats;
  }
}
