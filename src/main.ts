import "./style.css";
import type { Anchor, AnchorPhrase, AnchorPhraseSegment, Connector } from "./anchor-phrase";
import {
  ANCHOR_EDIT_GRID_BEATS,
  addAnchorToPhrase,
  editAnchorInPhrase,
  editConnectorInPhrase,
  joinSegmentsInPhrase,
  removeAnchorFromPhrase,
  splitSegmentInPhrase,
  type AddAnchorOptions,
  type AnchorEditPatch,
  type AnchorEditResult,
  type ConnectorEditPatch,
} from "./anchor-phrase-edit";
import { DEMO_ANCHOR_PHRASE, renderAnchorPhrase, renderDemoAnchorPhrase } from "./anchor-phrase-render";
import { createMinimalAuthoringAnchorPhrase } from "./anchor-phrase-templates";
import type {
  CandidateCapOptions,
  Candidate,
  CandidateDevelopmentOptions,
  CandidateInput,
  CandidateQueryOptions,
  CandidateScores,
  CandidateSelectionOptions,
  StoredCandidate,
} from "./candidate-store";
import {
  runCandidateCycle,
  runEvolution,
  type CandidateCycleOptions,
  type CandidateCycleResult,
  type CandidateEvolutionOptions,
  type CandidateEvolutionResult,
} from "./candidate-cycle";
import {
  selectStrictlyBetterElite,
  type EvolvingEliteSelection,
} from "./evolving-performance";
import {
  aggregateCandidateFitness,
  previewCandidateFitness,
  type CandidateFitnessOptions,
  type CandidateFitnessPreview,
  type CandidateFitnessResult,
} from "./candidate-fitness";
import {
  anchorPhraseFromPlayerPatternSource,
  createAnchorPhraseCandidateGenome,
  isAnchorPhraseCandidateGenome,
  renderPhraseCandidateGenome,
} from "./phrase-candidate-genome";
import { formatExpressionSnapshot, type PlayerExpressionSnapshot } from "./expression";
import { createFormScore, type FormScore } from "./form-scoring";
import {
  DEGREE_COLORS,
  degreeRole,
  modeDisplayName,
} from "./grow-language";
import {
  DEFAULT_FORM_VARIANT_ID,
  FORM_VARIANTS,
  getFormVariant,
  isFormVariantId,
  type FormVariant,
  type FormVariantId,
} from "./form-variants";
import type { ListeningFrame, ListeningFramePlayer, MusicalEvent } from "./listening";
import {
  checkOllamaHealth,
  createDefaultOllamaConfig,
  createInitialOllamaHealth,
  createInitialOllamaMelodyCriticTest,
  createInitialOllamaProposalTextTest,
  createInitialOllamaThoughtTest,
  createOllamaInfluenceProbePrompt,
  createOllamaMelodyCriticPrompt,
  createOllamaSessionPrimer,
  parseOllamaMelodyCriticResponse,
  parseOllamaThoughtResponse,
  runOllamaMelodyCriticTest,
  runOllamaProposalTextTest,
  runOllamaThoughtTest,
  type OllamaConfig,
  type OllamaHealthState,
  type OllamaMelodyCriticParseResult,
  type OllamaMelodyCriticTestResult,
  type OllamaProposalTextTestResult,
  type OllamaThoughtParseResult,
  type OllamaThoughtTestResult,
} from "./ollama";
import {
  formatPerformedTimingSnapshot,
  type PlayerPerformedTimingSnapshot,
} from "./performed-time";
import {
  createPersistenceClient,
  type PersistenceClientState,
} from "./persistence";
import {
  MusicalEventRecordSourceBuffer,
  createMusicalEventPersistenceRecord,
  type MusicalEventRecordBufferState,
  type MusicalEventRecordSource,
} from "./musical-event-record";
import {
  createMelodyConsensusDecision,
  createMelodyRepairTake,
  getMelodyRepairCandidate,
  type MelodyConsensusDecision,
  type MelodyDevelopmentMode,
  type MelodyFeedbackValue,
  type MelodyRepairCandidate,
  type MelodyCriticSelection,
  type MelodyPhraseScore,
  type MelodyRepairTake,
} from "./melody-scoring";
import { PLAYER_REGISTRY, type Player, type PlayerTasteProfile } from "./players";
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
  applySectionDynamics,
  createGoalSectionDynamicsProfile,
  type SectionDynamicsProfile,
} from "./section-dynamics";
import {
  DEFAULT_SONG_ID,
  getSongMaterial,
  isSongId,
  SONG_MATERIALS,
  type PlayerPatternSource,
  type SongId,
  type SongMaterial,
} from "./song-material";
import { generateProsodicAnchorPhrase, generateProsodicMelody } from "./melody-prosody";
import { scoreProsody } from "./prosody-scoring";
import { sectionAtBeat, type ChorusDevelopment } from "./song-form";
import {
  applySongSketchProposalText,
  createInspectOnlySongSketch,
  createInspectOnlySongSketchProposal,
  rootNoteFromScaleDegree,
  type SongSketch,
  type SongSketchAssignment,
  type SongSketchPlayerRef,
  type SongSketchProposal,
  type SongSketchProposalResponse,
  type SongSketchSection,
} from "./song-sketch";
import {
  interpretSongGoal,
  validateSongGoal,
  SONG_GOAL_MODES,
  SONG_GOAL_VOCABULARY,
  type SongGoal,
  type SongGoalInterpretation,
  type SongGoalMode,
  type SongGoalValidationResult,
  type SongGoalVocabulary,
} from "./song-goal";
import { createTonalContext } from "./tonal-context";
import {
  createTerrariumView,
  type TerrariumHeatState,
  type TerrariumView,
  type TerrariumVisualState,
} from "./terrarium";
import {
  createGoalTasteProfile,
  type PlayerTasteEvaluation,
  type TasteNoteDecision,
  type TasteNoteDecisionInput,
} from "./taste";
import type {
  PlayerThoughtIntent,
  PlayerThoughtRequest,
  ThoughtRequestLevel,
  ThoughtAction,
} from "./thought-protocol";
import type { PlayerThoughtSeed } from "./thought-seeds";
import { getThoughtPromptProtocol, isThoughtPromptProtocolId } from "./thought-prompt-protocols";
import {
  SlowThinkingController,
  type AcceptedSlowThought,
  type SlowThinkingLoopState,
} from "./slow-thinking";
import {
  getState,
  initTransport,
  refreshLookaheadSchedule,
  startTransport,
  stopTransport,
  DEFAULT_TRANSPORT_BPM,
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
const ANCHOR_PHRASE_DRAFT_ID = "new-unsaved";
let ollamaConfig = createDefaultOllamaConfig();
let ollamaHealth = createInitialOllamaHealth(ollamaConfig);
let ollamaThoughtTest = createInitialOllamaThoughtTest(ollamaConfig);
let ollamaProposalTextTest = createInitialOllamaProposalTextTest(ollamaConfig);
let ollamaMelodyCriticTest = createInitialOllamaMelodyCriticTest(ollamaConfig);
let ollamaRequestInFlight = false;
let songId: SongId = DEFAULT_SONG_ID;
let timingFeelMode: TimingFeelMode = "feel";
let melodyDevelopmentMode: MelodyDevelopmentMode = "repaired";
let formVariantId: FormVariantId = DEFAULT_FORM_VARIANT_ID;
let prosodyEnabled = false;
let cachedProsodyMelody: PlayerPatternSource | undefined;
let editorMelodyOverride: PlayerPatternSource | undefined;
let isAnchorPhraseEditMode = false;
let workingAnchorPhrase: AnchorPhrase | undefined;
let selectedAnchorRef: AnchorPhraseEditorAnchorRef | undefined;
let selectedConnectorRef: AnchorPhraseEditorConnectorRef | undefined;
let anchorPhraseEditorDrag: AnchorPhraseEditorDragState | undefined;
let anchorPhraseEditorMessage = "Read-only prosody phrase.";
let anchorPhraseEditorSaveInFlight = false;
let anchorPhraseEditorSavedCount: number | undefined;
let anchorPhraseEditorLastSavedCandidateId: string | undefined;
let anchorPhraseCatalogCandidates: StoredCandidate[] = [];
let anchorPhraseCatalogSelectedId = "generated";
let anchorPhraseDraftActive = false;
let anchorPhraseCatalogLoading = false;
let anchorPhraseCatalogListOpen = false;
let anchorPhraseAnchorPanelOpen = false;
let anchorPhraseConnectorPanelOpen = false;
let anchorPhraseConnectorMoreOpen = false;
let playerActionMenuOpen = false;
let playerActionMenuTrigger: HTMLElement | undefined;
let candidateMelodyAudition: {
  branchId?: string;
  candidate?: StoredCandidate;
  pattern?: PlayerPatternSource;
} = {};
const DEFAULT_EVOLVING_PERFORMANCE_BATCH = 1;
const DEFAULT_EVOLVING_PERFORMANCE_INTERVAL_MS = 350;
const MAX_EVOLVING_PERFORMANCE_BATCH = 50;
const MIN_EVOLVING_PERFORMANCE_INTERVAL_MS = 0;
const MAX_EVOLVING_PERFORMANCE_INTERVAL_MS = 30_000;
const WRITTEN_EVOLVING_DIAL_DEFAULT = 0;
const WRITTEN_EVOLVING_SPEAKING_THRESHOLD = 0.34;
const WRITTEN_EVOLVING_EVOLVING_THRESHOLD = 0.68;
let evolvingPerformanceTimerId = 0;
let evolvingPerformanceRunSerial = 0;
let evolvingPerformanceState: EvolvingElitePerformanceState = {
  status: "idle",
  message: "Evolving performance is idle.",
  targetGenerations: 0,
  completedGenerations: 0,
  batch: DEFAULT_EVOLVING_PERFORMANCE_BATCH,
  intervalMs: DEFAULT_EVOLVING_PERFORMANCE_INTERVAL_MS,
  count: 0,
  eliteLimit: 0,
  swaps: [],
};
type WrittenEvolvingRegime = "written" | "speaking" | "evolving";
let writtenEvolvingDialValue = WRITTEN_EVOLVING_DIAL_DEFAULT;
let writtenEvolvingRegime: WrittenEvolvingRegime = "written";
let activeTempoBpm = DEFAULT_TRANSPORT_BPM;
let songGoalInterpretation = interpretSongGoal("Build a balanced modal terrarium piece.");
let appliedSongGoal: SongGoal | undefined;
let cachedSongSketchKey = "";
let cachedSongSketchBase: SongSketch | undefined;
let cachedMelodyRepairKey = "";
let cachedMelodyRepairTake: MelodyRepairTake | undefined;
let activeMelodyCriticSelection: MelodyCriticSelection | undefined;
let melodyRepairFeedbackMessage = "No feedback yet.";
const rejectedMelodyRepairKeysBySong = new Map<SongId, Set<string>>();
const rememberedMelodyRepairCountsBySong = new Map<SongId, number>();
const melodyRepairWeightNudgesByPlayer = new Map<string, number>();
const persistence = createPersistenceClient({
  name: "Grow browser session",
  metadata: {
    app: "Grow",
    persistenceByte: "15c-a",
  },
}, {
  onStateChange: () => {
    if (!isTearingDown) queueRender();
  },
});
const MUSICAL_EVENT_BUFFER_CAPACITY = 512;
const MUSICAL_EVENT_FLUSH_BATCH_SIZE = 64;
const MUSICAL_EVENT_FLUSH_INTERVAL_MS = 250;
const MUSICAL_EVENT_DRAIN_ALL = Number.POSITIVE_INFINITY;
const musicalEventRecordBuffer = new MusicalEventRecordSourceBuffer(MUSICAL_EVENT_BUFFER_CAPACITY);
let musicalEventFlushTimerId = 0;
let musicalEventLastFlushAt: string | undefined;
let musicalEventLastFlushCount = 0;
let musicalEventPlaySpanSerial = 0;
const SLOW_THINKING_PLAYER_IDS = ["melody", "bass"] as const;
const SLOW_THINKING_INTERVAL_BEATS = 8;
const SLOW_THINKING_SECONDARY_INITIAL_DELAY_BEATS = 6;
const SLOW_THINKING_LATE_MARGIN_BEATS = 0.5;
const SLOW_THINKING_BOUNDARY_BEATS = 4;
const SLOW_THINKING_MAX_COMPILED_DURATION_BEATS = 4;
const SLOW_THINKING_COMPILABLE_ACTIONS_BY_PLAYER = {
  melody: ["rest", "simplify", "shift_register", "change_density"],
  bass: ["rest", "simplify", "change_density"],
} as const satisfies Record<(typeof SLOW_THINKING_PLAYER_IDS)[number], readonly ThoughtAction[]>;

type SlowThoughtPlaybackMode = "rest" | "thin" | "shift-register";

interface SlowThoughtPlayback {
  id: string;
  requestId: string;
  playerId: string;
  action: ThoughtAction;
  mode: SlowThoughtPlaybackMode;
  startBeat: number;
  endBeat: number;
  acceptedAtBeat: number;
  retargeted: boolean;
  registerShift?: number;
  summary: string;
}

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
const melodyDevelopmentControls = ([
  { id: "raw", label: "Raw" },
  { id: "repaired", label: "Repaired" },
] as const satisfies Array<{ id: MelodyDevelopmentMode; label: string }>).map((mode) => `
          <label class="mode-option" data-testid="melody-development-${mode.id}-option">
            <input
              data-testid="melody-development-${mode.id}"
              name="melody-development"
              type="radio"
              value="${mode.id}"
              ${mode.id === melodyDevelopmentMode ? "checked" : ""}
            />
            <span>${mode.label}</span>
          </label>
`).join("");
const formVariantControls = FORM_VARIANTS.map((variant) => `
          <label class="mode-option" data-testid="form-variant-${variant.id}-option">
            <input
              data-testid="form-variant-${variant.id}"
              name="form-variant"
              type="radio"
              value="${variant.id}"
              ${variant.id === formVariantId ? "checked" : ""}
            />
            <span>${variant.label}</span>
          </label>
`).join("");
const degreeColorLegendItems = Object.entries(DEGREE_COLORS).map(([degree, color]) => `
          <li class="degree-color-legend__item">
            <span
              class="degree-color-legend__swatch"
              style="background: var(${color.varName})"
              aria-hidden="true"
            ></span>
            <span><strong>${degree}</strong> ${degreeRole(Number(degree)) ?? color.role}</span>
          </li>
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
    body: "Ollama is the local model boundary for slow player thoughts and band-proposal wording. Check verifies the local server and model, Send thought runs one validated player-thought request, and Send proposal rewrites inspect-only proposal text without letting the model change musical structure.",
  },
  players: {
    title: "Players",
    body: "Players are the current musical presences. State is recent posture, Taste is the current rule decision, Dynamics heard is the last audible velocity expression, Offset queued is the committed performed-time offset, and Heat caught is how much shared agitation the player's disposition absorbs.",
  },
  thoughts: {
    title: "Thoughts",
    body: "Thoughts show the compact request ingredients each player would send to the slow creative planner: focus, motif, request level, mock intent, selected memory fragments, and each active slow-thinking loop.",
  },
  "song-sketch": {
    title: "Song Sketch",
    body: "Song Sketch is an inspect-only band-level draft. It records sections, shared tonal plans, player assignments, and open questions before any songwriting idea is allowed to drive playback.",
  },
  "song-goal": {
    title: "Song Goal",
    body: "Song Goal interprets a free-text idea into bounded setup and character knobs. Interpret previews the structured goal; Apply setup uses only validated key, tempo, and form fields. Prose remains provenance only.",
  },
  "melody-score": {
    title: "Melody Score",
    body: "Melody Score compares raw, repaired, and strategy-diverse chorus takes. Scores are perspectival: each player hears the same phrase against its own tiny influence prior. The local critic can only choose an app-owned candidate id.",
  },
  "form-score": {
    title: "Form Score",
    body: "Form Score grades the whole song arc, then lets you audition deterministic form variants through the normal lookahead path. Variants change section layout and dynamics; pitches still come from app-owned in-scale material.",
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
  <section class="app-shell" aria-label="Grow Byte 17a">
    <header class="topbar">
      <div class="brand">
        <h1 class="brand__title">Grow</h1>
        <p class="brand__subtitle">A song idea becomes bounded knobs</p>
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
        <div class="control-readouts" aria-label="Current musical setup">
          <span class="control-readout">
            <span>Tempo</span>
            <strong data-testid="control-tempo-readout">90 BPM</strong>
          </span>
          <span class="control-readout">
            <span>Key</span>
            <strong
              data-testid="control-key-readout"
              data-mode-classical="mixolydian"
              title="Strut · Mixolydian · key of C"
            >C Strut</strong>
          </span>
        </div>
        <fieldset class="written-evolving-control" data-testid="written-evolving-control">
          <legend class="visually-hidden">Written to evolving control</legend>
          <div class="written-evolving-control__header">
            <span>Line</span>
            <strong data-testid="written-evolving-regime">written</strong>
          </div>
          <label class="written-evolving-slider">
            <span>Written</span>
            <input
              id="written-evolving-dial"
              data-testid="written-evolving-dial"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="0"
            />
            <span>Evolving</span>
          </label>
        </fieldset>
      </div>
    </header>

    <section class="player-entry-strip" data-testid="player-entry-strip" aria-label="Players">
      <button
        class="player-entry-button"
        data-testid="player-entry-melody"
        data-player-id="melody"
        type="button"
        aria-haspopup="menu"
        aria-expanded="false"
      >
        <span>Melody</span>
        <strong>Graphical phrase</strong>
      </button>
      <div
        class="player-action-menu"
        data-testid="player-action-menu"
        role="menu"
        aria-labelledby="player-menu-title"
        hidden
      >
        <strong id="player-menu-title" data-testid="player-menu-title">Melody</strong>
        <button
          class="player-action-menu__item"
          data-testid="player-menu-graphical-phrase"
          type="button"
          role="menuitem"
        >Graphical phrase</button>
      </div>
    </section>

    <section class="stage" data-testid="stage" aria-label="Terrarium stage">
      <div class="terrarium-panel">
        <div
          class="terrarium-canvas"
          id="terrarium-container"
          data-testid="terrarium-container"
          aria-label="Bounded terrarium canvas"
        ></div>
      </div>

      <section
        class="phrase-editor-overlay"
        data-testid="anchor-phrase-editor-overlay"
        aria-label="Melody phrase editor"
        hidden
      >
        <div class="phrase-editor-backdrop" data-testid="anchor-phrase-editor-backdrop"></div>
        <article
          class="phrase-editor"
          data-testid="anchor-phrase-editor"
          role="dialog"
          aria-modal="false"
          aria-labelledby="anchor-phrase-editor-title"
          tabindex="-1"
        >
          <header class="phrase-editor__header">
            <div class="phrase-editor__title-group">
              <p class="phrase-editor__eyebrow">
                <span>Melody</span>
                <span aria-hidden="true">/</span>
                <span>Graphical phrase</span>
              </p>
              <h2 id="anchor-phrase-editor-title" data-testid="anchor-phrase-editor-title">Graphical phrase</h2>
            </div>
            <div class="phrase-editor__readouts">
              <strong
                data-testid="anchor-phrase-editor-tonal"
                data-mode-classical="mixolydian"
                title="Strut · Mixolydian · key of C"
              >C Strut</strong>
              <button
                class="phrase-editor__tool-button phrase-editor__edit-toggle"
                data-testid="anchor-phrase-editor-edit-toggle"
                type="button"
                aria-pressed="false"
              >Edit</button>
              <button
                class="phrase-editor__close"
                data-testid="anchor-phrase-editor-close"
                type="button"
                aria-label="Close melody phrase editor"
              >Close</button>
            </div>
          </header>
          <div class="phrase-editor__meta" aria-label="Phrase summary">
            <span data-testid="anchor-phrase-editor-song">Lantern</span>
            <span data-testid="anchor-phrase-editor-summary">read-only prosody phrase</span>
          </div>
          <div
            class="phrase-editor__catalog"
            data-testid="anchor-phrase-editor-catalog"
            aria-label="Phrase idea catalog"
          >
            <div class="phrase-editor__catalog-stepper">
              <button
                class="phrase-editor__tool-button"
                data-testid="anchor-phrase-editor-catalog-prev"
                type="button"
              >Prev</button>
              <strong data-testid="anchor-phrase-editor-idea-index">Idea 1 of 1</strong>
              <button
                class="phrase-editor__tool-button"
                data-testid="anchor-phrase-editor-catalog-next"
                type="button"
              >Next</button>
            </div>
            <span class="phrase-editor__catalog-detail" data-testid="anchor-phrase-editor-idea-detail">
              Generated · current prosody
            </span>
            <button
              class="phrase-editor__tool-button"
              data-testid="anchor-phrase-editor-catalog-list-toggle"
              type="button"
              aria-expanded="false"
            >Catalog</button>
            <div class="phrase-editor__catalog-actions">
              <button
                class="phrase-editor__tool-button"
                data-testid="anchor-phrase-editor-new-idea"
                type="button"
              >+ New idea</button>
              <button
                class="phrase-editor__tool-button"
                data-testid="anchor-phrase-editor-preview"
                type="button"
              >Preview</button>
              <button
                class="phrase-editor__tool-button"
                data-testid="anchor-phrase-editor-edit-selected"
                type="button"
              >Edit idea</button>
            </div>
            <div
              class="phrase-editor__catalog-list"
              data-testid="anchor-phrase-editor-catalog-list"
              hidden
            ></div>
          </div>
          <div class="phrase-editor__roll" data-testid="anchor-phrase-editor-roll"></div>
          <div class="phrase-editor__phrase-actions" aria-label="Phrase actions">
            <button
              class="phrase-editor__tool-button"
              data-testid="anchor-phrase-editor-revert"
              type="button"
              disabled
            >Revert</button>
            <button
              class="phrase-editor__tool-button"
              data-testid="anchor-phrase-editor-save"
              type="button"
              disabled
            >Save idea</button>
            <span class="phrase-editor__save-status" data-testid="anchor-phrase-editor-save-status">
              Saved ideas: 0
            </span>
          </div>
          <section class="phrase-editor__panel phrase-editor__panel--anchor" aria-label="Anchor editing controls">
            <button
              class="phrase-editor__panel-toggle"
              data-testid="anchor-phrase-editor-anchor-panel-toggle"
              type="button"
              aria-expanded="false"
            >
              <span>Anchor</span>
              <span class="phrase-editor__panel-cue" aria-hidden="true">Select one</span>
            </button>
            <div
              class="phrase-editor__panel-body"
              data-testid="anchor-phrase-editor-anchor-panel"
              hidden
            >
              <span class="phrase-editor__selected" data-testid="anchor-phrase-editor-selected-anchor">No anchor selected</span>
              <label class="phrase-editor__dynamics">
                <span>Dynamics</span>
                <input
                  data-testid="anchor-phrase-editor-dynamics"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value="0.7"
                  disabled
                />
              </label>
              <div class="phrase-editor__structure-tools" aria-label="Segment and anchor structure controls">
                <button class="phrase-editor__tool-button" data-testid="anchor-phrase-editor-add-anchor" type="button" disabled>+ Anchor</button>
                <button class="phrase-editor__tool-button" data-testid="anchor-phrase-editor-remove-anchor" type="button" disabled>Remove</button>
                <button class="phrase-editor__tool-button" data-testid="anchor-phrase-editor-split-segment" type="button" disabled>Split here</button>
                <button class="phrase-editor__tool-button" data-testid="anchor-phrase-editor-join-segments" type="button" disabled>Join breath</button>
              </div>
            </div>
          </section>
          <section class="phrase-editor__panel phrase-editor__panel--connector" aria-label="Connector editing controls">
            <button
              class="phrase-editor__panel-toggle"
              data-testid="anchor-phrase-editor-connector-panel-toggle"
              type="button"
              aria-expanded="false"
            >
              <span>Connector</span>
              <span class="phrase-editor__panel-cue" aria-hidden="true">Select one</span>
            </button>
            <div
              class="phrase-editor__panel-body phrase-editor__connector-tools"
              data-testid="anchor-phrase-editor-connector-tools"
              hidden
            >
              <div class="phrase-editor__kernel-palette" data-testid="anchor-phrase-editor-kernel-palette">
                <span>Kernel</span>
                <button class="phrase-editor__kernel-button" data-testid="anchor-phrase-editor-kernel-fill" data-kernel="fill" type="button">Fill</button>
                <button class="phrase-editor__kernel-button" data-testid="anchor-phrase-editor-kernel-detour" data-kernel="detour" type="button">Detour</button>
                <button class="phrase-editor__kernel-button" data-testid="anchor-phrase-editor-kernel-approach" data-kernel="approach" type="button">Approach</button>
                <button class="phrase-editor__kernel-button" data-testid="anchor-phrase-editor-kernel-orbit" data-kernel="orbit" type="button">Orbit</button>
                <button class="phrase-editor__kernel-button" data-testid="anchor-phrase-editor-kernel-skip" data-kernel="skip" type="button">Skip</button>
              </div>
              <div class="phrase-editor__connector-sliders">
                <label>
                  <span>Reach</span>
                  <input data-testid="anchor-phrase-editor-connector-reach" data-connector-knob="reach" type="range" min="0" max="1" step="0.01" value="0.5" disabled />
                </label>
                <label>
                  <span>Density</span>
                  <input data-testid="anchor-phrase-editor-connector-density" data-connector-knob="density" type="range" min="0" max="1" step="0.01" value="0.5" disabled />
                </label>
              </div>
              <button
                class="phrase-editor__tool-button phrase-editor__more-toggle"
                data-testid="anchor-phrase-editor-connector-more-toggle"
                type="button"
                aria-expanded="false"
              >More</button>
              <div class="phrase-editor__connector-more" data-testid="anchor-phrase-editor-connector-more" hidden>
                <label>
                  <span>Bias</span>
                  <input data-testid="anchor-phrase-editor-connector-bias" data-connector-knob="bias" type="range" min="-1" max="1" step="0.01" value="0" disabled />
                </label>
                <label>
                  <span>Pull</span>
                  <input data-testid="anchor-phrase-editor-connector-pull" data-connector-knob="pull" type="range" min="0" max="1" step="0.01" value="0.5" disabled />
                </label>
                <label>
                  <span>Skew</span>
                  <input data-testid="anchor-phrase-editor-connector-skew" data-connector-knob="skew" type="range" min="-1" max="1" step="0.01" value="0" disabled />
                </label>
              </div>
              <span class="phrase-editor__connector-note">Color stays diatonic-only for now.</span>
            </div>
          </section>
          <p class="phrase-editor__note" data-testid="anchor-phrase-editor-status">
            Read-only for now. This shows the current prosody idea in anchors, connectors, and breaths.
          </p>
        </article>
      </section>

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
        class="inspector inspect-drawer"
        id="player-inspector"
        data-testid="player-inspector"
        data-open="false"
        aria-label="Player inspector"
      >
        <div class="inspect-drawer__header">
          <div>
            <h2>Inspect</h2>
            <p>Detailed state, probes, scores, and persistence</p>
          </div>
          <button
            class="inspect-toggle"
            data-testid="inspect-toggle"
            type="button"
            aria-expanded="false"
            aria-controls="inspect-drawer-content"
          >Inspect</button>
        </div>

        <div
          class="inspect-drawer__content"
          id="inspect-drawer-content"
          data-testid="inspect-drawer"
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

        <section class="degree-color-legend" data-testid="degree-color-legend" aria-label="Degree color legend">
          <h2>Degree Colors</h2>
          <ul>
${degreeColorLegendItems}
          </ul>
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
            <dt>Section</dt>
            <dd data-testid="song-section-current">Verse 1, bar 1/8</dd>
            <dt>Harmony</dt>
            <dd data-testid="song-harmony-current">Gather C</dd>
            <dt>Timing</dt>
            <dd data-testid="timing-feel-current">Feel</dd>
            <dt>Persistence</dt>
            <dd data-testid="persistence-status">idle, 0 saved</dd>
            <dt>Event buffer</dt>
            <dd data-testid="musical-event-buffer-status">0 queued, 0 dropped</dd>
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
              <button class="mini-button" data-testid="ollama-send-proposal" type="button">Send proposal</button>
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
            <dt>Proposal text</dt>
            <dd data-testid="ollama-proposal-text-status">idle</dd>
            <dt>Fallback</dt>
            <dd data-testid="ollama-fallback-status">mock ready</dd>
            <dt>Errors</dt>
            <dd data-testid="ollama-errors">none</dd>
            <dt>Primer</dt>
            <dd data-testid="ollama-primer-summary">Projected JSON intent; scaleDegree 0..scale-1 plus octave; registerDelta for shifts; system derives pitch/sourceStartBeat.</dd>
            <dt>Raw</dt>
            <dd><pre class="raw-response" data-testid="ollama-raw-response">none</pre></dd>
            <dt>Proposal raw</dt>
            <dd><pre class="raw-response" data-testid="ollama-proposal-raw-response">none</pre></dd>
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

        <section class="inspector-section" aria-label="Song goal">
          <div class="section-heading">
            <h2>Song Goal</h2>
${renderHelpButton("song-goal", "song goal")}
          </div>
          <div class="ollama-controls">
            <label class="ollama-field">
              <span>Idea</span>
              <input
                data-testid="song-goal-idea-input"
                type="text"
                value="Build a balanced modal terrarium piece."
                autocomplete="off"
              />
            </label>
            <div class="ollama-actions">
              <button class="mini-button" data-testid="song-goal-interpret" type="button">Interpret</button>
              <button class="mini-button" data-testid="song-goal-apply" type="button">Apply setup</button>
            </div>
          </div>
          <dl>
            <dt>Status</dt>
            <dd data-testid="song-goal-status">idle</dd>
            <dt>Applied</dt>
            <dd data-testid="song-goal-applied">none</dd>
            <dt>Setup</dt>
            <dd data-testid="song-goal-setup">none</dd>
            <dt>Character</dt>
            <dd data-testid="song-goal-character">none</dd>
            <dt>Influences</dt>
            <dd data-testid="song-goal-influences">none</dd>
            <dt>Biases</dt>
            <dd data-testid="song-goal-biases">none</dd>
            <dt>Brief</dt>
            <dd data-testid="song-goal-brief">none</dd>
            <dt>Validation</dt>
            <dd data-testid="song-goal-validation">none</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Song sketch">
          <div class="section-heading">
            <h2>Song Sketch</h2>
${renderHelpButton("song-sketch", "song sketch")}
          </div>
          <dl>
            <dt>Draft</dt>
            <dd data-testid="song-sketch-title">none</dd>
            <dt>Proposer</dt>
            <dd data-testid="song-sketch-proposer">none</dd>
            <dt>Sections</dt>
            <dd data-testid="song-sketch-sections">none</dd>
            <dt>Assignments</dt>
            <dd data-testid="song-sketch-assignments">none</dd>
            <dt>Proposal</dt>
            <dd data-testid="song-sketch-proposal">none</dd>
            <dt>Responses</dt>
            <dd data-testid="song-sketch-responses">none</dd>
            <dt>Questions</dt>
            <dd data-testid="song-sketch-questions">none</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Melody score">
          <div class="section-heading">
            <h2>Melody Score</h2>
${renderHelpButton("melody-score", "melody score")}
          </div>
          <fieldset class="mode-control melody-score-control">
            <legend class="visually-hidden">Chorus melody audition mode</legend>
            <span class="mode-label" aria-hidden="true">Audition</span>
            <div class="mode-segments" data-testid="melody-development-control">
${melodyDevelopmentControls}
            </div>
          </fieldset>
          <div class="ollama-actions">
            <button class="mini-button" data-testid="melody-repair-up" type="button">Up</button>
            <button class="mini-button" data-testid="melody-repair-down" type="button">Down</button>
            <button class="mini-button" data-testid="melody-critic-send" type="button">Send critic</button>
          </div>
          <dl>
            <dt>Mode</dt>
            <dd data-testid="melody-development-current">Repaired</dd>
            <dt>Candidate</dt>
            <dd data-testid="melody-candidate-current">heuristic</dd>
            <dt>Total</dt>
            <dd data-testid="melody-score-total">none</dd>
            <dt>Choice</dt>
            <dd data-testid="melody-score-choice">none</dd>
            <dt>Scored roots</dt>
            <dd data-testid="melody-score-roots">none</dd>
            <dt>Subscores</dt>
            <dd data-testid="melody-score-subscores">none</dd>
            <dt>Top critique</dt>
            <dd data-testid="melody-score-critique">none</dd>
            <dt>Critic</dt>
            <dd data-testid="melody-critic-status">idle</dd>
            <dt>Consensus</dt>
            <dd data-testid="melody-consensus-status">none</dd>
            <dt>Responses</dt>
            <dd data-testid="melody-consensus-responses">none</dd>
            <dt>Perspectives</dt>
            <dd data-testid="melody-score-perspectives">none</dd>
            <dt>Feedback</dt>
            <dd data-testid="melody-score-feedback">none</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Form score">
          <div class="section-heading">
            <h2>Form Score</h2>
${renderHelpButton("form-score", "form score")}
          </div>
          <fieldset class="mode-control form-variant-control">
            <legend class="visually-hidden">Form variant audition</legend>
            <span class="mode-label" aria-hidden="true">Variant</span>
            <div class="mode-segments" data-testid="form-variant-control">
${formVariantControls}
            </div>
          </fieldset>
          <dl>
            <dt>Variant</dt>
            <dd data-testid="form-variant-current">Classic Arc</dd>
            <dt>Winner</dt>
            <dd data-testid="form-variant-winner">none</dd>
            <dt>Candidates</dt>
            <dd data-testid="form-variant-candidates">none</dd>
            <dt>Total</dt>
            <dd data-testid="form-score-total">none</dd>
            <dt>Subscores</dt>
            <dd data-testid="form-score-subscores">none</dd>
            <dt>Sections</dt>
            <dd data-testid="form-score-sections">none</dd>
            <dt>Top critique</dt>
            <dd data-testid="form-score-critique">none</dd>
          </dl>
        </section>

        <section class="inspector-section" aria-label="Listening frame">
          <div class="section-heading">
            <h2>Listening</h2>
${renderHelpButton("listening", "listening frame")}
          </div>
          <dl>
            <dt>Tonal</dt>
            <dd data-testid="listening-tonal-context" data-mode-classical="">unknown</dd>
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
        </div>
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
const inspectDrawer = requireElement<HTMLElement>("[data-testid='inspect-drawer']");
const inspectToggle = requireElement<HTMLButtonElement>("[data-testid='inspect-toggle']");
const controlTempoReadout = requireElement<HTMLElement>("[data-testid='control-tempo-readout']");
const controlKeyReadout = requireElement<HTMLElement>("[data-testid='control-key-readout']");
const writtenEvolvingDialInput = requireElement<HTMLInputElement>("[data-testid='written-evolving-dial']");
const writtenEvolvingRegimeReadout = requireElement<HTMLElement>("[data-testid='written-evolving-regime']");
const helpPanel = requireElement<HTMLElement>("[data-testid='inspector-help-panel']");
const helpTitle = requireElement<HTMLElement>("[data-testid='inspector-help-title']");
const helpBody = requireElement<HTMLElement>("[data-testid='inspector-help-body']");
const helpCloseButton = requireElement<HTMLButtonElement>("[data-testid='inspector-help-close']");
const helpButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-help-topic]"));
const sessionModeControl = requireElement<HTMLDivElement>("[data-testid='session-mode-control']");
const sessionModeCurrent = requireElement<HTMLElement>("[data-testid='session-mode-current']");
const songControl = requireElement<HTMLDivElement>("[data-testid='song-control']");
const songCurrent = requireElement<HTMLElement>("[data-testid='song-current']");
const songSectionCurrent = requireElement<HTMLElement>("[data-testid='song-section-current']");
const songHarmonyCurrent = requireElement<HTMLElement>("[data-testid='song-harmony-current']");
const timingFeelControl = requireElement<HTMLDivElement>("[data-testid='timing-feel-control']");
const timingFeelCurrent = requireElement<HTMLElement>("[data-testid='timing-feel-current']");
const persistenceStatus = requireElement<HTMLElement>("[data-testid='persistence-status']");
const musicalEventBufferStatus = requireElement<HTMLElement>("[data-testid='musical-event-buffer-status']");
const playerEntryMelody = requireElement<HTMLButtonElement>("[data-testid='player-entry-melody']");
const playerActionMenu = requireElement<HTMLElement>("[data-testid='player-action-menu']");
const playerMenuGraphicalPhrase = requireElement<HTMLButtonElement>("[data-testid='player-menu-graphical-phrase']");
const playerList = requireElement<HTMLDivElement>("#player-list");
const anchorPhraseEditorOverlay = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-overlay']");
const anchorPhraseEditor = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor']");
const anchorPhraseEditorBackdrop = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-backdrop']");
const anchorPhraseEditorClose = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-close']");
const anchorPhraseEditorTonal = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-tonal']");
const anchorPhraseEditorSong = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-song']");
const anchorPhraseEditorSummary = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-summary']");
const anchorPhraseEditorCatalogPrev = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-catalog-prev']");
const anchorPhraseEditorCatalogNext = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-catalog-next']");
const anchorPhraseEditorIdeaIndex = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-idea-index']");
const anchorPhraseEditorIdeaDetail = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-idea-detail']");
const anchorPhraseEditorNewIdea = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-new-idea']");
const anchorPhraseEditorPreview = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-preview']");
const anchorPhraseEditorEditSelected = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-edit-selected']");
const anchorPhraseEditorCatalogListToggle = requireElement<HTMLButtonElement>(
  "[data-testid='anchor-phrase-editor-catalog-list-toggle']",
);
const anchorPhraseEditorCatalogList = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-catalog-list']");
const anchorPhraseEditorEditToggle = requireElement<HTMLButtonElement>(
  "[data-testid='anchor-phrase-editor-edit-toggle']",
);
const anchorPhraseEditorRevert = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-revert']");
const anchorPhraseEditorSave = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-save']");
const anchorPhraseEditorSaveStatus = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-save-status']");
const anchorPhraseEditorAddAnchor = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-add-anchor']");
const anchorPhraseEditorRemoveAnchor = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-remove-anchor']");
const anchorPhraseEditorSplitSegment = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-split-segment']");
const anchorPhraseEditorJoinSegments = requireElement<HTMLButtonElement>("[data-testid='anchor-phrase-editor-join-segments']");
const anchorPhraseEditorSelected = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-selected-anchor']");
const anchorPhraseEditorDynamics = requireElement<HTMLInputElement>("[data-testid='anchor-phrase-editor-dynamics']");
const anchorPhraseEditorAnchorPanelToggle = requireElement<HTMLButtonElement>(
  "[data-testid='anchor-phrase-editor-anchor-panel-toggle']",
);
const anchorPhraseEditorAnchorPanel = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-anchor-panel']");
const anchorPhraseEditorConnectorPanelToggle = requireElement<HTMLButtonElement>(
  "[data-testid='anchor-phrase-editor-connector-panel-toggle']",
);
const anchorPhraseEditorConnectorPanel = requireElement<HTMLElement>(
  "[data-testid='anchor-phrase-editor-connector-tools']",
);
const anchorPhraseEditorConnectorMoreToggle = requireElement<HTMLButtonElement>(
  "[data-testid='anchor-phrase-editor-connector-more-toggle']",
);
const anchorPhraseEditorConnectorMore = requireElement<HTMLElement>(
  "[data-testid='anchor-phrase-editor-connector-more']",
);
const anchorPhraseEditorKernelPalette = requireElement<HTMLElement>(
  "[data-testid='anchor-phrase-editor-kernel-palette']",
);
const anchorPhraseEditorKernelButtons = Array.from(
  anchorPhraseEditorKernelPalette.querySelectorAll<HTMLButtonElement>("[data-kernel]"),
);
const anchorPhraseEditorConnectorKnobs = Array.from(
  document.querySelectorAll<HTMLInputElement>("[data-connector-knob]"),
);
const anchorPhraseEditorRoll = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-roll']");
const anchorPhraseEditorStatus = requireElement<HTMLElement>("[data-testid='anchor-phrase-editor-status']");
const thoughtSeedList = requireElement<HTMLDivElement>("#thought-seed-list");
const ollamaBaseUrlInput = requireElement<HTMLInputElement>("[data-testid='ollama-base-url-input']");
const ollamaModelInput = requireElement<HTMLInputElement>("[data-testid='ollama-model-input']");
const ollamaHealthButton = requireElement<HTMLButtonElement>("[data-testid='ollama-health-check']");
const ollamaSendThoughtButton = requireElement<HTMLButtonElement>("[data-testid='ollama-send-thought']");
const ollamaSendProposalButton = requireElement<HTMLButtonElement>("[data-testid='ollama-send-proposal']");
const ollamaHealthStatus = requireElement<HTMLElement>("[data-testid='ollama-health-status']");
const ollamaModelStatus = requireElement<HTMLElement>("[data-testid='ollama-model-status']");
const ollamaProtocolStatus = requireElement<HTMLElement>("[data-testid='ollama-protocol-status']");
const ollamaLatency = requireElement<HTMLElement>("[data-testid='ollama-latency']");
const ollamaParseResult = requireElement<HTMLElement>("[data-testid='ollama-parse-result']");
const ollamaValidationResult = requireElement<HTMLElement>("[data-testid='ollama-validation-result']");
const ollamaProposalTextStatus = requireElement<HTMLElement>("[data-testid='ollama-proposal-text-status']");
const ollamaFallbackStatus = requireElement<HTMLElement>("[data-testid='ollama-fallback-status']");
const ollamaErrors = requireElement<HTMLElement>("[data-testid='ollama-errors']");
const ollamaRawResponse = requireElement<HTMLElement>("[data-testid='ollama-raw-response']");
const ollamaProposalRawResponse = requireElement<HTMLElement>("[data-testid='ollama-proposal-raw-response']");
const listeningEventCount = requireElement<HTMLElement>("[data-testid='listening-event-count']");
const listeningWindow = requireElement<HTMLElement>("[data-testid='listening-window']");
const listeningLatestEvent = requireElement<HTMLElement>("[data-testid='listening-latest-event']");
const listeningAgitation = requireElement<HTMLElement>("[data-testid='listening-agitation']");
const listeningTonalContext = requireElement<HTMLElement>("[data-testid='listening-tonal-context']");
const lookaheadHealth = requireElement<HTMLElement>("[data-testid='lookahead-health']");
const lookaheadLead = requireElement<HTMLElement>("[data-testid='lookahead-lead']");
const lookaheadThrough = requireElement<HTMLElement>("[data-testid='lookahead-through']");
const lookaheadPendingSlots = requireElement<HTMLElement>("[data-testid='lookahead-pending-slots']");
const songGoalIdeaInput = requireElement<HTMLInputElement>("[data-testid='song-goal-idea-input']");
const songGoalInterpretButton = requireElement<HTMLButtonElement>("[data-testid='song-goal-interpret']");
const songGoalApplyButton = requireElement<HTMLButtonElement>("[data-testid='song-goal-apply']");
const songGoalStatus = requireElement<HTMLElement>("[data-testid='song-goal-status']");
const songGoalApplied = requireElement<HTMLElement>("[data-testid='song-goal-applied']");
const songGoalSetup = requireElement<HTMLElement>("[data-testid='song-goal-setup']");
const songGoalCharacter = requireElement<HTMLElement>("[data-testid='song-goal-character']");
const songGoalInfluences = requireElement<HTMLElement>("[data-testid='song-goal-influences']");
const songGoalBiases = requireElement<HTMLElement>("[data-testid='song-goal-biases']");
const songGoalBrief = requireElement<HTMLElement>("[data-testid='song-goal-brief']");
const songGoalValidation = requireElement<HTMLElement>("[data-testid='song-goal-validation']");
const songSketchTitle = requireElement<HTMLElement>("[data-testid='song-sketch-title']");
const songSketchProposer = requireElement<HTMLElement>("[data-testid='song-sketch-proposer']");
const songSketchSections = requireElement<HTMLElement>("[data-testid='song-sketch-sections']");
const songSketchAssignments = requireElement<HTMLElement>("[data-testid='song-sketch-assignments']");
const songSketchProposal = requireElement<HTMLElement>("[data-testid='song-sketch-proposal']");
const songSketchResponses = requireElement<HTMLElement>("[data-testid='song-sketch-responses']");
const songSketchQuestions = requireElement<HTMLElement>("[data-testid='song-sketch-questions']");
const melodyDevelopmentControl = requireElement<HTMLDivElement>("[data-testid='melody-development-control']");
const melodyDevelopmentCurrent = requireElement<HTMLElement>("[data-testid='melody-development-current']");
const melodyRepairUpButton = requireElement<HTMLButtonElement>("[data-testid='melody-repair-up']");
const melodyRepairDownButton = requireElement<HTMLButtonElement>("[data-testid='melody-repair-down']");
const melodyCriticSendButton = requireElement<HTMLButtonElement>("[data-testid='melody-critic-send']");
const melodyCandidateCurrent = requireElement<HTMLElement>("[data-testid='melody-candidate-current']");
const melodyScoreTotal = requireElement<HTMLElement>("[data-testid='melody-score-total']");
const melodyScoreChoice = requireElement<HTMLElement>("[data-testid='melody-score-choice']");
const melodyScoreRoots = requireElement<HTMLElement>("[data-testid='melody-score-roots']");
const melodyScoreSubscores = requireElement<HTMLElement>("[data-testid='melody-score-subscores']");
const melodyScoreCritique = requireElement<HTMLElement>("[data-testid='melody-score-critique']");
const melodyCriticStatus = requireElement<HTMLElement>("[data-testid='melody-critic-status']");
const melodyConsensusStatus = requireElement<HTMLElement>("[data-testid='melody-consensus-status']");
const melodyConsensusResponses = requireElement<HTMLElement>("[data-testid='melody-consensus-responses']");
const melodyScorePerspectives = requireElement<HTMLElement>("[data-testid='melody-score-perspectives']");
const melodyScoreFeedback = requireElement<HTMLElement>("[data-testid='melody-score-feedback']");
const formVariantControl = requireElement<HTMLDivElement>("[data-testid='form-variant-control']");
const formVariantCurrent = requireElement<HTMLElement>("[data-testid='form-variant-current']");
const formVariantWinner = requireElement<HTMLElement>("[data-testid='form-variant-winner']");
const formVariantCandidates = requireElement<HTMLElement>("[data-testid='form-variant-candidates']");
const formScoreTotal = requireElement<HTMLElement>("[data-testid='form-score-total']");
const formScoreSubscores = requireElement<HTMLElement>("[data-testid='form-score-subscores']");
const formScoreSections = requireElement<HTMLElement>("[data-testid='form-score-sections']");
const formScoreCritique = requireElement<HTMLElement>("[data-testid='form-score-critique']");

let terrarium: TerrariumView | null = null;
let activeResizePointerId: number | null = null;
let previousTransportStatus = getState().status;
let renderedPlayerIds = "";
let renderedThoughtSeedIds = "";
let isAnchorPhraseEditorOpen = false;
let renderedAnchorPhraseEditorKey = "";
let renderFrameId: number | null = null;
let isTearingDown = false;
let isInspectDrawerOpen = false;
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
const thoughtSlowNodes = new Map<string, HTMLElement>();
const pendingPlayerFlashes = new Set<string>();
const activeSlowThoughtPlaybacks = new Map<string, SlowThoughtPlayback>();
const slowThinkingControllers = SLOW_THINKING_PLAYER_IDS.map((playerId, index) =>
  new SlowThinkingController({
    playerId,
    intervalBeats: SLOW_THINKING_INTERVAL_BEATS,
    initialDelayBeats: index * SLOW_THINKING_SECONDARY_INITIAL_DELAY_BEATS,
    lateMarginBeats: SLOW_THINKING_LATE_MARGIN_BEATS,
    boundaryBeats: SLOW_THINKING_BOUNDARY_BEATS,
    getConfig: readOllamaConfigFromInputs,
    getHealth: () => ollamaHealth,
    getRequest: getCurrentSlowThinkingRequest,
    getTransportState: getState,
    setPlayerThinking: (nextPlayerId, thinking) => world.setPlayerThinking(nextPlayerId, thinking),
    onAccepted: handleAcceptedSlowThought,
    onStateChange: queueRender,
  })
);
const slowThinkingControllersByPlayer = new Map(
  slowThinkingControllers.map((controller) => [controller.getState().playerId, controller])
);

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

function setInspectDrawerOpen(isOpen: boolean): void {
  isInspectDrawerOpen = isOpen;
  inspector.classList.toggle("is-open", isOpen);
  inspector.dataset.open = String(isOpen);
  inspectDrawer.dataset.open = String(isOpen);
  stage.classList.toggle("stage--inspect-open", isOpen);
  inspectToggle.setAttribute("aria-expanded", String(isOpen));
  inspectToggle.textContent = isOpen ? "Hide" : "Inspect";
  if (!isOpen) {
    hideHelpTopic();
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
      const canOpenPhraseEditor = player.id === "melody";
      card.className = canOpenPhraseEditor
        ? "player-inspector player-inspector--phrase-trigger"
        : "player-inspector";
      card.dataset.testid = `player-card-${player.id}`;
      if (canOpenPhraseEditor) {
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-haspopup", "menu");
        card.setAttribute("aria-expanded", String(playerActionMenuOpen));
        card.setAttribute("aria-label", "Open Melody player actions");
        card.title = "Open Melody player actions";
      }

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

function openAnchorPhraseEditor(): void {
  closePlayerActionMenu({ restoreFocus: false });
  if (!isAnchorPhraseEditorOpen) {
    isAnchorPhraseEditorOpen = true;
    anchorPhraseEditorOverlay.hidden = false;
    renderedAnchorPhraseEditorKey = "";
  }
  renderAnchorPhraseEditor();
  void refreshAnchorPhraseEditorSavedCount({ render: true });
  requestAnimationFrame(() => {
    anchorPhraseEditor.focus();
  });
}

function closeAnchorPhraseEditor(options: { restoreFocus?: boolean } = {}): void {
  if (!isAnchorPhraseEditorOpen) return;
  resetAnchorPhraseEditorSession("Editor closed; generated phrase restored.", { refresh: true, render: false });
  isAnchorPhraseEditorOpen = false;
  anchorPhraseEditorOverlay.hidden = true;
  if (options.restoreFocus !== false) {
    getMelodyPlayerActionTrigger()?.focus();
  }
}

function openPlayerActionMenu(trigger: HTMLElement): void {
  playerActionMenuOpen = true;
  playerActionMenuTrigger = trigger;
  playerActionMenu.hidden = false;
  syncPlayerActionMenuTriggerState();
  requestAnimationFrame(() => {
    playerMenuGraphicalPhrase.focus();
  });
}

function closePlayerActionMenu(options: { restoreFocus?: boolean } = {}): void {
  if (!playerActionMenuOpen) return;
  const trigger = playerActionMenuTrigger;
  playerActionMenuOpen = false;
  playerActionMenuTrigger = undefined;
  playerActionMenu.hidden = true;
  syncPlayerActionMenuTriggerState();
  if (options.restoreFocus !== false) {
    trigger?.focus();
  }
}

function syncPlayerActionMenuTriggerState(): void {
  const expanded = String(playerActionMenuOpen);
  playerEntryMelody.setAttribute("aria-expanded", expanded);
  getMelodyPlayerCard()?.setAttribute("aria-expanded", expanded);
}

function getMelodyPlayerActionTrigger(): HTMLElement | null {
  return playerActionMenuTrigger ?? playerEntryMelody ?? getMelodyPlayerCard();
}

function getMelodyPlayerCard(): HTMLElement | null {
  return playerList.querySelector<HTMLElement>("[data-testid='player-card-melody']");
}

function canEditAnchorPhrase(): boolean {
  return writtenEvolvingRegime !== "evolving";
}

function getAnchorPhraseForEditor(): AnchorPhrase {
  if (isAnchorPhraseEditMode && workingAnchorPhrase) {
    return cloneAnchorPhrase(workingAnchorPhrase);
  }
  return cloneAnchorPhrase(getSelectedAnchorPhraseCatalogEntry().phrase);
}

function enterAnchorPhraseEditMode(): AnchorPhraseEditorState {
  if (!canEditAnchorPhrase()) {
    anchorPhraseEditorMessage = "Anchor editing pauses while the line is evolving.";
    isAnchorPhraseEditMode = false;
    workingAnchorPhrase = undefined;
    selectedAnchorRef = undefined;
    selectedConnectorRef = undefined;
    anchorPhraseAnchorPanelOpen = false;
    anchorPhraseConnectorPanelOpen = false;
    renderAnchorPhraseEditor();
    return getAnchorPhraseEditorState();
  }
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) {
    workingAnchorPhrase = createCurrentProsodyAnchorPhrase();
    anchorPhraseDraftActive = false;
    selectedAnchorRef = undefined;
    selectedConnectorRef = undefined;
    anchorPhraseAnchorPanelOpen = false;
    anchorPhraseConnectorPanelOpen = false;
    isAnchorPhraseEditMode = true;
    anchorPhraseEditorMessage = "Edit mode: select an anchor or connector to reveal its tools.";
    renderedAnchorPhraseEditorKey = "";
  }
  renderAnchorPhraseEditor();
  return getAnchorPhraseEditorState();
}

function exitAnchorPhraseEditMode(message = "Read-only prosody phrase."): AnchorPhraseEditorState {
  resetAnchorPhraseEditorSession(message, { refresh: true, render: true });
  return getAnchorPhraseEditorState();
}

function editAnchorPhraseAnchor(
  segmentIndex: number,
  anchorIndex: number,
  patch: AnchorEditPatch,
): AnchorEditResult {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) {
    return {
      changed: false,
      clamps: [],
      errors: ["Anchor edit mode is not active"],
      phrase: getAnchorPhraseForEditor(),
      valid: false,
      warnings: [],
    };
  }
  if (!canEditAnchorPhrase()) {
    return {
      changed: false,
      clamps: [],
      errors: ["Anchor editing is disabled while evolving"],
      phrase: cloneAnchorPhrase(workingAnchorPhrase),
      valid: false,
      warnings: [],
    };
  }
  const result = editAnchorInPhrase(workingAnchorPhrase, segmentIndex, anchorIndex, patch);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Edit rejected: ${result.errors[0] ?? "invalid anchor edit"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedAnchorRef = { segmentIndex, anchorIndex };
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = true;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseEditorMessage = result.clamps.length > 0
    ? `Edit applied with ${result.clamps.length} clamp${result.clamps.length === 1 ? "" : "s"}.`
    : "Edit applied.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function editAnchorPhraseConnector(
  segmentIndex: number,
  connectorIndex: number,
  patch: ConnectorEditPatch,
): AnchorEditResult {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) {
    return {
      changed: false,
      clamps: [],
      errors: ["Anchor edit mode is not active"],
      phrase: getAnchorPhraseForEditor(),
      valid: false,
      warnings: [],
    };
  }
  if (!canEditAnchorPhrase()) {
    return {
      changed: false,
      clamps: [],
      errors: ["Connector editing is disabled while evolving"],
      phrase: cloneAnchorPhrase(workingAnchorPhrase),
      valid: false,
      warnings: [],
    };
  }
  const result = editConnectorInPhrase(workingAnchorPhrase, segmentIndex, connectorIndex, patch);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Connector edit rejected: ${result.errors[0] ?? "invalid connector edit"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedConnectorRef = { segmentIndex, connectorIndex };
  selectedAnchorRef = undefined;
  anchorPhraseConnectorPanelOpen = true;
  anchorPhraseAnchorPanelOpen = false;
  anchorPhraseEditorMessage = result.clamps.length > 0
    ? `Connector edit applied with ${result.clamps.length} clamp${result.clamps.length === 1 ? "" : "s"}.`
    : "Connector edit applied.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function addAnchorPhraseAnchor(
  segmentIndex: number,
  atBeat: number,
  options: AddAnchorOptions = {},
): AnchorEditResult {
  const inactive = getInactiveAnchorPhraseEditorResult("Anchor edit mode is not active");
  if (inactive) return inactive;
  const disabled = getDisabledAnchorPhraseEditorResult("Anchor editing is disabled while evolving");
  if (disabled) return disabled;
  const result = addAnchorToPhrase(workingAnchorPhrase!, segmentIndex, atBeat, options);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Add rejected: ${result.errors[0] ?? "invalid anchor add"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedAnchorRef = selectNearestAnchor(result.phrase, segmentIndex, atBeat);
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = true;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseEditorMessage = result.clamps.length > 0
    ? `Anchor added with ${result.clamps.length} clamp${result.clamps.length === 1 ? "" : "s"}.`
    : "Anchor added.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function removeAnchorPhraseAnchor(segmentIndex: number, anchorIndex: number): AnchorEditResult {
  const inactive = getInactiveAnchorPhraseEditorResult("Anchor edit mode is not active");
  if (inactive) return inactive;
  const disabled = getDisabledAnchorPhraseEditorResult("Anchor editing is disabled while evolving");
  if (disabled) return disabled;
  const result = removeAnchorFromPhrase(workingAnchorPhrase!, segmentIndex, anchorIndex);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Remove rejected: ${result.errors[0] ?? "invalid anchor remove"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedAnchorRef = selectAnchorAfterRemoval(result.phrase, segmentIndex, anchorIndex);
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = Boolean(selectedAnchorRef);
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseEditorMessage = "Anchor removed.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function splitAnchorPhraseSegment(segmentIndex: number, anchorIndex: number): AnchorEditResult {
  const inactive = getInactiveAnchorPhraseEditorResult("Anchor edit mode is not active");
  if (inactive) return inactive;
  const disabled = getDisabledAnchorPhraseEditorResult("Anchor editing is disabled while evolving");
  if (disabled) return disabled;
  const result = splitSegmentInPhrase(workingAnchorPhrase!, segmentIndex, anchorIndex);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Split rejected: ${result.errors[0] ?? "invalid segment split"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedAnchorRef = { segmentIndex: Math.min(segmentIndex + 1, result.phrase.segments.length - 1), anchorIndex: 0 };
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = true;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseEditorMessage = "Breath opened.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function joinAnchorPhraseSegments(segmentIndex: number): AnchorEditResult {
  const inactive = getInactiveAnchorPhraseEditorResult("Anchor edit mode is not active");
  if (inactive) return inactive;
  const disabled = getDisabledAnchorPhraseEditorResult("Anchor editing is disabled while evolving");
  if (disabled) return disabled;
  const bridgeIndex = workingAnchorPhrase?.segments[segmentIndex]?.connectors.length ?? 0;
  const result = joinSegmentsInPhrase(workingAnchorPhrase!, segmentIndex);
  if (!result.valid) {
    anchorPhraseEditorMessage = `Join rejected: ${result.errors[0] ?? "invalid segment join"}`;
    renderAnchorPhraseEditor();
    return result;
  }
  workingAnchorPhrase = result.phrase;
  selectedConnectorRef = result.phrase.segments[segmentIndex]?.connectors[bridgeIndex]
    ? { segmentIndex, connectorIndex: bridgeIndex }
    : undefined;
  selectedAnchorRef = selectedConnectorRef ? undefined : selectAnchorAfterRemoval(result.phrase, segmentIndex, 0);
  anchorPhraseConnectorPanelOpen = Boolean(selectedConnectorRef);
  anchorPhraseAnchorPanelOpen = !selectedConnectorRef && Boolean(selectedAnchorRef);
  anchorPhraseEditorMessage = "Breath joined.";
  commitAnchorPhraseEditorOverride();
  return result;
}

function getAnchorPhraseEditorBranchId(nextSongId: SongId = songId): string {
  return `editor-${nextSongId}`;
}

function resetAnchorPhraseEditorSaveState(): void {
  anchorPhraseEditorSaveInFlight = false;
  anchorPhraseEditorSavedCount = undefined;
  anchorPhraseEditorLastSavedCandidateId = undefined;
  anchorPhraseCatalogCandidates = [];
  anchorPhraseCatalogSelectedId = "generated";
  anchorPhraseDraftActive = false;
  anchorPhraseCatalogLoading = false;
  anchorPhraseCatalogListOpen = false;
}

async function refreshAnchorPhraseEditorSavedCount(
  options: { render?: boolean } = {},
): Promise<number | undefined> {
  const catalog = await refreshAnchorPhraseCatalog(options);
  return catalog?.entries.filter((entry) => entry.source === "candidate").length;
}

async function refreshAnchorPhraseCatalog(
  options: { render?: boolean; selectId?: string } = {},
): Promise<AnchorPhraseCatalogState | undefined> {
  const branchId = getAnchorPhraseEditorBranchId();
  anchorPhraseCatalogLoading = true;
  if (options.render) {
    renderAnchorPhraseEditor();
  }
  try {
    const candidates = await persistence.listCandidates({
      kind: "phrase",
      branchId,
      limit: 500,
    });
    anchorPhraseCatalogCandidates = candidates
      .filter((candidate) => candidate.status !== "purged")
      .sort(compareAnchorPhraseCatalogCandidates);
    anchorPhraseEditorSavedCount = anchorPhraseCatalogCandidates.length;
    if (options.selectId) {
      anchorPhraseCatalogSelectedId = options.selectId;
    }
    ensureAnchorPhraseCatalogSelection();
    anchorPhraseCatalogLoading = false;
    if (options.render) {
      renderAnchorPhraseEditor();
    }
    return getAnchorPhraseCatalogState();
  } catch (error) {
    console.warn("[grow] failed to refresh phrase idea catalog", error);
    anchorPhraseCatalogLoading = false;
    if (options.render) {
      renderAnchorPhraseEditor();
    }
    return undefined;
  }
}

function compareAnchorPhraseCatalogCandidates(left: StoredCandidate, right: StoredCandidate): number {
  return (
    right.fitness - left.fitness ||
    left.generation - right.generation ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function ensureAnchorPhraseCatalogSelection(): void {
  const entries = getAnchorPhraseCatalogEntries();
  if (!entries.some((entry) => entry.id === anchorPhraseCatalogSelectedId)) {
    anchorPhraseCatalogSelectedId = entries[0]?.id ?? "generated";
  }
}

function getAnchorPhraseCatalogEntries(): AnchorPhraseCatalogEntry[] {
  const generatedPhrase = createCurrentProsodyAnchorPhrase();
  const generatedPattern = renderAnchorPhrase(generatedPhrase, {
    baseOctave: 4,
    playerId: "melody",
    subdivisionBeats: ANCHOR_EDIT_GRID_BEATS,
  });
  const draftEntries: AnchorPhraseCatalogEntry[] = anchorPhraseDraftActive && workingAnchorPhrase
    ? [createAnchorPhraseCatalogDraftEntry(workingAnchorPhrase)]
    : [];
  return [
    {
      editable: true,
      id: "generated",
      label: "Generated",
      pattern: generatedPattern,
      phrase: generatedPhrase,
      source: "generated",
      tag: "current prosody",
    },
    ...draftEntries,
    ...anchorPhraseCatalogCandidates.map(createAnchorPhraseCatalogCandidateEntry),
  ];
}

function createAnchorPhraseCatalogDraftEntry(phrase: AnchorPhrase): AnchorPhraseCatalogEntry {
  return {
    editable: true,
    id: ANCHOR_PHRASE_DRAFT_ID,
    label: "New idea",
    pattern: renderAnchorPhrase(phrase, {
      baseOctave: 4,
      playerId: "melody",
      subdivisionBeats: ANCHOR_EDIT_GRID_BEATS,
    }),
    phrase: cloneAnchorPhrase(phrase),
    source: "draft",
    tag: "new · unsaved",
  };
}

function createAnchorPhraseCatalogCandidateEntry(candidate: StoredCandidate): AnchorPhraseCatalogEntry {
  const genome: unknown = candidate.genome;
  const pattern = renderPhraseCandidateGenome(genome);
  const native = isAnchorPhraseCandidateGenome(genome);
  const phrase = native
    ? createAnchorPhraseCandidateGenome(genome.phrase, genome.renderOptions).phrase
    : anchorPhraseFromPlayerPatternSource(pattern);
  const origin = candidate.generation === 0 ? "authored" : "evolved";
  const label = `Idea ${shortCandidateId(candidate.id)}`;
  return {
    candidate,
    candidateId: candidate.id,
    editable: native,
    fitness: candidate.fitness,
    generation: candidate.generation,
    id: candidate.id,
    label,
    pattern,
    phrase,
    source: "candidate",
    status: candidate.status,
    tag: `${origin} · ${candidate.status} · fitness ${candidate.fitness.toFixed(3)}`,
  };
}

function shortCandidateId(candidateId: string): string {
  return candidateId.length > 12 ? candidateId.slice(-12) : candidateId;
}

function getSelectedAnchorPhraseCatalogEntry(): AnchorPhraseCatalogEntry {
  const entries = getAnchorPhraseCatalogEntries();
  return entries.find((entry) => entry.id === anchorPhraseCatalogSelectedId) ?? entries[0]!;
}

function getAnchorPhraseCatalogSelectedIndex(entries = getAnchorPhraseCatalogEntries()): number {
  return Math.max(0, entries.findIndex((entry) => entry.id === anchorPhraseCatalogSelectedId));
}

function getAnchorPhraseCatalogState(): AnchorPhraseCatalogState {
  const entries = getAnchorPhraseCatalogEntries();
  const selectedIndex = getAnchorPhraseCatalogSelectedIndex(entries);
  const selected = entries[selectedIndex] ?? entries[0]!;
  return {
    branchId: getAnchorPhraseEditorBranchId(),
    entries: entries.map(summarizeAnchorPhraseCatalogEntry),
    loading: anchorPhraseCatalogLoading,
    selectedId: selected.id,
    selectedIndex,
    selectedPattern: clonePlayerPatternSource(selected.pattern),
    selectedPhrase: cloneAnchorPhrase(selected.phrase),
    total: entries.length,
  };
}

function summarizeAnchorPhraseCatalogEntry(entry: AnchorPhraseCatalogEntry): AnchorPhraseCatalogEntrySummary {
  return {
    ...(entry.candidateId ? { candidateId: entry.candidateId } : {}),
    editable: entry.editable,
    ...(entry.fitness === undefined ? {} : { fitness: entry.fitness }),
    ...(entry.generation === undefined ? {} : { generation: entry.generation }),
    id: entry.id,
    label: entry.label,
    source: entry.source,
    ...(entry.status ? { status: entry.status } : {}),
    tag: entry.tag,
  };
}

function selectAnchorPhraseCatalogIndex(index: number): AnchorPhraseCatalogState {
  const entries = getAnchorPhraseCatalogEntries();
  const nextIndex = Math.min(Math.max(0, Math.trunc(index)), entries.length - 1);
  anchorPhraseCatalogSelectedId = entries[nextIndex]?.id ?? "generated";
  anchorPhraseEditorMessage = `Selected ${entries[nextIndex]?.label ?? "generated phrase"} for browsing.`;
  renderedAnchorPhraseEditorKey = "";
  renderAnchorPhraseEditor();
  return getAnchorPhraseCatalogState();
}

function stepAnchorPhraseCatalog(delta: number): AnchorPhraseCatalogState {
  const entries = getAnchorPhraseCatalogEntries();
  const currentIndex = getAnchorPhraseCatalogSelectedIndex(entries);
  const nextIndex = entries.length === 0
    ? 0
    : (currentIndex + delta + entries.length) % entries.length;
  return selectAnchorPhraseCatalogIndex(nextIndex);
}

function previewSelectedAnchorPhraseCatalogEntry(): AnchorPhraseEditorSaveResult {
  const branchId = getAnchorPhraseEditorBranchId();
  if (!canEditAnchorPhrase()) {
    anchorPhraseEditorMessage = "Preview is disabled while the line is evolving.";
    renderAnchorPhraseEditor();
    return { branchId, valid: false, error: "Anchor editing is disabled while evolving" };
  }
  const selected = getSelectedAnchorPhraseCatalogEntry();
  editorMelodyOverride = clonePlayerPatternSource(selected.pattern);
  cachedProsodyMelody = undefined;
  cancelSlowThinkingControllers("phrase catalog preview changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  anchorPhraseEditorMessage = `Previewing ${selected.label}.`;
  renderWorld();
  return {
    branchId,
    candidate: selected.candidate,
    rendered: clonePlayerPatternSource(selected.pattern),
    valid: true,
  };
}

function editSelectedAnchorPhraseCatalogEntry(): AnchorPhraseEditorState {
  if (!canEditAnchorPhrase()) {
    anchorPhraseEditorMessage = "Edit this idea is disabled while the line is evolving.";
    renderAnchorPhraseEditor();
    return getAnchorPhraseEditorState();
  }
  const selected = getSelectedAnchorPhraseCatalogEntry();
  if (!selected.editable) {
    anchorPhraseEditorMessage = "Legacy flat phrase ideas are view-only in this catalog.";
    renderAnchorPhraseEditor();
    return getAnchorPhraseEditorState();
  }
  workingAnchorPhrase = cloneAnchorPhrase(selected.phrase);
  anchorPhraseDraftActive = false;
  selectedAnchorRef = undefined;
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = false;
  anchorPhraseConnectorPanelOpen = false;
  isAnchorPhraseEditMode = true;
  anchorPhraseEditorMessage = `Editing ${selected.label}.`;
  commitAnchorPhraseEditorOverride();
  return getAnchorPhraseEditorState();
}

function startNewAnchorPhraseIdea(): AnchorPhraseEditorState {
  if (!canEditAnchorPhrase()) {
    anchorPhraseEditorMessage = "New ideas are disabled while the line is evolving.";
    renderAnchorPhraseEditor();
    return getAnchorPhraseEditorState();
  }
  workingAnchorPhrase = createMinimalAuthoringAnchorPhrase(4);
  selectedAnchorRef = undefined;
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = false;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseConnectorMoreOpen = false;
  anchorPhraseDraftActive = true;
  anchorPhraseCatalogSelectedId = ANCHOR_PHRASE_DRAFT_ID;
  isAnchorPhraseEditMode = true;
  anchorPhraseEditorMessage = "New idea: home to dominant and back. Edit it, then save when it feels right.";
  commitAnchorPhraseEditorOverride();
  return getAnchorPhraseEditorState();
}

function createAnchorPhraseEditorCandidate(phrase: AnchorPhrase): {
  candidate: CandidateInput;
  rendered: PlayerPatternSource;
} {
  const genome = createAnchorPhraseCandidateGenome(phrase, {
    baseOctave: 4,
    playerId: "melody",
    subdivisionBeats: ANCHOR_EDIT_GRID_BEATS,
  });
  const rendered = renderPhraseCandidateGenome(genome);
  const score = scoreProsody(rendered, [4, 4]);
  return {
    candidate: {
      kind: "phrase",
      genome,
      scores: { ...score.subscores },
      fitness: score.overall,
      generation: 0,
      seed: prosodySeedForSong(songId),
      status: "alive",
    },
    rendered,
  };
}

async function saveAnchorPhraseEditorCandidate(): Promise<AnchorPhraseEditorSaveResult> {
  const branchId = getAnchorPhraseEditorBranchId();
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) {
    anchorPhraseEditorMessage = "Enter edit mode before saving a phrase idea.";
    renderAnchorPhraseEditor();
    return { branchId, valid: false, error: "Anchor edit mode is not active" };
  }
  if (!canEditAnchorPhrase()) {
    anchorPhraseEditorMessage = "Save is disabled while the line is evolving.";
    renderAnchorPhraseEditor();
    return { branchId, valid: false, error: "Anchor editing is disabled while evolving" };
  }
  if (anchorPhraseEditorSaveInFlight) {
    return { branchId, valid: false, error: "Save already in progress" };
  }

  anchorPhraseEditorSaveInFlight = true;
  anchorPhraseEditorMessage = "Saving phrase idea...";
  renderAnchorPhraseEditor();

  try {
    const { candidate, rendered } = createAnchorPhraseEditorCandidate(workingAnchorPhrase);
    const stored = await persistence.writeCandidate(candidate, branchId);
    anchorPhraseEditorLastSavedCandidateId = stored.id;
    anchorPhraseDraftActive = false;
    const catalog = await refreshAnchorPhraseCatalog({ render: false, selectId: stored.id });
    anchorPhraseEditorMessage = `Saved phrase idea to ${branchId}.`;
    return {
      branchId,
      candidate: stored,
      rendered: clonePlayerPatternSource(rendered),
      savedCount: catalog?.entries.filter((entry) => entry.source === "candidate").length,
      valid: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    anchorPhraseEditorMessage = `Save failed: ${message}`;
    return { branchId, valid: false, error: message };
  } finally {
    anchorPhraseEditorSaveInFlight = false;
    renderAnchorPhraseEditor();
  }
}

function getInactiveAnchorPhraseEditorResult(message: string): AnchorEditResult | undefined {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) {
    return {
      changed: false,
      clamps: [],
      errors: [message],
      phrase: getAnchorPhraseForEditor(),
      valid: false,
      warnings: [],
    };
  }
  return undefined;
}

function getDisabledAnchorPhraseEditorResult(message: string): AnchorEditResult | undefined {
  if (!canEditAnchorPhrase() && workingAnchorPhrase) {
    return {
      changed: false,
      clamps: [],
      errors: [message],
      phrase: cloneAnchorPhrase(workingAnchorPhrase),
      valid: false,
      warnings: [],
    };
  }
  return undefined;
}

function commitAnchorPhraseEditorOverride(): void {
  if (!workingAnchorPhrase) return;
  editorMelodyOverride = renderAnchorPhrase(workingAnchorPhrase, {
    baseOctave: 4,
    playerId: "melody",
    subdivisionBeats: ANCHOR_EDIT_GRID_BEATS,
  });
  cachedProsodyMelody = undefined;
  cancelSlowThinkingControllers("phrase editor override changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  renderedAnchorPhraseEditorKey = "";
  renderWorld();
}

function resetAnchorPhraseEditorSession(
  message: string,
  options: { refresh: boolean; render: boolean },
): void {
  const hadOverride = Boolean(editorMelodyOverride);
  isAnchorPhraseEditMode = false;
  workingAnchorPhrase = undefined;
  anchorPhraseDraftActive = false;
  selectedAnchorRef = undefined;
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = false;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseConnectorMoreOpen = false;
  editorMelodyOverride = undefined;
  anchorPhraseEditorMessage = canEditAnchorPhrase() ? message : "Anchor editing pauses while the line is evolving.";
  renderedAnchorPhraseEditorKey = "";
  if (hadOverride && options.refresh) {
    cancelSlowThinkingControllers("phrase editor override cleared before the thought could land");
    clearSlowThoughtPlayback();
    refreshLookaheadSchedule();
  }
  if (options.render) {
    renderWorld();
  }
}

function getAnchorPhraseEditorState(): AnchorPhraseEditorState {
  return {
    canEdit: canEditAnchorPhrase(),
    editMode: isAnchorPhraseEditMode,
    message: anchorPhraseEditorMessage,
    overrideActive: Boolean(editorMelodyOverride),
    saveBranchId: getAnchorPhraseEditorBranchId(),
    saveInFlight: anchorPhraseEditorSaveInFlight,
    ...(anchorPhraseEditorLastSavedCandidateId ? { savedCandidateId: anchorPhraseEditorLastSavedCandidateId } : {}),
    ...(anchorPhraseEditorSavedCount === undefined ? {} : { savedCount: anchorPhraseEditorSavedCount }),
    ...(selectedAnchorRef ? { selectedAnchor: { ...selectedAnchorRef } } : {}),
    ...(selectedConnectorRef ? { selectedConnector: { ...selectedConnectorRef } } : {}),
    ...(workingAnchorPhrase ? { workingPhrase: cloneAnchorPhrase(workingAnchorPhrase) } : {}),
  };
}

function getAnchorPhraseEditorOverridePattern(): PlayerPatternSource | undefined {
  return editorMelodyOverride ? clonePlayerPatternSource(editorMelodyOverride) : undefined;
}

function renderAnchorPhraseEditor(): void {
  if (!isAnchorPhraseEditorOpen) return;
  if (!canEditAnchorPhrase() && isAnchorPhraseEditMode) {
    resetAnchorPhraseEditorSession("Anchor editing pauses while the line is evolving.", {
      refresh: true,
      render: false,
    });
  }
  const phrase = getAnchorPhraseForEditor();
  const tonalContext = world.getTonalContext();
  renderTonalContextDisplay(anchorPhraseEditorTonal, tonalContext);
  anchorPhraseEditorSong.textContent = getSongLabel(songId);
  const summary = formatAnchorPhraseSummary(phrase);
  anchorPhraseEditorSummary.textContent = summary;
  const canEdit = canEditAnchorPhrase();
  anchorPhraseEditor.classList.toggle("is-editing", isAnchorPhraseEditMode);
  anchorPhraseEditor.classList.toggle("is-edit-disabled", !canEdit);
  anchorPhraseEditorEditToggle.disabled = !canEdit;
  anchorPhraseEditorEditToggle.textContent = isAnchorPhraseEditMode ? "Editing anchors" : "Edit anchors";
  anchorPhraseEditorEditToggle.setAttribute("aria-pressed", String(isAnchorPhraseEditMode));
  anchorPhraseEditorRevert.disabled = !isAnchorPhraseEditMode && !editorMelodyOverride;
  anchorPhraseEditorSave.disabled = !isAnchorPhraseEditMode || !workingAnchorPhrase || !canEdit || anchorPhraseEditorSaveInFlight;
  anchorPhraseEditorSave.textContent = anchorPhraseEditorSaveInFlight ? "Saving..." : "Save idea";
  anchorPhraseEditorSaveStatus.textContent = formatAnchorPhraseEditorSaveStatus();
  anchorPhraseEditorStatus.textContent = canEdit ? anchorPhraseEditorMessage : "Anchor editing pauses while the line is evolving.";
  renderAnchorPhraseCatalogControls();
  renderAnchorPhraseEditorSelection(phrase);
  renderAnchorPhraseEditorDisclosures();
  const renderKey = [
    songId,
    prosodySeedForSong(songId),
    isAnchorPhraseEditMode ? "edit" : "read",
    selectedAnchorRef ? `${selectedAnchorRef.segmentIndex}:${selectedAnchorRef.anchorIndex}` : "none",
    selectedConnectorRef ? `${selectedConnectorRef.segmentIndex}:${selectedConnectorRef.connectorIndex}` : "none",
    anchorPhraseCatalogSelectedId,
    summary,
    JSON.stringify(phrase),
  ].join("|");
  if (renderKey !== renderedAnchorPhraseEditorKey) {
    anchorPhraseEditorRoll.innerHTML = renderAnchorPhraseEditorSvg(phrase, {
      selectedAnchor: selectedAnchorRef,
      selectedConnector: selectedConnectorRef,
    });
    renderedAnchorPhraseEditorKey = renderKey;
  }
}

function renderAnchorPhraseEditorSelection(phrase: AnchorPhrase): void {
  const anchorRef = selectedAnchorRef;
  const selectedAnchor = anchorRef
    ? phrase.segments[anchorRef.segmentIndex]?.anchors[anchorRef.anchorIndex]
    : undefined;
  const connectorRef = selectedConnectorRef;
  const selectedConnector = connectorRef
    ? phrase.segments[connectorRef.segmentIndex]?.connectors[connectorRef.connectorIndex]
    : undefined;
  const controlsEnabled = isAnchorPhraseEditMode && canEditAnchorPhrase();
  const totalAnchors = countAnchorPhraseAnchors(phrase);
  const joinSegmentIndex = getSelectedJoinSegmentIndex(phrase);

  if (!controlsEnabled || !anchorRef || !selectedAnchor) {
    anchorPhraseEditorSelected.textContent = "No anchor selected";
    anchorPhraseEditorDynamics.disabled = true;
    anchorPhraseEditorDynamics.value = "0.7";
  } else {
    anchorPhraseEditorSelected.textContent = `Segment ${anchorRef.segmentIndex + 1}, anchor ${
      anchorRef.anchorIndex + 1
    } · degree ${selectedAnchor.degree}, octave ${selectedAnchor.octave}`;
    anchorPhraseEditorDynamics.disabled = false;
    anchorPhraseEditorDynamics.value = selectedAnchor.dynamics.toFixed(2);
  }
  anchorPhraseEditorAddAnchor.disabled = !controlsEnabled || !anchorRef || !selectedAnchor;
  anchorPhraseEditorRemoveAnchor.disabled = !controlsEnabled || !anchorRef || !selectedAnchor || totalAnchors <= 1;
  anchorPhraseEditorSplitSegment.disabled = !controlsEnabled || !anchorRef || !selectedAnchor || anchorRef.anchorIndex <= 0;
  anchorPhraseEditorJoinSegments.disabled = !controlsEnabled || joinSegmentIndex === undefined;

  renderAnchorPhraseEditorConnectorControls(controlsEnabled ? selectedConnector : undefined);
  if (controlsEnabled && connectorRef && selectedConnector) {
    anchorPhraseEditorSelected.textContent = `Segment ${connectorRef.segmentIndex + 1}, connector ${
      connectorRef.connectorIndex + 1
    } · ${selectedConnector.kernel}`;
  }
}

function renderAnchorPhraseEditorDisclosures(): void {
  const anchorOpen = anchorPhraseAnchorPanelOpen && isAnchorPhraseEditMode;
  const connectorOpen = anchorPhraseConnectorPanelOpen && isAnchorPhraseEditMode;
  anchorPhraseEditorAnchorPanel.hidden = !anchorOpen;
  anchorPhraseEditorAnchorPanelToggle.setAttribute("aria-expanded", String(anchorOpen));
  anchorPhraseEditorAnchorPanelToggle.querySelector(".phrase-editor__panel-cue")!.textContent = selectedAnchorRef
    ? "Selected"
    : "Select one";
  anchorPhraseEditorConnectorPanel.hidden = !connectorOpen;
  anchorPhraseEditorConnectorPanelToggle.setAttribute("aria-expanded", String(connectorOpen));
  anchorPhraseEditorConnectorPanelToggle.querySelector(".phrase-editor__panel-cue")!.textContent = selectedConnectorRef
    ? "Selected"
    : "Select one";
  anchorPhraseEditorConnectorMore.hidden = !anchorPhraseConnectorMoreOpen || !connectorOpen;
  anchorPhraseEditorConnectorMoreToggle.setAttribute(
    "aria-expanded",
    String(anchorPhraseConnectorMoreOpen && connectorOpen),
  );
}

function formatAnchorPhraseEditorSaveStatus(): string {
  const count = anchorPhraseEditorSavedCount;
  const branchId = getAnchorPhraseEditorBranchId();
  const countText = count === undefined ? "..." : String(count);
  return [
    `Saved ideas: ${countText}`,
    branchId,
    anchorPhraseEditorLastSavedCandidateId ? `last ${anchorPhraseEditorLastSavedCandidateId}` : undefined,
  ].filter(Boolean).join(" · ");
}

function renderAnchorPhraseCatalogControls(): void {
  const state = getAnchorPhraseCatalogState();
  const selected = state.entries[state.selectedIndex];
  const browseEnabled = !isAnchorPhraseEditMode && state.total > 1;
  anchorPhraseEditorCatalogPrev.disabled = !browseEnabled || state.loading;
  anchorPhraseEditorCatalogNext.disabled = !browseEnabled || state.loading;
  anchorPhraseEditorIdeaIndex.textContent = state.loading
    ? "Loading ideas..."
    : `Idea ${state.selectedIndex + 1} of ${state.total}`;
  anchorPhraseEditorIdeaDetail.textContent = selected
    ? `${selected.label} · ${selected.tag}`
    : "Generated · current prosody";
  const actionEnabled = canEditAnchorPhrase() && !state.loading && !isAnchorPhraseEditMode;
  anchorPhraseEditorNewIdea.disabled = !actionEnabled || anchorPhraseEditorSaveInFlight;
  anchorPhraseEditorPreview.disabled = !actionEnabled;
  anchorPhraseEditorEditSelected.disabled = !actionEnabled || !selected?.editable;
  anchorPhraseEditorEditSelected.title = selected && !selected.editable
    ? "Legacy flat phrase ideas are view-only in this catalog."
    : "";
  anchorPhraseEditorCatalogList.hidden = !anchorPhraseCatalogListOpen;
  anchorPhraseEditorCatalogListToggle.setAttribute("aria-expanded", String(anchorPhraseCatalogListOpen));
  anchorPhraseEditorCatalogList.innerHTML = state.entries.map((entry, index) => `
    <button
      class="phrase-editor__catalog-item${index === state.selectedIndex ? " is-selected" : ""}"
      data-catalog-index="${index}"
      data-testid="anchor-phrase-editor-catalog-item"
      type="button"
      ${isAnchorPhraseEditMode ? "disabled" : ""}
    >
      <span>${entry.label}</span>
      <small>${entry.tag}</small>
    </button>
  `).join("");
}

function renderAnchorPhraseEditorConnectorControls(connector: Connector | undefined): void {
  const enabled = Boolean(connector);
  for (const button of anchorPhraseEditorKernelButtons) {
    const kernel = button.dataset.kernel;
    button.disabled = !enabled;
    button.setAttribute("aria-pressed", String(enabled && kernel === connector?.kernel));
  }
  for (const input of anchorPhraseEditorConnectorKnobs) {
    const knob = input.dataset.connectorKnob;
    input.disabled = !enabled;
    if (!connector || !knob || !isConnectorKnob(knob)) continue;
    input.value = String(connector[knob]);
  }
}

function selectAnchorPhraseEditorAnchor(ref: AnchorPhraseEditorAnchorRef): void {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) return;
  selectedAnchorRef = { ...ref };
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = true;
  anchorPhraseConnectorPanelOpen = false;
  anchorPhraseEditorMessage = `Selected segment ${ref.segmentIndex + 1}, anchor ${ref.anchorIndex + 1}.`;
  renderedAnchorPhraseEditorKey = "";
  renderAnchorPhraseEditor();
}

function selectAnchorPhraseEditorConnector(ref: AnchorPhraseEditorConnectorRef): void {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase) return;
  selectedConnectorRef = { ...ref };
  selectedAnchorRef = undefined;
  anchorPhraseConnectorPanelOpen = true;
  anchorPhraseAnchorPanelOpen = false;
  anchorPhraseEditorMessage = `Selected segment ${ref.segmentIndex + 1}, connector ${ref.connectorIndex + 1}.`;
  renderedAnchorPhraseEditorKey = "";
  renderAnchorPhraseEditor();
}

function countAnchorPhraseAnchors(phrase: AnchorPhrase): number {
  return phrase.segments.reduce((sum, segment) => sum + segment.anchors.length, 0);
}

function selectNearestAnchor(
  phrase: AnchorPhrase,
  preferredSegmentIndex: number,
  atBeat: number,
): AnchorPhraseEditorAnchorRef | undefined {
  const segmentIndex = Math.min(Math.max(0, preferredSegmentIndex), phrase.segments.length - 1);
  const segment = phrase.segments[segmentIndex];
  if (!segment) return selectAnchorAfterRemoval(phrase, segmentIndex, 0);
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [index, anchor] of segment.anchors.entries()) {
    const distance = Math.abs(anchor.startBeat - atBeat);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return { anchorIndex: nearestIndex, segmentIndex };
}

function selectAnchorAfterRemoval(
  phrase: AnchorPhrase,
  preferredSegmentIndex: number,
  preferredAnchorIndex: number,
): AnchorPhraseEditorAnchorRef | undefined {
  if (phrase.segments.length === 0) return undefined;
  const segmentIndex = Math.min(Math.max(0, preferredSegmentIndex), phrase.segments.length - 1);
  const segment = phrase.segments[segmentIndex];
  if (!segment || segment.anchors.length === 0) return undefined;
  return {
    anchorIndex: Math.min(Math.max(0, preferredAnchorIndex), segment.anchors.length - 1),
    segmentIndex,
  };
}

function getSelectedJoinSegmentIndex(phrase: AnchorPhrase): number | undefined {
  const segmentIndex = selectedAnchorRef?.segmentIndex ?? selectedConnectorRef?.segmentIndex;
  if (segmentIndex === undefined) return undefined;
  return phrase.segments[segmentIndex + 1] ? segmentIndex : undefined;
}

function findAnchorPhraseSegmentIndexForBeat(phrase: AnchorPhrase, beat: number): number {
  for (let index = 0; index < phrase.segments.length; index += 1) {
    const segment = phrase.segments[index];
    const next = phrase.segments[index + 1];
    const segmentStart = segment?.anchors[0]?.startBeat ?? 0;
    const nextStart = next?.anchors[0]?.startBeat ?? Number.POSITIVE_INFINITY;
    if (beat >= segmentStart && beat < nextStart) return index;
  }
  return Math.max(0, phrase.segments.length - 1);
}

function isConnectorKnob(value: string): value is "bias" | "density" | "pull" | "reach" | "skew" {
  return value === "bias" || value === "density" || value === "pull" || value === "reach" || value === "skew";
}

function createConnectorKnobPatch(
  knob: "bias" | "density" | "pull" | "reach" | "skew",
  value: number,
): ConnectorEditPatch {
  switch (knob) {
    case "bias":
      return { bias: value };
    case "density":
      return { density: value };
    case "pull":
      return { pull: value };
    case "reach":
      return { reach: value };
    case "skew":
      return { skew: value };
  }
}

function handleAnchorPhraseEditorPointerDown(event: PointerEvent): void {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase || !canEditAnchorPhrase()) return;
  const target = event.target instanceof Element
    ? event.target.closest<SVGGElement>("[data-testid='anchor-phrase-editor-anchor']")
    : null;
  if (!target) return;
  const segmentIndex = Number(target.dataset.segmentIndex);
  const anchorIndex = Number(target.dataset.anchorIndex);
  if (!Number.isInteger(segmentIndex) || !Number.isInteger(anchorIndex)) return;
  selectedAnchorRef = { segmentIndex, anchorIndex };
  selectedConnectorRef = undefined;
  anchorPhraseAnchorPanelOpen = true;
  anchorPhraseConnectorPanelOpen = false;
  const rect = target.querySelector("rect")?.getBoundingClientRect();
  const mode = rect && event.clientX >= rect.right - 10 ? "resize" : "move";
  anchorPhraseEditorDrag = { segmentIndex, anchorIndex, mode };
  anchorPhraseEditorRoll.setPointerCapture(event.pointerId);
  event.preventDefault();
  applyAnchorPhraseEditorPointerEdit(event, anchorPhraseEditorDrag);
}

function handleAnchorPhraseEditorPointerMove(event: PointerEvent): void {
  if (!anchorPhraseEditorDrag) return;
  event.preventDefault();
  applyAnchorPhraseEditorPointerEdit(event, anchorPhraseEditorDrag);
}

function handleAnchorPhraseEditorPointerUp(event: PointerEvent): void {
  if (!anchorPhraseEditorDrag) return;
  anchorPhraseEditorDrag = undefined;
  if (anchorPhraseEditorRoll.hasPointerCapture(event.pointerId)) {
    anchorPhraseEditorRoll.releasePointerCapture(event.pointerId);
  }
}

function applyAnchorPhraseEditorPointerEdit(event: PointerEvent, drag: AnchorPhraseEditorDragState): void {
  if (!workingAnchorPhrase) return;
  const anchor = workingAnchorPhrase.segments[drag.segmentIndex]?.anchors[drag.anchorIndex];
  if (!anchor) return;
  const point = getAnchorPhraseEditorPointerValue(event, workingAnchorPhrase);
  if (!point) return;
  if (drag.mode === "resize") {
    editAnchorPhraseAnchor(drag.segmentIndex, drag.anchorIndex, {
      durationBeats: point.beat - anchor.startBeat,
    });
    return;
  }
  editAnchorPhraseAnchor(drag.segmentIndex, drag.anchorIndex, {
    degree: point.degree,
    octave: point.octave,
    startBeat: point.beat,
  });
}

function getAnchorPhraseEditorPointerValue(
  event: MouseEvent | PointerEvent,
  phrase: AnchorPhrase,
): { beat: number; degree: number; octave: number } | undefined {
  const svg = anchorPhraseEditorRoll.querySelector<SVGSVGElement>("[data-testid='anchor-phrase-editor-svg']");
  if (!svg) return undefined;
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const layout = createAnchorPhraseEditorLayout(phrase);
  const viewX = ((event.clientX - rect.left) / rect.width) * layout.width;
  const viewY = ((event.clientY - rect.top) / rect.height) * layout.height;
  const beatProgress = (viewX - layout.padding.left) / layout.plotWidth;
  const beat = clamp(beatProgress, 0, 1) * layout.phraseBeats;
  const pitchProgress = (viewY - layout.padding.top) / layout.plotHeight;
  const pitchValue = Math.round(layout.maxPitch - clamp(pitchProgress, 0, 1) * (layout.maxPitch - layout.minPitch));
  const degreeZero = ((pitchValue % 7) + 7) % 7;
  return {
    beat,
    degree: degreeZero + 1,
    octave: Math.floor(pitchValue / 7),
  };
}

function createCurrentProsodyAnchorPhrase(options?: { seed?: number; baseOctave?: number; bars?: number }): AnchorPhrase {
  return generateProsodicAnchorPhrase({
    seed: options?.seed ?? prosodySeedForSong(songId),
    baseOctave: options?.baseOctave ?? 4,
    bars: options?.bars ?? 4,
  });
}

function cloneAnchorPhrase(phrase: AnchorPhrase): AnchorPhrase {
  return {
    segments: phrase.segments.map((segment) => ({
      anchors: segment.anchors.map((anchor) => ({ ...anchor })),
      connectors: segment.connectors.map((connector) => ({ ...connector })),
    })),
  };
}

function formatAnchorPhraseSummary(phrase: AnchorPhrase): string {
  const anchors = phrase.segments.flatMap((segment) => [...segment.anchors]);
  const connectorCount = phrase.segments.reduce((sum, segment) => sum + segment.connectors.length, 0);
  const breathCount = countAnchorPhraseBreaths(phrase);
  return [
    `${phrase.segments.length} segments`,
    `${anchors.length} anchors`,
    `${connectorCount} connectors`,
    `${roundDisplayBeat(anchorPhraseEndBeat(phrase))} beats`,
    `${breathCount} breath${breathCount === 1 ? "" : "s"}`,
  ].join(" · ");
}

function renderAnchorPhraseEditorSvg(
  phrase: AnchorPhrase,
  options: {
    selectedAnchor?: AnchorPhraseEditorAnchorRef;
    selectedConnector?: AnchorPhraseEditorConnectorRef;
  } = {},
): string {
  const {
    height,
    maxPitch,
    minPitch,
    padding,
    phraseBeats,
    plotHeight,
    plotWidth,
    width,
  } = createAnchorPhraseEditorLayout(phrase);
  const xForBeat = (beat: number): number => padding.left + (beat / phraseBeats) * plotWidth;
  const yForAnchor = (anchor: Anchor): number =>
    padding.top + ((maxPitch - anchorPitchValue(anchor)) / Math.max(1, maxPitch - minPitch)) * plotHeight;

  const grid = Array.from({ length: phraseBeats + 1 }, (_, beat) => {
    const x = roundSvg(xForBeat(beat));
    const isBar = beat % 4 === 0;
    return `
      <line
        class="${isBar ? "phrase-editor-svg__bar-line" : "phrase-editor-svg__beat-line"}"
        x1="${x}"
        x2="${x}"
        y1="${padding.top}"
        y2="${height - padding.bottom}"
      />
      <text class="phrase-editor-svg__beat-label" x="${x}" y="${height - 18}">${beat}</text>
    `;
  }).join("");

  const breathBands = renderAnchorPhraseBreaths(phrase, xForBeat, padding.top, plotHeight);
  const connectorPaths = phrase.segments.map((segment, segmentIndex) =>
    renderAnchorPhraseSegmentConnectors(segment, xForBeat, yForAnchor, {
      segmentIndex,
      selectedConnector: options.selectedConnector,
    })
  ).join("");
  const anchorRects = phrase.segments.map((segment, segmentIndex) =>
    segment.anchors.map((anchor, anchorIndex) =>
      renderAnchorRect(anchor, xForBeat, yForAnchor, {
        anchorIndex,
        selected: options.selectedAnchor?.segmentIndex === segmentIndex &&
          options.selectedAnchor.anchorIndex === anchorIndex,
        segmentIndex,
      })
    ).join("")
  ).join("");

  return `
    <svg
      class="phrase-editor-svg"
      data-testid="anchor-phrase-editor-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Read-only anchor phrase roll"
      preserveAspectRatio="none"
    >
      <rect class="phrase-editor-svg__surface" x="0" y="0" width="${width}" height="${height}" rx="14" />
      <g aria-hidden="true">${grid}</g>
      <line
        class="phrase-editor-svg__axis"
        x1="${padding.left}"
        x2="${width - padding.right}"
        y1="${height - padding.bottom}"
        y2="${height - padding.bottom}"
      />
      ${breathBands}
      ${connectorPaths}
      ${anchorRects}
    </svg>
  `;
}

function createAnchorPhraseEditorLayout(phrase: AnchorPhrase): AnchorPhraseEditorLayout {
  const width = 960;
  const height = 420;
  const padding = { top: 34, right: 28, bottom: 46, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const phraseBeats = Math.max(4, Math.ceil(anchorPhraseEndBeat(phrase)));
  const anchors = phrase.segments.flatMap((segment) => [...segment.anchors]);
  const pitchValues = anchors.length > 0 ? anchors.map(anchorPitchValue) : [4 * 7];
  const rawMinPitch = Math.min(...pitchValues);
  const rawMaxPitch = Math.max(...pitchValues);
  const minPitch = rawMinPitch - 1;
  const maxPitch = Math.max(rawMaxPitch + 1, minPitch + 6);
  return {
    height,
    maxPitch,
    minPitch,
    padding,
    phraseBeats,
    plotHeight,
    plotWidth,
    width,
  };
}

function renderAnchorPhraseSegmentConnectors(
  segment: AnchorPhraseSegment,
  xForBeat: (beat: number) => number,
  yForAnchor: (anchor: Anchor) => number,
  options: { segmentIndex: number; selectedConnector?: AnchorPhraseEditorConnectorRef },
): string {
  return segment.connectors.map((connector, index) => {
    const from = segment.anchors[index];
    const to = segment.anchors[index + 1];
    if (!from || !to) return "";
    const fromEnd = from.startBeat + from.durationBeats;
    if (to.startBeat <= fromEnd) return "";
    const x1 = xForBeat(fromEnd);
    const x2 = xForBeat(to.startBeat);
    const y1 = yForAnchor(from);
    const y2 = yForAnchor(to);
    const controlOffset = Math.max(18, (x2 - x1) * 0.42);
    const labelX = (x1 + x2) / 2;
    const labelY = Math.min(y1, y2) - 12;
    const isSelected = options.selectedConnector?.segmentIndex === options.segmentIndex &&
      options.selectedConnector.connectorIndex === index;
    return `
      <path
        data-testid="anchor-phrase-editor-connector"
        data-segment-index="${options.segmentIndex}"
        data-connector-index="${index}"
        class="phrase-editor-svg__connector phrase-editor-svg__connector--${connector.kernel}${isSelected ? " is-selected" : ""}"
        d="M ${roundSvg(x1)} ${roundSvg(y1)} C ${roundSvg(x1 + controlOffset)} ${roundSvg(y1)}, ${roundSvg(x2 - controlOffset)} ${roundSvg(y2)}, ${roundSvg(x2)} ${roundSvg(y2)}"
        stroke="${degreeColorVar(from.degree)}"
        tabindex="${isAnchorPhraseEditMode ? "0" : "-1"}"
        role="button"
        aria-label="${connector.kernel} connector ${index + 1} in segment ${options.segmentIndex + 1}"
      >
        <title>${connector.kernel} connector, density ${connector.density.toFixed(2)}, reach ${connector.reach.toFixed(2)}</title>
      </path>
      <text
        data-testid="anchor-phrase-editor-connector-label"
        data-segment-index="${options.segmentIndex}"
        data-connector-index="${index}"
        class="phrase-editor-svg__connector-label${isSelected ? " is-selected" : ""}"
        x="${roundSvg(labelX)}"
        y="${roundSvg(Math.max(18, labelY))}"
      >${connector.kernel}</text>
    `;
  }).join("");
}

function renderAnchorRect(
  anchor: Anchor,
  xForBeat: (beat: number) => number,
  yForAnchor: (anchor: Anchor) => number,
  options: { anchorIndex: number; segmentIndex: number; selected: boolean },
): string {
  const x = xForBeat(anchor.startBeat);
  const y = yForAnchor(anchor);
  const width = Math.max(12, xForBeat(anchor.startBeat + anchor.durationBeats) - x);
  const opacity = 0.44 + clamp(anchor.dynamics, 0, 1) * 0.52;
  return `
    <g
      data-testid="anchor-phrase-editor-anchor"
      data-segment-index="${options.segmentIndex}"
      data-anchor-index="${options.anchorIndex}"
      class="phrase-editor-svg__anchor${options.selected ? " is-selected" : ""}"
      tabindex="${isAnchorPhraseEditMode ? "0" : "-1"}"
      role="button"
      aria-label="Anchor ${options.anchorIndex + 1} in segment ${options.segmentIndex + 1}"
    >
      <rect
        x="${roundSvg(x)}"
        y="${roundSvg(y - 12)}"
        width="${roundSvg(width)}"
        height="24"
        rx="7"
        fill="${degreeColorVar(anchor.degree)}"
        opacity="${opacity.toFixed(2)}"
      >
        <title>degree ${anchor.degree}, octave ${anchor.octave}, beat ${roundDisplayBeat(anchor.startBeat)}, dynamics ${anchor.dynamics.toFixed(2)}</title>
      </rect>
      <text
        class="phrase-editor-svg__anchor-label"
        x="${roundSvg(x + Math.max(8, width / 2))}"
        y="${roundSvg(y + 4)}"
      >${anchor.degree}.${anchor.octave}</text>
    </g>
  `;
}

function renderAnchorPhraseBreaths(
  phrase: AnchorPhrase,
  xForBeat: (beat: number) => number,
  y: number,
  height: number,
): string {
  const parts: string[] = [];
  for (let index = 0; index < phrase.segments.length - 1; index += 1) {
    const current = phrase.segments[index];
    const next = phrase.segments[index + 1];
    const currentEnd = current ? segmentEndBeat(current) : 0;
    const nextStart = next?.anchors[0]?.startBeat ?? currentEnd;
    if (nextStart <= currentEnd) continue;
    const x = xForBeat(currentEnd);
    const width = xForBeat(nextStart) - x;
    parts.push(`
      <g data-testid="anchor-phrase-editor-breath" class="phrase-editor-svg__breath">
        <rect x="${roundSvg(x)}" y="${y}" width="${roundSvg(width)}" height="${height}" rx="9" />
        <text x="${roundSvg(x + width / 2)}" y="${roundSvg(y + height / 2)}">breath</text>
      </g>
    `);
  }
  return parts.join("");
}

function countAnchorPhraseBreaths(phrase: AnchorPhrase): number {
  let count = 0;
  for (let index = 0; index < phrase.segments.length - 1; index += 1) {
    const current = phrase.segments[index];
    const next = phrase.segments[index + 1];
    if (!current || !next) continue;
    if ((next.anchors[0]?.startBeat ?? 0) > segmentEndBeat(current)) {
      count += 1;
    }
  }
  return count;
}

function anchorPhraseEndBeat(phrase: AnchorPhrase): number {
  return Math.max(0, ...phrase.segments.map(segmentEndBeat));
}

function segmentEndBeat(segment: AnchorPhraseSegment): number {
  return Math.max(0, ...segment.anchors.map((anchor) => anchor.startBeat + anchor.durationBeats));
}

function anchorPitchValue(anchor: Anchor): number {
  return anchor.octave * 7 + (clampInteger(anchor.degree, 1, 7) - 1);
}

function degreeColorVar(degree: number): string {
  return `var(--degree-${clampInteger(degree, 1, 7)})`;
}

function roundSvg(value: number): number {
  return Math.round(value * 100) / 100;
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
    thoughtSlowNodes.clear();
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
          "Slow",
          formatSlowThinkingForPlayer(seed.playerId),
          `thought-slow-${seed.playerId}-status`,
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
      const slowNode = dl.querySelector<HTMLElement>(`[data-testid='thought-slow-${seed.playerId}-status']`);
      if (slowNode) {
        thoughtSlowNodes.set(seed.playerId, slowNode);
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
    const slowNode = thoughtSlowNodes.get(seed.playerId);
    if (slowNode) {
      slowNode.textContent = formatSlowThinkingForPlayer(seed.playerId);
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

function formatSlowThinkingForPlayer(playerId: string): string {
  const slowThinkingState = getSlowThinkingLoopState(playerId);
  if (!slowThinkingState) return "not in loop";
  const playback = getSlowThoughtPlaybackForPlayer(playerId);
  const beat = slowThinkingState.committedStartBeat ?? slowThinkingState.intendedStartBeat;
  const timing = beat === undefined ? "" : ` @ beat ${beat.toFixed(1)}`;
  const action = slowThinkingState.action ? ` ${slowThinkingState.action}` : "";
  const retargeted = slowThinkingState.retargeted ? " retargeted" : "";
  const playbackSummary = playback
    ? ` | ${formatSlowThoughtPlayback(playback)}`
    : "";
  return `${slowThinkingState.status}${action}${retargeted}${timing}: ${slowThinkingState.message}${playbackSummary}`;
}

function formatSlowThoughtPlayback(playback: SlowThoughtPlayback): string {
  const window = `${playback.startBeat.toFixed(1)}-${playback.endBeat.toFixed(1)}`;
  if (playback.mode === "shift-register") {
    return `shift ${formatSignedInteger(playback.registerShift ?? 0)} ${window}`;
  }
  return `${playback.mode} ${window}`;
}

function renderSongGoal(interpretation: SongGoalInterpretation): void {
  const { goal, validation, matchedKeywords } = interpretation;
  songGoalApplyButton.disabled = !validation.valid;
  songGoalStatus.textContent = [
    goal.status,
    validation.valid ? "valid" : `invalid (${validation.errors.length})`,
    `${matchedKeywords.length} cues`,
  ].join(" | ");
  songGoalApplied.textContent = appliedSongGoal
    ? formatAppliedSongGoal(appliedSongGoal)
    : "not applied; current setup is default";
  songGoalSetup.textContent = [
    `${goal.tonic} ${goal.mode}`,
    `${goal.tempoBpm} BPM`,
    goal.formPreference,
  ].join(" | ");
  songGoalCharacter.textContent = [
    `energy ${goal.energy.toFixed(2)}`,
    `surprise ${goal.surpriseTarget.toFixed(2)}`,
    `brightness ${goal.brightness.toFixed(2)}`,
    formatSectionEmphasis(goal),
  ].join(" | ");
  songGoalInfluences.textContent = goal.influenceHints.length > 0
    ? goal.influenceHints.join(", ")
    : "none";
  songGoalBiases.textContent = formatSongGoalBiases(goal);
  songGoalBrief.textContent = goal.brief;
  songGoalValidation.textContent = formatSongGoalValidation(validation);
}

function formatAppliedSongGoal(goal: SongGoal): string {
  return [
    `${goal.tonic} ${goal.mode}`,
    `${goal.tempoBpm} BPM`,
    goal.formPreference,
    `energy ${goal.energy.toFixed(2)}`,
    `surprise ${goal.surpriseTarget.toFixed(2)}`,
    formatSectionEmphasis(goal),
    formatSongGoalBiases(goal),
    goal.id,
  ].join(" | ");
}

function applySongGoalIdea(sourceIdea: string): SongGoalInterpretation {
  songGoalInterpretation = interpretSongGoal(sourceIdea);
  songGoalIdeaInput.value = songGoalInterpretation.goal.sourceIdea;
  renderWorld();
  return songGoalInterpretation;
}

function applySongGoalSetup(
  interpretation: SongGoalInterpretation = songGoalInterpretation,
): SongGoal | undefined {
  if (!interpretation.validation.valid) {
    renderWorld();
    return undefined;
  }

  const goal = cloneSongGoal(interpretation.goal);
  const previousSetup = getCurrentSongGoalSetupSnapshot(appliedSongGoal);
  world.setTonalContext(createTonalContext(goal.tonic, goal.mode));
  activeTempoBpm = goal.tempoBpm;
  formVariantId = goal.formPreference;
  appliedSongGoal = cloneSongGoal(goal);
  melodyRepairFeedbackMessage = "Goal setup applied.";
  invalidateMelodyRepairCache();
  ollamaProposalTextTest = createInitialOllamaProposalTextTest(ollamaConfig);
  resetMelodyCriticTest("Goal setup changed; melody critic reset");
  cancelSlowThinkingControllers("goal setup changed before the thought could land");
  clearSlowThoughtPlayback();
  world.clearMusicalEvents();
  world.resetTasteEvaluations();
  refreshLookaheadSchedule();
  recordSongGoalSet(goal, previousSetup, getCurrentSongGoalSetupSnapshot(appliedSongGoal));
  renderWorld();
  return cloneSongGoal(goal);
}

function cloneSongGoal(goal: SongGoal): SongGoal {
  return {
    ...goal,
    dispositionBias: { ...goal.dispositionBias },
    influenceHints: [...goal.influenceHints],
    sectionEmphasis: { ...goal.sectionEmphasis },
  };
}

function getCurrentSongGoalSetupSnapshot(goal: SongGoal | undefined): Record<string, unknown> {
  const tonalContext = world.getTonalContext();
  return {
    goalId: goal?.id,
    tonic: tonalContext.tonic,
    mode: tonalContext.mode,
    scale: [...tonalContext.scale],
    tempoBpm: activeTempoBpm,
    formVariantId,
  };
}

function formatSongGoalValidation(validation: SongGoalValidationResult): string {
  const details = [
    ...validation.errors.map((error) => `error: ${error}`),
    ...validation.clamps.map((clamp) => `clamp: ${clamp}`),
    ...validation.warnings.map((warning) => `warn: ${warning}`),
  ];
  return details.length > 0 ? details.join(" | ") : "valid; no clamps";
}

function formatSongGoalBiases(goal: SongGoal): string {
  const entries = Object.entries(goal.dispositionBias);
  if (entries.length === 0) return "none";
  return entries.map(([role, value]) => `${role} ${formatSignedScore(value ?? 0)}`).join(" | ");
}

function formatSectionEmphasis(goal: SongGoal): string {
  const entries = Object.entries(goal.sectionEmphasis);
  if (entries.length === 0) return "sections neutral";
  return `sections ${entries.map(([section, value]) => `${section} ${(value ?? 0).toFixed(2)}`).join(", ")}`;
}

function renderSongSketch(sketch: SongSketch): void {
  const proposal = getSongSketchProposalForSketch(sketch);
  songSketchTitle.textContent = `${sketch.title} (${sketch.status})`;
  songSketchProposer.textContent = `${sketch.proposerPlayerId} -> ${sketch.affectedPlayerIds.join(", ")}`;
  songSketchSections.textContent = sketch.sections.map((section) =>
    `${section.label} ${section.startBeat}-${section.startBeat + section.durationBeats}: ${formatSongSketchSection(section, sketch)}`
  ).join(" | ");
  songSketchAssignments.textContent = sketch.assignments.map((assignment) =>
    `${assignment.playerId} ${assignment.stance} ${assignment.density.toFixed(2)}: ${assignment.brief}`
  ).join(" | ");
  songSketchProposal.textContent = formatSongSketchProposal(proposal);
  songSketchResponses.textContent = proposal.responses.map(formatSongSketchProposalResponse).join(" | ");
  songSketchQuestions.textContent = sketch.openQuestions.join(" | ");
}

function getCurrentSongSketch(state: GrowTransportState = getState()): SongSketch {
  const song = getSongMaterial(state.songId);
  const tonalContext = world.getTonalContext();
  const players = world.getPlayers().map(({ player }) => ({
    playerId: player.id,
    role: player.role,
  }));
  const cacheKey = createSongSketchCacheKey(song, tonalContext, players);
  if (!cachedSongSketchBase || cachedSongSketchKey !== cacheKey) {
    cachedSongSketchKey = cacheKey;
    cachedSongSketchBase = createInspectOnlySongSketch({
      song,
      tonalContext,
      currentBeat: 0,
      players,
    });
  }

  return cloneSongSketch(cachedSongSketchBase, roundDisplayBeat(state.currentBeat));
}

function createSongSketchCacheKey(
  song: SongMaterial,
  tonalContext: SongSketch["tonalContext"],
  players: readonly SongSketchPlayerRef[],
): string {
  return [
    song.id,
    tonalContext.tonic,
    tonalContext.mode,
    tonalContext.scale.join(","),
    players.map((player) => `${player.playerId}:${player.role}`).join(","),
  ].join("|");
}

function formatSongSketchSection(section: SongSketchSection, sketch: SongSketch): string {
  return section.chordPlan.map((chord, index) => {
    const rootDegree = section.rootDegrees[index];
    if (rootDegree === undefined) return chord;
    return `${chord}(${rootNoteFromScaleDegree(sketch.tonalContext, rootDegree)})`;
  }).join("-");
}

function getCurrentSongSketchProposal(state: GrowTransportState = getState()): SongSketchProposal {
  return getSongSketchProposalForSketch(getCurrentSongSketch(state));
}

function getCurrentBaseSongSketchProposal(state: GrowTransportState = getState()): SongSketchProposal {
  return createInspectOnlySongSketchProposal(getCurrentSongSketch(state));
}

function getSongSketchProposalForSketch(sketch: SongSketch): SongSketchProposal {
  const baseProposal = createInspectOnlySongSketchProposal(sketch);
  if (
    ollamaProposalTextTest.status === "valid" &&
    ollamaProposalTextTest.proposalId === baseProposal.id &&
    ollamaProposalTextTest.text
  ) {
    return applySongSketchProposalText(baseProposal, ollamaProposalTextTest.text, "model");
  }
  return baseProposal;
}

function cloneSongSketch(sketch: SongSketch, createdAtBeat: number): SongSketch {
  return {
    ...sketch,
    createdAtBeat,
    meter: [sketch.meter[0], sketch.meter[1]],
    tonalContext: {
      ...sketch.tonalContext,
      scale: [...sketch.tonalContext.scale],
    },
    affectedPlayerIds: [...sketch.affectedPlayerIds],
    sections: sketch.sections.map(cloneSongSketchSection),
    assignments: sketch.assignments.map(cloneSongSketchAssignment),
    openQuestions: [...sketch.openQuestions],
  };
}

function cloneSongSketchSection(section: SongSketchSection): SongSketchSection {
  return {
    ...section,
    chordPlan: [...section.chordPlan],
    rootDegrees: [...section.rootDegrees],
  };
}

function cloneSongSketchAssignment(assignment: SongSketchAssignment): SongSketchAssignment {
  return {
    ...assignment,
    constraints: [...assignment.constraints],
  };
}

function formatSongSketchProposal(proposal: SongSketchProposal): string {
  return `${proposal.status}/${proposal.kind} ${proposal.targetSectionId}: ${proposal.requestedAction}`;
}

function formatSongSketchProposalResponse(response: SongSketchProposalResponse): string {
  const change = response.requestedChange ? ` (${response.requestedChange})` : "";
  return `${response.playerId} ${response.stance}: ${response.reason}${change}`;
}

function getCurrentMelodyRepairTake(state: GrowTransportState = getState()): MelodyRepairTake {
  const song = getSongMaterial(state.songId);
  const tonalContext = world.getTonalContext();
  const players = world.getPlayers().map(({ player }) => player);
  const rejectedKeys = getRejectedMelodyRepairKeys(state.songId);
  const cacheKey = createMelodyRepairCacheKey(song, tonalContext, players, rejectedKeys);
  if (!cachedMelodyRepairTake || cachedMelodyRepairKey !== cacheKey) {
    cachedMelodyRepairKey = cacheKey;
    cachedMelodyRepairTake = createMelodyRepairTake({
      song,
      tonalContext,
      players,
      perspectivePlayerId: "melody",
      rejectedPhraseKeys: rejectedKeys,
      rememberedCount: rememberedMelodyRepairCountsBySong.get(state.songId) ?? 0,
      weightNudges: melodyRepairWeightNudgesByPlayer,
    });
  }
  return cachedMelodyRepairTake;
}

function createMelodyRepairCacheKey(
  song: SongMaterial,
  tonalContext: ListeningFrame["tonalContext"],
  players: readonly { id: string }[],
  rejectedKeys: ReadonlySet<string>,
): string {
  return [
    song.id,
    tonalContext.tonic,
    tonalContext.mode,
    tonalContext.scale.join(","),
    players.map((player) => player.id).join(","),
    [...rejectedKeys].sort().join(","),
  ].join("|");
}

function invalidateMelodyRepairCache(): void {
  cachedMelodyRepairKey = "";
  cachedMelodyRepairTake = undefined;
  activeMelodyCriticSelection = undefined;
}

function getRejectedMelodyRepairKeys(nextSongId: SongId = songId): Set<string> {
  let keys = rejectedMelodyRepairKeysBySong.get(nextSongId);
  if (!keys) {
    keys = new Set<string>();
    rejectedMelodyRepairKeysBySong.set(nextSongId, keys);
  }
  return keys;
}

function getCurrentChorusDevelopment(): ChorusDevelopment {
  if (melodyDevelopmentMode === "raw") {
    return { mode: "raw" };
  }
  return {
    mode: "repaired",
    repairedEvents: getCurrentMelodyRepairDecision().candidate.events,
  };
}

function getCurrentMelodyRepairDecision(state: GrowTransportState = getState()): {
  take: MelodyRepairTake;
  candidate: MelodyRepairCandidate;
  proposedCandidate: MelodyRepairCandidate;
  consensus: MelodyConsensusDecision;
  selection?: MelodyCriticSelection;
} {
  const take = getCurrentMelodyRepairTake(state);
  const selection = getActiveMelodyCriticSelection(take);
  const proposedBy = selection ? "model-critic" : "deterministic-scorer";
  const proposedCandidate = getMelodyRepairCandidate(take, selection?.selectedCandidateId) ??
    getMelodyRepairCandidate(take, take.deterministicCandidateId) ??
    take.candidates[0];
  const consensus = createMelodyConsensusDecision(take, proposedCandidate?.id, proposedBy);
  const candidate = getMelodyRepairCandidate(take, consensus.selectedCandidateId) ??
    proposedCandidate ??
    getMelodyRepairCandidate(take, take.deterministicCandidateId) ??
    take.candidates[0];
  if (!candidate) {
    throw new Error(`Melody repair take ${take.id} has no candidates`);
  }
  return {
    take,
    candidate,
    proposedCandidate: proposedCandidate ?? candidate,
    consensus,
    selection,
  };
}

function getRawMelodyRepairCandidate(take: MelodyRepairTake): MelodyRepairCandidate {
  const candidate = take.candidates.find((candidate) => candidate.source === "raw-transform") ??
    take.candidates[0] ??
    getMelodyRepairCandidate(take, take.deterministicCandidateId);
  if (!candidate) {
    throw new Error(`Melody repair take ${take.id} has no raw candidate`);
  }
  return candidate;
}

function getActiveMelodyCriticSelection(take: MelodyRepairTake): MelodyCriticSelection | undefined {
  if (
    ollamaMelodyCriticTest.status !== "valid" ||
    ollamaMelodyCriticTest.takeId !== take.id ||
    !activeMelodyCriticSelection
  ) {
    return undefined;
  }
  if (!getMelodyRepairCandidate(take, activeMelodyCriticSelection.selectedCandidateId)) {
    return undefined;
  }
  return activeMelodyCriticSelection;
}

function resetMelodyCriticTest(message = "Melody repair context changed"): void {
  activeMelodyCriticSelection = undefined;
  ollamaMelodyCriticTest = {
    ...createInitialOllamaMelodyCriticTest(ollamaConfig),
    message,
  };
}

function applyMelodyDevelopmentMode(mode: MelodyDevelopmentMode): MelodyDevelopmentMode {
  if (mode === melodyDevelopmentMode) return melodyDevelopmentMode;
  melodyDevelopmentMode = mode;
  refreshLookaheadSchedule();
  renderWorld();
  return melodyDevelopmentMode;
}

function rememberCurrentMelodyRepairTake(): MelodyRepairTake {
  const { take, candidate, consensus, selection } = getCurrentMelodyRepairDecision();
  const nextCount = (rememberedMelodyRepairCountsBySong.get(songId) ?? 0) + 1;
  rememberedMelodyRepairCountsBySong.set(songId, nextCount);
  const currentNudge = melodyRepairWeightNudgesByPlayer.get(take.perspectiveId) ?? 0;
  melodyRepairWeightNudgesByPlayer.set(take.perspectiveId, clamp(currentNudge + 0.025, -0.12, 0.12));
  melodyRepairFeedbackMessage = `remembered ${candidate.id}`;
  recordMelodyRepairFeedback("up", take, candidate, consensus, selection);
  queueRender();
  return take;
}

function rejectCurrentMelodyRepairTake(): MelodyRepairTake {
  const { take, candidate, consensus, selection } = getCurrentMelodyRepairDecision();
  getRejectedMelodyRepairKeys(songId).add(candidate.phraseKey);
  melodyRepairFeedbackMessage = `rejected ${candidate.id}; repaired again`;
  recordMelodyRepairFeedback("down", take, candidate, consensus, selection);
  resetMelodyCriticTest("Rejected candidate; melody critic reset");
  invalidateMelodyRepairCache();
  refreshLookaheadSchedule();
  renderWorld();
  return getCurrentMelodyRepairTake();
}

function recordMelodyRepairFeedback(
  feedback: MelodyFeedbackValue,
  take: MelodyRepairTake,
  candidate: MelodyRepairCandidate,
  consensus: MelodyConsensusDecision,
  selection: MelodyCriticSelection | undefined,
): void {
  persistence.record({
    type: "song.take_feedback",
    actorId: "human-producer",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      source: "melody-score",
      feedback,
      memoryStatus: feedback === "up" ? "remembered-good" : "rejected",
      songId,
      sectionType: "chorus",
      takeId: take.id,
      candidateId: candidate.id,
      candidateSource: candidate.source,
      candidateStrategy: candidate.strategy,
      candidateStrategySummary: candidate.strategySummary,
      proposedBy: consensus.proposedBy,
      proposedCandidateId: consensus.proposedCandidateId,
      selectedBy: consensus.selectedBy,
      bestCandidateId: take.bestCandidateId,
      scoreDeltaFromBest: candidate.scoreDeltaFromBest,
      scoreDeltaFromDeterministic: candidate.scoreDeltaFromDeterministic,
      consensusAgreementScore: consensus.agreementScore,
      consensusSummary: consensus.summary,
      consensusResponses: consensus.responses.map((response) => ({
        playerId: response.playerId,
        stance: response.stance,
        preferredCandidateId: response.preferredCandidateId,
        preferredStrategy: response.preferredStrategy,
        preferenceMargin: response.preferenceMargin,
      })),
      perspectiveId: take.perspectiveId,
      phraseKey: candidate.phraseKey,
      rawScore: snapshotMelodyScore(take.primaryRawScore),
      repairedScore: snapshotMelodyScore(candidate.primaryScore),
      deterministicCandidateId: take.deterministicCandidateId,
      rejectedCount: getRejectedMelodyRepairKeys(songId).size,
      rememberedCount: rememberedMelodyRepairCountsBySong.get(songId) ?? 0,
      modelRationale: selection?.rationale,
    },
  });
}

function snapshotMelodyScore(score: MelodyPhraseScore): Record<string, unknown> {
  return {
    perspectiveId: score.perspectiveId,
    total: score.total,
    landing: score.landing,
    monotony: score.monotony,
    surprise: score.surprise,
    averageSurprise: score.averageSurprise,
    topCritique: score.critiques[0]?.message ?? "none",
  };
}

function renderMelodyRepair(take: MelodyRepairTake): void {
  const decision = getCurrentMelodyRepairDecision();
  const rawCandidate = getRawMelodyRepairCandidate(take);
  const activeCandidate = melodyDevelopmentMode === "raw" ? rawCandidate : decision.candidate;
  melodyDevelopmentCurrent.textContent = melodyDevelopmentMode === "raw" ? "Raw transform" : "Repaired";
  for (
    const input of melodyDevelopmentControl.querySelectorAll<HTMLInputElement>("input[name='melody-development']")
  ) {
    input.checked = input.value === melodyDevelopmentMode;
  }

  const activeScore = activeCandidate.primaryScore;
  const deterministicCandidate = getMelodyRepairCandidate(take, take.deterministicCandidateId) ?? decision.candidate;
  melodyCandidateCurrent.textContent = formatMelodyCandidate(activeCandidate, decision.consensus, decision.selection);
  melodyScoreTotal.textContent = [
    `${melodyDevelopmentMode} ${activeScore.total.toFixed(3)}`,
    `raw ${take.primaryRawScore.total.toFixed(3)}`,
    `heuristic ${deterministicCandidate.primaryScore.total.toFixed(3)}`,
    `best ${take.bestCandidateId}`,
    activeCandidate.id === deterministicCandidate.id ? "deterministic" : "consensus-selected",
  ].join(" | ");
  melodyScoreChoice.textContent = formatMelodyCandidateChoice(activeCandidate, take);
  melodyScoreRoots.textContent = formatMelodyScoreRoots(take);
  melodyScoreSubscores.textContent = formatMelodyScoreSubscores(activeScore);
  melodyScoreCritique.textContent = activeScore.critiques[0]?.message ??
    (take.primaryRawScore.critiques[0]
      ? `repaired cleared raw flag: ${take.primaryRawScore.critiques[0].message}`
      : "No urgent repair flags.");
  melodyCriticStatus.textContent = formatMelodyCriticStatus(take, decision.proposedCandidate, decision.selection);
  melodyConsensusStatus.textContent = formatMelodyConsensusStatus(decision.consensus);
  melodyConsensusResponses.textContent = decision.consensus.responses.map(formatMelodyConsensusResponse).join(" | ");
  melodyScorePerspectives.textContent = activeCandidate.scores.map(formatPerspectiveScore).join(" | ");
  melodyScoreFeedback.textContent = [
    `${rememberedMelodyRepairCountsBySong.get(songId) ?? 0} remembered`,
    `${getRejectedMelodyRepairKeys(songId).size} rejected`,
    melodyRepairFeedbackMessage,
  ].join(" | ");
}

function formatMelodyCandidate(
  candidate: MelodyRepairCandidate,
  consensus: MelodyConsensusDecision,
  selection: MelodyCriticSelection | undefined,
): string {
  const source = selection ? "consensus/model-proposed" : "consensus/deterministic-proposed";
  return `${source}: ${candidate.label} / ${candidate.strategy} (${candidate.id}, ${candidate.changedNotes} changed, score ${
    candidate.primaryScore.total.toFixed(3)}, agreement ${consensus.agreementScore.toFixed(3)
  })`;
}

function formatMelodyCandidateChoice(
  candidate: MelodyRepairCandidate,
  take: MelodyRepairTake,
): string {
  const bestMarker = candidate.id === take.bestCandidateId ? "best local score" : `best ${formatSignedScore(
    candidate.scoreDeltaFromBest,
  )}`;
  const deterministicMarker = candidate.id === take.deterministicCandidateId
    ? "deterministic fallback"
    : `vs deterministic ${formatSignedScore(candidate.scoreDeltaFromDeterministic)}`;
  return [
    candidate.strategy,
    candidate.strategySummary,
    `${candidate.noteCount} notes`,
    bestMarker,
    deterministicMarker,
  ].join(" | ");
}

function formatMelodyScoreRoots(take: MelodyRepairTake): string {
  const tonalContext = world.getTonalContext();
  const roots = take.scoringRootDegrees
    .map((degree) => rootNoteFromScaleDegree(tonalContext, degree))
    .join("-");
  const label = take.scoringRootSection === "answer"
    ? "Answer"
    : take.scoringRootSection === "gather"
    ? "Gather"
    : "Bridge";
  return `${label} ${roots || "C"} (${take.scoringRootDegrees.join(",") || "0"})`;
}

function formatMelodyCriticStatus(
  take: MelodyRepairTake,
  proposedCandidate: MelodyRepairCandidate,
  selection: MelodyCriticSelection | undefined,
): string {
  if (ollamaMelodyCriticTest.status === "idle") {
    return `idle; deterministic ${take.deterministicCandidateId}`;
  }
  if (ollamaMelodyCriticTest.status === "running") {
    return `running ${take.id}`;
  }
  if (selection && ollamaMelodyCriticTest.status === "valid") {
    return `model proposed ${proposedCandidate.label}: ${selection.rationale}`;
  }
  if (ollamaMelodyCriticTest.status === "invalid") {
    return `invalid (${ollamaMelodyCriticTest.validation.errors.length}); deterministic repair active`;
  }
  if (ollamaMelodyCriticTest.status === "failed") {
    return `failed; deterministic repair active`;
  }
  return ollamaMelodyCriticTest.message;
}

function formatMelodyConsensusStatus(consensus: MelodyConsensusDecision): string {
  return [
    consensus.summary,
    `agreement ${consensus.agreementScore.toFixed(3)}`,
    `vs proposal ${formatSignedScore(consensus.scoreDeltaFromProposed)}`,
  ].join(" | ");
}

function formatMelodyConsensusResponse(response: MelodyConsensusDecision["responses"][number]): string {
  return `${response.playerId} ${response.stance} ${response.preferredStrategy} (${formatSignedScore(
    response.preferenceMargin,
  )})`;
}

function formatMelodyScoreSubscores(score: MelodyPhraseScore): string {
  return `land ${score.landing.toFixed(2)}, monotony ${score.monotony.toFixed(2)}, surprise ${score.surprise.toFixed(2)} avg ${score.averageSurprise.toFixed(2)} target ${score.surpriseTarget.toFixed(2)}`;
}

function formatSignedScore(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatPerspectiveScore(score: MelodyPhraseScore): string {
  return `${score.perspectiveLabel} ${score.total.toFixed(2)} (L${score.landing.toFixed(2)} M${score.monotony.toFixed(2)} S${score.surprise.toFixed(2)})`;
}

function getCurrentFormScore(state: GrowTransportState = getState()): FormScore {
  const variant = getCurrentFormVariant();
  return createFormScore({
    song: getSongMaterial(state.songId),
    tonalContext: world.getTonalContext(),
    arrangement: variant.arrangement,
    chorusDevelopment: getCurrentChorusDevelopment(),
    sectionDynamicsProfile: getGoalSectionDynamicsProfile(variant),
  });
}

interface ScoredFormVariant {
  variant: FormVariant;
  score: FormScore;
  active: boolean;
  winner: boolean;
}

interface CandidateMelodyAuditionOptions {
  branchId?: string;
  candidateId?: string;
}

interface CandidateMelodyAuditionState {
  enabled: boolean;
  message: string;
  candidateId?: string;
  branchId?: string;
  fitness?: number;
  generation?: number;
  seed?: number;
  pattern?: PlayerPatternSource;
}

interface EvolvingElitePerformanceOptions extends Omit<Partial<CandidateEvolutionOptions>, "kind"> {
  kind?: "phrase";
  batch?: number;
  intervalMs?: number;
}

interface EvolvingElitePerformanceSwap {
  generation: number;
  candidateId: string;
  fitness: number;
}

interface EvolvingElitePerformanceState {
  status: "idle" | "running" | "complete" | "error";
  message: string;
  seed?: number;
  branchId?: string;
  targetGenerations: number;
  completedGenerations: number;
  batch: number;
  intervalMs: number;
  count: number;
  eliteLimit: number;
  currentCandidateId?: string;
  currentFitness?: number;
  bestFitness?: number;
  swaps: readonly EvolvingElitePerformanceSwap[];
  lastSelectionReason?: EvolvingEliteSelection["reason"];
  lastError?: string;
}

interface WrittenEvolvingControlState {
  value: number;
  regime: WrittenEvolvingRegime;
  thresholds: {
    speaking: number;
    evolving: number;
  };
  prosodyEnabled: boolean;
  evolvingPerformanceStatus: EvolvingElitePerformanceState["status"];
  auditionEnabled: boolean;
  evolvingOptions: Required<Pick<
    EvolvingElitePerformanceOptions,
    "seed" | "branchId" | "generations" | "batch" | "intervalMs" | "count" | "eliteLimit"
  >> & {
    diversity: { enabled: boolean };
  };
}

interface AnchorPhraseEditorAnchorRef {
  anchorIndex: number;
  segmentIndex: number;
}

interface AnchorPhraseEditorConnectorRef {
  connectorIndex: number;
  segmentIndex: number;
}

interface AnchorPhraseEditorDragState extends AnchorPhraseEditorAnchorRef {
  mode: "move" | "resize";
}

interface AnchorPhraseEditorState {
  canEdit: boolean;
  editMode: boolean;
  message: string;
  overrideActive: boolean;
  saveBranchId: string;
  saveInFlight: boolean;
  savedCandidateId?: string;
  savedCount?: number;
  selectedAnchor?: AnchorPhraseEditorAnchorRef;
  selectedConnector?: AnchorPhraseEditorConnectorRef;
  workingPhrase?: AnchorPhrase;
}

interface AnchorPhraseEditorSaveResult {
  branchId: string;
  candidate?: StoredCandidate;
  error?: string;
  rendered?: PlayerPatternSource;
  savedCount?: number;
  valid: boolean;
}

interface AnchorPhraseCatalogEntrySummary {
  candidateId?: string;
  editable: boolean;
  fitness?: number;
  generation?: number;
  id: string;
  label: string;
  source: "generated" | "draft" | "candidate";
  status?: StoredCandidate["status"];
  tag: string;
}

interface AnchorPhraseCatalogEntry extends AnchorPhraseCatalogEntrySummary {
  candidate?: StoredCandidate;
  pattern: PlayerPatternSource;
  phrase: AnchorPhrase;
}

interface AnchorPhraseCatalogState {
  branchId: string;
  entries: readonly AnchorPhraseCatalogEntrySummary[];
  loading: boolean;
  selectedId: string;
  selectedIndex: number;
  selectedPattern: PlayerPatternSource;
  selectedPhrase: AnchorPhrase;
  total: number;
}

interface AnchorPhraseEditorLayout {
  height: number;
  maxPitch: number;
  minPitch: number;
  padding: { bottom: number; left: number; right: number; top: number };
  phraseBeats: number;
  plotHeight: number;
  plotWidth: number;
  width: number;
}

function getCurrentFormVariant(): FormVariant {
  return getFormVariant(formVariantId);
}

function getActiveMelodyPhrasing(): PlayerPatternSource | undefined {
  if (editorMelodyOverride) {
    return clonePlayerPatternSource(editorMelodyOverride);
  }
  if (candidateMelodyAudition.pattern) {
    return clonePlayerPatternSource(candidateMelodyAudition.pattern);
  }
  if (!prosodyEnabled) return undefined;
  if (!cachedProsodyMelody) {
    cachedProsodyMelody = generateProsodicMelody({ seed: prosodySeedForSong(songId), baseOctave: 4, bars: 4 });
  }
  return clonePlayerPatternSource(cachedProsodyMelody);
}

function clonePlayerPatternSource(pattern: PlayerPatternSource): PlayerPatternSource {
  return {
    subdivisionBeats: pattern.subdivisionBeats,
    events: pattern.events.map((event) => event ? { ...event } : null),
  };
}

function compareCandidateAuditionRank(left: StoredCandidate, right: StoredCandidate): number {
  return (
    right.fitness - left.fitness ||
    left.generation - right.generation ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function getCandidateMelodyAuditionState(message?: string): CandidateMelodyAuditionState {
  const candidate = candidateMelodyAudition.candidate;
  if (!candidate || !candidateMelodyAudition.pattern) {
    return {
      enabled: false,
      message: message ?? "No elite phrase candidate is being auditioned.",
    };
  }

  return {
    enabled: true,
    message: message ?? `Auditioning elite phrase ${candidate.id}.`,
    candidateId: candidate.id,
    branchId: candidate.branchId,
    fitness: candidate.fitness,
    generation: candidate.generation,
    seed: candidate.seed,
    pattern: clonePlayerPatternSource(candidateMelodyAudition.pattern),
  };
}

function applyCandidateMelodyAudition(candidate: StoredCandidate): CandidateMelodyAuditionState {
  candidateMelodyAudition = {
    branchId: candidate.branchId,
    candidate,
    pattern: clonePlayerPatternSource(renderPhraseCandidateGenome(candidate.genome)),
  };
  cachedProsodyMelody = undefined;
  cancelSlowThinkingControllers("candidate melody audition changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  renderWorld();
  return getCandidateMelodyAuditionState(`Auditioning elite phrase ${candidate.id}.`);
}

async function auditionElitePhraseCandidate(
  options: CandidateMelodyAuditionOptions = {},
): Promise<CandidateMelodyAuditionState> {
  const candidates = await persistence.listCandidates({
    kind: "phrase",
    status: "elite",
    branchId: options.branchId,
    limit: 500,
  });
  const sorted = [...candidates].sort(compareCandidateAuditionRank);
  const selected = options.candidateId
    ? sorted.find((candidate) => candidate.id === options.candidateId)
    : sorted[0];

  if (!selected) {
    return getCandidateMelodyAuditionState(
      options.candidateId
        ? `No elite phrase candidate matched ${options.candidateId}.`
        : "No elite phrase candidate is available to audition.",
    );
  }

  return applyCandidateMelodyAudition(selected);
}

function clearCandidateMelodyAudition(): CandidateMelodyAuditionState {
  if (!candidateMelodyAudition.candidate) {
    return getCandidateMelodyAuditionState("No elite phrase candidate was active.");
  }
  const previousId = candidateMelodyAudition.candidate.id;
  candidateMelodyAudition = {};
  cancelSlowThinkingControllers("candidate melody audition cleared before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  renderWorld();
  return getCandidateMelodyAuditionState(`Cleared elite phrase audition ${previousId}.`);
}

function getEvolvingPerformanceState(): EvolvingElitePerformanceState {
  return {
    ...evolvingPerformanceState,
    swaps: evolvingPerformanceState.swaps.map((swap) => ({ ...swap })),
  };
}

function normalizeEvolvingPerformancePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(maximum, Math.trunc(value));
}

function normalizeEvolvingPerformanceIntervalMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_EVOLVING_PERFORMANCE_INTERVAL_MS;
  return Math.max(
    MIN_EVOLVING_PERFORMANCE_INTERVAL_MS,
    Math.min(MAX_EVOLVING_PERFORMANCE_INTERVAL_MS, Math.trunc(value)),
  );
}

function normalizeEvolvingPerformanceBranchId(value: string | undefined, seed: number): string {
  if (value && /^[a-zA-Z0-9:_-]{1,120}$/.test(value)) return value;
  return `evolving-${seed}`;
}

function clearEvolvingPerformanceTimer(): void {
  if (evolvingPerformanceTimerId !== 0) {
    window.clearTimeout(evolvingPerformanceTimerId);
    evolvingPerformanceTimerId = 0;
  }
}

function stopEvolvingElitePerformance(message = "Evolving performance stopped."): EvolvingElitePerformanceState {
  evolvingPerformanceRunSerial += 1;
  clearEvolvingPerformanceTimer();
  const previous = evolvingPerformanceState;
  evolvingPerformanceState = {
    ...previous,
    status: "idle",
    message,
    swaps: previous.swaps.map((swap) => ({ ...swap })),
  };
  clearCandidateMelodyAudition();
  return getEvolvingPerformanceState();
}

function startEvolvingElitePerformance(
  options: EvolvingElitePerformanceOptions = {},
): EvolvingElitePerformanceState {
  stopEvolvingElitePerformance("Restarting evolving performance.");

  const seed = normalizeEvolvingPerformancePositiveInteger(options.seed, 1, 0xffffffff);
  const branchId = normalizeEvolvingPerformanceBranchId(options.branchId, seed);
  const targetGenerations = normalizeEvolvingPerformancePositiveInteger(options.generations, 12, 500);
  const batch = normalizeEvolvingPerformancePositiveInteger(
    options.batch,
    DEFAULT_EVOLVING_PERFORMANCE_BATCH,
    MAX_EVOLVING_PERFORMANCE_BATCH,
  );
  const intervalMs = normalizeEvolvingPerformanceIntervalMs(options.intervalMs);
  const count = normalizeEvolvingPerformancePositiveInteger(options.count, 8, 64);
  const eliteLimit = normalizeEvolvingPerformancePositiveInteger(options.eliteLimit, 3, 24);
  const runSerial = evolvingPerformanceRunSerial + 1;
  evolvingPerformanceRunSerial = runSerial;
  evolvingPerformanceState = {
    status: "running",
    message: `Evolving phrase performance on ${branchId}.`,
    seed,
    branchId,
    targetGenerations,
    completedGenerations: 0,
    batch,
    intervalMs,
    count,
    eliteLimit,
    swaps: [],
  };
  queueEvolvingPerformanceStep(runSerial, 0, options.diversity);
  return getEvolvingPerformanceState();
}

function queueEvolvingPerformanceStep(
  runSerial: number,
  delayMs: number,
  diversity: CandidateEvolutionOptions["diversity"],
): void {
  clearEvolvingPerformanceTimer();
  evolvingPerformanceTimerId = window.setTimeout(() => {
    evolvingPerformanceTimerId = 0;
    void runEvolvingPerformanceStep(runSerial, diversity);
  }, delayMs);
}

async function runEvolvingPerformanceStep(
  runSerial: number,
  diversity: CandidateEvolutionOptions["diversity"],
): Promise<void> {
  if (runSerial !== evolvingPerformanceRunSerial || evolvingPerformanceState.status !== "running") {
    return;
  }

  const {
    seed,
    branchId,
    targetGenerations,
    completedGenerations,
    batch,
    count,
    eliteLimit,
    intervalMs,
  } = evolvingPerformanceState;
  if (seed === undefined || branchId === undefined) return;

  const remainingGenerations = Math.max(0, targetGenerations - completedGenerations);
  if (remainingGenerations === 0) {
    evolvingPerformanceState = {
      ...evolvingPerformanceState,
      status: "complete",
      message: `Evolving performance complete after ${completedGenerations} generations.`,
    };
    return;
  }

  try {
    const generationsThisStep = Math.min(batch, remainingGenerations);
    const result = await runEvolution({
      seed,
      kind: "phrase",
      generations: generationsThisStep,
      startGenerationIndex: completedGenerations,
      count,
      eliteLimit,
      branchId,
      ...(diversity?.enabled ? { diversity } : {}),
    }, persistence);

    if (runSerial !== evolvingPerformanceRunSerial || evolvingPerformanceState.status !== "running") {
      return;
    }

    const nextCompletedGenerations = completedGenerations + result.summaries.length;
    const candidates = await persistence.listCandidates({
      kind: "phrase",
      status: "elite",
      branchId,
      limit: 500,
    });
    const selection = selectStrictlyBetterElite(candidateMelodyAudition.candidate, candidates);
    let message = `Evolved through generation ${nextCompletedGenerations}.`;
    const swaps = [...evolvingPerformanceState.swaps];
    if (selection.shouldSwap && selection.candidate) {
      applyCandidateMelodyAudition(selection.candidate);
      swaps.push({
        generation: nextCompletedGenerations,
        candidateId: selection.candidate.id,
        fitness: selection.candidate.fitness,
      });
      message = `Auditioning improved elite ${selection.candidate.id}.`;
    }

    const currentCandidate = candidateMelodyAudition.candidate;
    const peakFitness = Math.max(
      evolvingPerformanceState.bestFitness ?? 0,
      ...result.summaries.map((summary) => summary.topFitness),
      currentCandidate?.fitness ?? 0,
    );
    evolvingPerformanceState = {
      ...evolvingPerformanceState,
      completedGenerations: nextCompletedGenerations,
      currentCandidateId: currentCandidate?.id,
      currentFitness: currentCandidate?.fitness,
      bestFitness: peakFitness,
      swaps,
      lastSelectionReason: selection.reason,
      message,
    };

    if (nextCompletedGenerations >= targetGenerations) {
      evolvingPerformanceState = {
        ...evolvingPerformanceState,
        status: "complete",
        message: `Evolving performance complete at fitness ${currentCandidate?.fitness.toFixed(3) ?? "n/a"}.`,
      };
      return;
    }

    queueEvolvingPerformanceStep(runSerial, intervalMs, diversity);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    evolvingPerformanceState = {
      ...evolvingPerformanceState,
      status: "error",
      message: `Evolving performance failed: ${errorMessage}`,
      lastError: errorMessage,
    };
  }
}

function prosodySeedForSong(nextSongId: SongId): number {
  let hash = 2166136261;
  const key = `prosody:${nextSongId}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function evolvingDialSeedForSong(nextSongId: SongId): number {
  const seed = (prosodySeedForSong(nextSongId) ^ 0x6d2b79f5) >>> 0;
  return seed === 0 ? 1 : seed;
}

function getWrittenEvolvingRegime(value: number): WrittenEvolvingRegime {
  if (value >= WRITTEN_EVOLVING_EVOLVING_THRESHOLD) return "evolving";
  if (value >= WRITTEN_EVOLVING_SPEAKING_THRESHOLD) return "speaking";
  return "written";
}

function createWrittenEvolvingOptions(nextSongId: SongId = songId): WrittenEvolvingControlState["evolvingOptions"] {
  return {
    seed: evolvingDialSeedForSong(nextSongId),
    branchId: `dial-${nextSongId}`,
    generations: 50,
    batch: 2,
    intervalMs: DEFAULT_EVOLVING_PERFORMANCE_INTERVAL_MS,
    count: 5,
    eliteLimit: 3,
    diversity: { enabled: true },
  };
}

function getWrittenEvolvingControlState(): WrittenEvolvingControlState {
  return {
    value: writtenEvolvingDialValue,
    regime: writtenEvolvingRegime,
    thresholds: {
      speaking: WRITTEN_EVOLVING_SPEAKING_THRESHOLD,
      evolving: WRITTEN_EVOLVING_EVOLVING_THRESHOLD,
    },
    prosodyEnabled,
    evolvingPerformanceStatus: evolvingPerformanceState.status,
    auditionEnabled: Boolean(candidateMelodyAudition.candidate),
    evolvingOptions: createWrittenEvolvingOptions(),
  };
}

function applyWrittenEvolvingDialValue(value: number): WrittenEvolvingControlState {
  const nextValue = Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : WRITTEN_EVOLVING_DIAL_DEFAULT;
  const previousRegime = writtenEvolvingRegime;
  const nextRegime = getWrittenEvolvingRegime(nextValue);
  writtenEvolvingDialValue = nextValue;
  writtenEvolvingRegime = nextRegime;

  if (nextRegime === "evolving") {
    resetAnchorPhraseEditorSession("Anchor editing pauses while the line is evolving.", {
      refresh: true,
      render: true,
    });
    if (!prosodyEnabled) {
      setProsodyEnabled(true);
    }
    if (previousRegime !== "evolving" || evolvingPerformanceState.status === "idle") {
      startEvolvingElitePerformance(createWrittenEvolvingOptions());
    } else {
      renderWorld();
    }
    return getWrittenEvolvingControlState();
  }

  if (previousRegime === "evolving" || evolvingPerformanceState.status !== "idle") {
    stopEvolvingElitePerformance("Leaving evolving dial regime.");
  }
  setProsodyEnabled(nextRegime === "speaking");
  renderWorld();
  return getWrittenEvolvingControlState();
}

function setProsodyEnabled(enabled: boolean): boolean {
  if (prosodyEnabled === enabled) return prosodyEnabled;
  prosodyEnabled = enabled;
  cachedProsodyMelody = undefined;
  cancelSlowThinkingControllers("prosody mode changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  renderWorld();
  return prosodyEnabled;
}

function getGoalSectionDynamicsProfile(variant: FormVariant = getCurrentFormVariant()): SectionDynamicsProfile {
  return createGoalSectionDynamicsProfile(
    variant.sectionDynamicsProfile,
    appliedSongGoal
      ? {
        id: appliedSongGoal.id,
        energy: appliedSongGoal.energy,
        sectionEmphasis: appliedSongGoal.sectionEmphasis,
      }
      : undefined,
  );
}

function getGoalTasteProfile(player: Player): PlayerTasteProfile {
  return createGoalTasteProfile(
    player.taste,
    player.role,
    appliedSongGoal
      ? {
        id: appliedSongGoal.id,
        surpriseTarget: appliedSongGoal.surpriseTarget,
        dispositionBias: appliedSongGoal.dispositionBias,
      }
      : undefined,
  );
}

function getGoalTasteProfiles(): readonly {
  playerId: string;
  role: string;
  base: PlayerTasteProfile;
  adjusted: PlayerTasteProfile;
}[] {
  return world.getPlayers().map(({ player }) => ({
    playerId: player.id,
    role: player.role,
    base: { ...player.taste },
    adjusted: getGoalTasteProfile(player),
  }));
}

function getCurrentFormVariantScores(state: GrowTransportState = getState()): readonly ScoredFormVariant[] {
  const song = getSongMaterial(state.songId);
  const tonalContext = world.getTonalContext();
  const chorusDevelopment = getCurrentChorusDevelopment();
  const scored = FORM_VARIANTS.map((variant) => ({
    variant,
    score: createFormScore({
      song,
      tonalContext,
      arrangement: variant.arrangement,
      chorusDevelopment,
      sectionDynamicsProfile: getGoalSectionDynamicsProfile(variant),
    }),
    active: variant.id === formVariantId,
    winner: false,
  }));
  const winner = [...scored].sort((left, right) =>
    right.score.total - left.score.total || left.variant.id.localeCompare(right.variant.id)
  )[0];
  return scored.map((entry) => ({
    ...entry,
    winner: entry.variant.id === winner?.variant.id,
  }));
}

function applyFormVariant(nextVariantId: FormVariantId): FormVariantId {
  const previousVariantId = formVariantId;
  if (previousVariantId === nextVariantId) return formVariantId;
  formVariantId = nextVariantId;
  cancelSlowThinkingControllers("form variant changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  recordFormVariantChanged(previousVariantId, formVariantId);
  renderWorld();
  return formVariantId;
}

function renderFormScore(score: FormScore): void {
  const variant = getCurrentFormVariant();
  const variantScores = getCurrentFormVariantScores();
  const winner = variantScores.find((entry) => entry.winner) ?? variantScores[0];
  formVariantCurrent.textContent = `${variant.label} | ${variant.summary}`;
  formVariantWinner.textContent = winner
    ? `${winner.variant.label} ${winner.score.total.toFixed(3)}`
    : "none";
  formVariantCandidates.textContent = variantScores.map((entry) =>
    `${entry.active ? "*" : ""}${entry.variant.label} ${entry.score.total.toFixed(3)} ${entry.winner ? "winner" : ""}`
      .trim()
  ).join(" | ");
  for (const input of formVariantControl.querySelectorAll<HTMLInputElement>("input[name='form-variant']")) {
    input.checked = input.value === formVariantId;
  }
  formScoreTotal.textContent = `${score.total.toFixed(3)} | ${score.summary}`;
  formScoreSubscores.textContent = [
    `harmony ${score.harmonicMotion.score.toFixed(2)}`,
    `energy ${score.energyArc.score.toFixed(2)}`,
    `proportion ${score.proportion.score.toFixed(2)}`,
    `motif ${score.melodicCoherence.score.toFixed(2)}`,
    `cadence ${score.cadence.score.toFixed(2)}`,
  ].join(" | ");
  formScoreSections.textContent = score.sections.map(formatFormScoreSection).join(" | ");
  formScoreCritique.textContent = score.topCritique;
}

function formatFormScoreSection(section: FormScore["sections"][number]): string {
  const tonalContext = world.getTonalContext();
  const roots = section.rootDegrees
    .map((degree) => rootNoteFromScaleDegree(tonalContext, degree))
    .join("-");
  return `${section.label} ${roots || tonalContext.tonic} E${section.energy.toFixed(2)} M${section.melodyNoteCount}`;
}

function isMelodyDevelopmentMode(value: string): value is MelodyDevelopmentMode {
  return value === "raw" || value === "repaired";
}

function roundDisplayBeat(value: number): number {
  return Math.round(value * 100) / 100;
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

function formatTonalContextDisplay(tonalContext: ListeningFrame["tonalContext"]): {
  label: string;
  title: string;
  classicalMode: string;
} {
  const classicalMode = tonalContext.mode;
  const modeName = isKnownSongGoalMode(classicalMode)
    ? modeDisplayName(classicalMode) ?? classicalMode
    : classicalMode;
  const classicalLabel = capitalizeModeName(classicalMode);
  return {
    label: `${tonalContext.tonic} ${modeName}`,
    title: `${modeName} · ${classicalLabel} · key of ${tonalContext.tonic}`,
    classicalMode,
  };
}

function renderTonalContextDisplay(
  element: HTMLElement,
  tonalContext: ListeningFrame["tonalContext"],
): void {
  const display = formatTonalContextDisplay(tonalContext);
  element.textContent = display.label;
  element.title = display.title;
  element.dataset.modeClassical = display.classicalMode;
}

function isKnownSongGoalMode(mode: string): mode is SongGoalMode {
  return (SONG_GOAL_MODES as readonly string[]).includes(mode);
}

function capitalizeModeName(mode: string): string {
  if (mode.length === 0) return mode;
  return `${mode[0]?.toUpperCase() ?? ""}${mode.slice(1)}`;
}

function renderListening(frame: ListeningFrame): void {
  const latestEvent = frame.recentEvents.at(-1);
  renderTonalContextDisplay(listeningTonalContext, frame.tonalContext);
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
  ollamaSendProposalButton.disabled = ollamaRequestInFlight;
  melodyCriticSendButton.disabled = ollamaRequestInFlight;
  ollamaHealthStatus.textContent = `${ollamaHealth.status}: ${ollamaHealth.message}`;
  ollamaModelStatus.textContent = `${ollamaConfig.model} @ ${ollamaConfig.baseUrl}`;
  ollamaProtocolStatus.textContent = `${ollamaConfig.promptProtocol} (${getThoughtPromptProtocol(ollamaConfig.promptProtocol).label})`;
  ollamaLatency.textContent = formatOllamaLatency(ollamaThoughtTest, ollamaHealth);
  ollamaParseResult.textContent = formatOllamaParse(ollamaThoughtTest.parse);
  ollamaValidationResult.textContent = formatOllamaValidation(ollamaThoughtTest);
  ollamaProposalTextStatus.textContent = formatOllamaProposalTextStatus(ollamaProposalTextTest);
  ollamaFallbackStatus.textContent = formatOllamaFallback(ollamaThoughtTest);
  ollamaErrors.textContent = formatOllamaErrors(ollamaThoughtTest);
  ollamaRawResponse.textContent = formatRawResponse(ollamaThoughtTest.rawResponse);
  ollamaProposalRawResponse.textContent = formatRawResponse(ollamaProposalTextTest.rawResponse);
}

function renderSessionMode(): void {
  const mode = world.getSessionMode();
  const transportState = getState();
  sessionModeCurrent.textContent = getSessionModeLabel(mode);
  for (const input of sessionModeControl.querySelectorAll<HTMLInputElement>("input[name='session-mode']")) {
    input.checked = input.value === mode;
  }
  songCurrent.textContent = getSongLabel(songId);
  songSectionCurrent.textContent = formatSongSection(transportState.songForm);
  songHarmonyCurrent.textContent = formatSongHarmony(transportState);
  for (const input of songControl.querySelectorAll<HTMLInputElement>("input[name='song']")) {
    input.checked = input.value === songId;
  }
  timingFeelCurrent.textContent = getTimingFeelModeLabel(timingFeelMode);
  for (const input of timingFeelControl.querySelectorAll<HTMLInputElement>("input[name='timing-feel']")) {
    input.checked = input.value === timingFeelMode;
  }
}

function formatSongSection(section: GrowTransportState["songForm"]): string {
  return `${section.label} ${section.occurrence}, bar ${section.localBar}/${section.bars}`;
}

function formatSongHarmony(state: GrowTransportState): string {
  const tonalContext = world.getTonalContext();
  const rootName = rootNoteFromScaleDegree(tonalContext, state.harmony.rootDegree);
  const plan = state.harmony.rootDegrees
    .map((degree) => rootNoteFromScaleDegree(tonalContext, degree))
    .join("-");
  return `${state.harmony.label} ${rootName} (${plan}, ${state.harmony.strategy})`;
}

function renderPersistence(): void {
  persistenceStatus.textContent = formatPersistenceState(persistence.getState());
  musicalEventBufferStatus.textContent = formatMusicalEventBufferState(
    musicalEventRecordBuffer.getState(),
  );
}

function formatPersistenceState(state: PersistenceClientState): string {
  const pending = state.pendingCount > 0 ? `, ${state.pendingCount} pending` : "";
  const retry = state.status === "retrying" ? `, retry ${state.retryAttempt}` : "";
  const error = state.lastError ? `, ${state.lastError}` : "";
  return `${state.status}, ${state.appendedCount} saved${pending}${retry}${error}`;
}

function formatMusicalEventBufferState(state: MusicalEventRecordBufferState): string {
  const dropped = state.droppedCount > 0 ? `, ${state.droppedCount} dropped` : "";
  const lastFlush = musicalEventLastFlushAt
    ? `, flushed ${musicalEventLastFlushCount}`
    : "";
  return `${state.pendingCount} queued, ${state.enqueuedCount} heard${dropped}${lastFlush}`;
}

function renderWrittenEvolvingControl(): void {
  const value = writtenEvolvingDialValue.toFixed(2);
  if (writtenEvolvingDialInput.value !== value) {
    writtenEvolvingDialInput.value = value;
  }
  writtenEvolvingRegimeReadout.textContent = writtenEvolvingRegime;
}

function renderStatus(state: GrowTransportState): void {
  button.textContent = state.status === "playing" ? "Stop" : "Start";
  status.value = `mode ${getSessionModeLabel(state.sessionMode).toLowerCase()} | song ${getSongLabel(state.songId)} | section ${formatSongSection(state.songForm).toLowerCase()} | ${state.status} | ${state.bpm} BPM | bar ${state.bar} | beat ${state.currentBeat.toFixed(1)} | lookahead ${state.lookahead.health} ${state.lookahead.leadBeats.toFixed(1)}/${state.lookahead.targetBeats.toFixed(0)} | pending slots ${state.lookahead.pendingSlotCount}`;
  const tonalContext = world.getTonalContext();
  controlTempoReadout.textContent = `${state.bpm} BPM`;
  renderTonalContextDisplay(controlKeyReadout, tonalContext);
  renderWrittenEvolvingControl();
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

function getCurrentSlowThinkingRequest(playerId: string): PlayerThoughtRequest {
  const request = getCurrentThoughtRequest(playerId);
  const compilableActions = getSlowThinkingCompilableActions(playerId);
  const allowedActions = request.allowedActions.filter((action) =>
    compilableActions.includes(action)
  );

  return {
    ...request,
    allowedActions: allowedActions.length > 0 ? allowedActions : ["change_density"],
  };
}

function handleAcceptedSlowThought(accepted: AcceptedSlowThought): void {
  const playback = compileAcceptedSlowThought(accepted);
  if (playback) {
    activeSlowThoughtPlaybacks.set(playback.playerId, playback);
  }
  queueRender();
}

function compileAcceptedSlowThought(accepted: AcceptedSlowThought): SlowThoughtPlayback | undefined {
  const mode = getSlowThoughtPlaybackMode(accepted.intent.action);
  if (!mode) return undefined;

  const state = getState();
  clearExpiredSlowThoughtPlayback(state.currentBeat);
  const existingPlayback = activeSlowThoughtPlaybacks.get(accepted.playerId);
  if (existingPlayback && existingPlayback.endBeat > state.currentBeat) {
    return undefined;
  }

  const earliestStartBeat = Math.max(
    accepted.committedStartBeat,
    state.currentBeat + SLOW_THINKING_LATE_MARGIN_BEATS,
  );
  const startBeat = getNextSlowThoughtBoundaryBeat(earliestStartBeat);
  const durationBeats = clamp(
    accepted.intent.target.durationBeats,
    1,
    SLOW_THINKING_MAX_COMPILED_DURATION_BEATS,
  );
  const endBeat = startBeat + durationBeats;
  const registerShift = mode === "shift-register"
    ? getRegisterShiftFromAcceptedThought(accepted)
    : undefined;

  return {
    id: accepted.id,
    requestId: accepted.requestId,
    playerId: accepted.playerId,
    action: accepted.intent.action,
    mode,
    startBeat,
    endBeat,
    acceptedAtBeat: accepted.acceptedAtBeat,
    retargeted: accepted.retargeted || startBeat !== accepted.committedStartBeat,
    registerShift,
    summary: accepted.intent.rationale,
  };
}

function getSlowThoughtPlaybackMode(action: ThoughtAction): SlowThoughtPlaybackMode | undefined {
  if (action === "rest") return "rest";
  if (action === "simplify" || action === "change_density") return "thin";
  if (action === "shift_register") return "shift-register";
  return undefined;
}

function getRegisterShiftFromAcceptedThought(accepted: AcceptedSlowThought): number {
  return clampInteger(accepted.intent.registerDelta ?? 0, -1, 1);
}

function getNextSlowThoughtBoundaryBeat(beat: number): number {
  return Math.ceil(beat / SLOW_THINKING_BOUNDARY_BEATS) * SLOW_THINKING_BOUNDARY_BEATS;
}

function getSlowThinkingCompilableActions(playerId: string): readonly ThoughtAction[] {
  if (isSlowThinkingPlayerId(playerId)) {
    return SLOW_THINKING_COMPILABLE_ACTIONS_BY_PLAYER[playerId];
  }
  return ["change_density"];
}

function isSlowThinkingPlayerId(playerId: string): playerId is (typeof SLOW_THINKING_PLAYER_IDS)[number] {
  return (SLOW_THINKING_PLAYER_IDS as readonly string[]).includes(playerId);
}

function getSlowThinkingLoopState(playerId: string): SlowThinkingLoopState | undefined {
  return slowThinkingControllersByPlayer.get(playerId)?.getState();
}

function getSlowThinkingLoopStates(): SlowThinkingLoopState[] {
  return slowThinkingControllers.map((controller) => controller.getState());
}

function hasPendingSlowThinkingController(exceptPlayerId?: string): boolean {
  return slowThinkingControllers.some((controller) => {
    const state = controller.getState();
    return state.status === "pending" && state.playerId !== exceptPlayerId;
  });
}

function evaluateSlowThinkingControllers(): void {
  for (const controller of slowThinkingControllers) {
    const state = controller.getState();
    if (state.status !== "pending" && hasPendingSlowThinkingController(state.playerId)) {
      continue;
    }
    controller.evaluate();
  }
}

function cancelSlowThinkingControllers(message: string): void {
  for (const controller of slowThinkingControllers) {
    controller.cancel(message);
  }
}

function getSlowThoughtPlaybackForPlayer(playerId: string): SlowThoughtPlayback | undefined {
  clearExpiredSlowThoughtPlayback();
  const playback = activeSlowThoughtPlaybacks.get(playerId);
  return playback ? { ...playback } : undefined;
}

function getActiveSlowThoughtPlayback(): SlowThoughtPlayback | undefined {
  return getActiveSlowThoughtPlaybacks()[0];
}

function getActiveSlowThoughtPlaybacks(): SlowThoughtPlayback[] {
  clearExpiredSlowThoughtPlayback();
  return [...activeSlowThoughtPlaybacks.values()].map((playback) => ({ ...playback }));
}

function clearExpiredSlowThoughtPlayback(currentBeat = getState().currentBeat): void {
  for (const [playerId, playback] of activeSlowThoughtPlaybacks.entries()) {
    if (playback.endBeat <= currentBeat) {
      activeSlowThoughtPlaybacks.delete(playerId);
    }
  }
}

function clearSlowThoughtPlayback(): void {
  activeSlowThoughtPlaybacks.clear();
}

function applySlowThoughtDecision(
  input: TasteNoteDecisionInput,
  baseDecision: TasteNoteDecision,
): TasteNoteDecision {
  const playback = activeSlowThoughtPlaybacks.get(input.playerId);
  if (!playback) return baseDecision;
  if (input.absoluteBeat < playback.startBeat || input.absoluteBeat >= playback.endBeat) return baseDecision;

  if (playback.mode === "rest") {
    return {
      action: "rest",
      shouldPlay: false,
      velocityMultiplier: 0,
      tags: ["thought:rest"],
      reason: `Slow thought ${playback.action}: ${playback.summary}`,
    };
  }

  if (playback.mode === "shift-register") {
    const registerShift = playback.registerShift ?? 0;
    const shiftedPitch = shiftPitchOctave(input.pitch, registerShift);
    if (!shiftedPitch || shiftedPitch === input.pitch) return baseDecision;
    return {
      ...baseDecision,
      action: "vary",
      shouldPlay: true,
      velocityMultiplier: baseDecision.shouldPlay ? baseDecision.velocityMultiplier : 0.82,
      pitch: shiftedPitch,
      tags: [
        ...(baseDecision.tags ?? []),
        "thought:shift_register",
        `register:${formatSignedInteger(registerShift)}`,
      ],
      reason: `Slow thought ${playback.action}: ${playback.summary}`,
    };
  }

  if (!baseDecision.shouldPlay) return baseDecision;

  const shouldDrop = !isWholeBeat(input.absoluteBeat);
  return shouldDrop
    ? {
      action: "simplify",
      shouldPlay: false,
      velocityMultiplier: 0,
      tags: [`thought:${playback.action}`],
      reason: `Slow thought ${playback.action}: thinning offbeats.`,
    }
    : {
      action: "simplify",
      shouldPlay: true,
      velocityMultiplier: Math.min(baseDecision.velocityMultiplier, 0.76),
      tags: [`thought:${playback.action}`],
      reason: `Slow thought ${playback.action}: keeping only the anchored tones.`,
    };
}

function applySongSectionDecision(
  input: TasteNoteDecisionInput,
  baseDecision: TasteNoteDecision,
): TasteNoteDecision {
  const variant = getCurrentFormVariant();
  const section = sectionAtBeat(input.absoluteBeat, variant.arrangement);
  const dynamics = applySectionDynamics({
    role: input.role,
    sectionType: section.sectionType,
    occurrence: section.occurrence,
    localBeat: section.localBeat,
    localBar: section.localBar,
    absoluteBeat: input.absoluteBeat,
    profile: getGoalSectionDynamicsProfile(variant),
    baseAction: baseDecision.action,
    baseShouldPlay: baseDecision.shouldPlay,
    baseVelocityMultiplier: baseDecision.velocityMultiplier,
    baseReason: baseDecision.reason,
  });

  return {
    ...baseDecision,
    action: dynamics.action,
    shouldPlay: dynamics.shouldPlay,
    velocityMultiplier: dynamics.velocityMultiplier,
    tags: [...(baseDecision.tags ?? []), ...dynamics.tags],
    reason: dynamics.reason,
  };
}

function shiftPitchOctave(pitch: string, registerShift: number): string | undefined {
  const match = pitch.match(/^(.+?)(-?\d+)$/);
  if (!match) return undefined;
  const [, pitchClass, octaveText] = match;
  const octave = Number(octaveText);
  if (!Number.isInteger(octave)) return undefined;
  const shiftedOctave = clampInteger(octave + registerShift, 1, 7);
  return `${pitchClass}${shiftedOctave}`;
}

function formatSignedInteger(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function isWholeBeat(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 0.000001;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(clamp(value, minimum, maximum));
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
  ollamaProposalTextTest = createInitialOllamaProposalTextTest(ollamaConfig);
  resetMelodyCriticTest("Config changed; melody critic reset");
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
    evaluateSlowThinkingControllers();
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

async function runManualOllamaProposalTextTest(): Promise<OllamaProposalTextTestResult> {
  const config = readOllamaConfigFromInputs();
  const proposal = getCurrentBaseSongSketchProposal();
  ollamaRequestInFlight = true;
  ollamaProposalTextTest = {
    ...createInitialOllamaProposalTextTest(config),
    status: "running",
    provider: "ollama",
    proposalId: proposal.id,
    sourceSongId: proposal.sourceSongId,
    message: "Sending one proposal text request to local Ollama",
  };
  renderOllama();
  try {
    ollamaProposalTextTest = await runOllamaProposalTextTest(proposal, config);
    return ollamaProposalTextTest;
  } finally {
    ollamaRequestInFlight = false;
    renderWorld();
  }
}

async function runManualOllamaMelodyCriticTest(): Promise<OllamaMelodyCriticTestResult> {
  const config = readOllamaConfigFromInputs();
  const take = getCurrentMelodyRepairTake();
  const previousCandidateId = getCurrentMelodyRepairDecision().candidate.id;
  ollamaRequestInFlight = true;
  activeMelodyCriticSelection = undefined;
  ollamaMelodyCriticTest = {
    ...createInitialOllamaMelodyCriticTest(config),
    status: "running",
    provider: "ollama",
    takeId: take.id,
    songId: take.songId,
    deterministicCandidateId: take.deterministicCandidateId,
    bestCandidateId: take.bestCandidateId,
    message: "Sending scored candidates to local melody critic",
  };
  renderWorld();
  try {
    ollamaMelodyCriticTest = await runOllamaMelodyCriticTest(take, config);
    if (
      ollamaMelodyCriticTest.status === "valid" &&
      ollamaMelodyCriticTest.selection &&
      getMelodyRepairCandidate(take, ollamaMelodyCriticTest.selection.selectedCandidateId)
    ) {
      activeMelodyCriticSelection = ollamaMelodyCriticTest.selection;
    } else {
      activeMelodyCriticSelection = undefined;
    }

    const nextDecision = getCurrentMelodyRepairDecision();
    const nextCandidateId = nextDecision.candidate.id;
    if (nextCandidateId !== previousCandidateId) {
      refreshLookaheadSchedule();
    }
    recordMelodyCriticOutcome(take, ollamaMelodyCriticTest, nextDecision.consensus);
    return ollamaMelodyCriticTest;
  } finally {
    ollamaRequestInFlight = false;
    renderWorld();
  }
}

function recordMelodyCriticOutcome(
  take: MelodyRepairTake,
  result: OllamaMelodyCriticTestResult,
  consensus: MelodyConsensusDecision,
): void {
  const selectedCandidate = getMelodyRepairCandidate(take, consensus.selectedCandidateId) ??
    getMelodyRepairCandidate(take, take.deterministicCandidateId);
  persistence.record({
    type: "song.melody_critic_selection",
    actorId: "local-ollama",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      source: "melody-critic",
      status: result.status,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      songId,
      takeId: take.id,
      deterministicCandidateId: take.deterministicCandidateId,
      bestCandidateId: take.bestCandidateId,
      proposedBy: consensus.proposedBy,
      proposedCandidateId: consensus.proposedCandidateId,
      modelSelectedCandidateId: result.selectedCandidateId,
      selectedCandidateId: selectedCandidate?.id ?? result.selectedCandidateId,
      selectedCandidateStrategy: selectedCandidate?.strategy,
      selectedBy: consensus.selectedBy,
      scoreDeltaFromBest: selectedCandidate?.scoreDeltaFromBest,
      scoreDeltaFromDeterministic: selectedCandidate?.scoreDeltaFromDeterministic,
      consensusAgreementScore: consensus.agreementScore,
      consensusSummary: consensus.summary,
      consensusResponses: consensus.responses.map((response) => ({
        playerId: response.playerId,
        stance: response.stance,
        preferredCandidateId: response.preferredCandidateId,
        preferredStrategy: response.preferredStrategy,
        preferenceMargin: response.preferenceMargin,
      })),
      validationErrors: result.validation.errors,
    },
  });
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

function parseManualOllamaMelodyCriticResponse(rawResponse: string): OllamaMelodyCriticParseResult {
  return parseOllamaMelodyCriticResponse(rawResponse);
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

function formatOllamaProposalTextStatus(result: OllamaProposalTextTestResult): string {
  if (result.status === "idle") return "idle";
  if (result.status === "running") return `running ${result.proposalId ?? "proposal"}`;
  if (result.status === "valid") {
    return `model text valid (${result.sourceSongId ?? "song"})`;
  }
  if (result.status === "invalid") {
    return `invalid (${result.validation.errors.length}); mock text active`;
  }
  return `failed; mock text active (${result.message})`;
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
  renderPersistence();
  renderStatus(state);
  renderLookahead(state.lookahead);
  const players = world.getPlayers();
  const frame = world.getListeningFrame({
    tempo: state.bpm,
    meter: [4, 4],
    currentBeat: state.currentBeat,
  });
  world.syncTasteEvaluations(frame, {
    getTasteProfile: getGoalTasteProfile,
  });
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
  renderSongGoal(songGoalInterpretation);
  renderSongSketch(getCurrentSongSketch(state));
  renderMelodyRepair(getCurrentMelodyRepairTake(state));
  renderFormScore(getCurrentFormScore(state));
  renderListening(frame);
  renderAnchorPhraseEditor();
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
    cancelSlowThinkingControllers("transport stopped");
    clearSlowThoughtPlayback();
    world.clearMusicalEvents();
    world.resetTasteEvaluations();
    world.clearThinkingPlayers();
    world.syncPlayerStates(state.status, state.currentBeat);
  }

  previousTransportStatus = state.status;
}

function handleTransportState(): void {
  clearExpiredSlowThoughtPlayback();
  evaluateSlowThinkingControllers();
  queueRender();
}

function handleMusicalEvent(event: MusicalEvent): void {
  enqueueMusicalEventForPersistence(event);
  world.recordMusicalEvent(event);
  if (event.kind === "note") {
    pendingPlayerFlashes.add(event.playerId);
  }
  queueRender();
}

function enqueueMusicalEventForPersistence(event: MusicalEvent): void {
  musicalEventRecordBuffer.enqueue({
    event,
    tonalContext: cloneTonalContext(world.getTonalContext()),
    enqueuedAtMs: performance.now(),
    playSpanSerial: musicalEventPlaySpanSerial,
  });
}

function flushMusicalEventBufferToPersistence(
  reason: string,
  limit = MUSICAL_EVENT_FLUSH_BATCH_SIZE,
): number {
  const sources = musicalEventRecordBuffer.drain(limit);
  if (sources.length === 0) return 0;

  for (const source of sources) {
    const record = createMusicalEventPersistenceRecord(source.event, source.tonalContext);
    persistence.record({
      id: createMusicalEventPersistenceId(source),
      type: record.type,
      actorId: record.actorId,
      sessionMode: world.getSessionMode(),
      beat: record.beat,
      payload: record.payload as unknown as Record<string, unknown>,
    });
  }

  musicalEventLastFlushAt = new Date().toISOString();
  musicalEventLastFlushCount = sources.length;
  if (!isTearingDown) queueRender();
  if (import.meta.env.DEV) {
    console.info(`[persistence] flushed ${sources.length} musical events from buffer (${reason})`);
  }
  return sources.length;
}

function beginMusicalEventPersistenceSpan(): void {
  musicalEventPlaySpanSerial += 1;
}

function createMusicalEventPersistenceId(source: MusicalEventRecordSource): string {
  return `musical-${persistence.getState().sessionId}-span-${source.playSpanSerial}-${source.event.id}`;
}

function cloneTonalContext(tonalContext: ListeningFrame["tonalContext"]): ListeningFrame["tonalContext"] {
  return {
    ...tonalContext,
    scale: [...tonalContext.scale],
  };
}

function handlePageHide(): void {
  flushMusicalEventBufferToPersistence("pagehide", MUSICAL_EVENT_DRAIN_ALL);
  persistence.flushOnPageHide();
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && playerActionMenuOpen) {
    closePlayerActionMenu();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && isAnchorPhraseEditorOpen) {
    closeAnchorPhraseEditor();
    event.preventDefault();
    return;
  }
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    isAnchorPhraseEditorOpen &&
    isAnchorPhraseEditMode &&
    selectedAnchorRef
  ) {
    removeAnchorPhraseAnchor(selectedAnchorRef.segmentIndex, selectedAnchorRef.anchorIndex);
    event.preventDefault();
  }
}

function queueRender(): void {
  if (renderFrameId !== null) return;
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    renderWorld();
  });
}

function applySessionMode(mode: SessionMode): SessionMode {
  const previousMode = world.getSessionMode();
  if (previousMode === mode) return previousMode;
  world.setSessionMode(mode);
  if (mode !== "rehearsal") {
    clearSlowThoughtPlayback();
  }
  recordSessionModeChanged(previousMode, world.getSessionMode());
  evaluateSlowThinkingControllers();
  renderWorld();
  return world.getSessionMode();
}

function applySongId(nextSongId: SongId): SongId {
  const previousSongId = songId;
  if (previousSongId === nextSongId) return songId;
  songId = nextSongId;
  resetAnchorPhraseEditorSession("Song changed; generated phrase restored.", { refresh: false, render: false });
  resetAnchorPhraseEditorSaveState();
  melodyRepairFeedbackMessage = "No feedback yet.";
  invalidateMelodyRepairCache();
  ollamaProposalTextTest = createInitialOllamaProposalTextTest(ollamaConfig);
  resetMelodyCriticTest("Song changed; melody critic reset");
  cancelSlowThinkingControllers("song changed before the thought could land");
  clearSlowThoughtPlayback();
  world.clearMusicalEvents();
  world.resetTasteEvaluations();
  refreshLookaheadSchedule();
  recordSongChanged(previousSongId, songId);
  renderWorld();
  return songId;
}

function applyTimingFeelMode(mode: TimingFeelMode): TimingFeelMode {
  const previousMode = timingFeelMode;
  if (previousMode === mode) return timingFeelMode;
  timingFeelMode = mode;
  cancelSlowThinkingControllers("timing feel changed before the thought could land");
  clearSlowThoughtPlayback();
  refreshLookaheadSchedule();
  recordTimingFeelChanged(previousMode, timingFeelMode);
  renderWorld();
  return timingFeelMode;
}

function recordSessionStarted(): void {
  persistence.record({
    type: "session.started",
    actorId: "system",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      source: "browser:init",
      sessionMode: world.getSessionMode(),
      songId,
      timingFeelMode,
      formVariantId,
    },
  });
}

function recordSessionModeChanged(fromMode: SessionMode, toMode: SessionMode): void {
  persistence.record({
    type: "session.mode_changed",
    actorId: "human",
    sessionMode: toMode,
    beat: getPersistenceBeat(),
    payload: {
      fromMode,
      toMode,
      source: "session-mode-control",
    },
  });
}

function recordSongChanged(fromSongId: SongId, toSongId: SongId): void {
  persistence.record({
    type: "song.changed",
    actorId: "human",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      fromSongId,
      toSongId,
      source: "song-control",
      clearedLedger: true,
      clearedSlowThinking: true,
    },
  });
}

function recordTimingFeelChanged(fromFeel: TimingFeelMode, toFeel: TimingFeelMode): void {
  persistence.record({
    type: "timing.feel_changed",
    actorId: "human",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      fromFeel,
      toFeel,
      source: "timing-feel-control",
      refreshedLookahead: true,
      clearedSlowThinking: true,
    },
  });
}

function recordFormVariantChanged(fromVariantId: FormVariantId, toVariantId: FormVariantId): void {
  persistence.record({
    type: "song.form_variant_changed",
    actorId: "human",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      fromVariantId,
      toVariantId,
      source: "form-variant-control",
      refreshedLookahead: true,
      clearedSlowThinking: true,
    },
  });
}

