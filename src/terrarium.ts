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

interface RenderedPlayer {
  container: Container;
  anchor: { x: number; y: number };
  phase: number;
  radius: number;
  speed: number;
}

export interface TerrariumView {
  app: Application;
  setPlayerState(playerId: string, state: PlayerRuntimeState): void;
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
  container.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const background = drawBackground();
  world.addChild(background);

  const renderedPlayers = new Map<string, RenderedPlayer>();
  players.forEach(({ player, state }, index) => {
    const renderedPlayer = drawPlayer(player);
    renderedPlayer.x = player.position.x;
    renderedPlayer.y = player.position.y;
    applyVisualState(renderedPlayer, state);
    renderedPlayers.set(player.id, {
      container: renderedPlayer,
      anchor: player.position,
      phase: index * 2.1,
      radius: 5 + index * 2,
      speed: 0.24 + index * 0.05,
    });
    world.addChild(renderedPlayer);
  });

  app.ticker.add(() => {
    const now = performance.now() / 1000;
    for (const renderedPlayer of renderedPlayers.values()) {
      renderedPlayer.container.x =
        renderedPlayer.anchor.x +
        Math.cos(now * renderedPlayer.speed + renderedPlayer.phase) * renderedPlayer.radius;
      renderedPlayer.container.y =
        renderedPlayer.anchor.y +
        Math.sin(now * renderedPlayer.speed * 0.8 + renderedPlayer.phase) * renderedPlayer.radius;
    }
  });

  const renderer = app.renderer;
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    const scale = Math.min(width / TERRARIUM_WIDTH, height / TERRARIUM_HEIGHT);
    world.scale.set(scale);
    world.x = Math.max(0, (width - TERRARIUM_WIDTH * scale) / 2);
    world.y = Math.max(0, (height - TERRARIUM_HEIGHT * scale) / 2);
    renderer.resize(width, height);
  });
  resizeObserver.observe(container);

  return {
    app,
    setPlayerState(playerId: string, state: PlayerRuntimeState): void {
      const renderedPlayer = renderedPlayers.get(playerId);
      if (!renderedPlayer) return;
      applyVisualState(renderedPlayer.container, state);
    },
    destroy(): void {
      resizeObserver.disconnect();
      app.destroy(true);
    },
  };
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

function drawPlayer(playerData: Player): Container {
  const player = new Container();

  const halo = new Graphics()
    .circle(0, 0, playerData.visual.haloRadius)
    .fill({ color: playerData.visual.color, alpha: 0.18 })
    .stroke({ color: playerData.visual.accentColor, alpha: 0.34, width: 2 });

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
  return player;
}
