import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import type { Player, PlayerRuntimeState } from "./players";
import type { RuntimePlayer } from "./world-state";

const TERRARIUM_WIDTH = 960;
const TERRARIUM_HEIGHT = 560;
const AUTO_FOCUS_MARGIN = 180;
const MAX_AUTO_FOCUS_SCALE = 1.55;
const HALO_RESTING_ALPHA = 0.64;
const FLASH_DURATION_MS = 180;
const FLASH_SCALE_BUMP = 0.34;

interface RenderedPlayer {
  container: Container;
  halo: Graphics;
  anchor: { x: number; y: number };
  phase: number;
  radius: number;
  speed: number;
  flashUntilMs: number;
}

export interface TerrariumView {
  app: Application;
  setPlayerState(playerId: string, state: PlayerRuntimeState): void;
  flashPlayer(playerId: string): void;
  destroy(): void;
}

export async function createTerrariumView(
  container: HTMLElement,
  players: readonly RuntimePlayer[],
): Promise<TerrariumView> {
  const app = new Application();
  await app.init({
    width: TERRARIUM_WIDTH,
    height: TERRARIUM_HEIGHT,
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
  });

  app.canvas.setAttribute("data-testid", "terrarium-canvas");
  fitCanvasToContainer(app.canvas);
  container.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const background = drawBackground();
  world.addChild(background);

  const renderedPlayers = new Map<string, RenderedPlayer>();
  players.forEach(({ player, state }, index) => {
    const renderedPlayer = drawPlayer(player);
    renderedPlayer.container.x = player.position.x;
    renderedPlayer.container.y = player.position.y;
    applyVisualState(renderedPlayer.container, state);
    renderedPlayers.set(player.id, {
      container: renderedPlayer.container,
      halo: renderedPlayer.halo,
      anchor: player.position,
      phase: index * 2.1,
      radius: 5 + index * 2,
      speed: 0.24 + index * 0.05,
      flashUntilMs: 0,
    });
    world.addChild(renderedPlayer.container);
  });

  app.ticker.add(() => {
    const nowMs = performance.now();
    const now = nowMs / 1000;
    for (const renderedPlayer of renderedPlayers.values()) {
      renderedPlayer.container.x =
        renderedPlayer.anchor.x +
        Math.cos(now * renderedPlayer.speed + renderedPlayer.phase) * renderedPlayer.radius;
      renderedPlayer.container.y =
        renderedPlayer.anchor.y +
        Math.sin(now * renderedPlayer.speed * 0.8 + renderedPlayer.phase) * renderedPlayer.radius;
      const flashProgress = Math.max(0, (renderedPlayer.flashUntilMs - nowMs) / FLASH_DURATION_MS);
      renderedPlayer.halo.alpha = HALO_RESTING_ALPHA + flashProgress * (1 - HALO_RESTING_ALPHA);
      renderedPlayer.halo.scale.set(1 + flashProgress * FLASH_SCALE_BUMP);
    }
  });

  const renderer = app.renderer;
  const focusBounds = getPlayerFocusBounds(players);
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (width <= 0 || height <= 0) return;
    const coverScale = Math.max(width / TERRARIUM_WIDTH, height / TERRARIUM_HEIGHT);
    const focusScale = Math.min(width / focusBounds.width, height / focusBounds.height);
    const scale = Math.max(coverScale, Math.min(focusScale, MAX_AUTO_FOCUS_SCALE));
    const scaledWorldWidth = TERRARIUM_WIDTH * scale;
    const scaledWorldHeight = TERRARIUM_HEIGHT * scale;
    const focusCenterX = focusBounds.x + focusBounds.width / 2;
    const focusCenterY = focusBounds.y + focusBounds.height / 2;
    world.scale.set(scale);
    world.x = clamp(width / 2 - focusCenterX * scale, width - scaledWorldWidth, 0);
    world.y = clamp(height / 2 - focusCenterY * scale, height - scaledWorldHeight, 0);
    renderer.resize(width, height);
    fitCanvasToContainer(app.canvas);
  });
  resizeObserver.observe(container);

  return {
    app,
    setPlayerState(playerId: string, state: PlayerRuntimeState): void {
      const renderedPlayer = renderedPlayers.get(playerId);
      if (!renderedPlayer) return;
      applyVisualState(renderedPlayer.container, state);
    },
    flashPlayer(playerId: string): void {
      const renderedPlayer = renderedPlayers.get(playerId);
      if (!renderedPlayer) return;
      renderedPlayer.flashUntilMs = performance.now() + FLASH_DURATION_MS;
    },
    destroy(): void {
      resizeObserver.disconnect();
      app.destroy(true);
    },
  };
}

