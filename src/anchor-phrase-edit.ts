import {
  ANCHOR_PHRASE_CAPS,
  CONNECTOR_KERNELS,
  normalizeAnchorPhrase,
  type Anchor,
  type AnchorPhrase,
  type AnchorPhraseSegment,
  type Connector,
  type ConnectorKernel,
} from "./anchor-phrase";

export const ANCHOR_EDIT_GRID_BEATS = 0.25;
const DEFAULT_STRUCTURAL_CONNECTOR = {
  kernel: "fill" as const,
  reach: 0.5,
  density: 0.5,
  bias: 0,
  pull: 0.5,
  color: 0,
  skew: 0,
};
const DEFAULT_STRUCTURAL_BREATH_BEATS = 0.5;

interface MutableAnchorPhrase {
  segments: MutableAnchorPhraseSegment[];
}

interface MutableAnchorPhraseSegment {
  anchors: Anchor[];
  connectors: Connector[];
}

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

export interface AddAnchorOptions {
  degree?: number;
  octave?: number;
  durationBeats?: number;
  dynamics?: number;
}

export function addAnchorToPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
  atBeat: number,
  options: AddAnchorOptions = {},
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  if (countAnchors(basePhrase) >= ANCHOR_PHRASE_CAPS.maxAnchors) {
    errors.push(`anchors cannot exceed ${ANCHOR_PHRASE_CAPS.maxAnchors}`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const segment = basePhrase.segments[segmentIndex];
  if (!segment) {
    errors.push(`segments.${segmentIndex} does not exist`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextSegment = nextPhrase.segments[segmentIndex];
  const label = `segments.${segmentIndex}.anchors.new`;
  const requestedBeat = snapBeat(readNumberPatch(
    atBeat,
    nextSegment.anchors[nextSegment.anchors.length - 1]?.startBeat ?? 0,
    0,
    ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
    `${label}.startBeat`,
    warnings,
    clamps,
  ));
  if (requestedBeat !== atBeat) {
    clamps.push(`${label}.startBeat snapped to ${roundTo(requestedBeat, 4)}`);
  }

  const insertIndex = findAnchorInsertIndex(nextSegment, requestedBeat);
  const previousAnchor = nextSegment.anchors[insertIndex - 1];
  const nextAnchor = nextSegment.anchors[insertIndex];
  const previousSegment = insertIndex === 0 ? nextPhrase.segments[segmentIndex - 1] : undefined;
  const followingSegment = insertIndex === nextSegment.anchors.length ? nextPhrase.segments[segmentIndex + 1] : undefined;
  const minimumStart = previousAnchor
    ? anchorEndBeat(previousAnchor)
    : previousSegment
    ? segmentEndBeat(previousSegment)
    : 0;
  const maximumEnd = nextAnchor
    ? nextAnchor.startBeat
    : followingSegment?.anchors[0]?.startBeat ?? ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats;
  if (maximumEnd - minimumStart < ANCHOR_PHRASE_CAPS.minAnchorDurationBeats) {
    errors.push(`${label} has no room between neighbouring anchors`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const snappedMinimum = snapBeatUp(minimumStart);
  const snappedMaximum = snapBeatDown(maximumEnd - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats);
  const startMinimum = snappedMinimum <= snappedMaximum ? snappedMinimum : minimumStart;
  const startMaximum = snappedMinimum <= snappedMaximum
    ? snappedMaximum
    : maximumEnd - ANCHOR_PHRASE_CAPS.minAnchorDurationBeats;
  const startBeat = clampWithReport(requestedBeat, startMinimum, startMaximum, `${label}.startBeat`, clamps);
  const availableDuration = maximumEnd - startBeat;
  const defaultDuration = Math.min(0.5, Math.max(ANCHOR_PHRASE_CAPS.minAnchorDurationBeats, availableDuration));
  const durationBeats = clampWithReport(
    options.durationBeats === undefined
      ? defaultDuration
      : readNumberPatch(
        options.durationBeats,
        defaultDuration,
        ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
        ANCHOR_PHRASE_CAPS.maxAnchorDurationBeats,
        `${label}.durationBeats`,
        warnings,
        clamps,
      ),
    ANCHOR_PHRASE_CAPS.minAnchorDurationBeats,
    Math.min(ANCHOR_PHRASE_CAPS.maxAnchorDurationBeats, availableDuration),
    `${label}.durationBeats`,
    clamps,
  );
  const anchor = createInterpolatedAnchor(previousAnchor, nextAnchor, {
    degree: options.degree,
    durationBeats,
    dynamics: options.dynamics,
    octave: options.octave,
    startBeat,
  }, warnings, clamps, label);

  nextSegment.anchors.splice(insertIndex, 0, anchor);
  spliceConnectorForAddedAnchor(nextSegment, insertIndex);

  return normalizedEditResult(basePhrase, nextPhrase, errors, warnings, clamps);
}

export function removeAnchorFromPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
  anchorIndex: number,
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }
  if (countAnchors(basePhrase) <= 1) {
    errors.push("AnchorPhrase must keep at least one anchor");
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const segment = basePhrase.segments[segmentIndex];
  const anchor = segment?.anchors[anchorIndex];
  if (!segment || !anchor) {
    errors.push(`segments.${segmentIndex}.anchors.${anchorIndex} does not exist`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextSegment = nextPhrase.segments[segmentIndex];
  if (nextSegment.anchors.length === 1) {
    nextPhrase.segments.splice(segmentIndex, 1);
  } else {
    nextSegment.anchors.splice(anchorIndex, 1);
    const connectorIndex = Math.min(anchorIndex, nextSegment.connectors.length - 1);
    nextSegment.connectors.splice(Math.max(0, connectorIndex), 1);
  }

  return normalizedEditResult(basePhrase, nextPhrase, errors, warnings, clamps);
}

export function splitSegmentInPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
  anchorIndex: number,
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }
  if (basePhrase.segments.length >= ANCHOR_PHRASE_CAPS.maxSegments) {
    errors.push(`segments cannot exceed ${ANCHOR_PHRASE_CAPS.maxSegments}`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const segment = basePhrase.segments[segmentIndex];
  if (!segment) {
    errors.push(`segments.${segmentIndex} does not exist`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }
  if (anchorIndex <= 0 || anchorIndex >= segment.anchors.length) {
    errors.push(`segments.${segmentIndex}.anchors.${anchorIndex} cannot start a split segment`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const phraseEnd = anchorPhraseEndBeat(basePhrase);
  const shiftBeats = Math.min(DEFAULT_STRUCTURAL_BREATH_BEATS, ANCHOR_PHRASE_CAPS.maxPhraseLengthBeats - phraseEnd);
  if (shiftBeats <= 0) {
    errors.push("AnchorPhrase has no room to open a breath");
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextSegment = nextPhrase.segments[segmentIndex];
  const firstSegment: MutableAnchorPhraseSegment = {
    anchors: nextSegment.anchors.slice(0, anchorIndex),
    connectors: nextSegment.connectors.slice(0, Math.max(0, anchorIndex - 1)),
  };
  const secondSegment: MutableAnchorPhraseSegment = {
    anchors: nextSegment.anchors.slice(anchorIndex).map((anchor) => ({
      ...anchor,
      startBeat: roundTo(anchor.startBeat + shiftBeats, 4),
    })),
    connectors: nextSegment.connectors.slice(anchorIndex).map((connector) => ({ ...connector })),
  };
  nextPhrase.segments.splice(segmentIndex, 1, firstSegment, secondSegment);
  for (let index = segmentIndex + 2; index < nextPhrase.segments.length; index += 1) {
    nextPhrase.segments[index] = shiftSegment(nextPhrase.segments[index], shiftBeats);
  }

  return normalizedEditResult(basePhrase, nextPhrase, errors, warnings, clamps);
}

export function joinSegmentsInPhrase(
  phrase: AnchorPhrase,
  segmentIndex: number,
): AnchorEditResult {
  const baseResult = normalizeAnchorPhrase(phrase);
  const basePhrase = baseResult.phrase;
  const errors: string[] = [...baseResult.errors];
  const warnings: string[] = [...baseResult.warnings];
  const clamps: string[] = [...baseResult.clamps];

  if (!baseResult.valid) {
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const first = basePhrase.segments[segmentIndex];
  const second = basePhrase.segments[segmentIndex + 1];
  if (!first || !second) {
    errors.push(`segments.${segmentIndex} has no following segment to join`);
    return unchangedResult(basePhrase, false, errors, warnings, clamps);
  }

  const nextPhrase = cloneAnchorPhrase(basePhrase);
  const nextFirst = nextPhrase.segments[segmentIndex];
  const nextSecond = nextPhrase.segments[segmentIndex + 1];
  const joinedSegment: MutableAnchorPhraseSegment = {
    anchors: [...nextFirst.anchors, ...nextSecond.anchors],
    connectors: [
      ...nextFirst.connectors,
      createDefaultConnector(),
      ...nextSecond.connectors,
    ],
  };
  nextPhrase.segments.splice(segmentIndex, 2, joinedSegment);

  return normalizedEditResult(basePhrase, nextPhrase, errors, warnings, clamps);
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

function cloneAnchorPhrase(phrase: AnchorPhrase): MutableAnchorPhrase {
  return {
    segments: phrase.segments.map((segment) => ({
      anchors: segment.anchors.map((anchor) => ({ ...anchor })),
      connectors: segment.connectors.map((connector) => ({ ...connector })),
    })),
  };
}

function unchangedResult(
  phrase: AnchorPhrase,
  valid: boolean,
  errors: string[],
  warnings: string[],
  clamps: string[],
): AnchorEditResult {
  return {
    changed: false,
    clamps,
    errors,
    phrase,
    valid,
    warnings,
  };
}

function normalizedEditResult(
  basePhrase: AnchorPhrase,
  nextPhrase: MutableAnchorPhrase,
  errors: string[],
  warnings: string[],
  clamps: string[],
): AnchorEditResult {
  const nextResult = normalizeAnchorPhrase(nextPhrase);
  if (!nextResult.valid) {
    return {
      changed: false,
      clamps: [...clamps, ...nextResult.clamps],
      errors: [...errors, ...nextResult.errors],
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

function countAnchors(phrase: AnchorPhrase): number {
  return phrase.segments.reduce((sum, segment) => sum + segment.anchors.length, 0);
}

function findAnchorInsertIndex(segment: MutableAnchorPhraseSegment, atBeat: number): number {
  const index = segment.anchors.findIndex((anchor) => anchor.startBeat > atBeat);
  return index === -1 ? segment.anchors.length : index;
}

function createInterpolatedAnchor(
  previousAnchor: Anchor | undefined,
  nextAnchor: Anchor | undefined,
  values: {
    degree?: number;
    durationBeats: number;
    dynamics?: number;
    octave?: number;
    startBeat: number;
  },
  warnings: string[],
  clamps: string[],
  label: string,
): Anchor {
  const fallbackDegree = previousAnchor && nextAnchor
    ? Math.round((previousAnchor.degree + nextAnchor.degree) / 2)
    : previousAnchor?.degree ?? nextAnchor?.degree ?? 1;
  const fallbackOctave = previousAnchor && nextAnchor
    ? Math.round((previousAnchor.octave + nextAnchor.octave) / 2)
    : previousAnchor?.octave ?? nextAnchor?.octave ?? 4;
  const fallbackDynamics = previousAnchor && nextAnchor
    ? roundTo((previousAnchor.dynamics + nextAnchor.dynamics) / 2, 4)
    : previousAnchor?.dynamics ?? nextAnchor?.dynamics ?? 0.62;
  return {
    degree: values.degree === undefined
      ? clampWithReport(fallbackDegree, 1, 7, `${label}.degree`, clamps)
      : readIntegerPatch(values.degree, fallbackDegree, 1, 7, `${label}.degree`, warnings, clamps),
    durationBeats: values.durationBeats,
    dynamics: values.dynamics === undefined
      ? clampWithReport(fallbackDynamics, 0, 1, `${label}.dynamics`, clamps)
      : readNumberPatch(values.dynamics, fallbackDynamics, 0, 1, `${label}.dynamics`, warnings, clamps),
    octave: values.octave === undefined
      ? clampWithReport(fallbackOctave, 0, 8, `${label}.octave`, clamps)
      : readIntegerPatch(values.octave, fallbackOctave, 0, 8, `${label}.octave`, warnings, clamps),
    startBeat: values.startBeat,
  };
}

function spliceConnectorForAddedAnchor(segment: MutableAnchorPhraseSegment, insertIndex: number): void {
  if (segment.anchors.length <= 1) return;
  if (insertIndex <= 0) {
    segment.connectors.splice(0, 0, createDefaultConnector());
    return;
  }
  if (insertIndex >= segment.anchors.length - 1) {
    segment.connectors.splice(segment.connectors.length, 0, createDefaultConnector());
    return;
  }
  segment.connectors.splice(insertIndex - 1, 1, { ...segment.connectors[insertIndex - 1] }, createDefaultConnector());
}

function createDefaultConnector(): Connector {
  return { ...DEFAULT_STRUCTURAL_CONNECTOR };
}

function shiftSegment(segment: MutableAnchorPhraseSegment, shiftBeats: number): MutableAnchorPhraseSegment {
  return {
    anchors: segment.anchors.map((anchor) => ({
      ...anchor,
      startBeat: roundTo(anchor.startBeat + shiftBeats, 4),
    })),
    connectors: segment.connectors.map((connector) => ({ ...connector })),
  };
}

function anchorPhraseEndBeat(phrase: AnchorPhrase): number {
  return Math.max(0, ...phrase.segments.map(segmentEndBeat));
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
