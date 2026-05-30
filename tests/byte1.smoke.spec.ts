import { expect, test, type Page } from "@playwright/test";

type TransportState = {
  status: "stopped" | "playing";
  bpm: number;
  bar: number;
  scheduledEventCount: number;
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

test("Byte 1 starts, stops, and cleans up the pulse transport", async ({ page }) => {
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

  await expect(button).toHaveText("Start");
  await expect(status).toContainText("stopped | 90 BPM | bar 1 | scheduled 0");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("player-name")).toHaveText("pulse");
  await expect(page.getByTestId("player-state")).toHaveText("waiting");

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(400);
  expect(box?.height).toBeGreaterThan(220);
  expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 12 / 7)).toBeLessThan(0.08);

  for (let index = 0; index < 10; index += 1) {
    await button.click();
    await expect(button).toHaveText("Stop");
    await expect(page.getByTestId("player-state")).toHaveText("performing");
    await expect
      .poll(async () => (await getTransportState(page)).scheduledEventCount)
      .toBe(1);

    await page.waitForTimeout(150);

    await button.click();
    await expect(button).toHaveText("Start");
    await expect(page.getByTestId("player-state")).toHaveText("waiting");
    await expect
      .poll(async () => (await getTransportState(page)).scheduledEventCount)
      .toBe(0);
  }

  await expect(status).toContainText("stopped | 90 BPM | bar 1 | scheduled 0");
  await expect.poll(async () => (await getTransportState(page)).status).toBe("stopped");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

