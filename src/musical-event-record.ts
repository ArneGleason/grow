import type { MusicalEvent, TonalContext } from "./listening";

export const MUSICAL_EVENT_RECORD_SCHEMA_VERSION = 1;

export interface MusicalEventPitchRecord {
  pitch?: string;
  pitchClass?: string;
  octave?: number;
  scaleDegree?: number;
}

export interface MusicalEventRecordGrid extends MusicalEventPitchRecord {
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
}

export interface MusicalEventRecordPerformed extends MusicalEventPitchRecord {
  offsetBeats: number;
  offsetSeconds: number;
  sounded: boolean;
  pitchChanged: boolean;
  registerShift?: number;
}

export interface MusicalEventRecordPayload {
  schemaVersion: typeof MUSICAL_EVENT_RECORD_SCHEMA_VERSION;
  sourceEventId: string;
  kind: MusicalEvent["kind"];
  playerId: string;
  instrumentId: string;
  eventIndex: number;
  durationBeats: number;
  velocity: number;
  grid: MusicalEventRecordGrid;
  performed: MusicalEventRecordPerformed;
  expression?: MusicalEvent["expression"];
  performedTiming?: MusicalEvent["performedTiming"];
  tags: readonly string[];
  createdAtMs: number;
}

export interface MusicalEventPersistenceRecord {
  type: "musical.event_recorded";
  actorId: string;
  beat: number;
  payload: MusicalEventRecordPayload;
}

export interface MusicalEventRecordBufferState {
  capacity: number;
  pendingCount: number;
  enqueuedCount: number;
  drainedCount: number;
  droppedCount: number;
  lastDroppedEventId?: string;
}

export interface MusicalEventRecordBufferEnqueueResult {
  record: MusicalEventPersistenceRecord;
  dropped?: MusicalEventPersistenceRecord;
  state: MusicalEventRecordBufferState;
}

export class MusicalEventRecordBuffer {
  private readonly records: Array<MusicalEventPersistenceRecord | undefined>;
  private head = 0;
  private pendingCount = 0;
  private enqueuedCount = 0;
  private drainedCount = 0;
  private droppedCount = 0;
  private lastDroppedEventId: string | undefined;

  constructor(readonly capacity = 256) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("MusicalEventRecordBuffer capacity must be a positive integer");
    }
    this.records = new Array<MusicalEventPersistenceRecord | undefined>(capacity);
  }

  enqueue(record: MusicalEventPersistenceRecord): MusicalEventRecordBufferEnqueueResult {
    let dropped: MusicalEventPersistenceRecord | undefined;
    if (this.pendingCount === this.capacity) {
      dropped = this.records[this.head];
      this.records[this.head] = record;
      this.head = (this.head + 1) % this.capacity;
      this.droppedCount += 1;
      this.lastDroppedEventId = dropped?.payload.sourceEventId;
    } else {
      const tail = (this.head + this.pendingCount) % this.capacity;
      this.records[tail] = record;
      this.pendingCount += 1;
    }
    this.enqueuedCount += 1;
    return {
      record,
      dropped,
      state: this.getState(),
    };
  }

  drain(limit = this.pendingCount): MusicalEventPersistenceRecord[] {
    const nextLimit = Math.max(0, Math.min(this.pendingCount, Math.floor(limit)));
    const drained: MusicalEventPersistenceRecord[] = [];
    for (let index = 0; index < nextLimit; index += 1) {
      const record = this.records[this.head];
      if (record) drained.push(record);
      this.records[this.head] = undefined;
      this.head = (this.head + 1) % this.capacity;
      this.pendingCount -= 1;
    }
    this.drainedCount += drained.length;
    return drained;
  }

  clear(): void {
    this.records.fill(undefined);
    this.head = 0;
    this.pendingCount = 0;
  }

  getState(): MusicalEventRecordBufferState {
    return {
      capacity: this.capacity,
      pendingCount: this.pendingCount,
      enqueuedCount: this.enqueuedCount,
      drainedCount: this.drainedCount,
      droppedCount: this.droppedCount,
      lastDroppedEventId: this.lastDroppedEventId,
    };
  }
}

export function createMusicalEventPersistenceRecord(
  event: MusicalEvent,
  tonalContext: TonalContext,
): MusicalEventPersistenceRecord {
  return {
    type: "musical.event_recorded",
    actorId: event.playerId,
    beat: event.absoluteBeat,
    payload: createMusicalEventRecordPayload(event, tonalContext),
  };
}

export function createMusicalEventRecordPayload(
  event: MusicalEvent,
  tonalContext: TonalContext,
): MusicalEventRecordPayload {
  const gridPitch = event.gridPitch ?? event.pitch;
  const performedPitch = event.performedPitch ?? event.pitch;
  const grid = describePitch(gridPitch, tonalContext);
  const performed = describePitch(performedPitch, tonalContext);

  return {
    schemaVersion: MUSICAL_EVENT_RECORD_SCHEMA_VERSION,
    sourceEventId: event.id,
    kind: event.kind,
    playerId: event.playerId,
    instrumentId: event.instrumentId,
    eventIndex: event.eventIndex,
    durationBeats: event.durationBeats,
    velocity: event.velocity,
    grid: {
      transportPosition: event.transportPosition,
      bar: event.bar,
      beat: event.beat,
      absoluteBeat: event.absoluteBeat,
      ...grid,
    },
    performed: {
      offsetBeats: event.performedOffsetBeats,
      offsetSeconds: event.performedOffsetSeconds,
      sounded: event.kind === "note" && performedPitch !== undefined && event.velocity > 0,
      pitchChanged: grid.pitch !== undefined && performed.pitch !== undefined && grid.pitch !== performed.pitch,
      registerShift: parseRegisterShift(event.tags),
      ...performed,
    },
    expression: event.expression,
    performedTiming: event.performedTiming,
    tags: [...event.tags],
    createdAtMs: event.createdAtMs,
  };
}

function describePitch(pitch: string | undefined, tonalContext: TonalContext): MusicalEventPitchRecord {
  if (!pitch) return {};
  const parsed = parsePitch(pitch);
  const pitchClass = parsed?.pitchClass ?? getPitchClass(pitch);
  const scaleDegree = tonalContext.scale.indexOf(pitchClass);
  return {
    pitch,
    pitchClass,
    octave: parsed?.octave,
    scaleDegree: scaleDegree >= 0 ? scaleDegree : undefined,
  };
}

function parsePitch(pitch: string): { pitchClass: string; octave: number } | undefined {
  const match = pitch.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!match) return undefined;
  return {
    pitchClass: `${match[1]}${match[2] ?? ""}`,
    octave: Number(match[3]),
  };
}

function getPitchClass(pitch: string): string {
  return pitch.replace(/[0-9-]+$/, "");
}

function parseRegisterShift(tags: readonly string[]): number | undefined {
  for (const tag of tags) {
    const match = tag.match(/^register:([+-]\d+)$/);
    if (match) return Number(match[1]);
  }
  return undefined;
}
