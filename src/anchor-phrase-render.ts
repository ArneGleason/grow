import {
  CONNECTOR_KERNELS,
  normalizeAnchorPhrase,
  type Anchor,
  type AnchorPhrase,
  type Connector,
  type ConnectorKernel,
} from "./anchor-phrase";
import type { PatternNoteSource, PlayerPatternSource } from "./song-material";

export interface AnchorPhraseRenderOptions {
  baseOctave?: number;
  playerId?: string;
  subdivisionBeats?: number;
}

export interface ConnectorRenderContext {
  connector: Connector;
  connectorIndex: number;
  from: Anchor;
  to: Anchor;
  subdivisionBeats: number;
}

export interface ConnectorRenderedNote {
  chromaticOffsetSemitones?: number;
  durationBeats: number;
  octave: number;
  scaleDegree: number;
  startBeat: number;
  tags?: readonly string[];
  velocity: number;
}

export type KernelRenderFn = (context: ConnectorRenderContext) => readonly ConnectorRenderedNote[];

export const ANCHOR_CONNECTOR_NOTE_BUDGET = 16;
const DEFAULT_SUBDIVISION_BEATS = 0.25;
const DEFAULT_BASE_OCTAVE = 4;
const DEFAULT_PLAYER_ID = "melody";
const MIN_SUBDIVISION_BEATS = 0.125;
const MAX_SUBDIVISION_BEATS = 4;

export const DEMO_ANCHOR_PHRASE: AnchorPhrase = {
  segments: [
    {
      anchors: [
        { degree: 1, octave: 4, startBeat: 0, durationBeats: 0.75, dynamics: 0.72 },
        { degree: 5, octave: 4, startBeat: 2, durationBeats: 0.75, dynamics: 0.68 },
        { degree: 3, octave: 5, startBeat: 4, durationBeats: 1, dynamics: 0.74 },
      ],
      connectors: [
        { kernel: "fill", reach: 0.45, density: 0.78, bias: 0, pull: 0.5, color: 0, skew: -0.1 },
        { kernel: "detour", reach: 0.7, density: 0.48, bias: 0.6, pull: 0.45, color: 0, skew: 0.15 },
      ],
    },
    {
      anchors: [
        { degree: 2, octave: 4, startBeat: 8, durationBeats: 0.5, dynamics: 0.52 },
        { degree: 1, octave: 4, startBeat: 10, durationBeats: 1.5, dynamics: 0.76 },
        { degree: 4, octave: 4, startBeat: 13, durationBeats: 0.5, dynamics: 0.58 },
        { degree: 1, octave: 4, startBeat: 15, durationBeats: 1, dynamics: 0.78 },
      ],
      connectors: [
        { kernel: "approach", reach: 0.55, density: 0.8, bias: -0.55, pull: 0.85, color: 0, skew: 0.2 },
        { kernel: "orbit", reach: 0.9, density: 0.72, bias: 0.65, pull: 0.5, color: 0, skew: -0.12 },
        { kernel: "skip", reach: 0.35, density: 0.62, bias: -0.35, pull: 0.45, color: 0, skew: 0.1 },
      ],
    },
  ],
};

export const KERNEL_RENDERERS: Record<ConnectorKernel, KernelRenderFn> = {
  fill: renderFillConnector,
  detour: renderDetourConnector,
  approach: renderApproachConnector,
  orbit: renderOrbitConnector,
  skip: renderSkipConnector,
};

