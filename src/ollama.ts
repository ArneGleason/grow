import {
  createMockThoughtIntent,
  validatePlayerThoughtIntent,
  type MusicalExcerpt,
  type MusicalExcerptOrigin,
  type MusicalExcerptStep,
  type MusicalExcerptStepKind,
  type PlayerThoughtIntent,
  type PlayerThoughtRequest,
  type ThoughtAction,
  type ThoughtResponseLevel,
  type ValidationResult,
} from "./thought-protocol";
import { noteFromScaleDegree } from "./tonal-context";
import {
  DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID,
  REGISTER_DELTA_PROMPT_RULE,
  getThoughtPromptProtocol,
  isThoughtPromptProtocolId,
  type ThoughtPromptProtocolId,
} from "./thought-prompt-protocols";
import {
  SONG_SKETCH_PROPOSAL_TEXT_LIMITS,
  createMockSongSketchProposalText,
  validateSongSketchProposalText,
  type SongSketchProposal,
  type SongSketchProposalText,
  type SongSketchProposalTextResponse,
  type SongSketchProposalTextValidation,
} from "./song-sketch";
import {
  MELODY_CRITIC_TEXT_LIMITS,
  createMockMelodyCriticSelection,
  getMelodyRepairCandidate,
  validateMelodyCriticSelection,
  type MelodyCriticSelection,
  type MelodyCriticValidation,
  type MelodyRepairCandidate,
  type MelodyRepairTake,
} from "./melody-scoring";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  promptProtocol: ThoughtPromptProtocolId;
  timeoutMs: number;
}

export type OllamaHealthStatus =
  | "unknown"
  | "checking"
  | "ready"
  | "model-missing"
  | "unavailable";

export interface OllamaHealthState {
  status: OllamaHealthStatus;
  baseUrl: string;
  model: string;
  latencyMs?: number;
  checkedAt?: string;
  availableModels: string[];
  message: string;
}

export interface OllamaThoughtParseResult {
  status: "idle" | "ok" | "error";
  errors: string[];
  intent?: PlayerThoughtIntent;
}

export interface OllamaThoughtTestResult {
  status: "idle" | "running" | "valid" | "invalid" | "failed";
  provider: "none" | "ollama" | "mock-fallback";
  model: string;
  baseUrl: string;
  promptProtocol: ThoughtPromptProtocolId;
  requestId?: string;
  playerId?: string;
  latencyMs?: number;
  rawResponse: string;
  parse: OllamaThoughtParseResult;
  validation: ValidationResult;
  intent?: PlayerThoughtIntent;
  fallbackIntent?: PlayerThoughtIntent;
  fallbackValidation?: ValidationResult;
  message: string;
}

export interface OllamaProposalTextParseResult {
  status: "idle" | "ok" | "error";
  errors: string[];
  text?: SongSketchProposalText;
}

export interface OllamaProposalTextTestResult {
  status: "idle" | "running" | "valid" | "invalid" | "failed";
  provider: "none" | "ollama" | "mock-fallback";
  model: string;
  baseUrl: string;
  promptProtocol: "song-proposal-text";
  proposalId?: string;
  sourceSongId?: SongSketchProposal["sourceSongId"];
  latencyMs?: number;
  rawResponse: string;
  parse: OllamaProposalTextParseResult;
  validation: SongSketchProposalTextValidation;
  text?: SongSketchProposalText;
  fallbackText?: SongSketchProposalText;
  fallbackValidation?: SongSketchProposalTextValidation;
  message: string;
}

export interface OllamaMelodyCriticParseResult {
  status: "idle" | "ok" | "error";
  errors: string[];
  selection?: MelodyCriticSelection;
}

export interface OllamaMelodyCriticTestResult {
  status: "idle" | "running" | "valid" | "invalid" | "failed";
  provider: "none" | "ollama" | "mock-fallback";
  model: string;
  baseUrl: string;
  promptProtocol: "melody-critic";
  takeId?: string;
  songId?: string;
  deterministicCandidateId?: string;
  bestCandidateId?: string;
  selectedCandidateId?: string;
  selectedScoreDeltaFromBest?: number;
  selectedScoreDeltaFromDeterministic?: number;
  latencyMs?: number;
  rawResponse: string;
  parse: OllamaMelodyCriticParseResult;
  validation: MelodyCriticValidation;
  selection?: MelodyCriticSelection;
  fallbackSelection?: MelodyCriticSelection;
  fallbackValidation?: MelodyCriticValidation;
  message: string;
}

