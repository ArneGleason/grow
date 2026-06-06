import type { TonalContext } from "./listening";
import type { PlayerRole } from "./players";
import type { SongMaterial } from "./song-material";

export type SongSketchStatus = "draft";
export type SongSketchAssignmentStance = "anchor" | "support" | "lead" | "respond";

export interface SongSketchPlayerRef {
  playerId: string;
  role: PlayerRole;
}

export interface SongSketchSection {
  id: string;
  label: string;
  startBeat: number;
  durationBeats: number;
  chordPlan: readonly string[];
  cue: string;
}

export interface SongSketchAssignment {
  playerId: string;
  role: PlayerRole;
  stance: SongSketchAssignmentStance;
  brief: string;
  constraints: readonly string[];
}

export interface SongSketch {
  id: string;
  title: string;
  status: SongSketchStatus;
  sourceSongId: SongMaterial["id"];
  proposerPlayerId: string;
  affectedPlayerIds: readonly string[];
  createdAtBeat: number;
  meter: [number, number];
  tonalContext: {
    tonic: string;
    mode: string;
    scale: readonly string[];
  };
  sections: readonly SongSketchSection[];
  assignments: readonly SongSketchAssignment[];
  openQuestions: readonly string[];
}

export function createInspectOnlySongSketch(input: {
  song: SongMaterial;
  players: readonly SongSketchPlayerRef[];
  tonalContext: TonalContext;
  currentBeat: number;
  meter?: [number, number];
}): SongSketch {
  const proposer = input.players.find((player) => player.role === "melody") ?? input.players[0];
  const chordPlan = createModalChordPlan(input.tonalContext.scale);

  return {
    id: `sketch-${input.song.id}-${input.tonalContext.tonic.toLowerCase()}-${input.tonalContext.mode}`,
    title: `${input.song.label} working sketch`,
    status: "draft",
    sourceSongId: input.song.id,
    proposerPlayerId: proposer?.playerId ?? "ensemble",
    affectedPlayerIds: input.players.map((player) => player.playerId),
    createdAtBeat: roundBeat(input.currentBeat),
    meter: input.meter ?? [4, 4],
    tonalContext: {
      tonic: input.tonalContext.tonic,
      mode: input.tonalContext.mode,
      scale: [...input.tonalContext.scale],
    },
    sections: [
      {
        id: "gather",
        label: "Gather",
        startBeat: 0,
        durationBeats: 8,
        chordPlan,
        cue: "Establish the floor and leave enough space for a motif to be noticed.",
      },
      {
        id: "answer",
        label: "Answer",
        startBeat: 8,
        durationBeats: 8,
        chordPlan: [...chordPlan].reverse(),
        cue: "Let one player answer the first idea while the others decide whether to support or resist.",
      },
    ],
    assignments: input.players.map(createAssignment),
    openQuestions: [
      "Who owns the first repeatable motif?",
      "Should the second section answer, thin out, or argue with the first?",
      "What cue tells the group this draft is ready to practice?",
    ],
  };
}

function createAssignment(player: SongSketchPlayerRef): SongSketchAssignment {
  if (player.role === "pulse") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "anchor",
      brief: "Mark the shared floor and make section changes legible.",
      constraints: ["avoid constant fill", "leave breaks intentional"],
    };
  }

  if (player.role === "bass") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "support",
      brief: "Outline the chord shadows and decide where density should relax.",
      constraints: ["stay modal", "answer melody without taking over"],
    };
  }

  if (player.role === "melody") {
    return {
      playerId: player.playerId,
      role: player.role,
      stance: "lead",
      brief: "Bring one motif that can survive repetition and invite an answer.",
      constraints: ["keep register shifts bounded", "leave room for bass response"],
    };
  }

  return {
    playerId: player.playerId,
    role: player.role,
    stance: "respond",
    brief: "React to the emerging section shape without forcing a new form.",
    constraints: ["stay inspectable", "avoid private key changes"],
  };
}

function createModalChordPlan(scale: readonly string[]): readonly string[] {
  if (scale.length === 0) return ["I", "I", "I", "I"];
  return [
    scale[0] ?? "I",
    scale[6] ?? scale[4] ?? scale[0] ?? "I",
    scale[3] ?? scale[0] ?? "I",
    scale[0] ?? "I",
  ];
}

function roundBeat(value: number): number {
  return Math.round(value * 100) / 100;
}
