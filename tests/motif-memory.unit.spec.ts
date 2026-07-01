import { expect, test } from "@playwright/test";
import {
  capture,
  chooseVariationOp,
  chordRootAtBar,
  createMotifMemory,
  remember,
  latest,
  vary,
  type Motif,
} from "../src/motif-memory";
import type { PlayerPatternSource } from "../src/song-material";

function makeNote(playerId: string, scaleDegree: number, velocity = 0.4, durationBeats = 0.5) {
  return {
    playerId,
    scaleDegree,
    octave: playerId === "bass" ? 2 : 4,
    duration: durationBeats >= 1 ? "4n" : "8n",
    durationBeats,
    velocity,
  };
}

function makeMotif(overrides: Partial<Motif> = {}): Motif {
  return {
    id: "melody-bar-0",
    playerId: "melody",
    barIndex: 0,
    degrees: [2, 4, 5, 3],
    rhythm: [
      { startBeat: 0, durationBeats: 0.5 },
      { startBeat: 1, durationBeats: 0.5 },
      { startBeat: 2, durationBeats: 1 },
      { startBeat: 3.5, durationBeats: 0.5 },
    ],
    dynamics: [0.3, 0.5, 0.8, 0.4],
    ...overrides,
  };
}

test.describe("motif memory", () => {
  test("captures a bounded melody-bar motif from pattern data", () => {
    const pattern: PlayerPatternSource = {
      subdivisionBeats: 0.5,
      events: [
        makeNote("melody", 0),
        null,
        makeNote("melody", 2, 0.55),
        null,
        makeNote("melody", 4, 0.7, 1),
        null,
        makeNote("melody", 5),
        makeNote("melody", 3),
        makeNote("melody", 6),
        makeNote("melody", 5),
        makeNote("melody", 4),
        makeNote("melody", 2),
        makeNote("melody", 1),
        makeNote("melody", 0),
        makeNote("melody", 2),
        makeNote("melody", 4),
      ],
    };

    const firstBar = capture(pattern, 0);
    expect(firstBar).toMatchObject({
      playerId: "melody",
      barIndex: 0,
      degrees: [0, 2, 4, 5, 3],
    });
    expect(firstBar?.rhythm.map((step) => step.startBeat)).toEqual([0, 1, 2, 3, 3.5]);
    expect(firstBar?.rhythm[2]?.durationBeats).toBe(1);

    const secondBar = capture(pattern, 1, { maxNotes: 3 });
    expect(secondBar?.degrees).toEqual([6, 5, 4]);
  });

  test("caps and evicts the oldest motifs while latest returns a clone", () => {
    let memory = createMotifMemory(2);
    memory = remember(memory, makeMotif({ barIndex: 0, id: "m0" }));
    memory = remember(memory, makeMotif({ barIndex: 1, id: "m1" }));
    memory = remember(memory, makeMotif({ barIndex: 2, id: "m2" }));

    expect(memory.pool.map((motif) => motif.barIndex)).toEqual([1, 2]);
    const latestMelody = latest(memory, "melody");
    expect(latestMelody?.barIndex).toBe(2);
    expect(latestMelody).not.toBe(memory.pool[1]);
  });

  test("quote preserves contour and transposes the first degree to the chord root", () => {
    const motif = makeMotif();
    const variation = vary(motif, "quote", { chordRoot: 5 });

    expect(variation.degrees).toEqual([5, 7, 8, 6]);
    expect(intervals(variation.degrees)).toEqual(intervals(motif.degrees));
    expect(normalizeDegree(variation.degrees[0] ?? -1)).toBe(5);
    expect(variation.degrees.every(Number.isInteger)).toBe(true);
  });

  test("invert mirrors intervals around the first degree before chord-root targeting", () => {
    const motif = makeMotif({ degrees: [2, 4, 5] });
    const variation = vary(motif, "invert", { chordRoot: 0 });

    expect(variation.degrees).toEqual([0, -2, -3]);
    expect(intervals(variation.degrees)).toEqual([-2, -1]);
    expect(normalizeDegree(variation.degrees[0] ?? -1)).toBe(0);
  });

  test("thin keeps at most three strongest notes and still targets the chord root", () => {
    const motif = makeMotif({
      degrees: [0, 1, 2, 3, 4],
      dynamics: [0.1, 0.9, 0.2, 0.8, 0.7],
      rhythm: [
        { startBeat: 0, durationBeats: 0.5 },
        { startBeat: 0.5, durationBeats: 1 },
        { startBeat: 1, durationBeats: 0.5 },
        { startBeat: 2, durationBeats: 1 },
        { startBeat: 3, durationBeats: 0.5 },
      ],
    });
    const variation = vary(motif, "thin", { chordRoot: 4, maxNotes: 4 });

    expect(variation.degrees.length).toBeLessThanOrEqual(3);
    expect(variation.degrees).toEqual([4, 6, 7]);
    expect(normalizeDegree(variation.degrees[0] ?? -1)).toBe(4);
  });

  test("derives a deterministic two-chord root alternation from mode root cycles", () => {
    expect(chordRootAtBar(0, "mixolydian")).toBe(0);
    expect(chordRootAtBar(1, "mixolydian")).toBe(6);
    expect(chordRootAtBar(2, "mixolydian")).toBe(0);
    expect(chordRootAtBar(1, "dorian")).toBe(4);
    expect(chordRootAtBar(1, "unknown-mode")).toBe(6);
  });

  test("chooses operations and variations deterministically for a fixed seed and bar", () => {
    const firstOp = chooseVariationOp(12345, 8);
    const secondOp = chooseVariationOp(12345, 8);
    expect(firstOp).toBe(secondOp);

    const motif = makeMotif();
    const first = vary(motif, firstOp, { chordRoot: chordRootAtBar(9, "dorian"), maxNotes: 3 });
    const second = vary(motif, secondOp, { chordRoot: chordRootAtBar(9, "dorian"), maxNotes: 3 });
    expect(first).toEqual(second);
  });
});

function intervals(degrees: readonly number[]): number[] {
  return degrees.slice(1).map((degree, index) => degree - (degrees[index] ?? 0));
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}