export interface OllamaThoughtRunOptions {
  signal?: AbortSignal;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    thinking?: string;
  };
  response?: string;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  stream: false;
  format: unknown;
  think: false;
  options: {
    temperature: number;
    num_predict: number;
  };
}

interface OllamaProxyChatRequest {
  baseUrl: string;
  request: OllamaChatRequest;
}

const DEFAULT_OLLAMA_BASE_URL = import.meta.env?.VITE_GROW_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = import.meta.env?.VITE_GROW_OLLAMA_MODEL ?? "qwen3:4b-instruct-2507-q4_K_M";
const DEFAULT_PROMPT_PROTOCOL = import.meta.env?.VITE_GROW_THOUGHT_PROMPT_PROTOCOL ?? DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID;
const DEFAULT_OLLAMA_TIMEOUT_MS = 15_000;
const COMPACT_JSON_RULE = "Return only one compact JSON object. No markdown. No prose outside JSON.";
const SHORT_RESPONSE_RULE =
  `${COMPACT_JSON_RULE} Keep rationale under 160 characters.`;
const PROPOSAL_TEXT_RULE =
  `${COMPACT_JSON_RULE} Keep every text field short enough for an inspector row.`;
const MELODY_CRITIC_RULE =
  `${COMPACT_JSON_RULE} Choose one listed candidateId only. Keep critique fields short.`;

export function createDefaultOllamaConfig(): OllamaConfig {
  return {
    baseUrl: sanitizeBaseUrl(DEFAULT_OLLAMA_BASE_URL),
    model: DEFAULT_OLLAMA_MODEL.trim() || "qwen3:4b-instruct-2507-q4_K_M",
    promptProtocol: isThoughtPromptProtocolId(DEFAULT_PROMPT_PROTOCOL)
      ? DEFAULT_PROMPT_PROTOCOL
      : DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID,
    timeoutMs: DEFAULT_OLLAMA_TIMEOUT_MS,
  };
}

export function createInitialOllamaHealth(config: OllamaConfig): OllamaHealthState {
  return {
    status: "unknown",
    baseUrl: config.baseUrl,
    model: config.model,
    availableModels: [],
    message: "Not checked",
  };
}

export function createInitialOllamaThoughtTest(config: OllamaConfig): OllamaThoughtTestResult {
  return {
    status: "idle",
    provider: "none",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: config.promptProtocol,
    rawResponse: "",
    parse: { status: "idle", errors: [] },
    validation: { valid: false, errors: [] },
    message: "No Ollama thought sent",
  };
}

export function createInitialOllamaProposalTextTest(
  config: OllamaConfig,
): OllamaProposalTextTestResult {
  return {
    status: "idle",
    provider: "none",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: "song-proposal-text",
    rawResponse: "",
    parse: { status: "idle", errors: [] },
    validation: { valid: false, errors: [] },
    message: "No Ollama proposal text sent",
  };
}

export function createInitialOllamaMelodyCriticTest(
  config: OllamaConfig,
): OllamaMelodyCriticTestResult {
  return {
    status: "idle",
    provider: "none",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: "melody-critic",
    rawResponse: "",
    parse: { status: "idle", errors: [] },
    validation: { valid: false, errors: [] },
    message: "No melody critic sent",
  };
}

export function createOllamaSessionPrimer(options: {
  allowsRegisterShift?: boolean;
} = {}): string {
  const allowsRegisterShift = options.allowsRegisterShift ?? true;
  return [
    "You are Grow's local slow-thinking musical planner.",
    "You receive one projected player thought request and return one bounded PlayerThoughtIntent.",
    "The app validates your JSON. Invalid output is ignored and the deterministic mock fallback stays active.",
    SHORT_RESPONSE_RULE,
    "Do not schedule sound. Do not describe audio playback. Only propose a future intent.",
    "Allowed actions are provided in the request. Choose exactly one allowed action.",
    ...(allowsRegisterShift ? [REGISTER_DELTA_PROMPT_RULE] : []),
    "MusicalExcerpt convention: steps[].positionBeats is phrase-relative and monotonic from 0.",
    "MusicalExcerpt convention: steps[].scaleDegree is a pitch-class index from 0 to scale.length - 1.",
    "MusicalExcerpt convention: note steps include separate steps[].octave. Do not use wrapping scale degrees.",
    "Do not include pitch in model output. The system derives pitch from scaleDegree plus octave before validation.",
    "The system owns sourceStartBeat and placement. Copy requestId/playerId, but target.startAfterBeats and target.durationBeats own future placement.",
    "For influence probes, return an abstract transferable technique. Do not copy or imitate a named artist's melody, lyric, or signature passage.",
  ].join("\n");
}

