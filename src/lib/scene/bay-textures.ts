import {
  CanvasTexture,
  Color,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

/**
 * Runtime canvas textures for the unit and the forecourt. Nothing is fetched: every
 * surface is drawn once into a canvas at mount and released with the world. Seeds keep
 * them identical every visit.
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function canvas(size: number, h = size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

export function texture(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.flipY = true;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const LIME = "#c3d93c";

/**
 * Interlocking floor tiles, one tile per cell: ribbed black with a fine perforated
 * pattern, or the light yellow-green of the client's unit. `cells` tiles per texture
 * edge; the caller repeats it. `band` returns true for cells that are green.
 */
export function makeTileTexture(
  cellsX: number,
  cellsY: number,
  band: (x: number, y: number) => boolean,
  seed = 1,
): Texture {
  const px = 48;
  const { c, g } = canvas(cellsX * px, cellsY * px);
  const r = rng(seed);
  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const green = band(x, y);
      const base = green ? LIME : "#141517";
      g.fillStyle = base;
      g.fillRect(x * px, y * px, px, px);
      // Ribs: fine vertical lines across the tile.
      g.strokeStyle = green ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)";
      g.lineWidth = 1;
      for (let i = 4; i < px; i += 6) {
        g.beginPath();
        g.moveTo(x * px + i, y * px + 3);
        g.lineTo(x * px + i, y * px + px - 3);
        g.stroke();
      }
      // Perforations: a grid of tiny holes.
      g.fillStyle = green ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.55)";
      for (let j = 6; j < px; j += 8) {
        for (let i = 6; i < px; i += 8) {
          g.beginPath();
          g.arc(x * px + i, y * px + j, 1, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Tile edge and a little wear.
      g.strokeStyle = green ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.6)";
      g.lineWidth = 2;
      g.strokeRect(x * px + 1, y * px + 1, px - 2, px - 2);
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
      g.fillRect(x * px, y * px, px, px);
    }
  }
  return texture(c);
}

/** Painted blockwork: white emulsion over concrete blocks, joints just visible. */
export function makeBlockworkTexture(seed = 2): Texture {
  const { c, g } = canvas(512);
  const r = rng(seed);
  g.fillStyle = "#e6e8ea";
  g.fillRect(0, 0, 512, 512);
  const bh = 64;
  const bw = 128;
  for (let row = 0; row < 512 / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 512 + bw; x += bw) {
      const shade = 0.93 + r() * 0.07;
      g.fillStyle = `rgb(${Math.round(226 * shade)},${Math.round(229 * shade)},${Math.round(232 * shade)})`;
      g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  g.strokeStyle = "rgba(0,0,0,0.08)";
  g.lineWidth = 2;
  for (let y = 0; y <= 512; y += bh) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  // Scuffs low on the wall.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(60,60,60,${r() * 0.08})`;
    g.fillRect(r() * 512, 380 + r() * 130, 10 + r() * 40, 2 + r() * 4);
  }
  return texture(c);
}

/** Welsh stone: random rubble courses in grey, brown and slate, lime mortar. */
export function makeStoneTexture(seed = 3, dark = false): Texture {
  const { c, g } = canvas(512);
  const r = rng(seed);
  g.fillStyle = dark ? "#4a4740" : "#8d8a80";
  g.fillRect(0, 0, 512, 512);
  let y = 0;
  while (y < 512) {
    const h = 28 + r() * 30;
    let x = -20;
    while (x < 512) {
      const w = 40 + r() * 70;
      const tone = (dark ? 70 : 110) + r() * 60;
      const warm = r() * 20;
      g.fillStyle = `rgb(${Math.round(tone + warm)},${Math.round(tone + warm * 0.6)},${Math.round(tone - warm * 0.3)})`;
      g.beginPath();
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 5);
      g.fill();
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
      g.fillRect(x + 4, y + h - 8, w - 8, 4);
      x += w;
    }
    y += h;
  }
  return texture(c);
}

