import "./style.css";
import type { ListeningFrame, MusicalEvent } from "./listening";
import { PLAYER_REGISTRY } from "./players";
import {
  DEFAULT_SESSION_MODE,
  getSessionModeLabel,
  isSessionMode,
  SESSION_MODE_OPTIONS,
  shouldSessionModeRefillLookahead,
  type SessionMode,
  type SessionModeOption,
} from "./session-mode";
import { createTerrariumView, type TerrariumView } from "./terrarium";
import type { PlayerTasteEvaluation } from "./taste";
import type { PlayerThoughtIntent, PlayerThoughtRequest } from "./thought-protocol";
import type { PlayerThoughtSeed } from "./thought-seeds";
import {
  getState,
  initTransport,
  startTransport,
  stopTransport,
  type GrowLookaheadState,
  type GrowTransportState,
} from "./transport";
import { GrowWorldState, type RuntimePlayer } from "./world-state";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const app = requireElement<HTMLDivElement>("#app");
const world = new GrowWorldState(PLAYER_REGISTRY);
const defaultSessionModeLabel = getSessionModeLabel(DEFAULT_SESSION_MODE);
const sessionModeControls = SESSION_MODE_OPTIONS.map((mode) => `
          <label class="mode-option" data-testid="session-mode-${mode.id}-option">
            <input
              data-testid="session-mode-${mode.id}"
              name="session-mode"
              type="radio"
              value="${mode.id}"
              ${mode.id === DEFAULT_SESSION_MODE ? "checked" : ""}
            />
            <span>${mode.label}</span>
          </label>
`).join("");

app.innerHTML = `
  <section class="app-shell" aria-label="Grow Byte 9a">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand__title">Grow</h1>
        <p class="brand__subtitle">Byte 9a: thought validation hardening</p>
      </div>
      <div class="transport-controls">
        <fieldset class="mode-control" aria-label="Session mode">
          <legend>Mode</legend>
          <div class="mode-segments" data-testid="session-mode-control">
${sessionModeControls}
          </div>
        </fieldset>
        <button
          class="transport-button"
          id="transport-toggle"
          data-testid="transport-toggle"
          type="button"
        >
          Start
        </button>
        <output
          class="status-line"
          id="transport-status"
          data-testid="transport-status"
          aria-live="polite"
        ></output>
      </div>
    </header>

    <section class="stage" aria-label="Terrarium stage">
      <div class="terrarium-panel">
        <div
          class="terrarium-canvas"
          id="terrarium-container"
          data-testid="terrarium-container"
          aria-label="Bounded terrarium canvas"
        ></div>
      </div>

      <aside class="inspector" aria-label="Player inspector">
        <section class="inspector-section" aria-label="Session">
          <h2>Session</h2>
          <dl>
            <dt>Mode</dt>
            <dd data-testid="session-mode-current">${defaultSessionModeLabel}</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Players">
          <h2>Players</h2>
          <div id="player-list" data-testid="player-list"></div>
        </section>

        <section class="inspector-section" aria-label="Thought seeds">
          <h2>Thoughts</h2>
          <div id="thought-seed-list" data-testid="thought-seed-list"></div>
        </section>

        <section class="inspector-section" aria-label="Listening frame">
          <h2>Listening</h2>
          <dl>
            <dt>Tonal</dt>
            <dd data-testid="listening-tonal-context">C mixolydian</dd>
            <dt>Heard</dt>
            <dd data-testid="listening-event-count">0</dd>
            <dt>Window</dt>
            <dd data-testid="listening-window">beats 0-0</dd>
            <dt>Latest</dt>
            <dd data-testid="listening-latest-event">none</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Lookahead buffer">
          <h2>Lookahead</h2>
          <dl>
            <dt>Health</dt>
            <dd data-testid="lookahead-health">stopped</dd>
            <dt>Lead</dt>
            <dd data-testid="lookahead-lead">0.0 / 8 beats</dd>
            <dt>Through</dt>
            <dd data-testid="lookahead-through">beat 0.0</dd>
            <dt>Pending</dt>
            <dd data-testid="lookahead-pending-slots">0</dd>
          </dl>
        </section>
      </aside>
    </section>
  </section>
`;

