/**
 * Every sprite and backdrop as canvas paths. The context arrives already scaled to logical
 * units. `g` is the screen y of the ground line; things that stand on the pavement are
 * drawn from there upwards.
 */
import { CAT_SPRITE } from "./cat-sprite";
import { FINDABIS_MARK } from "./findabis-sprite";
import { CAN, PLAYER, type Can, type Obstacle, type PlayerState } from "./entities";
import { COLOR, VIEW, bone, ink, jade } from "./theme";
import {
  MURAL_PIECES,
  type Building,
  type Chalk,
  type Mural,
  type RoofLayer,
  type Shutter,
  type WorldState,
} from "./world";

type Ctx = CanvasRenderingContext2D;

/* ---------- the cat ---------- */

export type CatPainter = {
  ready: boolean;
  /** Draws the glyph tinted, scaled into w x h with its top-left at x, y. */
  draw(ctx: Ctx, x: number, y: number, w: number, h: number, alpha?: number): void;
};

/** Loads the greyscale mask once and bakes a tinted bitmap; draws nothing until ready. */
export function createCatPainter(color = COLOR.bone): CatPainter {
  let tinted: HTMLCanvasElement | null = null;
  const painter: CatPainter = {
    ready: false,
    draw(ctx, x, y, w, h, alpha = 1) {
      if (!tinted) return;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      ctx.drawImage(tinted, x, y, w, h);
      ctx.globalAlpha = prev;
    },
  };
  if (typeof Image === "undefined") return painter;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = CAT_SPRITE.width;
    c.height = CAT_SPRITE.height;
    const cx = c.getContext("2d");
    if (!cx) return;
    cx.drawImage(img, 0, 0);
    // Mask luminance becomes alpha; every pixel takes the tint.
    const data = cx.getImageData(0, 0, c.width, c.height);
    const [r, gg, b] = hexToRgb(color);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = px[i]!;
      px[i] = r;
      px[i + 1] = gg;
      px[i + 2] = b;
      px[i + 3] = lum;
    }
    cx.putImageData(data, 0, 0);
    tinted = c;
    painter.ready = true;
  };
  img.src = CAT_SPRITE.src;
  return painter;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------- sky and rooftops ---------- */

export function drawSky(ctx: Ctx, w: WorldState, viewW: number, viewH: number, g: number, t: number) {
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, viewW, viewH);
  const top = Math.max(0, g - 150 - 200);
  const band = Math.max(40, g - 170 - top);
  const shift = w.distance * 0.04;
  let i = 0;
  for (const [sx, sy, size] of w.stars) {
    i++;
    const x = (((sx - shift) % 2000) + 2000) % 2000;
    if (x > viewW) continue;
    const tw = 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7));
    ctx.fillStyle = bone(tw);
    ctx.fillRect(x, top + sy * band, size, size);
  }
}

export function drawRoofs(ctx: Ctx, layer: RoofLayer, distance: number, g: number, viewW: number, near: boolean) {
  const cam = distance * layer.parallax;
  const base = g - (near ? 142 : 152);
  ctx.fillStyle = COLOR.ink2;
  for (const b of layer.buildings) {
    const x = b.x - cam;
    if (x + b.w < -20 || x > viewW + 20) continue;
    buildingPath(ctx, b, x, base);
    ctx.fill();
  }
  if (near) {
    // The nearer row sits a touch lighter so the two rows separate.
    ctx.fillStyle = bone(0.035);
    for (const b of layer.buildings) {
      const x = b.x - cam;
      if (x + b.w < -20 || x > viewW + 20) continue;
      buildingPath(ctx, b, x, base);
      ctx.fill();
    }
  }
  // A few lit windows, fixed per building.
  ctx.fillStyle = bone(near ? 0.1 : 0.07);
  for (const b of layer.buildings) {
    const x = b.x - cam;
    if (x + b.w < 0 || x > viewW) continue;
    const cols = Math.max(1, Math.floor(b.w / 18));
    const rows = Math.max(1, Math.floor((b.h - 14) / 16));
    let s = b.seed * 9973;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        s = (s * 16807) % 2147483647;
        if (s / 2147483647 < 0.14) ctx.fillRect(x + 6 + c * 18, base - b.h + 10 + r * 16, 5, 7);
      }
    }
  }
}

