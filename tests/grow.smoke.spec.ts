import { expect, test, type Page } from "@playwright/test";
import {
  SESSION_MODES,
  shouldSessionModeRefillLookahead,
  type SessionMode,
} from "../src/session-mode";
import {
  createMockThoughtIntent,
  validateMusicalExcerpt,
  validatePlayerThoughtIntent,
  validatePlayerThoughtRequest,
  type MusicalExcerpt,
  type PlayerThoughtIntent,
  type PlayerThoughtRequest,
} from "../src/thought-protocol";
import type { PlayerThoughtSeed } from "../src/thought-seeds";

type TransportState = {
  status: "stopped" | "playing";
  sessionMode: SessionMode;
  bpm: number;
  bar: number;
  currentBeat: number;
  lookahead: {
    targetBeats: number;
    minimumBeats: number;
    scheduledThroughBeat: number;
    leadBeats: number;
    pendingSlotCount: number;
    health: "stopped" | "empty" | "thin" | "healthy";
  };
};

type ListeningFrame = {
  eventCount: number;
  tonalContext: { tonic: string; mode: string; scale: readonly string[] };
  mix: { silenceRatio: number; brightness: number; transientDensity: number };
  recentEvents: Array<{
    playerId: string;
    kind: string;
    pitch?: string;
    absoluteBeat: number;
    tags: string[];
  }>;
  players: Array<{ id: string; state: string; recentEvents: unknown[] }>;
};

type TasteEvaluation = {
  playerId: string;
  action: string;
  actionSinceBeat: number;
  affinity: number;
  summary: string;
  reasons: string[];
  metrics: {
    playerDensity: number;
    ensembleDensity: number;
    silenceRatio: number;
    brightness: number;
    pitchVariety: number;
    rhythmicStability: number;
  };
  updatedAtBeat: number;
};

type OllamaThoughtProbe = {
  status: string;
  provider: string;
  rawResponse: string;
  validation: { valid: boolean; errors: string[] };
  intent?: PlayerThoughtIntent;
  fallbackValidation?: { valid: boolean; errors: string[] };
};

async function getTransportState(page: Page): Promise<TransportState> {
  const state = await page.evaluate(() => {
    const appWindow = window as unknown as {
      transport?: { getState(): TransportState };
    };
    return appWindow.transport?.getState();
  });

  if (!state) {
    throw new Error("window.transport.getState() was not available");
  }

  return state;
}

async function getListeningFrame(page: Page): Promise<ListeningFrame> {
  const frame = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getFrame(): ListeningFrame };
    };
    return appWindow.listening?.getFrame();
  });

  if (!frame) {
    throw new Error("window.listening.getFrame() was not available");
  }

  return frame;
}

async function getTasteEvaluations(page: Page): Promise<readonly TasteEvaluation[]> {
  const evaluations = await page.evaluate(() => {
    const appWindow = window as unknown as {
      taste?: { getEvaluations(): readonly TasteEvaluation[] };
    };
    return appWindow.taste?.getEvaluations();
  });

  if (!evaluations) {
    throw new Error("window.taste.getEvaluations() was not available");
  }

  return evaluations;
}

async function getThoughtSeeds(page: Page): Promise<readonly PlayerThoughtSeed[]> {
  const seeds = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getSeeds(): readonly PlayerThoughtSeed[] };
    };
    return appWindow.thinking?.getSeeds();
  });

  if (!seeds) {
    throw new Error("window.thinking.getSeeds() was not available");
  }

  return seeds;
}

async function getThoughtRequests(page: Page): Promise<readonly PlayerThoughtRequest[]> {
  const requests = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getRequests(): readonly PlayerThoughtRequest[] };
    };
    return appWindow.thinking?.getRequests();
  });

  if (!requests) {
    throw new Error("window.thinking.getRequests() was not available");
  }

  return requests;
}

async function getMockThoughtIntents(page: Page): Promise<readonly PlayerThoughtIntent[]> {
  const intents = await page.evaluate(() => {
    const appWindow = window as unknown as {
      thinking?: { getMockIntents(): readonly PlayerThoughtIntent[] };
    };
    return appWindow.thinking?.getMockIntents();
  });

  if (!intents) {
    throw new Error("window.thinking.getMockIntents() was not available");
  }

  return intents;
}

