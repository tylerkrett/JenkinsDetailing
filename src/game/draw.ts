/**
 * Everything the game draws: Rose Garage at night, as in the 3D bay. The context arrives
 * scaled to logical units; `g` is the screen y of the ground line and anything on the
 * forecourt is drawn from there up. Simple shapes are drawn live every frame. Anything
 * with texture or gradients (the car, the stonework, glows, the sign) is painted once into
 * a sprite at the current resolution and blitted. Fast-moving detail is sparse or runs
 * horizontally, so nothing strobes when the street scrolls past at 30 frames a second.
 */
import { BOTTLE, PLAYER, type Bottle, type Obstacle, type PlayerState } from "./entities";
import { COLOR, VIEW, blue, bone, ink, lamp } from "./theme";
import { BAY_W, PANELS, type Facade, type WorldState } from "./world";

type Ctx = CanvasRenderingContext2D;

export type Fonts = { display: string; body: string };

/** Height of the frontage above the ground line. */
export const WALL_H = 150;

/* ---------- sprite cache ---------- */

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

export type Art = {
  readonly fonts: Fonts;
  /** Device pixels per logical unit. */
  readonly k: number;
  setResolution(k: number): void;
  /** Drops every cached picture, e.g. once the web fonts arrive. */
  invalidate(): void;
  /** A picture painted once, in logical units, at `res` device px per unit (default k). */
  sprite(key: string, w: number, h: number, paint: (c: Ctx) => void, res?: number): Sprite;
  gradient(key: string, make: () => CanvasGradient): CanvasGradient;
};

export function createArt(fonts: Fonts): Art {
  let k = 1;
  const sprites = new Map<string, Sprite>();
  const gradients = new Map<string, CanvasGradient>();
  const clear = () => {
    sprites.clear();
    gradients.clear();
  };
  return {
    fonts,
    get k() {
      return k;
    },
    setResolution(next) {
      if (Math.abs(next - k) < 0.001) return;
      k = next;
      clear();
    },
    invalidate: clear,
    sprite(key, w, h, paint, res = k) {
      const hit = sprites.get(key);
      if (hit) return hit;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(w * res));
      canvas.height = Math.max(1, Math.ceil(h * res));
      const c = canvas.getContext("2d");
      if (c) {
        c.scale(canvas.width / w, canvas.height / h);
        paint(c);
      }
      const sprite = { canvas, w, h };
      sprites.set(key, sprite);
      return sprite;
    },
    gradient(key, make) {
      let grad = gradients.get(key);
      if (!grad) {
        grad = make();
        gradients.set(key, grad);
      }
      return grad;
    },
  };
}

function blit(ctx: Ctx, s: Sprite, x: number, y: number) {
  ctx.drawImage(s.canvas, x, y, s.w, s.h);
}

/* ---------- helpers ---------- */

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** A repeatable 0..1 value for scenery placed by index. */
function hash(n: number, seed = 0) {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A rounded rectangle path; the caller fills or strokes it. */
export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q);
  c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q);
  c.arcTo(x, y, x + w, y, q);
  c.closePath();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  c.fill();
}

function poly(c: Ctx, points: number[]) {
  c.beginPath();
  c.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i]!, points[i + 1]!);
  c.closePath();
  c.fill();
}

function radialGlow(c: Ctx, cx: number, cy: number, r: number, stops: [number, string][]) {
  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  c.fillStyle = grad;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
}

export function setLetterSpacing(ctx: Ctx, value: string) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = value;
}

/* ---------- sky, hills and trees ---------- */

export function drawSky(ctx: Ctx, art: Art, viewW: number, g: number, stars: WorldState["stars"], d: number) {
  const top = g - WALL_H;
  ctx.fillStyle = art.gradient(`sky:${Math.round(top)}`, () => {
    const grad = ctx.createLinearGradient(0, 0, 0, top + 20);
    grad.addColorStop(0, COLOR.skyTop);
    grad.addColorStop(0.5, "#0a1127");
    grad.addColorStop(1, COLOR.skyLow);
    return grad;
  });
  ctx.fillRect(0, 0, viewW, top + 20);
  const band = Math.max(40, top - 50);
  const shift = d * 0.015;
  ctx.fillStyle = COLOR.bone;
  for (const [sx, sy, size, a] of stars) {
    const x = mod(sx - shift, 2000);
    if (x > viewW) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(x, 8 + sy * band, size, size);
  }
  ctx.globalAlpha = 1;
  blit(ctx, art.sprite("moon", 120, 120, paintMoon), viewW * 0.78 - 60, band * 0.3 - 40);
}

function paintMoon(c: Ctx) {
  radialGlow(c, 60, 60, 60, [
    [0, bone(0.2)],
    [0.3, bone(0.07)],
    [1, bone(0)],
  ]);
  c.fillStyle = "#e9edf5";
  c.beginPath();
  c.arc(60, 60, 14, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(150, 160, 182, 0.35)";
  ellipse(c, 55, 56, 4, 3);
  ellipse(c, 64, 64, 3, 2.4);
  ellipse(c, 63, 53, 2, 1.6);
}

function ridgeAt(x: number, phase: number, long: number, short: number) {
  return (
    0.5 +
    0.28 * Math.sin(x / long + phase) +
    0.15 * Math.sin(x / short + phase * 1.7) +
    0.07 * Math.sin(x / (short * 0.41) + phase * 2.3)
  );
}

function ridge(
  ctx: Ctx,
  viewW: number,
  top: number,
  offset: number,
  amp: number,
  phase: number,
  long: number,
  short: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, top + 6);
  for (let x = 0; ; x += 10) {
    const cx = Math.min(x, viewW);
    ctx.lineTo(cx, top - amp * ridgeAt(cx + offset, phase, long, short));
    if (cx >= viewW) break;
  }
  ctx.lineTo(viewW, top + 6);
  ctx.closePath();
  ctx.fill();
  // Moonlight catching the ridge line.
  ctx.stroke();
}

