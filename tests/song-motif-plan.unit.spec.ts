import { expect, test } from "@playwright/test";
import {
  SONG_MOTIF_BAR_COUNT,
  SONG_MOTIF_HARMONIC_MOVES,
  SONG_MOTIF_MOVE_ROOTS,
  createSeededSongMotifPlan,
  developSongMotifMelodyPattern,
  developSongMotifWalk,
  expandSongMotifPlanToDraftPlan,
  isDegenerateMotifCell,
  validateSongMotifPlanResponse,
  type SongMotifPlan,
} from "../src/song-motif-plan";

const norm = (degree: number) => ((Math.trunc(degree) % 7) + 7) % 7;

test.describe("Song motif plan", () => {
  test("validates, clamps, and rejects degenerate cells", () => {
    const ok = validateSongMotifPlanResponse({
      cellSteps: [2, 9, -1, -4, 1],
      cellRhythm: [1, 0.6, 0.75, 3, 0.5],
      move: "lean",
      peakBar: 11,
      chorusTransform: "invert",
      mood: "tense and bright",
    });
    expect(ok.valid).toBe(true);
    expect(ok.plan!.cellSteps[0]).toBe(0);
    expect(ok.plan!.cellSteps.every((s) => s >= -3 && s <= 3)).toBe(true);
    expect(ok.plan!.cellRhythm).toEqual([1, 0.5, 0.75, 2, 0.5]);
    expect(ok.plan!.peakBar).toBe(7);

    expect(validateSongMotifPlanResponse({
      cellSteps: [0, 0, 0, 0], cellRhythm: [1, 1, 1, 1], move: "settle", peakBar: 4, chorusTransform: "wider", mood: "",
    }).valid).toBe(false);
    expect(validateSongMotifPlanResponse({
      cellSteps: [0, 1, -1, 2], cellRhythm: [1, 1, 1, 1], move: "spiral", peakBar: 4, chorusTransform: "wider", mood: "",
    }).valid).toBe(false);
    expect(isDegenerateMotifCell([0, 0, 0, 0])).toBe(true);
    expect(isDegenerateMotifCell([0, 1, -1, 2])).toBe(false);
  });

  test("every harmonic move is a real sentence that arrives V then I", () => {
    for (const move of SONG_MOTIF_HARMONIC_MOVES) {
      const roots = SONG_MOTIF_MOVE_ROOTS[move];
      expect(roots).toHaveLength(SONG_MOTIF_BAR_COUNT);
      expect(roots.every((r) => r >= 0 && r <= 6)).toBe(true);
      expect(roots[0]).toBe(0);
      expect(roots[6]).toBe(4);
      expect(roots[7]).toBe(0);
    }
    const rootLines = new Set(SONG_MOTIF_HARMONIC_MOVES.map((m) => SONG_MOTIF_MOVE_ROOTS[m].join(",")));
    expect(rootLines.size).toBe(SONG_MOTIF_HARMONIC_MOVES.length);
  });

  test("seeded plans are deterministic, valid, and cover the move space", () => {
    const a = createSeededSongMotifPlan(12345, { energy: 0.5, brightness: 0.5, surpriseTarget: 0.5 });
    const b = createSeededSongMotifPlan(12345, { energy: 0.5, brightness: 0.5, surpriseTarget: 0.5 });
    expect(a).toEqual(b);
    const moves = new Set<string>();
    for (let seed = 1; seed <= 96; seed += 1) {
      const plan = createSeededSongMotifPlan(seed);
      expect(isDegenerateMotifCell(plan.cellSteps)).toBe(false);
      expect(plan.cellSteps.length).toBe(plan.cellRhythm.length);
      moves.add(plan.move);
    }
    expect(moves.size).toBeGreaterThanOrEqual(3);
  });

  test("expansion fills the draft-plan contract with the sentence and the peak", () => {
    const plan = createSeededSongMotifPlan(777);
    const draft = expandSongMotifPlanToDraftPlan(plan, 777);
    expect(draft.bars).toHaveLength(SONG_MOTIF_BAR_COUNT);
    draft.bars.forEach((bar, index) => {
      expect(bar.rootDegree).toBe(norm(SONG_MOTIF_MOVE_ROOTS[plan.move][index]!) + 1);
      expect(bar.tension).toBeGreaterThanOrEqual(0);
      expect(bar.tension).toBeLessThanOrEqual(1);
    });
    expect(draft.bars[3]!.cadence).toBe("half");
    expect(draft.bars[7]!.cadence).toBe("home");
    const peakTension = draft.bars[plan.peakBar]!.tension;
    for (const bar of draft.bars) {
      if (bar.barIndex !== plan.peakBar) expect(peakTension).toBeGreaterThanOrEqual(bar.tension - 0.001);
    }
  });

  test("the developed melody IS the cell: entries voice-led, motif interval identity, cadence arrivals", () => {
    const plan: SongMotifPlan = {
      version: "grow.songMotifPlan/1",
      source: "seeded",
      cellSteps: [0, 2, -1, -1, 2],
      cellRhythm: [0.5, 0.5, 0.5, 0.5, 0.5],
      move: "lean",
      peakBar: 5,
      chorusTransform: "answer",
      mood: "",
    };
    const walkA = developSongMotifWalk(plan, 4242);
    const walkB = developSongMotifWalk(plan, 4242);
    expect(walkA).toEqual(walkB);
    const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
    const prefix = plan.cellSteps.slice(1, 4).join(",");
    const inverted = plan.cellSteps.slice(1, 4).map((step) => -step).join(",");
    let literal = 0;
    let recognized = 0;
    walkA.bars.forEach((bar, barIndex) => {
      expect(bar.length).toBeGreaterThan(0);
      const chordTones = [0, 2, 4].map((offset) => norm(roots[barIndex]! + offset));
      expect(chordTones).toContain(norm(bar[0]!.degree));
      if (barIndex !== 3 && barIndex !== 7) {
        const intervals = bar.slice(1).map((note, i) => note.degree - bar[i]!.degree).join(",");
        if (intervals.startsWith(prefix)) { literal += 1; recognized += 1; }
        else if (intervals.startsWith(inverted)) recognized += 1;
        else if (bar.length > plan.cellSteps.length || bar.length < plan.cellSteps.length) recognized += 1;
      }
      if (barIndex === 3 || barIndex === 7) {
        const last = bar[bar.length - 1]!;
        expect(last.cadence).toBe(true);
        expect(last.durationBeats).toBeGreaterThanOrEqual(1);
        expect(chordTones).toContain(norm(last.degree));
      }
    });
    expect(literal).toBeGreaterThanOrEqual(2);
    expect(recognized).toBeGreaterThanOrEqual(5);
    const opsA = walkA.bars.length;
    expect(opsA).toBe(8);
    const pattern = developSongMotifMelodyPattern(plan, { seed: 4242 });
    const active = pattern.events.filter((event) => event !== null);
    expect(active.length).toBeGreaterThan(SONG_MOTIF_BAR_COUNT);
    expect(active.every((event) => Number.isInteger(event!.scaleDegree))).toBe(true);
    expect(pattern.events.some((event) => event === null)).toBe(true);
  });
});
