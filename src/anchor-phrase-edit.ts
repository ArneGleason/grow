import {
  ANCHOR_PHRASE_CAPS,
  CONNECTOR_KERNELS,
  normalizeAnchorPhrase,
  type Anchor,
  type AnchorPhrase,
  type AnchorPhraseSegment,
  type ConnectorKernel,
} from "./anchor-phrase";

export const ANCHOR_EDIT_GRID_BEATS = 0.25;

export interface AnchorEditPatch {
  degree?: number;
  octave?: number;
  startBeat?: number;
  durationBeats?: number;
  dynamics?: number;
}

export interface ConnectorEditPatch {
  bias?: number;
  color?: number;
  density?: number;
  kernel?: string;
  pull?: number;
  reach?: number;
  skew?: number;
}

export interface AnchorEditResult {
  changed: boolean;
  clamps: readonly string[];
  errors: readonly string[];
  phrase: AnchorPhrase;
  valid: boolean;
  warnings: readonly string[];
}

export function editConnectorInPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
  connectorIndex: number,
  patch: ConnectorEditPatch,
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return {
      changed: false,
      clamps,
      errors,
      phrase: basePhrase,
      valid: false,
      warnings,
    };
  }

  const segment = basePhrase.segments[segmentIndex];
  const connector = segment?.connectors[connectorIndex];
  if (!segment || !connector) {
    errors.push(`segments.${segmentIndex}.connectors.${connectorIndex} does not exist`);
    return {
      changed: false,
      clamps,
      errors,
      phrase: basePhrase,
      valid: false,
      warnings,
    };
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextConnector = nextPhrase.segments[segmentIndex].connectors[connectorIndex];
  const label = `segments.${segmentIndex}.connectors.${connectorIndex}`;

  if (patch.kernel !== undefined) {
    const kernel = readConnectorKernelPatch(patch.kernel, `${label}.kernel`, errors);
    if (!kernel) {
      return {
        changed: false,
        clamps,
        errors,
        phrase: basePhrase,
        valid: false,
        warnings,
      };
    }
    nextConnector.kernel = kernel;
  }
  if (patch.reach !== undefined) {
    nextConnector.reach = readNumberPatch(patch.reach, nextConnector.reach, 0, 1, `${label}.reach`, warnings, clamps);
  }
  if (patch.density !== undefined) {
    nextConnector.density = readNumberPatch(
      patch.density,
      nextConnector.density,
      0,
      1,
      `${label}.density`,
      warnings,
      clamps,
    );
  }
  if (patch.bias !== undefined) {
    nextConnector.bias = readNumberPatch(patch.bias, nextConnector.bias, -1, 1, `${label}.bias`, warnings, clamps);
  }
  if (patch.pull !== undefined) {
    nextConnector.pull = readNumberPatch(patch.pull, nextConnector.pull, 0, 1, `${label}.pull`, warnings, clamps);
  }
  if (patch.color !== undefined) {
    nextConnector.color = readNumberPatch(patch.color, nextConnector.color, 0, 1, `${label}.color`, warnings, clamps);
  }
  if (patch.skew !== undefined) {
    nextConnector.skew = readNumberPatch(patch.skew, nextConnector.skew, -1, 1, `${label}.skew`, warnings, clamps);
  }

  const nextResult = normalizeAnchorPhrase(nextPhrase);
  if (!nextResult.valid) {
    return {
      changed: false,
      clamps: [...clamps, ...nextResult.clamps],
      errors: nextResult.errors,
      phrase: basePhrase,
      valid: false,
      warnings: [...warnings, ...nextResult.warnings],
    };
  }

  return {
    changed: stableJson(basePhrase) !== stableJson(nextResult.phrase),
    clamps: [...clamps, ...nextResult.clamps],
    errors: [],
    phrase: nextResult.phrase,
    valid: true,
    warnings: [...warnings, ...nextResult.warnings],
  };
}