export function createOllamaSongSketchProposalPrimer(): string {
  return [
    "You are Grow's local band-proposal copy editor.",
    "You receive one deterministic SongSketchProposal projection and rewrite reader-facing text only.",
    "The app validates your JSON. Invalid output is ignored and deterministic mock text stays active.",
    PROPOSAL_TEXT_RULE,
    "Do not add, remove, or change proposal kind, status, target section, proposer, chord plan, root degrees, response stances, player ids, timing, or scheduling.",
    "Do not invent a key change, mode change, new section, new chord, or playback instruction.",
    "Keep the wording grounded in the fixed chord/root plan and each player's existing stance.",
  ].join("\n");
}

export function createOllamaMelodyCriticPrimer(): string {
  return [
    "You are Grow's local melody critic.",
    "You receive a deterministic chorus repair take with already-scored candidate phrases.",
    "Choose exactly one candidate by selectedCandidateId and write short critique prose.",
    "The app owns all notes, pitches, timing, scores, and playback. You must not emit, rewrite, or invent notes.",
    "The app validates your JSON. Invalid output is ignored and the deterministic scorer fallback stays active.",
    MELODY_CRITIC_RULE,
  ].join("\n");
}

export function createOllamaThoughtPrompt(
  request: PlayerThoughtRequest,
  options: {
    influenceReference?: string;
  } = {},
  promptProtocol: ThoughtPromptProtocolId = DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID,
): string {
  return getThoughtPromptProtocol(promptProtocol).createUserPrompt(request, options);
}

export function createOllamaInfluenceProbePrompt(
  request: PlayerThoughtRequest,
  influenceReference = "one remembered playing technique, not a copied song",
): string {
  return createOllamaThoughtPrompt(request, { influenceReference });
}

export function createOllamaSongSketchProposalPrompt(
  proposal: SongSketchProposal,
): string {
  const projection = {
    v: "grow.songProposalText/1",
    proposalId: proposal.id,
    sourceSongId: proposal.sourceSongId,
    fixed: {
      kind: proposal.kind,
      targetSectionId: proposal.targetSectionId,
      proposedByPlayerId: proposal.proposedByPlayerId,
      chordPlan: proposal.chordPlan,
      rootDegrees: proposal.rootDegrees,
    },
    textSlots: {
      summary: proposal.summary,
      requestedAction: proposal.requestedAction,
      responses: proposal.responses.map((response) => ({
        playerId: response.playerId,
        role: response.role,
        stance: response.stance,
        reason: response.reason,
        requestedChange: response.requestedChange,
      })),
    },
  };

  return [
    "Rewrite only the text slots in this proposal.",
    "Return this JSON shape exactly: {\"summary\":\"...\",\"requestedAction\":\"...\",\"responses\":[{\"playerId\":\"...\",\"reason\":\"...\",\"requestedChange\":\"...\"}]}",
    "Each response must include exactly one entry for each listed playerId. Keep playerId unchanged.",
    "requestedChange is optional; omit it when the stance does not need a concrete change.",
    "Do not return kind, status, role, stance, chordPlan, rootDegrees, targetSectionId, or proposedByPlayerId.",
    "Proposal projection:",
    JSON.stringify(projection),
  ].join("\n");
}

export function createOllamaMelodyCriticPrompt(
  take: MelodyRepairTake,
): string {
  const projection = {
    v: "grow.melodyCritic/1",
    takeId: take.id,
    songId: take.songId,
    perspectiveId: take.perspectiveId,
    deterministicCandidateId: take.deterministicCandidateId,
    candidates: take.candidates.map(projectMelodyRepairCandidate),
  };

  return [
    "Select one candidate from this deterministic chorus repair menu.",
    "Return this JSON shape exactly: {\"selectedCandidateId\":\"...\",\"rationale\":\"...\",\"strengths\":\"...\",\"concerns\":\"...\"}",
    "selectedCandidateId must equal one listed candidateId. Do not return phrase, notes, scaleDegree, octave, events, scores, or instructions.",
    "Prefer a candidate whose strategy gives a meaningfully different musical take, not just the highest score.",
    "Ground your critique in strategy, score deltas, changed note count, top critique, and contour summary.",
    "Candidate projection:",
    JSON.stringify(projection),
  ].join("\n");
}

