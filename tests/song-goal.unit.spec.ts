import { expect, test } from "@playwright/test";
import { interpretSongGoal } from "../src/song-goal";

test.describe("song goal interpretation", () => {
  test("spreads unpinned setup choices across material seeds", () => {
    const goals = Array.from({ length: 8 }, (_, index) =>
      interpretSongGoal("paper lanterns under cold fog beside an empty road", {
        materialSeed: 10_000 + index * 7_919,
      }).goal
    );

    const tonics = new Set(goals.map((goal) => goal.tonic));
    const modes = new Set(goals.map((goal) => goal.mode));
    const tempos = goals.map((goal) => goal.tempoBpm);

    expect(tonics.size).toBeGreaterThanOrEqual(5);
    expect(modes.size).toBeGreaterThanOrEqual(3);
    expect(Math.max(...tempos) - Math.min(...tempos)).toBeGreaterThanOrEqual(25);
    expect(new Set(goals.map((goal) => goal.id)).size).toBe(goals.length);
  });

  test("keeps explicit setup requests stronger than seeded variation", () => {
    const first = interpretSongGoal("urgent song in G dorian tempo 115 with a wide return", {
      materialSeed: 123,
    }).goal;
    const second = interpretSongGoal("urgent song in G dorian tempo 115 with a wide return", {
      materialSeed: 987_654,
    }).goal;

    expect(first).toMatchObject({
      tonic: "G",
      mode: "dorian",
      tempoBpm: 115,
      formPreference: "wide-return",
    });
    expect(second).toMatchObject({
      tonic: "G",
      mode: "dorian",
      tempoBpm: 115,
      formPreference: "wide-return",
    });
  });

  test("uses tempo words as intensity bands instead of one fixed fast value", () => {
    const fastTempos = Array.from({ length: 8 }, (_, index) =>
      interpretSongGoal("fast glass road song with sparks", {
        materialSeed: 2000 + index * 379,
      }).goal.tempoBpm
    );
    const hyperFastTempos = Array.from({ length: 8 }, (_, index) =>
      interpretSongGoal("hyper-fast glass road song with sparks", {
        materialSeed: 3000 + index * 379,
      }).goal.tempoBpm
    );

    expect(new Set(fastTempos).size).toBeGreaterThan(1);
    expect(fastTempos.every((tempo) => tempo >= 125 && tempo <= 150)).toBe(true);
    expect(new Set(fastTempos)).not.toEqual(new Set([120]));

    expect(new Set(hyperFastTempos).size).toBeGreaterThan(1);
    expect(hyperFastTempos.every((tempo) => tempo >= 155 && tempo <= 180)).toBe(true);
  });

  test("accepts explicit high BPM prompts with a forgiving bmp typo", () => {
    const goal = interpretSongGoal("shiny street sprint 160 bmp in E lydian", {
      materialSeed: 123,
    }).goal;

    expect(goal).toMatchObject({
      tonic: "E",
      mode: "lydian",
      tempoBpm: 160,
    });
  });
});
