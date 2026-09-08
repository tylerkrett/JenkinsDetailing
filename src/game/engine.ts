/**
 * Too Street: the engine. One canvas, no framework. Fixed 60 Hz simulation with
 * interpolated drawing, DPR aware, pauses when the tab hides, cleans up on destroy.
 */
import {
  createCatPainter,
  drawCan,
  drawGrain,
  drawLamps,
  drawObstacle,
  drawPavement,
  drawPlayer,
  drawPop,
  drawRoofs,
  drawSky,
  drawWall,
} from "./draw";
import {
  CAN,
  canBox,
  createPlayer,
  obstacleBox,
  overlaps,
  playerBox,
  pressJump,
  releaseJump,
  setDuck,
  stepPlayer,
  type PlayerState,
} from "./entities";
import { drawHud, drawOver, drawPaused, drawTitle, type Fonts, type HudFx } from "./hud";
import { attachInput } from "./input";
import { createStorage } from "./storage";
import { FONT_BODY_FALLBACK, FONT_DISPLAY_FALLBACK, VIEW } from "./theme";
import type { CreateGame, GameHandle, GamePhase, GameState } from "./types";
import {
  createWorld,
  lampsInView,
  muralPieces,
  muralsInView,
  speedFor,
  stepWorld,
  type WorldState,
} from "./world";

const STEP = 1 / 60;
const MAX_STEPS = 3;
const FREEZE = 0.12;
const RESTART_LOCKOUT = 0.4;

type Pop = { x: number; y: number; t: number };