function recordSongGoalSet(
  goal: SongGoal,
  previousSetup: Record<string, unknown>,
  nextSetup: Record<string, unknown>,
): void {
  persistence.record({
    type: "song.goal_set",
    actorId: "human",
    sessionMode: world.getSessionMode(),
    beat: getPersistenceBeat(),
    payload: {
      source: "song-goal-apply",
      goal: cloneSongGoal(goal) as unknown as Record<string, unknown>,
      previousSetup,
      nextSetup,
      refreshedLookahead: true,
      clearedLedger: true,
      clearedSlowThinking: true,
    },
  });
}

function getPersistenceBeat(): number {
  return roundDisplayBeat(getState().currentBeat);
}

initTransport({
  tick: handleTransportState,
  musicalEvent: handleMusicalEvent,
  noteDecision: (input) =>
    applySlowThoughtDecision(input, applySongSectionDecision(input, world.getTasteNoteDecision(input))),
  sessionMode: () => world.getSessionMode(),
  shouldRefillLookahead: () => shouldSessionModeRefillLookahead(world.getSessionMode()),
  songId: () => songId,
  songArrangement: () => getCurrentFormVariant().arrangement,
  tonalContext: () => world.getTonalContext(),
  tempoBpm: () => activeTempoBpm,
  timingFeelMode: () => timingFeelMode,
  chorusDevelopment: () => getCurrentChorusDevelopment(),
  melodyPhrasing: () => getActiveMelodyPhrasing(),
}, {
  tonalContext: world.getTonalContext(),
  tempoBpm: activeTempoBpm,
});
recordSessionStarted();
renderWorld();

