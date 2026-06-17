import { expect, test } from "@playwright/test";
import type { AnchorPhrase } from "../src/anchor-phrase";
import {
  ANCHOR_CONNECTOR_NOTE_BUDGET,
  renderAnchorPhrase,
  renderDemoAnchorPhrase,
} from "../src/anchor-phrase-render";
import { createTonalContext, noteFromScaleDegree } from "../src/tonal-context";

function activeEvents(source: ReturnType<typeof renderAnchorPhrase>) {
  return source.events
    .map((event, index) => event ? { ...event, index, startBeat: index * source.subdivisionBeats } : null)
    .filter((event): event is NonNullable<typeof event> => event !== null);
}

function connectorEvents(source: ReturnType<typeof renderAnchorPhrase>) {
  return activeEvents(source).filter((event) => event.startBeat > 0.5 && event.startBeat < 4);
}

test.describe("Anchor phrase renderer", () => {
  test("renders deterministically and converts 1-based language degrees to engine scale degrees", () => {
    const first = renderDemoAnchorPhrase({ subdivisionBeats: 0.5 });
    const second = renderDemoAnchorPhrase({ subdivisionBeats: 0.5 });

    expect(first).toEqual(second);
    expect(first.subdivisionBeats).toBe(0.5);
    expect(first.events[0]).toMatchObject({
      playerId: "melody",
      scaleDegree: 0,
      octave: 4,
      durationBeats: 0.75,
      velocity: 0.72,
    });
    expect(activeEvents(first).every((event) => Number.isInteger(event.scaleDegree))).toBe(true);
  });

  test("keeps every emitted scale degree in the active tonal scale by construction", () => {
    const tonalContext = createTonalContext("C", "mixolydian");
    const rendered = renderDemoAnchorPhrase({ subdivisionBeats: 0.25 });
    const emittedNotes = activeEvents(rendered).map((event) =>
      noteFromScaleDegree(tonalContext, event.scaleDegree, event.octave)
    );

    expect(emittedNotes.length).toBeGreaterThan(0);
    for (const note of emittedNotes) {
      const pitchClass = note.replace(/\d+$/, "");
      expect(tonalContext.scale).toContain(pitchClass);
    }
  });

  test("fill density increases passing-note subdivisions without changing anchors", () => {
    const sparsePhrase = phraseWithConnector({ kernel: "fill", density: 0.2 });
    const densePhrase = phraseWithConnector({ kernel: "fill", density: 1 });
    const sparse = renderAnchorPhrase(sparsePhrase, { subdivisionBeats: 0.5 });
    const dense = renderAnchorPhrase(densePhrase, { subdivisionBeats: 0.5 });

    expect(activeEvents(dense).length).toBeGreaterThan(activeEvents(sparse).length);
    expect(sparse.events[0]?.scaleDegree).toBe(0);
    expect(dense.events[0]?.scaleDegree).toBe(0);
    expect(sparse.events[8]?.scaleDegree).toBe(4);
    expect(dense.events[8]?.scaleDegree).toBe(4);
    expect(connectorEvents(dense).length).toBe(6);
    expect(connectorEvents(dense).map((event) => event.scaleDegree)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  test("approach and detour place biased notes inside the connector window", () => {
    const approach = renderAnchorPhrase(phraseWithConnector({
      kernel: "approach",
      reach: 0.8,
      density: 1,
      bias: -1,
      pull: 1,
    }), { subdivisionBeats: 0.5 });
    const approachPassing = activeEvents(approach).filter((event) => event.startBeat > 0.5 && event.startBeat < 4);
    expect(approachPassing.length).toBe(2);
    expect(approachPassing.every((event) => event.startBeat >= 2.5 && event.startBeat < 4)).toBe(true);
    expect(approachPassing.every((event) => event.scaleDegree < 4)).toBe(true);

    const detour = renderAnchorPhrase(phraseWithConnector({
      kernel: "detour",
      reach: 0.75,
      density: 0.5,
      bias: 1,
      pull: 0.5,
    }), { subdivisionBeats: 0.5 });
    const detourPassing = activeEvents(detour).filter((event) => event.startBeat > 0.5 && event.startBeat < 4);
    expect(detourPassing.length).toBeGreaterThan(0);
    expect(detourPassing.every((event) => event.startBeat >= 0.5 && event.startBeat < 4)).toBe(true);
    expect(detourPassing[0].scaleDegree).toBeGreaterThan(0);
  });

  test("preserves segment gaps as null slots", () => {
    const rendered = renderAnchorPhrase({
      segments: [
        {
          anchors: [{ degree: 1, octave: 4, startBeat: 0, durationBeats: 0.5, dynamics: 0.7 }],
          connectors: [],
        },
        {
          anchors: [{ degree: 5, octave: 4, startBeat: 2, durationBeats: 0.5, dynamics: 0.7 }],
          connectors: [],
        },
      ],
    }, { subdivisionBeats: 0.5 });

    expect(rendered.events[0]?.scaleDegree).toBe(0);
    expect(rendered.events[1]).toBeNull();
    expect(rendered.events[2]).toBeNull();
    expect(rendered.events[3]).toBeNull();
    expect(rendered.events[4]?.scaleDegree).toBe(4);
  });

  test("orbit decorates around the from anchor instead of filling toward the target", () => {
    const upperFirst = renderAnchorPhrase(phraseWithConnector({
      kernel: "orbit",
      reach: 1,
      density: 1,
      bias: 1,
    }), { subdivisionBeats: 0.5 });
    const lowerFirst = renderAnchorPhrase(phraseWithConnector({
      kernel: "orbit",
      reach: 1,
      density: 0.3,
      bias: -1,
    }), { subdivisionBeats: 0.5 });
    const fill = renderAnchorPhrase(phraseWithConnector({
      kernel: "fill",
      reach: 1,
      density: 1,
      bias: 1,
    }), { subdivisionBeats: 0.5 });

    const orbitPassing = connectorEvents(upperFirst);
    const fillPassing = connectorEvents(fill);
    expect(orbitPassing.length).toBeGreaterThan(connectorEvents(lowerFirst).length);
    expect(orbitPassing.every((event) => event.startBeat > 0.5 && event.startBeat < 4)).toBe(true);
    expect(orbitPassing.map((event) => event.scaleDegree)).toEqual([1, -1, 1, -1, 1, -1]);
    expect(connectorEvents(lowerFirst)[0].scaleDegree).toBe(-1);
    expect(orbitPassing.map((event) => event.scaleDegree)).not.toEqual(fillPassing.map((event) => event.scaleDegree));
  });

  test("skip arpeggiates by non-adjacent leaps and no longer renders empty", () => {
    const sparse = renderAnchorPhrase(phraseWithConnector({
      kernel: "skip",
      reach: 0.35,
      density: 0.3,
      bias: 1,
    }), { subdivisionBeats: 0.5 });
    const dense = renderAnchorPhrase(phraseWithConnector({
      kernel: "skip",
      reach: 1,
      density: 1,
      bias: 1,
    }), { subdivisionBeats: 0.5 });
    const fill = renderAnchorPhrase(phraseWithConnector({
      kernel: "fill",
      reach: 1,
      density: 1,
      bias: 1,
    }), { subdivisionBeats: 0.5 });

    const sparsePassing = connectorEvents(sparse);
    const densePassing = connectorEvents(dense);
    expect(sparsePassing.length).toBeGreaterThan(0);
    expect(densePassing.length).toBeGreaterThan(sparsePassing.length);
    expect(densePassing.every((event) => event.startBeat > 0.5 && event.startBeat < 4)).toBe(true);
    expect(densePassing.map((event) => event.scaleDegree)).toEqual([2, 4, 6, 2, 4, 6]);
    expect(densePassing.some((event) => Math.abs(event.scaleDegree) > 4)).toBe(true);
    expect(densePassing.map((event) => event.scaleDegree)).not.toEqual(connectorEvents(fill).map((event) => event.scaleDegree));
  });

  test("caps connector note budget across fill orbit and skip", () => {
    const denseLongFill = renderAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, octave: 4, startBeat: 0, durationBeats: 0.5, dynamics: 0.7 },
            { degree: 7, octave: 4, startBeat: 24, durationBeats: 0.5, dynamics: 0.7 },
          ],
          connectors: [{ kernel: "fill", reach: 1, density: 1, bias: 0, pull: 0.5, color: 1, skew: 0 }],
        },
      ],
    }, { subdivisionBeats: 0.25 });
    const fillPassing = activeEvents(denseLongFill).filter((event) => event.startBeat > 0.5 && event.startBeat < 24);
    expect(fillPassing.length).toBe(ANCHOR_CONNECTOR_NOTE_BUDGET);

    const denseLongOrbit = renderAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, octave: 4, startBeat: 0, durationBeats: 0.5, dynamics: 0.7 },
            { degree: 7, octave: 4, startBeat: 24, durationBeats: 0.5, dynamics: 0.7 },
          ],
          connectors: [{ kernel: "orbit", reach: 1, density: 1, bias: 0, pull: 0.5, color: 1, skew: 0 }],
        },
      ],
    }, { subdivisionBeats: 0.25 });
    const orbitPassing = activeEvents(denseLongOrbit).filter((event) => event.startBeat > 0.5 && event.startBeat < 24);
    expect(orbitPassing.length).toBe(ANCHOR_CONNECTOR_NOTE_BUDGET);

    const denseLongSkip = renderAnchorPhrase({
      segments: [
        {
          anchors: [
            { degree: 1, octave: 4, startBeat: 0, durationBeats: 0.5, dynamics: 0.7 },
            { degree: 7, octave: 4, startBeat: 24, durationBeats: 0.5, dynamics: 0.7 },
          ],
          connectors: [{ kernel: "skip", reach: 1, density: 1, bias: 0, pull: 0.5, color: 1, skew: 0 }],
        },
      ],
    }, { subdivisionBeats: 0.25 });
    const skipPassing = activeEvents(denseLongSkip).filter((event) => event.startBeat > 0.5 && event.startBeat < 24);
    expect(skipPassing.length).toBe(ANCHOR_CONNECTOR_NOTE_BUDGET);
  });
});

function phraseWithConnector(
  connector: Partial<AnchorPhrase["segments"][number]["connectors"][number]>,
): AnchorPhrase {
  return {
    segments: [
      {
        anchors: [
          { degree: 1, octave: 4, startBeat: 0, durationBeats: 0.5, dynamics: 0.7 },
          { degree: 5, octave: 4, startBeat: 4, durationBeats: 0.5, dynamics: 0.7 },
        ],
        connectors: [
          {
            kernel: "fill",
            reach: 0.5,
            density: 0.5,
            bias: 0,
            pull: 0.5,
            color: 0,
            skew: 0,
            ...connector,
          },
        ],
      },
    ],
  };
}