export async function checkOllamaHealth(config: OllamaConfig): Promise<OllamaHealthState> {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(createOllamaProxyUrl("tags", config), {
      method: "GET",
    }, config.timeoutMs);
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return createUnavailableHealth(config, latencyMs, `HTTP ${response.status}`);
    }

    const payload = await response.json() as OllamaTagsResponse;
    const availableModels = (payload.models ?? [])
      .map((model) => model.name ?? model.model ?? "")
      .filter((name) => name.length > 0)
      .sort();
    const hasModel = availableModels.includes(config.model);

    return {
      status: hasModel ? "ready" : "model-missing",
      baseUrl: config.baseUrl,
      model: config.model,
      latencyMs,
      checkedAt: new Date().toISOString(),
      availableModels,
      message: hasModel
        ? `Ollama is reachable and ${config.model} is available`
        : `Ollama is reachable, but ${config.model} was not listed`,
    };
  } catch (error) {
    return createUnavailableHealth(config, Date.now() - startedAt, getErrorMessage(error));
  }
}

export async function runOllamaThoughtTest(
  request: PlayerThoughtRequest,
  config: OllamaConfig,
  options: OllamaThoughtRunOptions = {},
): Promise<OllamaThoughtTestResult> {
  const startedAt = Date.now();
  const fallbackIntent = createMockThoughtIntent(request);
  const fallbackValidation = validatePlayerThoughtIntent(fallbackIntent, request);
  const protocol = getThoughtPromptProtocol(config.promptProtocol);
  const ollamaRequest: OllamaChatRequest = {
    model: config.model,
    messages: [
      {
        role: "system",
        content: createOllamaSessionPrimer({
          allowsRegisterShift: request.allowedActions.includes("shift_register"),
        }),
      },
      { role: "user", content: createOllamaThoughtPrompt(request, {}, protocol.id) },
    ],
    stream: false,
    format: protocol.createResponseFormat(request),
    think: false,
    options: {
      temperature: 0.35,
      num_predict: 512,
    },
  };

  try {
    const response = await fetchWithTimeout(
      createOllamaProxyUrl("chat", config),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: sanitizeBaseUrl(config.baseUrl),
          request: ollamaRequest,
        } satisfies OllamaProxyChatRequest),
      },
      config.timeoutMs,
      options.signal,
    );
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return createFailedThoughtTest(
        request,
        config,
        fallbackIntent,
        fallbackValidation,
        latencyMs,
        `HTTP ${response.status}`,
      );
    }

    const payload = await response.json() as OllamaChatResponse;
    const rawResponse = getOllamaResponseText(payload);
    const parse = parseOllamaThoughtResponse(rawResponse, request);
    const validation = parse.intent
      ? validatePlayerThoughtIntent(parse.intent, request)
      : { valid: false, errors: parse.errors };

    return {
      status: parse.intent && validation.valid ? "valid" : "invalid",
      provider: "ollama",
      model: config.model,
      baseUrl: config.baseUrl,
      promptProtocol: protocol.id,
      requestId: request.id,
      playerId: request.playerId,
      latencyMs,
      rawResponse,
      parse,
      validation,
      intent: parse.intent,
      fallbackIntent,
      fallbackValidation,
      message: parse.intent && validation.valid
        ? "Ollama returned a valid thought intent"
        : "Ollama responded, but the intent did not validate",
    };
  } catch (error) {
    return createFailedThoughtTest(
      request,
      config,
      fallbackIntent,
      fallbackValidation,
      Date.now() - startedAt,
      getErrorMessage(error),
    );
  }
}

export async function runOllamaProposalTextTest(
  proposal: SongSketchProposal,
  config: OllamaConfig,
  options: OllamaThoughtRunOptions = {},
): Promise<OllamaProposalTextTestResult> {
  const startedAt = Date.now();
  const fallbackText = createMockSongSketchProposalText(proposal);
  const fallbackValidation = validateSongSketchProposalText(fallbackText, proposal);
  const ollamaRequest: OllamaChatRequest = {
    model: config.model,
    messages: [
      { role: "system", content: createOllamaSongSketchProposalPrimer() },
      { role: "user", content: createOllamaSongSketchProposalPrompt(proposal) },
    ],
    stream: false,
    format: createSongSketchProposalTextResponseFormat(proposal),
    think: false,
    options: {
      temperature: 0.45,
      num_predict: 384,
    },
  };

  try {
    const response = await fetchWithTimeout(
      createOllamaProxyUrl("chat", config),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: sanitizeBaseUrl(config.baseUrl),
          request: ollamaRequest,
        } satisfies OllamaProxyChatRequest),
      },
      config.timeoutMs,
      options.signal,
    );
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return createFailedProposalTextTest(
        proposal,
        config,
        fallbackText,
        fallbackValidation,
        latencyMs,
        `HTTP ${response.status}`,
      );
    }

    const payload = await response.json() as OllamaChatResponse;
    const rawResponse = getOllamaResponseText(payload);
    const parse = parseOllamaProposalTextResponse(rawResponse);
    const validation = parse.text
      ? validateSongSketchProposalText(parse.text, proposal)
      : { valid: false, errors: parse.errors };

    return {
      status: parse.text && validation.valid ? "valid" : "invalid",
      provider: "ollama",
      model: config.model,
      baseUrl: config.baseUrl,
      promptProtocol: "song-proposal-text",
      proposalId: proposal.id,
      sourceSongId: proposal.sourceSongId,
      latencyMs,
      rawResponse,
      parse,
      validation,
      text: parse.text,
      fallbackText,
      fallbackValidation,
      message: parse.text && validation.valid
        ? "Ollama returned valid proposal text"
        : "Ollama responded, but proposal text did not validate",
    };
  } catch (error) {
    return createFailedProposalTextTest(
      proposal,
      config,
      fallbackText,
      fallbackValidation,
      Date.now() - startedAt,
      getErrorMessage(error),
    );
  }
}

