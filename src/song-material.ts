import type * as ToneNS from "tone";

export type SongId = "lantern" | "switchback" | "glass";

export interface PatternNoteSource {
  playerId: string;
  scaleDegree: number;
  octave: number;
  chromaticOffsetSemitones?: number;
  duration: ToneNS.Unit.Time;
  durationBeats: number;
  tags?: readonly string[];
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
  // Per-section melody variants, keyed by section type ("chorus", "bridge",
  // ...). The seed of an expanding set of musically functional section types:
  // a section with a variant plays its own material instead of an arrange-time
  // transform of the verse.
  sectionMelody?: Readonly<Record<string, PlayerPatternSource>>;
  // The song's harmonic sentence: one engine scale degree per bar. When
  // present, the arrange layer follows it instead of guessing roots from the
  // bass pattern — the performed harmony IS the composed harmony.
  rootPlan?: readonly number[];
}

export const DEFAULT_SONG_ID: SongId = "lantern";

function keyboardCompNote(scaleDegree: number, octave: number, velocity: number): PatternNoteSource {
  return {
    playerId: "keyboard",
    scaleDegree,
    octave,
    duration: "2n",
    durationBeats: 1.75,
    tags: ["keyboard:built-in-comp", "keyboard:chord-tone"],
    velocity,
  };
}

export const SONG_MATERIALS: readonly SongMaterial[] = [
  {
    id: "lantern",
    label: "Lantern",
    description: "The original modal pulse, bass, keyboard, and melody loop.",
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
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(0, 3, 0.3),
          keyboardCompNote(4, 3, 0.27),
          keyboardCompNote(6, 3, 0.29),
          keyboardCompNote(4, 3, 0.26),
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(2, 4, 0.27),
          keyboardCompNote(6, 4, 0.24),
          keyboardCompNote(1, 4, 0.25),
          keyboardCompNote(6, 4, 0.23),
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(4, 4, 0.25),
          keyboardCompNote(1, 4, 0.22),
          keyboardCompNote(3, 4, 0.23),
          keyboardCompNote(1, 4, 0.22),
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
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(0, 3, 0.28),
          keyboardCompNote(6, 3, 0.26),
          keyboardCompNote(4, 3, 0.3),
          keyboardCompNote(5, 3, 0.27),
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(2, 4, 0.25),
          keyboardCompNote(1, 4, 0.23),
          keyboardCompNote(6, 4, 0.26),
          keyboardCompNote(0, 4, 0.24),
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(4, 4, 0.23),
          keyboardCompNote(3, 4, 0.22),
          keyboardCompNote(1, 4, 0.24),
          keyboardCompNote(2, 4, 0.22),
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
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(0, 3, 0.24),
          keyboardCompNote(3, 3, 0.22),
          keyboardCompNote(6, 3, 0.2),
          null,
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(2, 4, 0.22),
          keyboardCompNote(5, 4, 0.2),
          keyboardCompNote(1, 4, 0.19),
          null,
        ],
      },
      {
        subdivisionBeats: 2,
        events: [
          keyboardCompNote(4, 4, 0.2),
          keyboardCompNote(0, 4, 0.18),
          keyboardCompNote(3, 4, 0.18),
          null,
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
