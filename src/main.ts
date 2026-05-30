import "./style.css";
import { createTerrariumView, type TerrariumView } from "./terrarium";
import {
  getState,
  initTransport,
  startTransport,
  stopTransport,
  type GrowTransportState,
} from "./transport";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const app = requireElement<HTMLDivElement>("#app");

app.innerHTML = `
  <section class="app-shell" aria-label="Grow Byte 1">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand__title">Grow</h1>
        <p class="brand__subtitle">Byte 1: one pulse player in a bounded terrarium</p>
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
        <h2>Player</h2>
        <dl>
          <dt>Name</dt>
          <dd data-testid="player-name">pulse</dd>
          <dt>Role</dt>
          <dd data-testid="player-role">pulse</dd>
          <dt>Sound</dt>
          <dd data-testid="player-sound">C2 beat</dd>
          <dt>State</dt>
          <dd data-testid="player-state">waiting</dd>
        </dl>
      </aside>
    </section>
  </section>
`;

const container = requireElement<HTMLDivElement>("#terrarium-container");
const button = requireElement<HTMLButtonElement>("#transport-toggle");
const status = requireElement<HTMLOutputElement>("#transport-status");
const playerState = requireElement<HTMLElement>("[data-testid='player-state']");

let terrarium: TerrariumView | null = null;

function renderStatus(state: GrowTransportState = getState()): void {
  button.textContent = state.status === "playing" ? "Stop" : "Start";
  status.value = `${state.status} | ${state.bpm} BPM | bar ${state.bar} | scheduled ${state.scheduledEventCount}`;
  playerState.textContent = state.status === "playing" ? "performing" : "waiting";
  terrarium?.setPlaying(state.status === "playing");
}

initTransport(renderStatus);
renderStatus();

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
    renderStatus();
    button.disabled = false;
    button.focus();
  }
});

terrarium = await createTerrariumView(container);
renderStatus();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    terrarium?.destroy();
    terrarium = null;
  });
}
