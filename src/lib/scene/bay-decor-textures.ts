import type { Texture } from "three";

import { canvas, rng, texture } from "./bay-textures";

/**
 * What hangs on the bay walls: the vintage badge chart, enamel garage signs, the two
 * product boards the unit actually carries, a workshop clock and the noticeboard.
 *
 * Same contract as `bay-textures`: nothing is fetched, every surface is drawn into a
 * canvas once at mount and released with the world, and each seed keeps a wall
 * identical between visits. Anything meant to hang clear of its board is drawn on a
 * transparent canvas and mounted with `alphaTest`.
 */

/** Ink, paper and enamel: the palette the older wall pieces share. */
const INK = "#241c16";
const PAPER = "#efdfcd";

/* ------------------------------------------------------------------ *
 * The badge chart
 * ------------------------------------------------------------------ */

/**
 * Marque names for the chart. They are period inventions, several of them local to
 * Tregaron and the Teifi valley, rather than real badges: at the size the chart is read
 * from — a metre of wall across a dim bay — the shapes are the whole effect, and drawn
 * approximations of other firms' marks would only be wrong in a way nobody asked for.
 */
const MARQUES: readonly (readonly [string, string])[] = [
  ["ALVISTON", "Britain. 12 h.p."],
  ["MERIDIAN", "Britain. Up to 30 h.p."],
  ["CAMBRIAN", "Wales. Up to £480."],
  ["ST. ASAPH", "Britain. 9 h.p."],
  ["HARDCASTLE", "Britain. Up to £1,250."],
  ["PENDINE", "Wales. Sports two-seater."],
  ["TEIFI", "Wales. 14 h.p. Up to £395."],
  ["ROYAL STAG", "Britain. Up to 40 h.p."],
  ["IMPERATOR", "France. Up to £2,100."],
  ["THE COMET", "Britain. Light car."],
  ["ARGOSY", "Britain. Up to £560."],
  ["VULCANIA", "Italy. 16 h.p."],
  ["BRAMPTON", "Britain. Up to £310."],
  ["HOLLOWAY", "Britain. Coachbuilt."],
  ["SAXON STAR", "Germany. Up to £1,900."],
  ["GWALIA", "Wales. 10 h.p. Up to £275."],
  ["DEVERELL", "Britain. Up to 25 h.p."],
  ["RAVENSCAR", "Britain. Touring model."],
  ["MARCHMONT", "Britain. Up to £820."],
  ["WYVERN", "Wales. 8 h.p. Up to £240."],
  ["KESTREL", "Britain. Up to 18 h.p."],
  ["LLANON", "Wales. Up to £330."],
  ["BRECON", "Wales. 12 h.p."],
  ["THE ENVOY", "Britain. Up to £1,050."],
];

type BadgeShape =
  | "disc"
  | "shield"
  | "hex"
  | "wings"
  | "diamond"
  | "plate"
  | "cross"
  | "laurel"
  | "oval"
  | "star";

const SHAPES: readonly BadgeShape[] = [
  "disc",
  "shield",
  "hex",
  "wings",
  "diamond",
  "plate",
  "cross",
  "laurel",
  "oval",
  "star",
];

/**
 * Text on an arc, the way a badge carries its name around the rim. Each letter advances
 * by its own measured width rather than a fraction of the size — an M is half again as
 * wide as an I, and stepping by a constant piles the wide ones on top of each other —
 * and the size drops until the whole word fits inside `maxSpan` radians.
 */
function arcText(
  g: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  r: number,
  size: number,
  flip = false,
  maxSpan = 3.9,
) {
  g.save();
  g.translate(cx, cy);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const font = (s: number) => `bold ${s}px Georgia, "Times New Roman", serif`;
  let s = size;
  const measure = () => {
    g.font = font(s);
    return [...text].map((ch) => g.measureText(ch).width + s * 0.06);
  };
  let widths = measure();
  const span = () => widths.reduce((a, b) => a + b, 0) / r;
  while (span() > maxSpan && s > 7) {
    s -= 1;
    widths = measure();
  }
  let a = -span() / 2;
  for (let i = 0; i < text.length; i++) {
    const step = widths[i]! / r;
    const mid = a + step / 2;
    g.save();
    if (flip) {
      // Along the bottom: swinging the frame the other way already leaves each letter
      // upright with its top toward the centre, which is how a rim reads.
      g.rotate(-mid);
      g.translate(0, r);
    } else {
      g.rotate(mid);
      g.translate(0, -r);
    }
    g.fillText(text[i]!, 0, 0);
    g.restore();
    a += step;
  }
  g.restore();
}

/** Fit a word inside a width by stepping the size down until it measures. */
function fitText(
  g: CanvasRenderingContext2D,
  text: string,
  max: number,
  start: number,
  font: (s: number) => string,
) {
  let size = start;
  g.font = font(size);
  while (g.measureText(text).width > max && size > 4) {
    size -= 1;
    g.font = font(size);
  }
}