inspectToggle.addEventListener("click", () => {
  setInspectDrawerOpen(!isInspectDrawerOpen);
});

playerEntryMelody.addEventListener("click", () => {
  if (playerActionMenuOpen && playerActionMenuTrigger === playerEntryMelody) {
    closePlayerActionMenu();
    return;
  }
  openPlayerActionMenu(playerEntryMelody);
});

playerEntryMelody.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown") return;
  event.preventDefault();
  openPlayerActionMenu(playerEntryMelody);
});

playerMenuGraphicalPhrase.addEventListener("click", () => {
  openAnchorPhraseEditor();
});

playerActionMenu.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closePlayerActionMenu();
});

document.addEventListener("click", (event) => {
  if (!playerActionMenuOpen) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (
    target.closest("[data-testid='player-action-menu']") ||
    target.closest("[data-testid='player-entry-melody']") ||
    target.closest("[data-testid='player-card-melody']")
  ) {
    return;
  }
  closePlayerActionMenu({ restoreFocus: false });
});

playerList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const card = target.closest<HTMLElement>("[data-testid='player-card-melody']");
  if (!card) return;
  openPlayerActionMenu(card);
});

playerList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const card = target.closest<HTMLElement>("[data-testid='player-card-melody']");
  if (!card) return;
  openPlayerActionMenu(card);
  event.preventDefault();
});

