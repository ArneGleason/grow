import "./style.css";
import { formatExpressionSnapshot, type PlayerExpressionSnapshot } from "./expression";
import type { ListeningFrame, ListeningFramePlayer, MusicalEvent } from "./listening";
import {
  checkOllamaHealth,
  createDefaultOllamaConfig,
  createInitialOllamaHealth,
  createInitialOllamaThoughtTest,
  createOllamaInfluenceProbePrompt,
  createOllamaSessionPrimer,
  parseOllamaThoughtResponse,
  runOllamaThoughtTest,
  type OllamaConfig,
  type OllamaHealthState,
  type OllamaThoughtParseResult,
  type OllamaThoughtTestResult,
} from "./ollama";
import {
  formatPerformedTimingSnapshot,
  type PlayerPerformedTimingSnapshot,
} from "./performed-time";
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
import {
  DEFAULT_SONG_ID,
  getSongMaterial,
  isSongId,
  SONG_MATERIALS,
  type SongId,
  type SongMaterial,
} from "./song-material";
import {
  createTerrariumView,
  type TerrariumHeatState,
  type TerrariumView,
  type TerrariumVisualState,
} from "./terrarium";
import type { PlayerTasteEvaluation } from "./taste";
import type {
  PlayerThoughtIntent,
  PlayerThoughtRequest,
  ThoughtRequestLevel,
} from "./thought-protocol";
import type { PlayerThoughtSeed } from "./thought-seeds";
import { getThoughtPromptProtocol, isThoughtPromptProtocolId } from "./thought-prompt-protocols";
import {
  getState,
  initTransport,
  refreshLookaheadSchedule,
  startTransport,
  stopTransport,
  type GrowLookaheadState,
  type GrowTransportState,
  type TimingFeelMode,
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
let ollamaConfig = createDefaultOllamaConfig();
let ollamaHealth = createInitialOllamaHealth(ollamaConfig);
let ollamaThoughtTest = createInitialOllamaThoughtTest(ollamaConfig);
let ollamaRequestInFlight = false;
let songId: SongId = DEFAULT_SONG_ID;
let timingFeelMode: TimingFeelMode = "feel";
const TIMING_FEEL_OPTIONS: Array<{ id: TimingFeelMode; label: string }> = [
  { id: "grid", label: "Grid" },
  { id: "feel", label: "Feel" },
  { id: "wide", label: "Wide" },
];
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
const songControls = SONG_MATERIALS.map((song) => `
          <label class="mode-option" data-testid="song-${song.id}-option">
            <input
              data-testid="song-${song.id}"
              name="song"
              type="radio"
              value="${song.id}"
              ${song.id === songId ? "checked" : ""}
            />
            <span>${song.label}</span>
          </label>
`).join("");
const timingFeelControls = TIMING_FEEL_OPTIONS.map((mode) => `
          <label class="mode-option" data-testid="timing-feel-${mode.id}-option">
            <input
              data-testid="timing-feel-${mode.id}"
              name="timing-feel"
              type="radio"
              value="${mode.id}"
              ${mode.id === timingFeelMode ? "checked" : ""}
            />
            <span>${mode.label}</span>
          </label>
`).join("");
const HELP_TOPICS = {
  session: {
    title: "Session",
    body: "Session mode controls the players' working posture. Song switches the deterministic material loop so your ear can reset while comparing timing feels. Right now break drains the committed lookahead queue while rehearsal, solo practice, and performance keep refilling future material.",
  },
  timing: {
    title: "Timing",
    body: "Timing feel switches the audition between square grid playback, normal deterministic pocket, and a deliberately exaggerated Wide pocket. Use Grid as a palate cleanser, then switch to Wide when you need proof that the timing layer is audible.",
  },
  ollama: {
    title: "Ollama",
    body: "Ollama is the local model boundary for slow player thoughts. Check verifies the local server and model, while Send thought runs one validated manual projected-JSON request without scheduling model output into the music. The model names scale degrees; Grow derives exact pitches.",
  },
  players: {
    title: "Players",
    body: "Players are the current musical presences. State is recent posture, Taste is the current rule decision, Dynamics heard is the last audible velocity expression, Offset queued is the committed performed-time offset, and Heat caught is how much shared agitation the player's disposition absorbs.",
  },
  thoughts: {
    title: "Thoughts",
    body: "Thoughts show the compact request ingredients each player would send to the slow creative planner: focus, motif, request level, mock intent, and selected memory fragments.",
  },
  listening: {
    title: "Listening",
    body: "Listening summarizes the recent musical event ledger. Agitation is a bounded shared heat signal from density, velocity spikes, microtiming variance, and push/drag pressure.",
  },
  lookahead: {
    title: "Lookahead",
    body: "Lookahead is the delayed-now buffer. Grow commits future note and rest slots ahead of playback so slow thinking can arrive late without blocking the transport.",
  },
} as const;

type HelpTopicId = keyof typeof HELP_TOPICS;
const DEFAULT_INSPECTOR_WIDTH = 320;
const MIN_INSPECTOR_WIDTH = 280;
const MAX_INSPECTOR_WIDTH = 560;
const MAX_INSPECTOR_WIDTH_RATIO = 0.5;
const INSPECTOR_KEYBOARD_RESIZE_STEP = 24;

function renderHelpButton(topic: HelpTopicId, label: string): string {
  return `
            <button
              class="info-button"
              data-help-topic="${topic}"
              data-testid="help-${topic}"
              type="button"
              aria-label="About ${label}"
              aria-controls="inspector-help-panel"
              aria-expanded="false"
              title="About ${label}"
            >
              <span aria-hidden="true">i</span>
            </button>
  `;
}

function isHelpTopicId(value: string): value is HelpTopicId {
  return value in HELP_TOPICS;
}

function isTimingFeelMode(value: string): value is TimingFeelMode {
  return TIMING_FEEL_OPTIONS.some((mode) => mode.id === value);
}

function getTimingFeelModeLabel(mode: TimingFeelMode): string {
  return TIMING_FEEL_OPTIONS.find((option) => option.id === mode)?.label ?? mode;
}

function getSongLabel(nextSongId: SongId): string {
  return getSongMaterial(nextSongId).label;
}

app.innerHTML = `
  <section class="app-shell" aria-label="Grow Byte 10f-b1">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand__title">Grow</h1>
        <p class="brand__subtitle">Timing feel experiment: grid, feel, wide</p>
      </div>
      <div class="transport-controls">
        <fieldset class="mode-control">
          <legend class="visually-hidden">Session mode</legend>
          <span class="mode-label" aria-hidden="true">Mode</span>
          <div class="mode-segments" data-testid="session-mode-control">
${sessionModeControls}
          </div>
        </fieldset>
        <fieldset class="mode-control song-control">
          <legend class="visually-hidden">Song material</legend>
          <span class="mode-label" aria-hidden="true">Song</span>
          <div class="mode-segments" data-testid="song-control">
${songControls}
          </div>
        </fieldset>
        <fieldset class="mode-control timing-control">
          <legend class="visually-hidden">Timing feel</legend>
          <span class="mode-label" aria-hidden="true">Timing</span>
          <div class="mode-segments" data-testid="timing-feel-control">
${timingFeelControls}
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

    <section class="stage" data-testid="stage" aria-label="Terrarium stage">
      <div class="terrarium-panel">
        <div
          class="terrarium-canvas"
          id="terrarium-container"
          data-testid="terrarium-container"
          aria-label="Bounded terrarium canvas"
        ></div>
      </div>

      <div
        class="stage-resizer"
        data-testid="stage-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        aria-controls="player-inspector"
        aria-valuemin="${MIN_INSPECTOR_WIDTH}"
        aria-valuemax="${MAX_INSPECTOR_WIDTH}"
        aria-valuenow="${DEFAULT_INSPECTOR_WIDTH}"
        tabindex="0"
      >
        <span aria-hidden="true"></span>
      </div>

      <aside
        class="inspector"
        id="player-inspector"
        data-testid="player-inspector"
        aria-label="Player inspector"
      >
        <section
          class="inspector-help-panel"
          id="inspector-help-panel"
          data-testid="inspector-help-panel"
          aria-live="polite"
          hidden
        >
          <div class="inspector-help-panel__header">
            <strong data-testid="inspector-help-title">Help</strong>
            <button
              class="help-panel-close"
              data-testid="inspector-help-close"
              type="button"
              aria-label="Hide help"
            >x</button>
          </div>
          <p data-testid="inspector-help-body"></p>
        </section>

        <section class="inspector-section" aria-label="Session">
          <div class="section-heading">
            <h2>Session</h2>
${renderHelpButton("session", "session mode")}
          </div>
          <dl>
            <dt>Mode</dt>
            <dd data-testid="session-mode-current">${defaultSessionModeLabel}</dd>
            <dt>Song</dt>
            <dd data-testid="song-current">${getSongLabel(songId)}</dd>
            <dt>Timing</dt>
            <dd data-testid="timing-feel-current">Feel</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Ollama thought probe">
          <div class="section-heading">
            <h2>Ollama</h2>
${renderHelpButton("ollama", "Ollama thought probe")}
          </div>
          <div class="ollama-controls">
            <label class="ollama-field">
              <span>Base</span>
              <input data-testid="ollama-base-url-input" type="text" autocomplete="off" />
            </label>
            <label class="ollama-field">
              <span>Model</span>
              <input data-testid="ollama-model-input" type="text" autocomplete="off" />
            </label>
            <div class="ollama-actions">
              <button class="mini-button" data-testid="ollama-health-check" type="button">Check</button>
              <button class="mini-button" data-testid="ollama-send-thought" type="button">Send thought</button>
            </div>
          </div>
          <dl>
            <dt>Health</dt>
            <dd data-testid="ollama-health-status">unknown</dd>
            <dt>Model</dt>
            <dd data-testid="ollama-model-status">unknown</dd>
            <dt>Protocol</dt>
            <dd data-testid="ollama-protocol-status">projected-json</dd>
            <dt>Latency</dt>
            <dd data-testid="ollama-latency">none</dd>
            <dt>Parse</dt>
            <dd data-testid="ollama-parse-result">idle</dd>
            <dt>Valid</dt>
            <dd data-testid="ollama-validation-result">idle</dd>
            <dt>Fallback</dt>
            <dd data-testid="ollama-fallback-status">mock ready</dd>
            <dt>Errors</dt>
            <dd data-testid="ollama-errors">none</dd>
            <dt>Primer</dt>
            <dd data-testid="ollama-primer-summary">Projected JSON intent; scaleDegree 0..scale-1 plus octave; system derives pitch/sourceStartBeat.</dd>
            <dt>Raw</dt>
            <dd><pre class="raw-response" data-testid="ollama-raw-response">none</pre></dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Players">
          <div class="section-heading">
            <h2>Players</h2>
${renderHelpButton("players", "players")}
          </div>
          <div id="player-list" data-testid="player-list"></div>
        </section>

        <section class="inspector-section" aria-label="Thought seeds">
          <div class="section-heading">
            <h2>Thoughts</h2>
${renderHelpButton("thoughts", "thoughts")}
          </div>
          <div id="thought-seed-list" data-testid="thought-seed-list"></div>
        </section>

        <section class="inspector-section" aria-label="Listening frame">
          <div class="section-heading">
            <h2>Listening</h2>
${renderHelpButton("listening", "listening frame")}
          </div>
          <dl>
            <dt>Tonal</dt>
            <dd data-testid="listening-tonal-context">C mixolydian</dd>
            <dt>Heard</dt>
            <dd data-testid="listening-event-count">0</dd>
            <dt>Window</dt>
            <dd data-testid="listening-window">beats 0-0</dd>
            <dt>Latest</dt>
            <dd data-testid="listening-latest-event">none</dd>
            <dt>Agitation</dt>
            <dd data-testid="listening-agitation">0.00</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Lookahead buffer">
          <div class="section-heading">
            <h2>Lookahead</h2>
${renderHelpButton("lookahead", "lookahead buffer")}
          </div>
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
const stage = requireElement<HTMLElement>("[data-testid='stage']");
const stageResizer = requireElement<HTMLElement>("[data-testid='stage-resizer']");
const inspector = requireElement<HTMLElement>("[data-testid='player-inspector']");
const helpPanel = requireElement<HTMLElement>("[data-testid='inspector-help-panel']");
const helpTitle = requireElement<HTMLElement>("[data-testid='inspector-help-title']");
const helpBody = requireElement<HTMLElement>("[data-testid='inspector-help-body']");
const helpCloseButton = requireElement<HTMLButtonElement>("[data-testid='inspector-help-close']");
const helpButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-help-topic]"));
const sessionModeControl = requireElement<HTMLDivElement>("[data-testid='session-mode-control']");
const sessionModeCurrent = requireElement<HTMLElement>("[data-testid='session-mode-current']");
const songControl = requireElement<HTMLDivElement>("[data-testid='song-control']");
const songCurrent = requireElement<HTMLElement>("[data-testid='song-current']");
const timingFeelControl = requireElement<HTMLDivElement>("[data-testid='timing-feel-control']");
const timingFeelCurrent = requireElement<HTMLElement>("[data-testid='timing-feel-current']");
const playerList = requireElement<HTMLDivElement>("#player-list");
const thoughtSeedList = requireElement<HTMLDivElement>("#thought-seed-list");
const ollamaBaseUrlInput = requireElement<HTMLInputElement>("[data-testid='ollama-base-url-input']");
const ollamaModelInput = requireElement<HTMLInputElement>("[data-testid='ollama-model-input']");
const ollamaHealthButton = requireElement<HTMLButtonElement>("[data-testid='ollama-health-check']");
const ollamaSendThoughtButton = requireElement<HTMLButtonElement>("[data-testid='ollama-send-thought']");
const ollamaHealthStatus = requireElement<HTMLElement>("[data-testid='ollama-health-status']");
const ollamaModelStatus = requireElement<HTMLElement>("[data-testid='ollama-model-status']");
const ollamaProtocolStatus = requireElement<HTMLElement>("[data-testid='ollama-protocol-status']");
const ollamaLatency = requireElement<HTMLElement>("[data-testid='ollama-latency']");
const ollamaParseResult = requireElement<HTMLElement>("[data-testid='ollama-parse-result']");
const ollamaValidationResult = requireElement<HTMLElement>("[data-testid='ollama-validation-result']");
const ollamaFallbackStatus = requireElement<HTMLElement>("[data-testid='ollama-fallback-status']");
const ollamaErrors = requireElement<HTMLElement>("[data-testid='ollama-errors']");
const ollamaRawResponse = requireElement<HTMLElement>("[data-testid='ollama-raw-response']");
const listeningEventCount = requireElement<HTMLElement>("[data-testid='listening-event-count']");
const listeningWindow = requireElement<HTMLElement>("[data-testid='listening-window']");
const listeningLatestEvent = requireElement<HTMLElement>("[data-testid='listening-latest-event']");
const listeningAgitation = requireElement<HTMLElement>("[data-testid='listening-agitation']");
const listeningTonalContext = requireElement<HTMLElement>("[data-testid='listening-tonal-context']");
const lookaheadHealth = requireElement<HTMLElement>("[data-testid='lookahead-health']");
const lookaheadLead = requireElement<HTMLElement>("[data-testid='lookahead-lead']");
const lookaheadThrough = requireElement<HTMLElement>("[data-testid='lookahead-through']");
const lookaheadPendingSlots = requireElement<HTMLElement>("[data-testid='lookahead-pending-slots']");

let terrarium: TerrariumView | null = null;
let activeResizePointerId: number | null = null;
let previousTransportStatus = getState().status;
let renderedPlayerIds = "";
let renderedThoughtSeedIds = "";
let renderFrameId: number | null = null;
const playerStateNodes = new Map<string, HTMLElement>();
const playerTasteActionNodes = new Map<string, HTMLElement>();
const playerTasteSummaryNodes = new Map<string, HTMLElement>();
const playerExpressionNodes = new Map<string, HTMLElement>();
const playerTimingNodes = new Map<string, HTMLElement>();
const playerContagionNodes = new Map<string, HTMLElement>();
const thoughtSeedFocusNodes = new Map<string, HTMLElement>();
const thoughtSeedMotifNodes = new Map<string, HTMLElement>();
const thoughtSeedFragmentsNodes = new Map<string, HTMLElement>();
const thoughtRequestNodes = new Map<string, HTMLElement>();
const thoughtIntentNodes = new Map<string, HTMLElement>();
const pendingPlayerFlashes = new Set<string>();

ollamaBaseUrlInput.value = ollamaConfig.baseUrl;
ollamaModelInput.value = ollamaConfig.model;

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

function showHelpTopic(topicId: HelpTopicId, sourceButton: HTMLButtonElement): void {
  const topic = HELP_TOPICS[topicId];
  const heading = sourceButton.closest(".section-heading");
  if (heading) {
    heading.insertAdjacentElement("afterend", helpPanel);
  }
  helpPanel.hidden = false;
  helpTitle.textContent = topic.title;
  helpBody.textContent = topic.body;
  for (const button of helpButtons) {
    button.setAttribute("aria-expanded", String(button.dataset.helpTopic === topicId));
  }
  requestAnimationFrame(() => {
    helpPanel.scrollIntoView({ block: "nearest" });
  });
}

function hideHelpTopic(): void {
  helpPanel.hidden = true;
  for (const button of helpButtons) {
    button.setAttribute("aria-expanded", "false");
  }
}

function getInspectorWidthBounds(): { min: number; max: number } {
  const stageWidth = stage.getBoundingClientRect().width || window.innerWidth;
  const max = Math.max(
    MIN_INSPECTOR_WIDTH,
    Math.min(MAX_INSPECTOR_WIDTH, Math.floor(stageWidth * MAX_INSPECTOR_WIDTH_RATIO)),
  );
  return { min: MIN_INSPECTOR_WIDTH, max };
}

function clampInspectorWidth(width: number): number {
  const { min, max } = getInspectorWidthBounds();
  return Math.min(max, Math.max(min, Math.round(width)));
}

function setInspectorWidth(width: number): number {
  const nextWidth = clampInspectorWidth(width);
  stage.style.setProperty("--inspector-width", `${nextWidth}px`);
  const { min, max } = getInspectorWidthBounds();
  stageResizer.setAttribute("aria-valuemin", String(min));
  stageResizer.setAttribute("aria-valuemax", String(max));
  stageResizer.setAttribute("aria-valuenow", String(nextWidth));
  return nextWidth;
}

function resizeInspectorFromClientX(clientX: number): void {
  const stageRect = stage.getBoundingClientRect();
  const resizerRect = stageResizer.getBoundingClientRect();
  setInspectorWidth(stageRect.right - clientX - resizerRect.width / 2);
}

function getCurrentInspectorWidth(): number {
  return inspector.getBoundingClientRect().width || DEFAULT_INSPECTOR_WIDTH;
}

function handleWindowResize(): void {
  setInspectorWidth(getCurrentInspectorWidth());
}

function renderPlayerInspector(
  players: readonly RuntimePlayer[],
  evaluations: readonly PlayerTasteEvaluation[],
  expressions: readonly PlayerExpressionSnapshot[],
  performedTimings: readonly PlayerPerformedTimingSnapshot[],
  framePlayers: readonly ListeningFramePlayer[],
): void {
  const nextPlayerIds = players.map(({ player }) => player.id).join("|");
  const evaluationsByPlayer = new Map(evaluations.map((evaluation) => [
    evaluation.playerId,
    evaluation,
  ]));
  const expressionsByPlayer = new Map(expressions.map((expression) => [
    expression.playerId,
    expression,
  ]));
  const timingsByPlayer = new Map(performedTimings.map((timing) => [
    timing.playerId,
    timing,
  ]));
  const framePlayersByPlayer = new Map(framePlayers.map((framePlayer) => [
    framePlayer.id,
    framePlayer,
  ]));

  if (renderedPlayerIds !== nextPlayerIds) {
    playerStateNodes.clear();
    playerTasteActionNodes.clear();
    playerTasteSummaryNodes.clear();
    playerExpressionNodes.clear();
    playerTimingNodes.clear();
    playerContagionNodes.clear();
    const cards = players.map(({ player, state }) => {
      const evaluation = evaluationsByPlayer.get(player.id);
      const expression = expressionsByPlayer.get(player.id);
      const timing = timingsByPlayer.get(player.id);
      const framePlayer = framePlayersByPlayer.get(player.id);
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
          "Dynamics heard",
          formatExpressionSnapshot(expression),
          `player-${player.id}-expression`,
        ),
        ...createDefinition(
          "Offset queued",
          formatPerformedTimingSnapshot(timing),
          `player-${player.id}-offset`,
        ),
        ...createDefinition(
          "Heat caught",
          formatPlayerContagion(framePlayer),
          `player-${player.id}-contagion`,
        ),
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
      const expressionNode = dl.querySelector<HTMLElement>(
        `[data-testid='player-${player.id}-expression']`,
      );
      if (expressionNode) {
        playerExpressionNodes.set(player.id, expressionNode);
      }
      const timingNode = dl.querySelector<HTMLElement>(
        `[data-testid='player-${player.id}-offset']`,
      );
      if (timingNode) {
        playerTimingNodes.set(player.id, timingNode);
      }
      const contagionNode = dl.querySelector<HTMLElement>(
        `[data-testid='player-${player.id}-contagion']`,
      );
      if (contagionNode) {
        playerContagionNodes.set(player.id, contagionNode);
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
    const expressionNode = playerExpressionNodes.get(player.id);
    if (expressionNode) {
      expressionNode.textContent = formatExpressionSnapshot(expressionsByPlayer.get(player.id));
    }
    const timingNode = playerTimingNodes.get(player.id);
    if (timingNode) {
      timingNode.textContent = formatPerformedTimingSnapshot(timingsByPlayer.get(player.id));
    }
    const contagionNode = playerContagionNodes.get(player.id);
    if (contagionNode) {
      contagionNode.textContent = formatPlayerContagion(framePlayersByPlayer.get(player.id));
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

function formatPlayerContagion(framePlayer: ListeningFramePlayer | undefined): string {
  if (!framePlayer) return "0.00 (quiet)";
  return `${framePlayer.contagion.level.toFixed(2)} (${framePlayer.contagion.summary})`;
}

function createTerrariumHeatState(frame: ListeningFrame): TerrariumHeatState {
  return {
    agitation: frame.mix.agitation,
    players: frame.players.map((player) => ({
      playerId: player.id,
      contagionLevel: player.contagion.level,
    })),
  };
}

function renderListening(frame: ListeningFrame): void {
  const latestEvent = frame.recentEvents.at(-1);
  listeningTonalContext.textContent = `${frame.tonalContext.tonic} ${frame.tonalContext.mode}`;
  listeningEventCount.textContent = String(frame.eventCount);
  listeningWindow.textContent = `beats ${frame.timeWindow.fromBeat.toFixed(1)}-${frame.timeWindow.toBeat.toFixed(1)}`;
  listeningLatestEvent.textContent = latestEvent
    ? `${latestEvent.playerId} ${latestEvent.kind} ${latestEvent.pitch ?? ""} @ ${latestEvent.transportPosition}`
    : "none";
  listeningAgitation.textContent = formatAgitation(frame);
}

function formatAgitation(frame: ListeningFrame): string {
  const sources = frame.mix.agitationSources;
  const sourceEntries = [
    ["density", sources.densityPressure],
    ["velocity", sources.velocitySpike],
    ["timing", sources.timingVariance],
    ["push/drag", sources.pushDragPressure],
  ] as const;
  const [dominantSource] = [...sourceEntries].sort((left, right) => right[1] - left[1])[0];
  return `${frame.mix.agitation.toFixed(2)} (${dominantSource})`;
}

function renderLookahead(lookahead: GrowLookaheadState): void {
  lookaheadHealth.textContent = lookahead.health;
  lookaheadLead.textContent = `${lookahead.leadBeats.toFixed(1)} / ${lookahead.targetBeats.toFixed(0)} beats`;
  lookaheadThrough.textContent = `beat ${lookahead.scheduledThroughBeat.toFixed(1)}`;
  lookaheadPendingSlots.textContent = String(lookahead.pendingSlotCount);
}

function renderOllama(): void {
  ollamaHealthButton.disabled = ollamaRequestInFlight;
  ollamaSendThoughtButton.disabled = ollamaRequestInFlight;
  ollamaHealthStatus.textContent = `${ollamaHealth.status}: ${ollamaHealth.message}`;
  ollamaModelStatus.textContent = `${ollamaConfig.model} @ ${ollamaConfig.baseUrl}`;
  ollamaProtocolStatus.textContent = `${ollamaConfig.promptProtocol} (${getThoughtPromptProtocol(ollamaConfig.promptProtocol).label})`;
  ollamaLatency.textContent = formatOllamaLatency(ollamaThoughtTest, ollamaHealth);
  ollamaParseResult.textContent = formatOllamaParse(ollamaThoughtTest.parse);
  ollamaValidationResult.textContent = formatOllamaValidation(ollamaThoughtTest);
  ollamaFallbackStatus.textContent = formatOllamaFallback(ollamaThoughtTest);
  ollamaErrors.textContent = formatOllamaErrors(ollamaThoughtTest);
  ollamaRawResponse.textContent = formatRawResponse(ollamaThoughtTest.rawResponse);
}

function renderSessionMode(): void {
  const mode = world.getSessionMode();
  sessionModeCurrent.textContent = getSessionModeLabel(mode);
  for (const input of sessionModeControl.querySelectorAll<HTMLInputElement>("input[name='session-mode']")) {
    input.checked = input.value === mode;
  }
  songCurrent.textContent = getSongLabel(songId);
  for (const input of songControl.querySelectorAll<HTMLInputElement>("input[name='song']")) {
    input.checked = input.value === songId;
  }
  timingFeelCurrent.textContent = getTimingFeelModeLabel(timingFeelMode);
  for (const input of timingFeelControl.querySelectorAll<HTMLInputElement>("input[name='timing-feel']")) {
    input.checked = input.value === timingFeelMode;
  }
}

function renderStatus(state: GrowTransportState): void {
  button.textContent = state.status === "playing" ? "Stop" : "Start";
  status.value = `mode ${getSessionModeLabel(state.sessionMode).toLowerCase()} | song ${getSongLabel(state.songId)} | ${state.status} | ${state.bpm} BPM | bar ${state.bar} | beat ${state.currentBeat.toFixed(1)} | lookahead ${state.lookahead.health} ${state.lookahead.leadBeats.toFixed(1)}/${state.lookahead.targetBeats.toFixed(0)} | pending slots ${state.lookahead.pendingSlotCount}`;
}

function getCurrentListeningFrame(): ListeningFrame {
  const state = getState();
  return world.getListeningFrame({
    tempo: state.bpm,
    meter: [4, 4],
    currentBeat: state.currentBeat,
    transportStatus: state.status,
  });
}

function getCurrentThoughtRequest(
  playerId = "melody",
  requestLevel: ThoughtRequestLevel = "in_song_short",
): PlayerThoughtRequest {
  const frame = getCurrentListeningFrame();
  const requests = world.getThoughtRequests(frame, {
    requestLevel,
    horizonBeats: requestLevel === "influence_probe" ? 8 : undefined,
  });
  return requests.find((request) => request.playerId === playerId) ?? requests[0];
}

function readOllamaConfigFromInputs(): OllamaConfig {
  ollamaConfig = {
    ...ollamaConfig,
    baseUrl: ollamaBaseUrlInput.value.trim() || ollamaConfig.baseUrl,
    model: ollamaModelInput.value.trim() || ollamaConfig.model,
  };
  ollamaBaseUrlInput.value = ollamaConfig.baseUrl;
  ollamaModelInput.value = ollamaConfig.model;
  return ollamaConfig;
}

function setOllamaConfig(nextConfig: Partial<OllamaConfig>): OllamaConfig {
  const promptProtocol = nextConfig.promptProtocol && isThoughtPromptProtocolId(nextConfig.promptProtocol)
    ? nextConfig.promptProtocol
    : ollamaConfig.promptProtocol;
  ollamaConfig = {
    ...ollamaConfig,
    ...nextConfig,
    promptProtocol,
  };
  ollamaBaseUrlInput.value = ollamaConfig.baseUrl;
  ollamaModelInput.value = ollamaConfig.model;
  ollamaHealth = {
    ...createInitialOllamaHealth(ollamaConfig),
    message: "Config changed; health not checked",
  };
  renderOllama();
  return ollamaConfig;
}

async function runOllamaHealthCheck(): Promise<OllamaHealthState> {
  const config = readOllamaConfigFromInputs();
  ollamaRequestInFlight = true;
  ollamaHealth = {
    ...createInitialOllamaHealth(config),
    status: "checking",
    message: "Checking local Ollama",
  };
  renderOllama();
  try {
    ollamaHealth = await checkOllamaHealth(config);
    return ollamaHealth;
  } finally {
    ollamaRequestInFlight = false;
    renderOllama();
  }
}

async function runManualOllamaThoughtTest(playerId = "melody"): Promise<OllamaThoughtTestResult> {
  const config = readOllamaConfigFromInputs();
  const request = getCurrentThoughtRequest(playerId);
  ollamaRequestInFlight = true;
  ollamaThoughtTest = {
    ...createInitialOllamaThoughtTest(config),
    status: "running",
    provider: "ollama",
    requestId: request.id,
    playerId: request.playerId,
    message: "Sending one thought request to local Ollama",
  };
  renderOllama();
  try {
    ollamaThoughtTest = await runOllamaThoughtTest(request, config);
    return ollamaThoughtTest;
  } finally {
    ollamaRequestInFlight = false;
    renderOllama();
  }
}

function getInfluenceProbePrompt(playerId = "melody"): string {
  const request = getCurrentThoughtRequest(playerId, "influence_probe");
  return createOllamaInfluenceProbePrompt(
    request,
    "a remembered influence or genre named by the player, translated into abstract transferable technique only",
  );
}

function parseManualOllamaThoughtResponse(
  rawResponse: string,
  playerId = "melody",
): OllamaThoughtParseResult {
  return parseOllamaThoughtResponse(rawResponse, getCurrentThoughtRequest(playerId));
}

function formatOllamaLatency(
  thoughtTest: OllamaThoughtTestResult,
  health: OllamaHealthState,
): string {
  if (thoughtTest.latencyMs !== undefined) return `${thoughtTest.latencyMs} ms`;
  if (health.latencyMs !== undefined) return `${health.latencyMs} ms`;
  return "none";
}

function formatOllamaParse(parse: OllamaThoughtParseResult): string {
  if (parse.status === "idle") return "idle";
  return parse.status === "ok" ? "ok" : `error (${parse.errors.length})`;
}

function formatOllamaValidation(thoughtTest: OllamaThoughtTestResult): string {
  if (thoughtTest.status === "idle") return "idle";
  if (thoughtTest.status === "running") return "running";
  return thoughtTest.validation.valid
    ? "valid"
    : `invalid (${thoughtTest.validation.errors.length})`;
}

function formatOllamaFallback(thoughtTest: OllamaThoughtTestResult): string {
  if (!thoughtTest.fallbackValidation) return "mock ready";
  return thoughtTest.fallbackValidation.valid
    ? `mock fallback valid (${thoughtTest.fallbackIntent?.action ?? "intent"})`
    : "mock fallback invalid";
}

function formatOllamaErrors(thoughtTest: OllamaThoughtTestResult): string {
  const errors = [...new Set([
    ...thoughtTest.parse.errors,
    ...thoughtTest.validation.errors,
  ])];
  return errors.length > 0 ? errors.join(" | ") : "none";
}

function formatRawResponse(rawResponse: string): string {
  if (!rawResponse.trim()) return "none";
  return rawResponse.length > 700 ? `${rawResponse.slice(0, 700)}...` : rawResponse;
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
  renderPlayerInspector(
    players,
    evaluations,
    state.expression.latest,
    state.performedTiming.latest,
    frame.players,
  );
  renderThoughts(thoughtRequests, thoughtIntents);
  renderListening(frame);
  renderOllama();
  terrarium?.setHeat(createTerrariumHeatState(frame));
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

function applySongId(nextSongId: SongId): SongId {
  songId = nextSongId;
  world.clearMusicalEvents();
  world.resetTasteEvaluations();
  refreshLookaheadSchedule();
  renderWorld();
  return songId;
}

function applyTimingFeelMode(mode: TimingFeelMode): TimingFeelMode {
  timingFeelMode = mode;
  refreshLookaheadSchedule();
  renderWorld();
  return timingFeelMode;
}

initTransport({
  tick: handleTransportState,
  musicalEvent: handleMusicalEvent,
  noteDecision: (input) => world.getTasteNoteDecision(input),
  sessionMode: () => world.getSessionMode(),
  shouldRefillLookahead: () => shouldSessionModeRefillLookahead(world.getSessionMode()),
  songId: () => songId,
  timingFeelMode: () => timingFeelMode,
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

songControl.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "song") return;
  if (!isSongId(input.value)) return;

  applySongId(input.value);
});

timingFeelControl.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "timing-feel") return;
  if (!isTimingFeelMode(input.value)) return;

  applyTimingFeelMode(input.value);
});

ollamaBaseUrlInput.addEventListener("change", () => {
  setOllamaConfig({ baseUrl: ollamaBaseUrlInput.value.trim() || ollamaConfig.baseUrl });
});

ollamaModelInput.addEventListener("change", () => {
  setOllamaConfig({ model: ollamaModelInput.value.trim() || ollamaConfig.model });
});

ollamaHealthButton.addEventListener("click", () => {
  void runOllamaHealthCheck();
});

ollamaSendThoughtButton.addEventListener("click", () => {
  void runManualOllamaThoughtTest();
});

for (const button of helpButtons) {
  button.addEventListener("click", () => {
    const topic = button.dataset.helpTopic;
    if (!topic || !isHelpTopicId(topic)) return;
    showHelpTopic(topic, button);
  });
}

helpCloseButton.addEventListener("click", () => {
  hideHelpTopic();
});

stageResizer.addEventListener("pointerdown", (event) => {
  if (window.matchMedia("(max-width: 820px)").matches) return;
  activeResizePointerId = event.pointerId;
  stageResizer.setPointerCapture(event.pointerId);
  stage.classList.add("is-resizing");
  resizeInspectorFromClientX(event.clientX);
  event.preventDefault();
});

stageResizer.addEventListener("pointermove", (event) => {
  if (activeResizePointerId !== event.pointerId) return;
  resizeInspectorFromClientX(event.clientX);
});

function finishInspectorResize(event: PointerEvent): void {
  if (activeResizePointerId !== event.pointerId) return;
  activeResizePointerId = null;
  if (stageResizer.hasPointerCapture(event.pointerId)) {
    stageResizer.releasePointerCapture(event.pointerId);
  }
  stage.classList.remove("is-resizing");
}

stageResizer.addEventListener("pointerup", finishInspectorResize);
stageResizer.addEventListener("pointercancel", finishInspectorResize);

stageResizer.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    setInspectorWidth(getCurrentInspectorWidth() + INSPECTOR_KEYBOARD_RESIZE_STEP);
    event.preventDefault();
  }
  if (event.key === "ArrowRight") {
    setInspectorWidth(getCurrentInspectorWidth() - INSPECTOR_KEYBOARD_RESIZE_STEP);
    event.preventDefault();
  }
  if (event.key === "Home") {
    setInspectorWidth(MIN_INSPECTOR_WIDTH);
    event.preventDefault();
  }
  if (event.key === "End") {
    setInspectorWidth(MAX_INSPECTOR_WIDTH);
    event.preventDefault();
  }
});

window.addEventListener("resize", handleWindowResize);
setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);

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
    song?: {
      getId(): SongId;
      getSongs(): readonly SongMaterial[];
      setId(nextSongId: string): SongId;
    };
    timing?: {
      getMode(): TimingFeelMode;
      setMode(mode: string): TimingFeelMode;
    };
    ollama?: {
      getConfig(): OllamaConfig;
      setConfig(config: Partial<OllamaConfig>): OllamaConfig;
      getHealth(): OllamaHealthState;
      checkHealth(): Promise<OllamaHealthState>;
      getLastThoughtTest(): OllamaThoughtTestResult;
      runManualThoughtTest(playerId?: string): Promise<OllamaThoughtTestResult>;
      getSessionPrimer(): string;
      getInfluenceProbePrompt(playerId?: string): string;
      parseThoughtResponse(rawResponse: string, playerId?: string): OllamaThoughtParseResult;
    };
    terrarium?: {
      getVisualState(): TerrariumVisualState | undefined;
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

window.song = {
  getId: () => songId,
  getSongs: () => SONG_MATERIALS,
  setId: (nextSongId) => {
    if (isSongId(nextSongId)) {
      return applySongId(nextSongId);
    }
    return songId;
  },
};

window.timing = {
  getMode: () => timingFeelMode,
  setMode: (mode) => {
    if (isTimingFeelMode(mode)) {
      return applyTimingFeelMode(mode);
    }
    return timingFeelMode;
  },
};

window.ollama = {
  getConfig: () => ({ ...ollamaConfig }),
  setConfig: (config) => setOllamaConfig(config),
  getHealth: () => ({
    ...ollamaHealth,
    availableModels: [...ollamaHealth.availableModels],
  }),
  checkHealth: () => runOllamaHealthCheck(),
  getLastThoughtTest: () => ollamaThoughtTest,
  runManualThoughtTest: (playerId) => runManualOllamaThoughtTest(playerId),
  getSessionPrimer: () => createOllamaSessionPrimer(),
  getInfluenceProbePrompt: (playerId) => getInfluenceProbePrompt(playerId),
  parseThoughtResponse: (rawResponse, playerId) => parseManualOllamaThoughtResponse(rawResponse, playerId),
};

window.terrarium = {
  getVisualState: () => terrarium?.getVisualState(),
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
    window.timing = undefined;
    window.ollama = undefined;
    window.terrarium = undefined;
    window.removeEventListener("resize", handleWindowResize);
  });
}
