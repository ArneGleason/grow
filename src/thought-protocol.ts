import type { MusicalEvent, TonalContext } from "./listening";
import type { PlayerRole } from "./players";
import type { PlayerThoughtSeed } from "./thought-seeds";

export type ThoughtRequestLevel =
  | "in_song_short"
  | "influence_probe"
  | "songcraft_plan"
  | "memory_digest";

export type ThoughtResponseLevel =
  | "play_intent"
  | "variation_intent"
  | "influence_note"
  | "song_sketch"
  | "memory_note";

export type ThoughtAction =
  | "rest"
  | "simplify"
  | "vary_motif"
  | "answer_player"
  | "shift_register"
  | "change_density"
  | "disrupt_for_bars";

export type MusicalExcerptOrigin = "self" | "heard" | "imagined" | "group";
export type MusicalExcerptStepKind = "note" | "rest" | "accent" | "gesture";

export interface MusicalExcerptStep {
  kind: MusicalExcerptStepKind;
  positionBeats: number;
  durationBeats: number;
  pitch?: string;
  scaleDegree?: number;
  octave?: number;
  velocity?: number;
  tags: string[];
}

export interface MusicalExcerpt {
  label: string;
  origin: MusicalExcerptOrigin;
  meter: [number, number];
  tonalContext: {
    tonic: string;
    mode: string;
    scale: readonly string[];
  };
  // Provenance/debug anchor for excerpts; intent.target owns future placement.
  sourceStartBeat: number;
  durationBeats: number;
  steps: MusicalExcerptStep[];
  tags: string[];
}

export interface PlayerThoughtRequest {
  id: string;
  playerId: string;
  role: PlayerRole;
  requestLevel: ThoughtRequestLevel;
  generatedAtBeat: number;
  horizonBeats: number;
  // The request owns level/constraints; the seed is the deterministic context bundle it wraps.
  seed: PlayerThoughtSeed;
  excerpts: MusicalExcerpt[];
  allowedActions: ThoughtAction[];
  constraints: {
    meter: [number, number];
    tonalContext: MusicalExcerpt["tonalContext"];
    maxResponseSteps: number;
    maxDurationBeats: number;
  };
}