const container = requireElement<HTMLDivElement>("#terrarium-container");
const button = requireElement<HTMLButtonElement>("#transport-toggle");
const status = requireElement<HTMLOutputElement>("#transport-status");
const sessionModeControl = requireElement<HTMLDivElement>("[data-testid='session-mode-control']");
const sessionModeCurrent = requireElement<HTMLElement>("[data-testid='session-mode-current']");
const playerList = requireElement<HTMLDivElement>("#player-list");
const thoughtSeedList = requireElement<HTMLDivElement>("#thought-seed-list");
const listeningEventCount = requireElement<HTMLElement>("[data-testid='listening-event-count']");
const listeningWindow = requireElement<HTMLElement>("[data-testid='listening-window']");
const listeningLatestEvent = requireElement<HTMLElement>("[data-testid='listening-latest-event']");
const listeningTonalContext = requireElement<HTMLElement>("[data-testid='listening-tonal-context']");
const lookaheadHealth = requireElement<HTMLElement>("[data-testid='lookahead-health']");
const lookaheadLead = requireElement<HTMLElement>("[data-testid='lookahead-lead']");
const lookaheadThrough = requireElement<HTMLElement>("[data-testid='lookahead-through']");
const lookaheadPendingSlots = requireElement<HTMLElement>("[data-testid='lookahead-pending-slots']");

let terrarium: TerrariumView | null = null;
let previousTransportStatus = getState().status;
let renderedPlayerIds = "";
let renderedThoughtSeedIds = "";
let renderFrameId: number | null = null;
const playerStateNodes = new Map<string, HTMLElement>();
const playerTasteActionNodes = new Map<string, HTMLElement>();
const playerTasteSummaryNodes = new Map<string, HTMLElement>();
const thoughtSeedFocusNodes = new Map<string, HTMLElement>();
const thoughtSeedMotifNodes = new Map<string, HTMLElement>();
const thoughtSeedFragmentsNodes = new Map<string, HTMLElement>();
const thoughtRequestNodes = new Map<string, HTMLElement>();
const thoughtIntentNodes = new Map<string, HTMLElement>();
const pendingPlayerFlashes = new Set<string>();

function createDefinition(
  term: string,
  value: string,
  testId: string,
): HTMLElement[] {
  const dt = document.createElement("dt");
  dt.textContent = term;

  const dd = document.createElement("dd");
  const valueNode = document.createElement("span");
  valueNode.dataset.testid = testId;
  valueNode.textContent = value;
  dd.append(valueNode);

  return [dt, dd];
}

function renderPlayerInspector(
  players: readonly RuntimePlayer[],
  evaluations: readonly PlayerTasteEvaluation[],
): void {
  const nextPlayerIds = players.map(({ player }) => player.id).join("|");
  const evaluationsByPlayer = new Map(evaluations.map((evaluation) => [
    evaluation.playerId,
    evaluation,
  ]));

  if (renderedPlayerIds !== nextPlayerIds) {
    playerStateNodes.clear();
    playerTasteActionNodes.clear();
    playerTasteSummaryNodes.clear();
    const cards = players.map(({ player, state }) => {
      const evaluation = evaluationsByPlayer.get(player.id);
      const card = document.createElement("article");
      card.className = "player-inspector";
      card.dataset.testid = `player-card-${player.id}`;

      const dl = document.createElement("dl");
      dl.append(
        ...createDefinition("Name", player.displayName, `player-${player.id}-name`),
        ...createDefinition("Role", player.role, `player-${player.id}-role`),
        ...createDefinition("Sound", player.soundLabel, `player-${player.id}-sound`),
        ...createDefinition("State", state, `player-${player.id}-state`),
        ...createDefinition("Taste", evaluation?.action ?? "repeat", `player-${player.id}-taste-action`),
        ...createDefinition(
          "Why",
          evaluation?.summary ?? "Listening for a shape.",
          `player-${player.id}-taste-summary`,
        ),
      );

      card.append(dl);
      const stateNode = dl.querySelector<HTMLElement>(`[data-testid='player-${player.id}-state']`);
      if (stateNode) {
        playerStateNodes.set(player.id, stateNode);
      }
      const tasteActionNode = dl.querySelector<HTMLElement>(
        `[data-testid='player-${player.id}-taste-action']`,
      );
      if (tasteActionNode) {
        playerTasteActionNodes.set(player.id, tasteActionNode);
      }
      const tasteSummaryNode = dl.querySelector<HTMLElement>(
        `[data-testid='player-${player.id}-taste-summary']`,
      );
      if (tasteSummaryNode) {
        playerTasteSummaryNodes.set(player.id, tasteSummaryNode);
      }
      return card;
    });

    playerList.replaceChildren(...cards);
    renderedPlayerIds = nextPlayerIds;
  }

  for (const { player, state } of players) {
    const stateNode = playerStateNodes.get(player.id);
    if (stateNode) {
      stateNode.textContent = state;
    }
    const evaluation = evaluationsByPlayer.get(player.id);
    const tasteActionNode = playerTasteActionNodes.get(player.id);
    if (tasteActionNode && evaluation) {
      tasteActionNode.textContent = evaluation.action;
    }
    const tasteSummaryNode = playerTasteSummaryNodes.get(player.id);
    if (tasteSummaryNode && evaluation) {
      tasteSummaryNode.textContent = evaluation.summary;
    }
  }
}