function buildingPath(ctx: Ctx, b: Building, x: number, base: number) {
  const top = base - b.h;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, top);
  if (b.style === "sawtooth") {
    const teeth = Math.max(2, Math.floor(b.w / 24));
    const tw = b.w / teeth;
    for (let i = 0; i < teeth; i++) {
      ctx.lineTo(x + i * tw + tw * 0.65, top - 10);
      ctx.lineTo(x + (i + 1) * tw, top);
    }
  } else if (b.style === "terrace") {
    ctx.lineTo(x + 4, top - 4);
    ctx.lineTo(x + b.w - 4, top - 4);
    ctx.lineTo(x + b.w, top);
  } else if (b.style === "warehouse") {
    ctx.lineTo(x - 3, top);
    ctx.lineTo(x - 3, top - 5);
    ctx.lineTo(x + b.w + 3, top - 5);
    ctx.lineTo(x + b.w + 3, top);
    ctx.lineTo(x + b.w, top);
  } else {
    ctx.lineTo(x + b.w, top);
  }
  ctx.lineTo(x + b.w, base);
  ctx.closePath();
  // Decorations ride on the same fill.
  const cx = x + b.w / 2;
  switch (b.deco) {
    case "chimneys":
      for (let i = 0; i < 3; i++) ctx.rect(x + 8 + i * 12, top - 16, 6, 16);
      break;
    case "watertower":
      ctx.rect(cx - 9, top - 26, 18, 16);
      ctx.moveTo(cx - 11, top - 26);
      ctx.lineTo(cx, top - 34);
      ctx.lineTo(cx + 11, top - 26);
      ctx.closePath();
      ctx.rect(cx - 7, top - 10, 2, 10);
      ctx.rect(cx + 5, top - 10, 2, 10);
      break;
    case "crane":
      ctx.rect(cx - 1.5, top - 70, 3, 70);
      ctx.rect(cx - 30, top - 70, 70, 2);
      ctx.rect(cx + 36, top - 70, 1, 22);
      break;
    case "aerial":
      ctx.rect(x + b.w - 14, top - 24, 1.5, 24);
      ctx.rect(x + b.w - 20, top - 20, 13, 1.5);
      ctx.rect(x + b.w - 18, top - 14, 9, 1.5);
      break;
    case "gasholder":
      ctx.rect(x - 2, top - 30, 2, 30);
      ctx.rect(x + b.w, top - 30, 2, 30);
      ctx.rect(x - 2, top - 30, b.w + 4, 2);
      ctx.rect(x - 2, top - 15, b.w + 4, 1.5);
      break;
    case "tank":
      ctx.rect(x + 6, top - 12, 22, 12);
      break;
    default:
      break;
  }
}

/* ---------- the wall behind the pavement ---------- */

export const WALL_H = 150;

let brickPattern: CanvasPattern | null = null;
function getBrickPattern(ctx: Ctx) {
  if (brickPattern) return brickPattern;
  const c = document.createElement("canvas");
  c.width = 44;
  c.height = 18;
  const p = c.getContext("2d");
  if (!p) return null;
  p.fillStyle = COLOR.ink2;
  p.fillRect(0, 0, 44, 18);
  p.fillStyle = bone(0.055);
  p.fillRect(0, 8, 44, 1);
  p.fillRect(0, 17, 44, 1);
  p.fillRect(21, 0, 1, 8);
  p.fillRect(43, 0, 1, 8);
  p.fillRect(10, 9, 1, 8);
  p.fillRect(32, 9, 1, 8);
  brickPattern = ctx.createPattern(c, "repeat");
  return brickPattern;
}

export function drawWall(
  ctx: Ctx,
  w: WorldState,
  g: number,
  viewW: number,
  murals: Mural[],
  pieces: number,
  cat: CatPainter,
  distance: number,
) {

  const top = g - WALL_H;
  const pat = getBrickPattern(ctx);
  ctx.save();
  // Scroll the pattern with the street.
  ctx.translate(-(distance % 44), 0);
  ctx.fillStyle = pat ?? COLOR.ink2;
  ctx.fillRect(distance % 44, top, viewW, WALL_H);
  ctx.restore();
  // Coping stone along the top.
  ctx.fillStyle = bone(0.16);
  ctx.fillRect(0, top - 3, viewW, 3);

  for (const s of w.shutters) {
    const x = s.x - distance;
    if (x + s.w < 0 || x > viewW) continue;
    drawShutter(ctx, x, g, s, cat);
  }
  for (const m of murals) drawMural(ctx, m.x - distance, g, m.w, pieces, cat);
}