/** Corrugated roofing sheet, weathered grey-blue with rust streaks. */
export function makeCorrugatedTexture(seed = 4): Texture {
  const { c, g } = canvas(256);
  const r = rng(seed);
  for (let x = 0; x < 256; x++) {
    const wave = 0.5 + 0.5 * Math.sin((x / 256) * Math.PI * 2 * 12);
    const v = 110 + wave * 55;
    g.fillStyle = `rgb(${Math.round(v * 0.92)},${Math.round(v)},${Math.round(v * 1.06)})`;
    g.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(140,80,40,${r() * 0.25})`;
    g.fillRect(r() * 256, 0, 2 + r() * 6, 256);
  }
  return texture(c);
}

/** A steel roller shutter: horizontal slats with a shadow under each. */
export function makeShutterTexture(): Texture {
  const { c, g } = canvas(128, 512);
  for (let y = 0; y < 512; y += 24) {
    g.fillStyle = "#9aa0a6";
    g.fillRect(0, y, 128, 24);
    g.fillStyle = "#c2c7cc";
    g.fillRect(0, y + 3, 128, 8);
    g.fillStyle = "#5c6166";
    g.fillRect(0, y + 19, 128, 5);
  }
  return texture(c);
}

/** A signboard with bold text: white board, dark letters, e.g. the CARPRO sign. */
export function makeSignTexture(
  text: string,
  opts: {
    bg?: string;
    fg?: string;
    width?: number;
    height?: number;
    font?: string;
  } = {},
): Texture {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 256;
  const { c, g } = canvas(width, height);
  g.fillStyle = opts.bg ?? "#f2f3f4";
  g.fillRect(0, 0, width, height);
  g.fillStyle = opts.fg ?? "#111";
  g.font =
    opts.font ??
    `bold ${Math.round(height * 0.62)}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, width / 2, height / 2 + height * 0.02);
  return texture(c, false);
}

/** The header mark's pixel size; the gable plane is cut to the same ratio. */
export const BRAND_MARK_ASPECT = 184 / 90;

/**
 * The site's Jenkins Detailing mark, for the gable. Same file the header uses, drawn
 * into a canvas so it sits on the same dispose path as the other bay textures.
 */
export function makeBrandMarkTexture(): Texture {
  const width = 1024;
  const height = Math.round(width / BRAND_MARK_ASPECT);
  const { c, g } = canvas(width, height);
  const t = texture(c, false);
  const img = new Image();
  const paint = () => {
    g.clearRect(0, 0, width, height);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, width, height);
    t.needsUpdate = true;
  };
  img.onload = paint;
  img.src = "/brand/mark.png";
  if (img.complete) paint();
  return t;
}

/** A shelf of product bottles as one strip texture: many coloured labels on a dark shelf. */
export function makeBottlesTexture(seed = 5): Texture {
  const { c, g } = canvas(1024, 256);
  const r = rng(seed);
  g.fillStyle = "#23262b";
  g.fillRect(0, 0, 1024, 256);
  const colours = [
    "#e63946",
    "#1d7fdc",
    "#f4d35e",
    "#2ec4b6",
    "#ffffff",
    "#ff7f11",
    "#8338ec",
    LIME,
    "#111111",
  ];
  let x = 6;
  while (x < 1010) {
    const w = 26 + r() * 30;
    const h = 120 + r() * 110;
    const col = colours[Math.floor(r() * colours.length)]!;
    g.fillStyle = col;
    g.beginPath();
    g.roundRect(x, 256 - h, w, h, 6);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillRect(x + 4, 256 - h * 0.7, w - 8, h * 0.28);
    g.fillStyle = "#222";
    g.fillRect(x + w * 0.3, 256 - h - 10, w * 0.4, 12);
    x += w + 4 + r() * 6;
  }
  return texture(c, false);
}

/** A slatwall of tools: dark board with hooks and hanging tool silhouettes. */
export function makeToolWallTexture(seed = 6): Texture {
  const { c, g } = canvas(1024, 512);
  const r = rng(seed);
  g.fillStyle = "#1c1e22";
  g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 2;
  for (let y = 24; y < 512; y += 48) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  const tools = [
    "#d0d3d8",
    "#b5b8bd",
    "#e63946",
    "#1d7fdc",
    "#f4d35e",
    "#8f9399",
  ];
  for (let i = 0; i < 26; i++) {
    const x = 20 + r() * 980;
    const y = 30 + Math.floor(r() * 4) * 96 + 24;
    const col = tools[Math.floor(r() * tools.length)]!;
    g.fillStyle = "#777";
    g.fillRect(x - 2, y - 14, 4, 14);
    g.fillStyle = col;
    const kind = r();
    if (kind < 0.35) {
      // A bottle or can.
      g.beginPath();
      g.roundRect(x - 10, y, 20, 60 + r() * 30, 5);
      g.fill();
    } else if (kind < 0.7) {
      // A brush or wand.
      g.fillRect(x - 3, y, 6, 70 + r() * 40);
      g.fillStyle = "#333";
      g.fillRect(x - 8, y + 60, 16, 22);
    } else {
      // A microfibre or mitt.
      g.beginPath();
      g.roundRect(x - 22, y, 44, 40 + r() * 20, 12);
      g.fill();
    }
  }
  return texture(c, false);
}

