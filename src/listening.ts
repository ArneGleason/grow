import type { PlayerDisposition, PlayerRole, PlayerRuntimeState } from "./players";
import { RECENT_ACTIVITY_WINDOW_BEATS } from "./music-time";
import type { PlayerExpressionSnapshot } from "./expression";
import type { PlayerPerformedTimingSnapshot } from "./performed-time";

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
  eventIndex: number;
  durationBeats: number;
  performedOffsetBeats: number;
  performedOffsetSeconds: number;
  velocity: number;
  pitch?: string;
  gridPitch?: string;
  performedPitch?: string;
  expression?: PlayerExpressionSnapshot;
  performedTiming?: PlayerPerformedTimingSnapshot;
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
  contagion: PlayerContagion;
  tags: string[];
}

export interface MixAgitationSources {
  timingVariance: number;
  velocitySpike: number;
  densityPressure: number;
  pushDragPressure: number;
}

export interface PlayerContagion {
  level: number;
  summary: string;
  components: {
    catchPressure: number;
    damping: number;
    amplification: number;
    activity: number;
  };
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
    agitation: number;
    agitationSources: MixAgitationSources;
  };
  eventCount: number;
  recentEvents: MusicalEvent[];
  players: ListeningFramePlayer[];
}

export interface ListeningFramePlayerSource {
  id: string;
  role: PlayerRole;
  state: PlayerRuntimeState;
  disposition: PlayerDisposition;
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
    const windowBeats = options.windowBeats ?? RECENT_ACTIVITY_WINDOW_BEATS;
    const latestEventBeat = this.events.at(-1)?.absoluteBeat ?? 0;
    const toBeat = options.currentBeat ?? latestEventBeat;
    const fromBeat = Math.max(0, toBeat - windowBeats);
    const recentEvents = this.events.filter(
      (event) => event.absoluteBeat >= fromBeat && event.absoluteBeat <= toBeat,
    );
    const noteEvents = recentEvents.filter((event) => event.kind === "note");
    const densityBeats = Math.max(1, toBeat - fromBeat);
    const energy = summarizeEnergy(noteEvents);
    const silenceRatio = calculateSilenceRatio(noteEvents, fromBeat, toBeat);
    const transientDensity = noteEvents.length / densityBeats;
    const agitation = summarizeAgitation(noteEvents, transientDensity, silenceRatio);

    return {
      id: `frame-${recentEvents.length}-${toBeat.toFixed(2)}`,
      generatedAtMs: performance.now(),
      timeWindow: { fromBeat, toBeat },
      tempo: options.tempo,
      meter: options.meter,
      tonalContext: options.tonalContext,
      mix: {
        loudness: calculateLoudness(noteEvents),
        silenceRatio,
        lowEnergy: energy.low,
        midEnergy: energy.mid,
        highEnergy: energy.high,
        brightness: energy.brightness,
        transientDensity,
        agitation: agitation.level,
        agitationSources: agitation.sources,
      },
      eventCount: recentEvents.length,
      recentEvents,
      players: options.players.map((player) => {
        const playerEvents = recentEvents.filter((event) => event.playerId === player.id);
        const playerNoteEvents = playerEvents.filter((event) => event.kind === "note");
        return {
          id: player.id,
          role: player.role,
          state: player.state,
          recentEvents: playerEvents,
          density: playerNoteEvents.length / densityBeats,
          register: inferRegister(player.tags),
          contagion: calculatePlayerContagion(
            player.disposition,
            playerNoteEvents.length / densityBeats,
            agitation.level,
          ),
          tags: player.tags,
        };
      }),
    };
  }
}

function summarizeAgitation(
  events: readonly MusicalEvent[],
  transientDensity: number,
  silenceRatio: number,
): { level: number; sources: MixAgitationSources } {
  if (events.length === 0) {
    return {
      level: 0,
      sources: {
        timingVariance: 0,
        velocitySpike: 0,
        densityPressure: 0,
        pushDragPressure: 0,
      },
    };
  }

  const normalizedOffsets = events.map(normalizePerformedOffset);
  const timingVariance = standardDeviation(normalizedOffsets);
  const averageOffset = average(normalizedOffsets.map(Math.abs));
  const directionalSpread = normalizedOffsets.length <= 1
    ? averageOffset
    : (Math.max(...normalizedOffsets) - Math.min(...normalizedOffsets)) / 2;
  const pushDragPressure = clamp(averageOffset * 0.58 + directionalSpread * 0.42, 0, 1);
  const velocitySpike = calculateVelocitySpike(events);
  const densityPressure = clamp((transientDensity / 3) * (1 - silenceRatio * 0.45), 0, 1);
  const level = clamp(
    timingVariance * 0.3
      + velocitySpike * 0.24
      + densityPressure * 0.3
      + pushDragPressure * 0.16,
    0,
    1,
  );

  return {
    level: roundUnit(level),
    sources: {
      timingVariance: roundUnit(timingVariance),
      velocitySpike: roundUnit(velocitySpike),
      densityPressure: roundUnit(densityPressure),
      pushDragPressure: roundUnit(pushDragPressure),
    },
  };
}