function renderThoughts(
  requests: readonly PlayerThoughtRequest[],
  intents: readonly PlayerThoughtIntent[],
): void {
  const nextPlayerIds = requests.map((request) => request.playerId).join("|");
  const intentsByPlayer = new Map(intents.map((intent) => [intent.playerId, intent]));

  if (renderedThoughtSeedIds !== nextPlayerIds) {
    thoughtSeedFocusNodes.clear();
    thoughtSeedMotifNodes.clear();
    thoughtSeedFragmentsNodes.clear();
    thoughtRequestNodes.clear();
    thoughtIntentNodes.clear();
    const cards = requests.map((request) => {
      const seed = request.seed;
      const intent = intentsByPlayer.get(seed.playerId);
      const card = document.createElement("article");
      card.className = "player-inspector";
      card.dataset.testid = `thought-seed-card-${seed.playerId}`;

      const dl = document.createElement("dl");
      dl.append(
        ...createDefinition("Player", seed.playerId, `thought-seed-${seed.playerId}-player`),
        ...createDefinition("Focus", seed.promptFocus, `thought-seed-${seed.playerId}-focus`),
        ...createDefinition("Motif", formatThoughtMotif(seed), `thought-seed-${seed.playerId}-motif`),
        ...createDefinition("Request", formatThoughtRequest(request), `thought-request-${seed.playerId}-level`),
        ...createDefinition(
          "Intent",
          intent ? formatThoughtIntent(intent) : "none",
          `thought-intent-${seed.playerId}-action`,
        ),
        ...createDefinition(
          "Memory",
          formatThoughtFragments(seed),
          `thought-seed-${seed.playerId}-fragments`,
        ),
      );

      card.append(dl);
      const focusNode = dl.querySelector<HTMLElement>(`[data-testid='thought-seed-${seed.playerId}-focus']`);
      if (focusNode) {
        thoughtSeedFocusNodes.set(seed.playerId, focusNode);
      }
      const motifNode = dl.querySelector<HTMLElement>(`[data-testid='thought-seed-${seed.playerId}-motif']`);
      if (motifNode) {
        thoughtSeedMotifNodes.set(seed.playerId, motifNode);
      }
      const fragmentsNode = dl.querySelector<HTMLElement>(
        `[data-testid='thought-seed-${seed.playerId}-fragments']`,
      );
      if (fragmentsNode) {
        thoughtSeedFragmentsNodes.set(seed.playerId, fragmentsNode);
      }
      const requestNode = dl.querySelector<HTMLElement>(`[data-testid='thought-request-${seed.playerId}-level']`);
      if (requestNode) {
        thoughtRequestNodes.set(seed.playerId, requestNode);
      }
      const intentNode = dl.querySelector<HTMLElement>(`[data-testid='thought-intent-${seed.playerId}-action']`);
      if (intentNode) {
        thoughtIntentNodes.set(seed.playerId, intentNode);
      }
      return card;
    });

    thoughtSeedList.replaceChildren(...cards);
    renderedThoughtSeedIds = nextPlayerIds;
  }

  for (const request of requests) {
    const seed = request.seed;
    const intent = intentsByPlayer.get(seed.playerId);
    const focusNode = thoughtSeedFocusNodes.get(seed.playerId);
    if (focusNode) {
      focusNode.textContent = seed.promptFocus;
    }
    const motifNode = thoughtSeedMotifNodes.get(seed.playerId);
    if (motifNode) {
      motifNode.textContent = formatThoughtMotif(seed);
    }
    const fragmentsNode = thoughtSeedFragmentsNodes.get(seed.playerId);
    if (fragmentsNode) {
      fragmentsNode.textContent = formatThoughtFragments(seed);
    }
    const requestNode = thoughtRequestNodes.get(seed.playerId);
    if (requestNode) {
      requestNode.textContent = formatThoughtRequest(request);
    }
    const intentNode = thoughtIntentNodes.get(seed.playerId);
    if (intentNode) {
      intentNode.textContent = intent ? formatThoughtIntent(intent) : "none";
    }
  }
}