export async function runOllamaMelodyCriticTest(
  take: MelodyRepairTake,
  config: OllamaConfig,
  options: OllamaThoughtRunOptions = {},
): Promise<OllamaMelodyCriticTestResult> {
  const startedAt = Date.now();
  const fallbackSelection = createMockMelodyCriticSelection(take);
  const fallbackValidation = validateMelodyCriticSelection(fallbackSelection, take);
  const ollamaRequest: OllamaChatRequest = {
    model: config.model,
    messages: [
      { role: "system", content: createOllamaMelodyCriticPrimer() },
      { role: "user", content: createOllamaMelodyCriticPrompt(take) },
    ],
    stream: false,
    format: createMelodyCriticResponseFormat(take),
    think: false,
    options: {
      temperature: 0.5,
      num_predict: 256,
    },
  };

  try {
    const response = await fetchWithTimeout(
      createOllamaProxyUrl("chat", config),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: sanitizeBaseUrl(config.baseUrl),
          request: ollamaRequest,
        } satisfies OllamaProxyChatRequest),
      },
      config.timeoutMs,
      options.signal,
    );
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return createFailedMelodyCriticTest(
        take,
        config,
        fallbackSelection,
        fallbackValidation,
        latencyMs,
        `HTTP ${response.status}`,
      );
    }

    const payload = await response.json() as OllamaChatResponse;
    const rawResponse = getOllamaResponseText(payload);
    const parse = parseOllamaMelodyCriticResponse(rawResponse);
    const validation = parse.selection
      ? validateMelodyCriticSelection(parse.selection, take)
      : { valid: false, errors: parse.errors };
    const selectedCandidate = validation.valid && parse.selection
      ? getMelodyRepairCandidate(take, parse.selection.selectedCandidateId)
      : undefined;

    return {
      status: parse.selection && validation.valid ? "valid" : "invalid",
      provider: "ollama",
      model: config.model,
      baseUrl: config.baseUrl,
      promptProtocol: "melody-critic",
      takeId: take.id,
      songId: take.songId,
      deterministicCandidateId: take.deterministicCandidateId,
      bestCandidateId: take.bestCandidateId,
      selectedCandidateId: parse.selection?.selectedCandidateId,
      selectedScoreDeltaFromBest: selectedCandidate?.scoreDeltaFromBest,
      selectedScoreDeltaFromDeterministic: selectedCandidate?.scoreDeltaFromDeterministic,
      latencyMs,
      rawResponse,
      parse,
      validation,
      selection: parse.selection,
      fallbackSelection,
      fallbackValidation,
      message: parse.selection && validation.valid
        ? "Ollama selected a valid melody candidate"
        : "Ollama responded, but the melody selection did not validate",
    };
  } catch (error) {
    return createFailedMelodyCriticTest(
      take,
      config,
      fallbackSelection,
      fallbackValidation,
      Date.now() - startedAt,
      getErrorMessage(error),
    );
  }
}

function getOllamaResponseText(payload: OllamaChatResponse): string {
  const candidates = [
    payload.message?.content,
    payload.response,
    payload.message?.thinking,
  ];
  return candidates.find((candidate) => (candidate?.trim().length ?? 0) > 0) ?? "";
}

