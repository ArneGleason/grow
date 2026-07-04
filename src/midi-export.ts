import { calculatePlayerExpression } from "./expression";
import { calculatePerformedTiming } from "./performed-time";
import type { Player } from "./players";
import { applySectionDynamics, type SectionDynamicsProfile } from "./section-dynamics";
import type { PlayerPatternSource, SongMaterial } from "./song-material";
import {
  arrangeSongFormPatternEvent,
  sectionAtBeat,
  type ChorusDevelopment,
  type SongArrangement,
} from "./song-form";
import { selectPulseDrumHit } from "./pulse-drums";
import {
  DEFAULT_SOUND_MIX,
  cloneSoundMixSettings,
  getPlayerSoundSettings,
  type SoundMixSettings,
} from "./sound-settings";
import { noteFromScaleDegreeWithChromaticOffset, pitchToMidiNumber } from "./tonal-context";
import type { TonalContext } from "./listening";
import type { TimingFeelMode } from "./transport";

export interface MidiSongExportInput {
  title: string;
  song: SongMaterial;
  arrangement: SongArrangement;
  tonalContext: TonalContext;
  tempoBpm: number;
  timingFeelMode: TimingFeelMode;
  players: readonly Player[];
  sectionDynamicsProfile?: SectionDynamicsProfile;
  chorusDevelopment?: ChorusDevelopment;
  soundMix?: SoundMixSettings;
}

export interface MidiTrackSummary {
  playerId: string;
  noteCount: number;
  channel: number;
  voice: string;
}

export interface MidiSongExportResult {
  bytes: Uint8Array;
  filename: string;
  noteCount: number;
  tempoBpm: number;
  timingFeelMode: TimingFeelMode;
  totalBeats: number;
  trackSummaries: readonly MidiTrackSummary[];
}

interface MidiNote {
  playerId: string;
  channel: number;
  startBeat: number;
  durationBeats: number;
  pitch: string;
  midiNote?: number;
  velocity: number;
  voice: string;
}

interface MidiEvent {
  tick: number;
  order: number;
  data: readonly number[];
}

const MIDI_PPQ = 480;
const MIDI_FORMAT_TYPE_1 = 1;
const MIDI_HEADER_LENGTH = 6;
const MIDI_DEFAULT_TIME_SIGNATURE = [4, 2, 24, 8] as const;
const MAX_WIDE_TIMING_OFFSET_BEATS = 0.06;
const WIDE_TIMING_SCALE = 4;
const GM_DRUM_CHANNEL = 9;
const PLAYER_CHANNELS: Record<string, number> = {
  pulse: 0,
  bass: 1,
  keyboard: 3,
  melody: 2,
  texture: 4,
  effects: 4,
};

