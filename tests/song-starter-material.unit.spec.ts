import { expect, test } from "@playwright/test";
import type { HarmonyChordEvent } from "../src/voice-led-harmony";
import type { PatternNoteSource, SongMaterial } from "../src/song-material";
import type { SongLibraryStarter } from "../src/song-library";
import { DEFAULT_SONG_GOAL } from "../src/song-goal";
import { getSongMaterial } from "../src/song-material";
import { createSongStarterMaterial } from "../src/song-starter-material";
import { createTonalContext } from "../src/tonal-context";
import { generateVoiceLedHarmonyDraft } from "../src/voice-led-harmony";

interface TimedPatternNote extends PatternNoteSource {
  startBeat: number;
}

test.describe("song starter material", () => {
  test("binds strong melody anchors to the active voice-led chord tones", () => {
    const starter = createStarter();
    const material = createSongStarterMaterial(getSongMaterial("switchback"), starter);
    const draft = createDraftForStarter(starter);
    const bound = melodyEvents(material).filter((event) => event.tags?.includes("melody:harmony-bound"));

    expect(bound.length).toBeGreaterThan(8);
    expect(new Set(bound.map((event) => Math.floor(event.startBeat / 4))).size).toBeGreaterThanOrEqual(7);

    for (const event of bound) {
      const chord = chordTaggedByMelodyEvent(draft.chordEvents, event) ?? chordAtBeat(draft.chordEvents, event.startBeat);
      expect(chord).toBeDefined();
      expect(chordDegreeClasses(chord!).has(normalizeDegree(event.scaleDegree))).toBe(true);
    }
  });

  test("resolves chromatic melody connectors to a following harmony-bound anchor", () => {
    const starter = createStarter({
      sourcePrompt: "blue chromatic glass line with glides resolving into each chord",
      materialSeed: 9017,
      surpriseTarget: 0.72,
    });
    const material = createSongStarterMaterial(getSongMaterial("glass"), starter);
    const events = melodyEvents(material);
    const bound = events.filter((event) => event.tags?.includes("melody:harmony-bound"));
    const chromaticConnectors = events.filter((event) =>
      event.tags?.includes("connector:chromatic") &&
      event.tags?.includes("melody:resolves-to-chord")
    );

    expect(chromaticConnectors.length).toBeGreaterThan(0);
    for (const connector of chromaticConnectors) {
      const resolutionId = connector.tags
        ?.find((tag) => tag.startsWith("resolution:harmony-chord-"))
        ?.replace("resolution:", "");
      const resolution = bound.find((event) =>
        event.startBeat > connector.startBeat &&
        event.startBeat - connector.startBeat <= 2.25 &&
        (!resolutionId || event.tags?.includes(`harmony:${resolutionId}`))
      );
      expect(resolution).toBeDefined();
    }
  });

  test("lands the final melody cadence on the final chord root", () => {
    const starter = createStarter({ materialSeed: 424242, energy: 0.64 });
    const material = createSongStarterMaterial(getSongMaterial("lantern"), starter);
    const draft = createDraftForStarter(starter);
    const finalCadence = melodyEvents(material)
      .filter((event) => event.tags?.includes("melody:cadence"))
      .at(-1);
    const finalChord = finalCadence
      ? chordTaggedByMelodyEvent(draft.chordEvents, finalCadence) ?? chordAtBeat(draft.chordEvents, finalCadence.startBeat)
      : undefined;

    expect(finalCadence).toBeDefined();
    expect(finalChord).toBeDefined();
    expect(normalizeDegree(finalCadence!.scaleDegree)).toBe(normalizeDegree(finalChord!.rootDegree));
  });

  test("varies melody and harmony leadership across generated starters", () => {
    const materials = [1101, 2202, 3303, 4404, 5505].map((materialSeed) =>
      createSongStarterMaterial(getSongMaterial("switchback"), createStarter({ materialSeed }))
    );
    const events = materials.flatMap((material) => timedEvents(material));
    const melodyEvents = events.filter((event) => event.playerId === "melody");
    const supportEvents = events.filter((event) => event.playerId === "bass" || event.playerId === "keyboard");

    expect(melodyEvents.some((event) => event.tags?.includes("melody:leads-harmony"))).toBe(true);
    expect(melodyEvents.some((event) => event.tags?.includes("melody:follows-harmony"))).toBe(true);
    expect(supportEvents.some((event) => event.tags?.includes("harmony:follows-melody"))).toBe(true);
    expect(supportEvents.some((event) => event.tags?.includes("harmony:leads-melody"))).toBe(true);
  });
});

