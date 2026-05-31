import type { ListeningFrame, MusicalEvent } from "./listening";
import type { Player, PlayerMemoryFragment } from "./players";
import type { PlayerTasteEvaluation } from "./taste";

export type ThoughtRequestLevel = "in_song_short";

export interface ThoughtMotifSummary {
  label: string;
  eventCount: number;
  contour: "none" | "steady" | "rising" | "falling" | "mixed";
  rhythm: "none" | "whole-beat" | "offbeat" | "mixed";
  excerpt: string;
}

export interface PlayerThoughtSeed {
  playerId: string;
  role: Player["role"];
  requestLevel: ThoughtRequestLevel;
  generatedAtBeat: number;
  disposition: string;
  selectedFragments: PlayerMemoryFragment[];
  listeningSummary: {
    eventCount: number;
    ensembleDensity: number;
    silenceRatio: number;
    brightness: number;
    focusPlayerId?: string;
  };
  tasteSummary: {
    action: PlayerTasteEvaluation["action"];
    affinity: number;
    reason: string;
  };
  recentMotif: ThoughtMotifSummary;
  promptFocus: string;
}

export function createPlayerThoughtSeed(
  player: Player,
  frame: ListeningFrame,
  evaluation: PlayerTasteEvaluation,
): PlayerThoughtSeed {
  const recentMotif = summarizeRecentMotif(player, frame);
  const focusPlayerId = chooseFocusPlayer(player, frame);
  const selectedFragments = selectMemoryFragments(player, frame, evaluation, recentMotif);

  return {
    playerId: player.id,
    role: player.role,
    requestLevel: "in_song_short",
    generatedAtBeat: frame.timeWindow.toBeat,
    disposition: summarizeDisposition(player),
    selectedFragments,
    listeningSummary: {
      eventCount: frame.eventCount,
      ensembleDensity: round(frame.mix.transientDensity),
      silenceRatio: round(frame.mix.silenceRatio),
      brightness: round(frame.mix.brightness),
      focusPlayerId,
    },
    tasteSummary: {
      action: evaluation.action,
      affinity: round(evaluation.affinity),
      reason: evaluation.reasons[0] ?? evaluation.summary,
    },
    recentMotif,
    promptFocus: choosePromptFocus(player, frame, evaluation, recentMotif, focusPlayerId),
  };
}

function summarizeDisposition(player: Player): string {
  const { disposition } = player.thinking;
  const topTraits = Object.entries(disposition)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([trait, value]) => `${trait} ${value.toFixed(2)}`);

  return topTraits.join(", ");
}

function summarizeRecentMotif(player: Player, frame: ListeningFrame): ThoughtMotifSummary {
  const playerFrame = frame.players.find((candidate) => candidate.id === player.id);
  const events = (playerFrame?.recentEvents ?? [])
    .filter((event) => event.kind === "note" || event.kind === "rest")
    .slice(-6);

  if (events.length === 0) {
    return {
      label: "no recent self phrase",
      eventCount: 0,
      contour: "none",
      rhythm: "none",
      excerpt: "resting",
    };
  }

  return {
    label: `${player.id} recent ${events.length}`,
    eventCount: events.length,
    contour: inferContour(events),
    rhythm: inferRhythm(events),
    excerpt: events.map(formatEventExcerpt).join(" "),
  };
}

function inferContour(events: readonly MusicalEvent[]): ThoughtMotifSummary["contour"] {
  const pitches = events
    .map((event) => pitchHeight(event.pitch))
    .filter((height): height is number => height !== undefined);
  if (pitches.length < 2) return "steady";

  let rising = 0;
  let falling = 0;
  for (let index = 1; index < pitches.length; index += 1) {
    const delta = pitches[index] - pitches[index - 1];
    if (delta > 0) rising += 1;
    if (delta < 0) falling += 1;
  }

  if (rising > 0 && falling > 0) return "mixed";
  if (rising > 0) return "rising";
  if (falling > 0) return "falling";
  return "steady";
}

