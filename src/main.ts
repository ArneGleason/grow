import "./style.css";
import type { ListeningFrame, MusicalEvent } from "./listening";
import { PLAYER_REGISTRY } from "./players";
import { createTerrariumView, type TerrariumView } from "./terrarium";
import {
  getState,
  initTransport,
  startTransport,
  stopTransport,
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

app.innerHTML = `
  <section class="app-shell" aria-label="Grow Byte 3c">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand__title">Grow</h1>
        <p class="brand__subtitle">Byte 3c: visible hits and tonal wiring</p>
      </div>
      <div class="transport-controls">
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
        <section class="inspector-section" aria-label="Players">
          <h2>Players</h2>
          <div id="player-list" data-testid="player-list"></div>
        </section>

        <section class="inspector-section" aria-label="Listening frame">
          <h2>Listening</h2>
          <dl>
            <dt>Mode</dt>
            <dd data-testid="listening-tonal-context">C mixolydian</dd>
            <dt>Events</dt>
            <dd data-testid="listening-event-count">0</dd>
            <dt>Window</dt>
            <dd data-testid="listening-window">beats 0-0</dd>
            <dt>Latest</dt>
            <dd data-testid="listening-latest-event">none</dd>
          </dl>
        </section>
      </aside>
    </section>
  </section>
`;

const container = requireElement<HTMLDivElement>("#terrarium-container");
const button = requireElement<HTMLButtonElement>("#transport-toggle");
const status = requireElement<HTMLOutputElement>("#transport-status");
const playerList = requireElement<HTMLDivElement>("#player-list");
const listeningEventCount = requireElement<HTMLElement>("[data-testid='listening-event-count']");
const listeningWindow = requireElement<HTMLElement>("[data-testid='listening-window']");
const listeningLatestEvent = requireElement<HTMLElement>("[data-testid='listening-latest-event']");
const listeningTonalContext = requireElement<HTMLElement>("[data-testid='listening-tonal-context']");

let terrarium: TerrariumView | null = null;
let previousTransportStatus = getState().status;
let renderedPlayerIds = "";
let renderFrameId: number | null = null;
const playerStateNodes = new Map<string, HTMLElement>();
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

function renderPlayerInspector(players: readonly RuntimePlayer[]): void {
  const nextPlayerIds = players.map(({ player }) => player.id).join("|");

  if (renderedPlayerIds !== nextPlayerIds) {
    playerStateNodes.clear();
    const cards = players.map(({ player, state }) => {
      const card = document.createElement("article");
      card.className = "player-inspector";
      card.dataset.testid = `player-card-${player.id}`;

      const dl = document.createElement("dl");
      dl.append(
        ...createDefinition("Name", player.displayName, `player-${player.id}-name`),
        ...createDefinition("Role", player.role, `player-${player.id}-role`),
        ...createDefinition("Sound", player.soundLabel, `player-${player.id}-sound`),
        ...createDefinition("State", state, `player-${player.id}-state`),
      );

      card.append(dl);
      const stateNode = dl.querySelector<HTMLElement>(`[data-testid='player-${player.id}-state']`);
      if (stateNode) {
        playerStateNodes.set(player.id, stateNode);
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
  }
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

function renderStatus(state: GrowTransportState): void {
  button.textContent = state.status === "playing" ? "Stop" : "Start";
  status.value = `${state.status} | ${state.bpm} BPM | bar ${state.bar} | beat ${state.currentBeat.toFixed(1)} | scheduled ${state.scheduledEventCount}`;
}

function renderWorld(state: GrowTransportState = getState()): void {
  syncWorldFromTransport(state);
  renderStatus(state);
  const players = world.getPlayers();
  renderPlayerInspector(players);
  renderListening(world.getListeningFrame({
    tempo: state.bpm,
    meter: [4, 4],
    currentBeat: state.currentBeat,
  }));
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
  }

  world.syncPlayerStates(state.status, state.currentBeat);

  if (state.status === "stopped" && previousTransportStatus === "playing") {
    world.clearMusicalEvents();
    world.syncPlayerStates(state.status, state.currentBeat);
  }

  previousTransportStatus = state.status;
}

function handleTransportState(): void {
  queueRender();
}

function handleMusicalEvent(event: MusicalEvent): void {
  world.recordMusicalEvent(event);
  pendingPlayerFlashes.add(event.playerId);
  queueRender();
}

function queueRender(): void {
  if (renderFrameId !== null) return;
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    renderWorld();
  });
}

initTransport({
  tick: handleTransportState,
  musicalEvent: handleMusicalEvent,
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

terrarium = await createTerrariumView(container, world.getPlayers());
renderWorld();

declare global {
  interface Window {
    listening?: {
      getFrame(): ListeningFrame;
      getEvents(): readonly MusicalEvent[];
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
    }
    terrarium?.destroy();
    terrarium = null;
    window.listening = undefined;
  });
}