async function getSessionMode(page: Page): Promise<SessionMode> {
  const mode = await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { getMode(): SessionMode };
    };
    return appWindow.session?.getMode();
  });

  if (!mode) {
    throw new Error("window.session.getMode() was not available");
  }

  return mode;
}

async function setSessionMode(page: Page, mode: SessionMode): Promise<void> {
  const appliedMode = await page.evaluate((nextMode) => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode(nextMode);
  }, mode);

  expect(appliedMode).toBe(mode);
}

async function getRecordedEventCount(page: Page): Promise<number> {
  const eventCount = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getEvents(): readonly unknown[] };
    };
    return appWindow.listening?.getEvents().length;
  });

  if (eventCount === undefined) {
    throw new Error("window.listening.getEvents() was not available");
  }

  return eventCount;
}

async function getLatestRecordedBeat(page: Page): Promise<number> {
  const latestBeat = await page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: { getEvents(): Array<{ absoluteBeat: number }> };
    };
    return appWindow.listening?.getEvents().at(-1)?.absoluteBeat;
  });

  if (latestBeat === undefined) {
    throw new Error("No recorded musical events were available");
  }

  return latestBeat;
}

test("session mode refill policy is explicit", () => {
  expect(SESSION_MODES).toEqual(["break", "solo-practice", "rehearsal", "performance"]);
  expect(Object.fromEntries(
    SESSION_MODES.map((mode) => [mode, shouldSessionModeRefillLookahead(mode)]),
  )).toEqual({
    break: false,
    "solo-practice": true,
    rehearsal: true,
    performance: true,
  });
});

test("manual Ollama thought probe is inspectable with a mocked local endpoint", async ({ page }) => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json",
  };

  await page.route("http://127.0.0.1:11434/api/tags", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({ models: [{ name: "gemma4:31b" }] }),
    });
  });

  await page.route("http://127.0.0.1:11434/api/chat", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        model: "gemma4:31b",
        message: {
          role: "assistant",
          content: JSON.stringify({
            id: "mocked-local-intent",
            responseLevel: "variation_intent",
            action: "vary_motif",
            confidence: 0.72,
            target: { startAfterBeats: 1, durationBeats: 1 },
            musicalIdea: {
              label: "mocked local turn",
              origin: "imagined",
              durationBeats: 1,
              steps: [{
                kind: "note",
                positionBeats: 0,
                durationBeats: 0.5,
                scaleDegree: 2,
                octave: 4,
                velocity: 0.55,
                tags: ["ollama"],
              }],
              tags: ["ollama-intent"],
            },
            rationale: "Use one bright in-scale answer.",
          }),
        },
        done: true,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("ollama-health-check").click();
  await expect(page.getByTestId("ollama-health-status")).toContainText("ready");
  await expect(page.getByTestId("ollama-latency")).toContainText("ms");

  await page.getByTestId("ollama-send-thought").click();
  await expect(page.getByTestId("ollama-parse-result")).toHaveText("ok");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("valid");
  await expect(page.getByTestId("ollama-raw-response")).toContainText("mocked local turn");
  await expect(page.getByTestId("ollama-fallback-status")).toContainText("mock fallback valid");

  const probe = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getLastThoughtTest(): OllamaThoughtProbe };
    };
    return appWindow.ollama?.getLastThoughtTest();
  });

  expect(probe?.status).toBe("valid");
  expect(probe?.provider).toBe("ollama");
  expect(probe?.validation.valid).toBe(true);
  expect(probe?.fallbackValidation?.valid).toBe(true);
  expect(probe?.intent?.musicalIdea.sourceStartBeat).not.toBe(999);
  expect((await getTransportState(page)).lookahead.pendingSlotCount).toBe(0);
  expect((await getTransportState(page)).status).toBe("stopped");
});