export function parseOllamaMelodyCriticResponse(
  rawResponse: string,
): OllamaMelodyCriticParseResult {
  const jsonText = extractJsonObject(rawResponse);
  if (!jsonText) {
    return {
      status: "error",
      errors: ["response did not contain a JSON object"],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const object = unwrapMelodyCriticObject(parsed);
    if (!object) {
      return {
        status: "error",
        errors: ["response JSON was not an object"],
      };
    }

    return {
      status: "ok",
      errors: [],
      selection: coerceMelodyCriticSelection(object),
    };
  } catch (error) {
    return {
      status: "error",
      errors: [`response JSON parse failed: ${getErrorMessage(error)}`],
    };
  }
}

export function parseOllamaProposalTextResponse(
  rawResponse: string,
): OllamaProposalTextParseResult {
  const jsonText = extractJsonObject(rawResponse);
  if (!jsonText) {
    return {
      status: "error",
      errors: ["response did not contain a JSON object"],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const object = unwrapProposalTextObject(parsed);
    if (!object) {
      return {
        status: "error",
        errors: ["response JSON was not an object"],
      };
    }

    return {
      status: "ok",
      errors: [],
      text: coerceSongSketchProposalText(object),
    };
  } catch (error) {
    return {
      status: "error",
      errors: [`response JSON parse failed: ${getErrorMessage(error)}`],
    };
  }
}

export function parseOllamaThoughtResponse(
  rawResponse: string,
  request: PlayerThoughtRequest,
): OllamaThoughtParseResult {
  const jsonText = extractJsonObject(rawResponse);
  if (!jsonText) {
    return {
      status: "error",
      errors: ["response did not contain a JSON object"],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const object = unwrapIntentObject(parsed);
    if (!object) {
      return {
        status: "error",
        errors: ["response JSON was not an object"],
      };
    }

    return {
      status: "ok",
      errors: [],
      intent: coercePlayerThoughtIntent(object, request, rawResponse),
    };
  } catch (error) {
    return {
      status: "error",
      errors: [`response JSON parse failed: ${getErrorMessage(error)}`],
    };
  }
}

function createUnavailableHealth(
  config: OllamaConfig,
  latencyMs: number,
  message: string,
): OllamaHealthState {
  return {
    status: "unavailable",
    baseUrl: config.baseUrl,
    model: config.model,
    latencyMs,
    checkedAt: new Date().toISOString(),
    availableModels: [],
    message,
  };
}

function createFailedThoughtTest(
  request: PlayerThoughtRequest,
  config: OllamaConfig,
  fallbackIntent: PlayerThoughtIntent,
  fallbackValidation: ValidationResult,
  latencyMs: number,
  message: string,
): OllamaThoughtTestResult {
  return {
    status: "failed",
    provider: "mock-fallback",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: config.promptProtocol,
    requestId: request.id,
    playerId: request.playerId,
    latencyMs,
    rawResponse: "",
    parse: { status: "error", errors: [message] },
    validation: { valid: false, errors: [message] },
    fallbackIntent,
    fallbackValidation,
    message: `Ollama unavailable; deterministic mock fallback is ${fallbackValidation.valid ? "valid" : "invalid"}`,
  };
}

function createFailedProposalTextTest(
  proposal: SongSketchProposal,
  config: OllamaConfig,
  fallbackText: SongSketchProposalText,
  fallbackValidation: SongSketchProposalTextValidation,
  latencyMs: number,
  message: string,
): OllamaProposalTextTestResult {
  return {
    status: "failed",
    provider: "mock-fallback",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: "song-proposal-text",
    proposalId: proposal.id,
    sourceSongId: proposal.sourceSongId,
    latencyMs,
    rawResponse: "",
    parse: { status: "error", errors: [message] },
    validation: { valid: false, errors: [message] },
    fallbackText,
    fallbackValidation,
    message: `Ollama unavailable; deterministic proposal text fallback is ${fallbackValidation.valid ? "valid" : "invalid"}`,
  };
}

function createFailedMelodyCriticTest(
  take: MelodyRepairTake,
  config: OllamaConfig,
  fallbackSelection: MelodyCriticSelection,
  fallbackValidation: MelodyCriticValidation,
  latencyMs: number,
  message: string,
): OllamaMelodyCriticTestResult {
  return {
    status: "failed",
    provider: "mock-fallback",
    model: config.model,
    baseUrl: config.baseUrl,
    promptProtocol: "melody-critic",
    takeId: take.id,
    songId: take.songId,
    deterministicCandidateId: take.deterministicCandidateId,
    bestCandidateId: take.bestCandidateId,
    selectedCandidateId: fallbackSelection.selectedCandidateId,
    selectedScoreDeltaFromBest: getMelodyRepairCandidate(take, fallbackSelection.selectedCandidateId)
      ?.scoreDeltaFromBest,
    selectedScoreDeltaFromDeterministic: getMelodyRepairCandidate(take, fallbackSelection.selectedCandidateId)
      ?.scoreDeltaFromDeterministic,
    latencyMs,
    rawResponse: "",
    parse: { status: "error", errors: [message] },
    validation: { valid: false, errors: [message] },
    fallbackSelection,
    fallbackValidation,
    message: `Ollama unavailable; deterministic melody critic fallback is ${
      fallbackValidation.valid ? "valid" : "invalid"
    }`,
  };
}

function createSongSketchProposalTextResponseFormat(proposal: SongSketchProposal): unknown {
  const playerIds = proposal.responses.map((response) => response.playerId);
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "requestedAction", "responses"],
    properties: {
      summary: {
        type: "string",
        minLength: 1,
        maxLength: SONG_SKETCH_PROPOSAL_TEXT_LIMITS.summary,
      },
      requestedAction: {
        type: "string",
        minLength: 1,
        maxLength: SONG_SKETCH_PROPOSAL_TEXT_LIMITS.requestedAction,
      },
      responses: {
        type: "array",
        minItems: playerIds.length,
        maxItems: playerIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["playerId", "reason"],
          properties: {
            playerId: { type: "string", enum: playerIds },
            reason: {
              type: "string",
              minLength: 1,
              maxLength: SONG_SKETCH_PROPOSAL_TEXT_LIMITS.reason,
            },
            requestedChange: {
              type: "string",
              maxLength: SONG_SKETCH_PROPOSAL_TEXT_LIMITS.requestedChange,
            },
          },
        },
      },
    },
  };
}