anchorPhraseEditorClose.addEventListener("click", () => {
  closeAnchorPhraseEditor();
});

anchorPhraseEditorBackdrop.addEventListener("click", () => {
  closeAnchorPhraseEditor();
});

anchorPhraseEditorEditToggle.addEventListener("click", () => {
  if (isAnchorPhraseEditMode) {
    exitAnchorPhraseEditMode("Edit mode exited; generated phrase restored.");
    return;
  }
  enterAnchorPhraseEditMode();
});

anchorPhraseEditorRevert.addEventListener("click", () => {
  exitAnchorPhraseEditMode("Reverted to generated prosody phrase.");
});

anchorPhraseEditorCatalogPrev.addEventListener("click", () => {
  stepAnchorPhraseCatalog(-1);
});

anchorPhraseEditorCatalogNext.addEventListener("click", () => {
  stepAnchorPhraseCatalog(1);
});

anchorPhraseEditorCatalogListToggle.addEventListener("click", () => {
  anchorPhraseCatalogListOpen = !anchorPhraseCatalogListOpen;
  renderAnchorPhraseEditor();
});

anchorPhraseEditorCatalogList.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("[data-catalog-index]")
    : null;
  if (!target || target.disabled) return;
  selectAnchorPhraseCatalogIndex(Number(target.dataset.catalogIndex));
});

