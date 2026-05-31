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

export interface OllamaConfig {
  baseUrl: string;
  model: string;
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

const DEFAULT_OLLAMA_BASE_URL = import.meta.env?.VITE_GROW_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = import.meta.env?.VITE_GROW_OLLAMA_MODEL ?? "gemma4:31b";
const DEFAULT_OLLAMA_TIMEOUT_MS = 15_000;
const SHORT_RESPONSE_RULE =
  "Return only one compact JSON object. No markdown. No prose outside JSON. Keep rationale under 160 characters.";

export function createDefaultOllamaConfig(): OllamaConfig {
  return {
    baseUrl: sanitizeBaseUrl(DEFAULT_OLLAMA_BASE_URL),
    model: DEFAULT_OLLAMA_MODEL.trim() || "gemma4:31b",
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
    rawResponse: "",
    parse: { status: "idle", errors: [] },
    validation: { valid: false, errors: [] },
    message: "No Ollama thought sent",
  };
}

export function createOllamaSessionPrimer(): string {
  return [
    "You are Grow's local slow-thinking musical planner.",
    "You receive one structured PlayerThoughtRequest and return one bounded PlayerThoughtIntent.",
    "The app validates your JSON. Invalid output is ignored and the deterministic mock fallback stays active.",
    SHORT_RESPONSE_RULE,
    "Do not schedule sound. Do not describe audio playback. Only propose a future intent.",
    "Allowed actions are provided in the request. Choose exactly one allowed action.",
    "MusicalExcerpt convention: steps[].positionBeats is phrase-relative and monotonic from 0.",
    "MusicalExcerpt convention: steps[].scaleDegree is a pitch-class index from 0 to scale.length - 1.",
    "MusicalExcerpt convention: steps[].octave is separate. Do not use wrapping scale degrees.",
    "If you include pitch and scaleDegree, they must agree with tonalContext.scale.",
    "The system owns sourceStartBeat and placement. Copy requestId/playerId, but target.startAfterBeats and target.durationBeats own future placement.",
    "For influence probes, return an abstract transferable technique. Do not copy or imitate a named artist's melody, lyric, or signature passage.",
  ].join("\n");
}

export function createOllamaThoughtPrompt(
  request: PlayerThoughtRequest,
  options: {
    influenceReference?: string;
  } = {},
): string {
  const reference = options.influenceReference
    ? `Influence reference: ${options.influenceReference}. Use only abstract transferable technique.`
    : "Influence reference: use the player's selected memory fragments and current listening frame.";
  const exampleAction = request.allowedActions.includes("vary_motif")
    ? "vary_motif"
    : request.allowedActions[0];
  const exampleResponseLevel = request.requestLevel === "influence_probe"
    ? "influence_note"
    : request.requestLevel === "songcraft_plan"
      ? "song_sketch"
      : request.requestLevel === "memory_digest"
        ? "memory_note"
        : "variation_intent";
  return [
    "Create one PlayerThoughtIntent for this request.",
    reference,
    `Allowed responseLevels: play_intent, variation_intent, influence_note, song_sketch, memory_note.`,
    `Allowed actions for this request: ${request.allowedActions.join(", ")}.`,
    "Return JSON with this shape:",
    [
      "{",
      '  "id": "short-id",',
      `  "requestId": ${JSON.stringify(request.id)},`,
      `  "playerId": ${JSON.stringify(request.playerId)},`,
      `  "responseLevel": ${JSON.stringify(exampleResponseLevel)},`,
      `  "action": ${JSON.stringify(exampleAction)},`,
      '  "confidence": 0.0,',
      '  "target": { "startAfterBeats": 1, "durationBeats": 1 },',
      '  "musicalIdea": {',
      '    "label": "short label",',
      '    "origin": "imagined",',
      `    "meter": ${JSON.stringify(request.constraints.meter)},`,
      `    "tonalContext": ${JSON.stringify(request.constraints.tonalContext)},`,
      '    "durationBeats": 1,',
      '    "steps": [{ "kind": "note", "positionBeats": 0, "durationBeats": 0.5, "scaleDegree": 0, "octave": 4, "velocity": 0.5, "tags": ["ollama"] }],',
      '    "tags": ["ollama-intent"]',
      "  },",
      '  "rationale": "short reason"',
      "}",
    ].join("\n"),
    "Do not include musicalIdea.sourceStartBeat; the system will insert it.",
    `Constraints: max ${request.constraints.maxResponseSteps} steps, max ${request.constraints.maxDurationBeats} beats, scale degrees 0-${request.constraints.tonalContext.scale.length - 1}.`,
    `Request JSON: ${JSON.stringify(request)}`,
  ].join("\n\n");
}

export function createOllamaInfluenceProbePrompt(
  request: PlayerThoughtRequest,
  influenceReference = "one remembered playing technique, not a copied song",
): string {
  return createOllamaThoughtPrompt(request, { influenceReference });
}

export async function checkOllamaHealth(config: OllamaConfig): Promise<OllamaHealthState> {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(`${sanitizeBaseUrl(config.baseUrl)}/api/tags`, {
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
): Promise<OllamaThoughtTestResult> {
  const startedAt = Date.now();
  const fallbackIntent = createMockThoughtIntent(request);
  const fallbackValidation = validatePlayerThoughtIntent(fallbackIntent, request);

  try {
    const response = await fetchWithTimeout(`${sanitizeBaseUrl(config.baseUrl)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: createOllamaSessionPrimer() },
          { role: "user", content: createOllamaThoughtPrompt(request) },
        ],
        stream: false,
        format: "json",
        think: false,
        options: {
          temperature: 0.35,
          num_predict: 700,
        },
      }),
    }, config.timeoutMs);
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

function getOllamaResponseText(payload: OllamaChatResponse): string {
  const candidates = [
    payload.message?.content,
    payload.response,
    payload.message?.thinking,
  ];
  return candidates.find((candidate) => (candidate?.trim().length ?? 0) > 0) ?? "";
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
    confidence: getNumber(value.confidence),
    target: {
      startAfterBeats: getNumber(target.startAfterBeats),
      durationBeats: getNumber(target.durationBeats),
    },
    musicalIdea: coerceMusicalExcerpt(value.musicalIdea, request),
    rationale: getString(value.rationale),
  };
}

function coerceMusicalExcerpt(value: unknown, request: PlayerThoughtRequest): MusicalExcerpt {
  const object = isRecord(value) ? value : {};
  return {
    label: getString(object.label),
    origin: (getString(object.origin) || "imagined") as MusicalExcerptOrigin,
    meter: isMeter(object.meter) ? object.meter : request.constraints.meter,
    tonalContext: isTonalContext(object.tonalContext)
      ? object.tonalContext
      : request.constraints.tonalContext,
    sourceStartBeat: request.generatedAtBeat,
    durationBeats: getNumber(object.durationBeats),
    steps: Array.isArray(object.steps)
      ? object.steps.map(coerceMusicalExcerptStep)
      : [],
    tags: getStringArray(object.tags),
  };
}

function coerceMusicalExcerptStep(value: unknown): MusicalExcerptStep {
  const object = isRecord(value) ? value : {};
  return {
    kind: getString(object.kind) as MusicalExcerptStepKind,
    positionBeats: getNumber(object.positionBeats),
    durationBeats: getNumber(object.durationBeats),
    pitch: getOptionalString(object.pitch),
    scaleDegree: getOptionalNumber(object.scaleDegree),
    octave: getOptionalNumber(object.octave),
    velocity: getOptionalNumber(object.velocity),
    tags: getStringArray(object.tags),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
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

function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "") || "http://127.0.0.1:11434";
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

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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
