import { expect, test } from "@playwright/test";
import {
  SONG_INTENT_RESPONSE_FORMAT,
  applySongIntentResponse,
  createSongIntentPrompt,
} from "../src/song-intent";
import { interpretSongGoal, SONG_GOAL_TEMPO_RANGE } from "../src/song-goal";

test.describe("song intent model boundary", () => {
  test("applies a bounded model patch over the deterministic song goal", () => {
    const base = interpretSongGoal("moon elevator made of glass, impossible fast", {
      materialSeed: 44,
    });
    const result = applySongIntentResponse(base, {
      tonic: "E",
      mode: "lydian",
      tempoBpm: 168,
      energy: 0.92,
      surpriseTarget: 0.74,
      brightness: 0.88,
      formPreference: "early-hook",
      influenceHints: ["glass-bright", "machine-hum"],
      sectionEmphasis: { verse: 0.42, chorus: 0.9, bridge: 0.58 },
      dispositionBias: { pulse: 0.18, melody: 0.14 },
      baseMaterialHint: "glass",
      playerBriefs: {
        melody: "leap like reflected light, then resolve plainly",
        keyboard: "make the harmony shimmer without covering the line",
      },
      rationale: "glass and elevator imply bright lift with fast mechanical drive",
    });

    expect(result.valid).toBe(true);
    expect(result.application?.interpretation.source).toBe("model");
    expect(result.application?.interpretation.goal.status).toBe("model");
    expect(result.application?.interpretation.goal).toMatchObject({
      tonic: "E",
      mode: "lydian",
      tempoBpm: 170,
      formPreference: "early-hook",
    });
    expect(result.application?.baseSongId).toBe("glass");
    expect(result.application?.playerBriefs.melody).toContain("reflected light");
    expect(result.application?.matchedSignals).toEqual(expect.arrayContaining([
      "tempoBpm",
      "hint-glass-bright",
      "brief-keyboard",
    ]));
  });

  test("keeps schema bounded away from model-authored musical events", () => {
    const schemaText = JSON.stringify(SONG_INTENT_RESPONSE_FORMAT);

    expect(schemaText).toContain("tempoBpm");
    expect(schemaText).toContain("playerBriefs");
    expect(schemaText).not.toMatch(/scaleDegree|pitch|midi|durationBeats|events/);
  });

  test("rejects unknown vocabulary instead of accepting a hidden second music language", () => {
    const base = interpretSongGoal("stormy song", { materialSeed: 12 });
    const result = applySongIntentResponse(base, {
      mode: "locrian",
      influenceHints: ["copied-artist-line"],
      playerBriefs: { singer: "take over the tune" },
      rationale: "outside the allowed vocabulary",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" | ")).toContain("mode must be one of");
    expect(result.errors.join(" | ")).toContain("unknown influence hint");
    expect(result.errors.join(" | ")).toContain("unknown playerBriefs player");
  });

  test("clamps numeric intent to the app-owned musical bounds", () => {
    const base = interpretSongGoal("overbright sprint", { materialSeed: 9 });
    const result = applySongIntentResponse(base, {
      tempoBpm: 240,
      energy: 1.4,
      surpriseTarget: -0.4,
      brightness: 2,
      dispositionBias: { pulse: 0.8 },
      rationale: "too much of everything",
    });

    expect(result.valid).toBe(true);
    expect(result.application?.interpretation.goal.tempoBpm).toBe(SONG_GOAL_TEMPO_RANGE.maximum);
    expect(result.application?.interpretation.goal.energy).toBe(1);
    expect(result.application?.interpretation.goal.surpriseTarget).toBe(0);
    expect(result.application?.interpretation.goal.brightness).toBe(1);
    expect(result.clamps.length).toBeGreaterThanOrEqual(4);
  });

  test("builds a prompt that gives the model vocabulary and fallback context", () => {
    const base = interpretSongGoal("a paper machine waltz", { materialSeed: 99 });
    const prompt = createSongIntentPrompt({
      prompt: "a paper machine waltz",
      deterministicGoal: base.goal,
      playerPlans: [
        { playerId: "melody", role: "melody", enabled: true, brief: "carry the hook" },
        { playerId: "effects", role: "effects", enabled: false, brief: "stay out" },
      ],
    });

    expect(prompt).toContain("Allowed vocabulary");
    expect(prompt).toContain("Seeded deterministic fallback goal");
    expect(prompt).toContain("melody");
    expect(prompt).not.toContain("stay out");
  });
});
