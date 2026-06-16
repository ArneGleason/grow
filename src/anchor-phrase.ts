export const CONNECTOR_KERNELS = [
  "fill",
  "detour",
  "approach",
  "orbit",
  "skip",
] as const;

export type ConnectorKernel = typeof CONNECTOR_KERNELS[number];

export const ANCHOR_PHRASE_CAPS = {
  maxSegments: 16,
  maxAnchors: 64,
  maxPhraseLengthBeats: 512,
  maxAnchorDurationBeats: 64,
  minAnchorDurationBeats: 0.0625,
} as const;

export interface Anchor {
  degree: number;
  octave: number;
  startBeat: number;
  durationBeats: number;
  dynamics: number;
}

export interface Connector {
  kernel: ConnectorKernel;
  reach: number;
  density: number;
  bias: number;
  pull: number;
  color: number;
  skew: number;
}

export interface AnchorPhraseSegment {
  anchors: readonly Anchor[];
  connectors: readonly Connector[];
}

export interface AnchorPhrase {
  segments: readonly AnchorPhraseSegment[];
}

export interface AnchorPhraseValidationResult {
  valid: boolean;
  phrase: AnchorPhrase;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
}

const DEFAULT_ANCHOR: Anchor = {
  degree: 1,
  octave: 4,
  startBeat: 0,
  durationBeats: 1,
  dynamics: 0.7,
};

const DEFAULT_CONNECTOR: Connector = {
  kernel: "fill",
  reach: 0.5,
  density: 0.5,
  bias: 0,
  pull: 0.5,
  color: 0,
  skew: 0,
};

export function validateAnchorPhrase(input: unknown): AnchorPhraseValidationResult {
  return normalizeAnchorPhrase(input);
}

export function normalizeAnchorPhrase(input: unknown): AnchorPhraseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clamps: string[] = [];
  const source = isRecord(input) ? input : {};
  if (!isRecord(input)) {
    errors.push("AnchorPhrase must be an object");
  }

  const rawSegments = Array.isArray(source.segments) ? source.segments : [];
  if (!Array.isArray(source.segments)) {
    errors.push("segments must be an array");
  }
  if (rawSegments.length === 0) {
    errors.push("AnchorPhrase must include at least one segment");
  }
  if (rawSegments.length > ANCHOR_PHRASE_CAPS.maxSegments) {
    clamps.push(`segments clamped to ${ANCHOR_PHRASE_CAPS.maxSegments}`);
  }

  const segments: AnchorPhraseSegment[] = [];
  let totalAnchors = 0;
  const sourceSegments = rawSegments.length > 0 ? rawSegments : [{ anchors: [DEFAULT_ANCHOR], connectors: [] }];
  for (const [segmentIndex, rawSegment] of sourceSegments.slice(0, ANCHOR_PHRASE_CAPS.maxSegments).entries()) {
    if (totalAnchors >= ANCHOR_PHRASE_CAPS.maxAnchors) {
      clamps.push(`anchors clamped to ${ANCHOR_PHRASE_CAPS.maxAnchors}`);
      break;
    }
    const segment = readSegment(rawSegment, segmentIndex, totalAnchors, errors, warnings, clamps);
    totalAnchors += segment.anchors.length;
    segments.push(segment);
  }

  if (segments.length === 0) {
    segments.push({
      anchors: [DEFAULT_ANCHOR],
      connectors: [],
    });
  }

  validateStructure(segments, errors);

  return {
    valid: errors.length === 0,
    phrase: { segments },
    errors,
    warnings,
    clamps,
  };
}

export function isConnectorKernel(value: string): value is ConnectorKernel {
  return (CONNECTOR_KERNELS as readonly string[]).includes(value);
}

function readSegment(
  value: unknown,
  segmentIndex: number,
  anchorsBefore: number,
  errors: string[],
  warnings: string[],
  clamps: string[],
): AnchorPhraseSegment {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    errors.push(`segments.${segmentIndex} must be an object`);
  }

  const rawAnchors = Array.isArray(source.anchors) ? source.anchors : [];
  if (!Array.isArray(source.anchors)) {
    errors.push(`segments.${segmentIndex}.anchors must be an array`);
  }
  if (rawAnchors.length === 0) {
    errors.push(`segments.${segmentIndex}.anchors must include at least one anchor`);
  }

  const remainingAnchors = Math.max(0, ANCHOR_PHRASE_CAPS.maxAnchors - anchorsBefore);
  const sourceAnchors = rawAnchors.length > 0 ? rawAnchors : [DEFAULT_ANCHOR];
  const anchors = sourceAnchors.slice(0, remainingAnchors).map((anchor, anchorIndex) =>
    readAnchor(anchor, segmentIndex, anchorIndex, warnings, clamps)
  );
  if (sourceAnchors.length > remainingAnchors) {
    clamps.push(`anchors clamped to ${ANCHOR_PHRASE_CAPS.maxAnchors}`);
  }

  const rawConnectors = Array.isArray(source.connectors) ? source.connectors : [];
  if (!Array.isArray(source.connectors)) {
    errors.push(`segments.${segmentIndex}.connectors must be an array`);
  }
  const expectedConnectorCount = Math.max(0, anchors.length - 1);
  if (rawConnectors.length !== expectedConnectorCount) {
    errors.push(
      `segments.${segmentIndex}.connectors length must equal anchors.length - 1 (${expectedConnectorCount})`,
    );
  }
  const connectors = Array.from({ length: expectedConnectorCount }, (_, connectorIndex) =>
    readConnector(rawConnectors[connectorIndex], segmentIndex, connectorIndex, errors, warnings, clamps)
  );

  return { anchors, connectors };
}

