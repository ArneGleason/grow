import type { PlayerRole, PlayerRuntimeState } from "./players";

export type MusicalEventKind = "note" | "rest" | "effect";

export interface TonalContext {
  tonic: string;
  mode: string;
  scale: readonly string[];
}

export interface MusicalEvent {
  id: string;
  kind: MusicalEventKind;
  playerId: string;
  instrumentId: string;
  transportPosition: string;
  bar: number;
  beat: number;
  absoluteBeat: number;
  durationBeats: number;
  velocity: number;
  pitch?: string;
  tags: string[];
  createdAtMs: number;
}

export interface ListeningFramePlayer {
  id: string;
  role: PlayerRole;
  state: PlayerRuntimeState;
  recentEvents: MusicalEvent[];
  density: number;
  register: "low" | "mid" | "high";
  tags: string[];
}

export interface ListeningFrame {
  id: string;
  generatedAtMs: number;
  timeWindow: {
    fromBeat: number;
    toBeat: number;
  };
  tempo: number;
  meter: [number, number];
  tonalContext: TonalContext;
  mix: {
    loudness: number;
    silenceRatio: number;
    lowEnergy: number;
    midEnergy: number;
    highEnergy: number;
    brightness: number;
    transientDensity: number;
  };
  eventCount: number;
  recentEvents: MusicalEvent[];
  players: ListeningFramePlayer[];
}

export interface ListeningFramePlayerSource {
  id: string;
  role: PlayerRole;
  state: PlayerRuntimeState;
  tags: string[];
}

export interface ListeningFrameOptions {
  players: readonly ListeningFramePlayerSource[];
  tempo: number;
  meter: [number, number];
  tonalContext: TonalContext;
  currentBeat?: number;
  windowBeats?: number;
}

export class MusicalEventLedger {
  private events: MusicalEvent[] = [];

  constructor(private readonly maxEvents = 128) {}

  record(event: MusicalEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  clear(): void {
    this.events = [];
  }

  getEvents(): readonly MusicalEvent[] {
    return this.events;
  }

  createFrame(options: ListeningFrameOptions): ListeningFrame {
    const windowBeats = options.windowBeats ?? 8;
    const latestEventBeat = this.events.at(-1)?.absoluteBeat ?? 0;
    const toBeat = options.currentBeat ?? latestEventBeat;
    const fromBeat = Math.max(0, toBeat - windowBeats);
    const recentEvents = this.events.filter(
      (event) => event.absoluteBeat >= fromBeat && event.absoluteBeat <= toBeat,
    );

    return {
      id: `frame-${recentEvents.length}-${toBeat.toFixed(2)}`,
      generatedAtMs: performance.now(),
      timeWindow: { fromBeat, toBeat },
      tempo: options.tempo,
      meter: options.meter,
      tonalContext: options.tonalContext,
      mix: {
        loudness: 0,
        silenceRatio: calculateSilenceRatio(recentEvents, fromBeat, toBeat),
        lowEnergy: 0,
        midEnergy: 0,
        highEnergy: 0,
        brightness: 0,
        transientDensity: recentEvents.length / Math.max(1, windowBeats),
      },
      eventCount: recentEvents.length,
      recentEvents,
      players: options.players.map((player) => {
        const playerEvents = recentEvents.filter((event) => event.playerId === player.id);
        return {
          id: player.id,
          role: player.role,
          state: player.state,
          recentEvents: playerEvents,
          density: playerEvents.length / Math.max(1, windowBeats),
          register: inferRegister(player.tags),
          tags: player.tags,
        };
      }),
    };
  }
}

function inferRegister(tags: readonly string[]): "low" | "mid" | "high" {
  if (tags.includes("low")) return "low";
  if (tags.includes("high")) return "high";
  return "mid";
}

function calculateSilenceRatio(
  events: readonly MusicalEvent[],
  fromBeat: number,
  toBeat: number,
): number {
  const windowLength = Math.max(0, toBeat - fromBeat);
  if (windowLength === 0) return events.length === 0 ? 1 : 0;
  const intervals = events
    .map((event) => ({
      start: Math.max(fromBeat, event.absoluteBeat),
      end: Math.min(toBeat, event.absoluteBeat + event.durationBeats),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start);
  const activeBeats = measureIntervalUnion(intervals);

  return Math.max(0, Math.min(1, 1 - activeBeats / windowLength));
}

function measureIntervalUnion(intervals: readonly { start: number; end: number }[]): number {
  if (intervals.length === 0) return 0;

  let activeBeats = 0;
  let currentStart = intervals[0].start;
  let currentEnd = intervals[0].end;

  for (let index = 1; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      continue;
    }

    activeBeats += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  }

  return activeBeats + currentEnd - currentStart;
}