function inferRhythm(events: readonly MusicalEvent[]): ThoughtMotifSummary["rhythm"] {
  const offsets = events.map((event) => round(event.absoluteBeat % 1));
  const wholeBeatCount = offsets.filter((offset) => offset === 0).length;
  if (wholeBeatCount === events.length) return "whole-beat";
  if (wholeBeatCount === 0) return "offbeat";
  return "mixed";
}

function pitchHeight(pitch?: string): number | undefined {
  const match = pitch?.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!match) return undefined;
  const [, letter, accidental = "", octave] = match;
  const pitchClass = `${letter}${accidental}`;
  const semitoneByPitch: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };
  const semitone = semitoneByPitch[pitchClass];
  if (semitone === undefined) return undefined;

  return Number(octave) * 12 + semitone;
}

function formatEventExcerpt(event: MusicalEvent): string {
  const beat = round(event.absoluteBeat % 4).toFixed(1);
  if (event.kind === "rest") return `r@${beat}`;
  return `${event.pitch ?? "note"}@${beat}/${event.durationBeats}`;
}

function chooseFocusPlayer(player: Player, frame: ListeningFrame): string | undefined {
  const candidates = frame.players
    .filter((candidate) => candidate.id !== player.id && candidate.recentEvents.length > 0)
    .sort((left, right) => right.recentEvents.length - left.recentEvents.length);

  return candidates[0]?.id;
}

function selectMemoryFragments(
  player: Player,
  frame: ListeningFrame,
  evaluation: PlayerTasteEvaluation,
  recentMotif: ThoughtMotifSummary,
): PlayerMemoryFragment[] {
  const scored = player.thinking.memoryFragments
    .map((fragment, index) => ({
      fragment,
      score: scoreMemoryFragment(fragment, index, frame, evaluation, recentMotif),
    }))
    .sort((left, right) => right.score - left.score || left.fragment.id.localeCompare(right.fragment.id));

  return scored.slice(0, 2).map(({ fragment }) => fragment);
}

function scoreMemoryFragment(
  fragment: PlayerMemoryFragment,
  index: number,
  frame: ListeningFrame,
  evaluation: PlayerTasteEvaluation,
  recentMotif: ThoughtMotifSummary,
): number {
  const tags = new Set(fragment.tags);
  let score = stableHash(`${fragment.id}:${Math.floor(frame.timeWindow.toBeat / 4)}`) % 7;
  if (tags.has(evaluation.action)) score += 5;
  if (tags.has("bright") && frame.mix.brightness > 0.45) score += 3;
  if (tags.has("space") && frame.mix.silenceRatio > 0.35) score += 3;
  if (tags.has("density") && frame.mix.transientDensity > 1.2) score += 3;
  if (tags.has(recentMotif.contour)) score += 2;
  return score - index * 0.01;
}

function choosePromptFocus(
  player: Player,
  frame: ListeningFrame,
  evaluation: PlayerTasteEvaluation,
  recentMotif: ThoughtMotifSummary,
  focusPlayerId?: string,
): string {
  if (evaluation.action === "rest") {
    return `leave space, then re-enter around ${recentMotif.contour} motion`;
  }
  if (evaluation.action === "simplify") {
    return `simplify the ${recentMotif.rhythm} pattern without losing ${player.role}`;
  }
  if (evaluation.action === "support" && focusPlayerId) {
    return `support ${focusPlayerId} with a compact ${player.role} response`;
  }
  if (evaluation.action === "contrast") {
    return `make a short contrast against brightness ${round(frame.mix.brightness).toFixed(2)}`;
  }
  if (evaluation.action === "vary") {
    return `vary the recent ${recentMotif.contour} motif in the next 4 bars`;
  }
  return `keep the role stable and listen for a small future variation`;
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