export function exportSongToMidi(input: MidiSongExportInput): MidiSongExportResult {
  const playersById = new Map(input.players.map((player) => [player.id, player]));
  const notesByPlayer = new Map<string, MidiNote[]>();
  const previousPitchByPlayer = new Map<string, string>();
  const eventIndexByPlayer = new Map<string, number>();
  const soundMix = cloneSoundMixSettings(input.soundMix ?? DEFAULT_SOUND_MIX);

  for (const pattern of input.song.patterns) {
    if (pattern.events.length === 0 || pattern.subdivisionBeats <= 0) continue;
    const stepCount = Math.ceil(input.arrangement.totalBeats / pattern.subdivisionBeats);
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const absoluteBeat = roundBeat(stepIndex * pattern.subdivisionBeats);
      if (absoluteBeat >= input.arrangement.totalBeats) break;
      const sourceEvent = pattern.events[stepIndex % pattern.events.length] ?? null;
      const arranged = arrangeSongFormPatternEvent({
        song: input.song,
        pattern,
        sourceEvent,
        stepIndex,
        absoluteBeat,
        tonalContext: input.tonalContext,
        arrangement: input.arrangement,
        chorusDevelopment: input.chorusDevelopment,
      });
      if (!arranged) continue;
      const player = playersById.get(arranged.playerId);
      if (!player) continue;

      const section = sectionAtBeat(absoluteBeat, input.arrangement);
      const dynamics = applySectionDynamics({
        role: player.role,
        sectionType: section.sectionType,
        occurrence: section.occurrence,
        localBeat: section.localBeat,
        localBar: section.localBar,
        absoluteBeat,
        profile: input.sectionDynamicsProfile,
        baseAction: "repeat",
        baseShouldPlay: true,
        baseVelocityMultiplier: 1,
        baseReason: "MIDI export keeps the arranged song material.",
      });
      if (!dynamics.shouldPlay) continue;

      const eventIndex = eventIndexByPlayer.get(player.id) ?? 0;
      const gridPitch = noteFromScaleDegreeWithChromaticOffset(
        input.tonalContext,
        arranged.scaleDegree,
        arranged.octave,
        arranged.chromaticOffsetSemitones,
      );
      const expression = calculatePlayerExpression({
        player,
        absoluteBeat,
        eventIndex,
        baseVelocity: arranged.velocity,
        tasteVelocityMultiplier: dynamics.velocityMultiplier,
      });
      if (expression.finalVelocity <= 0) continue;
      const playerSound = getPlayerSoundSettings(soundMix, player.id);

      const performedTiming = calculatePerformedTiming({
        player,
        absoluteBeat,
        eventIndex,
        pitch: gridPitch,
        previousPitch: previousPitchByPlayer.get(player.id),
        durationBeats: arranged.durationBeats,
        baseVelocity: arranged.velocity,
        localDensity: estimatePatternDensity(pattern, stepIndex),
      });
      const offsetBeats = applyMidiTimingFeel(performedTiming.performedOffsetBeats, input.timingFeelMode);
      const startBeat = Math.max(0, roundBeat(absoluteBeat + offsetBeats));
      let velocity = expression.finalVelocity;
      let durationBeats = Math.max(0.0625, arranged.durationBeats);
      let midiNote: number | undefined;
      if (player.id === "pulse" && playerSound.voice === "drum-kit") {
        const drumHit = selectPulseDrumHit({
          absoluteBeat,
          scaleDegree: arranged.scaleDegree,
          velocity: expression.finalVelocity,
        });
        midiNote = drumHit.midiNote;
        velocity = clamp(expression.finalVelocity * drumHit.velocityMultiplier, 0, 1);
        durationBeats = Math.max(
          0.0625,
          Math.min(durationBeats, secondsToBeats(drumHit.durationSeconds, input.tempoBpm)),
        );
      }
      const note = {
        playerId: player.id,
        channel: getPlayerMidiChannel(player.id, playerSound.voice, notesByPlayer.size),
        startBeat,
        durationBeats,
        pitch: gridPitch,
        ...(midiNote !== undefined ? { midiNote } : {}),
        velocity: toMidiVelocity(velocity),
        voice: playerSound.voice,
      };

      if (!notesByPlayer.has(player.id)) notesByPlayer.set(player.id, []);
      notesByPlayer.get(player.id)?.push(note);
      previousPitchByPlayer.set(player.id, gridPitch);
      eventIndexByPlayer.set(player.id, eventIndex + 1);
    }
  }

  const playerTracks = [...notesByPlayer.entries()]
    .filter(([, notes]) => notes.length > 0)
    .map(([playerId, notes]) => ({
      playerId,
      bytes: createPlayerTrack(playerId, notes),
      noteCount: notes.length,
      channel: notes[0]?.channel ?? PLAYER_CHANNELS[playerId] ?? 0,
      voice: notes[0]?.voice ?? getPlayerSoundSettings(soundMix, playerId).voice,
    }));
  const tempoTrack = createTempoTrack(input.title, input.tempoBpm, input.arrangement);
  const bytes = createMidiFile([
    tempoTrack,
    ...playerTracks.map((track) => track.bytes),
  ]);

  return {
    bytes,
    filename: `${slugify(input.title || input.song.label)}.mid`,
    noteCount: playerTracks.reduce((sum, track) => sum + track.noteCount, 0),
    tempoBpm: normalizeTempo(input.tempoBpm),
    timingFeelMode: input.timingFeelMode,
    totalBeats: input.arrangement.totalBeats,
    trackSummaries: playerTracks.map((track) => ({
      playerId: track.playerId,
      noteCount: track.noteCount,
      channel: track.channel,
      voice: track.voice,
    })),
  };
}

function createTempoTrack(title: string, tempoBpm: number, arrangement: SongArrangement): Uint8Array {
  const events: MidiEvent[] = [
    metaEvent(0, 0, 0x03, `Grow: ${title || "Untitled song"}`),
    {
      tick: 0,
      order: 1,
      data: [0xff, 0x58, 0x04, ...MIDI_DEFAULT_TIME_SIGNATURE],
    },
    {
      tick: 0,
      order: 2,
      data: [0xff, 0x51, 0x03, ...tempoBytes(tempoBpm)],
    },
  ];

  for (const section of arrangement.sections) {
    events.push(metaEvent(beatsToTicks(section.startBeat), 3, 0x06, `${section.label} ${section.occurrence}`));
  }

  return createTrack(events);
}