function formatThoughtMotif(seed: PlayerThoughtSeed): string {
  return `${seed.recentMotif.contour}/${seed.recentMotif.rhythm}: ${seed.recentMotif.displayExcerpt}`;
}

function formatThoughtRequest(request: PlayerThoughtRequest): string {
  const stepCount = request.excerpts.reduce((sum, excerpt) => sum + excerpt.steps.length, 0);
  return `${request.requestLevel} | ${request.horizonBeats} beats | ${stepCount} steps`;
}

function formatThoughtIntent(intent: PlayerThoughtIntent): string {
  return `${intent.responseLevel}/${intent.action} | ${intent.confidence.toFixed(2)}`;
}

function formatThoughtFragments(seed: PlayerThoughtSeed): string {
  return seed.selectedFragments.map((fragment) => fragment.text).join(" | ");
}

function renderListening(frame: ListeningFrame): void {
  const latestEvent = frame.recentEvents.at(-1);
  listeningTonalContext.textContent = `${frame.tonalContext.tonic} ${frame.tonalContext.mode}`;
  listeningEventCount.textContent = String(frame.eventCount);
  listeningWindow.textContent = `beats ${frame.timeWindow.fromBeat.toFixed(1)}-${frame.timeWindow.toBeat.toFixed(1)}`;
  listeningLatestEvent.textContent = latestEvent
    ? `${latestEvent.playerId} ${latestEvent.kind} ${latestEvent.pitch ?? ""} @ ${latestEvent.transportPosition}`
    : "none";
}

function renderLookahead(lookahead: GrowLookaheadState): void {
  lookaheadHealth.textContent = lookahead.health;
  lookaheadLead.textContent = `${lookahead.leadBeats.toFixed(1)} / ${lookahead.targetBeats.toFixed(0)} beats`;
  lookaheadThrough.textContent = `beat ${lookahead.scheduledThroughBeat.toFixed(1)}`;
  lookaheadPendingSlots.textContent = String(lookahead.pendingSlotCount);
}

function renderSessionMode(): void {
  const mode = world.getSessionMode();
  sessionModeCurrent.textContent = getSessionModeLabel(mode);
  for (const input of sessionModeControl.querySelectorAll<HTMLInputElement>("input[name='session-mode']")) {
    input.checked = input.value === mode;
  }
}

function renderStatus(state: GrowTransportState): void {
  button.textContent = state.status === "playing" ? "Stop" : "Start";
  status.value = `mode ${getSessionModeLabel(state.sessionMode).toLowerCase()} | ${state.status} | ${state.bpm} BPM | bar ${state.bar} | beat ${state.currentBeat.toFixed(1)} | lookahead ${state.lookahead.health} ${state.lookahead.leadBeats.toFixed(1)}/${state.lookahead.targetBeats.toFixed(0)} | pending slots ${state.lookahead.pendingSlotCount}`;
}

function renderWorld(state: GrowTransportState = getState()): void {
  syncWorldFromTransport(state);
  renderSessionMode();
  renderStatus(state);
  renderLookahead(state.lookahead);
  const players = world.getPlayers();
  const frame = world.getListeningFrame({
    tempo: state.bpm,
    meter: [4, 4],
    currentBeat: state.currentBeat,
  });
  world.syncTasteEvaluations(frame);
  const evaluations = world.getTasteEvaluations();
  const thoughtRequests = world.getThoughtRequests(frame);
  const thoughtIntents = world.getMockThoughtIntents(frame, thoughtRequests);
  renderPlayerInspector(players, evaluations);
  renderThoughts(thoughtRequests, thoughtIntents);
  renderListening(frame);
  for (const { player, state: playerState } of players) {
    terrarium?.setPlayerState(player.id, playerState);
  }
  for (const playerId of pendingPlayerFlashes) {
    terrarium?.flashPlayer(playerId);
  }
  pendingPlayerFlashes.clear();
}

