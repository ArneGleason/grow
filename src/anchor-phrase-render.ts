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
  durationBeats: number;
  octave: number;
  scaleDegree: number;
  startBeat: number;
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
      ],
      connectors: [
        { kernel: "approach", reach: 0.55, density: 0.8, bias: -0.55, pull: 0.85, color: 0, skew: 0.2 },
      ],
    },
  ],
};

export const KERNEL_RENDERERS: Record<ConnectorKernel, KernelRenderFn> = {
  fill: renderFillConnector,
  detour: renderDetourConnector,
  approach: renderApproachConnector,
  orbit: renderFillConnector,
  skip: () => [],
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
  return {
    durationBeats: roundBeat(Math.min(context.subdivisionBeats * 0.86, maximumDuration)),
    octave: options.octave,
    scaleDegree: options.scaleDegree,
    startBeat,
    velocity: roundVelocity(averageDynamics * ghostFactor + (options.velocityBoost ?? 0)),
  };
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
    scaleDegree: Math.trunc(note.scaleDegree),
    octave: finiteOctave(note.octave, baseOctave),
    duration: beatsToBarsBeatsSixteenths(note.durationBeats),
    durationBeats: roundBeat(note.durationBeats),
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
