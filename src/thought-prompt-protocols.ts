import type {
  MusicalExcerptStep,
  PlayerThoughtRequest,
} from "./thought-protocol";

export type ThoughtPromptProtocolId = "projected-json";

export interface ThoughtPromptProtocol {
  id: ThoughtPromptProtocolId;
  label: string;
  createUserPrompt(
    request: PlayerThoughtRequest,
    options?: ThoughtPromptOptions,
  ): string;
  createResponseFormat(request: PlayerThoughtRequest): ThoughtIntentJsonSchema;
}

export interface ThoughtPromptOptions {
  influenceReference?: string;
}

export interface ProjectedThoughtRequest {
  v: "grow.thought/1";
  id: string;
  player: string;
  role: string;
  level: string;
  allowedActions: readonly string[];
  constraints: PlayerThoughtRequest["constraints"];
  focus: string;
  disposition: string;
  memory: readonly string[];
  listening: PlayerThoughtRequest["seed"]["listeningSummary"];
  taste: string;
  motif: CompactMotifStep[];
  influenceReference?: string;
}

export type CompactMotifStep =
  | ["r", number, number]
  | ["n", number, number, number | undefined, number | undefined, number | undefined]
  | ["g", string, number, number];

export interface ThoughtIntentJsonSchema {
  type: "object";
  required: readonly string[];
  properties: Record<string, unknown>;
  additionalProperties: boolean;
}

export const DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID: ThoughtPromptProtocolId = "projected-json";

const RESPONSE_LEVELS = [
  "play_intent",
  "variation_intent",
  "influence_note",
  "song_sketch",
  "memory_note",
] as const;
const MUSICAL_IDEA_ORIGINS = ["self", "heard", "imagined", "group"] as const;
const STEP_KINDS = ["note", "rest", "accent", "gesture"] as const;

const PROJECTED_JSON_PROTOCOL: ThoughtPromptProtocol = {
  id: "projected-json",
  label: "Projected JSON",
  createUserPrompt(request, options = {}) {
    const projection = createProjectedThoughtRequest(request, options);
    return [
      "Task: produce one PlayerThoughtIntent that can be validated and optionally scheduled later.",
      "Use the request projection only; it is a compact view of the canonical internal request.",
      "Return one JSON object matching the provided schema. No markdown. No prose outside JSON.",
      "Copy request id/player exactly. Choose one allowed action.",
      "Use scaleDegree as 0..scale.length-1 plus separate octave. Omit sourceStartBeat; the system owns provenance and placement.",
      "Keep rationale under 160 characters.",
      `Request projection: ${JSON.stringify(projection)}`,
    ].join("\n\n");
  },
  createResponseFormat: createThoughtIntentJsonSchema,
};

const THOUGHT_PROMPT_PROTOCOLS: Record<ThoughtPromptProtocolId, ThoughtPromptProtocol> = {
  "projected-json": PROJECTED_JSON_PROTOCOL,
};

export function getThoughtPromptProtocol(
  id: ThoughtPromptProtocolId = DEFAULT_THOUGHT_PROMPT_PROTOCOL_ID,
): ThoughtPromptProtocol {
  return THOUGHT_PROMPT_PROTOCOLS[id];
}

export function isThoughtPromptProtocolId(value: string): value is ThoughtPromptProtocolId {
  return value in THOUGHT_PROMPT_PROTOCOLS;
}

export function createProjectedThoughtRequest(
  request: PlayerThoughtRequest,
  options: ThoughtPromptOptions = {},
): ProjectedThoughtRequest {
  return {
    v: "grow.thought/1",
    id: request.id,
    player: request.playerId,
    role: request.role,
    level: request.requestLevel,
    allowedActions: request.allowedActions,
    constraints: request.constraints,
    focus: request.seed.promptFocus,
    disposition: request.seed.disposition,
    memory: request.seed.selectedFragments.map((fragment) => fragment.text),
    listening: request.seed.listeningSummary,
    taste: `${request.seed.tasteSummary.action}: ${request.seed.tasteSummary.reason}`,
    motif: (request.excerpts[0]?.steps ?? []).map(compactMotifStep),
    ...(options.influenceReference ? { influenceReference: options.influenceReference } : {}),
  };
}