anchorPhraseEditorNewIdea.addEventListener("click", () => {
  startNewAnchorPhraseIdea();
});

anchorPhraseEditorPreview.addEventListener("click", () => {
  previewSelectedAnchorPhraseCatalogEntry();
});

anchorPhraseEditorEditSelected.addEventListener("click", () => {
  editSelectedAnchorPhraseCatalogEntry();
});

anchorPhraseEditorSave.addEventListener("click", () => {
  void saveAnchorPhraseEditorCandidate();
});

anchorPhraseEditorAnchorPanelToggle.addEventListener("click", () => {
  anchorPhraseAnchorPanelOpen = !anchorPhraseAnchorPanelOpen;
  if (anchorPhraseAnchorPanelOpen) {
    anchorPhraseConnectorPanelOpen = false;
  }
  renderAnchorPhraseEditor();
});

anchorPhraseEditorConnectorPanelToggle.addEventListener("click", () => {
  anchorPhraseConnectorPanelOpen = !anchorPhraseConnectorPanelOpen;
  if (anchorPhraseConnectorPanelOpen) {
    anchorPhraseAnchorPanelOpen = false;
  }
  renderAnchorPhraseEditor();
});

anchorPhraseEditorConnectorMoreToggle.addEventListener("click", () => {
  anchorPhraseConnectorMoreOpen = !anchorPhraseConnectorMoreOpen;
  renderAnchorPhraseEditor();
});