export const createGame: CreateGame = (canvas, options = {}) => {
  const maybeCtx = canvas.getContext("2d", { alpha: false });
  if (!maybeCtx) throw new Error("Too Street needs a 2D canvas context");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const reducedMotion =
    options.reducedMotion ??
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const storage = createStorage(options.storageKey);
  const cat = createCatPainter();
  const fonts = resolveFonts(canvas);

  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  if (!canvas.hasAttribute("aria-label")) {
    canvas.setAttribute("aria-label", "Too Street, an endless street run. Press space to jump, down to duck.");
  }

  let touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  // Logical view.
  let scale = 1;
  let viewW = VIEW.minWidth;
  let viewH = VIEW.height;
  let groundY = viewH - 60;
  let playerX: number = VIEW.playerX;

  const baseSeed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  let runIndex = 0;
  let world: WorldState = createWorld(baseSeed, viewW);
  let player: PlayerState = createPlayer();
  let prevPlayerY = 0;

  const state: GameState = {
    phase: "title",
    score: 0,
    best: storage.readBest(),
    newBest: false,
    cans: 0,
    neighbourhood: world.neighbourhood,
    plays: storage.readPlays(),
  };

  const fx: HudFx = { scoreFlashAt: -1, bestFlashAt: -1, pieceFlashAt: -1 };
  let lastHundred = 0;
  let lastPieces = 0;
  let pops: Pop[] = [];
  let grainPulse = 0;
  let freeze = 0;
  let overAt = 0;
  let elapsed = 0;
  let lastNotify = 0;
  let lastNotifiedScore = -1;

  /* ---------- sizing ---------- */

  function resize() {
    const cw = canvas.clientWidth || VIEW.minWidth;
    const ch = canvas.clientHeight || VIEW.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(cw * dpr);
    const ph = Math.round(ch * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Narrow or portrait boxes (phones) frame the street from the width so the cat stays
    // legible and the wall and rooftops fill the box; wide boxes get the long view.
    const narrow = cw < 600 || ch > cw;
    scale = narrow ? cw / VIEW.narrowWidth : Math.min(cw / VIEW.minWidth, ch / VIEW.height);
    viewW = cw / scale;
    viewH = ch / scale;
    groundY = viewH - Math.max(56, viewH * (narrow ? 0.16 : 0.2));
    playerX = narrow ? VIEW.playerXNarrow : VIEW.playerX;
    draw(1);
  }

  /* ---------- state plumbing ---------- */

  function notify(force = false) {
    if (!options.onState) return;
    const now = elapsed;
    if (!force && now - lastNotify < 0.2 && state.score === lastNotifiedScore) return;
    lastNotify = now;
    lastNotifiedScore = state.score;
    options.onState({ ...state });
  }

  function setPhase(phase: GamePhase) {
    if (state.phase === phase) return;
    state.phase = phase;
    notify(true);
  }

  function resetRun() {
    world = createWorld(baseSeed + runIndex * 7919, viewW);
    runIndex++;
    player = createPlayer();
    prevPlayerY = 0;
    state.score = 0;
    state.cans = 0;
    state.newBest = false;
    state.neighbourhood = world.neighbourhood;
    fx.scoreFlashAt = -1;
    fx.bestFlashAt = -1;
    fx.pieceFlashAt = -1;
    lastHundred = 0;
    lastPieces = 0;
    pops = [];
    freeze = 0;
  }

  function begin() {
    resetRun();
    setPhase("running");
    // A run starts in the air: the press that started it is also the first jump.
    pressJump(player);
    if (!inputHeld) releaseJump(player);
  }

  function die() {
    player.dead = true;
    freeze = FREEZE;
    grainPulse = 1;
    state.plays += 1;
    storage.writePlays(state.plays);
    if (state.score > state.best) {
      state.best = state.score;
      storage.writeBest(state.best);
    }
    try {
      navigator.vibrate?.(30);
    } catch {
      // Not every browser allows it; nothing to do.
    }
  }

  /* ---------- simulation ---------- */

  function step(dt: number) {
    elapsed += dt;
    if (fx.scoreFlashAt >= 0) fx.scoreFlashAt += dt;
    if (fx.bestFlashAt >= 0) fx.bestFlashAt += dt;
    if (fx.pieceFlashAt >= 0) fx.pieceFlashAt += dt;
    grainPulse = Math.max(0, grainPulse - dt * 3);
    for (const p of pops) p.t += dt;
    pops = pops.filter((p) => p.t < 0.3);

    if (state.phase === "over") {
      stepPlayer(player, dt, 0);
      return;
    }
    if (state.phase !== "running") return;

    if (freeze > 0) {
      freeze -= dt;
      if (freeze <= 0) {
        overAt = elapsed;
        setPhase("over");
      }
      return;
    }

    const speed = speedFor(world.score);
    prevPlayerY = player.y;
    stepPlayer(player, dt, speed);
    stepWorld(world, dt, speed, viewW);

    // Pickups. The player box lives in world x, like everything it can touch.
    const pb = playerBox(player, world.distance + playerX);
    const prevCans = world.cans;
    for (const c of world.pickups) {
      if (c.taken) continue;
      if (overlaps(pb, canBox(c))) {
        c.taken = true;
        world.cans += 1;
        pops.push({ x: c.x - world.distance + CAN.w / 2, y: groundY - c.y - CAN.h / 2, t: 0 });
      }
    }
    // Score first, so a death on this very step banks the points that were earned.
    state.score = world.score + (world.cans - prevCans) * CAN.points;
    state.cans = world.cans;
    state.neighbourhood = world.neighbourhood;
    // Collisions.
    for (const o of world.obstacles) {
      if (o.x > world.distance + playerX + 80) break;
      if (overlaps(pb, obstacleBox(o))) {
        die();
        break;
      }
    }
    const hundred = Math.floor(state.score / 100);
    if (hundred > lastHundred && state.score > 0) {
      lastHundred = hundred;
      fx.scoreFlashAt = 0;
    }
    if (!state.newBest && state.best > 0 && state.score > state.best) {
      state.newBest = true;
      fx.bestFlashAt = 0;
    }
    const pieces = muralPieces(world.cans);
    if (pieces > lastPieces) {
      lastPieces = pieces;
      fx.pieceFlashAt = 0;
    }
    notify();
  }

  /* ---------- drawing ---------- */

  function draw(alpha: number) {
    ctx.setTransform(canvas.width / viewW, 0, 0, canvas.height / viewH, 0, 0);
    const running = state.phase === "running" && freeze <= 0;
    const distance = running ? world.prevDistance + (world.distance - world.prevDistance) * alpha : world.distance;
    const py = running ? prevPlayerY + (player.y - prevPlayerY) * alpha : player.y;
    const t = elapsed;

    drawSky(ctx, world, viewW, viewH, groundY, t);
    if (!reducedMotion) {
      drawRoofs(ctx, world.far, distance, groundY, viewW, false);
      drawRoofs(ctx, world.near, distance, groundY, viewW, true);
    } else {
      // Under reduced motion the skyline stands still, so the parallax cannot pull the eye.
      drawRoofs(ctx, world.far, 0, groundY, viewW, false);
    }
    drawWall(ctx, world, groundY, viewW, muralsInView(distance, viewW), muralPieces(world.cans), cat, distance);
    drawLamps(ctx, lampsInView(distance, viewW), groundY, distance);
    drawPavement(ctx, groundY, viewW, viewH, distance, world.chalk, fonts.display);

    for (const c of world.pickups) {
      if (c.taken) continue;
      const x = c.x - distance;
      if (x > viewW || x + CAN.w < 0) continue;
      drawCan(ctx, c, x, groundY, t);
    }
    for (const o of world.obstacles) {
      const x = o.x - distance;
      if (x > viewW || x + o.def.w < 0) continue;
      drawObstacle(ctx, o, x, groundY, t);
    }
    for (const p of pops) drawPop(ctx, p.x, p.y, p.t / 0.3);
    drawPlayer(ctx, player, playerX, py, groundY, cat);

    if (!reducedMotion) drawGrain(ctx, viewW, viewH, 0.045 + grainPulse * 0.16, Math.floor(t * 60) * 37);

    drawHud(ctx, viewW, state, fonts, fx, t, touch);
    if (state.phase === "title") drawTitle(ctx, viewW, viewH, groundY, state, fonts, touch);
    else if (state.phase === "paused") drawPaused(ctx, viewW, viewH, groundY, fonts, touch);
    else if (state.phase === "over") drawOver(ctx, viewW, viewH, groundY, state, fonts, touch, elapsed - overAt);
  }

  /* ---------- loop ---------- */

  let raf = 0;
  let last = 0;
  let acc = 0;
  let destroyed = false;

  function frame(now: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      step(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    draw(acc / STEP);
  }

  /* ---------- input ---------- */

  let inputHeld = false;

  function onPress() {
    inputHeld = true;
    switch (state.phase) {
      case "title":
        begin();
        break;
      case "over":
        if (elapsed - overAt >= RESTART_LOCKOUT) begin();
        break;
      case "paused":
        handle.resume();
        break;
      case "running":
        pressJump(player);
        break;
      default:
        break;
    }
  }
  function onRelease() {
    inputHeld = false;
    if (state.phase === "running") releaseJump(player);
  }
  function onDuck(down: boolean) {
    if (state.phase === "running") setDuck(player, down);
    else if (!down) setDuck(player, false);
  }
  function onPause() {
    if (state.phase === "running") handle.pause();
    else if (state.phase === "paused") handle.resume();
  }
  function isActive() {
    if (state.phase === "running" || state.phase === "paused") return true;
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  }

  const detachInput =
    options.attachInput === false
      ? () => undefined
      : attachInput(
          canvas,
          {
            press: onPress,
            release: onRelease,
            duck: onDuck,
            pause: onPause,
            any: () => undefined,
          },
          { isActive },
        );

  const onPointerType = (e: PointerEvent) => {
    touch = e.pointerType !== "mouse";
  };
  canvas.addEventListener("pointerdown", onPointerType, { passive: true });

  const onVisibility = () => {
    if (document.hidden && state.phase === "running") handle.pause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(canvas);

  // Web fonts arrive after the first frame; the loop repaints, so a load only needs to happen.
  if (typeof document !== "undefined" && "fonts" in document) {
    void document.fonts.load(`700 42px ${fonts.display}`).catch(() => undefined);
    void document.fonts.load(`500 12px ${fonts.body}`).catch(() => undefined);
  }

  /* ---------- handle ---------- */

  const handle: GameHandle = {
    start() {
      if (state.phase === "title" || state.phase === "over") begin();
    },
    pause() {
      if (state.phase !== "running") return;
      setPhase("paused");
    },
    resume() {
      if (state.phase !== "paused") return;
      last = 0;
      acc = 0;
      setPhase("running");
    },
    restart() {
      if (state.phase === "title" || state.phase === "over") begin();
      else if (state.phase === "paused" || state.phase === "running") {
        resetRun();
        setPhase("running");
      }
    },
    jump() {
      onPress();
      // A programmatic jump has no release, so treat it as a full hold.
      inputHeld = false;
    },
    duck(down) {
      onDuck(down);
    },
    resize,
    getState: () => ({ ...state }),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      detachInput();
      canvas.removeEventListener("pointerdown", onPointerType);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    },
  };

  resize();
  notify(true);
  raf = requestAnimationFrame(frame);
  return handle;
};

/**
 * Display and body fonts. The site loads its fonts through next/font, which renames the
 * families, so the real names are read from the CSS variables it sets on the root; the
 * offline page and anything else fall back to the named fonts.
 */
function resolveFonts(canvas: HTMLCanvasElement): Fonts {
  const fromData = { display: canvas.dataset.fontDisplay, body: canvas.dataset.fontBody };
  let display = fromData.display;
  let body = fromData.body;
  try {
    const cs = getComputedStyle(canvas);
    display ??= cs.getPropertyValue("--font-chakra").trim() || undefined;
    body ??= cs.getPropertyValue("--font-manrope").trim() || undefined;
  } catch {
    // Detached canvas: fall through to the named fonts.
  }
  return {
    display: display ? `${display}, ${FONT_DISPLAY_FALLBACK}` : FONT_DISPLAY_FALLBACK,
    body: body ? `${body}, ${FONT_BODY_FALLBACK}` : FONT_BODY_FALLBACK,
  };
}

export default createGame;
export type { CreateGame, GameHandle, GameOptions, GameState, GamePhase } from "./types";