function readAnchor(
  value: unknown,
  segmentIndex: number,
  anchorIndex: number,
  warnings: string[],
  clamps: string[],
): Anchor {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    warnings.push(`segments.${segmentIndex}.anchors.${anchorIndex} was not an object; fallback used`);
  }
  const label = `segments.${segmentIndex}.anchors.${anchorIndex}`;
  const startMaximum = ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats;
  const startBeat = readClampedNumber(
    source.startBeat,
    DEFAULT_ANCHOR.startBeat,
    0,
    startMaximum,
    `${label}.startBeat`,
    warnings,
    clamps,
  );
  const maximumDuration = Math.min(
    ANCHOR_PHRASE_CAPS.maxAnchorDurationBeats,
    ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - startBeat,
  );
  return {
    degree: readInteger(source.degree, DEFAULT_ANCHOR.degree, 1, 7, `${label}.degree`, warnings, clamps),
    octave: readInteger(source.octave, DEFAULT_ANCHOR.octave, 0, 8, `${label}.octave`, warnings, clamps),
    startBeat,
    durationBeats: readClampedNumber(
      source.durationBeats,
      DEFAULT_ANCHOR.durationBeats,
      ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      maximumDuration,
      `${label}.durationBeats`,
      warnings,
      clamps,
    ),
    dynamics: readClampedNumber(
      source.dynamics,
      DEFAULT_ANCHOR.dynamics,
      0,
      1,
      `${label}.dynamics`,
      warnings,
      clamps,
    ),
  };
}

function readConnector(
  value: unknown,
  segmentIndex: number,
  connectorIndex: number,
  errors: string[],
  warnings: string[],
  clamps: string[],
): Connector {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    warnings.push(`segments.${segmentIndex}.connectors.${connectorIndex} was not an object; fallback used`);
  }
  const label = `segments.${segmentIndex}.connectors.${connectorIndex}`;
  return {
    kernel: readKernel(source.kernel, `${label}.kernel`, errors),
    reach: readClampedNumber(source.reach, DEFAULT_CONNECTOR.reach, 0, 1, `${label}.reach`, warnings, clamps),
    density: readClampedNumber(
      source.density,
      DEFAULT_CONNECTOR.density,
      0,
      1,
      `${label}.density`,
      warnings,
      clamps,
    ),
    bias: readClampedNumber(source.bias, DEFAULT_CONNECTOR.bias, -1, 1, `${label}.bias`, warnings, clamps),
    pull: readClampedNumber(source.pull, DEFAULT_CONNECTOR.pull, 0, 1, `${label}.pull`, warnings, clamps),
    color: readClampedNumber(source.color, DEFAULT_CONNECTOR.color, 0, 1, `${label}.color`, warnings, clamps),
    skew: readClampedNumber(source.skew, DEFAULT_CONNECTOR.skew, -1, 1, `${label}.skew`, warnings, clamps),
  };
}

function readKernel(value: unknown, label: string, errors: string[]): ConnectorKernel {
  if (value === undefined) return DEFAULT_CONNECTOR.kernel;
  if (typeof value === "string" && isConnectorKernel(value)) return value;
  errors.push(`${label} must be one of ${CONNECTOR_KERNELS.join(", ")}`);
  return DEFAULT_CONNECTOR.kernel;
}

function validateStructure(segments: readonly AnchorPhraseSegment[], errors: string[]): void {
  let previousSegmentEndBeat: number | undefined;
  for (const [segmentIndex, segment] of segments.entries()) {
    if (segment.anchors.length === 0) {
      errors.push(`segments.${segmentIndex}.anchors must include at least one anchor`);
      continue;
    }
    if (segment.connectors.length !== segment.anchors.length - 1) {
      errors.push(`segments.${segmentIndex}.connectors length must equal anchors.length - 1`);
    }
    validateAnchors(segment.anchors, segmentIndex, errors);
    const firstAnchor = segment.anchors[0];
    const lastAnchor = segment.anchors[segment.anchors.length - 1];
    if (previousSegmentEndBeat !== undefined && firstAnchor.startBeat < previousSegmentEndBeat) {
      errors.push(
        `segments.${segmentIndex} must start at or after previous segment end ${roundTo(previousSegmentEndBeat, 4)}`,
      );
    }
    previousSegmentEndBeat = anchorEndBeat(lastAnchor);
  }
}

function validateAnchors(anchors: readonly Anchor[], segmentIndex: number, errors: string[]): void {
  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];
    if (current.startBeat < previous.startBeat) {
      errors.push(`segments.${segmentIndex}.anchors must be sorted by startBeat`);
    }
    const previousEndBeat = anchorEndBeat(previous);
    if (current.startBeat < previousEndBeat) {
      errors.push(
        `segments.${segmentIndex}.anchors.${index} must start at or after previous anchor end ${roundTo(previousEndBeat, 4)}`,
      );
    }
  }
}

function anchorEndBeat(anchor: Anchor): number {
  return roundTo(anchor.startBeat + anchor.durationBeats, 4);
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  const clamped = Math.min(maximum, Math.max(minimum, Math.trunc(value)));
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${clamped}`);
  }
  return clamped;
}

function readClampedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  const clamped = Math.min(maximum, Math.max(minimum, value));
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${roundTo(clamped, 4)}`);
  }
  return roundTo(clamped, 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