anchorPhraseEditorAddAnchor.addEventListener("click", () => {
  if (!selectedAnchorRef || !workingAnchorPhrase) return;
  const anchor = workingAnchorPhrase.segments[selectedAnchorRef.segmentIndex]?.anchors[selectedAnchorRef.anchorIndex];
  if (!anchor) return;
  addAnchorPhraseAnchor(selectedAnchorRef.segmentIndex, anchor.startBeat + anchor.durationBeats + ANCHOR_EDIT_GRID_BEATS);
});

anchorPhraseEditorRemoveAnchor.addEventListener("click", () => {
  if (!selectedAnchorRef) return;
  removeAnchorPhraseAnchor(selectedAnchorRef.segmentIndex, selectedAnchorRef.anchorIndex);
});

anchorPhraseEditorSplitSegment.addEventListener("click", () => {
  if (!selectedAnchorRef) return;
  splitAnchorPhraseSegment(selectedAnchorRef.segmentIndex, selectedAnchorRef.anchorIndex);
});

anchorPhraseEditorJoinSegments.addEventListener("click", () => {
  if (!workingAnchorPhrase) return;
  const segmentIndex = getSelectedJoinSegmentIndex(workingAnchorPhrase);
  if (segmentIndex === undefined) return;
  joinAnchorPhraseSegments(segmentIndex);
});