function calculatePlayerContagion(
  disposition: PlayerDisposition,
  playerDensity: number,
  mixAgitation: number,
): PlayerContagion {
  if (mixAgitation === 0) {
    return {
      level: 0,
      summary: "quiet",
      components: {
        catchPressure: 0,
        damping: roundUnit(disposition.caution * 0.34 + disposition.steadiness * 0.28),
        amplification: 0,
        activity: 0,
      },
    };
  }

  const activity = clamp(playerDensity, 0, 1);
  const catchPressure = clamp(
    disposition.responsiveness * 0.48
      + disposition.novelty * 0.14
      + disposition.disruption * 0.22
      + activity * 0.16,
    0,
    1,
  );
  const damping = clamp(disposition.caution * 0.34 + disposition.steadiness * 0.28, 0, 1);
  const amplification = clamp(
    disposition.disruption * 0.35
      + (1 - disposition.steadiness) * 0.22
      + disposition.density * 0.18,
    0,
    1,
  );
  const level = clamp(
    mixAgitation * (0.45 + catchPressure * 0.55 + amplification * 0.3 - damping * 0.35)
      + mixAgitation * activity * 0.12,
    0,
    1,
  );

  return {
    level: roundUnit(level),
    summary: summarizeContagion(catchPressure, damping, amplification),
    components: {
      catchPressure: roundUnit(catchPressure),
      damping: roundUnit(damping),
      amplification: roundUnit(amplification),
      activity: roundUnit(activity),
    },
  };
}

function normalizePerformedOffset(event: MusicalEvent): number {
  const maximumOffset = Math.max(0.0001, event.performedTiming?.maximumOffsetBeats ?? 0.035);
  return clamp(event.performedOffsetBeats / maximumOffset, -1, 1);
}

function calculateVelocitySpike(events: readonly MusicalEvent[]): number {
  const velocities = events.map((event) => event.velocity);
  const meanVelocity = average(velocities);
  const maximumVelocity = Math.max(...velocities);
  const velocityVariance = standardDeviation(velocities);

  return clamp((maximumVelocity - meanVelocity) * 1.35 + velocityVariance * 0.9, 0, 1);
}

function summarizeContagion(
  catchPressure: number,
  damping: number,
  amplification: number,
): string {
  if (damping > catchPressure + amplification * 0.35) return "damping heat";
  if (amplification > 0.42) return "amplifying heat";
  if (catchPressure > 0.58) return "catching heat";
  return "holding heat";
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

function calculateLoudness(events: readonly MusicalEvent[]): number {
  if (events.length === 0) return 0;
  const totalVelocity = events.reduce((sum, event) => sum + event.velocity, 0);

  return Math.max(0, Math.min(1, totalVelocity / events.length));
}

function summarizeEnergy(events: readonly MusicalEvent[]): {
  low: number;
  mid: number;
  high: number;
  brightness: number;
} {
  if (events.length === 0) {
    return { low: 0, mid: 0, high: 0, brightness: 0 };
  }

  const counts = events.reduce(
    (summary, event) => {
      summary[inferPitchRegister(event.pitch)] += event.velocity;
      return summary;
    },
    { low: 0, mid: 0, high: 0 },
  );
  const total = Math.max(0.000001, counts.low + counts.mid + counts.high);
  const low = counts.low / total;
  const mid = counts.mid / total;
  const high = counts.high / total;

  return {
    low,
    mid,
    high,
    brightness: Math.max(0, Math.min(1, mid * 0.5 + high)),
  };
}

function inferPitchRegister(pitch?: string): "low" | "mid" | "high" {
  const octave = pitch?.match(/-?\d+$/)?.[0];
  if (!octave) return "mid";
  const octaveNumber = Number(octave);
  if (octaveNumber <= 2) return "low";
  if (octaveNumber >= 4) return "high";
  return "mid";
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

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function roundUnit(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