export function renderAnchorPhrase(
  phrase: AnchorPhrase,
  options: AnchorPhraseRenderOptions = {},
): PlayerPatternSource {
  const subdivisionBeats = clamp(
    options.subdivisionBeats ?? DEFAULT_SUBDIVISION_BEATS,
    MIN_SUBDIVISION_BEATS,
    MAX_SUBDIVISION_BEATS,
  );
  const baseOctave = Math.trunc(clamp(options.baseOctave ?? DEFAULT_BASE_OCTAVE, 0, 8));
  const playerId = options.playerId ?? DEFAULT_PLAYER_ID;
  const normalized = normalizeAnchorPhrase(phrase).phrase;
  const totalBeats = phraseEndBeat(normalized);
  const steps = Math.max(1, Math.ceil(totalBeats / subdivisionBeats));
  const rendered = new Array<PatternNoteSource | null>(steps).fill(null);

  for (const segment of normalized.segments) {
    for (let index = 0; index < segment.connectors.length; index += 1) {
      const connector = segment.connectors[index];
      const from = segment.anchors[index];
      const to = segment.anchors[index + 1];
      const notes = KERNEL_RENDERERS[connector.kernel]({
        connector,
        connectorIndex: index,
        from,
        to,
        subdivisionBeats,
      });
      for (const note of notes) {
        placeNote(rendered, note, playerId, subdivisionBeats, baseOctave);
      }
    }
  }

  for (const segment of normalized.segments) {
    for (const anchor of segment.anchors) {
      placeNote(
        rendered,
        {
          durationBeats: anchor.durationBeats,
          octave: finiteOctave(anchor.octave, baseOctave),
          scaleDegree: languageDegreeToEngineDegree(anchor.degree),
          startBeat: snapBeat(anchor.startBeat, subdivisionBeats),
          velocity: anchor.dynamics,
        },
        playerId,
        subdivisionBeats,
        baseOctave,
      );
    }
  }

  return {
    subdivisionBeats,
    events: rendered,
  };
}

export function renderDemoAnchorPhrase(options: AnchorPhraseRenderOptions = {}): PlayerPatternSource {
  return renderAnchorPhrase(DEMO_ANCHOR_PHRASE, options);
}

function renderFillConnector(context: ConnectorRenderContext): readonly ConnectorRenderedNote[] {
  const slots = connectorSlots(context);
  const count = densityCount(slots.length, context.connector.density);
  const selectedSlots = selectEvenSlots(slots, count, context.connector.skew);
  const fromDegree = languageDegreeToEngineDegree(context.from.degree);
  const toDegree = languageDegreeToEngineDegree(context.to.degree);
  return selectedSlots.map((startBeat, index) => {
    const progress = selectedSlots.length === 1 ? 0.5 : (index + 1) / (selectedSlots.length + 1);
    return connectorNote(context, startBeat, {
      scaleDegree: Math.round(lerp(fromDegree, toDegree, progress)),
      octave: Math.round(lerp(context.from.octave, context.to.octave, progress)),
      progress,
    });
  });
}

function renderApproachConnector(context: ConnectorRenderContext): readonly ConnectorRenderedNote[] {
  const slots = connectorSlots(context);
  const count = Math.min(slots.length, Math.min(2, Math.max(1, Math.round(1 + context.connector.density))));
  const selectedSlots = selectApproachSlots(slots, count, context.connector.pull, context.connector.skew);
  const targetDegree = languageDegreeToEngineDegree(context.to.degree);
  const reach = Math.max(1, Math.round(1 + context.connector.reach * 3));
  return selectedSlots.map((startBeat, index) => {
    const scaleDegree = approachDegree(
      targetDegree,
      reach,
      context.connector.bias,
      index,
      selectedSlots.length,
      context.connectorIndex,
    );
    const progress = selectedSlots.length === 1 ? 0.72 : (index + 1) / (selectedSlots.length + 1);
    return connectorNote(context, startBeat, {
      scaleDegree,
      octave: Math.round(lerp(context.from.octave, context.to.octave, progress)),
      progress,
      velocityBoost: 0.08 + context.connector.pull * 0.16,
    });
  });
}

function renderDetourConnector(context: ConnectorRenderContext): readonly ConnectorRenderedNote[] {
  const slots = connectorSlots(context);
  const count = Math.min(slots.length, Math.max(1, densityCount(slots.length, context.connector.density)));
  const selectedSlots = selectEvenSlots(slots, count, context.connector.skew);
  const fromDegree = languageDegreeToEngineDegree(context.from.degree);
  const toDegree = languageDegreeToEngineDegree(context.to.degree);
  const direction = context.connector.bias < 0 ? -1 : 1;
  const detourDistance = Math.max(1, Math.round(1 + context.connector.reach * 4));
  const departureDegree = fromDegree + direction * detourDistance;
  return selectedSlots.map((startBeat, index) => {
    const progress = selectedSlots.length === 1 ? 0.48 : index / Math.max(1, selectedSlots.length - 1);
    return connectorNote(context, startBeat, {
      scaleDegree: Math.round(lerp(departureDegree, toDegree, progress)),
      octave: Math.round(lerp(context.from.octave, context.to.octave, (index + 1) / (selectedSlots.length + 1))),
      progress,
    });
  });
}

