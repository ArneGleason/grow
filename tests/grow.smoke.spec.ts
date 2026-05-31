import { expect, test, type Page } from "@playwright/test";
import { calculatePlayerExpression } from "../src/expression";
import { calculatePerformedTiming } from "../src/performed-time";
import { MELODY_PLAYER } from "../src/players";
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
  expression: {
    latest: Array<{
      playerId: string;
      velocityMultiplier: number;
      finalVelocity: number;
      eventIndex: number;
      summary: string;
      modulators: {
        longCycle: number;
        mediumCycle: number;
        shortCycle: number;
        eventStep: number;
        crossCoupling: number;
      };
    }>;
  };
  performedTiming: {
    latest: Array<{
      playerId: string;
      absoluteBeat: number;
      eventIndex: number;
      performedOffsetBeats: number;
      maximumOffsetBeats: number;
      summary: string;
      components: {
        longCycle: number;
        mediumCycle: number;
        eventStep: number;
        dispositionPressure: number;
        leapPressure: number;
        registerPressure: number;
        densityPressure: number;
      };
    }>;
  };
};

type ListeningFrame = {
  eventCount: number;
  tonalContext: { tonic: string; mode: string; scale: readonly string[] };
  mix: {
    silenceRatio: number;
    brightness: number;
    transientDensity: number;
    agitation: number;
    agitationSources: {
      timingVariance: number;
      velocitySpike: number;
      densityPressure: number;
      pushDragPressure: number;
    };
  };
  recentEvents: Array<{
    playerId: string;
    kind: string;
    pitch?: string;
    absoluteBeat: number;
    eventIndex: number;
    performedOffsetBeats: number;
    performedOffsetSeconds: number;
    velocity: number;
    expression?: {
      playerId: string;
      velocityMultiplier: number;
      finalVelocity: number;
      eventIndex: number;
      summary: string;
    };
    performedTiming?: {
      playerId: string;
      performedOffsetBeats: number;
      maximumOffsetBeats: number;
      eventIndex: number;
      summary: string;
    };
    tags: string[];
  }>;
  players: Array<{
    id: string;
    state: string;
    recentEvents: unknown[];
    contagion: {
      level: number;
      summary: string;
      components: {
        catchPressure: number;
        damping: number;
        amplification: number;
        activity: number;
      };
    };
  }>;
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

async function collectPerformedOffsets(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const appWindow = window as unknown as {
      listening?: {
        getEvents(): Array<{
          playerId: string;
          eventIndex: number;
          performedOffsetBeats: number;
        }>;
      };
    };
    const events = appWindow.listening?.getEvents() ?? [];
    return Object.fromEntries(
      events.map((event) => [
        `${event.playerId}:${event.eventIndex}`,
        event.performedOffsetBeats,
      ]),
    );
  });
}

async function helpPanelIsInsideSection(page: Page, helpButtonTestId: string): Promise<boolean> {
  return page.evaluate((testId) => {
    const helpButton = document.querySelector(`[data-testid="${testId}"]`);
    const helpPanel = document.querySelector("[data-testid='inspector-help-panel']");
    return Boolean(helpButton?.closest(".inspector-section")?.contains(helpPanel));
  }, helpButtonTestId);
}

test("velocity expression snapshots are deterministic and bounded", () => {
  const input = {
    player: MELODY_PLAYER,
    absoluteBeat: 12.5,
    eventIndex: 8,
    baseVelocity: 0.32,
    tasteVelocityMultiplier: 1.08,
  };
  const first = calculatePlayerExpression(input);
  const second = calculatePlayerExpression(input);
  const nextStep = calculatePlayerExpression({
    ...input,
    eventIndex: input.eventIndex + 1,
  });

  expect(first).toEqual(second);
  expect(first.velocityMultiplier).toBeGreaterThanOrEqual(0.8);
  expect(first.velocityMultiplier).toBeLessThanOrEqual(1.22);
  expect(first.finalVelocity).toBeGreaterThanOrEqual(0);
  expect(first.finalVelocity).toBeLessThanOrEqual(1);
  expect(first.summary.length).toBeGreaterThan(0);
  expect(nextStep.velocityMultiplier).not.toBe(first.velocityMultiplier);
});

test("performed timing snapshots are deterministic bounded data", () => {
  const input = {
    player: MELODY_PLAYER,
    absoluteBeat: 12.5,
    eventIndex: 8,
    pitch: "G4",
    previousPitch: "C4",
    durationBeats: 0.5,
    baseVelocity: 0.32,
    localDensity: 0.7,
  };
  const first = calculatePerformedTiming(input);
  const second = calculatePerformedTiming(input);
  const nextStep = calculatePerformedTiming({
    ...input,
    eventIndex: input.eventIndex + 1,
  });

  expect(first).toEqual(second);
  expect(Math.abs(first.performedOffsetBeats)).toBeLessThanOrEqual(first.maximumOffsetBeats);
  expect(first.maximumOffsetBeats).toBeLessThanOrEqual(0.035);
  expect(first.components.leapPressure).toBeGreaterThan(0);
  expect(first.components.densityPressure).toBe(0.7);
  expect(first.summary.length).toBeGreaterThan(0);
  expect(nextStep.performedOffsetBeats).not.toBe(first.performedOffsetBeats);
});

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