/**
 * One badge in the chart's ink: a shape, a rim and the marque's name inside it. Drawn in
 * whatever the caller has set as `fillStyle`'s companion — the routine sets its own —
 * within a box of `r` about (cx, cy).
 */
function drawBadge(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shape: BadgeShape,
  name: string,
  r0: () => number,
) {
  g.save();
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = Math.max(1.4, r * 0.05);
  const short = name.split(" ").pop()!.slice(0, 9);
  const initials = name
    .split(/[\s-]/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3);

  const rim = (path: () => void, inset: number) => {
    path();
    g.stroke();
    g.save();
    g.lineWidth = Math.max(1, r * 0.028);
    g.translate(cx, cy);
    g.scale(1 - inset, 1 - inset);
    g.translate(-cx, -cy);
    path();
    g.stroke();
    g.restore();
  };

  const disc = () => {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
  };
  const oval = () => {
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.68, 0, 0, Math.PI * 2);
  };
  const shield = () => {
    g.beginPath();
    g.moveTo(cx - r * 0.82, cy - r * 0.92);
    g.lineTo(cx + r * 0.82, cy - r * 0.92);
    g.lineTo(cx + r * 0.82, cy + r * 0.18);
    g.quadraticCurveTo(cx + r * 0.8, cy + r * 0.78, cx, cy + r * 0.98);
    g.quadraticCurveTo(
      cx - r * 0.8,
      cy + r * 0.78,
      cx - r * 0.82,
      cy + r * 0.18,
    );
    g.closePath();
  };
  const poly = (n: number, rot: number) => () => {
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.94;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  };

  switch (shape) {
    case "disc": {
      rim(disc, 0.14);
      arcText(g, name.slice(0, 12), cx, cy, r * 0.66, r * 0.3);
      g.beginPath();
      g.arc(cx, cy + r * 0.16, r * 0.3, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "shield": {
      rim(shield, 0.16);
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(g, short, r * 1.2, r * 0.46, (s) => `bold ${s}px Georgia, serif`);
      g.fillText(short, cx, cy - r * 0.18);
      // A chevron across the foot, the way a coat of arms divides.
      g.beginPath();
      g.moveTo(cx - r * 0.55, cy + r * 0.5);
      g.lineTo(cx, cy + r * 0.26);
      g.lineTo(cx + r * 0.55, cy + r * 0.5);
      g.lineWidth = Math.max(1.4, r * 0.09);
      g.stroke();
      break;
    }
    case "hex": {
      rim(poly(6, Math.PI / 6), 0.16);
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(
        g,
        initials,
        r * 1.1,
        r * 0.72,
        (s) => `bold ${s}px Georgia, serif`,
      );
      g.fillText(initials, cx, cy);
      break;
    }
    case "wings": {
      // A winged bar: the badge shape of every fast tourer in the book.
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * r * 0.3, cy - r * 0.1);
        for (let i = 0; i < 4; i++) {
          const w = r * (1.0 - i * 0.13);
          g.quadraticCurveTo(
            cx + s * w * 0.8,
            cy - r * 0.34 + i * r * 0.16,
            cx + s * w,
            cy - r * 0.1 + i * r * 0.2,
          );
          g.lineTo(cx + s * r * 0.3, cy - r * 0.02 + i * r * 0.2);
        }
        g.closePath();
        g.fill();
      }
      g.beginPath();
      g.ellipse(cx, cy, r * 0.34, r * 0.44, 0, 0, Math.PI * 2);
      g.fillStyle = PAPER;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = Math.max(1.4, r * 0.07);
      g.stroke();
      g.fillStyle = INK;
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(
        g,
        initials,
        r * 0.5,
        r * 0.4,
        (s) => `bold ${s}px Georgia, serif`,
      );
      g.fillText(initials, cx, cy);
      break;
    }
    case "diamond": {
      rim(poly(4, -Math.PI / 2), 0.18);
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(g, short, r * 1.0, r * 0.34, (s) => `bold ${s}px Georgia, serif`);
      g.fillText(short, cx, cy);
      break;
    }
    case "plate": {
      // A plain rectangular wordmark, the cheapest badge a firm could fit.
      g.beginPath();
      g.roundRect(cx - r, cy - r * 0.5, r * 2, r, r * 0.12);
      g.stroke();
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(
        g,
        name,
        r * 1.7,
        r * 0.42,
        (s) => `italic bold ${s}px Georgia, serif`,
      );
      g.fillText(name, cx, cy);
      break;
    }
    case "cross": {
      rim(disc, 0.12);
      g.lineWidth = Math.max(1.4, r * 0.12);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2);
        g.lineTo(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74);
        g.stroke();
      }
      g.beginPath();
      g.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "laurel": {
      rim(disc, 0.2);
      // Laurel leaves round the lower half.
      for (let i = 0; i < 22; i++) {
        const a = Math.PI * 0.15 + (i / 21) * Math.PI * 0.7;
        for (const s of [-1, 1]) {
          const aa = s > 0 ? a : Math.PI - a;
          const x = cx + Math.cos(aa) * r * 0.66;
          const y = cy + Math.sin(aa) * r * 0.66;
          g.save();
          g.translate(x, y);
          g.rotate(aa + Math.PI / 2);
          g.beginPath();
          g.ellipse(0, 0, r * 0.11, r * 0.045, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(
        g,
        initials,
        r * 0.9,
        r * 0.6,
        (s) => `bold ${s}px Georgia, serif`,
      );
      g.fillText(initials, cx, cy + r * 0.06);
      break;
    }
    case "oval": {
      rim(oval, 0.16);
      g.textAlign = "center";
      g.textBaseline = "middle";
      fitText(g, name, r * 1.5, r * 0.36, (s) => `bold ${s}px Georgia, serif`);
      g.fillText(name, cx, cy);
      break;
    }
    case "star": {
      rim(disc, 0.14);
      const points = 3 + Math.floor(r0() * 3);
      g.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
        const rr = i % 2 ? r * 0.26 : r * 0.72;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
      break;
    }
  }
  g.restore();
}

/**
 * The framed chart of motor car badges: aged paper, an engraved heading and a grid of
 * badges each with its marque and a line of specification under it, in the manner of the
 * between-the-wars prints that hang in every good workshop.
 */
export function makeBadgeChartTexture(seed = 71): Texture {
  const W = 1280;
  const H = 900;
  const { c, g } = canvas(W, H);
  const r = rng(seed);

  // Paper: warm cream, browner toward the edges where the light and the years got at it.
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  const wash = g.createRadialGradient(
    W / 2,
    H * 0.44,
    H * 0.2,
    W / 2,
    H / 2,
    H * 0.95,
  );
  wash.addColorStop(0, "rgba(255,250,240,0.55)");
  wash.addColorStop(1, "rgba(120,86,52,0.32)");
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);
  // Foxing: the rust-coloured spots old paper picks up.
  for (let i = 0; i < 420; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 1 + r() * 6;
    g.fillStyle = `rgba(${(120 + r() * 50) | 0},${(70 + r() * 40) | 0},40,${0.03 + r() * 0.07})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  // A horizontal crease where the sheet was once folded.
  g.fillStyle = "rgba(90,64,40,0.10)";
  g.fillRect(0, H * 0.53, W, 3);

  // The heading, letter-spaced the way engraved capitals are set.
  const title = "THE FINEST MOTOR CAR BADGES IN THE WORLD";
  g.fillStyle = "#1d1611";
  g.textBaseline = "middle";
  g.textAlign = "center";
  // Set the tracking with the size so a long heading shrinks to the sheet rather than
  // running off the edge of it.
  let tSize = 58;
  let track = tSize * 0.09;
  let widths: number[] = [];
  let total = 0;
  const measure = () => {
    g.font = `${tSize}px Georgia, "Times New Roman", serif`;
    widths = [...title].map((ch) => g.measureText(ch).width + track);
    total = widths.reduce((a, b) => a + b, 0) - track;
  };
  measure();
  while (total > W - 96 && tSize > 18) {
    tSize -= 1;
    track = tSize * 0.09;
    measure();
  }
  let x = W / 2 - total / 2;
  for (let i = 0; i < title.length; i++) {
    g.textAlign = "left";
    g.fillText(title[i]!, x, 78);
    x += widths[i]!;
  }
  g.textAlign = "center";

  // Four rows of six, each badge with its name and specification beneath.
  const cols = 6;
  const rows = 4;
  const top = 150;
  const cw = W / cols;
  const ch = (H - top - 76) / rows;
  for (let i = 0; i < cols * rows; i++) {
    const [name, spec] = MARQUES[i % MARQUES.length]!;
    const cx = (i % cols) * cw + cw / 2;
    const cy = top + Math.floor(i / cols) * ch + ch * 0.4;
    const shape = SHAPES[Math.floor(r() * SHAPES.length)]!;
    const rad = ch * (0.24 + r() * 0.07);
    drawBadge(g, cx, cy, rad, shape, name, r);
    g.fillStyle = "rgba(29,22,17,0.9)";
    g.font = `bold 15px Georgia, serif`;
    g.fillText(name, cx, cy + ch * 0.38);
    g.fillStyle = "rgba(29,22,17,0.62)";
    g.font = `12px Georgia, serif`;
    g.fillText(spec, cx, cy + ch * 0.38 + 17);
  }

  // The plate mark and the imprint at the foot.
  g.strokeStyle = "rgba(40,28,18,0.35)";
  g.lineWidth = 2;
  g.strokeRect(26, 26, W - 52, H - 52);
  g.fillStyle = "rgba(29,22,17,0.5)";
  g.font = `italic 15px Georgia, serif`;
  g.fillText("Printed for the motoring public — Cardiganshire", W / 2, H - 32);

  return texture(c, false);
}

/* ------------------------------------------------------------------ *
 * Enamel signs
 * ------------------------------------------------------------------ */

export type EnamelSpec = {
  text: string;
  sub?: string;
  /** Field colour behind the lettering. */
  bg: string;
  /** Lettering colour. */
  fg: string;
  /** The rim band; the field colour is used when it is left out. */
  ring?: string;
  shape?: "disc" | "shield" | "plate";
};

/** Chips: the porcelain flaking back to dark steel at the rim and round the fixings. */
function chip(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rad: number,
  r: () => number,
  n = 26,
) {
  g.fillStyle = "#2b2621";
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = rad * (0.9 + r() * 0.12);
    g.beginPath();
    g.ellipse(
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d,
      3 + r() * 9,
      2 + r() * 6,
      a,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
}

/** Four bolt holes on the diagonals, dark with a bright lower lip. */
function bolts(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rad: number,
) {
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    g.fillStyle = "#221e1a";
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.beginPath();
    g.arc(x, y + 2, 9, 0.2, Math.PI - 0.2);
    g.fill();
  }
}

/**
 * A vitreous enamel garage sign, the kind that outlived the garage: a bold field, a
 * contrasting rim, chipped edges, four bolt holes and a hard specular streak across the
 * top left. Transparent outside the sign so it hangs on whatever is behind it.
 */
export function makeEnamelSignTexture(spec: EnamelSpec, seed = 81): Texture {
  const S = 512;
  const { c, g } = canvas(S);
  const r = rng(seed);
  const cx = S / 2;
  const cy = S / 2;
  const rad = S * 0.46;
  const shape = spec.shape ?? "disc";

  const outline = () => {
    g.beginPath();
    if (shape === "disc") g.arc(cx, cy, rad, 0, Math.PI * 2);
    else if (shape === "plate")
      g.roundRect(cx - rad, cy - rad * 0.52, rad * 2, rad * 1.04, 14);
    else {
      g.moveTo(cx - rad * 0.86, cy - rad * 0.9);
      g.lineTo(cx + rad * 0.86, cy - rad * 0.9);
      g.lineTo(cx + rad * 0.86, cy + rad * 0.15);
      g.quadraticCurveTo(cx + rad * 0.84, cy + rad * 0.76, cx, cy + rad * 0.98);
      g.quadraticCurveTo(
        cx - rad * 0.84,
        cy + rad * 0.76,
        cx - rad * 0.86,
        cy + rad * 0.15,
      );
      g.closePath();
    }
  };

  // Steel body under the enamel, so a chip reads as metal rather than a hole.
  g.fillStyle = "#3a342d";
  outline();
  g.fill();
  chip(g, cx, cy, rad, r);

  g.save();
  outline();
  g.clip();
  g.fillStyle = spec.ring ?? spec.bg;
  g.fillRect(0, 0, S, S);
  g.fillStyle = spec.bg;
  if (shape === "disc") {
    g.beginPath();
    g.arc(cx, cy, rad * 0.8, 0, Math.PI * 2);
    g.fill();
  } else if (shape === "plate") {
    g.beginPath();
    g.roundRect(cx - rad * 0.9, cy - rad * 0.42, rad * 1.8, rad * 0.84, 9);
    g.fill();
  } else {
    g.fillRect(cx - rad * 0.74, cy - rad * 0.74, rad * 1.48, rad * 1.5);
  }

  // Lettering. A long name is set on the arc of a disc and straight on anything else.
  g.fillStyle = spec.fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (shape === "disc" && spec.sub) {
    arcText(g, spec.text, cx, cy, rad * 0.63, 58, false, 3.5);
    arcText(g, spec.sub, cx, cy, rad * 0.65, 34, true, 3.0);
    g.beginPath();
    g.arc(cx, cy, rad * 0.27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = spec.bg;
    const initials = spec.text
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join("");
    fitText(
      g,
      initials,
      rad * 0.4,
      54,
      (t) => `bold ${t}px Archivo, Arial, sans-serif`,
    );
    g.fillText(initials, cx, cy + 2);
  } else {
    fitText(
      g,
      spec.text,
      rad * 1.5,
      92,
      (s) => `bold ${s}px Archivo, "Helvetica Neue", Arial, sans-serif`,
    );
    g.fillText(spec.text, cx, cy - (spec.sub ? 26 : 0));
    if (spec.sub) {
      fitText(
        g,
        spec.sub,
        rad * 1.4,
        40,
        (s) => `${s}px Archivo, Arial, sans-serif`,
      );
      g.fillText(spec.sub, cx, cy + 44);
    }
  }

  // The gloss: enamel keeps a hard sheen down one side however old it gets.
  const sheen = g.createLinearGradient(0, 0, S * 0.9, S);
  sheen.addColorStop(0, "rgba(255,255,255,0.30)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0.05)");
  sheen.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S);
  g.restore();

  bolts(g, cx, cy, rad * 0.82);
  return texture(c, false);
}

/** The signs on the walls, in the order the bay hangs them. */
export const ENAMELS: readonly EnamelSpec[] = [
  {
    text: "MOTOR SPIRIT",
    sub: "SOLD HERE",
    bg: "#0f5c3f",
    fg: "#f3e7cd",
    ring: "#f3e7cd",
  },
  {
    text: "TYRES",
    sub: "FITTED & BALANCED",
    bg: "#b8232f",
    fg: "#f6efe2",
    ring: "#1c1a17",
    shape: "plate",
  },
  {
    text: "LUBRICATION",
    sub: "BAY No. 1",
    bg: "#1a4d86",
    fg: "#f2f4f7",
    ring: "#f2f4f7",
  },
  {
    text: "SERVICE",
    sub: "BY APPOINTMENT",
    bg: "#e0a92b",
    fg: "#231d15",
    ring: "#231d15",
    shape: "shield",
  },
  {
    text: "POLISHING",
    sub: "HAND FINISHED",
    bg: "#6d2f7a",
    fg: "#f4ecf6",
    ring: "#1c1a17",
    shape: "plate",
  },
];

/**
 * A strip of small badges to hang as one plane, the way the bottle shelves are one
 * plane: `n` enamel roundels spaced across a transparent canvas, alternating in colour
 * and shape so a row of them reads as a collection rather than a repeat.
 */
export function makeBadgeStripTexture(n: number, seed = 91): Texture {
  const cell = 256;
  const { c, g } = canvas(cell * n, cell);
  const r = rng(seed);
  const fields = [
    "#0f5c3f",
    "#b8232f",
    "#1a4d86",
    "#e0a92b",
    "#6d2f7a",
    "#1c1a17",
    "#c8551b",
  ];
  const names = ["AC", "GT", "RAC", "AA", "MOT", "JD", "V8", "SS", "TT", "GP"];
  // Walk the label list from a seeded offset instead of drawing at random: two of the
  // same badge in one row of five reads as a mistake rather than a collection.
  const start = Math.floor(r() * names.length);
  for (let i = 0; i < n; i++) {
    const cx = i * cell + cell / 2;
    const cy = cell / 2 + (r() - 0.5) * 18;
    const rad = cell * (0.34 + r() * 0.07);
    const bg = fields[(start + i * 3) % fields.length]!;
    const light = bg === "#e0a92b";
    const fg = light ? "#231d15" : "#f4efe4";

    g.fillStyle = "#3a342d";
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    chip(g, cx, cy, rad, r, 12);

    g.save();
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = fg;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    g.fillStyle = bg;
    g.beginPath();
    g.arc(cx, cy, rad * 0.82, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const label = names[(start + i) % names.length]!;
    fitText(
      g,
      label,
      rad * 1.2,
      rad * 0.9,
      (s) => `bold ${s}px Georgia, serif`,
    );
    g.fillText(label, cx, cy + 2);
    const sheen = g.createLinearGradient(
      cx - rad,
      cy - rad,
      cx + rad,
      cy + rad,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.32)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0.04)");
    sheen.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = sheen;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    g.restore();
  }
  return texture(c, false);
}

/* ------------------------------------------------------------------ *
 * The product boards
 * ------------------------------------------------------------------ */

/**
 * The Autoglym mark, as vector: the outlines lifted from the supplied logo and replayed
 * through `Path2D`, so the wordmark is the real one rather than a guess at the letters,
 * and still costs nothing to fetch. Coordinates are the logo's own 602.79 square.
 */
const AUTOGLYM_PATHS = [
  "M 125.4 294.68 L 129.09 273.15 L 157.22 273.15 L 163.61 298.48 C 152.04 293.77 138.2 292.5 125.4 294.68 M 144.05 208.91 L 150.2 240.13 L 136.41 240.13 Z M 163.96 152.15 L 121.77 152.15 L 86.32 298.7 L 111.39 298.7 C 96.64 304.87 85.72 316.71 85.72 334.21 L 85.72 414.6 C 85.72 468.72 189.74 468.72 189.74 414.6 L 189.74 361.13 L 139.95 361.13 L 139.95 395.31 L 152.52 395.31 L 152.52 403.91 C 152.52 425.32 124.42 424.72 124.42 403.91 L 124.42 345.93 C 124.42 325.14 152.52 324.56 152.52 345.93 L 189.74 345.93 L 189.74 334.21 C 189.74 316.71 178.84 304.87 164.11 298.7 L 199.71 298.7 L 163.96 152.15",
  "M 473.55 478.88 L 465.12 478.88 L 465.12 476.04 L 485.35 476.04 L 485.35 478.88 L 476.92 478.88 L 476.92 501.35 L 473.55 501.35 L 473.55 478.88",
  "M 488.23 476.04 L 492.83 476.04 L 500.8 497.3 L 508.81 476.04 L 513.43 476.04 L 513.43 501.35 L 510.23 501.35 L 510.23 480.3 L 510.16 480.3 L 502.25 501.35 L 499.39 501.35 L 491.49 480.3 L 491.41 480.3 L 491.41 501.35 L 488.23 501.35 L 488.23 476.04",
  "M 476.59 256.2 C 476.59 275.21 448.16 275.21 448.16 256.2 L 448.16 195.99 C 448.16 176.97 476.59 176.97 476.59 195.99 Z M 451.41 354.28 L 437.2 303.1 C 445.26 306.18 454.33 307.62 463.38 307.42 Z M 388.4 300.49 L 377.51 300.49 L 377.51 300.36 L 377.55 300.36 L 377.55 188.41 L 409.79 188.41 L 409.79 266.89 C 409.79 282.72 418.7 293.91 431.28 300.49 Z M 513.79 266.89 L 513.79 185.29 C 513.79 133.56 418.63 131.32 410.37 178.56 L 410.37 152.16 L 306.05 152.16 L 306.05 188.41 L 340.05 188.41 L 340.05 300.36 L 344.96 300.36 L 344.96 300.59 L 325.98 334.96 L 306.93 300.49 L 273.92 300.49 C 288.84 294.33 299.91 282.45 299.91 264.8 L 299.91 152.16 L 262.69 152.16 L 262.69 254.1 C 262.69 273.14 233.12 273.14 233.12 254.1 L 233.12 152.16 L 195.9 152.16 L 195.9 264.8 C 195.9 282.45 206.97 294.33 221.88 300.49 L 204.11 300.49 L 204.11 449.39 L 294.94 449.39 L 294.94 416.09 L 241.59 416.09 L 241.59 305.11 C 249.12 305.76 256.8 305.23 264.04 303.59 L 305.17 382.82 L 305.17 449.39 L 342.97 449.39 L 342.97 382.82 L 386.93 303.13 L 386.93 449.39 L 422.69 449.39 L 422.69 378.65 L 436.46 449.39 L 465.13 449.39 L 479.52 378.65 L 479.52 449.39 L 513.79 449.39 L 513.79 300.49 L 492.29 300.49 C 504.89 293.91 513.79 282.72 513.79 266.89",
];

/** The rigid sign the trade rep leaves behind: the red square mark on a white board. */
export function makeAutoglymTexture(): Texture {
  const S = 512;
  const { c, g } = canvas(S);
  g.fillStyle = "#f4f5f6";
  g.fillRect(0, 0, S, S);
  // The mark sits inset on the board with a white margin, as the supplied artwork has it.
  const inset = S * 0.06;
  const k = (S - inset * 2) / 602.79;
  g.save();
  g.translate(inset, inset);
  g.scale(k, k);
  g.fillStyle = "#ec1d36";
  g.fillRect(31.67, 31.31, 539.46, 540.14);
  g.fillStyle = "#ffffff";
  for (const d of AUTOGLYM_PATHS) g.fill(new Path2D(d));
  g.restore();
  // Print gloss: a soft diagonal highlight, and the board's own edge shadow.
  const sheen = g.createLinearGradient(0, 0, S, S * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.22)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(0,0,0,0.14)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S);
  return texture(c, false);
}

/**
 * The Meguiar's board: the yellow script over the red banner on black, drawn rather than
 * traced. The house serif italic stands in for the original's lettering — at a third of
 * a metre on a garage wall it is the colour, the swash and the banner that name it.
 */
export function makeMeguiarsTexture(): Texture {
  const W = 1024;
  const H = 576;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#0a0a0a";
  g.fillRect(0, 0, W, H);

  // The banner first: a red ribbon sweeping up under the word, with folded tails.
  g.save();
  g.translate(W / 2, H * 0.63);
  g.rotate(-0.1);
  g.fillStyle = "#d81f26";
  g.beginPath();
  g.moveTo(-360, 40);
  g.quadraticCurveTo(0, -26, 360, 6);
  g.lineTo(360, 84);
  g.quadraticCurveTo(0, 52, -360, 118);
  g.closePath();
  g.fill();
  // Tails: a darker fold at each end where the ribbon turns back on itself.
  g.fillStyle = "#a3141b";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 360, s > 0 ? 6 : 40);
    g.lineTo(s * 424, s > 0 ? -22 : 16);
    g.lineTo(s * 424, s > 0 ? 62 : 104);
    g.lineTo(s * 360, s > 0 ? 84 : 118);
    g.closePath();
    g.fill();
  }
  g.fillStyle = "#f7e8c8";
  g.font = `italic bold 46px Georgia, "Times New Roman", serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("since 1901", 40, 42);
  g.restore();

  // The wordmark: heavy italic serif, warm yellow, with a dark keyline so it holds its
  // shape against the banner it overlaps.
  g.save();
  g.translate(W / 2, H * 0.45);
  g.rotate(-0.06);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `italic bold 176px Georgia, "Times New Roman", serif`;
  g.lineJoin = "round";
  g.strokeStyle = "#1a1205";
  g.lineWidth = 14;
  g.strokeText("Meguiar's", 0, 0);
  const gold = g.createLinearGradient(0, -90, 0, 90);
  gold.addColorStop(0, "#ffe14f");
  gold.addColorStop(0.55, "#f5c518");
  gold.addColorStop(1, "#e0a505");
  g.fillStyle = gold;
  g.fillText("Meguiar's", 0, 0);

  // The swash off the initial: the original's M carries a long curl back under the word.
  g.strokeStyle = "#f5c518";
  g.lineWidth = 11;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-296, -52);
  g.bezierCurveTo(-392, -96, -424, 12, -336, 40);
  g.stroke();
  g.restore();

  // The four-point sparkle over the shoulder of the word.
  const sx = W * 0.62;
  const sy = H * 0.19;
  g.fillStyle = "#ffffff";
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 12 : 74;
    const x = sx + Math.cos(a) * rr;
    const y = sy + Math.sin(a) * rr * 0.92;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();

  return texture(c, false);
}