function renderOrbitConnector(context: ConnectorRenderContext): readonly ConnectorRenderedNote[] {
  const slots = connectorSlots(context);
  const count = Math.min(slots.length, Math.max(1, densityCount(slots.length, context.connector.density)));
  const selectedSlots = selectEvenSlots(slots, count, context.connector.skew);
  const fromDegree = languageDegreeToEngineDegree(context.from.degree);
  const reach = Math.max(1, Math.round(context.connector.reach));
  let direction = leadingOrbitDirection(context.connector.bias, context.connectorIndex);
  return selectedSlots.map((startBeat, index) => {
    if (index > 0) {
      direction *= -1;
    }
    return connectorNote(context, startBeat, {
      scaleDegree: fromDegree + direction * reach,
      octave: context.from.octave,
      progress: selectedSlots.length === 1 ? 0.5 : index / Math.max(1, selectedSlots.length - 1),
    });
  });
}

function renderSkipConnector(context: ConnectorRenderContext): readonly ConnectorRenderedNote[] {
  const slots = connectorSlots(context);
  const count = Math.min(slots.length, Math.max(1, densityCount(slots.length, context.connector.density)));
  const selectedSlots = selectEvenSlots(slots, count, context.connector.skew);
  const fromDegree = languageDegreeToEngineDegree(context.from.degree);
  const toDegree = languageDegreeToEngineDegree(context.to.degree);
  const direction = skipDirection(fromDegree, toDegree, context.connector.bias);
  const palette = skipDegreePalette(fromDegree, toDegree, direction, context.connector.reach, context.connector.bias);
  return selectedSlots.map((startBeat, index) => {
    const progress = selectedSlots.length === 1 ? 0.5 : (index + 1) / (selectedSlots.length + 1);
    const paletteIndex = skipPaletteIndex(index, selectedSlots.length, palette.length, context.connector.bias);
    return connectorNote(context, startBeat, {
      scaleDegree: palette[paletteIndex] ?? fromDegree + direction * 2,
      octave: Math.round(lerp(context.from.octave, context.to.octave, progress)),
      progress,
    });
  });
}

function connectorSlots(context: ConnectorRenderContext): readonly number[] {
  const fromEndBeat = context.from.startBeat + context.from.durationBeats;
  const toStartBeat = context.to.startBeat;
  if (toStartBeat <= fromEndBeat) return [];
  const firstIndex = Math.floor(fromEndBeat / context.subdivisionBeats) + 1;
  const lastIndex = Math.ceil((toStartBeat - 0.000001) / context.subdivisionBeats);
  const slots: number[] = [];
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const beat = roundBeat(index * context.subdivisionBeats);
    if (beat >= fromEndBeat && beat < toStartBeat) {
      slots.push(beat);
    }
  }
  return slots.slice(0, Math.min(slots.length, ANCHOR_CONNECTOR_NOTE_BUDGET));
}

function densityCount(slotCount: number, density: number): number {
  if (slotCount <= 0) return 0;
  return Math.min(slotCount, Math.max(0, Math.round(slotCount * clamp01(density))));
}

function selectEvenSlots(
  slots: readonly number[],
  count: number,
  skew: number,
): readonly number[] {
  return selectSlots(slots, count, (index, total) => {
    const base = total === 1 ? 0.5 : index / Math.max(1, total - 1);
    return clamp01(base + clamp(skew, -1, 1) * 0.22);
  });
}

function selectApproachSlots(
  slots: readonly number[],
  count: number,
  pull: number,
  skew: number,
): readonly number[] {
  return selectSlots(slots, count, (index, total) => {
    const lateWindow = 0.35 + (1 - clamp01(pull)) * 0.45;
    const base = 1 - lateWindow + ((index + 1) / (total + 1)) * lateWindow;
    return clamp01(base + clamp(skew, -1, 1) * 0.12);
  });
}