export function editAnchorInPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
  anchorIndex: number,
  patch: AnchorEditPatch,
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return {
      changed: false,
      clamps,
      errors,
      phrase: basePhrase,
      valid: false,
      warnings,
    };
  }

  const segment = basePhrase.segments[segmentIndex];
  const anchor = segment?.anchors[anchorIndex];
  if (!segment || !anchor) {
    errors.push(`segments.${segmentIndex}.anchors.${anchorIndex} does not exist`);
    return {
      changed: false,
      clamps,
      errors,
      phrase: basePhrase,
      valid: false,
      warnings,
    };
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextSegment = nextPhrase.segments[segmentIndex];
  const nextAnchor = nextSegment.anchors[anchorIndex];
  const bounds = getAnchorEditBounds(nextPhrase, segmentIndex, anchorIndex);
  const label = `segments.${segmentIndex}.anchors.${anchorIndex}`;

  if (patch.degree !== undefined) {
    nextAnchor.degree = readIntegerPatch(patch.degree, nextAnchor.degree, 1, 7, `${label}.degree`, warnings, clamps);
  }
  if (patch.octave !== undefined) {
    nextAnchor.octave = readIntegerPatch(patch.octave, nextAnchor.octave, 0, 8, `${label}.octave`, warnings, clamps);
  }
  if (patch.dynamics !== undefined) {
    nextAnchor.dynamics = readNumberPatch(patch.dynamics, nextAnchor.dynamics, 0, 1, `${label}.dynamics`, warnings, clamps);
  }

  const broadDuration = patch.durationBeats === undefined
    ? nextAnchor.durationBeats
    : readNumberPatch(
      patch.durationBeats,
      nextAnchor.durationBeats,
      ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      ANCHOR_PHRASE_CAPS.maxAnchorDurationBeats,
      `${label}.durationBeats`,
      warnings,
      clamps,
    );
  const requestedStart = patch.startBeat === undefined
    ? nextAnchor.startBeat
    : snapBeat(readNumberPatch(
      patch.startBeat,
      nextAnchor.startBeat,
      0,
      ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
      `${label}.startBeat`,
      warnings,
      clamps,
    ));

  if (patch.startBeat !== undefined && requestedStart !== patch.startBeat) {
    clamps.push(`${label}.startBeat snapped to ${roundTo(requestedStart, 4)}`);
  }

  const rawStartMaximum = Math.max(
    bounds.minimumStartBeat,
    bounds.maximumEndBeat - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
  );
  const gridMinimumStart = snapBeatUp(bounds.minimumStartBeat);
  const gridMaximumStart = snapBeatDown(rawStartMaximum);
  const startMinimum = gridMinimumStart <= gridMaximumStart ? gridMinimumStart : bounds.minimumStartBeat;
  const startMaximum = gridMinimumStart <= gridMaximumStart ? gridMaximumStart : rawStartMaximum;
  nextAnchor.startBeat = clampWithReport(
    requestedStart,
    startMinimum,
    startMaximum,
    `${label}.startBeat`,
    clamps,
  );

  const durationMaximum = Math.max(
    ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
    Math.min(ANCHOR_PHRASE_CAPS.maxAnchorDurationBeats, bounds.maximumEndBeat - nextAnchor.startBeat),
  );
  nextAnchor.durationBeats = clampWithReport(
    broadDuration,
    ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
    durationMaximum,
    `${label}.durationBeats`,
    clamps,
  );

  const nextResult = normalizeAnchorPhrase(nextPhrase);
  if (!nextResult.valid) {
    return {
      changed: false,
      clamps: [...clamps, ...nextResult.clamps],
      errors: nextResult.errors,
      phrase: basePhrase,
      valid: false,
      warnings: [...warnings, ...nextResult.warnings],
    };
  }

  return {
    changed: stableJson(basePhrase) !== stableJson(nextResult.phrase),
    clamps: [...clamps, ...nextResult.clamps],
    errors: [],
    phrase: nextResult.phrase,
    valid: true,
    warnings: [...warnings, ...nextResult.warnings],
  };
}

function readConnectorKernelPatch(value: string, label: string, errors: string[]): ConnectorKernel | undefined {
  if ((CONNECTOR_KERNELS as readonly string[]).includes(value)) {
    return value as ConnectorKernel;
  }
  errors.push(`${label} must be one of ${CONNECTOR_KERNELS.join(", ")}`);
  return undefined;
}

function getAnchorEditBounds(
  phrase: { segments: AnchorPhraseSegment[] },
  segmentIndex: number,
  anchorIndex: number,
): { maximumEndBeat: number; minimumStartBeat: number } {
  const segment = phrase.segments[segmentIndex];
  const previousAnchor = segment.anchors[anchorIndex - 1];
  const nextAnchor = segment.anchors[anchorIndex + 1];
  const previousSegment = phrase.segments[segmentIndex - 1];
  const nextSegment = phrase.segments[segmentIndex + 1];
  const minimumStartBeat = previousAnchor
    ? anchorEndBeat(previousAnchor)
    : previousSegment
    ? segmentEndBeat(previousSegment)
    : 0;
  const maximumEndBeat = nextAnchor
    ? nextAnchor.startBeat
    : nextSegment?.anchors[0]?.startBeat ?? ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats;
  return {
    maximumEndBeat: Math.max(minimumStartBeat + ANCHOR_PHRASE_CAPS.minAnchorDurationBeats, maximumEndBeat),
    minimumStartBeat,
  };
}

function cloneAnchorPhrase(phrase: AnchorPhrase): { segments: AnchorPhraseSegment[] } {
  return {
    segments: phrase.segments.map((segment) => ({
      anchors: segment.anchors.map((anchor) => ({ ...anchor })),
      connectors: segment.connectors.map((connector) => ({ ...connector })),
    })),
  };
}

function anchorEndBeat(anchor: Anchor): number {
  return roundTo(anchor.startBeat + anchor.durationBeats, 4);
}

function segmentEndBeat(segment: AnchorPhraseSegment): number {
  return Math.max(0, ...segment.anchors.map(anchorEndBeat));
}

function readIntegerPatch(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  return clampWithReport(Math.trunc(value), minimum, maximum, label, clamps);
}

function readNumberPatch(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  return clampWithReport(value, minimum, maximum, label, clamps);
}

function clampWithReport(value: number, minimum: number, maximum: number, label: string, clamps: string[]): number {
  const clamped = roundTo(Math.min(maximum, Math.max(minimum, value)), 4);
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${clamped}`);
  }
  return clamped;
}

function snapBeat(value: number): number {
  return roundTo(Math.round(value / ANCHOR_EDIT_GRID_BEATS) * ANCHOR_EDIT_GRID_BEATS, 4);
}

function snapBeatDown(value: number): number {
  return roundTo(Math.floor(value / ANCHOR_EDIT_GRID_BEATS) * ANCHOR_EDIT_GRID_BEATS, 4);
}

function snapBeatUp(value: number): number {
  return roundTo(Math.ceil(value / ANCHOR_EDIT_GRID_BEATS) * ANCHOR_EDIT_GRID_BEATS, 4);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