/* ------------------------------------------------------------------ *
 * Small wall furniture
 * ------------------------------------------------------------------ */

/** A workshop wall clock: white face, black bezel, ten past ten and a red sweep hand. */
export function makeClockTexture(): Texture {
  const S = 512;
  const { c, g } = canvas(S);
  const cx = S / 2;
  g.fillStyle = "#15171a";
  g.beginPath();
  g.arc(cx, cx, S * 0.48, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f4f2ec";
  g.beginPath();
  g.arc(cx, cx, S * 0.42, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#15171a";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const hour = i % 5 === 0;
    g.lineWidth = hour ? 7 : 2;
    const r1 = S * (hour ? 0.33 : 0.365);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * S * 0.4, cx + Math.sin(a) * S * 0.4);
    g.stroke();
  }
  g.fillStyle = "#15171a";
  g.font = `bold 44px Archivo, Arial, sans-serif`;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(
      String(i),
      cx + Math.cos(a) * S * 0.27,
      cx + Math.sin(a) * S * 0.27 + 3,
    );
  }
  g.font = `italic 22px Georgia, serif`;
  g.fillStyle = "#6d6a63";
  g.fillText("JENKINS", cx, cx + S * 0.16);
  const hand = (angle: number, len: number, width: number, colour: string) => {
    g.save();
    g.translate(cx, cx);
    g.rotate(angle);
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, width * 1.4);
    g.lineTo(0, -len);
    g.stroke();
    g.restore();
  };
  hand(
    Math.PI * 2 * (10 / 12) + Math.PI * 2 * (10 / 60 / 12),
    S * 0.2,
    14,
    "#15171a",
  );
  hand(Math.PI * 2 * (10 / 60), S * 0.3, 10, "#15171a");
  hand(Math.PI * 2 * (36 / 60), S * 0.33, 4, "#c62828");
  g.fillStyle = "#15171a";
  g.beginPath();
  g.arc(cx, cx, 12, 0, Math.PI * 2);
  g.fill();
  // Glass: a curved reflection across the top left of the face.
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.ellipse(
    cx - S * 0.11,
    cx - S * 0.13,
    S * 0.26,
    S * 0.15,
    -0.7,
    0,
    Math.PI * 2,
  );
  g.fill();
  return texture(c, false);
}