function drawShutter(ctx: Ctx, x: number, g: number, s: Shutter, cat: CatPainter) {
  const h = 108;
  const top = g - h;
  // Housing.
  ctx.fillStyle = bone(0.07);
  ctx.fillRect(x - 3, top - 12, s.w + 6, 12);
  // Corrugated shutter.
  ctx.fillStyle = bone(0.1);
  ctx.fillRect(x, top, s.w, h);
  ctx.fillStyle = ink(0.55);
  for (let y = top + 5; y < g - 3; y += 6) ctx.fillRect(x, y, s.w, 2);
  // Fascia sign above, blank: the shop is shut.
  ctx.fillStyle = bone(0.05);
  ctx.fillRect(x - 6, top - 32, s.w + 12, 17);
  // Some shutters carry a small tag of the cat, thrown up quick and a little crooked.
  if (s.seed > 0.45) {
    const th = 30 + s.seed * 12;
    const tw = th * 0.625;
    ctx.save();
    ctx.translate(x + 10 + s.seed * (s.w - tw - 20), top + 34 + s.seed * 26);
    ctx.rotate((s.seed - 0.5) * 0.3);
    cat.draw(ctx, 0, 0, tw, th, 0.34);
    ctx.restore();
  }
}

/** The big sprayed glyph, revealed a piece at a time. Order runs like a spray: bottom up. */
const PIECE_ORDER: [number, number][] = [
  [0, 3], [1, 3], [1, 2], [0, 2], [0, 1], [1, 1], [1, 0], [0, 0],
];

function drawMural(ctx: Ctx, x: number, g: number, w: number, pieces: number, cat: CatPainter) {
  const h = 132;
  const cw = h * (CAT_SPRITE.width / CAT_SPRITE.height);
  const cx = x + (w - cw) / 2;
  const cy = g - 8 - h;
  // Faint stencil ghost of the whole piece so the wall reads as work in progress.
  cat.draw(ctx, cx, cy, cw, h, 0.07);
  const pw = cw / 2;
  const ph = h / 4;
  for (let i = 0; i < Math.min(pieces, MURAL_PIECES); i++) {
    const [c, r] = PIECE_ORDER[i]!;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx + c * pw - 0.5, cy + r * ph - 0.5, pw + 1, ph + 1);
    ctx.clip();
    cat.draw(ctx, cx, cy, cw, h, 0.82);
    ctx.restore();
  }
  if (pieces >= MURAL_PIECES) {
    // Finished: a small signature line underneath, in the same hand.
    ctx.fillStyle = bone(0.5);
    ctx.fillRect(cx, g - 5, cw * 0.4, 1.5);
  }
}

/* ---------- lamps ---------- */

