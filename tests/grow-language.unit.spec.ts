import { expect, test } from "@playwright/test";
import {
  DEGREE_COLORS,
  GROW_LANGUAGE_MODE_IDS,
  MODE_BRIDGES,
  degreeColor,
  degreeRole,
  modeBridge,
  modeClassicalId,
  modeDisplayName,
} from "../src/grow-language";
import { MODE_INTERVALS } from "../src/tonal-context";

test.describe("Grow language vocabulary", () => {
  test("round-trips the four L0a modes with case-insensitive evocative names", () => {
    for (const mode of GROW_LANGUAGE_MODE_IDS) {
      const displayName = modeDisplayName(mode);
      expect(displayName).toBeDefined();
      expect(modeClassicalId(displayName ?? "")).toBe(mode);
      expect(modeClassicalId((displayName ?? "").toLocaleUpperCase())).toBe(mode);
    }

    expect(modeDisplayName("lydian")).toBeUndefined();
    expect(modeDisplayName("phrygian")).toBeUndefined();
    expect(modeClassicalId("Freefall")).toBeUndefined();
  });

  test("uses MODE_INTERVALS as the single interval source", () => {
    for (const mode of GROW_LANGUAGE_MODE_IDS) {
      expect(modeBridge(mode)?.intervals).toEqual(MODE_INTERVALS[mode]);
    }

    expect(modeBridge("lydian")).toBeUndefined();
    expect(modeBridge("phrygian")).toBeUndefined();
  });

  test("orders covered modes from bright to dark", () => {
    expect(MODE_BRIDGES.ionian.brightnessRank).toBeGreaterThan(
      MODE_BRIDGES.mixolydian.brightnessRank,
    );
    expect(MODE_BRIDGES.mixolydian.brightnessRank).toBeGreaterThan(
      MODE_BRIDGES.dorian.brightnessRank,
    );
    expect(MODE_BRIDGES.dorian.brightnessRank).toBeGreaterThan(
      MODE_BRIDGES.aeolian.brightnessRank,
    );
  });

  test("keeps degree colors complete, unique, and 1-based", () => {
    const degreeKeys = Object.keys(DEGREE_COLORS).sort();
    expect(degreeKeys).toEqual(["1", "2", "3", "4", "5", "6", "7"]);

    const hexes = Object.values(DEGREE_COLORS).map((color) => color.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(degreeColor(1)?.hex).toBe("#D85A30");
    expect(degreeRole(1)).toBe("home");
    expect(degreeColor(5)?.varName).toBe("--degree-5");
    expect(degreeRole(5)).toBe("pillar");
    expect(degreeColor(0)).toBeUndefined();
    expect(degreeColor(8)).toBeUndefined();
  });

  test("keeps evocative mode names unique", () => {
    const names = GROW_LANGUAGE_MODE_IDS.map((mode) => MODE_BRIDGES[mode].evocative);
    expect(new Set(names).size).toBe(names.length);
  });
});