function selectSlots(
  slots: readonly number[],
  count: number,
  positionFor: (index: number, total: number) => number,
): readonly number[] {
  if (slots.length === 0 || count <= 0) return [];
  if (count >= slots.length) return [...slots];
  const selectedIndexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const targetIndex = Math.round(positionFor(index, count) * (slots.length - 1));
    selectedIndexes.push(nearestUnusedIndex(targetIndex, slots.length, selectedIndexes));
  }
  return selectedIndexes
    .sort((left, right) => left - right)
    .map((slotIndex) => slots[slotIndex]);
}

function nearestUnusedIndex(targetIndex: number, length: number, usedIndexes: readonly number[]): number {
  const used = new Set(usedIndexes);
  const boundedTarget = Math.trunc(clamp(targetIndex, 0, length - 1));
  if (!used.has(boundedTarget)) return boundedTarget;
  for (let distance = 1; distance < length; distance += 1) {
    const left = boundedTarget - distance;
    if (left >= 0 && !used.has(left)) return left;
    const right = boundedTarget + distance;
    if (right < length && !used.has(right)) return right;
  }
  return boundedTarget;
}

function approachDegree(
  targetDegree: number,
  reach: number,
  bias: number,
  index: number,
  count: number,
  connectorIndex: number,
): number {
  if (bias < -0.25) {
    return count === 1 ? targetDegree - 1 : targetDegree - Math.max(1, reach - index);
  }
  if (bias > 0.25) {
    return count === 1 ? targetDegree + 1 : targetDegree + Math.max(1, reach - index);
  }
  const direction = (index + connectorIndex) % 2 === 0 ? -1 : 1;
  return targetDegree + direction * Math.max(1, index === 0 ? reach : 1);
}

function leadingOrbitDirection(bias: number, connectorIndex: number): 1 | -1 {
  if (bias > 0.2) return 1;
  if (bias < -0.2) return -1;
  return connectorIndex % 2 === 0 ? 1 : -1;
}

function skipDirection(fromDegree: number, toDegree: number, bias: number): 1 | -1 {
  if (toDegree > fromDegree) return 1;
  if (toDegree < fromDegree) return -1;
  return bias < 0 ? -1 : 1;
}

function skipDegreePalette(
  fromDegree: number,
  toDegree: number,
  direction: 1 | -1,
  reach: number,
  bias: number,
): readonly number[] {
  const leapSize = 2;
  const degrees: number[] = [];
  const distance = Math.abs(toDegree - fromDegree);
  const leapCount = Math.max(1, Math.ceil(distance / leapSize));
  for (let index = 1; index <= leapCount; index += 1) {
    degrees.push(fromDegree + direction * index * leapSize);
  }
  if (reach > 0.66) {
    degrees.push(toDegree + direction * leapSize);
  }
  if (Math.abs(bias) > 0.55) {
    degrees.push(fromDegree + (bias > 0 ? 1 : -1) * leapSize);
  }
  return uniqueNumbers(degrees);
}