export function drawLamps(ctx: Ctx, xs: number[], g: number, distance: number) {
  for (const wx of xs) {
    const x = wx - distance;
    const h = 128;
    const top = g - h;
    // Light pool first, on the wall and pavement.
    const grad = ctx.createRadialGradient(x + 16, top + 6, 4, x + 16, top + 6, 120);
    grad.addColorStop(0, bone(0.13));
    grad.addColorStop(1, bone(0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - 104, top - 114, 240, 240 + 20);
    ctx.fillStyle = bone(0.4);
    ctx.fillRect(x - 2, top + 4, 4, h - 4);
    ctx.fillRect(x - 2, top, 22, 3);
    ctx.fillRect(x + 12, top - 2, 10, 8);
    ctx.fillStyle = bone(0.9);
    ctx.fillRect(x + 14, top + 3, 6, 3);
    // Base plinth.
    ctx.fillStyle = bone(0.4);
    ctx.fillRect(x - 5, g - 6, 10, 6);
  }
}

/* ---------- pavement and road ---------- */

export function drawPavement(
  ctx: Ctx,
  g: number,
  viewW: number,
  viewH: number,
  distance: number,
  chalk: Chalk[],
  fontDisplay: string,
) {
  // Pavement band.
  ctx.fillStyle = COLOR.ink2;
  ctx.fillRect(0, g, viewW, VIEW.kerb);
  // Paving joints.
  ctx.fillStyle = bone(0.1);
  const start = -((distance % 38) + 38) % 38;
  for (let x = start; x < viewW; x += 38) ctx.fillRect(x, g + 2, 1, VIEW.kerb - 4);
  // Ground line and kerb.
  ctx.fillStyle = bone(0.85);
  ctx.fillRect(0, g, viewW, 1.5);
  ctx.fillStyle = bone(0.4);
  ctx.fillRect(0, g + VIEW.kerb, viewW, 1.5);
  // Road below, with a broken centre line if there is room.
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, g + VIEW.kerb + 1.5, viewW, viewH - g);
  if (viewH - g > 56) {
    ctx.fillStyle = bone(0.18);
    const y = g + VIEW.kerb + 30;
    const s2 = -((distance * 1.0) % 70);
    for (let x = s2; x < viewW; x += 70) ctx.fillRect(x, y, 40, 2);
  }
  // Chalk.
  ctx.save();
  ctx.font = `600 13px ${fontDisplay}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = bone(0.5);
  setLetterSpacing(ctx, "0.16em");
  for (const c of chalk) {
    const x = c.x - distance;
    if (x > viewW || x < -300) continue;
    ctx.save();
    ctx.translate(x, g + VIEW.kerb / 2 + 1);
    ctx.rotate(-0.012);
    ctx.fillText(c.text.toUpperCase(), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export function setLetterSpacing(ctx: Ctx, value: string) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = value;
}

/* ---------- obstacles ---------- */

export function drawObstacle(ctx: Ctx, o: Obstacle, x: number, g: number, t: number) {
  const { def } = o;
  ctx.fillStyle = COLOR.bone;
  switch (def.kind) {
    case "bin":
      bin(ctx, x, g);
      break;
    case "bin2":
      bin(ctx, x, g);
      bin(ctx, x + 38, g);
      break;
    case "cone1":
    case "cone2":
    case "cone3": {
      const n = def.kind === "cone1" ? 1 : def.kind === "cone2" ? 2 : 3;
      for (let i = 0; i < n; i++) cone(ctx, x + i * 28, g);
      break;
    }
    case "bollard":
      roundRect(ctx, x, g - 40, 14, 40, 6, true, false, false, false);
      ctx.fillStyle = ink(0.7);
      ctx.fillRect(x, g - 31, 14, 2);
      break;
    case "barrier":
      barrier(ctx, x, g);
      break;
    case "pole":
      pole(ctx, x, g);
      break;
    case "pigeonLow":
    case "pigeonHigh":
      pigeon(ctx, x, g - def.lift - def.h, t, o.id);
      break;
    default:
      break;
  }
}

function bin(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = COLOR.bone;
  // Wheels.
  ctx.beginPath();
  ctx.arc(x + 7, g - 4, 4, 0, Math.PI * 2);
  ctx.arc(x + 27, g - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  // Body tapers slightly toward the base.
  ctx.beginPath();
  ctx.moveTo(x + 2, g - 40);
  ctx.lineTo(x + 32, g - 40);
  ctx.lineTo(x + 30, g - 7);
  ctx.lineTo(x + 4, g - 7);
  ctx.closePath();
  ctx.fill();
  // Lid, a touch wider, with a handle lip.
  ctx.fillRect(x - 1, g - 46, 36, 6);
  ctx.fillRect(x + 26, g - 49, 9, 3);
  // Seam and ribs in ink.
  ctx.fillStyle = ink(0.75);
  ctx.fillRect(x + 2, g - 39, 30, 1.5);
  ctx.fillRect(x + 11, g - 34, 2, 22);
  ctx.fillRect(x + 21, g - 34, 2, 22);
}

function cone(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = COLOR.bone;
  ctx.fillRect(x - 2, g - 4, 26, 4);
  ctx.beginPath();
  ctx.moveTo(x + 3, g - 4);
  ctx.lineTo(x + 8, g - 30);
  ctx.lineTo(x + 14, g - 30);
  ctx.lineTo(x + 19, g - 4);
  ctx.closePath();
  ctx.fill();
  // Reflective band, ink so it reads on bone.
  ctx.fillStyle = ink(0.8);
  ctx.beginPath();
  ctx.moveTo(x + 5.6, g - 17);
  ctx.lineTo(x + 16.4, g - 17);
  ctx.lineTo(x + 17.4, g - 12);
  ctx.lineTo(x + 4.6, g - 12);
  ctx.closePath();
  ctx.fill();
}

function barrier(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = COLOR.bone;
  // Two A-frame legs.
  for (const lx of [x + 6, x + 86]) {
    ctx.beginPath();
    ctx.moveTo(lx - 6, g);
    ctx.lineTo(lx - 2, g - 34);
    ctx.lineTo(lx + 2, g - 34);
    ctx.lineTo(lx + 6, g);
    ctx.closePath();
    ctx.fill();
  }
  // Plank.
  ctx.fillRect(x, g - 36, 92, 12);
  ctx.fillRect(x + 4, g - 14, 84, 3);
  // Hazard stripes.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, g - 36, 92, 12);
  ctx.clip();
  ctx.fillStyle = ink(0.8);
  for (let sx = x - 12; sx < x + 100; sx += 16) {
    ctx.beginPath();
    ctx.moveTo(sx, g - 24);
    ctx.lineTo(sx + 8, g - 36);
    ctx.lineTo(sx + 14, g - 36);
    ctx.lineTo(sx + 6, g - 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function pole(ctx: Ctx, x: number, g: number) {
  ctx.fillStyle = COLOR.bone;
  // Stands.
  ctx.fillRect(x + 2, g - 16, 4, 16);
  ctx.fillRect(x + 60, g - 16, 4, 16);
  ctx.fillRect(x - 2, g - 3, 12, 3);
  ctx.fillRect(x + 56, g - 3, 12, 3);
  // Pole with couplers.
  ctx.fillRect(x - 4, g - 22, 74, 5);
  ctx.fillRect(x + 1, g - 24, 7, 9);
  ctx.fillRect(x + 58, g - 24, 7, 9);
  ctx.fillStyle = ink(0.7);
  ctx.fillRect(x + 3, g - 21, 2, 3);
  ctx.fillRect(x + 60, g - 21, 2, 3);
}

function pigeon(ctx: Ctx, x: number, top: number, t: number, id: number) {
  const up = Math.floor(t * 6 + id) % 2 === 0;
  ctx.fillStyle = COLOR.bone;
  // Body.
  ctx.beginPath();
  ctx.ellipse(x + 20, top + 15, 14, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head, facing the cat (left).
  ctx.beginPath();
  ctx.arc(x + 6, top + 11, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 2, top + 11);
  ctx.lineTo(x - 3, top + 12.5);
  ctx.lineTo(x + 2, top + 14);
  ctx.closePath();
  ctx.fill();
  // Tail.
  ctx.beginPath();
  ctx.moveTo(x + 32, top + 13);
  ctx.lineTo(x + 41, top + 9);
  ctx.lineTo(x + 41, top + 18);
  ctx.closePath();
  ctx.fill();
  // Wing, two frames.
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x + 14, top + 13);
    ctx.lineTo(x + 24, top);
    ctx.lineTo(x + 28, top + 13);
  } else {
    ctx.moveTo(x + 14, top + 16);
    ctx.lineTo(x + 22, top + 22);
    ctx.lineTo(x + 28, top + 16);
  }
  ctx.closePath();
  ctx.fill();
  // Eye.
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(x + 5, top + 9, 1.5, 1.5);
}

/* ---------- cans ---------- */

// The Findabis mark printed on each can: the studio's small credit, in ink on jade. Loaded
// once from its data URI; until it decodes the can simply has no label.
let markImg: HTMLImageElement | null = null;
function findabisMark(): HTMLImageElement | null {
  if (markImg) return markImg.complete && markImg.naturalWidth > 0 ? markImg : null;
  if (typeof Image === "undefined") return null;
  markImg = new Image();
  markImg.src = FINDABIS_MARK.src;
  return null;
}

/** Draws the mark centred at (cx, cy), `size` logical px square. */
export function drawMark(ctx: Ctx, cx: number, cy: number, size: number) {
  const img = findabisMark();
  if (!img) return;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
}

export function drawCan(ctx: Ctx, c: Can, x: number, g: number, t: number) {
  const bob = Math.sin(t * 4 + c.id) * 2;
  const top = g - c.y - CAN.h + bob;
  // Body.
  ctx.fillStyle = COLOR.accent;
  roundRect(ctx, x + 1, top + 5, CAN.w - 2, CAN.h - 5, 2.5, true, true, true, true);
  // Shoulder ring, cap and the nozzle off to one side.
  ctx.fillStyle = COLOR.ink2;
  ctx.fillRect(x + 1, top + 7, CAN.w - 2, 1.5);
  ctx.fillStyle = COLOR.accent;
  ctx.fillRect(x + 3, top + 2, CAN.w - 6, 3);
  ctx.fillStyle = COLOR.accentLit;
  ctx.fillRect(x + 3, top, 3, 2.5);
  // Highlight down the left edge.
  ctx.fillStyle = COLOR.accentLit;
  ctx.fillRect(x + 3, top + 10, 1.5, CAN.h - 14);
  // The label.
  drawMark(ctx, x + CAN.w / 2 + 0.5, top + 14.5, 7.5);
}

/** Pickup burst: a jade ring that grows and fades. */
export function drawPop(ctx: Ctx, x: number, y: number, k: number) {
  ctx.strokeStyle = jade(1 - k);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6 + k * 18, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------- player ---------- */

export function drawPlayer(ctx: Ctx, p: PlayerState, x: number, y: number, g: number, cat: CatPainter) {
  const w = PLAYER.w;
  const h = PLAYER.h;
  const feetY = g - y;

  // Shadow shrinks as the cat leaves the ground.
  const lift = Math.min(1, y / 120);
  ctx.fillStyle = bone(0.12 * (1 - lift * 0.7));
  ctx.beginPath();
  ctx.ellipse(x + w / 2, g + 2, (w / 2 + 4) * (1 - lift * 0.4), 3, 0, 0, Math.PI * 2);
  ctx.fill();

  let sx = 1;
  let sy = 1;
  let bob = 0;
  let tilt = 0;
  if (p.dead) {
    const k = Math.min(1, p.deathTime / 0.35);
    const e = 1 - (1 - k) * (1 - k) * (1 - k);
    tilt = e * (Math.PI / 2);
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
  ctx.translate(x + w / 2, feetY - bob);
  ctx.rotate(tilt);
  ctx.scale(sx, sy);
  if (cat.ready) {
    cat.draw(ctx, -w / 2, -h, w, h);
  } else {
    // Before the sprite decodes: a placeholder in the same silhouette.
    ctx.fillStyle = COLOR.bone;
    ctx.fillRect(-w / 2, -h, w, h);
  }
  ctx.restore();
}

/* ---------- grain ---------- */

let grainTile: HTMLCanvasElement | null = null;
export function drawGrain(ctx: Ctx, viewW: number, viewH: number, alpha: number, offset: number) {
  if (alpha <= 0) return;
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = 128;
    grainTile.height = 128;
    const p = grainTile.getContext("2d");
    if (!p) return;
    const img = p.createImageData(128, 128);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const v = s / 2147483647;
      img.data[i] = 236;
      img.data[i + 1] = 231;
      img.data[i + 2] = 220;
      img.data[i + 3] = v < 0.3 ? Math.floor(v * 3 * 255) : 0;
    }
    p.putImageData(img, 0, 0);
  }
  const pat = ctx.createPattern(grainTile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-(offset % 128), -((offset * 7) % 128));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, viewW + 128, viewH + 128);
  ctx.restore();
}

/* ---------- helpers ---------- */

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  tl: boolean,
  tr: boolean,
  br: boolean,
  bl: boolean,
) {
  ctx.beginPath();
  ctx.moveTo(x + (tl ? r : 0), y);
  ctx.lineTo(x + w - (tr ? r : 0), y);
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - (br ? r : 0));
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + (bl ? r : 0), y + h);
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + (tl ? r : 0));
  if (tl) ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
