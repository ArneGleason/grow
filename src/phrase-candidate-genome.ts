import { normalizeAnchorPhrase, type AnchorPhrase } from "./anchor-phrase";
import { renderAnchorPhrase, type AnchorPhraseRenderOptions } from "./anchor-phrase-render";
import type { PatternNoteSource, PlayerPatternSource } from "./song-material";

export const PHRASE_CANDIDATE_GENOME_FORMAT = "anchor-phrase/v1" as const;

export interface AnchorPhraseCandidateGenome {
  format: typeof PHRASE_CANDIDATE_GENOME_FORMAT;
  phrase: AnchorPhrase;
  renderOptions: Required<Pick<AnchorPhraseRenderOptions, "baseOctave" | "playerId" | "subdivisionBeats">>;
}

export type PhraseCandidateGenome = PlayerPatternSource | AnchorPhraseCandidateGenome;

export const DEFAULT_PHRASE_CANDIDATE_RENDER_OPTIONS = {
  baseOctave: 4,
  playerId: "melody",
  subdivisionBeats: 0.25,
} as const satisfies AnchorPhraseCandidateGenome["renderOptions"];

const SCALE_LENGTH = 7;

export function createAnchorPhraseCandidateGenome(
  phrase: AnchorPhrase,
  options: Partial<AnchorPhraseCandidateGenome["renderOptions"]> = {},
): AnchorPhraseCandidateGenome {
  const normalized = normalizeAnchorPhrase(phrase);
  if (!normalized.valid) {
    throw new Error(`Invalid anchor phrase candidate genome: ${normalized.errors.join("; ")}`);
  }
  return {
    format: PHRASE_CANDIDATE_GENOME_FORMAT,
    phrase: cloneAnchorPhrase(normalized.phrase),
    renderOptions: normalizePhraseCandidateRenderOptions(options),
  };
}

export function createAnchorPhraseCandidateGenomeFromPattern(
  pattern: PlayerPatternSource,
): AnchorPhraseCandidateGenome {
  return createAnchorPhraseCandidateGenome(anchorPhraseFromPlayerPatternSource(pattern), {
    subdivisionBeats: pattern.subdivisionBeats,
    baseOctave: firstPatternOctave(pattern) ?? DEFAULT_PHRASE_CANDIDATE_RENDER_OPTIONS.baseOctave,
    playerId: firstPatternPlayerId(pattern) ?? DEFAULT_PHRASE_CANDIDATE_RENDER_OPTIONS.playerId,
  });
}

export function isAnchorPhraseCandidateGenome(value: unknown): value is AnchorPhraseCandidateGenome {
  return isRecord(value) && value.format === PHRASE_CANDIDATE_GENOME_FORMAT && isRecord(value.phrase);
}

export function renderPhraseCandidateGenome(genome: unknown): PlayerPatternSource {
  if (isAnchorPhraseCandidateGenome(genome)) {
    const normalized = normalizeAnchorPhrase(genome.phrase);
    return renderAnchorPhrase(
      normalized.phrase,
      normalizePhraseCandidateRenderOptions(genome.renderOptions),
    );
  }
  return clonePlayerPatternSource(genome as PlayerPatternSource);
}

export function clonePlayerPatternSource(pattern: PlayerPatternSource): PlayerPatternSource {
  return {
    subdivisionBeats: finiteNumber(pattern.subdivisionBeats, 1),
    events: Array.isArray(pattern.events)
      ? pattern.events.map((event) => event ? { ...event } : null)
      : [null],
  };
}

export function normalizePhraseCandidateRenderOptions(
  options: Partial<AnchorPhraseCandidateGenome["renderOptions"]> = {},
): AnchorPhraseCandidateGenome["renderOptions"] {
  return {
    baseOctave: Math.trunc(clamp(finiteNumber(options.baseOctave, 4), 0, 8)),
    playerId: typeof options.playerId === "string" && options.playerId.trim().length > 0
      ? options.playerId.trim().slice(0, 48)
      : DEFAULT_PHRASE_CANDIDATE_RENDER_OPTIONS.playerId,
    subdivisionBeats: clamp(finiteNumber(options.subdivisionBeats, 0.25), 0.125, 4),
  };
}

export function anchorPhraseFromPlayerPatternSource(pattern: PlayerPatternSource): AnchorPhrase {
  const subdivisionBeats = finiteNumber(pattern.subdivisionBeats, 0.25);
  const notes = Array.isArray(pattern.events)
    ? pattern.events
        .map((event, index) => event ? patternNoteToAnchor(event, index * subdivisionBeats) : undefined)
        .filter((anchor): anchor is ReturnType<typeof patternNoteToAnchor> => Boolean(anchor))
        .sort((left, right) => left.startBeat - right.startBeat)
    : [];

  if (notes.length === 0) {
    throw new Error("Cannot convert an empty PlayerPatternSource to an anchor phrase candidate genome");
  }

  const anchors = notes.map((anchor, index) => {
    const nextStartBeat = notes[index + 1]?.startBeat;
    const maximumDuration = nextStartBeat === undefined
      ? anchor.durationBeats
      : Math.max(0.0625, nextStartBeat - anchor.startBeat);
    return {
      ...anchor,
      durationBeats: roundTo(clamp(anchor.durationBeats, 0.0625, maximumDuration), 4),
    };
  });
  return {
    segments: [
      {
        anchors,
        connectors: anchors.slice(1).map(() => silentConnector()),
      },
    ],
  };
}

function patternNoteToAnchor(event: PatternNoteSource, startBeat: number) {
  const scaleDegree = Math.trunc(finiteNumber(event.scaleDegree, 0));
  const octaveOffset = Math.floor(scaleDegree / SCALE_LENGTH);
  const degree = positiveModulo(scaleDegree, SCALE_LENGTH) + 1;
  return {
    degree,
    octave: Math.trunc(clamp(finiteNumber(event.octave, 4) + octaveOffset, 0, 8)),
    startBeat: roundTo(Math.max(0, startBeat), 4),
    durationBeats: roundTo(clamp(finiteNumber(event.durationBeats, 0.5), 0.0625, 64), 4),
    dynamics: roundTo(clamp(finiteNumber(event.velocity, 0.3), 0, 1), 4),
  };
}

function silentConnector(): AnchorPhrase["segments"][number]["connectors"][number] {
  return {
    kernel: "fill",
    reach: 0,
    density: 0,
    bias: 0,
    pull: 0,
    color: 0,
    skew: 0,
  };
}

function cloneAnchorPhrase(phrase: AnchorPhrase): AnchorPhrase {
  return {
    segments: phrase.segments.map((segment) => ({
      anchors: segment.anchors.map((anchor) => ({ ...anchor })),
      connectors: segment.connectors.map((connector) => ({ ...connector })),
    })),
  };
}

function firstPatternOctave(pattern: PlayerPatternSource): number | undefined {
  return pattern.events.find((event) => event !== null)?.octave;
}

function firstPatternPlayerId(pattern: PlayerPatternSource): string | undefined {
  return pattern.events.find((event) => event !== null)?.playerId;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