anchorPhraseEditorDynamics.addEventListener("input", () => {
  if (!selectedAnchorRef) return;
  editAnchorPhraseAnchor(selectedAnchorRef.segmentIndex, selectedAnchorRef.anchorIndex, {
    dynamics: Number(anchorPhraseEditorDynamics.value),
  });
});

for (const button of anchorPhraseEditorKernelButtons) {
  button.addEventListener("click", () => {
    if (!selectedConnectorRef) return;
    const kernel = button.dataset.kernel;
    if (!kernel) return;
    editAnchorPhraseConnector(selectedConnectorRef.segmentIndex, selectedConnectorRef.connectorIndex, {
      kernel,
    });
  });
}

for (const input of anchorPhraseEditorConnectorKnobs) {
  input.addEventListener("input", () => {
    if (!selectedConnectorRef) return;
    const knob = input.dataset.connectorKnob;
    if (!knob || !isConnectorKnob(knob)) return;
    editAnchorPhraseConnector(
      selectedConnectorRef.segmentIndex,
      selectedConnectorRef.connectorIndex,
      createConnectorKnobPatch(knob, Number(input.value)),
    );
  });
}

anchorPhraseEditorRoll.addEventListener("click", (event) => {
  if (!isAnchorPhraseEditMode || anchorPhraseEditorDrag) return;
  const connectorTarget = event.target instanceof Element
    ? event.target.closest<SVGElement>(
      "[data-testid='anchor-phrase-editor-connector'], [data-testid='anchor-phrase-editor-connector-label']",
    )
    : null;
  if (connectorTarget) {
    const segmentIndex = Number(connectorTarget.dataset.segmentIndex);
    const connectorIndex = Number(connectorTarget.dataset.connectorIndex);
    if (!Number.isInteger(segmentIndex) || !Number.isInteger(connectorIndex)) return;
    selectAnchorPhraseEditorConnector({ segmentIndex, connectorIndex });
    return;
  }
  const target = event.target instanceof Element
    ? event.target.closest<SVGGElement>("[data-testid='anchor-phrase-editor-anchor']")
    : null;
  if (!target) return;
  const segmentIndex = Number(target.dataset.segmentIndex);
  const anchorIndex = Number(target.dataset.anchorIndex);
  if (!Number.isInteger(segmentIndex) || !Number.isInteger(anchorIndex)) return;
  selectAnchorPhraseEditorAnchor({ segmentIndex, anchorIndex });
});