function skipPaletteIndex(index: number, count: number, paletteLength: number, bias: number): number {
  if (paletteLength <= 1) return 0;
  const orderedIndex = bias < -0.25 ? count - 1 - index : index;
  if (count <= paletteLength) {
    return Math.min(paletteLength - 1, Math.round((orderedIndex / Math.max(1, count - 1)) * (paletteLength - 1)));
  }
  return Math.abs(orderedIndex) % paletteLength;
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function connectorNote(
  context: ConnectorRenderContext,
  startBeat: number,
  options: {
    octave: number;
    progress: number;
    scaleDegree: number;
    velocityBoost?: number;
  },
): ConnectorRenderedNote {
  const maximumDuration = Math.max(
    0.0625,
    context.to.startBeat - startBeat,
  );
  const averageDynamics = (context.from.dynamics + context.to.dynamics) / 2;
  const ghostFactor = 0.34 + context.connector.density * 0.18 + context.connector.pull * 0.08;
  const chromaticOffsetSemitones = connectorChromaticOffset(context, options.scaleDegree, options.progress);
  const tags = chromaticOffsetSemitones === 0
    ? undefined
    : [
      "connector:color",
      "connector:chromatic",
      `chromatic:${chromaticOffsetSemitones > 0 ? "+" : ""}${chromaticOffsetSemitones}`,
    ];
  return {
    chromaticOffsetSemitones,
    durationBeats: roundBeat(Math.min(context.subdivisionBeats * 0.86, maximumDuration)),
    octave: options.octave,
    scaleDegree: options.scaleDegree,
    startBeat,
    tags,
    velocity: roundVelocity(averageDynamics * ghostFactor + (options.velocityBoost ?? 0)),
  };
}

function connectorChromaticOffset(
  context: ConnectorRenderContext,
  scaleDegree: number,
  progress: number,
): -1 | 0 | 1 {
  const color = clamp01(context.connector.color);
  if (color < 0.5) return 0;

  const roundedPhase = Math.round(progress * 8);
  const shouldColor = color >= 0.9 || (roundedPhase + context.connectorIndex) % 2 === 0;
  if (!shouldColor) return 0;

  const fromDegree = languageDegreeToEngineDegree(context.from.degree);
  const toDegree = languageDegreeToEngineDegree(context.to.degree);
  const degreeClass = positiveModulo(scaleDegree, 7);

  if (color >= 0.9) {
    if (degreeClass === 2 || degreeClass === 4 || degreeClass === 6) return -1;
    return context.connector.bias > 0.65 ? 1 : -1;
  }

  const targetDirection = toDegree >= scaleDegree ? 1 : -1;
  if (context.connector.kernel === "approach") return targetDirection;
  if (Math.abs(toDegree - scaleDegree) <= Math.abs(scaleDegree - fromDegree)) return targetDirection;
  return context.connector.bias >= 0 ? 1 : -1;
}

function placeNote(
  events: Array<PatternNoteSource | null>,
  note: ConnectorRenderedNote,
  playerId: string,
  subdivisionBeats: number,
  baseOctave: number,
): void {
  const index = Math.round(snapBeat(note.startBeat, subdivisionBeats) / subdivisionBeats);
  if (index < 0 || index >= events.length) return;
  events[index] = {
    playerId,
    ...(note.chromaticOffsetSemitones ? { chromaticOffsetSemitones: note.chromaticOffsetSemitones } : {}),
    scaleDegree: Math.trunc(note.scaleDegree),
    octave: finiteOctave(note.octave, baseOctave),
    duration: beatsToBarsBeatsSixteenths(note.durationBeats),
    durationBeats: roundBeat(note.durationBeats),
    ...(note.tags ? { tags: [...note.tags] } : {}),
    velocity: roundVelocity(note.velocity),
  };
}

function phraseEndBeat(phrase: AnchorPhrase): number {
  let endBeat = 0;
  for (const segment of phrase.segments) {
    for (const anchor of segment.anchors) {
      endBeat = Math.max(endBeat, anchor.startBeat + anchor.durationBeats);
    }
  }
  return roundBeat(Math.max(endBeat, DEFAULT_SUBDIVISION_BEATS));
}

function languageDegreeToEngineDegree(degree: number): number {
  return Math.trunc(degree) - 1;
}

function finiteOctave(octave: number, fallback: number): number {
  return Math.trunc(Number.isFinite(octave) ? octave : fallback);
}

function positiveModulo(value: number, length: number): number {
  return ((Math.trunc(value) % length) + length) % length;
}

function snapBeat(beat: number, subdivisionBeats: number): number {
  return roundBeat(Math.round(beat / subdivisionBeats) * subdivisionBeats);
}

function beatsToBarsBeatsSixteenths(beats: number): string {
  const totalSixteenths = Math.max(1, Math.round(beats * 4));
  const bars = Math.floor(totalSixteenths / 16);
  const remainder = totalSixteenths % 16;
  const wholeBeats = Math.floor(remainder / 4);
  const sixteenths = remainder % 4;
  return `${bars}:${wholeBeats}:${sixteenths}`;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * clamp01(progress);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function roundBeat(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundVelocity(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000) / 1_000;
}

export function connectorKernels(): readonly ConnectorKernel[] {
  return CONNECTOR_KERNELS;
}
