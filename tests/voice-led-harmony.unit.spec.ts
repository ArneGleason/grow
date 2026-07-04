import { expect, test } from "@playwright/test";
import { createTonalContext } from "../src/tonal-context";
import { generateVoiceLedHarmonyDraft } from "../src/voice-led-harmony";

test.describe("voice-led harmony draft generator", () => {
  test("generates deterministic moving voices and derived chord events", () => {
    const options = {
      seed: 4242,
      bars: 8,
      tonalContext: createTonalContext("G", "dorian"),
      ambiguity: 0.62,
      motion: 0.7,
    };
    const first = generateVoiceLedHarmonyDraft(options);
    const second = generateVoiceLedHarmonyDraft(options);

    expect(first).toEqual(second);
    expect(first.voices.map((voice) => voice.role)).toEqual([
      "middle-guide",
      "lower-counter",
      "upper-counter",
      "bass-foundation",
    ]);
    expect(first.phraseBeats).toBe(32);
    expect(first.chordEvents.length).toBeGreaterThan(8);
    expect(first.chordEvents.every((event) => event.sourceVoiceEventIds.length >= 3)).toBe(true);
    expect(first.summary).toContain("voice-led chord moments");
  });

  test("allows off-bar anticipations and ambiguous voicings", () => {
    const draft = generateVoiceLedHarmonyDraft({
      seed: 777,
      bars: 12,
      ambiguity: 0.8,
      motion: 0.65,
    });

    expect(draft.chordEvents.some((event) => event.startBeat % 4 !== 0)).toBe(true);
    expect(draft.chordEvents.some((event) =>
      event.changeKind === "anticipation" || event.changeKind === "suspension"
    )).toBe(true);
    expect(draft.chordEvents.some((event) => event.ambiguity >= 0.42)).toBe(true);
    expect(draft.chordEvents.some((event) =>
      event.label.includes("/") || event.quality === "sus" || event.quality === "open"
    )).toBe(true);
  });

  test("normalizes supported phrase lengths and sections", () => {
    const draft = generateVoiceLedHarmonyDraft({ seed: 1, bars: 14 });

    expect(draft.bars).toBe(16);
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections.every((section) => section.chordEventIds.length > 0)).toBe(true);
    expect(draft.chordEvents.at(-1)?.changeKind).toBe("cadence");
  });

  test("varies with seed while keeping pitches and degrees bounded", () => {
    const first = generateVoiceLedHarmonyDraft({ seed: 10 });
    const second = generateVoiceLedHarmonyDraft({ seed: 11 });

    expect(first.chordEvents.map((event) => event.label).join("|")).not.toEqual(
      second.chordEvents.map((event) => event.label).join("|"),
    );
    for (const draft of [first, second]) {
      for (const voice of draft.voices) {
        expect(voice.events.every((event) =>
          Number.isInteger(event.scaleDegree) &&
          event.durationBeats > 0 &&
          /^([A-G])(#|b)?-?\d+$/.test(event.pitch)
        )).toBe(true);
      }
    }
  });

  test("spreads seeds across distinct contour and harmonic rhythm shapes", () => {
    const drafts = [101, 202, 303, 404, 505, 606].map((seed) =>
      generateVoiceLedHarmonyDraft({
        seed,
        bars: 8,
        ambiguity: 0.68,
        motion: 0.72,
      })
    );
    const middleSignatures = new Set(drafts.map((draft) =>
      draft.voices
        .find((voice) => voice.role === "middle-guide")
        ?.events
        .map((event) => `${event.startBeat}:${event.scaleDegree}`)
        .join("|") ?? ""
    ));
    const harmonicRhythmSignatures = new Set(drafts.map((draft) =>
      draft.chordEvents.map((event) => event.startBeat).join("|")
    ));
    const chordLabelSignatures = new Set(drafts.map((draft) =>
      draft.chordEvents.map((event) => event.label).join("|")
    ));

    expect(middleSignatures.size).toBeGreaterThan(3);
    expect(harmonicRhythmSignatures.size).toBeGreaterThan(2);
    expect(chordLabelSignatures.size).toBeGreaterThan(3);
  });
});