function syncWorldFromTransport(state: GrowTransportState): void {
  if (state.status === "playing" && previousTransportStatus === "stopped") {
    world.clearMusicalEvents();
    world.resetTasteEvaluations();
  }

  world.syncPlayerStates(state.status, state.currentBeat);

  if (state.status === "stopped" && previousTransportStatus === "playing") {
    world.clearMusicalEvents();
    world.resetTasteEvaluations();
    world.syncPlayerStates(state.status, state.currentBeat);
  }

  previousTransportStatus = state.status;
}

function handleTransportState(): void {
  queueRender();
}

function handleMusicalEvent(event: MusicalEvent): void {
  world.recordMusicalEvent(event);
  if (event.kind === "note") {
    pendingPlayerFlashes.add(event.playerId);
  }
  queueRender();
}

function queueRender(): void {
  if (renderFrameId !== null) return;
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    renderWorld();
  });
}

function applySessionMode(mode: SessionMode): SessionMode {
  world.setSessionMode(mode);
  renderWorld();
  return world.getSessionMode();
}

initTransport({
  tick: handleTransportState,
  musicalEvent: handleMusicalEvent,
  noteDecision: (input) => world.getTasteNoteDecision(input),
  sessionMode: () => world.getSessionMode(),
  shouldRefillLookahead: () => shouldSessionModeRefillLookahead(world.getSessionMode()),
}, {
  tonalContext: world.getTonalContext(),
});
renderWorld();

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const state = getState();
    if (state.status === "playing") {
      stopTransport();
    } else {
      await startTransport();
    }
  } catch (error) {
    console.error("[grow] transport toggle failed", error);
  } finally {
    renderWorld();
    button.disabled = false;
    button.focus();
  }
});

sessionModeControl.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "session-mode") return;
  if (!isSessionMode(input.value)) return;

  applySessionMode(input.value);
});

terrarium = await createTerrariumView(container, world.getPlayers());
renderWorld();

declare global {
  interface Window {
    listening?: {
      getFrame(): ListeningFrame;
      getEvents(): readonly MusicalEvent[];
    };
    taste?: {
      getEvaluations(): readonly PlayerTasteEvaluation[];
    };
    thinking?: {
      getSeeds(): readonly PlayerThoughtSeed[];
      getRequests(): readonly PlayerThoughtRequest[];
      getMockIntents(): readonly PlayerThoughtIntent[];
    };
    session?: {
      getMode(): SessionMode;
      getModes(): readonly SessionModeOption[];
      setMode(mode: string): SessionMode;
    };
  }
}

window.listening = {
  getFrame: () => {
    const state = getState();
    return world.getListeningFrame({
      tempo: state.bpm,
      meter: [4, 4],
      currentBeat: state.currentBeat,
      transportStatus: state.status,
    });
  },
  getEvents: () => world.getMusicalEvents(),
};

window.taste = {
  getEvaluations: () => world.getTasteEvaluations(),
};

window.thinking = {
  getSeeds: () => {
    const state = getState();
    const frame = world.getListeningFrame({
      tempo: state.bpm,
      meter: [4, 4],
      currentBeat: state.currentBeat,
      transportStatus: state.status,
    });
    return world.getThoughtSeeds(frame);
  },
  getRequests: () => {
    const state = getState();
    const frame = world.getListeningFrame({
      tempo: state.bpm,
      meter: [4, 4],
      currentBeat: state.currentBeat,
      transportStatus: state.status,
    });
    return world.getThoughtRequests(frame);
  },
  getMockIntents: () => {
    const state = getState();
    const frame = world.getListeningFrame({
      tempo: state.bpm,
      meter: [4, 4],
      currentBeat: state.currentBeat,
      transportStatus: state.status,
    });
    return world.getMockThoughtIntents(frame);
  },
};

window.session = {
  getMode: () => world.getSessionMode(),
  getModes: () => SESSION_MODE_OPTIONS,
  setMode: (mode) => {
    if (isSessionMode(mode)) {
      return applySessionMode(mode);
    }
    return world.getSessionMode();
  },
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
    }
    terrarium?.destroy();
    terrarium = null;
    window.listening = undefined;
    window.taste = undefined;
    window.thinking = undefined;
    window.session = undefined;
  });
}
