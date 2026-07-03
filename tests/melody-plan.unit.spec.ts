import { expect, test } from "@playwright/test";
import {
  MELODY_ANACRUSES,
  MELODY_CONTOURS,
  MELODY_DENSITY_FAMILIES,
  MELODY_FINAL_CADENCES,
  MELODY_INTERNAL_CADENCES,
  MELODY_MOTIF_SCHEMES,
  MELODY_PHRASE_STRUCTURES,
  chooseMelodyPlan,
  type MelodyPlan,
} from "../src/melody-plan";
import { generateProsodicAnchorPhrase } from "../src/melody-prosody";

function signature(plan: MelodyPlan): string {
  return [
    plan.phraseStructure,
    plan.motifScheme,
    plan.contours.join(","),
    plan.cadences.internal.join(","),
    plan.cadences.final,
    plan.anacrusis,
    plan.densityFamily,
    plan.registerBase,
  ].join("|");
}

function relativeStarts(segment: ReturnType<typeof generateProsodicAnchorPhrase>["segments"][number]): readonly number[] {
  const start = segment.anchors[0]?.startBeat ?? 0;
  return segment.anchors.map((anchor) => Math.round((anchor.startBeat - start) * 1000) / 1000);
}

function degreeDeltas(segment: ReturnType<typeof generateProsodicAnchorPhrase>["segments"][number]): readonly number[] {
  const first = segment.anchors[0]?.degree ?? 1;
  return segment.anchors.map((anchor) => anchor.degree - first);
}

test.describe("E4 melody plans", () => {
  test("chooses deterministic diverse plans with every enum reachable", () => {
    const plans = Array.from({ length: 512 }, (_, seed) => chooseMelodyPlan(seed + 1));
    expect(chooseMelodyPlan(12345)).toEqual(chooseMelodyPlan(12345));
    expect(new Set(plans.map(signature)).size).toBeGreaterThanOrEqual(12);
    expect(new Set(plans.map((plan) => plan.phraseStructure))).toEqual(new Set(MELODY_PHRASE_STRUCTURES));
    expect(new Set(plans.map((plan) => plan.motifScheme))).toEqual(new Set(MELODY_MOTIF_SCHEMES));
    expect(new Set(plans.flatMap((plan) => plan.contours))).toEqual(new Set(MELODY_CONTOURS));
    expect(new Set(plans.map((plan) => plan.anacrusis))).toEqual(new Set(MELODY_ANACRUSES));
    expect(new Set(plans.map((plan) => plan.densityFamily))).toEqual(new Set(MELODY_DENSITY_FAMILIES));
    expect(new Set(plans.map((plan) => plan.cadences.final))).toEqual(new Set(MELODY_FINAL_CADENCES));
    expect(new Set(plans.flatMap((plan) => plan.cadences.internal))).toEqual(new Set(MELODY_INTERNAL_CADENCES));
  });

  test("plan structure drives segment allocation and cadences", () => {
    const plan: MelodyPlan = {
      seed: 1,
      phraseStructure: "4-short",
      phraseBeats: [4, 4, 4, 4],
      motifScheme: "through",
      contours: ["climb", "descent", "valley", "zigzag"],
      cadences: { internal: [5, 4, 2], final: "open-on-2" },
      anacrusis: "none",
      densityFamily: "sparse",
      registerBase: 4,
    };
    const phrase = generateProsodicAnchorPhrase({ seed: 1, plan, bars: 4 });

    expect(phrase.segments).toHaveLength(4);
    expect(phrase.segments.map((segment) => segment.anchors[0].startBeat)).toEqual([0, 4, 8, 12]);
    expect(phrase.segments.slice(0, 3).map((segment) => segment.anchors.at(-1)?.degree)).toEqual([5, 4, 2]);
    expect(phrase.segments.at(-1)?.anchors.at(-1)?.degree).toBe(2);
  });

  test("AAB and ABA produce recognizable transposed A repeats while through does not", () => {
    const aabPlan: MelodyPlan = {
      seed: 2,
      phraseStructure: "3-phrase",
      phraseBeats: [4, 4, 8],
      motifScheme: "AAB",
      contours: ["arch", "descent", "climb"],
      cadences: { internal: [5, 4], final: "1" },
      anacrusis: "light",
      densityFamily: "flowing",
      registerBase: 4,
    };
    const abaPlan: MelodyPlan = { ...aabPlan, motifScheme: "ABA" };
    const throughPlan: MelodyPlan = { ...aabPlan, motifScheme: "through" };
    const aab = generateProsodicAnchorPhrase({ seed: 2, plan: aabPlan, bars: 4 });
    const aba = generateProsodicAnchorPhrase({ seed: 2, plan: abaPlan, bars: 4 });
    const through = generateProsodicAnchorPhrase({ seed: 2, plan: throughPlan, bars: 4 });

    expect(relativeStarts(aab.segments[1])).toHaveLength(relativeStarts(aab.segments[0]).length);
    expect(degreeDeltas(aab.segments[1]).slice(0, -1)).toEqual(degreeDeltas(aab.segments[0]).slice(0, -1));
    expect(relativeStarts(aba.segments[2])).toHaveLength(relativeStarts(aba.segments[0]).length);
    expect(degreeDeltas(aba.segments[2]).slice(0, -1)).toEqual(degreeDeltas(aba.segments[0]).slice(0, -1));
    expect(degreeDeltas(through.segments[1])).not.toEqual(degreeDeltas(through.segments[0]));
  });
});