function fitCanvasToContainer(canvas: HTMLCanvasElement): void {
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

function getPlayerFocusBounds(players: readonly RuntimePlayer[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (players.length === 0) {
    return { x: 0, y: 0, width: TERRARIUM_WIDTH, height: TERRARIUM_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { player } of players) {
    const visualRadius = Math.max(
      player.visual.haloRadius,
      player.visual.bodyRadius,
      Math.abs(player.visual.labelOffsetY) + 18,
    );
    minX = Math.min(minX, player.position.x - visualRadius);
    minY = Math.min(minY, player.position.y - visualRadius);
    maxX = Math.max(maxX, player.position.x + visualRadius);
    maxY = Math.max(maxY, player.position.y + visualRadius);
  }

  const x = Math.max(0, minX - AUTO_FOCUS_MARGIN);
  const y = Math.max(0, minY - AUTO_FOCUS_MARGIN);
  const right = Math.min(TERRARIUM_WIDTH, maxX + AUTO_FOCUS_MARGIN);
  const bottom = Math.min(TERRARIUM_HEIGHT, maxY + AUTO_FOCUS_MARGIN);

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function visualForState(state: PlayerRuntimeState): { alpha: number; scale: number } {
  switch (state) {
    case "performing":
      return { alpha: 1, scale: 1.05 };
    case "thinking":
      return { alpha: 0.72, scale: 0.98 };
    case "resting":
      return { alpha: 0.56, scale: 0.94 };
    case "waiting":
      return { alpha: 0.82, scale: 1 };
  }
}

function applyVisualState(player: Container, state: PlayerRuntimeState): void {
  const visual = visualForState(state);
  player.alpha = visual.alpha;
  player.scale.set(visual.scale);
}

function drawBackground(): Container {
  const layer = new Container();
  const bed = new Graphics()
    .roundRect(0, 0, TERRARIUM_WIDTH, TERRARIUM_HEIGHT, 18)
    .fill({ color: 0x182017 })
    .stroke({ color: 0xb8c7a6, alpha: 0.72, width: 3 });

  const inner = new Graphics()
    .roundRect(18, 18, TERRARIUM_WIDTH - 36, TERRARIUM_HEIGHT - 36, 12)
    .stroke({ color: 0x6f8069, alpha: 0.34, width: 1 });

  const center = new Graphics()
    .circle(TERRARIUM_WIDTH / 2, TERRARIUM_HEIGHT / 2, 116)
    .fill({ color: 0xe7f5bb, alpha: 0.035 })
    .stroke({ color: 0xe7f5bb, alpha: 0.08, width: 1 });

  layer.addChild(bed, inner, center);
  return layer;
}

function drawPlayer(playerData: Player): { container: Container; halo: Graphics } {
  const player = new Container();

  const halo = new Graphics()
    .circle(0, 0, playerData.visual.haloRadius)
    .fill({ color: playerData.visual.color, alpha: 0.18 })
    .stroke({ color: playerData.visual.accentColor, alpha: 0.34, width: 2 });
  halo.alpha = HALO_RESTING_ALPHA;

  const body = new Graphics()
    .circle(0, 0, playerData.visual.bodyRadius)
    .fill({ color: playerData.visual.color })
    .stroke({ color: playerData.visual.accentColor, alpha: 0.9, width: 2 });

  const label = new Text({
    text: playerData.displayName,
    style: new TextStyle({
      fill: "#f4eddb",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 16,
      fontWeight: "700",
    }),
  });
  label.anchor.set(0.5, 0);
  label.y = playerData.visual.labelOffsetY;

  player.addChild(halo, body, label);
  return { container: player, halo };
}