function compactMotifStep(step: MusicalExcerptStep): CompactMotifStep {
  if (step.kind === "rest") {
    return ["r", step.positionBeats, step.durationBeats];
  }
  if (step.kind === "note") {
    return [
      "n",
      step.positionBeats,
      step.durationBeats,
      step.scaleDegree,
      step.octave,
      step.velocity,
    ];
  }
  return ["g", step.kind, step.positionBeats, step.durationBeats];
}

function createThoughtIntentJsonSchema(request: PlayerThoughtRequest): ThoughtIntentJsonSchema {
  return {
    type: "object",
    required: [
      "id",
      "requestId",
      "playerId",
      "responseLevel",
      "action",
      "confidence",
      "target",
      "musicalIdea",
      "rationale",
    ],
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      requestId: { type: "string", enum: [request.id] },
      playerId: { type: "string", enum: [request.playerId] },
      responseLevel: { type: "string", enum: RESPONSE_LEVELS },
      action: { type: "string", enum: request.allowedActions },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      target: {
        type: "object",
        required: ["startAfterBeats", "durationBeats"],
        additionalProperties: false,
        properties: {
          startAfterBeats: {
            type: "number",
            minimum: 0,
            maximum: request.horizonBeats,
          },
          durationBeats: {
            type: "number",
            minimum: 0.25,
            maximum: request.constraints.maxDurationBeats,
          },
        },
      },
      musicalIdea: {
        type: "object",
        required: ["label", "origin", "durationBeats", "steps", "tags"],
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          origin: { type: "string", enum: MUSICAL_IDEA_ORIGINS },
          meter: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "integer", minimum: 1 },
          },
          tonalContext: createTonalContextSchema(request),
          durationBeats: {
            type: "number",
            minimum: 0,
            maximum: request.constraints.maxDurationBeats,
          },
          steps: {
            type: "array",
            maxItems: request.constraints.maxResponseSteps,
            items: createStepSchema(request),
          },
          tags: createStringArraySchema(),
        },
      },
      rationale: { type: "string", maxLength: 180 },
    },
  };
}

function createStepSchema(request: PlayerThoughtRequest): Record<string, unknown> {
  return {
    type: "object",
    required: ["kind", "positionBeats", "durationBeats", "tags"],
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: STEP_KINDS },
      positionBeats: {
        type: "number",
        minimum: 0,
        maximum: request.constraints.maxDurationBeats,
      },
      durationBeats: {
        type: "number",
        minimum: 0.25,
        maximum: request.constraints.maxDurationBeats,
      },
      pitch: { type: "string" },
      scaleDegree: {
        type: "integer",
        minimum: 0,
        maximum: Math.max(0, request.constraints.tonalContext.scale.length - 1),
      },
      octave: { type: "integer" },
      velocity: { type: "number", minimum: 0, maximum: 1 },
      tags: createStringArraySchema(),
    },
  };
}

function createTonalContextSchema(request: PlayerThoughtRequest): Record<string, unknown> {
  return {
    type: "object",
    required: ["tonic", "mode", "scale"],
    additionalProperties: false,
    properties: {
      tonic: { type: "string", enum: [request.constraints.tonalContext.tonic] },
      mode: { type: "string", enum: [request.constraints.tonalContext.mode] },
      scale: {
        type: "array",
        minItems: request.constraints.tonalContext.scale.length,
        maxItems: request.constraints.tonalContext.scale.length,
        items: { type: "string" },
      },
    },
  };
}

function createStringArraySchema(): Record<string, unknown> {
  return {
    type: "array",
    items: { type: "string" },
  };
}
