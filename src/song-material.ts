import type * as ToneNS from "tone";

export type SongId = "lantern" | "switchback" | "glass";

export interface PatternNoteSource {
  playerId: string;
  scaleDegree: number;
  octave: number;
  duration: ToneNS.Unit.Time;
  durationBeats: number;
  velocity: number;
}

export interface PlayerPatternSource {
  subdivisionBeats: number;
  events: Array<PatternNoteSource | null>;
}

export interface SongMaterial {
  id: SongId;
  label: string;
  description: string;
  patterns: readonly PlayerPatternSource[];
}

export const DEFAULT_SONG_ID: SongId = "lantern";

export const SONG_MATERIALS: readonly SongMaterial[] = [
  {
    id: "lantern",
    label: "Lantern",
    description: "The original modal pulse, bass, and melody loop.",
    patterns: [
      {
        subdivisionBeats: 1,
        events: [
          {
            playerId: "pulse",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.74,
          },
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          {
            playerId: "bass",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.54,
          },
          null,
          null,
          {
            playerId: "bass",
            scaleDegree: 4,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.44,
          },
          {
            playerId: "bass",
            scaleDegree: 6,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.48,
          },
          null,
          {
            playerId: "bass",
            scaleDegree: 4,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.42,
          },
          null,
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          null,
          {
            playerId: "melody",
            scaleDegree: 2,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          {
            playerId: "melody",
            scaleDegree: 4,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.32,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 5,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          {
            playerId: "melody",
            scaleDegree: 4,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.24,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 1,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.3,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 0,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.26,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 2,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          {
            playerId: "melody",
            scaleDegree: 4,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.3,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 6,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.24,
          },
          null,
        ],
      },
    ],
  },
  {
    id: "switchback",
    label: "Switchback",
    description: "A more syncopated loop with bass answers and a stepped melody.",
    patterns: [
      {
        subdivisionBeats: 1,
        events: [
          {
            playerId: "pulse",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.7,
          },
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          {
            playerId: "bass",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.5,
          },
          null,
          {
            playerId: "bass",
            scaleDegree: 6,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.42,
          },
          null,
          null,
          {
            playerId: "bass",
            scaleDegree: 4,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.46,
          },
          {
            playerId: "bass",
            scaleDegree: 5,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.44,
          },
          null,
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          {
            playerId: "melody",
            scaleDegree: 5,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 3,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.26,
          },
          {
            playerId: "melody",
            scaleDegree: 4,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.3,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 2,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.26,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 1,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          {
            playerId: "melody",
            scaleDegree: 0,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.24,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 2,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.28,
          },
          null,
        ],
      },
    ],
  },
  {
    id: "glass",
    label: "Glass",
    description: "A sparser loop with wider air around the melody.",
    patterns: [
      {
        subdivisionBeats: 1,
        events: [
          {
            playerId: "pulse",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.64,
          },
          {
            playerId: "pulse",
            scaleDegree: 0,
            octave: 2,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.72,
          },
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          {
            playerId: "bass",
            scaleDegree: 0,
            octave: 2,
            duration: "4n",
            durationBeats: 1,
            velocity: 0.48,
          },
          null,
          null,
          null,
          {
            playerId: "bass",
            scaleDegree: 3,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.4,
          },
          null,
          null,
          {
            playerId: "bass",
            scaleDegree: 6,
            octave: 1,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.38,
          },
        ],
      },
      {
        subdivisionBeats: 0.5,
        events: [
          null,
          null,
          {
            playerId: "melody",
            scaleDegree: 6,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.24,
          },
          null,
          null,
          {
            playerId: "melody",
            scaleDegree: 4,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.26,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 2,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.22,
          },
          null,
          null,
          {
            playerId: "melody",
            scaleDegree: 5,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.24,
          },
          null,
          {
            playerId: "melody",
            scaleDegree: 3,
            octave: 4,
            duration: "8n",
            durationBeats: 0.5,
            velocity: 0.22,
          },
          null,
          null,
          null,
        ],
      },
    ],
  },
];

export function isSongId(value: string): value is SongId {
  return SONG_MATERIALS.some((material) => material.id === value);
}

export function getSongMaterial(songId: SongId): SongMaterial {
  return SONG_MATERIALS.find((material) => material.id === songId) ?? SONG_MATERIALS[0];
}