anchorPhraseEditorRoll.addEventListener("dblclick", (event) => {
  if (!isAnchorPhraseEditMode || !workingAnchorPhrase || !canEditAnchorPhrase()) return;
  const target = event.target instanceof Element
    ? event.target.closest(
      "[data-testid='anchor-phrase-editor-anchor'], [data-testid='anchor-phrase-editor-connector'], [data-testid='anchor-phrase-editor-connector-label']",
    )
    : null;
  if (target) return;
  const point = getAnchorPhraseEditorPointerValue(event, workingAnchorPhrase);
  if (!point) return;
  const segmentIndex = findAnchorPhraseSegmentIndexForBeat(workingAnchorPhrase, point.beat);
  addAnchorPhraseAnchor(segmentIndex, point.beat, {
    degree: point.degree,
    octave: point.octave,
  });
});

anchorPhraseEditorRoll.addEventListener("pointerdown", handleAnchorPhraseEditorPointerDown);
anchorPhraseEditorRoll.addEventListener("pointermove", handleAnchorPhraseEditorPointerMove);
anchorPhraseEditorRoll.addEventListener("pointerup", handleAnchorPhraseEditorPointerUp);
anchorPhraseEditorRoll.addEventListener("pointercancel", handleAnchorPhraseEditorPointerUp);

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const state = getState();
    if (state.status === "playing") {
      stopTransport();
      flushMusicalEventBufferToPersistence("stop", MUSICAL_EVENT_DRAIN_ALL);
    } else {
      const nextState = await startTransport();
      if (nextState.status === "playing") {
        beginMusicalEventPersistenceSpan();
      }
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

writtenEvolvingDialInput.addEventListener("input", () => {
  applyWrittenEvolvingDialValue(Number(writtenEvolvingDialInput.value));
});

melodyDevelopmentControl.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "melody-development") return;
  if (!isMelodyDevelopmentMode(input.value)) return;

  applyMelodyDevelopmentMode(input.value);
});

formVariantControl.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "form-variant") return;
  if (!isFormVariantId(input.value)) return;

  applyFormVariant(input.value);
});

songGoalInterpretButton.addEventListener("click", () => {
  applySongGoalIdea(songGoalIdeaInput.value);
});

songGoalApplyButton.addEventListener("click", () => {
  applySongGoalSetup();
});

songGoalIdeaInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  applySongGoalIdea(songGoalIdeaInput.value);
});

melodyRepairUpButton.addEventListener("click", () => {
  rememberCurrentMelodyRepairTake();
});

melodyRepairDownButton.addEventListener("click", () => {
  rejectCurrentMelodyRepairTake();
});

melodyCriticSendButton.addEventListener("click", () => {
  void runManualOllamaMelodyCriticTest();
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

ollamaSendProposalButton.addEventListener("click", () => {
  void runManualOllamaProposalTextTest();
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
window.addEventListener("keydown", handleGlobalKeydown);
window.addEventListener("pagehide", handlePageHide);
musicalEventFlushTimerId = window.setInterval(() => {
  flushMusicalEventBufferToPersistence("interval");
}, MUSICAL_EVENT_FLUSH_INTERVAL_MS);
setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);
setInspectDrawerOpen(false);

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
      getProfiles(): readonly {
        playerId: string;
        role: string;
        base: PlayerTasteProfile;
        adjusted: PlayerTasteProfile;
      }[];
    };
    thinking?: {
      getSeeds(): readonly PlayerThoughtSeed[];
      getRequests(): readonly PlayerThoughtRequest[];
      getMockIntents(): readonly PlayerThoughtIntent[];
      getSlowLoop(playerId?: string): SlowThinkingLoopState | undefined;
      getSlowLoops(): readonly SlowThinkingLoopState[];
      getSlowPlayback(playerId?: string): SlowThoughtPlayback | undefined;
      getSlowPlaybacks(): readonly SlowThoughtPlayback[];
      triggerSlowLoop(playerId?: string): void;
    };
    session?: {
      getMode(): SessionMode;
      getModes(): readonly SessionModeOption[];
      setMode(mode: string): SessionMode;
    };
    song?: {
      getId(): SongId;
      getSongs(): readonly SongMaterial[];
      getProposal(): SongSketchProposal;
      getSketch(): SongSketch;
      setId(nextSongId: string): SongId;
    };
    songGoal?: {
      applySetup(): SongGoal | undefined;
      getAppliedGoal(): SongGoal | undefined;
      getGoal(): SongGoal;
      getLastResult(): SongGoalInterpretation;
      getVocabulary(): SongGoalVocabulary;
      interpret(sourceIdea: string): SongGoalInterpretation;
      validate(candidate: unknown): SongGoalValidationResult;
    };
    prosody?: {
      auditionEliteCandidate(options?: CandidateMelodyAuditionOptions): Promise<CandidateMelodyAuditionState>;
      clearCandidateAudition(): CandidateMelodyAuditionState;
      getControlDial(): WrittenEvolvingControlState;
      getEvolvingPerformance(): EvolvingElitePerformanceState;
      getAudition(): CandidateMelodyAuditionState;
      isEnabled(): boolean;
      performEvolvingElite(options?: EvolvingElitePerformanceOptions): EvolvingElitePerformanceState;
      setControlDial(value: number): WrittenEvolvingControlState;
      setEnabled(enabled: boolean): boolean;
      stopEvolvingElite(): EvolvingElitePerformanceState;
      getPattern(): PlayerPatternSource | undefined;
    };
    timing?: {
      getMode(): TimingFeelMode;
      setMode(mode: string): TimingFeelMode;
    };
    melodyRepair?: {
      getMode(): MelodyDevelopmentMode;
      setMode(mode: string): MelodyDevelopmentMode;
      getTake(): MelodyRepairTake;
      getCandidate(): MelodyRepairCandidate;
      getConsensus(): MelodyConsensusDecision;
      getCritic(): OllamaMelodyCriticTestResult;
      remember(): MelodyRepairTake;
      reject(): MelodyRepairTake;
    };
    formScore?: {
      getScore(): FormScore;
      getVariant(): FormVariant;
      getVariants(): readonly ScoredFormVariant[];
      setVariant(variantId: string): FormVariantId;
    };
    anchorPhrase?: {
      fromProsody(options?: { seed?: number; baseOctave?: number; bars?: number }): AnchorPhrase;
      getDemoPhrase(): AnchorPhrase;
      renderDemo(options?: { baseOctave?: number; playerId?: string; subdivisionBeats?: number }): PlayerPatternSource;
    };
    phraseEditor?: {
      addAnchor(segmentIndex: number, atBeat: number, options?: AddAnchorOptions): AnchorEditResult;
      editAnchor(segmentIndex: number, anchorIndex: number, patch: AnchorEditPatch): AnchorEditResult;
      editConnector(segmentIndex: number, connectorIndex: number, patch: ConnectorEditPatch): AnchorEditResult;
      editSelectedIdea(): AnchorPhraseEditorState;
      enterEditMode(): AnchorPhraseEditorState;
      exitEditMode(): AnchorPhraseEditorState;
      getCatalog(): AnchorPhraseCatalogState;
      getOverridePattern(): PlayerPatternSource | undefined;
      getState(): AnchorPhraseEditorState;
      getWorkingPhrase(): AnchorPhrase | undefined;
      joinSegments(segmentIndex: number): AnchorEditResult;
      newIdea(): AnchorPhraseEditorState;
      nextIdea(): AnchorPhraseCatalogState;
      previewSelectedIdea(): AnchorPhraseEditorSaveResult;
      previousIdea(): AnchorPhraseCatalogState;
      refreshCatalog(): Promise<AnchorPhraseCatalogState | undefined>;
      removeAnchor(segmentIndex: number, anchorIndex: number): AnchorEditResult;
      revert(): AnchorPhraseEditorState;
      save(): Promise<AnchorPhraseEditorSaveResult>;
      selectIdea(index: number): AnchorPhraseCatalogState;
      splitSegment(segmentIndex: number, anchorIndex: number): AnchorEditResult;
    };
    persistence?: {
      getState(): PersistenceClientState;
      getMusicalEventBufferState(): MusicalEventRecordBufferState;
      aggregateCandidateFitness(
        scores: CandidateScores,
        options?: CandidateFitnessOptions,
      ): CandidateFitnessResult;
      previewCandidateFitness(
        candidate: Candidate,
        options?: CandidateFitnessOptions,
      ): CandidateFitnessPreview;
      flush(): Promise<void>;
      flushMusicalEvents(): number;
      flushOnPageHide(): void;
      dump(limit?: number): Promise<unknown>;
      writeCandidate(candidate: CandidateInput, branchId?: string): ReturnType<typeof persistence.writeCandidate>;
      listCandidates(options?: CandidateQueryOptions): ReturnType<typeof persistence.listCandidates>;
      scoreCandidate(
        candidateId: string,
        scores: CandidateScores,
        fitness: number,
        branchId?: string,
      ): ReturnType<typeof persistence.scoreCandidate>;
      retainCandidates(candidateIds: readonly string[], branchId?: string): ReturnType<typeof persistence.retainCandidates>;
      reserveCandidates(candidateIds: readonly string[], branchId?: string): ReturnType<typeof persistence.reserveCandidates>;
      purgeCandidates(candidateIds: readonly string[], branchId?: string): ReturnType<typeof persistence.purgeCandidates>;
      capCandidates(options: CandidateCapOptions): ReturnType<typeof persistence.capCandidates>;
      selectCandidates(options: CandidateSelectionOptions): ReturnType<typeof persistence.selectCandidates>;
      developCandidate(options: CandidateDevelopmentOptions): ReturnType<typeof persistence.developCandidate>;
      runCandidateCycle(options: CandidateCycleOptions): Promise<CandidateCycleResult>;
      runEvolution(options: CandidateEvolutionOptions): Promise<CandidateEvolutionResult>;
    };
    ollama?: {
      getConfig(): OllamaConfig;
      setConfig(config: Partial<OllamaConfig>): OllamaConfig;
      getHealth(): OllamaHealthState;
      checkHealth(): Promise<OllamaHealthState>;
      getLastMelodyCriticTest(): OllamaMelodyCriticTestResult;
      getMelodyCriticPrompt(): string;
      runManualMelodyCriticTest(): Promise<OllamaMelodyCriticTestResult>;
      getLastProposalTextTest(): OllamaProposalTextTestResult;
      runManualProposalTextTest(): Promise<OllamaProposalTextTestResult>;
      getLastThoughtTest(): OllamaThoughtTestResult;
      runManualThoughtTest(playerId?: string): Promise<OllamaThoughtTestResult>;
      getSessionPrimer(): string;
      getInfluenceProbePrompt(playerId?: string): string;
      parseMelodyCriticResponse(rawResponse: string): OllamaMelodyCriticParseResult;
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
  getProfiles: () => getGoalTasteProfiles(),
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
  getSlowLoop: (playerId = "melody") => getSlowThinkingLoopState(playerId),
  getSlowLoops: () => getSlowThinkingLoopStates(),
  getSlowPlayback: (playerId) => playerId
    ? getSlowThoughtPlaybackForPlayer(playerId)
    : getActiveSlowThoughtPlayback(),
  getSlowPlaybacks: () => getActiveSlowThoughtPlaybacks(),
  triggerSlowLoop: (playerId) => {
    if (playerId) {
      slowThinkingControllersByPlayer.get(playerId)?.evaluate();
      return;
    }
    evaluateSlowThinkingControllers();
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
  getProposal: () => getCurrentSongSketchProposal(),
  getSketch: () => getCurrentSongSketch(),
  setId: (nextSongId) => {
    if (isSongId(nextSongId)) {
      return applySongId(nextSongId);
    }
    return songId;
  },
};

window.songGoal = {
  applySetup: () => applySongGoalSetup(),
  getAppliedGoal: () => appliedSongGoal ? cloneSongGoal(appliedSongGoal) : undefined,
  getGoal: () => ({
    ...songGoalInterpretation.goal,
    dispositionBias: { ...songGoalInterpretation.goal.dispositionBias },
    influenceHints: [...songGoalInterpretation.goal.influenceHints],
    sectionEmphasis: { ...songGoalInterpretation.goal.sectionEmphasis },
  }),
  getLastResult: () => ({
    ...songGoalInterpretation,
    matchedKeywords: [...songGoalInterpretation.matchedKeywords],
    validation: {
      ...songGoalInterpretation.validation,
      errors: [...songGoalInterpretation.validation.errors],
      warnings: [...songGoalInterpretation.validation.warnings],
      clamps: [...songGoalInterpretation.validation.clamps],
    },
    goal: {
      ...songGoalInterpretation.goal,
      dispositionBias: { ...songGoalInterpretation.goal.dispositionBias },
      influenceHints: [...songGoalInterpretation.goal.influenceHints],
      sectionEmphasis: { ...songGoalInterpretation.goal.sectionEmphasis },
    },
  }),
  getVocabulary: () => SONG_GOAL_VOCABULARY,
  interpret: (sourceIdea) => applySongGoalIdea(sourceIdea),
  validate: (candidate) => validateSongGoal(candidate),
};

window.prosody = {
  auditionEliteCandidate: (options) => auditionElitePhraseCandidate(options),
  clearCandidateAudition: () => clearCandidateMelodyAudition(),
  getControlDial: () => getWrittenEvolvingControlState(),
  getEvolvingPerformance: () => getEvolvingPerformanceState(),
  getAudition: () => getCandidateMelodyAuditionState(),
  isEnabled: () => prosodyEnabled,
  performEvolvingElite: (options) => startEvolvingElitePerformance(options),
  setControlDial: (value) => applyWrittenEvolvingDialValue(Number(value)),
  setEnabled: (enabled) => setProsodyEnabled(Boolean(enabled)),
  stopEvolvingElite: () => stopEvolvingElitePerformance(),
  getPattern: () => getActiveMelodyPhrasing(),
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

window.melodyRepair = {
  getMode: () => melodyDevelopmentMode,
  setMode: (mode) => {
    if (isMelodyDevelopmentMode(mode)) {
      return applyMelodyDevelopmentMode(mode);
    }
    return melodyDevelopmentMode;
  },
  getTake: () => getCurrentMelodyRepairTake(),
  getCandidate: () => getCurrentMelodyRepairDecision().candidate,
  getConsensus: () => getCurrentMelodyRepairDecision().consensus,
  getCritic: () => ollamaMelodyCriticTest,
  remember: () => rememberCurrentMelodyRepairTake(),
  reject: () => rejectCurrentMelodyRepairTake(),
};

window.formScore = {
  getScore: () => getCurrentFormScore(),
  getVariant: () => getCurrentFormVariant(),
  getVariants: () => getCurrentFormVariantScores(),
  setVariant: (variantId) => {
    if (isFormVariantId(variantId)) {
      return applyFormVariant(variantId);
    }
    return formVariantId;
  },
};

window.anchorPhrase = {
  fromProsody: (options) => createCurrentProsodyAnchorPhrase(options),
  getDemoPhrase: () => structuredClone(DEMO_ANCHOR_PHRASE),
  renderDemo: (options) => renderDemoAnchorPhrase(options),
};

window.phraseEditor = {
  addAnchor: (segmentIndex, atBeat, options) => addAnchorPhraseAnchor(segmentIndex, atBeat, options),
  editAnchor: (segmentIndex, anchorIndex, patch) => editAnchorPhraseAnchor(segmentIndex, anchorIndex, patch),
  editConnector: (segmentIndex, connectorIndex, patch) =>
    editAnchorPhraseConnector(segmentIndex, connectorIndex, patch),
  editSelectedIdea: () => editSelectedAnchorPhraseCatalogEntry(),
  enterEditMode: () => enterAnchorPhraseEditMode(),
  exitEditMode: () => exitAnchorPhraseEditMode("Edit mode exited; generated phrase restored."),
  getCatalog: () => getAnchorPhraseCatalogState(),
  getOverridePattern: () => getAnchorPhraseEditorOverridePattern(),
  getState: () => getAnchorPhraseEditorState(),
  getWorkingPhrase: () => workingAnchorPhrase ? cloneAnchorPhrase(workingAnchorPhrase) : undefined,
  joinSegments: (segmentIndex) => joinAnchorPhraseSegments(segmentIndex),
  newIdea: () => startNewAnchorPhraseIdea(),
  nextIdea: () => stepAnchorPhraseCatalog(1),
  previewSelectedIdea: () => previewSelectedAnchorPhraseCatalogEntry(),
  previousIdea: () => stepAnchorPhraseCatalog(-1),
  refreshCatalog: () => refreshAnchorPhraseCatalog({ render: true }),
  removeAnchor: (segmentIndex, anchorIndex) => removeAnchorPhraseAnchor(segmentIndex, anchorIndex),
  revert: () => exitAnchorPhraseEditMode("Reverted to generated prosody phrase."),
  save: () => saveAnchorPhraseEditorCandidate(),
  selectIdea: (index) => selectAnchorPhraseCatalogIndex(index),
  splitSegment: (segmentIndex, anchorIndex) => splitAnchorPhraseSegment(segmentIndex, anchorIndex),
};

window.persistence = {
  getState: () => persistence.getState(),
  getMusicalEventBufferState: () => musicalEventRecordBuffer.getState(),
  aggregateCandidateFitness: (scores, options) => aggregateCandidateFitness(scores, options),
  previewCandidateFitness: (candidate, options) => previewCandidateFitness(candidate, options),
  flush: () => persistence.flush(),
  flushMusicalEvents: () => flushMusicalEventBufferToPersistence("manual", MUSICAL_EVENT_DRAIN_ALL),
  flushOnPageHide: () => handlePageHide(),
  dump: (limit) => persistence.dump(limit),
  writeCandidate: (candidate, branchId) => persistence.writeCandidate(candidate, branchId),
  listCandidates: (options) => persistence.listCandidates(options),
  scoreCandidate: (candidateId, scores, fitness, branchId) =>
    persistence.scoreCandidate(candidateId, scores, fitness, branchId),
  retainCandidates: (candidateIds, branchId) => persistence.retainCandidates(candidateIds, branchId),
  reserveCandidates: (candidateIds, branchId) => persistence.reserveCandidates(candidateIds, branchId),
  purgeCandidates: (candidateIds, branchId) => persistence.purgeCandidates(candidateIds, branchId),
  capCandidates: (options) => persistence.capCandidates(options),
  selectCandidates: (options) => persistence.selectCandidates(options),
  developCandidate: (options) => persistence.developCandidate(options),
  runCandidateCycle: (options) => runCandidateCycle(options, persistence),
  runEvolution: (options) => runEvolution(options, persistence),
};

window.ollama = {
  getConfig: () => ({ ...ollamaConfig }),
  setConfig: (config) => setOllamaConfig(config),
  getHealth: () => ({
    ...ollamaHealth,
    availableModels: [...ollamaHealth.availableModels],
  }),
  checkHealth: () => runOllamaHealthCheck(),
  getLastMelodyCriticTest: () => ollamaMelodyCriticTest,
  getMelodyCriticPrompt: () => createOllamaMelodyCriticPrompt(getCurrentMelodyRepairTake()),
  runManualMelodyCriticTest: () => runManualOllamaMelodyCriticTest(),
  getLastProposalTextTest: () => ollamaProposalTextTest,
  runManualProposalTextTest: () => runManualOllamaProposalTextTest(),
  getLastThoughtTest: () => ollamaThoughtTest,
  runManualThoughtTest: (playerId) => runManualOllamaThoughtTest(playerId),
  getSessionPrimer: () => createOllamaSessionPrimer(),
  getInfluenceProbePrompt: (playerId) => getInfluenceProbePrompt(playerId),
  parseMelodyCriticResponse: (rawResponse) => parseManualOllamaMelodyCriticResponse(rawResponse),
  parseThoughtResponse: (rawResponse, playerId) => parseManualOllamaThoughtResponse(rawResponse, playerId),
};

window.terrarium = {
  getVisualState: () => terrarium?.getVisualState(),
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    isTearingDown = true;
    evolvingPerformanceRunSerial += 1;
    clearEvolvingPerformanceTimer();
    cancelSlowThinkingControllers("hot module replacement");
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
    }
    if (musicalEventFlushTimerId !== 0) {
      window.clearInterval(musicalEventFlushTimerId);
      musicalEventFlushTimerId = 0;
    }
    flushMusicalEventBufferToPersistence("hmr", MUSICAL_EVENT_DRAIN_ALL);
    terrarium?.destroy();
    terrarium = null;
    window.listening = undefined;
    window.taste = undefined;
    window.thinking = undefined;
    window.session = undefined;
    window.song = undefined;
    window.songGoal = undefined;
    window.prosody = undefined;
    window.timing = undefined;
    window.melodyRepair = undefined;
    window.formScore = undefined;
    window.anchorPhrase = undefined;
    window.phraseEditor = undefined;
    window.persistence = undefined;
    window.ollama = undefined;
    window.terrarium = undefined;
    persistence.flushOnPageHide();
    window.removeEventListener("resize", handleWindowResize);
    window.removeEventListener("keydown", handleGlobalKeydown);
    window.removeEventListener("pagehide", handlePageHide);
  });
}