function createPlayerTrack(playerId: string, notes: readonly MidiNote[]): Uint8Array {
  const trackName = playerId === "pulse" && notes.some((note) => note.channel === GM_DRUM_CHANNEL)
    ? "pulse GM drums"
    : playerId;
  const events: MidiEvent[] = [metaEvent(0, 0, 0x03, trackName)];
  for (const note of notes) {
    const startTick = beatsToTicks(note.startBeat);
    const endTick = Math.max(startTick + 1, beatsToTicks(note.startBeat + note.durationBeats));
    const noteNumber = note.midiNote ?? pitchToMidiNumber(note.pitch);
    if (noteNumber === undefined) continue;
    events.push({
      tick: startTick,
      order: 2,
      data: [0x90 + clampInteger(note.channel, 0, 15), noteNumber, note.velocity],
    });
    events.push({
      tick: endTick,
      order: 1,
      data: [0x80 + clampInteger(note.channel, 0, 15), noteNumber, 0],
    });
  }
  return createTrack(events);
}

function createMidiFile(tracks: readonly Uint8Array[]): Uint8Array {
  return concatenateBytes([
    createHeader(tracks.length),
    ...tracks,
  ]);
}

function createHeader(trackCount: number): Uint8Array {
  return Uint8Array.from([
    ...asciiBytes("MThd"),
    ...uint32Bytes(MIDI_HEADER_LENGTH),
    ...uint16Bytes(MIDI_FORMAT_TYPE_1),
    ...uint16Bytes(trackCount),
    ...uint16Bytes(MIDI_PPQ),
  ]);
}

function createTrack(events: readonly MidiEvent[]): Uint8Array {
  const sortedEvents = [...events].sort((left, right) =>
    left.tick === right.tick ? left.order - right.order : left.tick - right.tick
  );
  const payload: number[] = [];
  let lastTick = 0;
  for (const event of sortedEvents) {
    const tick = Math.max(0, event.tick);
    payload.push(...variableLengthQuantity(tick - lastTick), ...event.data);
    lastTick = tick;
  }
  payload.push(0x00, 0xff, 0x2f, 0x00);
  return Uint8Array.from([
    ...asciiBytes("MTrk"),
    ...uint32Bytes(payload.length),
    ...payload,
  ]);
}

function metaEvent(tick: number, order: number, type: number, text: string): MidiEvent {
  const encoded = Array.from(new TextEncoder().encode(text));
  return {
    tick,
    order,
    data: [0xff, type, ...variableLengthQuantity(encoded.length), ...encoded],
  };
}

function tempoBytes(tempoBpm: number): readonly number[] {
  const microsecondsPerQuarter = Math.round(60_000_000 / normalizeTempo(tempoBpm));
  return [
    (microsecondsPerQuarter >> 16) & 0xff,
    (microsecondsPerQuarter >> 8) & 0xff,
    microsecondsPerQuarter & 0xff,
  ];
}

function applyMidiTimingFeel(offsetBeats: number, mode: TimingFeelMode): number {
  if (mode === "grid") return 0;
  if (mode === "wide") {
    return roundBeat(clamp(offsetBeats * WIDE_TIMING_SCALE, -MAX_WIDE_TIMING_OFFSET_BEATS, MAX_WIDE_TIMING_OFFSET_BEATS));
  }
  return offsetBeats;
}

function estimatePatternDensity(pattern: PlayerPatternSource, stepIndex: number): number {
  if (pattern.events.length === 0) return 0;
  const windowSteps = Math.min(pattern.events.length, 8);
  let noteCount = 0;
  for (let offset = -Math.floor(windowSteps / 2); offset < Math.ceil(windowSteps / 2); offset += 1) {
    const index = modulo(stepIndex + offset, pattern.events.length);
    if (pattern.events[index]) noteCount += 1;
  }
  return noteCount / windowSteps;
}

function getPlayerMidiChannel(playerId: string, voice: string, fallbackIndex: number): number {
  if (playerId === "pulse" && voice === "drum-kit") return GM_DRUM_CHANNEL;
  return PLAYER_CHANNELS[playerId] ?? (fallbackIndex % 15);
}

function secondsToBeats(seconds: number, tempoBpm: number): number {
  return Math.max(0, seconds * normalizeTempo(tempoBpm) / 60);
}

function toMidiVelocity(velocity: number): number {
  return clampInteger(Math.round(clamp(velocity, 0, 1) * 127), 1, 127);
}

function normalizeTempo(tempoBpm: number): number {
  return Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 90;
}

function beatsToTicks(beats: number): number {
  return Math.max(0, Math.round(beats * MIDI_PPQ));
}

function uint16Bytes(value: number): readonly number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32Bytes(value: number): readonly number[] {
  return [
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ];
}

function variableLengthQuantity(value: number): readonly number[] {
  let buffer = value & 0x7f;
  let remaining = value >> 7;
  while (remaining > 0) {
    buffer <<= 8;
    buffer |= (remaining & 0x7f) | 0x80;
    remaining >>= 7;
  }

  const bytes: number[] = [];
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

function asciiBytes(value: string): readonly number[] {
  return [...value].map((character) => character.charCodeAt(0));
}

function concatenateBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug.length > 0 ? `${slug}-grow-export` : "grow-export";
}

function roundBeat(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(clamp(value, minimum, maximum));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