/** The Cambrian hills behind the unit, with farm lights on the nearer ridge. */
export function drawHills(ctx: Ctx, viewW: number, g: number, d: number, phases: WorldState["hills"]) {
  const top = g - WALL_H;
  const room = Math.max(50, top);
  // A tall phone screen has a lot of sky; the hills rise to fill some of it.
  const extra = Math.max(0, room - 160);
  ctx.lineWidth = 1;
  ctx.fillStyle = COLOR.hillFar;
  ctx.strokeStyle = bone(0.1);
  ridge(ctx, viewW, top, d * 0.04, Math.min(room * 0.55, 80 + extra * 0.35), phases[0], 300, 130);
  const nearAmp = Math.min(room * 0.36, 52 + extra * 0.2);
  const offset = d * 0.1;
  ctx.fillStyle = COLOR.hillNear;
  ctx.strokeStyle = bone(0.07);
  ridge(ctx, viewW, top, offset, nearAmp, phases[1], 190, 85);
  ctx.fillStyle = COLOR.lamp;
  ctx.globalAlpha = 0.85;
  const step = 380;
  for (let i = Math.floor(offset / step) - 1; i * step - offset < viewW + step; i++) {
    if (hash(i, phases[2]) < 0.45) continue;
    const wx = i * step + hash(i + 0.3, phases[2]) * 200;
    const x = wx - offset;
    if (x < -8 || x > viewW + 8) continue;
    const y = top - nearAmp * ridgeAt(wx, phases[1], 190, 85) + 7 + hash(i + 0.7, phases[2]) * 10;
    if (y > top - 3) continue;
    ctx.fillRect(x, y, 2.2, 2.2);
    ctx.fillRect(x + 4.5, y, 2.2, 2.2);
  }
  ctx.globalAlpha = 1;
}

/** A line of round trees just behind the roof. */
export function drawTrees(ctx: Ctx, viewW: number, g: number, d: number, seed: number) {
  const top = g - WALL_H;
  const offset = d * 0.32;
  const step = 64;
  ctx.fillStyle = COLOR.trees;
  ctx.beginPath();
  for (let i = Math.floor((offset - 80) / step); i * step - offset < viewW + 80; i++) {
    const r = hash(i, seed);
    if (r < 0.3) continue;
    const x = i * step - offset + hash(i + 0.5, seed) * 24;
    const size = 14 + r * 24;
    const cy = top - size * 0.35;
    ctx.moveTo(x + size, cy);
    ctx.arc(x, cy, size, 0, Math.PI * 2);
    const x2 = x + size * 0.75;
    const s2 = size * 0.72;
    ctx.moveTo(x2 + s2, cy - s2 * 0.5);
    ctx.arc(x2, cy - s2 * 0.5, s2, 0, Math.PI * 2);
  }
  ctx.fill();
}

/* ---------- the frontage ---------- */

export function drawFacade(ctx: Ctx, art: Art, modules: readonly Facade[], d: number, g: number, viewW: number) {
  const top = g - WALL_H;
  // Continuous cladding. Its seams run horizontally, so they never flicker as it scrolls.
  ctx.fillStyle = COLOR.wall;
  ctx.fillRect(0, top, viewW, WALL_H);
  ctx.fillStyle = COLOR.wallSeam;
  for (let y = top + 13; y < g - 14; y += 13) ctx.fillRect(0, y, viewW, 1);
  ctx.fillStyle = COLOR.plinth;
  ctx.fillRect(0, g - 12, viewW, 12);
  ctx.fillStyle = COLOR.coping;
  ctx.fillRect(0, top - 5, viewW, 5);
  ctx.fillStyle = bone(0.12);
  ctx.fillRect(0, top - 5, viewW, 1);
  for (const m of modules) {
    const x = m.x - d;
    if (x > viewW + 4 || x + m.w < -4) continue;
    if (m.kind === "wall") wallPanel(ctx, x, m, top, g);
    else if (m.kind === "door") rollerDoor(ctx, x, m, top, g);
    else if (m.kind === "window") windowPanel(ctx, art, x, m, top);
    else if (m.kind === "sign") signPanel(ctx, art, x, top);
    else blit(ctx, art.sprite("cottage", 200, WALL_H + 84, paintCottage), x, top - 84);
  }
}

function wallPanel(ctx: Ctx, x: number, m: Facade, top: number, g: number) {
  ctx.fillStyle = ink(0.3);
  ctx.fillRect(x, top, 1, WALL_H - 12);
  if (m.w > 90 && m.seed > 0.5) {
    // A downpipe from the gutter.
    const px = x + Math.round(m.w * (0.35 + (m.seed - 0.5) * 0.6));
    ctx.fillStyle = "#262f42";
    ctx.fillRect(px, top - 3, 5, WALL_H - 9);
    ctx.fillStyle = bone(0.07);
    for (let y = top + 24; y < g - 20; y += 42) ctx.fillRect(px - 1, y, 7, 2);
    ctx.fillRect(px - 2, g - 14, 9, 3);
  } else if (m.w > 80 && m.seed < 0.25) {
    // An extractor vent.
    const vx = x + m.w * 0.3;
    ctx.fillStyle = "#283044";
    ctx.fillRect(vx, top + 34, 24, 16);
    ctx.fillStyle = ink(0.45);
    for (let y = top + 37; y < top + 48; y += 4) ctx.fillRect(vx + 2, y, 20, 1.5);
  }
}

function rollerDoor(ctx: Ctx, x: number, m: Facade, top: number, g: number) {
  const fx = x + 16;
  const fw = 118;
  const dt = top + 36;
  // The box the shutter rolls into, and its guide rails.
  ctx.fillStyle = "#2b3447";
  ctx.fillRect(fx - 5, dt - 16, fw + 10, 16);
  ctx.fillStyle = bone(0.08);
  ctx.fillRect(fx - 5, dt - 16, fw + 10, 1);
  ctx.fillStyle = "#232b3b";
  ctx.fillRect(fx - 5, dt, 5, g - dt);
  ctx.fillRect(fx + fw, dt, 5, g - dt);
  // Some are up a hand's width, with the bay lit behind.
  const open = m.seed > 0.72 ? 18 : 0;
  ctx.fillStyle = COLOR.door;
  ctx.fillRect(fx, dt, fw, g - dt - open);
  ctx.fillStyle = COLOR.doorSlat;
  for (let y = dt + 6; y < g - open - 4; y += 7) ctx.fillRect(fx, y, fw, 2);
  ctx.fillStyle = "#3f4960";
  ctx.fillRect(fx, g - open - 4, fw, 4);
  if (open) {
    ctx.fillStyle = lamp(0.78);
    ctx.fillRect(fx, g - open, fw, open);
  } else {
    ctx.fillStyle = bone(0.32);
    ctx.fillRect(fx + fw / 2 - 9, g - 13, 18, 2);
  }
}

