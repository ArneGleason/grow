import { expect, test, type Page } from "@playwright/test";

type TransportState = {
  status: "stopped" | "playing";
  bpm: number;
  bar: number;
  currentBeat: number;
  scheduledEventCount: number;
};

type ListeningFrame = {
  eventCount: number;
  tonalContext: { tonic: string; mode: string; scale: readonly string[] };
  mix: { silenceRatio: number };
  recentEvents: Array<{
    playerId: string;
    kind: string;
    pitch?: string;
    absoluteBeat: number;
  }>;
  players: Array<{ id: string; state: string; recentEvents: unknown[] }>;
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

test("Grow starts three players, hears events, and cleans up the transport", async ({ page }) => {
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

  await expect(page.locator(".brand__subtitle")).toHaveText(
    "Byte 3b: stable posture and tonal listening",
  );
  await expect(button).toHaveText("Start");
  await expect(status).toContainText("stopped | 90 BPM | bar 1 | beat 0.0 | scheduled 0");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("player-pulse-name")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-role")).toHaveText("pulse");
  await expect(page.getByTestId("player-pulse-sound")).toHaveText("C2 beat");
  await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-bass-name")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-role")).toHaveText("bass");
  await expect(page.getByTestId("player-bass-sound")).toHaveText("modal bass");
  await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
  await expect(page.getByTestId("player-melody-name")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-role")).toHaveText("melody");
  await expect(page.getByTestId("player-melody-sound")).toHaveText("modal line");
  await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
  await expect(page.getByTestId("listening-tonal-context")).toHaveText("C mixolydian");
  await expect(page.getByTestId("listening-event-count")).toHaveText("0");

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(400);
  expect(box?.height).toBeGreaterThan(220);
  expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 12 / 7)).toBeLessThan(0.08);

  await button.click();
  await expect(button).toHaveText("Stop");
  await expect
    .poll(async () => (await getTransportState(page)).scheduledEventCount)
    .toBe(3);
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
  expect(frame.players.map((player) => player.id).sort()).toEqual(["bass", "melody", "pulse"]);
  expect(frame.players.find((player) => player.id === "pulse")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "bass")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.find((player) => player.id === "melody")?.recentEvents.length).toBeGreaterThan(0);
  expect(frame.players.map((player) => player.state)).toEqual(["performing", "performing", "performing"]);
  expect(
    frame.recentEvents.every((event) => {
      const snappedHalfBeat = event.absoluteBeat * 2;
      return Math.abs(snappedHalfBeat - Math.round(snappedHalfBeat)) < 0.000001;
    }),
  ).toBe(true);

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
    .poll(async () => (await getTransportState(page)).scheduledEventCount)
    .toBe(0);
  await expect.poll(async () => (await getListeningFrame(page)).eventCount).toBe(0);

  for (let index = 0; index < 10; index += 1) {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect
      .poll(async () => (await getTransportState(page)).scheduledEventCount)
      .toBe(3);

    await page.waitForTimeout(150);

    await button.click();
    await expect(button).toHaveText("Start");
    await expect(page.getByTestId("player-pulse-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-bass-state")).toHaveText("waiting");
    await expect(page.getByTestId("player-melody-state")).toHaveText("waiting");
    await expect
      .poll(async () => (await getTransportState(page)).scheduledEventCount)
      .toBe(0);
  }

  await expect(status).toContainText("stopped | 90 BPM | bar 1 | beat 0.0 | scheduled 0");
  await expect.poll(async () => (await getTransportState(page)).status).toBe("stopped");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
