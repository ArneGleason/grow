import { expect, test } from "@playwright/test";
import {
  SONG_DRAFT_PLAN_RESPONSE_FORMAT,
  createSongDraftPlanPrompt,
  createVoiceLedHarmonyDraftFromSongDraftPlan,
  validateSongDraftPlanResponse,
} from "../src/song-draft-plan";
import { createTonalContext } from "../src/tonal-context";
import { interpretSongGoal } from "../src/song-goal";

const MODEL_PLAN = {
  summary: "glass machine call answered by a falling bass shadow",
  bars: [
    {
      barIndex: 0,
      leader: "melody",
      rootDegree: 1,
      anchorDegrees: [1, 3, 5],
      contour: "rise",
      rhythm: "steady",
      cadence: "open",
      tension: 0.38,
    },
    {
      barIndex: 1,
      leader: "answer",
      rootDegree: 4,
      anchorDegrees: [5, 3, 2],
      contour: "fall",
      rhythm: "syncopated",
      cadence: "half",
      tension: 0.62,
    },
    {
      barIndex: 2,
      leader: "harmony",
      rootDegree: 6,
      anchorDegrees: [2, 4],
      contour: "arch",
      rhythm: "sparse",
      cadence: "open",
      tension: 0.44,
    },
    {
      barIndex: 3,
      leader: "melody",
      rootDegree: 2,
      anchorDegrees: [6, 4, 7],
      contour: "dip",
      rhythm: "busy",
      cadence: "surprise",
      tension: 0.79,
    },
    {
      barIndex: 4,
      leader: "harmony",
      rootDegree: 5,
      anchorDegrees: [5, 6],
      contour: "flat",
      rhythm: "steady",
      cadence: "open",
      tension: 0.36,
    },
    {
      barIndex: 5,
      leader: "answer",
      rootDegree: 3,
      anchorDegrees: [6, 5, 3],
      contour: "wave",
      rhythm: "syncopated",
      cadence: "half",
      tension: 0.58,
    },
    {
      barIndex: 6,
      leader: "melody",
      rootDegree: 4,
      anchorDegrees: [2, 5, 7],
      contour: "arch",
      rhythm: "busy",
      cadence: "surprise",
      tension: 0.74,
    },
    {
      barIndex: 7,
      leader: "harmony",
      rootDegree: 1,
      anchorDegrees: [3, 2, 1],
      contour: "fall",
      rhythm: "steady",
      cadence: "home",
      tension: 0.28,
    },
  ],
} as const;

test.describe("song draft plan boundary", () => {
  test("validates a bounded eight-bar model plan", () => {
    const result = validateSongDraftPlanResponse(MODEL_PLAN);

    expect(result.valid).toBe(true);
    expect(result.plan?.source).toBe("model");
    expect(result.plan?.bars).toHaveLength(8);
    expect(new Set(result.plan?.bars.map((bar) => bar.leader))).toEqual(
      new Set(["melody", "answer", "harmony"]),
    );
    expect(new Set(result.plan?.bars.map((bar) => bar.rootDegree)).size).toBeGreaterThanOrEqual(4);
  });

  test("keeps the schema away from free note, pitch, and event output", () => {
    const schemaText = JSON.stringify(SONG_DRAFT_PLAN_RESPONSE_FORMAT);

    expect(schemaText).toContain("anchorDegrees");
    expect(schemaText).toContain("leader");
    expect(schemaText).not.toMatch(/pitch|midi|events|duration|chordName|lyrics/);
  });

  test("rejects unknown musical vocabulary and missing bar coverage", () => {
    const invalid = {
      summary: "bad plan",
      bars: MODEL_PLAN.bars.slice(0, 7).map((bar, index) => ({
        ...bar,
        barIndex: index,
        leader: index === 0 ? "soloist" : bar.leader,
      })),
    };
    const result = validateSongDraftPlanResponse(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" | ")).toContain("bars must contain exactly 8 entries");
    expect(result.errors.join(" | ")).toContain("leader must be one of");
    expect(result.errors.join(" | ")).toContain("missing barIndex values 7");
  });

  test("clamps tension while preserving the validated plan shape", () => {
    const raw = {
      ...MODEL_PLAN,
      bars: MODEL_PLAN.bars.map((bar) =>
        bar.barIndex === 3 ? { ...bar, tension: 1.6 } : bar
      ),
    };
    const result = validateSongDraftPlanResponse(raw);

    expect(result.valid).toBe(true);
    expect(result.plan?.bars.find((bar) => bar.barIndex === 3)?.tension).toBe(1);
    expect(result.clamps).toEqual(expect.arrayContaining(["bars.3.tension clamped to 1.00"]));
  });

  test("renders a model plan into the shared voice-led harmony draft shape", () => {
    const plan = validateSongDraftPlanResponse(MODEL_PLAN).plan!;
    const draft = createVoiceLedHarmonyDraftFromSongDraftPlan(plan, {
      seed: 42,
      tonalContext: createTonalContext("E", "lydian"),
    });

    expect(draft.bars).toBe(8);
    expect(draft.phraseBeats).toBe(32);
    expect(draft.voices.map((voice) => voice.role)).toEqual([
      "middle-guide",
      "lower-counter",
      "upper-counter",
      "bass-foundation",
    ]);
    expect(draft.chordEvents.length).toBeGreaterThanOrEqual(8);
    expect(draft.chordEvents.some((chord) => chord.tags.includes("song-plan:model"))).toBe(true);
    expect(draft.voices[0]?.events[0]).toMatchObject({
      role: "middle-guide",
      scaleDegree: 0,
    });
    expect(draft.voices[0]?.events.some((event) => event.tags.includes("plan:leader-answer"))).toBe(true);
    expect(draft.summary).toContain("model co-draft");
  });

  test("builds a prompt that asks for interplay, not literal notes", () => {
    const goal = interpretSongGoal("glass elevator song in E lydian 160 bpm", {
      materialSeed: 99,
    }).goal;
    const prompt = createSongDraftPlanPrompt({
      prompt: "glass elevator song in E lydian 160 bpm",
      goal,
      materialSeed: 99,
      playerPlans: [
        { playerId: "melody", role: "melody", enabled: true, brief: "carry the strange lift" },
        { playerId: "keyboard", role: "texture", enabled: true, brief: "answer in close voicings" },
      ],
    });

    expect(prompt).toContain("melody-led");
    expect(prompt).toContain("harmony-led");
    expect(prompt).toContain("answer bars");
    expect(prompt).toContain("scale degrees 1..7");
    expect(prompt).not.toMatch(/\bMIDI\b.*\breturn\b/);
  });
});