function windowPanel(ctx: Ctx, art: Art, x: number, m: Facade, top: number) {
  const wx = x + 22;
  const wy = top + 32;
  const ww = 66;
  const wh = 50;
  const lit = m.seed > 0.3;
  if (lit) {
    const glow = art.sprite(
      "glow-window",
      150,
      120,
      (c) =>
        radialGlow(c, 75, 60, 72, [
          [0, lamp(0.26)],
          [1, lamp(0)],
        ]),
      1,
    );
    blit(ctx, glow, wx + ww / 2 - 75, wy + wh / 2 - 60);
  }
  ctx.fillStyle = "#2c3548";
  ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
  ctx.fillStyle = lit ? COLOR.lamp : "#111827";
  ctx.fillRect(wx, wy, ww, wh);
  if (lit) {
    // A blind part way down.
    ctx.fillStyle = "#e6b97c";
    ctx.fillRect(wx, wy, ww, 12 + m.seed * 10);
  } else {
    ctx.fillStyle = bone(0.06);
    poly(ctx, [wx + 8, wy + wh, wx + 30, wy, wx + 40, wy, wx + 18, wy + wh]);
  }
  ctx.fillStyle = "#2c3548";
  ctx.fillRect(wx + ww / 3 - 1, wy, 2, wh);
  ctx.fillRect(wx + (ww * 2) / 3 - 1, wy, 2, wh);
  ctx.fillRect(wx, wy + wh / 2 - 1, ww, 2);
  ctx.fillStyle = bone(0.16);
  ctx.fillRect(wx - 7, wy + wh + 4, ww + 14, 3);
}

function signPanel(ctx: Ctx, art: Art, x: number, top: number) {
  blit(
    ctx,
    art.sprite("sign", 200, 38, (c) => paintSign(c, art.fonts)),
    x + 10,
    top + 16,
  );
  // A wall lamp washing the cladding.
  blit(ctx, art.sprite("glow-cone", 150, 100, paintLightCone, 1), x + 110 - 75, top + 60);
  ctx.fillStyle = "#3a4458";
  ctx.fillRect(x + 101, top + 57, 18, 6);
  ctx.fillStyle = COLOR.lamp;
  ctx.fillRect(x + 104, top + 62, 12, 2);
  // A poster by the door, and the door.
  ctx.fillStyle = "#dfe5ee";
  ctx.fillRect(x + 32, top + 78, 28, 38);
  ctx.fillStyle = "#28324a";
  ctx.fillRect(x + 35, top + 81, 22, 16);
  ctx.fillStyle = ink(0.35);
  ctx.fillRect(x + 35, top + 101, 22, 2);
  ctx.fillRect(x + 35, top + 106, 15, 2);
  ctx.fillStyle = "#232b3c";
  ctx.fillRect(x + 148, top + 74, 36, WALL_H - 74);
  ctx.fillStyle = bone(0.1);
  ctx.fillRect(x + 148, top + 74, 36, 1);
  ctx.fillStyle = bone(0.4);
  ctx.fillRect(x + 176, top + 108, 4, 2);
}