test("performed offsets replay across transport restarts", async ({ page }) => {
  test.setTimeout(25_000);
  await page.goto("/");

  const button = page.getByTestId("transport-toggle");
  const captureOffsets = async (): Promise<Record<string, number>> => {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect
      .poll(async () => getRecordedEventCount(page), { timeout: 8_000 })
      .toBeGreaterThanOrEqual(10);
    const offsets = await collectPerformedOffsets(page);
    await button.click();
    await expect(button).toHaveText("Start");
    await expect
      .poll(async () => (await getTransportState(page)).lookahead.pendingSlotCount)
      .toBe(0);
    return offsets;
  };

  const firstRun = await captureOffsets();
  const secondRun = await captureOffsets();
  const replayedKeys = Object.keys(firstRun).filter((key) => key in secondRun);

  expect(replayedKeys.length).toBeGreaterThanOrEqual(8);
  expect(Object.fromEntries(replayedKeys.map((key) => [key, secondRun[key]]))).toEqual(
    Object.fromEntries(replayedKeys.map((key) => [key, firstRun[key]])),
  );
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

test("inspector help icons explain current controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("inspector-help-panel")).toBeHidden();

  await page.getByTestId("help-ollama").click();
  await expect(page.getByTestId("inspector-help-panel")).toBeVisible();
  await expect(page.getByTestId("inspector-help-title")).toHaveText("Ollama");
  await expect(page.getByTestId("inspector-help-body")).toContainText("local model boundary");
  await expect(page.getByTestId("help-ollama")).toHaveAttribute("aria-expanded", "true");
  expect(await helpPanelIsInsideSection(page, "help-ollama")).toBe(true);

  await page.getByTestId("help-lookahead").click();
  await expect(page.getByTestId("inspector-help-title")).toHaveText("Lookahead");
  await expect(page.getByTestId("inspector-help-body")).toContainText("delayed-now buffer");
  await expect(page.getByTestId("help-ollama")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("help-lookahead")).toHaveAttribute("aria-expanded", "true");
  expect(await helpPanelIsInsideSection(page, "help-lookahead")).toBe(true);

  await page.getByTestId("inspector-help-close").click();
  await expect(page.getByTestId("inspector-help-panel")).toBeHidden();
  await expect(page.getByTestId("help-lookahead")).toHaveAttribute("aria-expanded", "false");
});

test("stage resizer changes the inspector width within bounds", async ({ page }) => {
  await page.goto("/");

  const stage = page.getByTestId("stage");
  const inspector = page.getByTestId("player-inspector");
  const resizer = page.getByTestId("stage-resizer");
  const stageBox = await stage.boundingBox();
  const initialInspectorBox = await inspector.boundingBox();
  const resizerBox = await resizer.boundingBox();

  expect(stageBox).not.toBeNull();
  expect(initialInspectorBox).not.toBeNull();
  expect(resizerBox).not.toBeNull();

  if (!stageBox || !initialInspectorBox || !resizerBox) return;

  await page.mouse.move(
    resizerBox.x + resizerBox.width / 2,
    resizerBox.y + resizerBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizerBox.x - 120, resizerBox.y + resizerBox.height / 2);
  await page.mouse.up();

  const widenedInspectorBox = await inspector.boundingBox();
  expect(widenedInspectorBox).not.toBeNull();
  expect(widenedInspectorBox?.width).toBeGreaterThan(initialInspectorBox.width + 60);
  expect(widenedInspectorBox?.width).toBeLessThanOrEqual(stageBox.width * 0.5 + 2);

  await resizer.focus();
  await page.keyboard.press("Home");
  const narrowedInspectorBox = await inspector.boundingBox();
  expect(narrowedInspectorBox).not.toBeNull();
  expect(narrowedInspectorBox?.width).toBeLessThan(widenedInspectorBox?.width ?? Infinity);
  await expect(resizer).toHaveAttribute("aria-valuenow", "280");
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
  const canvasFrame = page.getByTestId("terrarium-container");
  const canvas = page.getByTestId("terrarium-canvas");

  await expect(page.locator(".brand__subtitle")).toHaveText("Byte 10e: agitation and contagion");
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
  await expect(page.getByTestId("player-pulse-expression")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-offset")).toHaveText("waiting");
  await expect(page.getByTestId("player-pulse-contagion")).toHaveText("0.00 (quiet)");
  await expect(page.getByTestId("player-bass-name")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-role")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-sound")).toHaveText("modal bass");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-taste-action")).toHaveText("repeat");
  await expect(page.getByTestId("player-melody-name")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-role")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-sound")).toHaveText("modal line");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-expression")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-offset")).toHaveText("waiting");
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
  await expect(page.getByTestId("listening-agitation")).toHaveText("0.00 (density)");
  await expect(page.getByTestId("lookahead-health")).toHaveText("stopped");
  await expect(page.getByTestId("lookahead-lead")).toHaveText("0.0 / 8 beats");
  await expect(page.getByTestId("lookahead-through")).toHaveText("beat 0.0");
  await expect(page.getByTestId("lookahead-pending-slots")).toHaveText("0");

  const frameBox = await canvasFrame.boundingBox();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(400);
  expect(box?.height).toBeGreaterThan(340);
  expect(Math.abs((box?.width ?? 0) - (frameBox?.width ?? 0))).toBeLessThan(2);
  expect(Math.abs((box?.height ?? 0) - (frameBox?.height ?? 0))).toBeLessThan(2);

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
  await expect
    .poll(async () => (await getTransportState(page)).expression.latest.length)
    .toBe(3);
  await expect
    .poll(async () => (await getTransportState(page)).performedTiming.latest.length)
    .toBe(3);
  await expect
    .poll(async () => (await getListeningFrame(page)).mix.agitation)
    .toBeGreaterThan(0);
  await expect(page.getByTestId("player-pulse-expression")).toContainText("x");
  await expect(page.getByTestId("player-pulse-offset")).toContainText("beats");
  await expect(page.getByTestId("player-melody-contagion")).toContainText("heat");
  await expect(page.getByTestId("listening-agitation")).toContainText("(");

  const frame = await getListeningFrame(page);
  const expressionState = await getTransportState(page);
  expect(expressionState.expression.latest.map((expression) => expression.playerId).sort()).toEqual([
    "bass",
    "melody",
    "pulse",
  ]);
  expect(expressionState.expression.latest.every((expression) => (
    expression.velocityMultiplier >= 0.78
    && expression.velocityMultiplier <= 1.24
    && expression.finalVelocity >= 0
    && expression.finalVelocity <= 1
    && expression.summary.length > 0
  ))).toBe(true);
  expect(expressionState.performedTiming.latest.map((timing) => timing.playerId).sort()).toEqual([
    "bass",
    "melody",
    "pulse",
  ]);
  expect(expressionState.performedTiming.latest.every((timing) => (
    Math.abs(timing.performedOffsetBeats) <= timing.maximumOffsetBeats
    && timing.maximumOffsetBeats <= 0.035
    && timing.summary.length > 0
  ))).toBe(true);
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
  expect(frame.mix.agitation).toBeGreaterThan(0);
  expect(frame.mix.agitation).toBeLessThanOrEqual(1);
  expect(Object.values(frame.mix.agitationSources).every((value) => value >= 0 && value <= 1)).toBe(true);
  expect(frame.players.map((player) => player.id).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(frame.players.every((player) => (
    player.contagion.level >= 0
    && player.contagion.level <= 1
    && player.contagion.summary.length > 0
    && Object.values(player.contagion.components).every((value) => value >= 0 && value <= 1)
  ))).toBe(true);
  expect(frame.players.some((player) => player.contagion.level > 0)).toBe(true);
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
  expect(frame.recentEvents.every((event) => event.velocity >= 0 && event.velocity <= 1)).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("expression:velocity"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("timing:offset-data"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.tags.includes("timing:audible-offset"))).toBe(true);
  expect(frame.recentEvents.some((event) => event.expression && event.expression.velocityMultiplier !== 1)).toBe(true);
  expect(frame.recentEvents.every((event) => Number.isInteger(event.eventIndex) && event.eventIndex >= 0)).toBe(true);
  expect(frame.recentEvents.every((event) => {
    if (!event.expression || !event.performedTiming) return false;
    return event.expression.eventIndex === event.eventIndex
      && event.performedTiming.eventIndex === event.eventIndex
      && event.performedTiming.performedOffsetBeats === event.performedOffsetBeats
      && event.performedOffsetSeconds === Math.round((event.performedOffsetBeats * 60 / 90) * 10_000) / 10_000
      && Math.abs(event.performedOffsetBeats) <= event.performedTiming.maximumOffsetBeats
      && Math.abs(event.performedOffsetBeats) <= 0.035;
  })).toBe(true);
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
  await expect.poll(async () => (await getTransportState(page)).expression.latest.length).toBe(0);
  await expect.poll(async () => (await getTransportState(page)).performedTiming.latest.length).toBe(0);
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