function createMelodyCriticResponseFormat(take: MelodyRepairTake): unknown {
  return {
    type: "object",
    additionalProperties: false,
    required: ["selectedCandidateId", "rationale", "strengths", "concerns"],
    properties: {
      selectedCandidateId: {
        type: "string",
        enum: take.candidates.map((candidate) => candidate.id),
      },
      rationale: {
        type: "string",
        minLength: 1,
        maxLength: MELODY_CRITIC_TEXT_LIMITS.rationale,
      },
      strengths: {
        type: "string",
        minLength: 1,
        maxLength: MELODY_CRITIC_TEXT_LIMITS.strengths,
      },
      concerns: {
        type: "string",
        minLength: 1,
        maxLength: MELODY_CRITIC_TEXT_LIMITS.concerns,
      },
    },
  };
}

function projectMelodyRepairCandidate(candidate: MelodyRepairCandidate): Record<string, unknown> {
  return {
    candidateId: candidate.id,
    label: candidate.label,
    source: candidate.source,
    strategy: candidate.strategy,
    strategySummary: candidate.strategySummary,
    rank: candidate.rank,
    total: candidate.primaryScore.total,
    scoreDeltaFromBest: candidate.scoreDeltaFromBest,
    scoreDeltaFromDeterministic: candidate.scoreDeltaFromDeterministic,
    subscores: {
      landing: candidate.primaryScore.landing,
      monotony: candidate.primaryScore.monotony,
      surprise: candidate.primaryScore.surprise,
      averageSurprise: candidate.primaryScore.averageSurprise,
    },
    playerScores: candidate.scores.map((score) => ({
      playerId: score.perspectiveId,
      total: score.total,
    })),
    changedNotes: candidate.changedNotes,
    noteCount: candidate.noteCount,
    critiqueCount: candidate.critiqueCount,
    topCritique: candidate.primaryScore.critiques[0]?.message ?? "none",
    contour: candidate.phrase.map((note) => ({
      step: note.stepIndex,
      degree: note.scaleDegree,
      octave: note.octave,
      duration: note.durationBeats,
    })),
  };
}

function coercePlayerThoughtIntent(
  value: Record<string, unknown>,
  request: PlayerThoughtRequest,
  rawResponse: string,
): PlayerThoughtIntent {
  const target = isRecord(value.target) ? value.target : {};
  return {
    id: getString(value.id) || `ollama-${stableHash(`${request.id}:${rawResponse}`).toString(16)}`,
    requestId: request.id,
    playerId: request.playerId,
    responseLevel: getString(value.responseLevel) as ThoughtResponseLevel,
    action: getString(value.action) as ThoughtAction,
    registerDelta: getOptionalNumber(value.registerDelta),
    confidence: getNumber(value.confidence),
    target: {
      startAfterBeats: getNumber(target.startAfterBeats),
      durationBeats: getNumber(target.durationBeats),
    },
    musicalIdea: coerceMusicalExcerpt(value.musicalIdea, request),
    rationale: getString(value.rationale),
  };
}

