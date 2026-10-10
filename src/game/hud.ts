/**
 * The HUD (bottles, the car's panels, score, best, the name of the stretch) and, for the
 * offline page, the title, pause and run-over cards. Drawn in CSS pixels rather than world
 * units, so it is the same size on every screen.
 */
import { drawBottleIcon, rr, setLetterSpacing, type Fonts } from "./draw";
import { COLOR, bone, ink } from "./theme";
import type { GameState } from "./types";
import { PANELS } from "./world";

type Ctx = CanvasRenderingContext2D;

export type HudFx = {
  /** Seconds since the score last crossed a hundred, or -1. */
  scoreFlashAt: number;
  /** Seconds since the best was beaten, or -1. */
  bestFlashAt: number;
  /** Seconds since a car panel was polished, or -1. */
  panelFlashAt: number;
  /** Seconds since a new stretch of the shift began, or -1. */
  stageAt: number;
};

const fmt = new Intl.NumberFormat("en-GB");

/** True during the "on" half of a blink, three blinks over 0.6 s. */
function blink(since: number) {
  if (since < 0 || since > 0.6) return false;
  return Math.floor(since * 10) % 2 === 0;
}

/** Digits on a fixed advance, right aligned at x, so the score never jiggles as it counts. */
function digits(ctx: Ctx, text: string, right: number, y: number) {
  const advance = ctx.measureText("0").width;
  ctx.textAlign = "center";
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i]!, right - (text.length - i - 0.5) * advance, y);
  }
}

export function drawHud(ctx: Ctx, w: number, s: GameState, fonts: Fonts, fx: HudFx, panels: number, compact: boolean) {
  const pad = compact ? 14 : 20;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  setLetterSpacing(ctx, "0px");

  // Score top right, the best under it.
  const scoreSize = compact ? 22 : 28;
  ctx.font = `700 ${scoreSize}px ${fonts.display}`;
  const flashing = blink(fx.scoreFlashAt);
  ctx.fillStyle = flashing ? COLOR.accentLit : COLOR.bone;
  digits(ctx, String(flashing ? Math.floor(s.score / 100) * 100 : s.score), w - pad, pad + scoreSize * 0.8);
  ctx.font = `600 ${compact ? 11 : 12}px ${fonts.body}`;
  ctx.textAlign = "right";
  if (s.newBest) {
    ctx.fillStyle = COLOR.accentLit;
    if (!blink(fx.bestFlashAt)) ctx.fillText("New best", w - pad, pad + scoreSize + 14);
  } else if (s.best > 0) {
    ctx.fillStyle = bone(0.6);
    ctx.fillText(`Best ${fmt.format(s.best)}`, w - pad, pad + scoreSize + 14);
  }

  // Bottles top left, and the car's panels they have polished.
  const icon = compact ? 18 : 20;
  drawBottleIcon(ctx, pad, pad + 1, icon);
  ctx.font = `700 ${compact ? 18 : 20}px ${fonts.display}`;
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.bone;
  ctx.fillText(String(s.bottles), pad + icon * 0.72 + 7, pad + icon * 0.86);
  const meterY = pad + icon + 9;
  const seg = compact ? 8 : 10;
  const flash = blink(fx.panelFlashAt);
  for (let i = 0; i < PANELS; i++) {
    const filled = i < panels;
    ctx.fillStyle = filled && i === panels - 1 && flash ? COLOR.bone : filled ? COLOR.accentLit : bone(0.16);
    rr(ctx, pad + i * (seg + 3), meterY, seg, 4, 2);
    ctx.fill();
  }

  // The stretch of the shift, named as it starts.
  if (fx.stageAt >= 0 && fx.stageAt < 2.6) {
    const a = fx.stageAt < 0.3 ? fx.stageAt / 0.3 : fx.stageAt > 2.1 ? (2.6 - fx.stageAt) / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.font = `600 ${compact ? 13 : 14}px ${fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.bone;
    ctx.fillText(s.stage, w / 2, pad + 14);
    const half = ctx.measureText(s.stage).width / 2;
    ctx.fillStyle = bone(0.35);
    ctx.fillRect(w / 2 - half - 26, pad + 9, 16, 1);
    ctx.fillRect(w / 2 + half + 10, pad + 9, 16, 1);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------- cards, for the offline page (the site draws its own in HTML) ---------- */

function card(ctx: Ctx, w: number, h: number, cw: number, ch: number) {
  const x = (w - cw) / 2;
  const y = Math.max(16, (h - ch) / 2 - h * 0.06);
  ctx.fillStyle = ink(0.84);
  rr(ctx, x, y, cw, ch, 14);
  ctx.fill();
  ctx.strokeStyle = bone(0.1);
  ctx.lineWidth = 1;
  ctx.stroke();
  return y;
}

function line(ctx: Ctx, text: string, x: number, y: number, font: string, color: string, max?: number) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, max);
}

export function drawTitleCard(ctx: Ctx, w: number, h: number, s: GameState, fonts: Fonts, touch: boolean) {
  const cw = Math.min(w - 32, 420);
  const y = card(ctx, w, h, cw, s.best > 0 ? 170 : 150);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  setLetterSpacing(ctx, "-0.02em");
  line(ctx, "Bucket Run", w / 2, y + 24, `800 40px ${fonts.display}`, COLOR.bone);
  setLetterSpacing(ctx, "0px");
  line(
    ctx,
    "Jump the cones, duck the kites, grab the bottles.",
    w / 2,
    y + 76,
    `500 14px ${fonts.body}`,
    bone(0.75),
    cw - 32,
  );
  line(ctx, touch ? "Tap to play" : "Press Space to play", w / 2, y + 106, `700 14px ${fonts.body}`, COLOR.accentLit);
  if (s.best > 0) line(ctx, `Best ${fmt.format(s.best)}`, w / 2, y + 136, `500 12px ${fonts.body}`, bone(0.55));
  ctx.restore();
}

export function drawPausedCard(ctx: Ctx, w: number, h: number, fonts: Fonts, touch: boolean) {
  const y = card(ctx, w, h, Math.min(w - 32, 320), 100);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  line(ctx, "Paused", w / 2, y + 22, `800 28px ${fonts.display}`, COLOR.bone);
  line(ctx, touch ? "Tap to carry on" : "Press P to carry on", w / 2, y + 62, `600 13px ${fonts.body}`, bone(0.65));
  ctx.restore();
}

export function drawOverCard(
  ctx: Ctx,
  w: number,
  h: number,
  s: GameState,
  fonts: Fonts,
  touch: boolean,
  sinceOver: number,
) {
  const y = card(ctx, w, h, Math.min(w - 32, 400), 186);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  line(ctx, s.newBest ? "New best" : "Run over", w / 2, y + 22, `700 13px ${fonts.body}`, COLOR.accentLit);
  line(ctx, fmt.format(s.score), w / 2, y + 42, `800 52px ${fonts.display}`, COLOR.bone);
  line(
    ctx,
    `${s.bottles} ${s.bottles === 1 ? "bottle" : "bottles"}, best ${fmt.format(s.best)}`,
    w / 2,
    y + 106,
    `500 13px ${fonts.body}`,
    bone(0.6),
  );
  // The prompt waits for the input lockout, so a late tap cannot skip the card.
  if (sinceOver > 0.4) {
    line(
      ctx,
      touch ? "Tap to run again" : "Press Space to run again",
      w / 2,
      y + 144,
      `700 14px ${fonts.body}`,
      COLOR.accentLit,
    );
  }
  ctx.restore();
}