function paintSign(c: Ctx, fonts: Fonts) {
  c.fillStyle = "#e6ebf3";
  c.fillRect(0, 0, 200, 38);
  c.fillStyle = "rgba(20, 25, 37, 0.18)";
  c.fillRect(0, 34, 200, 4);
  c.fillStyle = "#141925";
  c.font = `800 21px ${fonts.display}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  setLetterSpacing(c, "0.06em");
  c.fillText("ROSE GARAGE", 100, 18.5, 184);
}

function paintLightCone(c: Ctx) {
  const grad = c.createLinearGradient(0, 0, 0, 100);
  grad.addColorStop(0, lamp(0.3));
  grad.addColorStop(1, lamp(0));
  c.fillStyle = grad;
  poly(c, [66, 0, 84, 0, 150, 100, 0, 100]);
}

/** The stone cottage beside the unit: slate roof, white-framed windows, a lamp in the hall. */
function paintCottage(c: Ctx) {
  const W = 200;
  const H = WALL_H + 84;
  const eaves = 66;
  // Chimney behind the ridge.
  c.fillStyle = COLOR.stone;
  c.fillRect(34, 6, 18, 36);
  c.fillStyle = "#2a2f3c";
  c.fillRect(32, 4, 22, 5);
  c.fillRect(37, 0, 5, 5);
  c.fillRect(45, 1, 5, 4);
  // Roof: slate, a long pitch seen side on.
  c.fillStyle = COLOR.slate;
  poly(c, [18, 14, 182, 14, 200, eaves, 0, eaves]);
  c.fillStyle = ink(0.35);
  for (let y = 20; y < eaves; y += 6) {
    const inset = 18 * (1 - (y - 14) / (eaves - 14));
    c.fillRect(inset, y, W - inset * 2, 1);
  }
  c.fillStyle = bone(0.12);
  c.fillRect(18, 14, 164, 1.5);
  // Stone walls over dark mortar.
  c.fillStyle = "#262b37";
  c.fillRect(4, eaves, W - 8, H - eaves);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tones = ["#454b5d", "#3b4152", "#4f5568", "#363b4b", "#414759"];
  for (let y = eaves + 1.5; y < H - 1; y += 11) {
    let x = 5 - rnd() * 8;
    while (x < W - 5) {
      const w = 12 + rnd() * 20;
      c.fillStyle = tones[Math.floor(rnd() * tones.length)]!;
      const x0 = Math.max(5, x);
      const x1 = Math.min(W - 5, x + w);
      if (x1 - x0 > 2) c.fillRect(x0, y, x1 - x0 - 1.5, 9.5);
      x += w;
    }
  }
  c.fillStyle = ink(0.35);
  c.fillRect(4, eaves, W - 8, 4);
  cottageWindow(c, 30, 92, 34, 34, true);
  cottageWindow(c, 136, 92, 34, 34, false);
  cottageWindow(c, 30, 158, 34, 38, true);
  // Front door with a lit fanlight, and its step.
  c.fillStyle = "#1c2230";
  c.fillRect(124, 150, 36, H - 150);
  c.fillStyle = lamp(0.75);
  c.fillRect(128, 154, 28, 8);
  c.fillStyle = bone(0.06);
  for (const [px, py] of [
    [128, 168],
    [144, 168],
    [128, 200],
    [144, 200],
  ] as const) {
    c.fillRect(px, py, 12, 26);
  }
  c.fillStyle = "#4a5062";
  c.fillRect(118, H - 4, 48, 4);
}

function cottageWindow(c: Ctx, x: number, y: number, w: number, h: number, lit: boolean) {
  if (lit) {
    radialGlow(c, x + w / 2, y + h / 2, 36, [
      [0, lamp(0.32)],
      [1, lamp(0)],
    ]);
  }
  c.fillStyle = "#a9b0bd";
  c.fillRect(x - 3, y - 3, w + 6, h + 6);
  c.fillStyle = lit ? COLOR.lamp : "#121a2a";
  c.fillRect(x, y, w, h);
  c.fillStyle = "#a9b0bd";
  c.fillRect(x + w / 2 - 1, y, 2, h);
  c.fillRect(x, y + h / 2 - 1, w, 2);
  c.fillStyle = "#8d94a3";
  c.fillRect(x - 5, y + h + 3, w + 10, 3);
}

/* ---------- the bays, each with a car to polish ---------- */

const CAR_W = 200;
const CAR_H = 64;

/** The lit bays. The car starts muddy; each polished panel is laid over it from the front. */
export function drawBays(ctx: Ctx, art: Art, bays: readonly number[], panels: number, d: number, g: number, t: number) {
  const top = g - WALL_H;
  for (const bx of bays) {
    const x = bx - d;
    blit(
      ctx,
      art.sprite("bay", BAY_W, WALL_H + 5, (c) => paintBay(c, art.fonts)),
      x,
      top - 5,
    );
    const cx = x + 30;
    const cy = g - CAR_H - 2;
    ctx.fillStyle = ink(0.45);
    ellipse(ctx, cx + CAR_W / 2, g - 2, CAR_W * 0.46, 3.5);
    blit(
      ctx,
      art.sprite("car-dirty", CAR_W, CAR_H, (c) => paintCar(c, false)),
      cx,
      cy,
    );
    if (panels > 0) {
      const src = art.sprite("car-clean", CAR_W, CAR_H, (c) => paintCar(c, true)).canvas;
      const ratio = CAR_W / src.width;
      const sx = Math.round((src.width * Math.min(panels, PANELS)) / PANELS);
      ctx.drawImage(src, 0, 0, sx, src.height, cx, cy, sx * ratio, CAR_H);
    }
    if (panels >= PANELS) sparkle(ctx, cx, cy, t);
  }
}

function paintBay(c: Ctx, fonts: Fonts) {
  const W = BAY_W;
  const H = WALL_H + 5;
  const beam = 27;
  // Inside: the back wall under strip lights.
  const wall = c.createLinearGradient(0, beam, 0, H);
  wall.addColorStop(0, "#5a657e");
  wall.addColorStop(0.75, "#48526b");
  wall.addColorStop(1, "#3b445a");
  c.fillStyle = wall;
  c.fillRect(10, beam, W - 20, H - beam);
  c.fillStyle = "#283043";
  c.fillRect(10, beam, W - 20, 7);
  for (const lx of [44, 156]) {
    radialGlow(c, lx + 30, beam + 12, 52, [
      [0, bone(0.3)],
      [1, bone(0)],
    ]);
    c.fillStyle = COLOR.bone;
    c.fillRect(lx, beam + 7, 60, 3);
  }
  shelf(c, 34, beam + 32);
  shelf(c, 166, beam + 32);
  // The lift's posts.
  c.fillStyle = "#6a7488";
  c.fillRect(16, beam + 20, 7, H - beam - 20);
  c.fillRect(W - 23, beam + 20, 7, H - beam - 20);
  c.fillStyle = bone(0.18);
  c.fillRect(16, beam + 20, 2, H - beam - 20);
  c.fillRect(W - 23, beam + 20, 2, H - beam - 20);
  // Floor, with its safety line.
  const floor = H - 16;
  c.fillStyle = "#7c879c";
  c.fillRect(10, floor, W - 20, 16);
  c.fillStyle = bone(0.3);
  c.fillRect(10, floor, W - 20, 1);
  c.fillStyle = lamp(0.6);
  c.fillRect(10, floor + 8, W - 20, 2);
  // The opening's frame, and the beam with the bay's name.
  c.fillStyle = COLOR.coping;
  c.fillRect(0, 0, 10, H);
  c.fillRect(W - 10, 0, 10, H);
  c.fillRect(0, 0, W, beam);
  c.fillStyle = bone(0.12);
  c.fillRect(0, 0, W, 1);
  c.fillStyle = ink(0.4);
  c.fillRect(10, beam - 2, W - 20, 2);
  c.fillStyle = bone(0.7);
  c.font = `700 10px ${fonts.body}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  setLetterSpacing(c, "0.18em");
  c.fillText("DETAILING BAY", W / 2, 14);
}

function shelf(c: Ctx, x: number, y: number) {
  const tones = [COLOR.lamp, "#dfe5ee", COLOR.cone, "#9aa4b8", "#c9a36b", "#eef1f6"];
  for (let row = 0; row < 3; row++) {
    const sy = y + row * 20;
    for (let i = 0; i < 9; i++) {
      c.fillStyle = tones[(i * 7 + row * 3) % tones.length]!;
      const h = 7 + ((i * 5 + row) % 4) * 1.5;
      c.fillRect(x + 2 + i * 6.4, sy + 14 - h, 4, h);
    }
    c.fillStyle = "#2a3243";
    c.fillRect(x, sy + 14, 60, 3);
  }
  c.fillRect(x - 2, y, 2, 61);
  c.fillRect(x + 60, y, 2, 61);
}