/**
 * The noticeboard by the door: two framed certificates and a job sheet pinned up, with
 * the text as ruled lines — real words at this size would be a smear, and the shape of a
 * certificate is what the eye reads anyway.
 */
export function makeNoticeboardTexture(seed = 101): Texture {
  const W = 768;
  const H = 512;
  const { c, g } = canvas(W, H);
  const r = rng(seed);
  // Cork.
  g.fillStyle = "#9a6f3f";
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${(90 + r() * 90) | 0},${(60 + r() * 60) | 0},${(25 + r() * 40) | 0},0.5)`;
    g.fillRect(r() * W, r() * H, 3 + r() * 5, 2 + r() * 4);
  }
  g.fillStyle = "#3b2a17";
  g.fillRect(0, 0, W, 18);
  g.fillRect(0, H - 18, W, 18);
  g.fillRect(0, 0, 18, H);
  g.fillRect(W - 18, 0, 18, H);

  const sheet = (
    x: number,
    y: number,
    w: number,
    h: number,
    tilt: number,
    seal: boolean,
    heading: string,
  ) => {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(tilt);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
    g.fillStyle = "#f6f1e4";
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = "rgba(120,95,55,0.5)";
    g.lineWidth = 3;
    g.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
    g.fillStyle = "#2b2119";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitText(g, heading, w - 44, 26, (s) => `bold ${s}px Georgia, serif`);
    g.fillText(heading, 0, -h / 2 + 40);
    // Ruled text.
    g.fillStyle = "rgba(60,48,36,0.45)";
    for (let i = 0; i < 6; i++) {
      const lw = (w - 70) * (0.5 + r() * 0.5);
      g.fillRect(-lw / 2, -h / 2 + 68 + i * 15, lw, 4);
    }
    if (seal) {
      g.fillStyle = "#a8232c";
      g.beginPath();
      g.arc(0, h / 2 - 44, 24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.font = `bold 15px Georgia, serif`;
      g.fillText("JD", 0, h / 2 - 44);
    }
    g.restore();
    // The pin.
    g.fillStyle = "#c62828";
    g.beginPath();
    g.arc(x + w / 2, y + 12, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.beginPath();
    g.arc(x + w / 2 - 3, y + 9, 3, 0, Math.PI * 2);
    g.fill();
  };

  sheet(46, 52, 300, 400, -0.03, true, "CERTIFIED DETAILER");
  sheet(400, 40, 300, 200, 0.025, false, "PUBLIC LIABILITY");
  sheet(410, 268, 280, 190, -0.02, false, "BOOKINGS — THIS WEEK");
  return texture(c, false);
}

/**
 * A between-the-wars motoring poster for the long wall: a hard diagonal ground, a low
 * car silhouette across it and the sort of copy the railway posters carried.
 */
export function makeGaragePosterTexture(): Texture {
  const W = 640;
  const H = 900;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#e9dcc2";
  g.fillRect(0, 0, W, H);
  // Sky and land as two flat planes on a diagonal, the deco way.
  g.fillStyle = "#20507a";
  g.beginPath();
  g.moveTo(0, 90);
  g.lineTo(W, 90);
  g.lineTo(W, 470);
  g.lineTo(0, 560);
  g.closePath();
  g.fill();
  g.fillStyle = "#d9762a";
  g.beginPath();
  g.arc(W * 0.72, 250, 96, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#173a58";
  g.beginPath();
  g.moveTo(0, 430);
  g.lineTo(W * 0.34, 300);
  g.lineTo(W * 0.62, 420);
  g.lineTo(W, 330);
  g.lineTo(W, 470);
  g.lineTo(0, 560);
  g.closePath();
  g.fill();
  // The road, and the car on it.
  g.fillStyle = "#c9b795";
  g.beginPath();
  g.moveTo(0, 560);
  g.lineTo(W, 470);
  g.lineTo(W, 620);
  g.lineTo(0, 700);
  g.closePath();
  g.fill();
  g.fillStyle = "#14171c";
  g.beginPath();
  g.moveTo(90, 566);
  g.lineTo(190, 566);
  g.quadraticCurveTo(250, 500, 340, 508);
  g.quadraticCurveTo(430, 512, 470, 556);
  g.lineTo(556, 546);
  g.quadraticCurveTo(578, 566, 552, 580);
  g.lineTo(110, 606);
  g.quadraticCurveTo(74, 592, 90, 566);
  g.closePath();
  g.fill();
  for (const [wx, wy] of [
    [176, 596],
    [480, 566],
  ] as const) {
    g.fillStyle = "#14171c";
    g.beginPath();
    g.arc(wx, wy, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e9dcc2";
    g.beginPath();
    g.arc(wx, wy, 15, 0, Math.PI * 2);
    g.fill();
  }
  // Copy.
  g.fillStyle = "#1a1611";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(
    g,
    "KEEP IT",
    W - 80,
    96,
    (s) => `bold ${s}px Georgia, "Times New Roman", serif`,
  );
  g.fillText("KEEP IT", W / 2, 740);
  g.fillStyle = "#a8232c";
  fitText(
    g,
    "GLEAMING",
    W - 80,
    118,
    (s) => `bold ${s}px Georgia, "Times New Roman", serif`,
  );
  g.fillText("GLEAMING", W / 2, 828);
  g.fillStyle = "#1a1611";
  g.font = `28px Georgia, serif`;
  g.fillText("JENKINS & SONS — TREGARON", W / 2, 52);
  return texture(c, false);
}