test("Grow exposes session modes, starts three players, hears events, and cleans up the transport", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");

  const button = page.getByTestId("transport-toggle");
  const status = page.getByTestId("transport-status");
  const canvas = page.getByTestId("terrarium-canvas");

  await expect(page.locator(".brand__subtitle")).toHaveText("Byte 9b: Ollama health and manual thought probe");
  await expect(button).toHaveText("Start");
  await expect(status).toContainText(
    "mode rehearsal | stopped | 90 BPM | bar 1 | beat 0.0 | lookahead stopped 0.0/8 | pending slots 0",
  );
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  await expect(page.getByTestId("session-mode-rehearsal")).toBeChecked();
  expect(await getSessionMode(page)).toBe("rehearsal");
  expect((await getTransportState(page)).sessionMode).toBe("rehearsal");
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { getModes(): Array<{ id: string }> };
    };
    return appWindow.session?.getModes().map((mode) => mode.id).join(",");
  })).toBe("break,solo-practice,rehearsal,performance");
  await page.getByTestId("session-mode-break-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Break");
  await expect(page.getByTestId("session-mode-break")).toBeChecked();
  await expect(status).toContainText("mode break | stopped");
  expect(await getSessionMode(page)).toBe("break");
  expect((await getTransportState(page)).sessionMode).toBe("break");
  await expect.poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount).toBe(0);
  await page.getByTestId("session-mode-performance-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Performance");
  await expect(status).toContainText("mode performance | stopped");
  expect(await getSessionMode(page)).toBe("performance");
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode("solo-practice");
  })).toBe("solo-practice");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Solo practice");
  await expect(page.getByTestId("session-mode-solo-practice")).toBeChecked();
  expect(await page.evaluate(() => {
    const appWindow = window as unknown as {
      session?: { setMode(mode: string): SessionMode };
    };
    return appWindow.session?.setMode("not-a-mode");
  })).toBe("solo-practice");
  await page.getByTestId("session-mode-rehearsal-option").click();
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  expect(await getSessionMode(page)).toBe("rehearsal");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("player-pulse-name")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-role")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-sound")).toHaveText("root pulse");
  await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-taste-action")).toHaveText("repeat");
  await expect(page.getByTestId("player-pulse-taste-summary")).toContainText("Listening");
  await expect(page.getByTestId("player-bass-name")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-role")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-sound")).toHaveText("modal bass");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-taste-action")).toHaveText("repeat");
  await expect(page.getByTestId("player-melody-name")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-role")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-sound")).toHaveText("modal line");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect(page.getByTestId("thought-seed-pulse-focus")).not.toHaveText("");
  await expect(page.getByTestId("thought-seed-bass-fragments")).not.toHaveText("");
  await expect(page.getByTestId("thought-seed-melody-motif")).toContainText("resting");
  await expect(page.getByTestId("thought-request-melody-level")).toContainText("in_song_short");
  await expect(page.getByTestId("thought-intent-melody-action")).not.toHaveText("none");
  await expect(page.getByTestId("ollama-base-url-input")).toHaveValue("http://127.0.0.1:11434");
  await expect(page.getByTestId("ollama-model-input")).toHaveValue("gemma4:31b");
  await expect(page.getByTestId("ollama-health-status")).toContainText("unknown");
  await expect(page.getByTestId("ollama-validation-result")).toHaveText("idle");
  await expect(page.getByTestId("ollama-primer-summary")).toContainText("scaleDegree");
  const primer = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getSessionPrimer(): string };
    };
    return appWindow.ollama?.getSessionPrimer();
  });
  expect(primer).toContain("scaleDegree is a pitch-class index");
  expect(primer).toContain("system owns sourceStartBeat");
  const influenceProbePrompt = await page.evaluate(() => {
    const appWindow = window as unknown as {
      ollama?: { getInfluenceProbePrompt(playerId?: string): string };
    };
    return appWindow.ollama?.getInfluenceProbePrompt("melody");
  });
  expect(influenceProbePrompt).toContain("influence_probe");
  expect(influenceProbePrompt).toContain("abstract transferable technique");
  const initialThoughtSeeds = await getThoughtSeeds(page);
  expect(initialThoughtSeeds.map((seed) => seed.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialThoughtSeeds.every((seed) => seed.selectedFragments.length === 2)).toBe(true);
  expect(initialThoughtSeeds.every((seed) => seed.disposition.length > 0)).toBe(true);
  expect(initialThoughtSeeds.every((seed) => seed.recentMotif.displayExcerpt === "resting")).toBe(true);
  expect(initialThoughtSeeds.every((seed) => validateMusicalExcerpt(seed.recentMotif.excerpt).valid)).toBe(true);
  const initialThoughtRequests = await getThoughtRequests(page);
  const initialHookIntents = await getMockThoughtIntents(page);
  const initialMockIntents = initialThoughtRequests.map((request) => createMockThoughtIntent(request));
  expect(initialThoughtRequests.map((request) => request.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialThoughtRequests.every((request) => request.requestLevel === "in_song_short")).toBe(true);
  expect(initialThoughtRequests.every((request) => request.seed.playerId === request.playerId)).toBe(true);
  expect(initialThoughtRequests.every((request) => validatePlayerThoughtRequest(request).valid)).toBe(true);
  expect(initialHookIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialMockIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(initialMockIntents.every((intent) => {
    const request = initialThoughtRequests.find((candidate) => candidate.id === intent.requestId);
    return request ? validatePlayerThoughtIntent(intent, request).valid : false;
  })).toBe(true);
  await expect(page.getByTestId("listening-tonal-context")).toHaveText("C mixolydian");
  await expect(page.getByTestId("listening-event-count")).toHaveText("0");
  await expect(page.getByTestId("lookahead-health")).toHaveText("stopped");
  await expect(page.getByTestId("lookahead-lead")).toHaveText("0.0 / 8 beats");
  await expect(page.getByTestId("lookahead-through")).toHaveText("beat 0.0");
  await expect(page.getByTestId("lookahead-pending-slots")).toHaveText("0");

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(400);
  expect(box?.height).toBeGreaterThan(220);
  expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 12 / 7)).toBeLessThan(0.08);

  await button.click();
  await expect(button).toHaveText("Stop");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await expect(page.getByTestId("lookahead-health")).toHaveText("healthy");
  const playingState = await getTransportState(page);
  expect(playingState.lookahead.targetBeats).toBe(8);
  expect(playingState.lookahead.minimumBeats).toBe(4);
  expect(playingState.lookahead.leadBeats).toBeGreaterThanOrEqual(
    playingState.lookahead.minimumBeats,
  );
  expect(playingState.lookahead.leadBeats).toBeLessThanOrEqual(
    playingState.lookahead.targetBeats + 0.5,
  );
  expect(playingState.lookahead.scheduledThroughBeat).toBeGreaterThanOrEqual(8);
  expect(playingState.lookahead.pendingSlotCount).toBeLessThanOrEqual(40);
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBeGreaterThan(0);
  await expect(page.getByTestId("listening-latest-event")).toContainText("note");
  await expect
    .poll(async () => {
      const frame = await getListeningFrame(page);
      return [...new Set(frame.recentEvents.map((event) => event.playerId))].sort().join(",");
    })
    .toBe("bass,melody,pulse");

  const frame = await getListeningFrame(page);
  expect(frame.tonalContext).toEqual({
    tonic: "C",
    mode: "mixolydian",
    scale: ["C", "D", "E", "F", "G", "A", "Bb"],
  });
  expect(frame.mix.silenceRatio).toBeGreaterThanOrEqual(0);
  expect(frame.mix.silenceRatio).toBeLessThanOrEqual(1);
  expect(frame.mix.brightness).toBeGreaterThanOrEqual(0);
  expect(frame.mix.brightness).toBeLessThanOrEqual(1);
  expect(frame.mix.transientDensity).toBeGreaterThan(0);
  expect(frame.players.map((player) => player.id).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(frame.players.find((player) => player.id === "pulse")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "bass")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "melody")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.map((player) => player.state)).toEqual(["performing", "performing", "performing"]);
  expect(
    frame.recentEvents.every((event) => {
      if (!event.pitch) return true;
      const pitchClass = event.pitch.replace(/[0-9-]+$/, "");
      return frame.tonalContext.scale.includes(pitchClass);
    }),
  ).toBe(true);
  expect(
    frame.recentEvents.every((event) => {
      const snappedHalfBeat = event.absoluteBeat * 2;
      return Math.abs(snappedHalfBeat - Math.round(snappedHalfBeat)) < 0.000001;
    }),
  ).toBe(true);
  await expect
    .poll(async () => {
      const seeds = await getThoughtSeeds(page);
      return seeds.find((seed) => seed.playerId === "melody")?.recentMotif.eventCount ?? 0;
    })
    .toBeGreaterThan(0);
  const activeThoughtSeeds = await getThoughtSeeds(page);
  const melodySeed = activeThoughtSeeds.find((seed) => seed.playerId === "melody");
  expect(melodySeed?.promptFocus.length).toBeGreaterThan(0);
  expect(melodySeed?.listeningSummary.eventCount).toBeGreaterThan(0);
  expect(melodySeed?.recentMotif.displayExcerpt).not.toBe("resting");
  expect(melodySeed?.recentMotif.excerpt.steps.length).toBeGreaterThan(0);
  expect(melodySeed?.recentMotif.excerpt.steps.every((step, index, steps) => (
    index === 0 || step.positionBeats >= steps[index - 1].positionBeats
  ))).toBe(true);
  expect(melodySeed?.recentMotif.excerpt.steps.every((step) => step.positionBeats >= 0)).toBe(true);
  const activeThoughtRequests = await getThoughtRequests(page);
  const activeHookIntents = await getMockThoughtIntents(page);
  const activeMockIntents = activeThoughtRequests.map((request) => createMockThoughtIntent(request));
  const melodyRequest = activeThoughtRequests.find((request) => request.playerId === "melody");
  const melodyIntent = activeMockIntents.find((intent) => intent.playerId === "melody");
  expect(activeHookIntents.map((intent) => intent.playerId).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(melodyRequest?.excerpts[0].steps.length).toBeGreaterThan(0);
  expect(melodyRequest && validatePlayerThoughtRequest(melodyRequest).valid).toBe(true);
  expect(melodyRequest && melodyIntent && validatePlayerThoughtIntent(melodyIntent, melodyRequest).valid).toBe(true);
  expect(melodyIntent?.musicalIdea.origin).toBe("imagined");
  if (!melodyRequest || !melodyIntent) {
    throw new Error("Expected melody thought protocol objects");
  }
  const parsedRawThought = await page.evaluate((rawResponse) => {
    const appWindow = window as unknown as {
      ollama?: {
        parseThoughtResponse(rawResponse: string, playerId?: string): {
          status: string;
          intent?: PlayerThoughtIntent;
        };
      };
    };
    return appWindow.ollama?.parseThoughtResponse(rawResponse, "melody");
  }, JSON.stringify({
    ...melodyIntent,
    musicalIdea: {
      ...melodyIntent.musicalIdea,
      sourceStartBeat: 999,
    },
  }));
  expect(parsedRawThought?.status).toBe("ok");
  expect(parsedRawThought?.intent?.musicalIdea.sourceStartBeat).not.toBe(999);
  expect(parsedRawThought?.intent?.musicalIdea.sourceStartBeat).toBeGreaterThanOrEqual(0);
  const outOfRangeDegreeExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      scaleDegree: melodyRequest.constraints.tonalContext.scale.length,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(outOfRangeDegreeExcerpt).errors).toContain(
    "step 0 scaleDegree must be within tonal scale",
  );
  const outOfScalePitchExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "F#4",
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(outOfScalePitchExcerpt).errors).toContain(
    "step 0 pitch must belong to tonal scale",
  );
  const disagreeingPitchAndDegreeExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "C4",
      scaleDegree: 1,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(disagreeingPitchAndDegreeExcerpt).errors).toContain(
    "step 0 pitch and scaleDegree disagree",
  );
  const disagreeingPitchAndOctaveExcerpt: MusicalExcerpt = {
    ...melodyRequest.excerpts[0],
    durationBeats: 0.5,
    steps: [{
      kind: "note",
      positionBeats: 0,
      durationBeats: 0.5,
      pitch: "C4",
      scaleDegree: 0,
      octave: 5,
      tags: ["invalid:model-output"],
    }],
  };
  expect(validateMusicalExcerpt(disagreeingPitchAndOctaveExcerpt).errors).toContain(
    "step 0 pitch and octave disagree",
  );
  const tooLongIntent: PlayerThoughtIntent = {
    ...melodyIntent,
    musicalIdea: {
      ...melodyIntent.musicalIdea,
      durationBeats: melodyRequest.constraints.maxDurationBeats + 1,
    },
  };
  expect(validatePlayerThoughtIntent(tooLongIntent, melodyRequest).errors).toContain(
    "musical idea duration exceeds request constraint",
  );
  expect(melodyRequest && JSON.stringify(createMockThoughtIntent(melodyRequest))).toBe(
    melodyRequest && JSON.stringify(createMockThoughtIntent(melodyRequest)),
  );

  await expect
    .poll(async () => {
      const evaluations = await getTasteEvaluations(page);
      return evaluations.map((evaluation) => evaluation.playerId).sort().join(",");
    })
    .toBe("bass,melody,pulse");
  const evaluations = await getTasteEvaluations(page);
  expect(evaluations.every((evaluation) => evaluation.summary.length > 0)).toBe(true);
  expect(evaluations.every((evaluation) => evaluation.reasons.length > 0)).toBe(true);
  expect(evaluations.every((evaluation) => evaluation.affinity >= 0 && evaluation.affinity <= 1)).toBe(true);
  expect(evaluations.map((evaluation) => evaluation.action)).toContain("repeat");
  await expect(page.getByTestId("player-melody-taste-summary")).not.toHaveText("Listening for a shape.");

  await expect
    .poll(async () => {
      const tasteFrame = await getListeningFrame(page);
      return tasteFrame.recentEvents.some((event) => event.kind === "rest");
    }, { timeout: 7_000 })
    .toBe(true);
  const tasteFrame = await getListeningFrame(page);
  expect(tasteFrame.recentEvents.some((event) => event.tags.some((tag) => tag.startsWith("taste:")))).toBe(true);
  const melodyActions = new Set<string>();
  for (let sample = 0; sample < 6; sample += 1) {
    const sampledEvaluations = await getTasteEvaluations(page);
    melodyActions.add(sampledEvaluations.find((evaluation) => evaluation.playerId === "melody")?.action ?? "");
    await page.waitForTimeout(250);
  }
  expect(melodyActions.size).toBeLessThanOrEqual(2);

  await page.waitForTimeout(650);
  const postureFrame = await getListeningFrame(page);
  expect(postureFrame.players.map((player) => player.state)).toEqual([
    "performing",
    "performing",
    "performing",
  ]);

  await setSessionMode(page, "break");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Break");
  await expect(page.getByTestId("session-mode-break")).toBeChecked();
  await expect(status).toContainText("mode break | playing");
  const breakStartCount = await getRecordedEventCount(page);
  expect(breakStartCount).toBeGreaterThan(0);
  const breakStartBeat = await getLatestRecordedBeat(page);
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount, { timeout: 9_000 })
    .toBe(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("empty");
  const drainedEventCount = await getRecordedEventCount(page);
  expect(drainedEventCount).toBeGreaterThanOrEqual(breakStartCount);
  const drainedBeat = await getLatestRecordedBeat(page);
  expect(drainedBeat).toBeGreaterThanOrEqual(breakStartBeat);
  await page.waitForTimeout(1_000);
  expect(await getRecordedEventCount(page)).toBe(drainedEventCount);
  expect(await getLatestRecordedBeat(page)).toBe(drainedBeat);

  await setSessionMode(page, "rehearsal");
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  await expect(status).toContainText("mode rehearsal | playing");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await expect
    .poll(async () => getLatestRecordedBeat(page))
    .toBeGreaterThan(drainedBeat);

  await setSessionMode(page, "performance");
  await expect(status).toContainText("mode performance | playing");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBeGreaterThan(0);
  await setSessionMode(page, "solo-practice");
  await expect(status).toContainText("mode solo practice | playing");
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("healthy");
  await setSessionMode(page, "rehearsal");

  await button.click();
  await expect(button).toHaveText("Start");
  await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect
    .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
    .toBe(0);
  await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("stopped");
  await expect(page.getByTestId("lookahead-pending-slots")).toHaveText("0");
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBe(0);

  for (let index = 0; index < 10; index += 1) {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBeGreaterThan(0);
    const cycleState = await getTransportState(page);
    expect(cycleState.lookahead.health).toBe("healthy");
    expect(cycleState.lookahead.pendingSlotCount).toBeLessThanOrEqual(40);

    await page.waitForTimeout(150);

    await button.click();
    await expect(button).toHaveText("Start");
    await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBe(0);
    await expect.poll(async () => (await getTransportState(page)).lookahead.health).toBe("stopped");
  }

  await expect(status).toContainText(
    "mode rehearsal | stopped | 90 BPM | bar 1 | beat 0.0 | lookahead stopped 0.0/8 | pending slots 0",
  );
  await expect.poll(async () => (await getTransportState(page)).status).toBe("stopped");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
