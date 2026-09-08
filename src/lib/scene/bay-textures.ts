import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Runtime canvas textures for the unit and the forecourt. Nothing is fetched: every
 * surface is drawn once into a canvas at mount and released with the world. Seeds keep
 * them identical every visit.
 */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(size: number, h = size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function texture(c: HTMLCanvasElement, repeat = true, srgb = true) {
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
export function makeTileTexture(cellsX: number, cellsY: number, band: (x: number, y: number) => boolean, seed = 1): Texture {
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
export function makeSignTexture(text: string, opts: { bg?: string; fg?: string; width?: number; height?: number; font?: string } = {}): Texture {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 256;
  const { c, g } = canvas(width, height);
  g.fillStyle = opts.bg ?? "#f2f3f4";
  g.fillRect(0, 0, width, height);
  g.fillStyle = opts.fg ?? "#111";
  g.font = opts.font ?? `bold ${Math.round(height * 0.62)}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, width / 2, height / 2 + height * 0.02);
  return texture(c, false);
}

/** The JJ roundel on the gable: purple disc, JJ, and the family name around it. */
export function makeRoundelTexture(): Texture {
  const size = 512;
  const { c, g } = canvas(size);
  g.clearRect(0, 0, size, size);
  g.fillStyle = "#4b3a8f";
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = `italic bold 200px Georgia, "Times New Roman", serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("JJ", size / 2, size / 2 + 8);
  g.font = `bold 44px Archivo, Arial, sans-serif`;
  g.fillText("JENKINS", size / 2, size * 0.2);
  g.fillText("& SONS", size / 2, size * 0.82);
  const t = texture(c, false);
  return t;
}

/** A shelf of product bottles as one strip texture: many coloured labels on a dark shelf. */
export function makeBottlesTexture(seed = 5): Texture {
  const { c, g } = canvas(1024, 256);
  const r = rng(seed);
  g.fillStyle = "#23262b";
  g.fillRect(0, 0, 1024, 256);
  const colours = ["#e63946", "#1d7fdc", "#f4d35e", "#2ec4b6", "#ffffff", "#ff7f11", "#8338ec", LIME, "#111111"];
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
  const tools = ["#d0d3d8", "#b5b8bd", "#e63946", "#1d7fdc", "#f4d35e", "#8f9399"];
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

/** Wet tarmac: dark aggregate with lighter grains and a few puddle patches. */
export function makeTarmacTexture(seed = 7): Texture {
  const { c, g } = canvas(512);
  const r = rng(seed);
  g.fillStyle = "#1a1c20";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + r() * 60;
    g.fillStyle = `rgba(${v},${v},${v + 6},${0.5 + r() * 0.5})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  return texture(c);
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