function createStarter(overrides: {
  energy?: number;
  materialSeed?: number;
  sourcePrompt?: string;
  surpriseTarget?: number;
} = {}): SongLibraryStarter {
  const sourcePrompt = overrides.sourcePrompt ?? "slow G dorian wide return basement machinery with glass hooks";
  const goal = {
    ...DEFAULT_SONG_GOAL,
    id: "test-starter-goal",
    sourceIdea: sourcePrompt,
    tonic: "G",
    mode: "dorian",
    tempoBpm: 75,
    energy: overrides.energy ?? 0.66,
    surpriseTarget: overrides.surpriseTarget ?? 0.62,
    brightness: 0.48,
    formPreference: "wide-return",
    dispositionBias: { bass: 0.08, melody: 0.12 },
    influenceHints: ["glass-bright", "wide-return"],
    sectionEmphasis: { verse: 0.34, chorus: 0.82, bridge: 0.58 },
    brief: "test starter goal",
  } as const;
  return {
    source: "deterministic-keywords",
    sourcePrompt,
    baseSongId: "switchback",
    materialSeed: overrides.materialSeed ?? 4242,
    structureSummary: "test voice-led harmony draft",
    goal,
    playerPlans: [
      { playerId: "pulse", role: "pulse", enabled: true, brief: "mark the pulse" },
      { playerId: "bass", role: "bass", enabled: true, brief: "ground the chord roots" },
      { playerId: "keyboard", role: "texture", enabled: true, brief: "voice the chord bed" },
      { playerId: "melody", role: "melody", enabled: true, brief: "bind melody to harmony" },
    ],
  };
}

function createDraftForStarter(starter: SongLibraryStarter) {
  return generateVoiceLedHarmonyDraft({
    seed: starter.materialSeed,
    bars: 8,
    tonalContext: createTonalContext(starter.goal.tonic, starter.goal.mode),
    ambiguity: starter.goal.surpriseTarget,
    motion: starter.goal.energy,
  });
}

function melodyEvents(material: SongMaterial): TimedPatternNote[] {
  const pattern = material.patterns.find((candidate) =>
    candidate.events.some((event) => event?.playerId === "melody")
  );
  if (!pattern) throw new Error("Expected a melody pattern");
  return pattern.events
    .map((event, index) => event ? { ...event, startBeat: index * pattern.subdivisionBeats } : null)
    .filter((event): event is TimedPatternNote => event !== null);
}

function timedEvents(material: SongMaterial): TimedPatternNote[] {
  return material.patterns.flatMap((pattern) =>
    pattern.events
      .map((event, index) => event ? { ...event, startBeat: index * pattern.subdivisionBeats } : null)
      .filter((event): event is TimedPatternNote => event !== null)
  );
}

function chordAtBeat(
  chords: readonly HarmonyChordEvent[],
  beat: number,
): HarmonyChordEvent | undefined {
  return [...chords].reverse().find((chord) =>
    chord.startBeat <= beat && chord.startBeat + chord.durationBeats > beat
  ) ?? chords.find((chord) => chord.startBeat >= beat);
}

function chordTaggedByMelodyEvent(
  chords: readonly HarmonyChordEvent[],
  event: PatternNoteSource,
): HarmonyChordEvent | undefined {
  return chords.find((chord) => event.tags?.includes(`harmony:${chord.id}`));
}

function chordDegreeClasses(chord: HarmonyChordEvent): Set<number> {
  return new Set([chord.rootDegree, ...chord.degrees].map(normalizeDegree));
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

test("motif songs get a groove: kick anchors, snare answers, hats breathe, a fill tumbles into the loop", () => {
  const base = createStarter({ energy: 0.7, materialSeed: 909 });
  const starter = {
    ...base,
    motifPlan: {
      version: "grow.songMotifPlan/1" as const,
      source: "seeded" as const,
      cellSteps: [0, 2, -1, -1, 2],
      cellRhythm: [0.5, 0.5, 0.5, 0.5, 0.5],
      move: "lean" as const,
      peakBar: 5,
      chorusTransform: "wider" as const,
      mood: "",
    },
  };
  const material = createSongStarterMaterial(getSongMaterial("switchback"), starter);
  const pulse = material.patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "pulse")
  )!;
  expect(pulse.subdivisionBeats).toBe(0.25);
  const notes = pulse.events
    .map((event, index) => (event ? { beat: index * pulse.subdivisionBeats, event } : null))
    .filter((entry): entry is { beat: number; event: NonNullable<typeof entry>["event"] } => entry !== null);
  const norm = (d: number) => ((d % 7) + 7) % 7;
  for (let bar = 0; bar < 8; bar += 1) {
    const downbeat = notes.find((n) => n.beat === bar * 4);
    expect(downbeat).toBeDefined();
    expect(norm(downbeat!.event.scaleDegree)).toBe(0);
    const backbeat = notes.find((n) => n.beat === bar * 4 + 2);
    expect(backbeat).toBeDefined();
    expect(norm(backbeat!.event.scaleDegree)).toBe(2);
  }
  const offbeatHats = notes.filter((n) => n.beat % 1 === 0.5 && norm(n.event.scaleDegree) === 3);
  expect(offbeatHats.length).toBeGreaterThanOrEqual(16);
  const fill = notes.filter((n) => n.beat >= 31 && norm(n.event.scaleDegree) !== 3);
  expect(fill.length).toBeGreaterThanOrEqual(3);
  const calm = createSongStarterMaterial(getSongMaterial("switchback"), {
    ...starter,
    goal: { ...starter.goal, energy: 0.2 },
  });
  const calmPulse = calm.patterns.find((pattern) =>
    pattern.events.some((event) => event?.playerId === "pulse")
  )!;
  const calmCount = calmPulse.events.filter((event) => event !== null).length;
  const busyCount = pulse.events.filter((event) => event !== null).length;
  expect(busyCount).toBeGreaterThan(calmCount);
  const again = createSongStarterMaterial(getSongMaterial("switchback"), starter);
  expect(again.patterns).toEqual(material.patterns);
});
