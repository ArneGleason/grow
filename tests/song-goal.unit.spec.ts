import { expect, test } from "@playwright/test";
import { FORM_VARIANTS } from "../src/form-variants";
import {
  interpretSongGoal,
  SONG_GOAL_MODES,
  type SongGoalMode,
} from "../src/song-goal";

test.describe("E4 song goal seeded choices", () => {
  test("spreads unpinned goal knobs across wide deterministic bands", () => {
    const goals = Array.from({ length: 96 }, (_, index) =>
      interpretSongGoal("make a new instrumental terrarium piece", { materialSeed: index + 1 }).goal
    );
    const tempos = goals.map((goal) => goal.tempoBpm);
    const modes = new Set(goals.map((goal) => goal.mode));
    const forms = new Set(goals.map((goal) => goal.formPreference));

    expect(Math.max(...tempos) - Math.min(...tempos)).toBeGreaterThanOrEqual(60);
    expect([...modes].sort()).toEqual([...SONG_GOAL_MODES].sort());
    expect(forms.size).toBeGreaterThanOrEqual(Math.min(3, FORM_VARIANTS.length));
  });

  test("is deterministic for the same material seed and redraws for a different material seed", () => {
    const first = interpretSongGoal("new instrumental terrarium piece", { materialSeed: 111 }).goal;
    const repeated = interpretSongGoal("new instrumental terrarium piece", { materialSeed: 111 }).goal;
    const redraws = Array.from({ length: 16 }, (_, index) =>
      interpretSongGoal("new instrumental terrarium piece", { materialSeed: 112 + index }).goal
    );
    const redrawn = redraws.find((goal) => goal.id !== first.id);

    expect(repeated).toEqual(first);
    expect(redrawn).toBeDefined();
    expect([
      redrawn!.tonic !== first.tonic,
      redrawn!.mode !== first.mode,
      redrawn!.formPreference !== first.formPreference,
      redrawn!.tempoBpm !== first.tempoBpm,
    ].some(Boolean)).toBe(true);
  });

  test("keeps explicit prompt pins and UI-style overrides untouched", () => {
    const pinned = interpretSongGoal("slow dorian waltz at 72 bpm", { materialSeed: 999 });
    const override = interpretSongGoal("restless glass machine", { materialSeed: 999 });
    const overriddenGoal = {
      ...override.goal,
      tonic: "G",
      mode: "dorian" as SongGoalMode,
      tempoBpm: 72,
      formPreference: "wide-return" as const,
    };

    expect(pinned.goal.mode).toBe("dorian");
    expect(pinned.goal.tempoBpm).toBe(70);
    expect(pinned.goal.formPreference).toBe("wide-return");
    expect(pinned.matchedKeywords).toEqual(expect.arrayContaining(["explicit-tempo", "mode-dorian", "waltz"]));
    expect(overriddenGoal).toMatchObject({
      tonic: "G",
      mode: "dorian",
      tempoBpm: 72,
      formPreference: "wide-return",
    });
  });
});
