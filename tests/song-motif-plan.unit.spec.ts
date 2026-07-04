import { expect, test } from "@playwright/test";
import { DEFAULT_SONG_ARRANGEMENT, arrangeSongFormPatternEvent } from "../src/song-form";
import { selectPulseDrumHit } from "../src/pulse-drums";
import { createTonalContext } from "../src/tonal-context";
import {
  SONG_MOTIF_BAR_COUNT,
  developSongMotifChorusMelodyPattern,
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

  test("the chorus is its own functional section: transformed cell, lifted arc, served by arrange", () => {
    const base: SongMotifPlan = {
      version: "grow.songMotifPlan/1",
      source: "seeded",
      cellSteps: [0, 2, -1, -1, 2],
      cellRhythm: [0.5, 0.5, 0.5, 0.5, 0.5],
      move: "lean",
      peakBar: 5,
      chorusTransform: "invert",
      mood: "",
    };
    const verse = developSongMotifMelodyPattern(base, { seed: 4242 });
    const firstBar = (pattern: ReturnType<typeof developSongMotifMelodyPattern>) =>
      pattern.events.map((e, i) => e ? { b: i * pattern.subdivisionBeats, d: e.scaleDegree } : null)
        .filter((x): x is { b: number; d: number } => x !== null && x.b < 4);

    const inverted = developSongMotifChorusMelodyPattern({ ...base, chorusTransform: "invert" }, { seed: 4242 });
    const vBar = firstBar(verse); const iBar = firstBar(inverted);
    for (let i = 1; i < Math.min(vBar.length, iBar.length, base.cellSteps.length); i += 1) {
      expect(iBar[i]!.d - iBar[i - 1]!.d).toBe(-(vBar[i]!.d - vBar[i - 1]!.d));
    }

    const doubled = developSongMotifChorusMelodyPattern({ ...base, chorusTransform: "double-time" }, { seed: 4242 });
    expect(firstBar(doubled).length).toBeGreaterThan(vBar.length);

    const wider = developSongMotifChorusMelodyPattern({ ...base, chorusTransform: "wider" }, { seed: 4242 });
    const meanAbs = (bar: readonly { d: number }[]) =>
      bar.slice(1).reduce((sum, n, i) => sum + Math.abs(n.d - bar[i]!.d), 0) / Math.max(1, bar.length - 1);
    expect(meanAbs(firstBar(wider))).toBeGreaterThan(meanAbs(vBar));

    const chorusA = developSongMotifChorusMelodyPattern(base, { seed: 4242 });
    const chorusB = developSongMotifChorusMelodyPattern(base, { seed: 4242 });
    expect(chorusA).toEqual(chorusB);
    const active = chorusA.events.filter((e) => e !== null);
    expect(active.every((e) => e!.tags?.includes("melody:section-chorus"))).toBe(true);

    const song = {
      id: "lantern" as const,
      label: "t", description: "t",
      patterns: [verse],
      sectionMelody: { chorus: chorusA },
    };
    const tonalContext = createTonalContext("C", "mixolydian");
    const chorusBeat = 32; // first chorus bar 0 in the default form
    const arranged = arrangeSongFormPatternEvent({
      song, pattern: verse, sourceEvent: verse.events[0] ?? null,
      stepIndex: Math.round(chorusBeat / verse.subdivisionBeats),
      absoluteBeat: chorusBeat, tonalContext, arrangement: DEFAULT_SONG_ARRANGEMENT,
    });
    expect(arranged?.tags).toContain("melody:section-chorus");
    const versed = arrangeSongFormPatternEvent({
      song, pattern: verse, sourceEvent: verse.events[0] ?? null,
      stepIndex: 0, absoluteBeat: 0, tonalContext, arrangement: DEFAULT_SONG_ARRANGEMENT,
    });
    expect(versed?.tags ?? []).not.toContain("melody:section-chorus");
  });

  test("cadence bite: home cadence approaches by leading tone, raised only in flat-7 modes", () => {
    const plan: SongMotifPlan = {
      version: "grow.songMotifPlan/1",
      source: "seeded",
      cellSteps: [0, 2, -1, -1, 2],
      cellRhythm: [0.5, 0.5, 0.5, 0.5, 0.5],
      move: "lean",
      peakBar: 5,
      chorusTransform: "wider",
      mood: "",
    };
    const walk = developSongMotifWalk(plan, 4242);
    const finalBar = walk.bars[7]!;
    expect(finalBar.length).toBeGreaterThanOrEqual(2);
    const approach = finalBar[finalBar.length - 2]!;
    const arrival = finalBar[finalBar.length - 1]!;
    expect(approach.leading).toBe(true);
    expect(arrival.degree - approach.degree).toBe(1);

    const raised = developSongMotifMelodyPattern(plan, { seed: 4242, raiseLeadingTone: true });
    const raisedNotes = raised.events.filter((e) => e !== null && e.chromaticOffsetSemitones === 1);
    expect(raisedNotes.length).toBeGreaterThanOrEqual(1);
    expect(raisedNotes.every((e) => e!.tags?.includes("melody:leading-tone"))).toBe(true);

    const plain = developSongMotifMelodyPattern(plan, { seed: 4242, raiseLeadingTone: false });
    expect(plain.events.some((e) => e !== null && e.chromaticOffsetSemitones)).toBe(false);
  });

  test("the kit is offbeat-aware: hats between beats never become snare or kick", () => {
    expect(selectPulseDrumHit({ absoluteBeat: 0, scaleDegree: 0, velocity: 0.8 }).id).toBe("kick");
    expect(selectPulseDrumHit({ absoluteBeat: 2, scaleDegree: 3, velocity: 0.6 }).id).toBe("snare");
    expect(selectPulseDrumHit({ absoluteBeat: 1.5, scaleDegree: 3, velocity: 0.3 }).id).toBe("closed-hat");
    expect(selectPulseDrumHit({ absoluteBeat: 3.5, scaleDegree: 3, velocity: 0.3 }).id).toBe("closed-hat");
    expect(selectPulseDrumHit({ absoluteBeat: 2.5, scaleDegree: 0, velocity: 0.5 }).id).toBe("kick");
    expect(selectPulseDrumHit({ absoluteBeat: 3.5, scaleDegree: 6, velocity: 0.55 }).id).toBe("open-hat");
    expect(selectPulseDrumHit({ absoluteBeat: 31.75, scaleDegree: 4, velocity: 0.62 }).id).toBe("low-tom");
  });
});
