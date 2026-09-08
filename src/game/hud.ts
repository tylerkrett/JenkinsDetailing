/** Score, best, cans and the cards (title, pause, game over). Drawn in logical units. */
import { CAN } from "./entities";
import { WALL_H, drawMark, roundRect, setLetterSpacing } from "./draw";
import { COLOR, bone, ink } from "./theme";
import { MURAL_PIECES } from "./world";
import type { GameState } from "./types";

type Ctx = CanvasRenderingContext2D;

export type Fonts = { display: string; body: string };

export type HudFx = {
  /** Seconds since the score last crossed a hundred, or -1. */
  scoreFlashAt: number;
  /** Seconds since the best was beaten, or -1. */
  bestFlashAt: number;
  /** Seconds since a mural piece completed, or -1. */
  pieceFlashAt: number;
};

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(5, "0");

/** True during the "on" half of a blink, three blinks over 0.6 s. */
function blink(since: number) {
  if (since < 0 || since > 0.6) return false;
  return Math.floor(since * 10) % 2 === 0;
}

export function drawHud(ctx: Ctx, viewW: number, s: GameState, fonts: Fonts, fx: HudFx, t: number, touch: boolean) {
  ctx.save();
  ctx.textBaseline = "top";
  setLetterSpacing(ctx, "0.06em");

  // Score, top right; best to its left.
  ctx.font = `600 20px ${fonts.display}`;
  ctx.textAlign = "right";
  const flashing = blink(fx.scoreFlashAt);
  const beaten = s.newBest && (fx.bestFlashAt < 0.9 && fx.bestFlashAt >= 0 ? blink(fx.bestFlashAt) : true);
  ctx.fillStyle = flashing ? COLOR.accent : COLOR.bone;
  const shown = flashing ? Math.floor(s.score / 100) * 100 : s.score;
  ctx.fillText(pad(shown), viewW - 16, 14);
  ctx.font = `500 13px ${fonts.display}`;
  ctx.fillStyle = beaten ? COLOR.accent : bone(0.5);
  ctx.fillText(`HI ${pad(Math.max(s.best, s.newBest ? s.score : 0))}`, viewW - 92, 19);

  // Cans and mural progress, top left.
  const cx = 16;
  ctx.fillStyle = COLOR.accent;
  roundRect(ctx, cx, 17, 8, 13, 1.5, true, true, true, true);
  ctx.fillStyle = COLOR.ink2;
  ctx.fillRect(cx + 1, 18, 6, 2.5);
  drawMark(ctx, cx + 4, 25, 5);
  ctx.textAlign = "left";
  ctx.font = `600 14px ${fonts.display}`;
  ctx.fillStyle = COLOR.bone;
  ctx.fillText(String(s.cans), cx + 14, 15);
  const done = Math.min(MURAL_PIECES, Math.floor(s.cans / CAN.perPiece));
  const pieceFlash = blink(fx.pieceFlashAt);
  for (let i = 0; i < MURAL_PIECES; i++) {
    const filled = i < done;
    const justDone = filled && i === done - 1 && pieceFlash;
    ctx.fillStyle = justDone ? COLOR.accent : filled ? COLOR.bone : bone(0.18);
    ctx.fillRect(cx + 44 + i * 9, 21, 6, 6);
  }
  ctx.restore();
  void t;
  void touch;
}

/** Cards sit mid-canvas, or up in the sky when the box is tall enough to keep the street clear. */
function card(ctx: Ctx, viewW: number, viewH: number, w: number, h: number, groundY: number) {
  const x = (viewW - w) / 2;
  const skyRoom = groundY - WALL_H - h - 16;
  const y = Math.max(24, Math.min(viewH * 0.5 - h / 2 - 20, skyRoom));
  ctx.fillStyle = ink(0.72);
  roundRect(ctx, x, y, w, h, 4, true, true, true, true);
  return { x, y };
}

function line(ctx: Ctx, text: string, x: number, y: number, font: string, color: string, spacing = "0.02em") {
  ctx.font = font;
  ctx.fillStyle = color;
  setLetterSpacing(ctx, spacing);
  ctx.fillText(text, x, y);
}

export function drawTitle(ctx: Ctx, viewW: number, viewH: number, groundY: number, s: GameState, fonts: Fonts, touch: boolean) {
  const w = Math.min(viewW - 32, 420);
  const h = s.best > 0 ? 132 : 112;
  const { x, y } = card(ctx, viewW, viewH, w, h, groundY);
  const cx = x + w / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  line(ctx, "Too Street", cx, y + 22, `700 42px ${fonts.display}`, COLOR.bone, "-0.01em");
  line(
    ctx,
    touch ? "TAP TO RUN" : "PRESS SPACE TO RUN",
    cx,
    y + 78,
    `500 12px ${fonts.body}`,
    bone(0.62),
    "0.2em",
  );
  if (s.best > 0) line(ctx, `BEST ${pad(s.best)}`, cx, y + 102, `500 12px ${fonts.display}`, bone(0.45), "0.12em");
  ctx.restore();
}

export function drawPaused(ctx: Ctx, viewW: number, viewH: number, groundY: number, fonts: Fonts, touch: boolean) {
  const w = Math.min(viewW - 32, 320);
  const { x, y } = card(ctx, viewW, viewH, w, 84, groundY);
  const cx = x + w / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  line(ctx, "Paused", cx, y + 18, `700 26px ${fonts.display}`, COLOR.bone, "-0.01em");
  line(ctx, touch ? "TAP TO CARRY ON" : "PRESS P TO CARRY ON", cx, y + 54, `500 11px ${fonts.body}`, bone(0.55), "0.2em");
  ctx.restore();
}

export function drawOver(ctx: Ctx, viewW: number, viewH: number, groundY: number, s: GameState, fonts: Fonts, touch: boolean, sinceOver: number) {
  const w = Math.min(viewW - 32, 420);
  const h = 168;
  const { x, y } = card(ctx, viewW, viewH, w, h, groundY);
  const cx = x + w / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  line(ctx, "Too street.", cx, y + 18, `700 34px ${fonts.display}`, COLOR.bone, "-0.01em");
  line(ctx, pad(s.score), cx, y + 64, `600 30px ${fonts.display}`, s.newBest ? COLOR.accent : COLOR.bone, "0.06em");
  line(
    ctx,
    s.newBest ? "NEW BEST" : `BEST ${pad(s.best)}`,
    cx,
    y + 104,
    `500 12px ${fonts.display}`,
    s.newBest ? COLOR.accent : bone(0.45),
    "0.12em",
  );
  // The restart prompt waits for the input lockout so a late tap cannot skip the card.
  if (sinceOver > 0.4) {
    line(ctx, touch ? "TAP TO RUN AGAIN" : "SPACE TO RUN AGAIN", cx, y + 136, `500 11px ${fonts.body}`, bone(0.6), "0.2em");
  }
  ctx.restore();
}
