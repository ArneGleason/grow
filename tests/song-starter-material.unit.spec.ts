import { expect, test } from "@playwright/test";
import {
  createSongStarterMaterial,
  createStarterMaterialProfile,
} from "../src/song-starter-material";
import { SONG_MATERIALS, type PatternNoteSource, type SongMaterial } from "../src/song-material";
import type { SongLibraryStarter } from "../src/song-library";
import type { SongGoal } from "../src/song-goal";

const BASE_MATERIAL = SONG_MATERIALS.find((material) => material.id === "switchback") ?? SONG_MATERIALS[0];

function makeStarter(
  sourcePrompt: string,
  patch: Partial<SongGoal> & { materialSeed?: number; bassBrief?: string } = {},
): SongLibraryStarter {
  const goal: SongGoal = {
    id: `goal-${patch.materialSeed ?? 1}`,
    status: "deterministic",
    sourceIdea: sourcePrompt,
    tonic: patch.tonic ?? "C",
    mode: patch.mode ?? "dorian",
    tempoBpm: patch.tempoBpm ?? 100,
    energy: patch.energy ?? 0.55,
    surpriseTarget: patch.surpriseTarget ?? 0.45,
    brightness: patch.brightness ?? 0.45,
    formPreference: patch.formPreference ?? "classic-arc",
    dispositionBias: patch.dispositionBias ?? {},
    influenceHints: patch.influenceHints ?? [],
    sectionEmphasis: patch.sectionEmphasis ?? {},
    brief: patch.brief ?? sourcePrompt,
    rationale: patch.rationale,
  };

  return {
    source: "deterministic-keywords",
    sourcePrompt,
    baseSongId: BASE_MATERIAL.id,
    materialSeed: patch.materialSeed ?? 101,
    structureSummary: "Unit test structure",
    goal,
    playerPlans: [
      { playerId: "pulse", role: "pulse", enabled: true, brief: "Hold the room." },
      { playerId: "bass", role: "bass", enabled: true, brief: patch.bassBrief ?? "Support the root." },
      { playerId: "melody", role: "melody", enabled: true, brief: "Carry the phrase." },
    ],
  };
}

function notesFor(material: SongMaterial, playerId: string): Array<PatternNoteSource & { beat: number }> {
  const pattern = material.patterns.find((candidate) =>
    candidate.events.some((event) => event?.playerId === playerId)
  );
  if (!pattern) return [];
  return pattern.events.flatMap((event, index) =>
    event
      ? [{ ...event, beat: index * pattern.subdivisionBeats }]
      : []
  );
}

function materialSignature(material: SongMaterial): string {
  return material.patterns.map((pattern) =>
    pattern.events.map((event, index) =>
      event
        ? `${event.playerId}@${index}:${event.scaleDegree}:${event.octave}:${event.durationBeats}:${event.velocity}:${event.tags?.join(",") ?? ""}`
        : "-"
    ).join("|")
  ).join("\n");
}

test.describe("song starter material variation", () => {
  test("chooses distinct bounded profiles from prompt and goal hints", () => {
    expect(createStarterMaterialProfile(makeStarter("slow wide patient shadow", {
      energy: 0.28,
      influenceHints: ["wide-return", "dub-space"],
      materialSeed: 11,
    }), 11)).toMatchObject({
      pulseStyle: "grounded",
      bassStyle: "sparse",
      melodyStyle: "spacious",
    });

    expect(createStarterMaterialProfile(makeStarter("bright glass hook sparkle", {
      brightness: 0.82,
      influenceHints: ["glass-bright", "restless-hook"],
      materialSeed: 22,
    }), 22)).toMatchObject({
      pulseStyle: "syncopated",
      bassStyle: "leap",
      melodyStyle: "spark",
    });

    expect(createStarterMaterialProfile(makeStarter("restless machine motor grid", {
      surpriseTarget: 0.78,
      influenceHints: ["machine-hum"],
      materialSeed: 33,
    }), 33)).toMatchObject({
      pulseStyle: "ticking",
      melodyStyle: "angular",
    });
  });

  test("is deterministic for the same starter and audibly divergent across prompts", () => {
    const slowStarter = makeStarter("slow wide patient shadow", {
      energy: 0.28,
      materialSeed: 111,
    });
    const brightStarter = makeStarter("bright glass hook sparkle", {
      brightness: 0.82,
      materialSeed: 222,
    });
    const slowMaterial = createSongStarterMaterial(BASE_MATERIAL, slowStarter);
    const repeatedSlowMaterial = createSongStarterMaterial(BASE_MATERIAL, slowStarter);
    const brightMaterial = createSongStarterMaterial(BASE_MATERIAL, brightStarter);

    expect(repeatedSlowMaterial).toEqual(slowMaterial);
    expect(materialSignature(brightMaterial)).not.toBe(materialSignature(slowMaterial));
    expect(notesFor(brightMaterial, "melody").length).toBeGreaterThan(notesFor(slowMaterial, "melody").length);
    expect(notesFor(slowMaterial, "melody").every((note) => note.tags?.includes("starter:melody:spacious"))).toBe(true);
    expect(notesFor(brightMaterial, "melody").some((note) => note.tags?.includes("starter:pickup"))).toBe(true);
  });

  test("keeps generated profiles bounded to sixteen-beat integer-degree phrase packs", () => {
    const starters = [
      makeStarter("slow wide patient shadow", { energy: 0.28, materialSeed: 111 }),
      makeStarter("bright phrygian glass hook", { mode: "phrygian", brightness: 0.82, materialSeed: 222 }),
      makeStarter("restless machine motor grid walk", { surpriseTarget: 0.78, bassBrief: "Walk with the motor.", materialSeed: 333 }),
    ];
    const materials = starters.map((starter) => createSongStarterMaterial(BASE_MATERIAL, starter));
    const signatures = new Set(materials.map(materialSignature));
    const bassOnsets = new Set(materials.map((material) =>
      notesFor(material, "bass").map((note) => note.beat).join(",")
    ));

    expect(signatures.size).toBe(materials.length);
    expect(bassOnsets.size).toBe(materials.length);
    for (const material of materials) {
      for (const pattern of material.patterns) {
        expect(pattern.events.length * pattern.subdivisionBeats).toBe(16);
      }
      for (const playerId of ["pulse", "bass", "melody"]) {
        expect(notesFor(material, playerId).length).toBeGreaterThan(0);
      }
      for (const pattern of material.patterns) {
        for (const event of pattern.events) {
          if (!event) continue;
          expect(Number.isInteger(event.scaleDegree)).toBe(true);
          expect(event.velocity).toBeGreaterThanOrEqual(0.12);
          expect(event.velocity).toBeLessThanOrEqual(0.9);
        }
      }
    }
  });
});