function coerceSongSketchProposalText(value: Record<string, unknown>): SongSketchProposalText {
  return {
    summary: getString(value.summary),
    requestedAction: getString(value.requestedAction),
    responses: Array.isArray(value.responses)
      ? value.responses.map(coerceSongSketchProposalTextResponse)
      : [],
  };
}

function coerceSongSketchProposalTextResponse(
  value: unknown,
): SongSketchProposalTextResponse {
  const object = isRecord(value) ? value : {};
  const playerId = getString(object.playerId);
  const requestedChange = getString(object.requestedChange).trim();
  return {
    playerId,
    reason: getString(object.reason),
    requestedChange: requestedChange.length > 0 ? requestedChange : undefined,
  };
}

function coerceMelodyCriticSelection(value: Record<string, unknown>): MelodyCriticSelection {
  return {
    selectedCandidateId: getString(value.selectedCandidateId),
    rationale: getString(value.rationale),
    strengths: getString(value.strengths),
    concerns: getString(value.concerns),
  };
}

function coerceMusicalExcerpt(value: unknown, request: PlayerThoughtRequest): MusicalExcerpt {
  const object = isRecord(value) ? value : {};
  const tonalContext = isTonalContext(object.tonalContext)
    ? object.tonalContext
    : request.constraints.tonalContext;
  return {
    label: getString(object.label),
    origin: (getString(object.origin) || "imagined") as MusicalExcerptOrigin,
    meter: isMeter(object.meter) ? object.meter : request.constraints.meter,
    tonalContext,
    sourceStartBeat: request.generatedAtBeat,
    durationBeats: getNumber(object.durationBeats),
    steps: Array.isArray(object.steps)
      ? object.steps.map((step) => coerceMusicalExcerptStep(step, tonalContext))
      : [],
    tags: getStringArray(object.tags),
  };
}

function coerceMusicalExcerptStep(
  value: unknown,
  tonalContext: MusicalExcerpt["tonalContext"],
): MusicalExcerptStep {
  const object = isRecord(value) ? value : {};
  const kind = getString(object.kind) as MusicalExcerptStepKind;
  const scaleDegree = getOptionalNumber(object.scaleDegree);
  const octave = getOptionalNumber(object.octave);
  return {
    kind,
    positionBeats: getNumber(object.positionBeats),
    durationBeats: getNumber(object.durationBeats),
    pitch: derivePitchFromModelStep(kind, scaleDegree, octave, tonalContext),
    scaleDegree,
    octave,
    velocity: getOptionalNumber(object.velocity),
    tags: getStringArray(object.tags),
  };
}

function derivePitchFromModelStep(
  kind: MusicalExcerptStepKind,
  scaleDegree: number | undefined,
  octave: number | undefined,
  tonalContext: MusicalExcerpt["tonalContext"],
): string | undefined {
  if (kind !== "note") return undefined;
  if (typeof scaleDegree !== "number" || typeof octave !== "number") return undefined;
  if (!Number.isInteger(scaleDegree) || !Number.isInteger(octave)) return undefined;
  if (scaleDegree < 0 || scaleDegree >= tonalContext.scale.length) return undefined;
  return noteFromScaleDegree(tonalContext, scaleDegree, octave);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abort, { once: true });
  }
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abort);
  }
}

function extractJsonObject(rawResponse: string): string | undefined {
  const trimmed = rawResponse.trim();
  if (trimmed.startsWith("```")) {
    const unfenced = trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    return extractJsonObject(unfenced);
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return undefined;
  return trimmed.slice(firstBrace, lastBrace + 1);
}

function unwrapIntentObject(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  if (isRecord(value.intent)) return value.intent;
  return value;
}

function unwrapProposalTextObject(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  if (isRecord(value.proposalText)) return value.proposalText;
  return value;
}

function unwrapMelodyCriticObject(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  if (isRecord(value.melodyCritic)) return value.melodyCritic;
  if (isRecord(value.selection)) return value.selection;
  return value;
}

function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "") || "http://127.0.0.1:11434";
}

function createOllamaProxyUrl(endpoint: "tags" | "chat", config: OllamaConfig): string {
  const baseUrl = encodeURIComponent(sanitizeBaseUrl(config.baseUrl));
  return `/api/ollama/${endpoint}?baseUrl=${baseUrl}`;
}

function isMeter(value: unknown): value is [number, number] {
  return Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => Number.isInteger(entry) && entry > 0);
}

function isTonalContext(value: unknown): value is MusicalExcerpt["tonalContext"] {
  return isRecord(value) &&
    typeof value.tonic === "string" &&
    typeof value.mode === "string" &&
    Array.isArray(value.scale) &&
    value.scale.every((entry) => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}

function getOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}