function carPath(c: Ctx) {
  c.beginPath();
  c.moveTo(6, 47);
  c.lineTo(4, 37);
  c.quadraticCurveTo(5, 28, 20, 26);
  c.lineTo(50, 23);
  c.quadraticCurveTo(72, 7, 102, 7);
  c.lineTo(122, 7);
  c.quadraticCurveTo(140, 9, 156, 25);
  c.quadraticCurveTo(186, 28, 196, 35);
  c.lineTo(198, 45);
  c.lineTo(177, 49);
  c.arc(160, 49, 15, 0, Math.PI, true);
  c.lineTo(61, 49);
  c.arc(44, 49, 15, 0, Math.PI, true);
  c.lineTo(6, 49);
  c.closePath();
}

/** A low coupe side on, facing the way the bucket runs. Clean: gleaming. Dirty: road film and mud. */
function paintCar(c: Ctx, clean: boolean) {
  const body = c.createLinearGradient(0, 6, 0, 50);
  if (clean) {
    body.addColorStop(0, "#f7f9fc");
    body.addColorStop(0.5, "#d3d9e4");
    body.addColorStop(1, "#8b95a9");
  } else {
    body.addColorStop(0, "#6f7380");
    body.addColorStop(0.55, "#5a5e6a");
    body.addColorStop(1, "#43464f");
  }
  c.fillStyle = body;
  carPath(c);
  c.fill();
  c.save();
  carPath(c);
  c.clip();
  if (clean) {
    // The night sky in the paint along the shoulder, a crisp highlight and a gloss sweep.
    c.fillStyle = blue(0.3);
    c.fillRect(0, 24, CAR_W, 4);
    c.fillStyle = bone(0.95);
    c.fillRect(0, 30, CAR_W, 1.4);
    c.fillStyle = bone(0.35);
    poly(c, [150, 0, 166, 0, 136, CAR_H, 120, CAR_H]);
  } else {
    c.fillStyle = "rgba(122, 104, 78, 0.22)";
    c.fillRect(0, 0, CAR_W, CAR_H);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const mx = rnd() * CAR_W;
      const my = 34 + rnd() * 18;
      c.fillStyle = `rgba(86, 68, 48, ${(0.45 + rnd() * 0.4).toFixed(2)})`;
      ellipse(c, mx, my, 3 + rnd() * 9, 1.5 + rnd() * 3);
    }
    c.fillStyle = "rgba(86, 68, 48, 0.4)";
    for (let i = 0; i < 10; i++) c.fillRect(rnd() * CAR_W, 28 + rnd() * 8, 1.4, 6 + rnd() * 10);
  }
  c.restore();
  // Glass.
  c.fillStyle = clean ? "#162034" : "#262b36";
  c.beginPath();
  c.moveTo(58, 24);
  c.quadraticCurveTo(76, 11, 101, 11);
  c.lineTo(120, 11);
  c.quadraticCurveTo(134, 13, 146, 24);
  c.closePath();
  c.fill();
  if (clean) {
    c.fillStyle = bone(0.22);
    poly(c, [108, 11, 116, 11, 104, 24, 96, 24]);
  } else {
    c.fillStyle = "rgba(122, 104, 78, 0.3)";
    c.fillRect(56, 19, 92, 5);
  }
  c.fillStyle = clean ? "#c4cbd8" : "#555864";
  c.fillRect(103, 10, 4, 15);
  c.fillStyle = ink(0.22);
  c.fillRect(104, 25, 1, 21);
  c.fillRect(64, 26, 1, 20);
  c.fillStyle = ink(0.35);
  c.fillRect(114, 31, 7, 1.5);
  // Lights.
  c.fillStyle = clean ? "#ffffff" : "#9a9a8f";
  c.fillRect(188, 34, 7, 3);
  c.fillStyle = clean ? COLOR.cone : "#8a5a40";
  c.fillRect(4, 31, 3, 5);
  // Wheels.
  for (const wx of [44, 160]) {
    c.fillStyle = "#0e121b";
    c.beginPath();
    c.arc(wx, 49, 12.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = clean ? "#d6dce6" : "#6e6555";
    c.beginPath();
    c.arc(wx, 49, 7.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = clean ? "#8792a6" : "#4e473c";
    c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.moveTo(wx, 49);
      c.lineTo(wx + Math.cos(a) * 7, 49 + Math.sin(a) * 7);
    }
    c.stroke();
    c.fillStyle = "#2a3040";
    c.beginPath();
    c.arc(wx, 49, 2, 0, Math.PI * 2);
    c.fill();
  }
}

function star(ctx: Ctx, x: number, y: number, s: number) {
  const q = s * 0.28;
  poly(ctx, [x, y - s, x + q, y - q, x + s, y, x + q, y + q, x, y + s, x - q, y + q, x - s, y, x - q, y - q]);
}

/** A fully polished car glints. */
function sparkle(ctx: Ctx, cx: number, cy: number, t: number) {
  ctx.fillStyle = COLOR.bone;
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.8 + i / 3) % 1;
    const s = Math.sin(p * Math.PI) * 4.5;
    if (s < 0.3) continue;
    star(ctx, cx + 34 + i * 62 + Math.sin(i * 4.1) * 10, cy + 14 + (i % 2) * 10, s);
  }
}

/* ---------- the forecourt, light and lamps ---------- */

export function drawGround(ctx: Ctx, viewW: number, viewH: number, g: number, d: number) {
  const kerb = VIEW.kerb;
  ctx.fillStyle = COLOR.kerb;
  ctx.fillRect(0, g, viewW, kerb);
  // Paving joints far apart, so they glide rather than flicker.
  ctx.fillStyle = bone(0.05);
  for (let x = -mod(d, 132); x < viewW; x += 132) ctx.fillRect(x, g + 3, 1, kerb - 6);
  ctx.fillStyle = COLOR.tarmac;
  ctx.fillRect(0, g + kerb, viewW, viewH - g - kerb);
  ctx.fillStyle = bone(0.16);
  ctx.fillRect(0, g + kerb, viewW, 1);
  const room = viewH - g - kerb;
  if (room > 30) {
    ctx.fillStyle = bone(0.07);
    for (let x = -mod(d, 260) + 40; x < viewW; x += 260) ctx.fillRect(x, g + kerb + 8, 2, Math.min(26, room - 12));
  }
  // The ground line: the one bright edge everything stands on.
  ctx.fillStyle = bone(0.5);
  ctx.fillRect(0, g - 0.5, viewW, 1.5);
}

