import { expect, test } from "@playwright/test";
import { DEFAULT_SONG_ARRANGEMENT, arrangeSongFormPatternEvent, sectionAtBeat } from "../src/song-form";
import { createSongStarterMaterial } from "../src/song-starter-material";
import { createSeededSongMotifPlan } from "../src/song-motif-plan";
import { DEFAULT_SONG_GOAL } from "../src/song-goal";
import { getSongMaterial } from "../src/song-material";
import { createTonalContext } from "../src/tonal-context";

test("the form means something different each pass: duet opening, bridge breakdown, thinned late verses", () => {
  const goal = { ...DEFAULT_SONG_GOAL, tonic: "A", mode: "aeolian" as const, tempoBpm: 120, energy: 0.6, surpriseTarget: 0.5, brightness: 0.4 };
  const starter = {
    source: "deterministic-keywords" as const,
    sourcePrompt: "structure probe",
    baseSongId: "switchback" as const,
    materialSeed: 424242,
    goal,
    playerPlans: [],
    motifPlan: createSeededSongMotifPlan(424242, goal),
  };
  const material = createSongStarterMaterial(getSongMaterial("switchback"), starter);
  const tonalContext = createTonalContext(goal.tonic, goal.mode);

  // performed event counts per (pass, section occurrence, player) over two passes
  const counts = new Map<string, number>();
  const totalBeats = DEFAULT_SONG_ARRANGEMENT.totalBeats * 2;
  for (const pattern of material.patterns) {
    const len = pattern.events.length;
    for (let step = 0; step * pattern.subdivisionBeats < totalBeats; step += 1) {
      const absoluteBeat = step * pattern.subdivisionBeats;
      const arranged = arrangeSongFormPatternEvent({
        song: material, pattern, sourceEvent: pattern.events[step % len] ?? null,
        stepIndex: step, absoluteBeat, tonalContext, arrangement: DEFAULT_SONG_ARRANGEMENT,
      });
      if (!arranged) continue;
      const pass = Math.floor(absoluteBeat / DEFAULT_SONG_ARRANGEMENT.totalBeats);
      const section = sectionAtBeat(absoluteBeat, DEFAULT_SONG_ARRANGEMENT);
      const key = `${pass}:${section.sectionType}${section.occurrence}:${arranged.playerId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const at = (key: string) => counts.get(key) ?? 0;

  // duet opening: the first verse ever is melody and bass alone
  expect(at("0:verse1:melody")).toBeGreaterThan(0);
  expect(at("0:verse1:bass")).toBeGreaterThan(0);
  expect(at("0:verse1:pulse")).toBe(0);
  expect(at("0:verse1:keyboard")).toBe(0);
  // ...and the first chorus is the full-band arrival
  expect(at("0:chorus1:pulse")).toBeGreaterThan(0);
  expect(at("0:chorus1:keyboard")).toBeGreaterThan(0);
  // the same verse on the next pass is NOT the duet: passes differ
  expect(at("1:verse1:keyboard")).toBeGreaterThan(0);
  expect(at("1:verse1:pulse")).toBeGreaterThan(0);
  // alternate-pass bridge breakdown: drums play pass 0, sit out pass 1
  expect(at("0:bridge1:pulse")).toBeGreaterThan(0);
  expect(at("1:bridge1:pulse")).toBe(0);
  expect(at("1:bridge1:melody")).toBeGreaterThan(0);
  // after the first pass, second verses thin: keyboards out
  expect(at("0:verse2:keyboard")).toBeGreaterThan(0);
  expect(at("1:verse2:keyboard")).toBe(0);
  expect(at("1:verse2:bass")).toBeGreaterThan(0);
  // the melody is never dropped anywhere
  for (const pass of [0, 1]) {
    for (const section of ["verse1", "chorus1", "verse2", "chorus2", "bridge1", "chorus3"]) {
      expect(at(`${pass}:${section}:melody`)).toBeGreaterThan(0);
    }
  }
});