export interface PlayerThoughtIntent {
  id: string;
  requestId: string;
  playerId: string;
  responseLevel: ThoughtResponseLevel;
  action: ThoughtAction;
  confidence: number;
  target: {
    startAfterBeats: number;
    durationBeats: number;
  };
  musicalIdea: MusicalExcerpt;
  rationale: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUEST_LEVELS: readonly ThoughtRequestLevel[] = [
  "in_song_short",
  "influence_probe",
  "songcraft_plan",
  "memory_digest",
];
const RESPONSE_LEVELS: readonly ThoughtResponseLevel[] = [
  "play_intent",
  "variation_intent",
  "influence_note",
  "song_sketch",
  "memory_note",
];
const THOUGHT_ACTIONS: readonly ThoughtAction[] = [
  "rest",
  "simplify",
  "vary_motif",
  "answer_player",
  "shift_register",
  "change_density",
  "disrupt_for_bars",
];
const DEFAULT_IN_SONG_ALLOWED_ACTIONS: readonly ThoughtAction[] = [
  "rest",
  "simplify",
  "vary_motif",
  "answer_player",
  "shift_register",
  "change_density",
  "disrupt_for_bars",
];
const DEFAULT_IN_SONG_HORIZON_BEATS = 4;
const DEFAULT_MAX_RESPONSE_STEPS = 8;

export function createMusicalExcerptFromEvents(input: {
  label: string;
  origin: MusicalExcerptOrigin;
  events: readonly MusicalEvent[];
  meter: [number, number];
  tonalContext: TonalContext;
  tags?: readonly string[];
}): MusicalExcerpt {
  const events = [...input.events]
    .filter((event) => event.kind === "note" || event.kind === "rest")
    .sort((left, right) => left.absoluteBeat - right.absoluteBeat || left.id.localeCompare(right.id));
  const sourceStartBeat = events[0]?.absoluteBeat ?? 0;
  const steps = events.map((event) => createExcerptStep(event, sourceStartBeat, input.tonalContext));
  const durationBeats = steps.length === 0
    ? 0
    : Math.max(...steps.map((step) => step.positionBeats + step.durationBeats));

  return {
    label: input.label,
    origin: input.origin,
    meter: input.meter,
    tonalContext: {
      tonic: input.tonalContext.tonic,
      mode: input.tonalContext.mode,
      scale: [...input.tonalContext.scale],
    },
    sourceStartBeat: round(sourceStartBeat),
    durationBeats: round(durationBeats),
    steps,
    tags: [...(input.tags ?? [])],
  };
}

export function createPlayerThoughtRequest(
  seed: PlayerThoughtSeed,
  options: {
    requestLevel?: ThoughtRequestLevel;
    horizonBeats?: number;
  } = {},
): PlayerThoughtRequest {
  const requestLevel = options.requestLevel ?? "in_song_short";
  const horizonBeats = options.horizonBeats ?? DEFAULT_IN_SONG_HORIZON_BEATS;
  const excerpt = seed.recentMotif.excerpt;

  return {
    id: [
      "thought",
      seed.playerId,
      requestLevel,
      seed.generatedAtBeat.toFixed(2),
      excerpt.steps.length,
      stableHash(seed.promptFocus).toString(16),
    ].join("-"),
    playerId: seed.playerId,
    role: seed.role,
    requestLevel,
    generatedAtBeat: seed.generatedAtBeat,
    horizonBeats,
    seed,
    excerpts: [excerpt],
    allowedActions: [...getAllowedActions(requestLevel)],
    constraints: {
      meter: excerpt.meter,
      tonalContext: excerpt.tonalContext,
      maxResponseSteps: DEFAULT_MAX_RESPONSE_STEPS,
      maxDurationBeats: horizonBeats,
    },
  };
}

export function createMockThoughtIntent(request: PlayerThoughtRequest): PlayerThoughtIntent {
  const action = chooseMockAction(request);
  const musicalIdea = createMockMusicalIdea(request, action);

  return {
    id: `intent-${stableHash(`${request.id}:${action}:${formatMusicalExcerpt(musicalIdea)}`).toString(16)}`,
    requestId: request.id,
    playerId: request.playerId,
    responseLevel: chooseResponseLevel(request, action),
    action,
    confidence: round(0.55 + (stableHash(`${request.id}:confidence`) % 35) / 100),
    target: {
      startAfterBeats: request.requestLevel === "in_song_short" ? 1 : request.horizonBeats,
      durationBeats: musicalIdea.durationBeats,
    },
    musicalIdea,
    rationale: createMockRationale(request, action),
  };
}

export function validateMusicalExcerpt(excerpt: MusicalExcerpt): ValidationResult {
  const errors: string[] = [];

  if (!excerpt.label.trim()) errors.push("excerpt label is required");
  if (!["self", "heard", "imagined", "group"].includes(excerpt.origin)) {
    errors.push("excerpt origin is unknown");
  }
  if (!isFiniteNumber(excerpt.sourceStartBeat) || excerpt.sourceStartBeat < 0) {
    errors.push("sourceStartBeat must be a non-negative number");
  }
  if (!isFiniteNumber(excerpt.durationBeats) || excerpt.durationBeats < 0) {
    errors.push("durationBeats must be a non-negative number");
  }
  if (excerpt.meter.length !== 2 || excerpt.meter.some((value) => !Number.isInteger(value) || value <= 0)) {
    errors.push("meter must contain two positive integers");
  }
  if (!excerpt.tonalContext.tonic.trim()) errors.push("tonic is required");
  if (!excerpt.tonalContext.mode.trim()) errors.push("mode is required");
  if (excerpt.tonalContext.scale.length === 0) errors.push("scale must not be empty");

  let previousPosition = -Infinity;
  excerpt.steps.forEach((step, index) => {
    const scaleDegree = step.pitch === undefined
      ? undefined
      : getScaleDegree(step.pitch, excerpt.tonalContext.scale);
    if (!["note", "rest", "accent", "gesture"].includes(step.kind)) {
      errors.push(`step ${index} has an unknown kind`);
    }
    if (!isFiniteNumber(step.positionBeats) || step.positionBeats < 0) {
      errors.push(`step ${index} positionBeats must be non-negative`);
    }
    if (!isFiniteNumber(step.durationBeats) || step.durationBeats <= 0) {
      errors.push(`step ${index} durationBeats must be positive`);
    }
    if (step.positionBeats < previousPosition) {
      errors.push(`step ${index} is out of phrase-relative order`);
    }
    if (step.positionBeats + step.durationBeats > excerpt.durationBeats + 0.000001) {
      errors.push(`step ${index} extends past excerpt duration`);
    }
    if (step.kind === "note" && step.pitch === undefined && step.scaleDegree === undefined) {
      errors.push(`step ${index} note needs pitch or scaleDegree`);
    }
    if (step.scaleDegree !== undefined && (!Number.isInteger(step.scaleDegree) || step.scaleDegree < 0)) {
      errors.push(`step ${index} scaleDegree must be a non-negative integer`);
    }
    if (step.scaleDegree !== undefined && step.scaleDegree >= excerpt.tonalContext.scale.length) {
      errors.push(`step ${index} scaleDegree must be within tonal scale`);
    }
    if (step.pitch !== undefined && scaleDegree === undefined) {
      errors.push(`step ${index} pitch must belong to tonal scale`);
    }
    if (
      step.pitch !== undefined &&
      step.scaleDegree !== undefined &&
      scaleDegree !== undefined &&
      step.scaleDegree !== scaleDegree
    ) {
      errors.push(`step ${index} pitch and scaleDegree disagree`);
    }
    if (step.octave !== undefined && !Number.isInteger(step.octave)) {
      errors.push(`step ${index} octave must be an integer`);
    }
    const pitchOctave = parsePitch(step.pitch)?.octave;
    if (pitchOctave !== undefined && step.octave !== undefined && pitchOctave !== step.octave) {
      errors.push(`step ${index} pitch and octave disagree`);
    }
    if (step.velocity !== undefined && (step.velocity < 0 || step.velocity > 1)) {
      errors.push(`step ${index} velocity must be between 0 and 1`);
    }
    previousPosition = step.positionBeats;
  });

  return { valid: errors.length === 0, errors };
}

export function validatePlayerThoughtRequest(request: PlayerThoughtRequest): ValidationResult {
  const errors: string[] = [];

  if (!request.id.trim()) errors.push("request id is required");
  if (!request.playerId.trim()) errors.push("playerId is required");
  if (!REQUEST_LEVELS.includes(request.requestLevel)) errors.push("requestLevel is unknown");
  if (request.seed.playerId !== request.playerId) errors.push("request seed playerId mismatch");
  if (request.seed.role !== request.role) errors.push("request seed role mismatch");
  if (!isFiniteNumber(request.generatedAtBeat) || request.generatedAtBeat < 0) {
    errors.push("generatedAtBeat must be non-negative");
  }
  if (!isFiniteNumber(request.horizonBeats) || request.horizonBeats <= 0) {
    errors.push("horizonBeats must be positive");
  }
  if (request.allowedActions.length === 0) errors.push("allowedActions must not be empty");
  for (const action of request.allowedActions) {
    if (!THOUGHT_ACTIONS.includes(action)) errors.push(`unknown allowed action: ${action}`);
  }
  if (request.excerpts.length === 0) errors.push("at least one excerpt is required");
  for (const excerpt of request.excerpts) {
    errors.push(...validateMusicalExcerpt(excerpt).errors.map((error) => `excerpt: ${error}`));
  }
  if (request.constraints.maxResponseSteps <= 0) errors.push("maxResponseSteps must be positive");
  if (request.constraints.maxDurationBeats <= 0) errors.push("maxDurationBeats must be positive");

  return { valid: errors.length === 0, errors };
}

export function validatePlayerThoughtIntent(
  intent: PlayerThoughtIntent,
  request: PlayerThoughtRequest,
): ValidationResult {
  const errors: string[] = [];

  if (!intent.id.trim()) errors.push("intent id is required");
  if (intent.requestId !== request.id) errors.push("intent requestId mismatch");
  if (intent.playerId !== request.playerId) errors.push("intent playerId mismatch");
  if (!RESPONSE_LEVELS.includes(intent.responseLevel)) errors.push("responseLevel is unknown");
  if (!THOUGHT_ACTIONS.includes(intent.action)) errors.push("action is unknown");
  if (!request.allowedActions.includes(intent.action)) errors.push("action is not allowed by request");
  if (!isFiniteNumber(intent.confidence) || intent.confidence < 0 || intent.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  if (!isFiniteNumber(intent.target.startAfterBeats) || intent.target.startAfterBeats < 0) {
    errors.push("target startAfterBeats must be non-negative");
  }
  if (!isFiniteNumber(intent.target.durationBeats) || intent.target.durationBeats <= 0) {
    errors.push("target durationBeats must be positive");
  }
  if (intent.target.durationBeats > request.constraints.maxDurationBeats) {
    errors.push("target duration exceeds request constraint");
  }
  if (intent.musicalIdea.durationBeats > request.constraints.maxDurationBeats) {
    errors.push("musical idea duration exceeds request constraint");
  }
  if (intent.musicalIdea.steps.length > request.constraints.maxResponseSteps) {
    errors.push("musical idea has too many steps");
  }
  errors.push(...validateMusicalExcerpt(intent.musicalIdea).errors.map((error) => `musicalIdea: ${error}`));
  if (!intent.rationale.trim()) errors.push("rationale is required");

  return { valid: errors.length === 0, errors };
}

export function formatMusicalExcerpt(excerpt: MusicalExcerpt): string {
  if (excerpt.steps.length === 0) return "resting";
  return excerpt.steps.map(formatMusicalExcerptStep).join(" ");
}

function createExcerptStep(
  event: MusicalEvent,
  sourceStartBeat: number,
  tonalContext: TonalContext,
): MusicalExcerptStep {
  const pitchParts = parsePitch(event.pitch);
  return {
    kind: event.kind === "rest" ? "rest" : "note",
    positionBeats: round(event.absoluteBeat - sourceStartBeat),
    durationBeats: round(event.durationBeats),
    pitch: event.pitch,
    scaleDegree: event.pitch ? getScaleDegree(event.pitch, tonalContext.scale) : undefined,
    octave: pitchParts?.octave,
    velocity: round(event.velocity),
    tags: [...event.tags],
  };
}

function getAllowedActions(requestLevel: ThoughtRequestLevel): readonly ThoughtAction[] {
  if (requestLevel === "in_song_short") return DEFAULT_IN_SONG_ALLOWED_ACTIONS;
  if (requestLevel === "influence_probe") return ["vary_motif", "answer_player", "change_density"];
  if (requestLevel === "songcraft_plan") return ["vary_motif", "answer_player", "change_density"];
  return ["simplify", "vary_motif", "change_density"];
}

function chooseMockAction(request: PlayerThoughtRequest): ThoughtAction {
  const focusPlayerId = request.seed.listeningSummary.focusPlayerId;
  switch (request.seed.tasteSummary.action) {
    case "rest":
      return "rest";
    case "simplify":
      return "simplify";
    case "support":
      return focusPlayerId ? "answer_player" : "change_density";
    case "contrast":
      return request.role === "melody" ? "shift_register" : "disrupt_for_bars";
    case "vary":
      return "vary_motif";
    case "repeat":
      return request.seed.recentMotif.eventCount > 0 ? "vary_motif" : "change_density";
  }
}

function chooseResponseLevel(
  request: PlayerThoughtRequest,
  action: ThoughtAction,
): ThoughtResponseLevel {
  if (request.requestLevel === "influence_probe") return "influence_note";
  if (request.requestLevel === "songcraft_plan") return "song_sketch";
  if (request.requestLevel === "memory_digest") return "memory_note";
  return action === "vary_motif" || action === "shift_register"
    ? "variation_intent"
    : "play_intent";
}

function createMockMusicalIdea(
  request: PlayerThoughtRequest,
  action: ThoughtAction,
): MusicalExcerpt {
  const source = request.excerpts[0];
  const sourceSteps = source.steps.length > 0
    ? source.steps.slice(0, request.constraints.maxResponseSteps)
    : [createRestStep(0, 1)];
  const direction = stableHash(`${request.id}:direction`) % 2 === 0 ? 1 : -1;
  const scaleSize = Math.max(1, request.constraints.tonalContext.scale.length);
  let steps: MusicalExcerptStep[];

  if (action === "rest") {
    steps = [createRestStep(0, Math.min(2, request.horizonBeats))];
  } else if (action === "simplify") {
    const anchoredSteps = sourceSteps.filter((step) => step.kind !== "note" || isWholeBeat(step.positionBeats));
    steps = (anchoredSteps.length > 0 ? anchoredSteps : sourceSteps.slice(0, 2)).map(cloneStep);
  } else if (action === "vary_motif") {
    steps = sourceSteps.map((step) => {
      if (step.kind !== "note") return cloneStep(step);
      return {
        ...cloneStep(step),
        pitch: undefined,
        scaleDegree: step.scaleDegree === undefined
          ? undefined
          : modulo(step.scaleDegree + direction, scaleSize),
        tags: [...step.tags, "mock:vary"],
      };
    });
  } else if (action === "shift_register") {
    steps = sourceSteps.map((step) => step.kind === "note"
      ? {
        ...cloneStep(step),
        pitch: undefined,
        octave: step.octave === undefined ? undefined : step.octave + direction,
        tags: [...step.tags, "mock:register"],
      }
      : cloneStep(step));
  } else if (action === "answer_player") {
    steps = sourceSteps.map((step) => ({
      ...cloneStep(step),
      positionBeats: round(step.positionBeats + 0.5),
      tags: [...step.tags, "mock:answer"],
    }));
  } else if (action === "disrupt_for_bars") {
    steps = [
      { kind: "accent", positionBeats: 0, durationBeats: 0.5, velocity: 0.6, tags: ["mock:disrupt"] },
      createRestStep(0.5, 0.5),
    ];
  } else {
    steps = sourceSteps
      .filter((_, index) => index % 2 === 0)
      .map((step) => ({ ...cloneStep(step), tags: [...step.tags, "mock:density"] }));
  }

  if (steps.length === 0) {
    steps = [createRestStep(0, 1)];
  }

  const durationBeats = Math.min(
    request.constraints.maxDurationBeats,
    Math.max(1, ...steps.map((step) => step.positionBeats + step.durationBeats)),
  );
  const boundedSteps = steps.map((step) => ({
    ...step,
    positionBeats: Math.min(step.positionBeats, Math.max(0, durationBeats - step.durationBeats)),
  }));

  return {
    label: `${request.playerId} mock ${action}`,
    origin: "imagined",
    meter: request.constraints.meter,
    tonalContext: request.constraints.tonalContext,
    sourceStartBeat: round(request.generatedAtBeat + 1),
    durationBeats: round(durationBeats),
    steps: boundedSteps,
    tags: ["mock-intent", action],
  };
}

function createMockRationale(request: PlayerThoughtRequest, action: ThoughtAction): string {
  const fragment = request.seed.selectedFragments[0]?.text ?? "recent listening";
  if (action === "answer_player" && request.seed.listeningSummary.focusPlayerId) {
    return `Answer ${request.seed.listeningSummary.focusPlayerId} using ${fragment}.`;
  }
  if (action === "rest") {
    return `Hold space because ${request.seed.tasteSummary.reason}`;
  }
  return `Use ${fragment} to ${action.replaceAll("_", " ")} within ${request.horizonBeats} beats.`;
}

function createRestStep(positionBeats: number, durationBeats: number): MusicalExcerptStep {
  return {
    kind: "rest",
    positionBeats: round(positionBeats),
    durationBeats: round(durationBeats),
    tags: ["rest"],
  };
}

function cloneStep(step: MusicalExcerptStep): MusicalExcerptStep {
  return {
    ...step,
    tags: [...step.tags],
  };
}

function formatMusicalExcerptStep(step: MusicalExcerptStep): string {
  const position = `+${step.positionBeats.toFixed(1)}`;
  const duration = step.durationBeats.toFixed(1);
  if (step.kind === "rest") return `r@${position}/${duration}`;
  if (step.kind === "accent") return `accent@${position}/${duration}`;
  if (step.kind === "gesture") return `gesture@${position}/${duration}`;
  const note = step.pitch ?? (
    step.scaleDegree === undefined ? "note" : `d${step.scaleDegree}${step.octave === undefined ? "" : `o${step.octave}`}`
  );
  return `${note}@${position}/${duration}`;
}

function getScaleDegree(pitch: string, scale: readonly string[]): number | undefined {
  const pitchClass = getPitchClass(pitch);
  const degree = scale.indexOf(pitchClass);
  return degree >= 0 ? degree : undefined;
}

function getPitchClass(pitch: string): string {
  return pitch.replace(/[0-9-]+$/, "");
}

function parsePitch(pitch?: string): { octave: number } | undefined {
  const octave = pitch?.match(/-?\d+$/)?.[0];
  if (!octave) return undefined;
  return { octave: Number(octave) };
}

function isWholeBeat(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 0.000001;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