/** Light spilling out of the bays and pooling under the lamps. */
export function drawLightPools(
  ctx: Ctx,
  art: Art,
  bays: readonly number[],
  lamps: readonly number[],
  d: number,
  g: number,
) {
  const spill = art.sprite("spill-bay", 300, 44, paintSpill, 1);
  for (const bx of bays) blit(ctx, spill, bx - d - 20, g);
  const pool = art.sprite(
    "pool-lamp",
    240,
    44,
    (c) => {
      c.save();
      c.translate(120, 22);
      c.scale(1, 22 / 120);
      radialGlow(c, 0, 0, 120, [
        [0, lamp(0.22)],
        [1, lamp(0)],
      ]);
      c.restore();
    },
    1,
  );
  for (const lx of lamps) blit(ctx, pool, lx - d - 103, g + 1);
}

function paintSpill(c: Ctx) {
  const grad = c.createLinearGradient(0, 0, 0, 44);
  grad.addColorStop(0, bone(0.14));
  grad.addColorStop(1, bone(0));
  c.fillStyle = grad;
  poly(c, [30, 0, 270, 0, 300, 44, 0, 44]);
}

export function drawLamps(ctx: Ctx, art: Art, lamps: readonly number[], g: number, d: number) {
  const glow = art.sprite(
    "glow-lamp",
    240,
    240,
    (c) =>
      radialGlow(c, 120, 120, 120, [
        [0, lamp(0.3)],
        [0.35, lamp(0.1)],
        [1, lamp(0)],
      ]),
    1,
  );
  for (const wx of lamps) {
    const x = wx - d;
    const head = g - 146;
    blit(ctx, glow, x + 17 - 120, head + 4 - 120);
    ctx.fillStyle = "#394255";
    ctx.fillRect(x - 2, head, 4, g - head);
    ctx.fillRect(x - 2, head, 22, 3);
    ctx.fillStyle = "#4b556a";
    ctx.fillRect(x + 9, head - 2, 16, 7);
    ctx.fillStyle = COLOR.lamp;
    ctx.fillRect(x + 11, head + 5, 12, 2);
    ctx.fillStyle = "#2a3245";
    ctx.fillRect(x - 5, g - 8, 10, 8);
  }
}

/* ---------- bottles ---------- */

export function drawBottle(ctx: Ctx, art: Art, b: Bottle, x: number, g: number, t: number) {
  const bob = Math.sin(t * 4 + b.id) * 2;
  blit(ctx, art.sprite("bottle", 30, 38, paintBottle), x - 8, g - b.y - BOTTLE.h - 8 + bob);
}

/** A blue trigger-spray bottle with a soft glow, so pickups read at a glance. */
function paintBottle(c: Ctx) {
  radialGlow(c, 15, 21, 15, [
    [0, blue(0.42)],
    [1, blue(0)],
  ]);
  c.translate(8, 8);
  c.fillStyle = COLOR.bone;
  rr(c, 3, 0, 8, 5, 1.5);
  c.fill();
  c.fillRect(10, 1, 4, 2);
  c.fillRect(5, 5, 2, 4);
  c.fillStyle = "#c9d1e0";
  c.fillRect(6, 5, 3, 3);
  c.fillStyle = COLOR.accent;
  rr(c, 2, 8, 10, 14, 2.5);
  c.fill();
  c.fillStyle = COLOR.accentLit;
  c.fillRect(3.5, 12, 7, 6);
  c.fillStyle = bone(0.55);
  c.fillRect(3, 9.5, 1.2, 11);
}

/** The bottle on its own, for the HUD. Drawn at (x, y) top left, `size` tall. */
export function drawBottleIcon(ctx: Ctx, x: number, y: number, size: number) {
  const s = size / 22;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = COLOR.bone;
  rr(ctx, 3, 0, 8, 5, 1.5);
  ctx.fill();
  ctx.fillRect(10, 1, 4, 2);
  ctx.fillStyle = COLOR.accent;
  rr(ctx, 2, 8, 10, 14, 2.5);
  ctx.fill();
  ctx.fillStyle = COLOR.accentLit;
  ctx.fillRect(3.5, 12, 7, 6);
  ctx.restore();
}

/* ---------- obstacles ---------- */

export function drawObstacle(ctx: Ctx, o: Obstacle, x: number, g: number, t: number) {
  switch (o.def.kind) {
    case "tyres":
      tyres(ctx, x, g, false);
      break;
    case "tyres2":
      tyres(ctx, x, g, false);
      tyres(ctx, x + 38, g, true);
      break;
    case "cone1":
    case "cone2":
    case "cone3": {
      const n = o.def.kind === "cone1" ? 1 : o.def.kind === "cone2" ? 2 : 3;
      for (let i = 0; i < n; i++) cone(ctx, x + i * 28, g);
      break;
    }
    case "bollard":
      bollard(ctx, x, g);
      break;
    case "barrier":
      barrier(ctx, x, g);
      break;
    case "jack":
      jack(ctx, x, g);
      break;
    case "kiteLow":
    case "kiteHigh":
      kite(ctx, x, g, o.def.lift, t, o.id);
      break;
  }
}

/** Three tyres stacked flat by the wall: tread facing out, sidewall edges catching the light. */
function tyres(ctx: Ctx, x: number, g: number, flip: boolean) {
  for (let i = 0; i < 3; i++) {
    const ty = g - (i + 1) * 15.33 + 0.5;
    const tx = x + (i === 1 ? 1.5 : i === 2 ? -1 : 0) * (flip ? -1 : 1);
    ctx.fillStyle = COLOR.tyre;
    rr(ctx, tx, ty, 34, 14.8, 5);
    ctx.fill();
    ctx.fillStyle = COLOR.tyreSide;
    ctx.fillRect(tx + 3, ty + 1, 28, 1.6);
    ctx.fillRect(tx + 3, ty + 12.2, 28, 1.2);
    ctx.fillStyle = ink(0.5);
    for (let k = 0; k < 6; k++) ctx.fillRect(tx + 4.5 + k * 5, ty + 4, 2, 6.5);
    ctx.fillStyle = bone(0.45);
    ctx.fillRect(tx + 4, ty + 0.4, 26, 0.8);
  }
}