/** A framed poster: a dark car shape on a light card. */
export function makePosterTexture(): Texture {
  const { c, g } = canvas(512, 384);
  g.fillStyle = "#f0f0f0";
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = "#101216";
  g.beginPath();
  g.ellipse(256, 230, 190, 60, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(256, 200, 120, 50, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f0f0f0";
  g.beginPath();
  g.arc(160, 270, 26, 0, Math.PI * 2);
  g.arc(352, 270, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2247d6";
  g.fillRect(40, 320, 432, 6);
  return texture(c, false);
}

/** An overcast evening sky: blue-grey, lighter and warmer at the horizon, as a gradient. */
export function makeSkyTexture(): Texture {
  const { c, g } = canvas(64, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#0a0d16");
  grad.addColorStop(0.55, "#182030");
  grad.addColorStop(0.85, "#3a3d48");
  grad.addColorStop(1, "#4a443c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  const t = texture(c, false);
  return t;
}

export function tint(hex: string, k: number) {
  const col = new Color(hex);
  col.multiplyScalar(k);
  return col;
}

/**
 * Asphalt with a broken white centre line and a single yellow line along each kerb.
 * The tile is 9 m wide by 6 m long: one dash period. Repeat it along the road only.
 */
export function makeRoadTexture(seed = 8): Texture {
  const W = 384;
  const H = 256;
  const { c, g } = canvas(W, H);
  const r = rng(seed);
  const px = W / 9;
  g.fillStyle = "#0f1013";
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 7000; i++) {
    const v = 18 + r() * 34;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.5 + r() * 0.5})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  // Tyre tracks: two darker bands in each lane, polished a little.
  for (const x of [-3.0, -1.7, 1.7, 3.0]) {
    const grad = g.createLinearGradient(
      (x - 0.35 + 4.5) * px,
      0,
      (x + 0.35 + 4.5) * px,
      0,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.28)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect((x - 0.35 + 4.5) * px, 0, 0.7 * px, H);
  }
  // Centre dash: 2 m line, 4 m gap; worn at the edges.
  g.fillStyle = "rgba(226,226,214,0.82)";
  g.fillRect(4.44 * px, 0, 0.12 * px, (2 / 6) * H);
  // Single yellow lines by the kerbs.
  g.fillStyle = "rgba(214,176,52,0.72)";
  g.fillRect(0.3 * px, 0, 0.1 * px, H);
  g.fillRect(W - 0.4 * px, 0, 0.1 * px, H);
  return texture(c);
}

/** Pavement slabs, 0.6 m, with darker joints, some cracked and stained. Tile is 2.4 m. */
export function makePavingTexture(seed = 9): Texture {
  const { c, g } = canvas(256);
  const r = rng(seed);
  g.fillStyle = "#3b3d42";
  g.fillRect(0, 0, 256, 256);
  const cell = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 78 + r() * 26;
      g.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      for (let i = 0; i < 40; i++) {
        const s = 60 + r() * 50;
        g.fillStyle = `rgba(${s},${s},${s},0.5)`;
        g.fillRect(
          x * cell + 2 + r() * (cell - 4),
          y * cell + 2 + r() * (cell - 4),
          1.5,
          1.5,
        );
      }
      if (r() < 0.25) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.beginPath();
        g.ellipse(
          x * cell + r() * cell,
          y * cell + r() * cell,
          10 + r() * 14,
          6 + r() * 10,
          r() * 3,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
  }
  return texture(c);
}

export type ShopSpec = {
  name: string;
  /** A second line on the fascia, small. */
  sub?: string;
  /** Facade width in metres; the texture is drawn to fit it. */
  width: number;
  /** Render colour of the upper storey, or "stone". */
  wall: string;
  /** The painted shopfront joinery and fascia. */
  frame: string;
  /** Fascia lettering colour. */
  letter: string;
  /** Upper-floor windows lit, one flag per window. */
  lit: boolean[];
  /** The shop window: lit and open, or dark with the blinds down. */
  open: boolean;
  seed: number;
};

/** The facade height, in metres, the shopfront textures are drawn for. */
export const SHOP_HEIGHT = 7.2;

/**
 * A two-storey Welsh high-street shop: painted shopfront with a big lit window and a
 * fascia, rendered or stone upper floor with sash windows, eaves and a downpipe. Returns
 * the colour map and an emissive map of just the lit glass.
 */
export function makeShopfrontTextures(spec: ShopSpec): {
  map: Texture;
  glow: Texture;
} {
  const W = 512;
  const H = 640;
  const { c, g } = canvas(W, H);
  const { c: gc, g: gg } = canvas(W, H);
  const r = rng(spec.seed);
  const sx = W / spec.width;
  const sy = H / SHOP_HEIGHT;
  /** A rectangle in metres from the ground up. */
  const rect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string | CanvasGradient,
  ) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x * sx, H - (y + h) * sy, w * sx, h * sy);
  };
  const w = spec.width;

  gg.fillStyle = "#000";
  gg.fillRect(0, 0, W, H);

  // The wall.
  if (spec.wall === "stone") {
    g.fillStyle = "#5c5750";
    g.fillRect(0, 0, W, H);
    let y = 0;
    while (y < H) {
      const h = 22 + r() * 18;
      let x = -20;
      while (x < W) {
        const bw = 34 + r() * 50;
        const tone = 96 + r() * 50;
        const warm = r() * 18;
        g.fillStyle = `rgb(${Math.round(tone + warm)},${Math.round(tone + warm * 0.6)},${Math.round(tone - warm * 0.3)})`;
        g.beginPath();
        g.roundRect(x + 2, y + 2, bw - 4, h - 4, 4);
        g.fill();
        x += bw;
      }
      y += h;
    }
  } else {
    g.fillStyle = spec.wall;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) {
      const a = r();
      g.fillStyle =
        a < 0.5
          ? `rgba(0,0,0,${0.03 + r() * 0.06})`
          : `rgba(255,255,255,${0.02 + r() * 0.05})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    }
  }
  // Weather: grime at the foot, a streak under the gutter.
  const grime = g.createLinearGradient(0, H - 3.6 * sy, 0, H);
  grime.addColorStop(0, "rgba(0,0,0,0)");
  grime.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = grime;
  g.fillRect(0, H - 3.6 * sy, W, 3.6 * sy);
  rect(g, 0, SHOP_HEIGHT - 0.28, w, 0.28, "#2b2e34");
  rect(g, 0, SHOP_HEIGHT - 0.34, w, 0.06, "#1d1f24");
  // String course between the floors.
  rect(g, 0, 3.42, w, 0.1, "rgba(255,255,255,0.18)");
  // Downpipe.
  rect(g, w - 0.22, 0, 0.09, SHOP_HEIGHT - 0.3, "#23262b");

  // Upper floor: sash windows.
  const n = w > 5.6 ? 3 : 2;
  const winW = 0.95;
  const winH = 1.45;
  const gap = (w - 0.5 - n * winW) / (n + 1);
  for (let i = 0; i < n; i++) {
    const x = 0.25 + gap + i * (winW + gap);
    const y = 4.35;
    rect(g, x - 0.1, y - 0.12, winW + 0.2, 0.12, "#d7d2c6"); // sill
    rect(g, x - 0.06, y, winW + 0.12, winH + 0.08, "#e9e6df"); // frame
    const lit = spec.lit[i] ?? false;
    if (lit) {
      const grad = g.createLinearGradient(
        0,
        H - (y + winH) * sy,
        0,
        H - y * sy,
      );
      grad.addColorStop(0, "#ffd79a");
      grad.addColorStop(1, "#f0b25c");
      rect(g, x, y, winW, winH, grad);
      // Half-drawn curtain.
      rect(g, x, y, winW * (0.3 + r() * 0.25), winH, "rgba(120,60,50,0.75)");
      rect(gg, x, y, winW, winH, "#ffb45c");
      rect(gg, x, y, winW * 0.35, winH, "#3a1a12");
    } else {
      rect(g, x, y, winW, winH, "#161c28");
      rect(
        g,
        x + 0.1,
        y + 0.2,
        winW * 0.35,
        winH * 0.6,
        "rgba(120,140,170,0.16)",
      );
      rect(gg, x, y, winW, winH, "#0a0f18");
    }
    rect(g, x + winW / 2 - 0.02, y, 0.04, winH, "#e9e6df");
    rect(g, x, y + winH / 2 - 0.02, winW, 0.04, "#e9e6df");
  }

  // Ground floor shopfront: pilasters, stall riser, window, door, fascia.
  rect(g, 0.1, 0, w - 0.2, 3.4, spec.frame);
  rect(g, 0.1, 0, w - 0.2, 3.4, "rgba(0,0,0,0.12)");
  const doorW = 1.0;
  const doorX = w - 0.4 - doorW;
  const winX = 0.45;
  const winWidth = doorX - 0.25 - winX;
  // Stall riser with a little moulding.
  rect(g, winX, 0.05, winWidth, 0.6, spec.frame);
  rect(g, winX + 0.08, 0.14, winWidth - 0.16, 0.42, "rgba(0,0,0,0.22)");
  // The window: warm and full, or blinds down.
  if (spec.open) {
    const grad = g.createLinearGradient(0, H - 2.55 * sy, 0, H - 0.65 * sy);
    grad.addColorStop(0, "#ffe2b0");
    grad.addColorStop(0.5, "#ffc978");
    grad.addColorStop(1, "#d98a3a");
    rect(g, winX, 0.65, winWidth, 1.9, grad);
    // Shelves and goods as silhouettes, and a hanging pendant or two.
    for (let s = 0; s < 3; s++) {
      const y = 0.85 + s * 0.55;
      rect(g, winX + 0.15, y, winWidth - 0.3, 0.05, "rgba(70,40,20,0.75)");
      let gx = winX + 0.2;
      while (gx < winX + winWidth - 0.3) {
        const gw = 0.12 + r() * 0.25;
        const gh = 0.15 + r() * 0.3;
        const hue = Math.floor(r() * 360);
        rect(
          g,
          gx,
          y + 0.05,
          gw,
          gh,
          `hsla(${hue},45%,${28 + r() * 20}%,0.85)`,
        );
        gx += gw + 0.06 + r() * 0.12;
      }
    }
    for (let p = 0; p < 2; p++) {
      const px = winX + winWidth * (0.3 + p * 0.4);
      rect(g, px - 0.01, 2.15, 0.02, 0.4, "rgba(40,20,10,0.8)");
      rect(g, px - 0.14, 2.0, 0.28, 0.16, "rgba(255,240,200,0.95)");
    }
    // Reflection streak across the glass.
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.beginPath();
    g.moveTo((winX + winWidth * 0.55) * sx, H - 2.55 * sy);
    g.lineTo((winX + winWidth * 0.8) * sx, H - 2.55 * sy);
    g.lineTo((winX + winWidth * 0.35) * sx, H - 0.65 * sy);
    g.lineTo((winX + winWidth * 0.1) * sx, H - 0.65 * sy);
    g.closePath();
    g.fill();
    const glow = gg.createLinearGradient(0, H - 2.55 * sy, 0, H - 0.65 * sy);
    glow.addColorStop(0, "#ffd9a6");
    glow.addColorStop(1, "#c77d33");
    rect(gg, winX, 0.65, winWidth, 1.9, glow);
    for (let s = 0; s < 3; s++)
      rect(
        gg,
        winX + 0.15,
        0.85 + s * 0.55,
        winWidth - 0.3,
        0.05,
        "rgba(0,0,0,0.5)",
      );
  } else {
    rect(g, winX, 0.65, winWidth, 1.9, "#1a2230");
    for (let s = 0; s < 14; s++)
      rect(g, winX, 0.7 + s * 0.13, winWidth, 0.06, "rgba(200,190,170,0.16)");
    rect(gg, winX, 0.65, winWidth, 1.9, "#101620");
  }
  // Glazing bars.
  rect(g, winX + winWidth / 2 - 0.02, 0.65, 0.04, 1.9, spec.frame);
  // The door: panelled below, glass above, a lit fanlight.
  rect(g, doorX, 0.05, doorW, 2.5, spec.frame);
  rect(g, doorX + 0.08, 0.15, doorW - 0.16, 0.9, "rgba(0,0,0,0.25)");
  rect(
    g,
    doorX + 0.08,
    1.2,
    doorW - 0.16,
    1.2,
    spec.open ? "#f2c07a" : "#151c28",
  );
  rect(
    gg,
    doorX + 0.08,
    1.2,
    doorW - 0.16,
    1.2,
    spec.open ? "#d99a4a" : "#0a0f18",
  );
  rect(g, doorX + doorW - 0.2, 1.05, 0.05, 0.12, "#d9c26a");
  // Fascia with the name.
  rect(g, 0.1, 2.68, w - 0.2, 0.62, spec.frame);
  rect(g, 0.1, 2.66, w - 0.2, 0.04, "rgba(255,255,255,0.25)");
  rect(g, 0.1, 3.3, w - 0.2, 0.05, "rgba(0,0,0,0.35)");
  g.fillStyle = spec.letter;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const size = Math.min(
    0.36 * sy,
    ((w - 0.8) * sx) / Math.max(6, spec.name.length) / 0.62,
  );
  g.font = `bold ${Math.round(size)}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  g.fillText(
    spec.name.toUpperCase(),
    (w / 2) * sx,
    H - (spec.sub ? 3.08 : 2.99) * sy,
  );
  if (spec.sub) {
    g.font = `${Math.round(0.14 * sy)}px Figtree, Arial, sans-serif`;
    g.fillText(spec.sub, (w / 2) * sx, H - 2.82 * sy);
  }
  // A bracket lamp over the fascia, lit.
  rect(g, w / 2 - 0.12, 3.34, 0.24, 0.06, "#1a1c22");
  rect(gg, 0.3, 2.6, w - 0.6, 0.8, "rgba(255,190,120,0.18)");

  return { map: texture(c, false), glow: texture(gc, false, false) };
}

/**
 * Forecourt tarmac worn by use: darker than the road, with oil stains, patched repairs
 * and the ghosts of old painted lines. The tile is 6 m square; repeat it over the apron.
 */
export function makeForecourtTexture(seed = 41): Texture {
  const { c, g } = canvas(512);
  const r = rng(seed);
  g.fillStyle = "#131418";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 22 + r() * 42;
    g.fillStyle = `rgba(${v},${v},${v + 6},${0.5 + r() * 0.5})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  // Patched repairs: squarish areas of newer, flatter blacktop.
  for (let i = 0; i < 5; i++) {
    const x = r() * 460;
    const y = r() * 460;
    g.fillStyle = `rgba(8,9,12,${0.35 + r() * 0.3})`;
    g.fillRect(x, y, 40 + r() * 90, 30 + r() * 70);
  }
  // Oil drips and the odd spreading stain where a car has stood.
  for (let i = 0; i < 26; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const rad = 3 + r() * 22;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/**
 * A puddle: a soft-edged blob, white in the centre and black at the rim. Used as the
 * alpha of a wet patch laid over the tarmac — three reads the green channel of an
 * alphaMap, not its alpha, so the falloff has to be drawn in luminance on an opaque
 * black ground rather than as transparency.
 */
export function makePuddleTexture(seed = 42): Texture {
  const { c, g } = canvas(256);
  const r = rng(seed);
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 256, 256);
  // A few overlapping blobs make an irregular outline; each fades at its own rim.
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const x = 128 + (r() * 2 - 1) * 40;
    const y = 128 + (r() * 2 - 1) * 40;
    const rad = 40 + r() * 46;
    const grad = g.createRadialGradient(x, y, rad * 0.3, x, y, rad);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(150,150,150,1)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  return texture(c, false, false);
}

/** Foliage: dark mottled green, for hedges and the tree canopies at dusk. */
export function makeFoliageTexture(seed = 43): Texture {
  const { c, g } = canvas(256);
  const r = rng(seed);
  g.fillStyle = "#16240f";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    const hue =
      v < 0.18
        ? "#2f4a1e"
        : v < 0.45
          ? "#233a17"
          : v < 0.8
            ? "#182a10"
            : "#0d1a09";
    g.fillStyle = hue;
    const s = 3 + r() * 9;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, s, s * 0.6, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** The Prince of Wales feathers: three plumes over a coronet, as the totem carries them. */
function drawFeathers(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  colour: string,
) {
  const plume = (lean: number, scale: number) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(lean);
    g.scale(scale, scale);
    const w = h * 0.3;
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-w * 1.15, -h * 0.34, -w * 0.92, -h * 0.78, 0, -h);
    g.bezierCurveTo(w * 0.92, -h * 0.78, w * 1.15, -h * 0.34, 0, 0);
    g.fill();
    // Barbs: a spine and a few ribs, so the plume doesn't read as a flat leaf.
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = h * 0.022;
    g.beginPath();
    g.moveTo(0, -h * 0.06);
    g.lineTo(0, -h * 0.9);
    g.stroke();
    for (let i = 1; i <= 5; i++) {
      const y = -h * (0.18 + i * 0.13);
      const sp = w * (0.78 - i * 0.1);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(-sp, y + h * 0.07);
      g.moveTo(0, y);
      g.lineTo(sp, y + h * 0.07);
      g.stroke();
    }
    g.restore();
  };
  plume(-0.62, 0.82);
  plume(0.62, 0.82);
  plume(0, 1);

  // The coronet the plumes rise out of, and the ribbon under it.
  g.fillStyle = colour;
  const cw = h * 0.46;
  g.beginPath();
  g.roundRect(cx - cw, cy - h * 0.02, cw * 2, h * 0.14, h * 0.03);
  g.fill();
  for (const o of [-0.72, 0, 0.72]) {
    g.beginPath();
    g.arc(cx + o * cw, cy - h * 0.05, h * 0.05, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(cx - cw * 1.35, cy + h * 0.16);
  g.quadraticCurveTo(cx, cy + h * 0.3, cx + cw * 1.35, cy + h * 0.16);
  g.quadraticCurveTo(cx, cy + h * 0.22, cx - cw * 1.35, cy + h * 0.16);
  g.fill();
}

/**
 * The forecourt totem by the road, drawn as the real one on the Tregaron forecourt is:
 * a white board with the feathers and the name at the top, three banded service panels
 * with their displays dark for the night, and the red block of what the garage does.
 * Portrait, and only ever mapped to the board's two faces — never its edges.
 */
export function makeTotemTexture(): Texture {
  const W = 512;
  const H = 1650;
  const { c, g } = canvas(W, H);
  const RED = "#8e1b2e";
  const GREEN = "#0f7a4a";
  const BLOCK = "#b01c2e";
  g.fillStyle = "#f7f6f2";
  g.fillRect(0, 0, W, H);

  drawFeathers(g, W / 2, 300, 190, RED);

  g.fillStyle = RED;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = 'bold 104px Archivo, "Helvetica Neue", Arial, sans-serif';
  g.fillText("Jenkins", W / 2, 452);
  g.font = '46px Archivo, "Helvetica Neue", Arial, sans-serif';
  g.fillText("Garej Rhosyn", W / 2, 524);

  // Three service panels: a coloured header over a dark display.
  const M = 26;
  const panels: [string, string][] = [
    ["Valeting", GREEN],
    ["Detailing", GREEN],
    ["Protection", BLOCK],
  ];
  panels.forEach(([label, colour], i) => {
    const top = 604 + i * 228;
    g.fillStyle = colour;
    g.fillRect(M, top, W - M * 2, 54);
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.font = 'bold 38px Archivo, "Helvetica Neue", Arial, sans-serif';
    g.fillText(label, M + 16, top + 29);
    g.fillStyle = "#24242a";
    g.fillRect(M, top + 54, W - M * 2, 152);
    // A glass reflection across the display, so it reads as a panel and not a hole.
    const sheen = g.createLinearGradient(M, top + 54, W - M, top + 206);
    sheen.addColorStop(0, "rgba(255,255,255,0.09)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.02)");
    sheen.addColorStop(1, "rgba(255,255,255,0.07)");
    g.fillStyle = sheen;
    g.fillRect(M, top + 54, W - M * 2, 152);
  });

  // What the garage does, in the red block at the foot. Each line is set at the biggest
  // size that still fits the block, so the long ones aren't cut off at the edges.
  g.fillStyle = BLOCK;
  g.fillRect(M, 1300, W - M * 2, 300);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  const fit = W - M * 2 - 28;
  ["SERVICING", "MOT's", "VALETING & DETAILING", "PAINT PROTECTION"].forEach(
    (line, i) => {
      let size = 42;
      do {
        g.font = `bold ${size}px Archivo, "Helvetica Neue", Arial, sans-serif`;
        size -= 1;
      } while (g.measureText(line).width > fit && size > 16);
      g.fillText(line, W / 2, 1358 + i * 64);
    },
  );

  // Weathering: the board has stood on a wet forecourt for years.
  const r = rng(53);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(120,118,110,${r() * 0.09})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 8 + r() * 60);
  }
  return texture(c, false);
}

/**
 * A Welsh sash window with its frame: stone lintel over, painted box frame, four panes
 * to each sash, and a stone sill under it with its drip. Returns the colour map and a
 * glow map of just the glass, so a lit window throws light without the frame glowing
 * with it. Everything outside the lintel and sill is left clear for the wall behind.
 */
export function makeSashWindowTextures(
  lit: boolean,
  seed = 61,
): { map: Texture; glow: Texture } {
  const W = 256;
  const H = 352;
  const { c, g } = canvas(W, H);
  const { c: gc, g: gg } = canvas(W, H);
  const r = rng(seed);
  gg.fillStyle = "#000000";
  gg.fillRect(0, 0, W, H);

  // The reveal: a soft shadow around the opening so it sits into the wall.
  g.fillStyle = "rgba(0,0,0,0.32)";
  g.fillRect(20, 30, W - 40, 286);

  // Stone lintel over the head, and the sill with its drip under the cill.
  g.fillStyle = "#7f7c72";
  g.fillRect(14, 16, W - 28, 26);
  g.fillStyle = "#8b887d";
  g.fillRect(14, 16, W - 28, 8);
  g.fillStyle = "#7f7c72";
  g.fillRect(6, 298, W - 12, 24);
  g.fillStyle = "#949186";
  g.fillRect(6, 298, W - 12, 7);
  g.fillStyle = "#4f4d47";
  g.fillRect(10, 322, W - 20, 7);

  // The painted box frame.
  const fx = 30;
  const fy = 42;
  const fw = W - 60;
  const fh = 256;
  g.fillStyle = "#ded9cc";
  g.fillRect(fx, fy, fw, fh);
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(fx, fy, fw, 3);

  // The glass, then the bars over it. Each pane takes its own shade so the glass is
  // not one flat block.
  const gx = fx + 13;
  const gy = fy + 13;
  const gw = fw - 26;
  const gh = fh - 26;
  const cols = 2;
  const rows = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = gx + (i * gw) / cols;
      const py = gy + (j * gh) / rows;
      const pw = gw / cols;
      const ph = gh / rows;
      if (lit) {
        const v = 0.82 + r() * 0.18;
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(217 * v)},${Math.round(160 * v)})`;
        g.fillRect(px, py, pw, ph);
        gg.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(214 * v)},${Math.round(150 * v)})`;
        gg.fillRect(px, py, pw, ph);
      } else {
        const v = 0.85 + r() * 0.3;
        g.fillStyle = `rgb(${Math.round(12 * v)},${Math.round(15 * v)},${Math.round(23 * v)})`;
        g.fillRect(px, py, pw, ph);
        // A sliver of sky caught in the top corner of the upper panes.
        if (j === 0) {
          g.fillStyle = "rgba(120,140,175,0.16)";
          g.fillRect(px, py, pw, ph * 0.4);
        }
      }
    }
  }
  // Glazing bars, the meeting rail between the sashes, and the frame's inner edge.
  g.fillStyle = "#ded9cc";
  g.fillRect(gx + gw / 2 - 3, gy, 6, gh);
  for (let j = 1; j < rows; j++) {
    const h = j === rows / 2 ? 10 : 5;
    g.fillRect(gx, gy + (j * gh) / rows - h / 2, gw, h);
  }
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 2;
  g.strokeRect(gx, gy, gw, gh);

  return { map: texture(c, false), glow: texture(gc, false) };
}

/** A painted four-panel front door with its step, for the house and the cottages. */
export function makeDoorTexture(colour = "#1f3d2b"): Texture {
  const W = 192;
  const H = 384;
  const { c, g } = canvas(W, H);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(10, 10, W - 20, H - 20);
  // Frame, then the leaf inside it.
  g.fillStyle = "#ded9cc";
  g.fillRect(16, 14, W - 32, H - 30);
  g.fillStyle = colour;
  g.fillRect(28, 26, W - 56, H - 54);
  // Four sunk panels.
  const panel = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(x, y, w, h);
    g.fillStyle = colour;
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
  };
  panel(44, 46, 46, 84);
  panel(102, 46, 46, 84);
  panel(44, 148, 46, 118);
  panel(102, 148, 46, 118);
  // A fanlight over the door, the knocker and the step.
  g.fillStyle = "#f0d9a8";
  g.fillRect(34, 30, W - 68, 22);
  g.fillStyle = "#c9b48a";
  g.beginPath();
  g.arc(W / 2 + 46, 150, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8b887d";
  g.fillRect(8, H - 20, W - 16, 16);
  return texture(c, false);
}
