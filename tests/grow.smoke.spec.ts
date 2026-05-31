import { expect, test, type Page } from "@playwright/test";

type SessionMode = "break" | "solo-practice" | "rehearsal" | "performance";

type TransportState = {
  status: "stopped" | "playing";
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

test("Grow exposes session modes, starts three players, hears events, and cleans up the transport", async ({ page }) => {
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

  await expect(page.locator(".brand__subtitle")).toHaveText("Byte 6a: session modes");
  await expect(button).toHaveText("Start");
  await expect(status).toContainText(
    "mode rehearsal | stopped | 90 BPM | bar 1 | beat 0.0 | lookahead stopped 0.0/8 | pending slots 0",
  );
  await expect(page.getByTestId("session-mode-current")).toHaveText("Rehearsal");
  await expect(page.getByTestId("session-mode-rehearsal")).toBeChecked();
  expect(await getSessionMode(page)).toBe("rehearsal");
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