function cone(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = "#2b3140";
  ctx.fillRect(x - 2, g - 4, 26, 4);
  ctx.fillStyle = COLOR.cone;
  poly(ctx, [x + 3, g - 4, x + 8.5, g - 30, x + 13.5, g - 30, x + 19, g - 4]);
  ctx.fillStyle = ink(0.16);
  poly(ctx, [x + 11, g - 30, x + 13.5, g - 30, x + 19, g - 4, x + 13, g - 4]);
  ctx.fillStyle = bone(0.92);
  poly(ctx, [x + 5.6, g - 17, x + 16.4, g - 17, x + 17.4, g - 12, x + 4.6, g - 12]);
}

function bollard(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = bone(0.9);
  rr(ctx, x, g - 40, 14, 30, 6);
  ctx.fill();
  ctx.fillRect(x, g - 16, 14, 16);
  ctx.fillStyle = ink(0.6);
  ctx.fillRect(x, g - 31, 14, 3);
  ctx.fillStyle = COLOR.cone;
  ctx.fillRect(x, g - 25, 14, 3);
}

function barrier(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = bone(0.82);
  for (const lx of [x + 6, x + 86]) poly(ctx, [lx - 6, g, lx - 2, g - 34, lx + 2, g - 34, lx + 6, g]);
  ctx.fillStyle = bone(0.92);
  ctx.fillRect(x, g - 36, 92, 12);
  ctx.fillRect(x + 4, g - 14, 84, 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, g - 36, 92, 12);
  ctx.clip();
  ctx.fillStyle = COLOR.cone;
  for (let sx = x - 12; sx < x + 100; sx += 16)
    poly(ctx, [sx, g - 24, sx + 8, g - 36, sx + 14, g - 36, sx + 6, g - 24]);
  ctx.restore();
}

/** A trolley jack left out on the forecourt: low and long. */
function jack(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = COLOR.steel;
  rr(ctx, x + 4, g - 13, 50, 8, 2);
  ctx.fill();
  poly(ctx, [x + 28, g - 11, x + 55, g - 20, x + 59, g - 16, x + 32, g - 7]);
  ctx.fillRect(x + 52, g - 22, 13, 3.5);
  ctx.fillRect(x, g - 19, 12, 3);
  ctx.fillStyle = bone(0.5);
  ctx.fillRect(x + 4, g - 13, 50, 1);
  for (const wx of [x + 12, x + 46]) {
    ctx.fillStyle = "#1c2232";
    ctx.beginPath();
    ctx.arc(wx, g - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bone(0.55);
    ctx.beginPath();
    ctx.arc(wx, g - 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A red kite, Tregaron's own, gliding in. Its shadow on the forecourt says how high it flies. */
function kite(ctx: Ctx, x: number, g: number, lift: number, t: number, id: number) {
  const top = g - lift - 22;
  ctx.fillStyle = ink(Math.max(0.15, 0.55 - lift / 220));
  ellipse(ctx, x + 20, g + 2.5, 18 - lift / 12, 2.2);
  const flap = Math.sin(t * 8 + id * 1.7);
  // Far wing, behind the body.
  ctx.fillStyle = "#8d6a58";
  poly(ctx, [x + 15, top + 11, x + 25, top + 9 - 9 * flap, x + 28, top + 12]);
  // Rufous body and forked tail, pale head.
  ctx.fillStyle = "#c86a40";
  ellipse(ctx, x + 18, top + 12, 12.5, 4);
  poly(ctx, [x + 29, top + 10, x + 40, top + 6, x + 36, top + 11.5, x + 40, top + 17, x + 29, top + 14]);
  ctx.fillStyle = "#e9e2d6";
  ctx.beginPath();
  ctx.arc(x + 6, top + 10.5, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.lamp;
  poly(ctx, [x + 2.6, top + 10, x - 1.5, top + 11.5, x + 2.6, top + 12.6]);
  // Near wing, long and angled, pale in the middle and dark at the tip.
  const tip = top + 12 - 12 * flap;
  ctx.fillStyle = "#d9cfc2";
  poly(ctx, [x + 12, top + 11, x + 20, tip - 1, x + 30, tip + 1, x + 24, top + 13]);
  ctx.fillStyle = "#1b1e26";
  poly(ctx, [x + 21, tip - 0.5, x + 30, tip + 1, x + 26.5, tip + 3]);
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(x + 4.6, top + 9, 1.4, 1.4);
}

/* ---------- the bucket ---------- */

const FOAM: [number, number, number][] = [
  [-0.3, 0.03, 0.15],
  [-0.08, 0.07, 0.19],
  [0.17, 0.04, 0.16],
  [0.36, 0.01, 0.11],
  [0.02, 0.13, 0.12],
];

export function drawPlayer(ctx: Ctx, p: PlayerState, x: number, y: number, g: number, t: number) {
  const w = PLAYER.w;
  const h = PLAYER.h;
  // A shadow that shrinks as the bucket leaves the ground.
  const lift = Math.min(1, y / 120);
  ctx.fillStyle = ink(0.55 * (1 - lift * 0.6));
  ellipse(ctx, x + w / 2, g + 1.5, (w / 2 + 3) * (1 - lift * 0.4), 3);

  let sx = 1;
  let sy = 1;
  let bob = 0;
  let tilt = 0;
  if (p.dead) {
    const k = Math.min(1, p.deathTime / 0.35);
    tilt = (1 - (1 - k) * (1 - k) * (1 - k)) * (Math.PI / 2);
  } else if (p.onGround) {
    if (p.ducking) {
      sy = PLAYER.duckH / h;
      sx = 1.18;
    } else {
      bob = Math.abs(Math.sin(p.stride)) * 3;
      tilt = Math.sin(p.stride * 2) * 0.035;
      if (p.landTime < 0.14) {
        const k = 1 - p.landTime / 0.14;
        sy = 1 - 0.2 * k;
        sx = 1 + 0.16 * k;
      }
    }
  } else {
    if (p.airTime < 0.12) {
      const k = 1 - p.airTime / 0.12;
      sy = 1 + 0.16 * k;
      sx = 1 - 0.1 * k;
    }
    tilt = Math.max(-0.16, Math.min(0.12, -p.vy * 0.00022));
    if (p.ducking) sy *= 0.9;
  }

  ctx.save();
  ctx.translate(x + w / 2, g - y - bob);
  ctx.rotate(tilt);
  ctx.scale(sx, sy);
  bucket(ctx, w, h, p, t);
  ctx.restore();
}

/** Jenkins's runner: a blue wash bucket full of foam, on two little boots. Origin at its feet. */
function bucket(ctx: Ctx, w: number, h: number, p: PlayerState, t: number) {
  const running = p.onGround && !p.ducking && !p.dead;
  const legH = h * 0.13;
  const rimY = -h * 0.76;
  const baseY = -legH;
  ctx.fillStyle = COLOR.accentLit;
  const swing = running ? Math.sin(p.stride) * w * 0.16 : 0;
  rr(ctx, -w * 0.3 + swing, -legH - 1, w * 0.2, legH + 1, 2);
  ctx.fill();
  rr(ctx, w * 0.1 - swing, -legH - 1, w * 0.2, legH + 1, 2);
  ctx.fill();
  // Handle, lying back behind the foam.
  ctx.strokeStyle = bone(0.7);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, rimY + 2, w * 0.44, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Body: a tapered bucket, shaded on the far side and lit on the near one.
  ctx.fillStyle = COLOR.accent;
  poly(ctx, [-w * 0.48, rimY, w * 0.48, rimY, w * 0.36, baseY, -w * 0.36, baseY]);
  ctx.fillStyle = ink(0.2);
  poly(ctx, [w * 0.2, rimY, w * 0.48, rimY, w * 0.36, baseY, w * 0.12, baseY]);
  ctx.fillStyle = blue(0.6);
  poly(ctx, [-w * 0.4, rimY + 4, -w * 0.32, rimY + 4, -w * 0.26, baseY - 3, -w * 0.31, baseY - 3]);
  ctx.fillStyle = blue(0.35);
  ctx.fillRect(-w * 0.38, baseY - 6, w * 0.76, 1.5);
  ctx.fillStyle = COLOR.accentLit;
  rr(ctx, -w * 0.52, rimY - 2, w * 1.04, 5, 2);
  ctx.fill();
  // Foam that wobbles as it runs.
  ctx.fillStyle = COLOR.bone;
  const wob = running ? Math.sin(t * 14) * 0.8 : 0;
  for (const [bx, by, r] of FOAM) {
    ctx.beginPath();
    ctx.arc(w * bx + (r > 0.14 ? wob : -wob), rimY - 2 - h * by, w * r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Face.
  const eyeY = -h * 0.47;
  if (p.dead) {
    ctx.strokeStyle = COLOR.bone;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const ex of [-w * 0.1, w * 0.16]) {
      ctx.moveTo(ex - 2.6, eyeY - 2.6);
      ctx.lineTo(ex + 2.6, eyeY + 2.6);
      ctx.moveTo(ex + 2.6, eyeY - 2.6);
      ctx.lineTo(ex - 2.6, eyeY + 2.6);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = COLOR.bone;
    ellipse(ctx, -w * 0.1, eyeY, 3.6, 4.2);
    ellipse(ctx, w * 0.16, eyeY, 3.6, 4.2);
    ctx.fillStyle = COLOR.ink;
    ellipse(ctx, -w * 0.1 + 1.2, eyeY + 0.4, 1.8, 2.3);
    ellipse(ctx, w * 0.16 + 1.2, eyeY + 0.4, 1.8, 2.3);
  }
  ctx.strokeStyle = bone(0.85);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (p.dead) {
    ctx.moveTo(-3, -h * 0.33);
    ctx.lineTo(6, -h * 0.33);
  } else {
    ctx.arc(w * 0.03, -h * 0.37, 4, 0.25, Math.PI - 0.25);
  }
  ctx.stroke();
}

/* ---------- particles: foam flicks, bottle sparkles, the splash ---------- */

export const PARTICLE = { foam: 0, sparkle: 1 } as const;

/** A fixed pool, so a busy run allocates nothing. Positions are world x and screen y. */
export type Particles = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  kind: Uint8Array;
  next: number;
};

export function createParticles(n = 72): Particles {
  return {
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    life: new Float32Array(n),
    max: new Float32Array(n),
    size: new Float32Array(n),
    kind: new Uint8Array(n),
    next: 0,
  };
}

export function emit(
  ps: Particles,
  kind: number,
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  size: number,
) {
  const i = ps.next;
  ps.next = (i + 1) % ps.x.length;
  ps.x[i] = x;
  ps.y[i] = y;
  ps.vx[i] = vx;
  ps.vy[i] = vy;
  ps.life[i] = life;
  ps.max[i] = life;
  ps.size[i] = size;
  ps.kind[i] = kind;
}

export function clearParticles(ps: Particles) {
  ps.life.fill(0);
}

/** Moves the live particles; foam falls and settles on the ground at `floor`. Returns how many live. */
export function stepParticles(ps: Particles, dt: number, floor: number) {
  let alive = 0;
  for (let i = 0; i < ps.x.length; i++) {
    const life = ps.life[i]! - dt;
    ps.life[i] = life;
    if (life <= 0) continue;
    alive++;
    const sparkle = ps.kind[i] === PARTICLE.sparkle;
    ps.vy[i] = ps.vy[i]! + (sparkle ? 90 : 760) * dt;
    ps.x[i] = ps.x[i]! + ps.vx[i]! * dt;
    let y = ps.y[i]! + ps.vy[i]! * dt;
    if (!sparkle && y > floor) {
      y = floor;
      ps.vy[i] = 0;
      ps.vx[i] = ps.vx[i]! * 0.8;
    }
    ps.y[i] = y;
  }
  return alive;
}

export function drawParticles(ctx: Ctx, ps: Particles, d: number) {
  for (let i = 0; i < ps.x.length; i++) {
    const life = ps.life[i]!;
    if (life <= 0) continue;
    const a = Math.min(1, (life / ps.max[i]!) * 1.6);
    const x = ps.x[i]! - d;
    const y = ps.y[i]!;
    const s = ps.size[i]!;
    if (ps.kind[i] === PARTICLE.sparkle) {
      ctx.fillStyle = blue(a);
      star(ctx, x, y, s);
    } else {
      ctx.fillStyle = bone(a * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
